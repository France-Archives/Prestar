import { useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import { useLive } from "../../hooks/useLive";
import * as lib from "../../services/librarian";
import { activityFeed } from "../../services/reports";

type Kpi = [label: string, value: number, to: string, alert?: boolean];

const PANEL_CLS =
  "panel flex flex-col gap-4 rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-5 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:p-6";
const EYEBROW_CLS = "eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]";
const TITLE_CLS = "font-serif text-[22px] font-medium leading-tight text-[#0B3D32]";
const LINE_CLS = "line flex items-center justify-between gap-4 border-b border-[#D9DDD7] py-3 font-sans text-[13px] last:border-b-0";
const EMPTY_CLS = "muted rounded-[10px] bg-[#F5F3EA] px-4 py-5 text-center font-sans text-[13px] text-[#6B756F]";

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
    <div className="mx-auto w-full font-sans text-[#1F2A27]">
      {/* Header */}
      <header className="relative overflow-hidden rounded-[22px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 py-8 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCE5D7]/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#D9C19A]/40 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow mb-2 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
              <span className="h-px w-8 bg-[#B98A4A]" />
              LIBRARIAN
            </span>
            <h1 className="page-title font-serif text-[clamp(32px,5.5vw,52px)] font-medium leading-[1.08] tracking-[-0.01em] text-[#0B3D32]">
              Dashboard
            </h1>
            <p className="sub mt-2 font-sans text-[13.5px] text-[#6B756F]">
              {s.pending} pending {s.pending === 1 ? "request" : "requests"} · {s.overdue} overdue · {s.returnedToday} returned today
            </p>
          </div>
          <div className="actions-row flex flex-col gap-3 sm:flex-row">
            <button
              className="btn primary inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-6 font-sans text-[13px] font-medium text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/librarian/requests")}
            >
              Review requests
            </button>
            <button
              className="btn ghost inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-6 font-sans text-[13px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/librarian/issue")}
            >
              Issue a book
            </button>
            <button
              className="btn ghost inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-6 font-sans text-[13px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/librarian/returns")}
            >
              Receive a return
            </button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="stats mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {kpis.map(([label, value, to, alert]) => (
          <button
            key={label}
            className={`stat ${alert ? "alert" : ""} group flex min-h-[112px] flex-col items-start gap-1 rounded-[16px] border p-4 text-left shadow-[0_4px_14px_rgba(11,61,50,0.05)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.3,1)] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(11,61,50,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
              alert ? "border-[#E6C7BD] bg-[#F1DDD6]/40 hover:border-[#8A3B35]" : "border-[#D9DDD7] bg-[#FBFAF5] hover:border-[#6F9B78]"
            }`}
            onClick={() => navigate(to)}
          >
            <b className={`font-serif text-[34px] font-medium leading-none ${alert ? "text-[#8A3B35]" : "text-[#0B3D32]"}`}>{value}</b>
            <span className="font-sans text-[12px] leading-snug text-[#6B756F]">{label}</span>
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="grid-2 section mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={PANEL_CLS}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className={EYEBROW_CLS}>Needs attention</span>
              <h2 className={TITLE_CLS}>Waiting for review</h2>
            </div>
            <button
              className="text-btn font-sans text-[12px] font-bold text-[#0B3D32] underline-offset-4 transition-colors duration-200 hover:text-[#B98A4A] hover:underline"
              onClick={() => navigate("/librarian/requests")}
            >
              View all →
            </button>
          </div>
          {pending.length === 0 ? (
            <p className={EMPTY_CLS}>No pending requests.</p>
          ) : (
            pending.map((r) => (
              <div className={LINE_CLS} key={r.id}>
                <div className="min-w-0">
                  <b className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{r.student}</b>{" "}
                  <span className="text-[#1F2A27]">
                    requested “<span className="font-serif text-[14px] text-[#0B3D32]">{r.book}</span>”
                  </span>
                  <br />
                  <span className="muted font-sans text-[12px] text-[#6B756F]">{r.date}</span>
                </div>
                <Badge status={r.status} />
              </div>
            ))
          )}
          <div className="actions-row mt-1 flex flex-col gap-3 sm:flex-row">
            <button
              className="btn primary sm inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-5 font-sans text-[12.5px] font-medium text-white transition-all duration-200 hover:bg-[#07352C] active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/librarian/requests")}
            >
              Review requests
            </button>
            <button
              className="btn ghost sm inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 font-sans text-[12.5px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/librarian/issue")}
            >
              Issue a book
            </button>
            <button
              className="btn ghost sm inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 font-sans text-[12.5px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/librarian/returns")}
            >
              Receive a return
            </button>
          </div>
        </div>

        <div className={PANEL_CLS}>
          <div>
            <span className={EYEBROW_CLS}>Library log</span>
            <h2 className={TITLE_CLS}>Recent activity</h2>
          </div>
          {recent.length === 0 ? (
            <p className={EMPTY_CLS}>No activity yet.</p>
          ) : (
            <div className="relative flex flex-col">
              {recent.map((e) => (
                <div className={`${LINE_CLS} justify-start`} key={e.id}>
                  <span className="mt-1 h-2 w-2 shrink-0 self-start rounded-full bg-[#6F9B78]" aria-hidden="true" />
                  <div className="min-w-0">
                    <b className="font-sans text-[13.5px] font-bold text-[#0B3D32]">{e.who}</b>{" "}
                    <span className="text-[#1F2A27]">{e.text}</span>
                    <br />
                    <span className="muted font-sans text-[12px] text-[#6B756F]">{e.when}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}