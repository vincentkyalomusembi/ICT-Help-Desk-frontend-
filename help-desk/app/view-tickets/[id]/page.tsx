"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import StatusBadge from "@/components/status-badge";

type Ticket = {
  id: number;
  description: string;
  category: string;
  priority?: string;
  status: string;
  created_at: string;
};

const STATUS_OPTIONS = ["OPEN", "In_progress", "Resolved", "Closed"];

function toStatusLabel(status: string): "Open" | "Resolved" | "In Progress" {
  switch (status.toLowerCase()) {
    case "open":
      return "Open";
    case "resolved":
    case "closed":
      return "Resolved";
    default:
      return "In Progress";
  }
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params?.id;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!ticketId) return;
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/tickets/${ticketId}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          setError("Ticket not found.");
          return;
        }
        const data = await res.json();
        setTicket(data);
        setSelectedStatus(data.status?.toUpperCase() ?? "OPEN");
      } catch {
        setError("Failed to load ticket.");
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId]);

  async function handleSave() {
    if (!ticketId) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tickets/${ticketId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: selectedStatus }),
        }
      );
      if (!res.ok) {
        setError("Failed to update status.");
        return;
      }
      const updated = await res.json();
      setTicket(updated);
      setSuccess(true);
    } catch {
      setError("Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');

        .ticket-detail-root {
          width: 100%;
          min-height: 100vh;
          background: #FDF8F2;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: #1A0F08;
          padding: 2rem;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #6B2D0F;
          text-decoration: none;
          margin-bottom: 1.5rem;
        }

        .back-link:hover { text-decoration: underline; }

        .detail-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #EDE0D0;
          overflow: hidden;
          max-width: 720px;
          box-shadow: 0 2px 8px rgba(107,45,15,0.05);
        }

        .detail-header {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #EDE0D0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .detail-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1A0F08;
        }

        .detail-body { padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 1.25rem; }

        .field-row { display: flex; flex-direction: column; gap: 4px; }

        .field-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #7A5C44;
        }

        .field-value { font-size: 14px; color: #1A0F08; }

        .status-select {
          padding: 0.6rem 0.9rem;
          border-radius: 8px;
          border: 1px solid #EDE0D0;
          font-size: 13px;
          font-family: inherit;
          color: #1A0F08;
          background: #FDF8F2;
          max-width: 240px;
        }

        .save-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          background: #C8962E;
          color: #4A1E0A;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          font-family: inherit;
          margin-top: 0.5rem;
          width: fit-content;
        }

        .save-btn:hover { background: #E8B84B; }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .msg-error { color: #BB0000; font-size: 12px; }
        .msg-success { color: #2D6B0F; font-size: 12px; }
      `}</style>

      <div className="ticket-detail-root">
      <Link href="/tickets" className="back-link">
  <ArrowLeft size={14} /> Back to Ticket History
</Link>
        {loading ? (
          <p>Loading ticket...</p>
        ) : !ticket ? (
          <p className="msg-error">{error || "Ticket not found."}</p>
        ) : (
          <div className="detail-card">
            <div className="detail-header">
              <p className="detail-title">
                TKT-{String(ticket.id).padStart(3, "0")}
              </p>
              <StatusBadge status={toStatusLabel(ticket.status)} />
            </div>

            <div className="detail-body">
              <div className="field-row">
                <span className="field-label">Description</span>
                <span className="field-value">{ticket.description}</span>
              </div>

              <div className="field-row">
                <span className="field-label">Category</span>
                <span className="field-value">{ticket.category}</span>
              </div>

              {ticket.priority && (
                <div className="field-row">
                  <span className="field-label">Priority</span>
                  <span className="field-value">{ticket.priority}</span>
                </div>
              )}

              <div className="field-row">
                <span className="field-label">Created</span>
                <span className="field-value">
                  {new Date(ticket.created_at).toLocaleString()}
                </span>
              </div>

              <div className="field-row">
                <span className="field-label">Update Status</span>
                <select
                  className="status-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>

                <button
                  className="save-btn"
                  onClick={handleSave}
                  disabled={saving || selectedStatus === ticket.status?.toUpperCase()}
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save Status"}
                </button>

                {error && <p className="msg-error">{error}</p>}
                {success && <p className="msg-success">Status updated successfully.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}