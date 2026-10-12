import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { SelectField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import * as borrowingService from "@/services/borrowingService";
import * as reservationsService from "@/services/reservationsService";
import type { AllowedDurationDays, BookDetail } from "@/types";
import { describeError } from "@/utils/errors";
import { can } from "@/utils/permissions";
import AvailabilityBadge from "./AvailabilityBadge";
import BookCover from "./BookCover";

const DURATIONS: AllowedDurationDays[] = [3, 7, 14, 21, 30, 60];

interface ContentProps {
  book: BookDetail;
  reload: () => void;
  /** Called right before navigating away (the modal uses it to close itself). */
  onNavigate?: () => void;
  /** Bigger cover and wider layout for the full page; the modal uses the compact one. */
  large?: boolean;
}

/** Book facts + the role-specific actions. Shared by the details PAGE and the details MODAL. */
export function BookDetailsContent({ book, reload, onNavigate, large = false }: ContentProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [duration, setDuration] = useState<AllowedDurationDays>(7);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; code?: string } | null>(null);

  const isStudent = user?.role === "STUDENT";
  const { availableCopies, totalUsableCopies } = book.availability;
  const mode: "request" | "reserve" | "none" = availableCopies > 0 ? "request" : totalUsableCopies > 0 ? "reserve" : "none";

  const go = (to: string) => {
    onNavigate?.();
    navigate(to);
  };

  // The backend decides eligibility and copy assignment. Errors such as COR_REQUIRED come back and are shown here.
  const act = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (mode === "request") {
        const res = await borrowingService.createBorrowingRequest({ bookId: book.id, requestedDurationDays: duration });
        toast.success(res.message);
        go(ROUTES.student.requests);
      } else {
        await reservationsService.createReservation({ bookId: book.id });
        toast.success("You joined the reservation queue.");
        go(ROUTES.student.reservations);
      }
    } catch (e) {
      setProblem({ message: describeError(e), code: (e as { code?: string }).code });
      reload(); // availability may have changed (409 conflicts)
      setBusy(false);
    }
  };

  const facts: [string, string][] = [
    ["ISBN", book.isbn ?? "—"],
    ["Publisher", book.publisher ?? "—"],
    ["Year", book.publicationYear ? String(book.publicationYear) : "—"],
    ["Language", book.language ?? "—"],
    ["Category", book.category?.name ?? "—"],
  ];
  const authors = book.authors.map((a) => a.name).join(", ") || "Unknown author";

  // Tailwind needs full class names, so both layouts are spelled out.
  const layout = large ? "gap-6 lg:grid-cols-[260px_1fr]" : "gap-5 sm:grid-cols-[180px_1fr]";

  return (
    <div className={`grid ${layout}`}>
      <div className="mx-auto w-full sm:mx-0" style={{ maxWidth: large ? 260 : 180 }}>
        <BookCover src={book.coverImageUrl} title={book.title} />
      </div>
      <div className="stack">
        {!large && <p className="subtle" style={{ margin: 0 }}>by {authors}</p>}
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
                      <Link to={ROUTES.student.cor} onClick={onNavigate}>Go to my COR</Link>
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
          <Link to={ROUTES.staff.bookCopies(book.id)} className="btn btn-ghost" style={{ textDecoration: "none", alignSelf: "flex-start" }} onClick={onNavigate}>
            Manage copies
          </Link>
        )}
      </div>
    </div>
  );
}

interface ModalProps {
  bookId: string;
  /** Known from the card, so the header shows immediately while details load. */
  title: string;
  onClose: () => void;
}

/** Centered popup over a dimmed, blurred page. The /app/books/:bookId route still exists. */
export default function BookDetailsModal({ bookId, title, onClose }: ModalProps) {
  const { data: book, loading, error, reload } = useAsync(() => booksService.getBook(bookId), [bookId]);

  // Portal to <body> so no parent (card, animation, overflow) can clip or offset the overlay.
  return createPortal(
    <Modal title={title} wide cinema onClose={onClose}>
      {/* `loading && !book` keeps the content mounted during a reload, so an error message is not lost. */}
      {loading && !book ? (
        <LoadingState rows={3} />
      ) : error || !book ? (
        <ErrorState message={error ?? "Book not found."} onRetry={() => void reload()} />
      ) : (
        <BookDetailsContent book={book} reload={() => void reload()} onNavigate={onClose} />
      )}
    </Modal>,
    document.body,
  );
}