"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Ticket, Package, Monitor,
  AlertCircle, Wifi, WifiOff, RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

interface AdminUser {
  full_name?: string;
  email?: string;
  role?: string;
  department?: { name: string };
}

interface DashboardPersonnel {
  id: number;
  staff_id: string;
  availability: string;
  specialization: string | null;
  is_active: boolean;
  full_name: string | null;
  department: string | null;
}

interface DashboardTicket {
  id: number;
  title: string;
  category: string;
  status: string;
  staff_id: string;
  assigned_to_id: number | null;
  comment: string | null;
  created_at: string;
  closed_at: string | null;
}

interface DashboardSession {
  id: number;
  staff_id: string;
  ip_address?: string;
  login_at: string;
  is_active: boolean;
  staff_name: string | null;
  staff_email: string | null;
}

interface AdminDashboardResponse {
  ticket_summary: { open?: number; in_progress?: number; closed?: number };
  queued_count: number;
  recent_tickets: DashboardTicket[];
  personnel: DashboardPersonnel[];
  assets: { total: number; by_type: Record<string, number> };
  staff_total: number;
  staff_map: Record<string, { full_name: string; email: string }>;
  active_sessions: DashboardSession[];
}

// ── Helpers ───────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", {
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status, comment }: { status: string; comment?: string | null }) {
  const isUnresolved = status === "closed" && !!comment;

  const map: Record<string, { bg: string; color: string }> = {
    "open":        { bg: "#FFF3E0", color: "#C8962E" },
    "in_progress": { bg: "#FFF8E0", color: "#6B2D0F" },
    "closed":      { bg: "#F3F3F3", color: "#555"    },
  };

  const s = map[status] ?? { bg: "#eee", color: "#333" };
  const label = isUnresolved
    ? "Closed — Unresolved"
    : status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span style={{
      background: isUnresolved ? "#FFEBEE" : s.bg,
      color: isUnresolved ? "#BB0000" : s.color,
      padding: "3px 10px", borderRadius: "20px",
      fontSize: "11.5px", fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

const specializationLabel: Record<string, string> = {
  hardware:             "Hardware",
  networking:           "Networking",
  software_and_systems: "Software & Systems",
  security:             "Security",
  other:                "Other",
};

const categoryLabel: Record<string, string> = {
  hardware:            "Hardware",
  software:            "Software",
  network:             "Network",
  access_permissions:  "Access & Permissions",
  security_incidents:  "Security",
  other:               "Other",
};

// ── Component ─────────────────────────────────────────────────

const STALE = 60 * 1000; // 1 minute

export default function AdminDashboardPage() {
  const API = process.env.NEXT_PUBLIC_API_URL;

  // ── Queries — just 2 now instead of 8 ───────────────────────

  const { data: user } = useQuery<AdminUser>({
    queryKey: ["admin-me"],
    queryFn: async () => {
      const res = await fetch(`${API}/staff/me`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    staleTime: STALE,
  });

  const {
    data: dashboard,
    isFetching: refreshingDashboard,
    refetch: refetchDashboard,
  } = useQuery<AdminDashboardResponse>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await fetch(`${API}/dashboard/admin`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    staleTime: STALE,
  });

  const summary        = dashboard?.ticket_summary ?? {};
  const personnel       = dashboard?.personnel ?? [];
  const recentTickets   = dashboard?.recent_tickets ?? [];
  const queuedCount     = dashboard?.queued_count ?? 0;
  const assetsTotal     = dashboard?.assets.total ?? 0;
  const assetsByType    = dashboard?.assets.by_type ?? {};
  const totalStaff      = dashboard?.staff_total ?? 0;
  const staffMap        = dashboard?.staff_map ?? {};
  const sessions        = dashboard?.active_sessions ?? [];

  // ── Derived values ────────────────────────────────────────────

  const loading = !user; // first meaningful check — user is the fastest fetch

  const fullName   = user?.full_name ?? "Loading...";
  const department = user?.department?.name ?? "National Treasury";
  const email      = user?.email ?? "";

  const availableCount = personnel.filter(
    p => p.availability === "available" && p.is_active
  ).length;

  const today = new Date().toLocaleDateString("en-KE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const STATS = [
    { label: "Total Staff",   value: loading ? "—" : String(totalStaff),        icon: Users,   color: "#C8962E" },
    { label: "Open Tickets",  value: loading ? "—" : String(summary.open ?? 0), icon: Ticket,  color: "#6B2D0F" },
    { label: "Total Assets",  value: loading ? "—" : String(assetsTotal),       icon: Package, color: "#C8962E" },
    { label: "ICT Available", value: loading ? "—" : String(availableCount),    icon: Monitor, color: "#2D6B0F" },
  ];

  const assetGroups = Object.entries(assetsByType).reduce<Record<string, number>>((acc, [type, count]) => {
    const key = type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
    acc[key] = count;
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --gold:       #C8962E;
          --gold-light: #E8B84B;
          --brown:      #6B2D0F;
          --brown-dark: #4A1E0A;
          --cream:      #FDF8F2;
          --border:     #EDE0D0;
          --text:       #1A0F08;
          --text-sub:   #7A5C44;
        }

        .adm-root {
          width: 100%; min-width: 0;
          background: var(--cream);
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: var(--text); box-sizing: border-box;
        }
        .adm-content {
          padding: 1.5rem 2rem;
          display: flex; flex-direction: column; gap: 1.5rem;
          width: 100%; min-width: 0; box-sizing: border-box;
        }

        .greeting-card {
          background: var(--brown); border-radius: 16px;
          padding: 1.75rem 2rem;
          display: flex; align-items: center; justify-content: space-between;
          position: relative; overflow: hidden; width: 100%;
        }
        .greeting-card::before {
          content: ''; position: absolute; top: -60px; right: -60px;
          width: 200px; height: 200px; border-radius: 50%;
          background: rgba(200,150,46,0.15);
        }
        .greeting-card::after {
          content: ''; position: absolute; bottom: -40px; right: 100px;
          width: 120px; height: 120px; border-radius: 50%;
          background: rgba(200,150,46,0.08);
        }
        .greeting-left { position: relative; z-index: 1; }
        .greeting-tag {
          font-size: 11px; font-weight: 700; letter-spacing: 2px;
          text-transform: uppercase; color: var(--gold-light); margin-bottom: 0.35rem;
        }
        .greeting-name {
          font-family: 'Playfair Display', serif;
          font-size: 1.6rem; font-weight: 700; color: #fff;
          margin-bottom: 0.3rem; line-height: 1.15;
        }
        .greeting-sub { font-size: 13px; color: rgba(255,255,255,0.55); }
        .greeting-actions {
          display: flex; gap: 0.75rem; position: relative; z-index: 1; flex-wrap: wrap;
        }
        .btn-primary {
          display: flex; align-items: center; gap: 7px;
          background: var(--gold); color: var(--brown-dark);
          padding: 0.6rem 1.2rem; border-radius: 8px;
          font-size: 13px; font-weight: 700; text-decoration: none;
          transition: background 0.15s; border: none; cursor: pointer;
          font-family: inherit;
        }
        .btn-primary:hover { background: var(--gold-light); }
        .btn-ghost {
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.1); color: #fff;
          padding: 0.6rem 1.2rem; border-radius: 8px;
          font-size: 13px; font-weight: 600; text-decoration: none;
          transition: background 0.15s; border: 1px solid rgba(255,255,255,0.2);
          cursor: pointer; font-family: inherit;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.18); }

        .adm-alert {
          background: #FFF8F3; border: 1px solid #F5C8A8;
          border-left: 4px solid var(--gold); border-radius: 10px;
          padding: 12px 16px; display: flex; align-items: center;
          gap: 10px; font-size: 13px; color: var(--brown);
        }
        .adm-alert svg { color: var(--gold); flex-shrink: 0; }
        .adm-alert strong { color: var(--text); }
        .adm-alert a {
          color: var(--gold); font-weight: 600; text-decoration: none;
        }
        .adm-alert a:hover { text-decoration: underline; }

        .stats-row {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem; width: 100%; min-width: 0;
        }
        .stat-card {
          background: #fff; border-radius: 12px; border: 1px solid var(--border);
          padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;
          box-shadow: 0 2px 8px rgba(107,45,15,0.05);
        }
        .stat-icon {
          width: 44px; height: 44px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 1.75rem; font-weight: 700; color: var(--text);
          line-height: 1;
        }
        .stat-label { font-size: 12px; color: var(--text-sub); margin-top: 3px; }

        .two-col {
          display: grid; grid-template-columns: minmax(0, 1fr) 300px;
          gap: 1.5rem; align-items: start; width: 100%; min-width: 0;
        }
        .section-card {
          background: #fff; border-radius: 14px; border: 1px solid var(--border);
          overflow: hidden; box-shadow: 0 2px 8px rgba(107,45,15,0.04);
          width: 100%; min-width: 0;
        }
        .section-header {
          padding: 1.1rem 1.5rem; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          gap: 0.75rem;
        }
        .section-title { font-size: 14px; font-weight: 700; color: var(--text); }
        .section-link {
          font-size: 12px; color: var(--brown);
          text-decoration: none; font-weight: 600;
        }
        .section-link:hover { text-decoration: underline; }

        .refresh-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 0.35rem 0.8rem; border: 1px solid var(--gold);
          border-radius: 8px; background: transparent; color: var(--brown);
          font-size: 12px; font-weight: 600; cursor: pointer;
          transition: background 0.15s; font-family: inherit; flex-shrink: 0;
        }
        .refresh-btn:hover:not(:disabled) { background: #FFF3E0; }
        .refresh-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .refresh-btn.spinning svg { animation: rspin 0.8s linear infinite; }
        @keyframes rspin { to { transform: rotate(360deg); } }

        .ticket-table-wrap { overflow-x: auto; width: 100%; }
        .ticket-table {
          width: 100%; border-collapse: collapse;
          font-size: 13px; min-width: 500px;
        }
        .ticket-table th {
          padding: 0.75rem 1.5rem; text-align: left;
          font-size: 11px; font-weight: 700; color: var(--text-sub);
          letter-spacing: 0.5px; text-transform: uppercase;
          background: #FDFAF6; border-bottom: 1px solid var(--border);
        }
        .ticket-table td {
          padding: 0.85rem 1.5rem; border-bottom: 1px solid #F5EDE0;
          color: var(--text); vertical-align: middle;
        }
        .ticket-table tr:last-child td { border-bottom: none; }
        .ticket-table tr:hover td { background: #FDFAF6; }
        .ticket-id {
          font-weight: 600; color: var(--brown);
          font-size: 12.5px; font-family: monospace;
        }
        .ticket-sub-text {
          font-size: 12px; color: var(--text-sub); margin-top: 2px;
        }
        .queued-badge {
          font-size: 11px; font-weight: 600;
          background: #FFF3E0; color: #C8962E;
          padding: 2px 8px; border-radius: 10px;
        }

        .staff-list { padding: 4px 0; max-height: 280px; overflow-y: auto; }
        .staff-row {
          display: flex; align-items: center;
          padding: 11px 1.5rem; gap: 12px;
          border-bottom: 1px solid #F5EDE0;
        }
        .staff-row:last-child { border-bottom: none; }
        .staff-dot {
          width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
        }
        .staff-name {
          flex: 1; font-size: 13px; font-weight: 500; color: var(--text);
        }
        .staff-spec {
          font-size: 11.5px; color: var(--text-sub);
          background: var(--cream); border: 1px solid var(--border);
          padding: 2px 8px; border-radius: 10px;
        }
        .staff-badge {
          font-size: 11.5px; color: var(--text-sub);
          background: var(--cream); border: 1px solid var(--border);
          padding: 2px 8px; border-radius: 10px;
        }
        .setup-badge {
          font-size: 11px; font-weight: 600;
          background: #FFEBEE; color: #BB0000;
          padding: 2px 8px; border-radius: 10px;
        }

        .asset-list {
          padding: 1rem 1.5rem;
          display: flex; flex-direction: column; gap: 14px;
        }
        .asset-meta {
          display: flex; justify-content: space-between;
          margin-bottom: 6px; font-size: 12.5px;
        }
        .asset-name { font-weight: 500; color: var(--text); }
        .asset-count { color: var(--text-sub); }
        .bar-track {
          height: 6px; background: var(--border);
          border-radius: 4px; overflow: hidden;
        }
        .bar-fill {
          height: 100%; border-radius: 4px;
          background: linear-gradient(90deg, var(--brown), var(--gold));
          transition: width 0.6s ease;
        }

        .sessions-list { padding: 4px 0; }
        .session-row {
          display: flex; align-items: center;
          padding: 11px 1.5rem; gap: 10px;
          border-bottom: 1px solid #F5EDE0; font-size: 12.5px;
        }
        .session-row:last-child { border-bottom: none; }
        .session-user {
          flex: 1; color: var(--text); font-weight: 500;
        }
        .session-time { color: var(--text-sub); font-size: 12px; }
        .session-live {
          display: flex; align-items: center; gap: 4px;
          font-size: 11.5px; font-weight: 700; color: #2D6B0F;
        }
        .session-ended { color: var(--text-sub); font-size: 11.5px; }
        .live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #2D6B0F; animation: pulse 1.6s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }

        .empty-state {
          font-size: 13px; color: var(--text-sub);
          text-align: center; padding: 1rem 0;
        }

        @media (max-width: 1100px) { .two-col { grid-template-columns: 1fr; } }
        @media (max-width: 768px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .adm-content { padding: 1rem; }
          .greeting-card { flex-direction: column; align-items: flex-start; gap: 1rem; }
        }
        @media (max-width: 480px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <div className="adm-root">
        <div className="adm-content">

          {/* GREETING */}
          <div className="greeting-card">
            <div className="greeting-left">
              <p className="greeting-tag">{getGreeting()}</p>
              <h1 className="greeting-name">{fullName}</h1>
              <p className="greeting-sub">
                {department}&nbsp;·&nbsp;{email || today}
              </p>
            </div>
            <div className="greeting-actions">
              <Link href="/admin/tickets" className="btn-primary">
                <Ticket size={15} /> Manage Tickets
              </Link>
              <Link href="/admin/staff" className="btn-ghost">
                <Users size={15} /> ICT Staff
              </Link>
            </div>
          </div>

          {/* QUEUED ALERT */}
          {queuedCount > 0 && (
            <div className="adm-alert">
              <AlertCircle size={17} />
              <span>
                <strong>
                  {queuedCount} unassigned ticket{queuedCount !== 1 ? "s" : ""}
                </strong>{" "}
                awaiting ICT specialist assignment.{" "}
                <Link href="/admin/tickets?view=queued">Assign now →</Link>
              </span>
            </div>
          )}

          {/* STATS */}
          <div className="stats-row">
            {STATS.map((s) => {
              const Icon = s.icon;
              return (
                <div className="stat-card" key={s.label}>
                  <div className="stat-icon" style={{ background: `${s.color}18` }}>
                    <Icon size={20} color={s.color} />
                  </div>
                  <div>
                    <p className="stat-value">{s.value}</p>
                    <p className="stat-label">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* TWO COLUMN */}
          <div className="two-col">

            {/* RECENT TICKETS */}
            <div className="section-card">
              <div className="section-header">
                <p className="section-title">Recent Tickets</p>
                <Link href="/admin/tickets" className="section-link">View all</Link>
              </div>
              <div className="ticket-table-wrap">
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "var(--text-sub)", padding: "1.5rem" }}>
                          No tickets yet.
                        </td>
                      </tr>
                    ) : recentTickets.map((t) => {
                      const assignedPersonnel = t.assigned_to_id
                        ? personnel.find(p => p.id === t.assigned_to_id)
                        : null;
                      const raisedBy = staffMap[t.staff_id];

                      return (
                        <tr key={t.id}>
                          <td>
                            <span className="ticket-id">
                              TKT-{String(t.id).padStart(4, "0")}
                            </span>
                          </td>
                          <td>
                            <div>{t.title}</div>
                            <div className="ticket-sub-text">
                              {raisedBy?.full_name ?? "—"}
                            </div>
                          </td>
                          <td style={{ color: "var(--text-sub)", fontSize: 12.5 }}>
                            {categoryLabel[t.category] ?? t.category}
                          </td>
                          <td style={{ fontSize: 12.5 }}>
                            {t.assigned_to_id === null ? (
                              <span className="queued-badge">Unassigned</span>
                            ) : assignedPersonnel?.full_name ? (
                              assignedPersonnel.full_name
                                .split(" ")
                                .map((n, i, arr) => i === arr.length - 1 ? n[0] + "." : n)
                                .join(" ")
                            ) : (
                              `Tech #${t.assigned_to_id}`
                            )}
                          </td>
                          <td>
                            <StatusBadge status={t.status} comment={t.comment} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* ICT PERSONNEL */}
              <div className="section-card">
                <div className="section-header">
                  <p className="section-title">ICT Personnel</p>
                  <Link href="/admin/ict-personnel" className="section-link">Manage</Link>
                </div>
                <div className="staff-list">
                  {personnel.length === 0 ? (
                    <p className="empty-state">No ICT personnel yet.</p>
                  ) : personnel.map((p) => {
                    const name = p.full_name ?? `Staff ${p.staff_id.slice(0, 6)}`;
                    const availDot =
                      p.availability === "available" && p.is_active ? "#2D6B0F" :
                      p.availability === "busy"                      ? "#C8962E" :
                      "#B0906A";

                    return (
                      <div key={p.id} className="staff-row">
                        <span className="staff-dot" style={{ background: availDot }} />
                        <span className="staff-name">{name}</span>
                        {!p.is_active && !p.specialization ? (
                          <span className="setup-badge">Setup pending</span>
                        ) : p.specialization ? (
                          <span className="staff-spec">
                            {specializationLabel[p.specialization] ?? p.specialization}
                          </span>
                        ) : (
                          <span className="staff-badge">
                            {p.availability.toLowerCase().replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ASSET BREAKDOWN */}
              <div className="section-card">
                <div className="section-header">
                  <p className="section-title">Asset Breakdown</p>
                  <Link href="/admin/assets" className="section-link">View all</Link>
                </div>
                <div className="asset-list">
                  {assetsTotal === 0 ? (
                    <p className="empty-state">No assets recorded yet.</p>
                  ) : (
                    Object.entries(assetGroups).slice(0, 5).map(([type, count]) => {
                      const pct = Math.round((count / assetsTotal) * 100);
                      return (
                        <div key={type}>
                          <div className="asset-meta">
                            <span className="asset-name">{type}</span>
                            <span className="asset-count">{count} of {assetsTotal}</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* ACTIVE SESSIONS */}
          <div className="section-card">
            <div className="section-header">
              <p className="section-title">Active Sessions</p>
              <button
                className={`refresh-btn${refreshingDashboard ? " spinning" : ""}`}
                onClick={() => refetchDashboard()}
                disabled={refreshingDashboard}
              >
                <RefreshCw size={13} />
                {refreshingDashboard ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <div className="sessions-list">
              {sessions.length === 0 ? (
                <p className="empty-state">No active sessions.</p>
              ) : sessions.slice(0, 10).map((s) => (
                <div key={s.id} className="session-row">
                  {s.is_active
                    ? <Wifi size={14} color="#2D6B0F" />
                    : <WifiOff size={14} color="var(--text-sub)" />
                  }
                  <span className="session-user">
                    {s.staff_name ?? s.staff_email ?? s.ip_address ?? s.staff_id}
                  </span>
                  <span className="session-time">Started {formatTime(s.login_at)}</span>
                  {s.is_active ? (
                    <span className="session-live">
                      <span className="live-dot" /> Live
                    </span>
                  ) : (
                    <span className="session-ended">Ended</span>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}