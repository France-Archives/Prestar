import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import EmptyState from "../../components/EmptyState";
import RecommendedBooks from "../../components/RecommendedBooks";
import RenewDialog from "../../components/RenewDialog";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useInterests } from "../../hooks/useInterests";
import { useLive } from "../../hooks/useLive";
import { useNotifications } from "../../hooks/useNotifications";
import * as api from "../../services/api";
import { getRecommendations } from "../../services/recommendations";
import type { BorrowedBook } from "../../types";
import { CONFIG, INTEREST_PATH } from "../../utils/constants";
import { daysUntil, fmtDate, fmtDateTime, todayStr } from "../../utils/dates";
import { indexBy } from "../../utils/lookup";
import { requestStatus, reservationStatus } from "../../utils/status";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

type StatCard = { label: string; value: number; to: string; sub?: string; alert?: boolean };

export default function StudentDashboard() {
  const { db, user } = useAuthedLibrary();
  const navigate = useNavigate();
  const { items: notifs } = useNotifications();
  const [renewing, setRenewing] = useState<BorrowedBook | null>(null);
  const uid = user.user_id;
  const interestIds = useInterests(uid);

  // Every number is derived from the data; nothing is hardcoded.
  const d = useMemo(() => {
    const loans = db.borrowed_books.filter((l) => l.user_id === uid && l.status === "Borrowed");
    const reqs = db.borrow_requests.filter((r) => r.user_id === uid).map((r) => ({ ...r, status: requestStatus(r) }));
    const resv = db.reservations.filter((r) => r.user_id === uid).map((r) => ({ ...r, status: reservationStatus(r) }));
    const approved = reqs.filter((r) => r.status === "Approved");
    const ready = resv.filter((r) => r.status === "Ready");
    const waiting = resv.filter((r) => r.status === "Waiting");
    const deadlines = [...approved.map((r) => r.pickup_deadline), ...ready.map((r) => r.expires_at)]
      .filter((x): x is string => x !== null)
      .sort();
    return {
      loans,
      reqs,
      resv,
      overdue: loans.filter(api.isOverdue).length,
      dueSoon: loans
        .filter((l) => !api.isOverdue(l) && l.due_date <= todayStr(CONFIG.DUE_SOON_DAYS))
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
      pending: reqs.filter((r) => r.status === "Pending").length,
      claimable: approved.length + ready.length,
      nearest: deadlines[0] as string | undefined,
      activeRes: waiting.length + ready.length,
      nearestPos: waiting.length ? Math.min(...waiting.map(api.queuePosition)) : null,
    };
  }, [db, uid]);

  // Recommended for You: selected interests + borrowing history, derived from the mock books.
  const recommendations = useLive(() => getRecommendations(uid, interestIds));

  const books = useMemo(() => indexBy(db.books, "book_id"), [db.books]);
  const reg = user.student_id ? db.university_students.find((s) => s.student_id === user.student_id) : undefined;
  const signup = db.signups.find((s) => s.created_user_id === uid);

  const cards: StatCard[] = [
    { label: "Active borrowed books", value: d.loans.length, to: "/student/borrowing" },
    { label: "Pending requests", value: d.pending, to: "/student/requests" },
    { label: "Approved / ready to claim", value: d.claimable, sub: d.nearest ? `Nearest: ${fmtDateTime(d.nearest)}` : undefined, to: "/student/requests" },
    { label: "Overdue books", value: d.overdue, to: "/student/borrowing", alert: d.overdue > 0 },
    { label: "Reservations", value: d.activeRes, sub: d.nearestPos !== null ? `Next position: ${d.nearestPos}` : undefined, to: "/student/reservations" },
    { label: "Due soon", value: d.dueSoon.length, to: "/student/borrowing" },
  ];
  const isNew = !d.loans.length && !d.reqs.length && !d.resv.length;

  const panelCls =
    "panel flex flex-col gap-3 rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-5 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:p-6";
  const panelTitleCls = "font-serif text-[22px] font-medium leading-tight text-[#0B3D32]";
  const lineCls = "line flex items-center justify-between gap-4 border-b border-[#D9DDD7] py-3 font-sans text-[13px] last:border-b-0";

  return (
    <div className="mx-auto w-full font-sans text-[#1F2A27]">
      {/* Welcome header */}
      <section className="relative overflow-hidden rounded-[22px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 py-8 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCE5D7]/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#D9C19A]/40 blur-3xl" />
        <div className="relative">
          <span className="eyebrow mb-2 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
            <span className="h-px w-8 bg-[#B98A4A]" />
            STUDENT LIBRARY
          </span>
          <h1 className="page-title font-serif text-[clamp(32px,5.5vw,52px)] font-medium leading-[1.08] tracking-[-0.01em] text-[#0B3D32]">
            {greeting()}, {user.first_name.split(" ")[0]}.
          </h1>
          <p className="sub mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-sans text-[13.5px] leading-relaxed text-[#6B756F]">
            <span>
              {user.student_id
                ? `Student ID ${user.student_id}`
                : `Reference ${signup?.reference_no ?? "—"} (temporary access until ${fmtDate(user.manual_verified_until)})`}
            </span>
            <span className="text-[#D9C19A]">·</span>
            <span>
              {reg
                ? `${reg.course}, year ${reg.year_level}`
                : signup?.submitted_course
                  ? `${signup.submitted_course} (unverified)`
                  : "Course not provided"}
            </span>
            <span className="text-[#D9C19A]">·</span>
            <Badge status={user.status} />
          </p>
          <div className="actions-row mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="btn primary inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-6 font-sans text-[13px] font-medium text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/student/books")}
            >
              Browse Books
            </button>
            <button
              className="btn ghost inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-6 font-sans text-[13px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/student/borrowing")}
            >
              My Borrowing
            </button>
            <button
              className="btn ghost inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-6 font-sans text-[13px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/student/requests")}
            >
              My Requests
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="stats mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <button
            key={c.label}
            className={`stat ${c.alert ? "alert" : ""} group flex min-h-[112px] flex-col items-start gap-1 rounded-[16px] border bg-[#FBFAF5] p-4 text-left shadow-[0_4px_14px_rgba(11,61,50,0.05)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.3,1)] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(11,61,50,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
              c.alert ? "border-[#E6C7BD] bg-[#F1DDD6]/40 hover:border-[#8A3B35]" : "border-[#D9DDD7] hover:border-[#6F9B78]"
            }`}
            onClick={() => navigate(c.to)}
          >
            <b className={`font-serif text-[34px] font-medium leading-none ${c.alert ? "text-[#8A3B35]" : "text-[#0B3D32]"}`}>{c.value}</b>
            <span className="font-sans text-[12px] leading-snug text-[#6B756F]">{c.label}</span>
            {c.sub && <small className="font-sans text-[11px] font-medium text-[#6F9B78]">{c.sub}</small>}
          </button>
        ))}
      </div>

      {isNew && (
        <div className="mt-6">
          <EmptyState
            title="You have no loans yet"
            text="Browse the catalog to get started."
            action={
              <button
                className="btn primary sm inline-flex h-10 items-center justify-center rounded-[10px] bg-[#0B3D32] px-5 font-sans text-[12.5px] font-medium text-white transition-all duration-200 hover:bg-[#07352C] active:scale-[0.98]"
                onClick={() => navigate("/student/books")}
              >
                Browse Books
              </button>
            }
          />
        </div>
      )}

      {/* Due soon + Notifications */}
      <div className="grid-2 section mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={panelCls}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">On your shelf</span>
              <h2 className={panelTitleCls}>Due soon</h2>
            </div>
          </div>
          {d.dueSoon.length === 0 ? (
            <p className="muted rounded-[10px] bg-[#F5F3EA] px-4 py-5 text-center font-sans text-[13px] text-[#6B756F]">Nothing is due soon.</p>
          ) : (
            d.dueSoon.map((l) => {
              const rs = api.renewalState(l);
              return (
                <div className={lineCls} key={l.borrow_id}>
                  <div className="min-w-0">
                    <b className="block truncate font-serif text-[16px] font-medium text-[#0B3D32]">{books[l.book_id].title}</b>
                    <span className="muted mt-0.5 block font-sans text-[12px] text-[#6B756F]">
                      Due {fmtDate(l.due_date)} ({daysUntil(l.due_date)} days)
                    </span>
                  </div>
                  <button
                    className="btn ghost sm inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-4 font-sans text-[12px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={!rs.ok}
                    title={rs.reason ?? ""}
                    onClick={() => setRenewing(l)}
                  >
                    Renew
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className={panelCls}>
          <div>
            <span className="eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">Recent activity</span>
            <h2 className={panelTitleCls}>Notifications</h2>
          </div>
          {notifs.length === 0 ? (
            <p className="muted rounded-[10px] bg-[#F5F3EA] px-4 py-5 text-center font-sans text-[13px] text-[#6B756F]">You are all caught up.</p>
          ) : (
            notifs.slice(0, 5).map((n) => (
              <div className={lineCls} key={n.id}>
                <div className="min-w-0">
                  <b className="block font-sans text-[13.5px] font-bold text-[#0B3D32]">{n.title}</b>
                  <span className="muted mt-0.5 block font-sans text-[12px] leading-snug text-[#6B756F]">{n.text}</span>
                </div>
              </div>
            ))
          )}
          <Link
            className="text-btn mt-1 self-start font-sans text-[12px] font-bold text-[#0B3D32] underline-offset-4 transition-colors duration-200 hover:text-[#B98A4A] hover:underline"
            to="/student/notifications"
          >
            View all →
          </Link>
        </div>
      </div>

      {/* Recommended */}
      <div className="mt-10">
        <RecommendedBooks
          items={recommendations}
          onView={(title) => navigate(`/student/books?q=${encodeURIComponent(title)}`)}
          onEditInterests={() => navigate(INTEREST_PATH)}
        />
      </div>

      {renewing && <RenewDialog loan={renewing} book={books[renewing.book_id]} onClose={() => setRenewing(null)} />}
    </div>
  );
}