import { useNavigate } from "react-router-dom";
import BarList from "../../components/Charts";
import { useLive } from "../../hooks/useLive";
import { activityFeed, adminAlerts, adminCharts, adminStats } from "../../services/reports";

type Kpi = [label: string, value: number, to: string, alert?: boolean];

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";
const SECTION_TITLE = "font-['Playfair_Display',serif] text-[22px] text-[#0B3D32] mt-8 mb-1";
const SECTION_NOTE = "text-sm text-[#6B756F] mb-3.5";
const GRID_KPI = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";
const GRID_PANELS = "grid grid-cols-1 lg:grid-cols-2 gap-4";

const ACCENTS: Record<string, string> = {
  forest: "border-l-[#0B3D32]",
  sage: "border-l-[#6F9B78]",
  deep: "border-l-[#07352C]",
  error: "border-l-[#8A3B35]",
  gold: "border-l-[#B98A4A]",
  wood: "border-l-[#D9C19A]",
};

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <header className={PANEL_HEADER}>
        <div>
          <h2 className={PANEL_TITLE}>{title}</h2>
          {note && <p className={PANEL_NOTE}>{note}</p>}
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

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

  const find = (label: string) => kpis.find((k) => k[0] === label)!;

  const renderKpi = ([label, value, to, alert]: Kpi, accent: string) => (
    <button
      key={label}
      onClick={() => navigate(to)}
      className={`${CARD} ${ACCENTS[accent]} border-l-4 w-full text-left cursor-pointer flex flex-col gap-1.5 px-5 py-[18px] transition-colors hover:bg-[#F5F3EA] ${
        alert ? "!bg-[#F6E9E7] !border-[#8A3B35]" : ""
      }`}
    >
      <span className={LABEL}>{label}</span>
      <b
        className={`font-['Playfair_Display',serif] text-[30px] leading-[1.1] font-semibold ${
          alert ? "text-[#8A3B35]" : "text-[#0B3D32]"
        }`}
      >
        {value}
      </b>
    </button>
  );

  const accountGroup: [Kpi, string][] = [
    [find("Total users"), "forest"],
    [find("Active students"), "sage"],
    [find("Librarians"), "deep"],
  ];
  const collectionGroup: [Kpi, string][] = [
    [find("Books"), "forest"],
    [find("Physical copies"), "sage"],
  ];
  const circulationGroup: [Kpi, string][] = [
    [find("Current loans"), "deep"],
    [find("Overdue loans"), "error"],
    [find("Pending requests"), "gold"],
    [find("Reservations"), "wood"],
  ];

  const actions: [string, string, boolean][] = [
    ["Create librarian", "/admin/librarians", true],
    ["Review signups", "/admin/signups", false],
    ["Users", "/admin/users", false],
    ["Reports", "/admin/reports", false],
  ];

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Dashboard</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[680px] leading-relaxed">
        Oversee accounts, verification, library activity and system health from one administrative workspace.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-2">
        <section className={`${CARD} overflow-hidden`}>
          <header className={PANEL_HEADER}>
            <div>
              <h2 className={PANEL_TITLE}>Needs attention</h2>
              <p className={PANEL_NOTE}>Alerts and pending administrative tasks.</p>
            </div>
            <span className={`text-[13px] font-semibold ${a.alerts.length ? "text-[#8A3B35]" : "text-[#0B3D32]"}`}>
              {a.alerts.length} {a.alerts.length === 1 ? "alert" : "alerts"}
            </span>
          </header>
          <div className="px-5 py-4">
            <div className={`${LABEL} mb-2`}>Alerts</div>
            {a.alerts.length ? (
              <ul className="list-none m-0 mb-[18px] p-0 grid gap-2">
                {a.alerts.map((x) => (
                  <li
                    key={x}
                    className="px-3 py-2.5 rounded-[10px] border border-[#8A3B35] bg-[#F6E9E7] text-[#8A3B35] text-sm"
                  >
                    {x}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted mb-[18px]">No alerts.</p>
            )}

            <div className={`${LABEL} mb-2`}>Pending admin tasks</div>
            {a.tasks.length ? (
              <ul className="list-none m-0 p-0 grid gap-2">
                {a.tasks.map((x) => (
                  <li
                    key={x}
                    className="px-3 py-2.5 rounded-[10px] border border-[#D9C19A] bg-[#F5F3EA] text-[#1F2A27] text-sm"
                  >
                    {x}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted m-0">Nothing pending.</p>
            )}
          </div>
        </section>

        <section className="rounded-[14px] overflow-hidden bg-[#0B3D32] border border-[#07352C] shadow-[0_1px_2px_rgba(11,61,50,0.05)]">
          <header className="px-5 py-4 border-b border-[#DCE5D7]/20">
            <h2 className="font-['Playfair_Display',serif] text-xl text-[#F5F3EA] m-0">Quick actions</h2>
            <p className="mt-1 mb-0 text-sm text-[#DCE5D7]">Jump to common administrative tasks.</p>
          </header>
          <div className="px-5 py-4 grid gap-2.5">
            {actions.map(([label, to, primary]) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className={`flex justify-between items-center px-3.5 py-3 rounded-[10px] cursor-pointer text-sm font-medium text-left transition-colors ${
                  primary
                    ? "bg-[#B98A4A] border border-[#B98A4A] text-[#07352C] hover:bg-[#D9C19A]"
                    : "bg-transparent border border-[#DCE5D7]/35 text-[#F5F3EA] hover:bg-[#07352C]"
                }`}
              >
                <span>{label}</span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <h2 className={SECTION_TITLE}>Accounts</h2>
      <p className={SECTION_NOTE}>Student and librarian accounts registered in the system.</p>
      <div className={GRID_KPI}>{accountGroup.map(([k, accent]) => renderKpi(k, accent))}</div>

      <h2 className={SECTION_TITLE}>Collection</h2>
      <p className={SECTION_NOTE}>Catalog titles and physical holdings.</p>
      <div className={GRID_KPI}>{collectionGroup.map(([k, accent]) => renderKpi(k, accent))}</div>

      <h2 className={SECTION_TITLE}>Circulation monitoring</h2>
      <p className={SECTION_NOTE}>Loans, requests and reservations currently in progress.</p>
      <div className={GRID_KPI}>{circulationGroup.map(([k, accent]) => renderKpi(k, accent))}</div>

      <h2 className={SECTION_TITLE}>Activity and reports</h2>
      <p className={SECTION_NOTE}>Trends and the latest events recorded by the system.</p>
      <div className={GRID_PANELS}>
        <Panel title="Loans issued" note="Last 7 days"><BarList rows={c.issued} /></Panel>
        <Panel title="Returns" note="Last 7 days"><BarList rows={c.returned} /></Panel>
        <Panel title="Loans per category"><BarList rows={c.categories} /></Panel>
        <Panel title="Current loans vs overdue"><BarList rows={c.currentVsOverdue} /></Panel>
        <Panel title="Most active borrowers"><BarList rows={c.borrowers} /></Panel>
        <Panel title="Copies by status"><BarList rows={c.inventory} /></Panel>
        <Panel title="Most borrowed titles"><BarList rows={c.mostBorrowed} /></Panel>
        <Panel title="Recent activity" note="Latest system events">
          {recent.length === 0 ? (
            <p className="muted m-0">No activity yet.</p>
          ) : (
            <div className="grid">
              {recent.map((e, i) => (
                <div
                  key={e.id}
                  className={`py-2.5 text-sm text-[#1F2A27] leading-normal ${
                    i === 0 ? "" : "border-t border-[#D9DDD7]"
                  }`}
                >
                  <b className="text-[#0B3D32]">{e.who}</b> {e.text}
                  <br />
                  <span className="text-[13px] text-[#6B756F]">{e.when}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}