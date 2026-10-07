import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import { useLive } from "../../hooks/useLive";
import * as lib from "../../services/librarian";
import { activityFeed } from "../../services/reports";

type Kpi = [label: string, value: number, to: string, alert?: boolean];

export default function LibrarianDashboard() {
  const navigate = useNavigate();
  const s = useLive(lib.getLibrarianStats);
  const pending = useLive(() => lib.getBorrowRequests().filter((r) => r.status === "Pending").slice(0, 5));
  const recent = useLive(() => activityFeed().slice(0, 8));

  const kpis: Kpi[] = [
    ["Pending requests", s.pending, "/librarian/requests", s.pending > 0],
    ["Approved, awaiting pickup", s.approved, "/librarian/issue"],
    ["Currently borrowed", s.borrowed, "/librarian/loans"],
    ["Overdue", s.overdue, "/librarian/overdue", s.overdue > 0],
    ["Returned today", s.returnedToday, "/librarian/returns"],
    ["Available copies", s.availableCopies, "/librarian/inventory"],
    ["Reservations in queue", s.waitingReservations, "/librarian/reservations"],
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Dashboard</h1>

      <div className="stats">
        {kpis.map(([label, value, to, alert]) => (
          <button key={label} className={`stat ${alert ? "alert" : ""}`} onClick={() => navigate(to)}>
            <b>{value}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="grid-2 section">
        <div className="panel">
          <h2>Waiting for review</h2>
          {pending.length === 0 ? (
            <p className="muted">No pending requests.</p>
          ) : (
            pending.map((r) => (
              <div className="line" key={r.id}>
                <div>
                  <b>{r.student}</b> requested “{r.book}”<br />
                  <span className="muted">{r.date}</span>
                </div>
                <Badge status={r.status} />
              </div>
            ))
          )}
          <div className="actions-row">
            <button className="btn primary sm" onClick={() => navigate("/librarian/requests")}>Review requests</button>
            <button className="btn ghost sm" onClick={() => navigate("/librarian/issue")}>Issue a book</button>
            <button className="btn ghost sm" onClick={() => navigate("/librarian/returns")}>Receive a return</button>
          </div>
        </div>
        <div className="panel">
          <h2>Recent activity</h2>
          {recent.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            recent.map((e) => (
              <div className="line" key={e.id}>
                <div>
                  <b>{e.who}</b> {e.text}
                  <br />
                  <span className="muted">{e.when}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}