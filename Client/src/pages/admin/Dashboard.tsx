import { useNavigate } from "react-router-dom";
import BarList from "../../components/Charts";
import { useLive } from "../../hooks/useLive";
import { activityFeed, adminAlerts, adminCharts, adminStats } from "../../services/reports";

type Kpi = [label: string, value: number, to: string, alert?: boolean];

export default function AdminDashboard() {
  const navigate = useNavigate();
  // All totals are derived from the data, so they change when the data changes.
  const s = useLive(adminStats);
  const c = useLive(adminCharts);
  const a = useLive(adminAlerts);
  const recent = useLive(() => activityFeed().slice(0, 8));

  const kpis: Kpi[] = [
    ["Total users", s.users, "/admin/users"],
    ["Active students", s.activeStudents, "/admin/users"],
    ["Librarians", s.librarians, "/admin/librarians"],
    ["Books", s.books, "/admin/catalog"],
    ["Physical copies", s.copies, "/admin/catalog"],
    ["Current loans", s.loans, "/admin/monitoring"],
    ["Overdue loans", s.overdue, "/admin/monitoring", s.overdue > 0],
    ["Pending requests", s.pendingRequests, "/admin/monitoring"],
    ["Reservations", s.reservations, "/admin/monitoring"],
  ];

  return (
    <>
      <span className="eyebrow">ADMIN</span>
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
          <h2>Alerts</h2>
          {a.alerts.length ? <ul className="plain">{a.alerts.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">No alerts.</p>}
          <h2>Pending admin tasks</h2>
          {a.tasks.length ? <ul className="plain">{a.tasks.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">Nothing pending.</p>}
        </div>
        <div className="panel">
          <h2>Quick actions</h2>
          <div className="actions-col">
            <button className="btn primary sm" onClick={() => navigate("/admin/librarians")}>Create librarian</button>
            <button className="btn ghost sm" onClick={() => navigate("/admin/signups")}>Review signups</button>
            <button className="btn ghost sm" onClick={() => navigate("/admin/users")}>Users</button>
            <button className="btn ghost sm" onClick={() => navigate("/admin/reports")}>Reports</button>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel"><h2>Loans issued (last 7 days)</h2><BarList rows={c.issued} /></div>
        <div className="panel"><h2>Returns (last 7 days)</h2><BarList rows={c.returned} /></div>
        <div className="panel"><h2>Loans per category</h2><BarList rows={c.categories} /></div>
        <div className="panel"><h2>Current loans vs overdue</h2><BarList rows={c.currentVsOverdue} /></div>
        <div className="panel"><h2>Most active borrowers</h2><BarList rows={c.borrowers} /></div>
        <div className="panel"><h2>Copies by status</h2><BarList rows={c.inventory} /></div>
        <div className="panel"><h2>Most borrowed titles</h2><BarList rows={c.mostBorrowed} /></div>
        <div className="panel">
          <h2>Recent activity</h2>
          {recent.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            recent.map((e) => (
              <div className="line" key={e.id}>
                <div><b>{e.who}</b> {e.text}<br /><span className="muted">{e.when}</span></div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}