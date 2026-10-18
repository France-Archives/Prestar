import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import * as reservationsService from "@/services/reservationsService";
import type { BookDetail } from "@/types";
import { describeError } from "@/utils/errors";
import { can } from "@/utils/permissions";
import { useBorrowList } from "@/context/BorrowListContext";
import AvailabilityBadge from "./AvailabilityBadge";
import BookCover from "./BookCover";

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
  const { addBook } = useBorrowList();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [problem, setProblem] = useState<{ message: string; code?: string } | null>(null);

  const isStudent = user?.role === "STUDENT";
  const { availableCopies, totalUsableCopies } = book.availability;
  const mode: "request" | "reserve" | "none" = availableCopies > 0 ? "request" : totalUsableCopies > 0 ? "reserve" : "none";

  const go = (to: string) => {
    onNavigate?.();
    navigate(to);
  };

  const addToBorrowList = () => {
    if (addBook(book)) {
      setAdded(true);
      toast.success(`${book.title} added to My Borrow List.`);
    } else {
      toast.info(`${book.title} is already in My Borrow List.`);
    }
  };

  // Reservation creation remains an explicit student action when no copy is available.
  const act = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await reservationsService.createReservation({ bookId: book.id, requestedDurationDays: 7 });
      toast.success("You joined the reservation queue.");
      go(ROUTES.student.reservations);
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
            {mode === "request" && <p className="subtle">Add titles to your borrow list, review each quantity and duration, then submit. Approved copies are held for pickup; loans start at handover.</p>}
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
              {mode === "request" && <Button onClick={addToBorrowList}>{added ? "Added to My Borrow List" : "Add to My Borrow List"}</Button>}
              {mode === "reserve" && <Button onClick={act} loading={busy}>Join the reservation queue</Button>}
              {added && <Link to={ROUTES.student.borrowList} onClick={onNavigate}>Review My Borrow List</Link>}
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