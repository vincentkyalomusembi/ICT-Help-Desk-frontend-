"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check } from "lucide-react";
import { Inter, Playfair_Display } from "next/font/google";
import { useParams, useRouter } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });
const playfair = Playfair_Display({ subsets: ["latin"] });

const API = process.env.NEXT_PUBLIC_API_URL;

const COLORS = {
  primary: "#C8962E",
  primaryDark: "#b08326",
  open: { bg: "#E3F2FD", color: "#1976D2" },
  in_progress: { bg: "#FFF8E0", color: "#C8962E" },
  pending_confirmation: { bg: "#FFF3E0", color: "#C8962E" },
  unresolved: { bg: "#FCE4EC", color: "#C62828" },
  reopened: { bg: "#FCE4EC", color: "#C62828" },
  closed: { bg: "#E8F5E9", color: "#2D6B0F" },
};

// ── Real backend enum (app/tickets/model.py::TicketStatus) ────────────────
// "resolved" is a valid PATCH *input* value, but app/tickets/service.py's
// update_ticket() always rewrites it to "pending_confirmation" before the
// row is committed/returned, so a GET response never actually contains
// status "resolved". It's kept out of the response-facing union below and
// modeled separately as a PATCH action.
type TicketStatus =
  | "open"
  | "in_progress"
  | "pending_confirmation"
  | "unresolved"
  | "reopened"
  | "closed";

type TicketCategory =
  | "hardware"
  | "software"
  | "network"
  | "access_permissions"
  | "security_incidents"
  | "other";

const STATUS_COLORS: Record<TicketStatus, { bg: string; color: string }> = {
  open: COLORS.open,
  in_progress: COLORS.in_progress,
  pending_confirmation: COLORS.pending_confirmation,
  unresolved: COLORS.unresolved,
  reopened: COLORS.reopened,
  closed: COLORS.closed,
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending_confirmation: "Pending Confirmation",
  unresolved: "Unresolved",
  reopened: "Reopened",
  closed: "Closed",
};

// ── Matches app/tickets/schemas.py::TicketResponse exactly ─────────────────
// `raised_by` is populated on the backend from the Ticket.staff
// relationship (see StaffBasic in schemas.py) — a deliberately narrow view
// of the requester (no personal_number/role/policy fields), not the full
// staff record.
type RaisedByStaff = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  office_number: string;
  office_location: string | null;
};

type Ticket = {
  id: number;
  staff_id: string;
  raised_by: RaisedByStaff;
  assigned_to_id: number | null;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  comment: string | null;
  resolution_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  closed_at: string | null;
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS_COLORS[status] ?? { bg: "#eee", color: "#333" };
  const label = STATUS_LABEL[status] ?? status;

  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: "4px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}

// FastAPI's error body shape differs depending on where the error came from:
//  - HTTPException(detail="...")            -> { detail: string }
//  - Pydantic validation error (422)        -> { detail: [{ msg, loc, ... }] }
// Handle both instead of assuming detail is always a string.
function extractErrorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => !!m);
    if (msgs.length > 0) return msgs.join("; ");
  }
  return `Failed to update ticket (${status})`;
}

async function fetchTicket(id: string): Promise<Ticket> {
  const res = await fetch(`${API}/tickets/${id}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Authentication error (${res.status}) — session may not be set or cookie is blocked cross-origin`,
      );
    }
    if (res.status === 404) {
      throw new Error(`Ticket #${id} was not found`);
    }
    throw new Error(`Failed to load ticket (${res.status})`);
  }
  return res.json();
}

// Matches app/tickets/schemas.py::TicketUpdate + its validator:
//  - status "unresolved" requires both `comment` and `resolution_notes`
//  - status "resolved" requires `resolution_notes` only
// Both are enforced server-side (422 if missing), so we also enforce a
// non-empty note client-side before allowing the request to fire.
async function patchTicketResolution(
  id: string,
  action: "resolved" | "unresolved",
  note: string,
): Promise<Ticket> {
  const body: Record<string, unknown> = {
    status: action,
    resolution_notes: note,
  };
  if (action === "unresolved") {
    body.comment = note;
  }

  const res = await fetch(`${API}/tickets/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(extractErrorMessage(errBody, res.status));
  }
  return res.json();
}

// Statuses in which the assigned technician can still act on the ticket.
// "reopened" is excluded on purpose: confirm_ticket() clears
// assigned_to_id back to null on rejection, so a reopened ticket has no
// assigned technician and any PATCH against it will fail the backend's
// `ticket.assigned_to_id != acting_personnel_id` permission check with a
// 403. Gating the buttons on status alone can't fully replace that check
// (this page has no visibility into which technician is viewing), so a
// PATCH attempt on someone else's ticket can still 403 — that's handled
// by surfacing the backend's error message rather than hiding the
// possibility entirely.
const ACTIONABLE_STATUSES: TicketStatus[] = ["open", "in_progress"];

function getInitials(fullName: string | undefined | null): string {
  if (!fullName) return "?";
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const labelStyle = {
  fontSize: "12px",
  color: "#888",
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};

const valueStyle = {
  fontSize: "14px",
  color: "#1a1a1a",
  margin: 0,
  fontWeight: 500,
};

function formatElapsed(fromISO: string): string {
  const diffMs = Date.now() - new Date(fromISO).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"}`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const router = useRouter();

  const {
    data: ticket,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => fetchTicket(ticketId),
    enabled: !!ticketId,
    refetchInterval: 30_000,
  });

  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
        ? "Something went wrong"
        : null;

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentStatus: TicketStatus = ticket?.status ?? "open";
  const canMarkResolution = ACTIONABLE_STATUSES.includes(currentStatus);
  const assignedAgo = ticket ? formatElapsed(ticket.created_at) : "—";
  const noteIsValid = note.trim().length > 0;

  const handleMarkResolution = async (action: "resolved" | "unresolved") => {
    if (!ticket || !noteIsValid) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await patchTicketResolution(String(ticket.id), action, note.trim());
      setSaved(true);
      setNote("");
      await refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#FDF8F2",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <Loader2
          size={32}
          color={COLORS.primary}
          style={{ animation: "spin 1s linear infinite" }}
        />
        <p style={{ color: "#666", fontSize: "14px" }}>Loading ticket...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (error || !ticket) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#FDF8F2",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "48px" }}>⚠️</div>
        <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
          Failed to load ticket
        </h2>
        <p
          style={{
            color: "#666",
            margin: 0,
            fontSize: "14px",
            textAlign: "center",
            maxWidth: "400px",
          }}
        >
          {error ?? "Ticket data is unavailable"}
        </p>
        <button
          onClick={() => refetch()}
          style={{
            background: COLORS.primary,
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={inter.className}
      style={{
        padding: "2rem",
        background: "#FDF8F2",
        minHeight: "100vh",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* HEADER */}
        <div style={{ marginBottom: "24px" }}>
          <button
            onClick={() => router.push("/ict-dashboard/tickets")}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              fontSize: "13px",
              cursor: "pointer",
              padding: 0,
              marginBottom: "12px",
            }}
          >
            ← Back to tickets
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
            <h1
              className={playfair.className}
              style={{
                fontSize: "28px",
                fontWeight: 700,
                margin: 0,
                color: "#1a1a1a",
              }}
            >
              Ticket #{ticket.id} — {ticket.title}
            </h1>
            <StatusBadge status={currentStatus} />
          </div>
          <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>
            {ticket.category}
          </p>
        </div>

        {/* Description */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #eee",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px 0", color: "#1a1a1a" }}>
            Description
          </h2>
          <p style={{ fontSize: "14px", color: "#444", margin: 0, lineHeight: 1.6 }}>
            {ticket.description}
          </p>
        </div>

        {/* TWO-COLUMN LAYOUT (stacks below 768px — see .ticket-detail-grid) */}
        <div className="ticket-detail-grid">
          {/* ── LEFT ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* FIX: Renamed from "Update Ticket Status" to "Mark Ticket Resolution".
                ICT personnel can only mark resolved or unresolved — they cannot
                freely change status between open/in_progress. Each button fires
                immediately as a direct action with no pending/confirm flow. */}
            {canMarkResolution ? (
              <div style={{
                background: "#fff", borderRadius: "12px", border: "1px solid #eee",
                padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}>
                <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px 0", color: "#1a1a1a" }}>
                  Mark Ticket Resolution
                </h2>
                <p style={{ fontSize: "13px", color: "#888", margin: "0 0 12px 0" }}>
                  Describe what you did, then mark this ticket resolved or unresolved.
                  A note is required either way.
                </p>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you do to address this ticket?"
                  rows={3}
                  style={{
                    width: "100%",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    resize: "vertical",
                    marginBottom: "12px",
                    boxSizing: "border-box",
                  }}
                />

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  {/* Resolved button */}
                  <button
                    onClick={() => handleMarkResolution("resolved")}
                    disabled={saving || !noteIsValid}
                    style={{
                      background: "#fff",
                      color: "#444",
                      border: "1px solid #ddd",
                      padding: "9px 18px", borderRadius: "8px",
                      cursor: saving || !noteIsValid ? "not-allowed" : "pointer",
                      fontSize: "13px", fontWeight: 600, transition: "all 0.15s ease",
                      opacity: saving || !noteIsValid ? 0.6 : 1,
                    }}
                  >
                    Mark Resolved
                  </button>

                  {/* Unresolved button */}
                  <button
                    onClick={() => handleMarkResolution("unresolved")}
                    disabled={saving || !noteIsValid}
                    style={{
                      background: "#fff",
                      color: "#444",
                      border: "1px solid #ddd",
                      padding: "9px 18px", borderRadius: "8px",
                      cursor: saving || !noteIsValid ? "not-allowed" : "pointer",
                      fontSize: "13px", fontWeight: 600, transition: "all 0.15s ease",
                      opacity: saving || !noteIsValid ? 0.6 : 1,
                    }}
                  >
                    Mark Unresolved
                  </button>

                  {/* Saving indicator */}
                  {saving && (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#888" }}>
                      <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving...
                    </span>
                  )}

                  {/* Error */}
                  {saveError && (
                    <span style={{ fontSize: "13px", color: "#C62828", fontWeight: 500 }}>
                      ⚠️ {saveError}
                    </span>
                  )}

                  {/* Success confirmation */}
                  {saved && (
                    <span style={{ fontSize: "13px", color: "#2D6B0F", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                      <Check size={13} /> Ticket updated
                    </span>
                  )}
                </div>

                {!noteIsValid && (
                  <p style={{ fontSize: "12px", color: "#C8962E", margin: "8px 0 0 0" }}>
                    A note is required before you can mark this ticket resolved or unresolved.
                  </p>
                )}

                {/* Contextual hints */}
                <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                    ✓ <strong>Mark Resolved</strong> — staff will be asked to confirm the fix. You are released immediately.
                  </p>
                  <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
                    ⚠ <strong>Mark Unresolved</strong> — ticket moves to team view for another technician to pick up. You are released immediately.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                background: "#fff", borderRadius: "12px", border: "1px solid #eee",
                padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}>
                <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px 0", color: "#1a1a1a" }}>
                  Ticket Status
                </h2>
                <div style={{
                  padding: "14px", borderRadius: "8px",
                  background: STATUS_COLORS[currentStatus].bg,
                  border: `1px solid ${STATUS_COLORS[currentStatus].color}30`,
                }}>
                  <p style={{ margin: 0, fontSize: "14px", color: STATUS_COLORS[currentStatus].color, fontWeight: 600 }}>
                    {currentStatus === "pending_confirmation" &&
                      "Awaiting staff confirmation — the staff member has been notified to confirm the resolution."}
                    {currentStatus === "unresolved" &&
                      "This ticket is in the team view — any available technician can pick it up."}
                    {currentStatus === "closed" &&
                      "This ticket has been closed and confirmed by the staff member."}
                    {currentStatus === "reopened" &&
                      "Staff rejected the resolution — this ticket is back in the triage queue, unassigned."}
                  </p>
                </div>
                {ticket.resolution_notes && (
                  <div style={{ marginTop: "14px" }}>
                    <p style={labelStyle}>Resolution Notes</p>
                    <p style={valueStyle}>{ticket.resolution_notes}</p>
                  </div>
                )}
                {ticket.rejection_reason && (
                  <div style={{ marginTop: "14px" }}>
                    <p style={labelStyle}>Rejection Reason</p>
                    <p style={valueStyle}>{ticket.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Raised By */}
            <div style={{
              background: "#fff", borderRadius: "12px", border: "1px solid #eee",
              padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 20px 0", color: "#1a1a1a" }}>
                Raised By
              </h2>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "#7A3100",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
                    {getInitials(ticket.raised_by.full_name)}
                  </span>
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: "#1a1a1a" }}>
                    {ticket.raised_by.full_name}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#888" }}>
                    {ticket.raised_by.email}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <p style={labelStyle}>Phone Number</p>
                  <p style={valueStyle}>{ticket.raised_by.phone_number ?? "—"}</p>
                </div>
                <div>
                  <p style={labelStyle}>Office Number</p>
                  <p style={valueStyle}>{ticket.raised_by.office_number}</p>
                </div>
                <div>
                  <p style={labelStyle}>Office Location</p>
                  <p style={valueStyle}>{ticket.raised_by.office_location ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* Assignment Details */}
            <div style={{
              background: "#fff", borderRadius: "12px", border: "1px solid #eee",
              padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 20px 0", color: "#1a1a1a" }}>
                Assignment Details
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <p style={labelStyle}>Assigned To</p>
                  <p style={valueStyle}>
                    {ticket.assigned_to_id
                      ? `Technician #${ticket.assigned_to_id}`
                      : "Unassigned (Queued)"}
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>Opened</p>
                  <p style={valueStyle}>
                    {new Date(ticket.created_at).toLocaleString("en-KE", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>Time Elapsed</p>
                  <p style={valueStyle}>{assignedAgo}</p>
                </div>
                {ticket.closed_at && (
                  <div>
                    <p style={labelStyle}>Closed</p>
                    <p style={valueStyle}>
                      {new Date(ticket.closed_at).toLocaleString("en-KE", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ticket-detail-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .ticket-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}