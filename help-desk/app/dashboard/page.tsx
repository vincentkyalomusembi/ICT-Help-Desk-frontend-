"use client";
import Link from "next/link";
import StatusBadge from "@/components/status-badge";
import { useEffect, useState } from "react";

type Ticket = {
  id: number;
  description: string; // not issue_description
  category: string; // enum string e.g. "HARDWARE", not { name: string }
  priority?: string;
  status: string;
  created_at: string;
};

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

export default function TicketTable() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tickets/`, {
          credentials: "include",
        });
        if (res.ok) setTickets(await res.json());
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #EDE0D0",
        overflow: "hidden",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #EDE0D0" }}
      >
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "#1A0F08",
          }}
        >
          Ticket History
        </h2>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr>
              {[
                "Date/Time",
                "Ticket ID",
                "Issue",
                "Category/Priority",
                "Status",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "0.7rem 1.25rem",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#7A5C44",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    background: "#FDFAF6",
                    borderBottom: "1px solid #EDE0D0",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: "2.5rem",
                    textAlign: "center",
                    color: "#7A5C44",
                    fontSize: 13,
                  }}
                >
                  Loading tickets...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: "2.5rem",
                    textAlign: "center",
                    color: "#7A5C44",
                    fontSize: 13,
                  }}
                >
                  No tickets found.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  style={{ borderBottom: "1px solid #F5EDE0" }}
                >
                  <td
                    style={{
                      padding: "0.9rem 1.25rem",
                      verticalAlign: "middle",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#1A0F08",
                        fontSize: 13,
                      }}
                    >
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#7A5C44", marginTop: 2 }}
                    >
                      {new Date(ticket.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "0.9rem 1.25rem",
                      verticalAlign: "middle",
                      fontWeight: 700,
                      color: "#6B2D0F",
                    }}
                  >
                    TKT-{String(ticket.id).padStart(3, "0")}
                  </td>
                  <td
                    style={{
                      padding: "0.9rem 1.25rem",
                      verticalAlign: "middle",
                      color: "#1A0F08",
                      maxWidth: 260,
                    }}
                  >
                    {ticket.description}
                  </td>
                  <td
                    style={{
                      padding: "0.9rem 1.25rem",
                      verticalAlign: "middle",
                      color: "#7A5C44",
                      fontSize: 12,
                    }}
                  >
                    {ticket.category}
                  </td>
                  <td
                    style={{
                      padding: "0.9rem 1.25rem",
                      verticalAlign: "middle",
                    }}
                  >
                    <StatusBadge status={toStatusLabel(ticket.status)} />
                  </td>
                  <td
                    style={{
                      padding: "0.9rem 1.25rem",
                      verticalAlign: "middle",
                    }}
                  >
                    <Link
                      href={`/tickets/${ticket.id}`}
                      style={{
                        display: "inline-block",
                        padding: "0.4rem 0.9rem",
                        borderRadius: 6,
                        background: "#6B2D0F",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}