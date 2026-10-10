import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { SelectField } from "@/components/forms/FormField";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import * as borrowingService from "@/services/borrowingService";
import * as reservationsService from "@/services/reservationsService";
import type { AllowedDurationDays } from "@/types";
import { describeError } from "@/utils/errors";
import { can } from "@/utils/permissions";
import AvailabilityBadge from "../components/AvailabilityBadge";
import BookCover from "../components/BookCover";

const DURATIONS: AllowedDurationDays[] = [3, 7, 14, 21, 30, 60];

export default function BookDetailsPage() {
  const { bookId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: book, loading, error, reload } = useAsync(() => booksService.getBook(bookId), [bookId]);
  const [duration, setDuration] = useState<AllowedDurationDays>(7);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; code?: string } | null>(null);

  if (loading) return <div className="page"><LoadingState rows={4} /></div>;
  if (error || !book) return <div className="page"><ErrorState message={error ?? "Book not found."} onRetry={() => void reload()} /></div>;

  const isStudent = user?.role === "STUDENT";
  const { availableCopies, totalUsableCopies } = book.availability;
  const mode: "request" | "reserve" | "none" = availableCopies > 0 ? "request" : totalUsableCopies > 0 ? "reserve" : "none";

  // The backend decides eligibility and copy assignment. Errors such as COR_REQUIRED come back and are shown here.
  const act = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (mode === "request") {
        const res = await borrowingService.createBorrowingRequest({ bookId: book.id, requestedDurationDays: duration });
        toast.success(res.message);
        navigate(ROUTES.student.requests);
      } else {
        await reservationsService.createReservation({ bookId: book.id });
        toast.success("You joined the reservation queue.");
        navigate(ROUTES.student.reservations);
      }
    } catch (e) {
      setProblem({ message: describeError(e), code: (e as { code?: string }).code });
      void reload(); // availability may have changed (409 conflicts)
      setBusy(false);
    }
  };

  const authors = book.authors.map((a) => a.name).join(", ") || "Unknown author";
  const facts: [string, string][] = [
    ["ISBN", book.isbn ?? "—"],
    ["Publisher", book.publisher ?? "—"],
    ["Year", book.publicationYear ? String(book.publicationYear) : "—"],
    ["Language", book.language ?? "—"],
    ["Category", book.category?.name ?? "—"],
  ];

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: "Book catalog", to: ROUTES.student.books }, { label: book.title }]} />
      <PageHeader eyebrow={book.category?.name ?? "Book"} title={book.title} description={`by ${authors}`} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div style={{ maxWidth: 260 }}>
          <BookCover src={book.coverImageUrl} title={book.title} />
        </div>
        <div className="stack">
          <div>
            <AvailabilityBadge availability={book.availability} />
            {book.isArchived && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>Archived</span>}
          </div>
          {book.description && <p>{book.description}</p>}
          <dl className="kv card card-pad">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          {isStudent && (
            <Card title={mode === "reserve" ? "Reserve this book" : "Borrow this book"} note="Eligibility is checked by the library system when you submit.">
              <div className="stack">
                {mode === "request" && (
                  <>
                    <SelectField label="Loan duration" value={duration} onChange={(e) => setDuration(Number(e.target.value) as AllowedDurationDays)}>
                      {DURATIONS.map((d) => (
                        <option key={d} value={d}>{d} days</option>
                      ))}
                    </SelectField>
                    <p className="subtle">If approved, a copy is held for you for 3 days. The loan starts only when staff hand over the book at the library.</p>
                  </>
                )}
                {mode === "reserve" && <p className="subtle">All copies are out. You join a first-in, first-out queue. When a copy is free it is held for you for 3 days.</p>}
                {mode === "none" && <Alert kind="info">There are no copies in circulation right now.</Alert>}
                {problem && (
                  <Alert kind="error">
                    {problem.message}
                    {problem.code?.startsWith("COR_") && (
                      <>
                        {" "}
                        <Link to={ROUTES.student.cor}>Go to my COR</Link>
                      </>
                    )}
                  </Alert>
                )}
                {mode !== "none" && (
                  <div>
                    <Button onClick={act} loading={busy}>
                      {mode === "request" ? "Request this book" : "Join the queue"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {user && !isStudent && can(user, "CATALOG_MANAGE") && (
            <Link to={ROUTES.staff.bookCopies(book.id)} className="btn btn-ghost" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
              Manage copies
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}