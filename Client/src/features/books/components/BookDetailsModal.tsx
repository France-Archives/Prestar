import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Barcode, BookOpen, Building2, CalendarDays, Check, Info, Languages, Plus, Tag, X } from "lucide-react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Modal from "@/components/ui/Modal";
import { SelectField } from "@/components/forms/FormField";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import * as borrowingService from "@/services/borrowingService";
import * as reservationsService from "@/services/reservationsService";
import type { AllowedDurationDays, BookDetail } from "@/types";
import { DURATION_OPTIONS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { can } from "@/utils/permissions";
import { useBorrowList } from "@/context/BorrowListContext";
import AvailabilityBadge from "./AvailabilityBadge";
import BookCover from "./BookCover";
import "./BookDetailsModal.css";

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
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [duration, setDuration] = useState<AllowedDurationDays>(7);
  const [problem, setProblem] = useState<{ message: string; code?: string } | null>(null);

  const isStudent = user?.role === "STUDENT";
  const { availableCopies } = book.availability;
  const mode: "request" | "reserve" = availableCopies > 0 ? "request" : "reserve";

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

  const borrow = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const request = await borrowingService.createBorrowingRequest({
        bookId: book.id,
        requestedDurationDays: duration,
      });
      toast.success(request.message);
      setBorrowDialogOpen(false);
    } catch (e) {
      setProblem({ message: describeError(e), code: (e as { code?: string }).code });
    } finally {
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

  const studentActions = isStudent && (
    <section className="bk-action" aria-label={mode === "reserve" ? "Reserve this book" : "Borrow this book"}>
      {mode === "reserve" && <p className="subtle">No copies are available. Join the reservation queue to be notified when one is offered.</p>}
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
        {mode === "request" && (
          <>
            {modal && (
              <Button onClick={() => { setDuration(7); setBorrowDialogOpen(true); }} disabled={busy} className="bk-modal__action-button">
                Borrow
              </Button>
            )}
            <Button onClick={addToBorrowList} disabled={busy} className={added ? "bk-modal__action-button is-added" : "bk-modal__action-button"}>
              {added ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {added ? "Added to My Borrow List" : "Add to My Borrow List"}
            </Button>
          </>
        )}
        {mode === "reserve" && (
          <Button onClick={act} loading={busy} className="bk-modal__action-button">
            Join the reservation queue
          </Button>
        )}
        {added && <Link to={ROUTES.student.borrowList} className="bk-modal__review-link" onClick={onNavigate}>Review My Borrow List</Link>}
        {modal && (
          <Link to={ROUTES.student.bookDetails(book.id)} className="btn btn-ghost bk-modal__more-link" onClick={onNavigate}>
            More info
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      {mode === "request" && modal && (
        <p className="bk-modal__helper">
          <Info size={15} aria-hidden="true" />
          <span>Add titles to your borrow list, review each quantity and duration, then submit. Approved copies are held for pickup; loans start at handover.</span>
        </p>
      )}
      {borrowDialogOpen && modal && (
        <Modal
          title={`Borrow ${book.title}`}
          onClose={busy ? () => undefined : () => setBorrowDialogOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setBorrowDialogOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={() => void borrow()} loading={busy}>Confirm Borrow</Button>
            </>
          }
        >
          <SelectField label="Loan duration" value={duration} onChange={(event) => setDuration(Number(event.target.value) as AllowedDurationDays)}>
            {DURATION_OPTIONS.map((days) => <option key={days} value={days}>{days} days</option>)}
          </SelectField>
        </Modal>
      )}
      {mode === "request" && !modal && <p className="subtle">Add titles to your borrow list, review each quantity and duration, then submit. Approved copies are held for pickup; loans start at handover.</p>}
    </section>
  );

  if (modal) {
    const iconForFact = (label: string) => {
      if (label === "ISBN") return <Barcode size={17} aria-hidden="true" />;
      if (label === "Publisher") return <Building2 size={17} aria-hidden="true" />;
      if (label === "Year") return <CalendarDays size={17} aria-hidden="true" />;
      if (label === "Language") return <Languages size={17} aria-hidden="true" />;
      return <Tag size={17} aria-hidden="true" />;
    };
    const { availableCopies: available, totalUsableCopies: total } = book.availability;

    return (
      <div className="bk-detail bk-detail--modal bk-modal-layout">
        <section
          className="bk-detail__cover bk-modal__shelf"
          onMouseMove={(event) => {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const x = (event.clientX - bounds.left) / bounds.width - 0.5;
            const y = (event.clientY - bounds.top) / bounds.height - 0.5;
            event.currentTarget.style.setProperty("--ry", `${26 + x * 40}deg`);
            event.currentTarget.style.setProperty("--rx", `${-7 - y * 24}deg`);
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.removeProperty("--ry");
            event.currentTarget.style.removeProperty("--rx");
          }}
        >
          <span className="bk-modal__glow" aria-hidden="true" />
          <span className="bk-modal__floor" aria-hidden="true" />
          <div className="bk-modal__book-stage">
            <div className="bk-modal__book-float">
              <div className="bk-modal__book">
                <div className="bk-modal__book-face bk-modal__book-front">
                  <BookCover src={book.coverImageUrl} title={book.title} author={authors} />
                </div>
                <div className="bk-modal__book-face bk-modal__book-spine" aria-hidden="true">
                  <span>{book.title}</span>
                </div>
                <div className="bk-modal__book-face bk-modal__book-pages" aria-hidden="true" />
                <div className="bk-modal__book-face bk-modal__book-top" aria-hidden="true" />
                <div className="bk-modal__book-face bk-modal__book-back" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <div className="bk-detail__body bk-modal__body">
          <header className="bk-detail__head bk-modal__head">
            <span className="bk-modal__category">
              <BookOpen size={14} aria-hidden="true" />
              {book.category?.name ?? "Book"}
            </span>
            <h2 id="bk-detail-title">{book.title}</h2>
            <p className="subtle">by <strong>{authors}</strong></p>
          </header>

          <div className={`bk-modal__availability${available > 0 ? " is-available" : " is-unavailable"}`}>
            <div className="bk-modal__availability-row">
              <span className="bk-modal__availability-status">
                {available > 0 && <span className="bk-modal__availability-dot" aria-hidden="true" />}
                {available > 0 ? "Available now" : "Unavailable · reserve"}
              </span>
              {total > 0 && <span className="bk-modal__availability-count">{available} of {total} copies</span>}
              {book.isArchived && <span className="badge badge-neutral">Archived</span>}
            </div>
            {total > 0 && (
              <div className="bk-modal__availability-bar" aria-hidden="true">
                {Array.from({ length: total }, (_, index) => (
                  <span key={`copy-${index}`} className={index < available ? "is-filled" : undefined} />
                ))}
              </div>
            )}
          </div>

          {book.description && <p className="bk-detail__desc bk-modal__description" id="bk-modal-description">{book.description}</p>}

          <dl className="bk-detail__facts bk-modal__facts">
            {facts.filter(([, value]) => value.trim() && value !== "—").map(([label, value]) => (
              <div className="bk-modal__fact" key={label}>
                <span className="bk-modal__fact-icon">{iconForFact(label)}</span>
                <span className="bk-modal__fact-copy">
                  <dt>{label}</dt>
                  <dd title={value}>{value}</dd>
                </span>
              </div>
            ))}
          </dl>

          {studentActions}
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

  return (
    <div className={`bk-detail${large ? " bk-detail--page" : ""}`}>
      <div className="bk-detail__cover">
        <BookCover src={book.coverImageUrl} title={book.title} author={authors} />
      </div>

      <div className="bk-detail__body">
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
            {mode === "reserve" && <p className="subtle">No copies are available. Join the reservation queue to be notified when one is offered.</p>}
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
      <div className="bk-modal" role="dialog" aria-modal="true" aria-labelledby="bk-modal-title" aria-describedby="bk-modal-a11y-description">
        <h2 id="bk-modal-title" className="bk-modal__sr-only">{book?.title ?? title}</h2>
        <p id="bk-modal-a11y-description" className="bk-modal__sr-only">Book details and availability.</p>
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