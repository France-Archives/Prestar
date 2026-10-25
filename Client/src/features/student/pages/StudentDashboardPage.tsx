import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { TIME_ZONE, USE_MOCKS } from "@/utils/constants";
import * as booksService from "@/services/booksService";
import * as reportsService from "@/services/reportsService";
import BookGrid from "@/features/books/components/BookGrid";
import DueDateAlert from "../components/DueDateAlert";
import RecommendedBooks from "../components/RecommendedBooks";

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
  // Mock popular-book rows need a larger catalog lookup; live rows include book summaries.
  const catalog = useAsync(
    () => booksService.listBooks({ pageSize: USE_MOCKS ? 100 : 6 }),
    [],
  );

  if (dash.loading) return <div className="page"><LoadingState rows={4} /></div>;
  if (dash.error || !dash.data) {
    return <div className="page"><ErrorState message={dash.error ?? "Could not load the dashboard."} onRetry={() => void dash.reload()} /></div>;
  }

  const d = dash.data;
  const firstName = user?.displayName.split(" ")[0] ?? "";
  const offered = d.reservations.filter((r) => r.status === "OFFERED").length;
  // A pending COR is shown only on the COR page.
  const needsCor = d.cor.status !== "APPROVED" && d.cor.status !== "PENDING";

  const books = catalog.data?.data ?? [];
  const byId = new Map(books.map((b) => [b.id, b] as const));
  const popular = d.mostBorrowed.flatMap((p) => {
    const book = p.book ?? byId.get(p.bookId);
    return book ? [{ book, loans: p.loanCount }] : [];
  });
  const popularMeta = Object.fromEntries(popular.map(({ book, loans }) => [book.id, <span key={book.id} className="book-card__stat">{loans} loans</span>]));
  return (
    <div className="page">
         <header className="dash-hello">
        <div className="dash-hello__text">
          <span className="eyebrow">Student library</span>
          <h1>{greeting()}, {firstName}.</h1>
          <p className="subtle">Find your next book to borrow.</p>
          <Link to={S.books} className="btn btn-primary btn-sm dash-hello__cta">Browse the catalog</Link>
        </div>
      </header>

      <div className="dash-notices">
        {d.accountStatus === "SUSPENDED" && <Alert kind="warn">Your account is suspended. You can browse and see your history, but you cannot start new borrowing.</Alert>}
        {d.accountStatus === "PENDING_VERIFICATION" && <Alert kind="warn">Verify your email to activate borrowing. Check the verification link we sent you.</Alert>}
        {needsCor && (
          <Alert kind="warn">
            Submit your COR for this term to start borrowing. <Link to={S.uploadCor}>Submit COR</Link>
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
          {USE_MOCKS && catalog.loading && !catalog.data ? (
            <div className="book-row" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="book-skel skeleton" />)}
            </div>
          ) : (
            popular.length > 0 && <BookGrid layout="shelf" ranked books={popular.map((p) => p.book)} meta={popularMeta} />
          )}
        </Section>
      )}

      <Section eyebrow="Chosen for you" title="Recommended for you" action={<Link to={S.interests} className="link-btn">Edit interests</Link>}>
        <RecommendedBooks books={d.recommended} />
      </Section>

      <Section
        eyebrow="Explore the collection"
        title="Browse Books"
        action={<Link to={S.books} className="btn btn-ghost btn-sm">View All</Link>}
      >
        {catalog.loading ? (
          <LoadingState rows={2} />
        ) : catalog.error ? (
          <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} />
        ) : books.length === 0 ? (
          <EmptyState title="No books are currently available." text="Visit the catalog again later." />
        ) : (
          <BookGrid books={books.slice(0, 6)} />
        )}
      </Section>
    </div>
  );
}