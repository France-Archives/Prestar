import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { SelectField } from "@/components/forms/FormField";
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
  /** Bigger cover and wider layout for the full page. */
  large?: boolean;
  /** Modal layout: shows the title block and the More info action. */
  modal?: boolean;
}

/** Book facts + the role-specific actions. Shared by the details PAGE and the details MODAL. */
export function BookDetailsContent({ book, reload, onNavigate, large = false, modal = false }: ContentProps) {
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

  return (
    <div className={`bk-detail${large ? " bk-detail--page" : ""}${modal ? " bk-detail--modal" : ""}`}>
      <div className="bk-detail__cover">
        <BookCover src={book.coverImageUrl} title={book.title} author={authors} />
      </div>

      <div className="bk-detail__body">
        {modal && (
          <header className="bk-detail__head">
            <span className="eyebrow">{book.category?.name ?? "Book"}</span>
            <h2>{book.title}</h2>
            <p className="subtle">by {authors}</p>
          </header>
        )}

        <div className="bk-detail__badges">
          <AvailabilityBadge availability={book.availability} />
          {book.isArchived && <span className="badge badge-neutral">Archived</span>}
        </div>

        {book.description && <p className="bk-detail__desc">{book.description}</p>}

        <dl className="bk-detail__facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        {isStudent && (
          <section className="bk-action" aria-label={mode === "reserve" ? "Reserve this book" : "Borrow this book"}>
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
            <div className="bk-action__buttons">
              {mode !== "none" && (
                <Button onClick={act} loading={busy}>
                  {mode === "request" ? "Borrow now" : "Join the queue"}
                </Button>
              )}
              {modal && (
                <Link to={ROUTES.student.bookDetails(book.id)} className="btn btn-ghost" onClick={onNavigate}>
                  More info
                </Link>
              )}
            </div>
          </section>
        )}

        {user && !isStudent && can(user, "CATALOG_MANAGE") && (
          <div>
            <Link to={ROUTES.staff.bookCopies(book.id)} className="btn btn-ghost" onClick={onNavigate}>
              Manage copies
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

interface ModalProps {
  bookId: string;
  /** Known from the card, so the dialog is labelled immediately while details load. */
  title: string;
  onClose: () => void;
}

/** Netflix-style details popup over a dimmed, blurred page. Esc, the close button and a click outside all close it. */
export default function BookDetailsModal({ bookId, title, onClose }: ModalProps) {
  const { data: book, loading, error, reload } = useAsync(() => booksService.getBook(bookId), [bookId]);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  // Portal to <body> so no parent (card, animation, overflow) can clip or offset the overlay.
  return createPortal(
    <div className="bk-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bk-modal" role="dialog" aria-modal="true" aria-label={title}>
        <button ref={closeBtn} type="button" className="bk-close" aria-label="Close details" onClick={onClose}>
          <X size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="bk-modal__scroll">
          {loading && !book ? (
            <div className="bk-modal__state">
              <h2>{title}</h2>
              <LoadingState rows={3} />
            </div>
          ) : error || !book ? (
            <div className="bk-modal__state">
              <ErrorState message={error ?? "Book not found."} onRetry={() => void reload()} />
            </div>
          ) : (
            <BookDetailsContent book={book} reload={() => void reload()} onNavigate={onClose} modal />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}