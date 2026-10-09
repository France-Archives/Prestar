// Place this file at: src/pages/student/Profile.tsx
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useInterests } from "../../hooks/useInterests";
import * as api from "../../services/api";
import { INTEREST_PATH } from "../../utils/constants";
import { fmtDate } from "../../utils/dates";
import { requestStatus, reservationStatus } from "../../utils/status";

type InfoItem = { label: string; value: string };

const PANEL_CLS =
  "panel flex flex-col gap-5 rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-5 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:p-7";
const EYEBROW_CLS = "eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]";
const TITLE_CLS = "font-serif text-[22px] font-medium leading-tight text-[#0B3D32] sm:text-[24px]";

function InfoGrid({ items }: { items: InfoItem[] }) {
  return (
    <dl className="kv grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0 border-b border-[#D9DDD7] pb-3">
          <dt className="font-sans text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#6B756F]">{i.label}</dt>
          <dd className="m-0 mt-1 break-words font-sans text-[14px] font-medium text-[#1F2A27]">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function StudentProfile() {
  const { db, user } = useAuthedLibrary();
  const navigate = useNavigate();
  const uid = user.user_id;
  const interestIds = useInterests(uid);

  const reg = user.student_id ? db.university_students.find((s) => s.student_id === user.student_id) : undefined;
  const signup = db.signups.find((s) => s.created_user_id === uid);

  const stats = useMemo(() => {
    const loans = db.borrowed_books.filter((l) => l.user_id === uid && l.status === "Borrowed").length;
    const resv = db.reservations
      .filter((r) => r.user_id === uid)
      .map((r) => reservationStatus(r))
      .filter((s) => s === "Waiting" || s === "Ready").length;
    const pending = db.borrow_requests
      .filter((r) => r.user_id === uid)
      .map((r) => requestStatus(r))
      .filter((s) => s === "Pending").length;
    const unpaid = db.penalties.filter((p) => p.user_id === uid && p.status === "Unpaid");
    return {
      loans,
      resv,
      pending,
      unpaidCount: unpaid.length,
      unpaidTotal: unpaid.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [db, uid]);

  const interests = useMemo(() => {
    const ids = (Array.isArray(interestIds) ? interestIds : []).map(String);
    return db.categories.filter((c) => ids.includes(String(c.category_id)));
  }, [db.categories, interestIds]);

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();

  const personal: InfoItem[] = [
    { label: "Full Name", value: fullName || "—" },
    { label: "Student ID", value: user.student_id ?? "Not assigned yet" },
    { label: "School Email", value: user.email },
    ...(!user.student_id
      ? [
          { label: "Reference No.", value: signup?.reference_no ?? "—" },
          { label: "Temporary access until", value: fmtDate(user.manual_verified_until) },
        ]
      : []),
  ];

  const academic: InfoItem[] = [
    { label: "Course / Program", value: reg?.course ?? (signup?.submitted_course ? `${signup.submitted_course} (unverified)` : "Not provided") },
    { label: "Year Level", value: reg ? String(reg.year_level) : "Not provided" },
  ];

  const library: { label: string; value: string; to: string; alert?: boolean }[] = [
    { label: "Borrowed books", value: String(stats.loans), to: "/student/borrowing" },
    { label: "Active reservations", value: String(stats.resv), to: "/student/reservations" },
    { label: "Pending requests", value: String(stats.pending), to: "/student/requests" },
    {
      label: "Unpaid penalties",
      value: stats.unpaidCount ? stats.unpaidTotal.toFixed(2) : "0",
      to: "/student/borrowing",
      alert: stats.unpaidCount > 0,
    },
  ];

  const restricted = api.checkEligibility(uid, "promote").length > 0;

  return (
    <div className="mx-auto w-full font-sans text-[#1F2A27]">
      {/* Profile header */}
      <header className="relative overflow-hidden rounded-[22px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 py-8 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCE5D7]/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#D9C19A]/40 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div
            className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-[#FBFAF5] bg-[#0B3D32] font-serif text-[34px] font-medium text-[#FBFAF5] shadow-[0_8px_22px_rgba(7,53,44,0.25)] sm:h-28 sm:w-28 sm:text-[40px]"
            aria-hidden="true"
          >
            {initials || "•"}
          </div>
          <div className="min-w-0 flex-1">
            <span className="eyebrow mb-2 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
              <span className="h-px w-8 bg-[#B98A4A]" />
              ACCOUNT
            </span>
            <h1 className="page-title font-serif text-[clamp(30px,5vw,46px)] font-medium leading-[1.08] tracking-[-0.01em] text-[#0B3D32]">
              My Profile
            </h1>
            <p className="mt-2 break-words font-serif text-[19px] text-[#1F2A27]">{fullName}</p>
            <p className="sub mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-sans text-[13px] text-[#6B756F]">
              <span className="break-all">{user.email}</span>
              <span className="text-[#D9C19A]">·</span>
              <span>{user.student_id ? `Student ID ${user.student_id}` : "No Student ID yet"}</span>
              <span className="text-[#D9C19A]">·</span>
              <Badge status={user.status} />
            </p>
          </div>
          <button
            className="btn ghost inline-flex h-11 w-full shrink-0 items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-6 font-sans text-[13px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto"
            onClick={() => navigate(INTEREST_PATH)}
          >
            Edit Interests
          </button>
        </div>
      </header>

      {restricted && (
        <div className="mt-6 rounded-[12px] border border-[#E6C7BD] bg-[#F1DDD6] px-4 py-3 font-sans text-[13px] text-[#8A3B35]">
          Your account is not currently in good standing. Check your borrowing page for details.{" "}
          <Link to="/student/borrowing" className="font-bold text-[#0B3D32] underline underline-offset-2 hover:text-[#B98A4A]">
            See details
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Personal */}
        <section className={PANEL_CLS}>
          <div>
            <span className={EYEBROW_CLS}>Profile</span>
            <h2 className={TITLE_CLS}>Personal Information</h2>
          </div>
          <InfoGrid items={personal} />
        </section>

        {/* Academic */}
        <section className={PANEL_CLS}>
          <div>
            <span className={EYEBROW_CLS}>Student</span>
            <h2 className={TITLE_CLS}>Academic Information</h2>
          </div>
          <InfoGrid items={academic} />
        </section>

        {/* Library account */}
        <section className={`${PANEL_CLS} lg:col-span-2`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className={EYEBROW_CLS}>Library</span>
              <h2 className={TITLE_CLS}>Library Account</h2>
            </div>
            <div className="flex items-center gap-2 font-sans text-[12px] text-[#6B756F]">
              Status <Badge status={user.status} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {library.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => navigate(s.to)}
                className={`flex min-h-[104px] flex-col items-start gap-1 rounded-[16px] border p-4 text-left transition-all duration-300 ease-[cubic-bezier(.22,.8,.3,1)] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(11,61,50,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] ${
                  s.alert
                    ? "border-[#E6C7BD] bg-[#F1DDD6]/40 hover:border-[#8A3B35]"
                    : "border-[#D9DDD7] bg-[#F5F3EA] hover:border-[#6F9B78]"
                }`}
              >
                <b className={`font-serif text-[32px] font-medium leading-none ${s.alert ? "text-[#8A3B35]" : "text-[#0B3D32]"}`}>
                  {s.value}
                </b>
                <span className="font-sans text-[12px] leading-snug text-[#6B756F]">{s.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Interests */}
        <section className={`${PANEL_CLS} lg:col-span-2`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className={EYEBROW_CLS}>Reading</span>
              <h2 className={TITLE_CLS}>Reading Interests</h2>
            </div>
            <button
              className="text-btn font-sans text-[12px] font-bold text-[#0B3D32] underline-offset-4 transition-colors duration-200 hover:text-[#B98A4A] hover:underline"
              onClick={() => navigate(INTEREST_PATH)}
            >
              Edit interests →
            </button>
          </div>
          {interests.length === 0 ? (
            <p className="muted rounded-[10px] bg-[#F5F3EA] px-4 py-5 text-center font-sans text-[13px] text-[#6B756F]">
              You have not selected any reading interests yet.
            </p>
          ) : (
            <div className="chips flex flex-wrap gap-2">
              {interests.map((c) => (
                <span
                  key={c.category_id}
                  className="rounded-full border border-[#6F9B78] bg-[#DCE5D7] px-4 py-1.5 font-sans text-[12.5px] font-medium text-[#0B3D32]"
                >
                  {c.category_name}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Shortcuts */}
        <section className={`${PANEL_CLS} lg:col-span-2`}>
          <div>
            <span className={EYEBROW_CLS}>Account</span>
            <h2 className={TITLE_CLS}>Quick Links</h2>
          </div>
          <div className="actions-row flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              className="btn primary inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-6 font-sans text-[13px] font-medium text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] sm:w-auto"
              onClick={() => navigate("/student/books")}
            >
              Browse Books
            </button>
            {[
              { to: "/student/borrowing", label: "My Borrowing" },
              { to: "/student/requests", label: "My Requests" },
              { to: "/student/reservations", label: "Reservations" },
              { to: "/student/notifications", label: "Notifications" },
            ].map((l) => (
              <button
                key={l.to}
                className="btn ghost inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-6 font-sans text-[13px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:w-auto"
                onClick={() => navigate(l.to)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}