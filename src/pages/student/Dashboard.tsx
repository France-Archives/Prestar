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

  return (
    <>
      <span className="eyebrow">STUDENT LIBRARY</span>
      <h1 className="page-title">{greeting()}, {user.first_name.split(" ")[0]}.</h1>
      <p className="sub">
        {user.student_id ? `Student ID ${user.student_id}` : `Reference ${signup?.reference_no ?? "—"} (temporary access until ${fmtDate(user.manual_verified_until)})`}
        {" · "}
        {reg ? `${reg.course}, year ${reg.year_level}` : signup?.submitted_course ? `${signup.submitted_course} (unverified)` : "Course not provided"}
        {" · "}
        <Badge status={user.status} />
      </p>

      <div className="stats">
        {cards.map((c) => (
          <button key={c.label} className={`stat ${c.alert ? "alert" : ""}`} onClick={() => navigate(c.to)}>
            <b>{c.value}</b>
            <span>{c.label}</span>
            {c.sub && <small>{c.sub}</small>}
          </button>
        ))}
      </div>

      {isNew && (
        <EmptyState
          title="You have no loans yet"
          text="Browse the catalog to get started."
          action={<button className="btn primary sm" onClick={() => navigate("/student/books")}>Browse Books</button>}
        />
      )}

      <div className="grid-2 section">
        <div className="panel">
          <h2>Due soon</h2>
          {d.dueSoon.length === 0 ? (
            <p className="muted">Nothing is due soon.</p>
          ) : (
            d.dueSoon.map((l) => {
              const rs = api.renewalState(l);
              return (
                <div className="line" key={l.borrow_id}>
                  <div>
                    <b>{books[l.book_id].title}</b>
                    <br />
                    <span className="muted">Due {fmtDate(l.due_date)} ({daysUntil(l.due_date)} days)</span>
                  </div>
                  <button className="btn ghost sm" disabled={!rs.ok} title={rs.reason ?? ""} onClick={() => setRenewing(l)}>Renew</button>
                </div>
              );
            })
          )}
        </div>
        <div className="panel">
          <h2>Notifications</h2>
          {notifs.length === 0 ? (
            <p className="muted">You are all caught up.</p>
          ) : (
            notifs.slice(0, 5).map((n) => (
              <div className="line" key={n.id}>
                <div><b>{n.title}</b><br /><span className="muted">{n.text}</span></div>
              </div>
            ))
          )}
          <Link className="text-btn" to="/student/notifications">View all</Link>
        </div>
      </div>

      <RecommendedBooks
        items={recommendations}
        onView={(title) => navigate(`/student/books?q=${encodeURIComponent(title)}`)}
        onEditInterests={() => navigate(INTEREST_PATH)}
      />

      <div className="actions-row">
        <button className="btn primary sm" onClick={() => navigate("/student/books")}>Browse Books</button>
        <button className="btn ghost sm" onClick={() => navigate("/student/borrowing")}>My Borrowing</button>
        <button className="btn ghost sm" onClick={() => navigate("/student/requests")}>My Requests</button>
      </div>

      {renewing && <RenewDialog loan={renewing} book={books[renewing.book_id]} onClose={() => setRenewing(null)} />}
    </>
  );
}  