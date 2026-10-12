import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import * as authService from "@/services/authService";
import * as booksService from "@/services/booksService";
import * as reportsService from "@/services/reportsService";
import BookGrid from "@/features/books/components/BookGrid";
import { TIME_ZONE } from "@/utils/constants";
import DueDateAlert from "../components/DueDateAlert";

const S = ROUTES.student;

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }).format(new Date())) % 24;
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Section({ eyebrow, title, note, action, children }: { eyebrow: string; title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="dash-section">
      <header className="dash-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {note && <p className="subtle">{note}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const dash = useAsync(() => reportsService.getStudentDashboard(), []);
  const profile = useAsync(() => authService.getMyProfile(), []);
  // The statistics carry no covers or authors, so look the popular titles up in the catalog.
  const catalog = useAsync(() => booksService.listBooks({ pageSize: 100 }), []);

  if (dash.loading) return <div className="page"><LoadingState rows={4} /></div>;
  if (dash.error || !dash.data) {
    return <div className="page"><ErrorState message={dash.error ?? "Could not load the dashboard."} onRetry={() => void dash.reload()} /></div>;
  }

  const d = dash.data;
  const firstName = user?.displayName.split(" ")[0] ?? "";
  const noInterests = (profile.data?.interests.length ?? 3) < 3;
  const offered = d.reservations.filter((r) => r.status === "OFFERED").length;

  const byId = new Map((catalog.data?.data ?? []).map((b) => [b.id, b] as const));
  const popular = d.mostBorrowed.flatMap((p) => {
    const book = byId.get(p.bookId);
    return book ? [{ book, loans: p.loanCount }] : [];
  });
  const popularMeta = Object.fromEntries(popular.map(({ book, loans }) => [book.id, <span key={book.id} className="book-card__stat">{loans} loans</span>]));

  return (
    <div className="page">
      <header className="dash-hello">
        <div>
          <span className="eyebrow">Student library</span>
          <h1>{greeting()}, {firstName}.</h1>
          <p className="subtle">Find your next book to borrow.</p>
        </div>
        <Link to={S.books} className="btn btn-primary btn-sm">Browse the catalog</Link>
      </header>

      <div className="dash-notices">
        {d.accountStatus === "SUSPENDED" && <Alert kind="warn">Your account is suspended. You can browse and see your history, but you cannot start new borrowing.</Alert>}
        {d.accountStatus === "PENDING_VERIFICATION" && <Alert kind="warn">Verify your email to activate borrowing. Check the verification link we sent you.</Alert>}
        {d.cor.status !== "APPROVED" && (
          <Alert kind={d.cor.status === "PENDING" ? "info" : "warn"}>
            {d.cor.status === "PENDING" ? "Your COR is waiting for review." : "Submit your COR for this term to start borrowing."}{" "}
            <Link to={d.cor.status === "PENDING" ? S.cor : S.uploadCor}>{d.cor.status === "PENDING" ? "View COR" : "Submit COR"}</Link>
          </Alert>
        )}
        {noInterests && (
          <Alert kind="info">
            Choose 3 reading interests for better recommendations. <Link to={S.interests}>Choose interests</Link>
          </Alert>
        )}
        {d.pickupWaiting.length > 0 && (
          <Alert kind="info">
            {d.pickupWaiting.length === 1 ? "A book is" : `${d.pickupWaiting.length} books are`} waiting for pickup at the library. <Link to={S.requests}>View requests</Link>
          </Alert>
        )}
        {offered > 0 && (
          <Alert kind="warn">
            {offered === 1 ? "A reserved copy is" : `${offered} reserved copies are`} held for you. <Link to={S.reservations}>View reservations</Link>
          </Alert>
        )}
        <DueDateAlert loans={d.activeLoans} />
      </div>

      {d.mostBorrowed.length > 0 && (
        <Section eyebrow="Reader activity" title="Most Borrowed This Week" note="What other students are reading right now.">
          {catalog.loading && !catalog.data ? (
            <div className="book-row" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="book-skel skeleton" />)}
            </div>
          ) : (
            popular.length > 0 && <BookGrid layout="row" ranked books={popular.map((p) => p.book)} meta={popularMeta} />
          )}
        </Section>
      )}

      <Section eyebrow="Chosen for you" title="Recommended For You" action={<Link to={S.interests} className="link-btn">Edit interests</Link>}>
        <BookGrid books={d.recommended} emptyText="No recommendations yet." />
      </Section>
    </div>
  );
}