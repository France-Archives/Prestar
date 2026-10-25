import { useState } from "react";
import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { CheckboxField, InputField, SelectField } from "@/components/forms/FormField";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useBorrowList } from "@/context/BorrowListContext";
import { useAsync } from "@/hooks/useAsync";
import * as booksService from "@/services/booksService";
import * as borrowingService from "@/services/borrowingService";
import type { BorrowBatchItemResult, UUID } from "@/types";
import { LIMITS } from "@/utils/constants";
import { describeError } from "@/utils/errors";

interface Decision {
  borrowQuantity: number | null;
  reserveRemainder: boolean;
}

function outcome(result: BorrowBatchItemResult): "success" | "partial" | "failure" {
  if (result.unfulfilledQuantity === 0) return "success";
  return result.requests.length > 0 || result.reservationCreated ? "partial" : "failure";
}

export default function MyBorrowListPage() {
  const { items, updateItem, removeItem, clear } = useBorrowList();
  const [decisions, setDecisions] = useState<Record<UUID, Decision>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BorrowBatchItemResult[] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const ids = items.map((item) => item.book.id).join("|");
  const availability = useAsync(() => Promise.all(items.map((item) => booksService.getBook(item.book.id))), [ids]);
  const freshBooks = new Map((availability.data ?? []).map((book) => [book.id, book]));

  const changeQuantity = (bookId: UUID, quantity: number) => {
    updateItem(bookId, { quantity });
    setDecisions((current) => ({ ...current, [bookId]: { borrowQuantity: null, reserveRemainder: false } }));
  };

  const canSubmit = items.length > 0 && !availability.loading && !availability.error && items.every((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > LIMITS.MAX_ACTIVE_SAME_TITLE) return false;
    const book = freshBooks.get(item.book.id);
    if (!book) return false;
    if (book.availability.availableCopies >= item.quantity) return true;
    const choice = decisions[item.book.id];
    return choice?.borrowQuantity !== null && choice?.borrowQuantity !== undefined && choice.borrowQuantity >= 0 && choice.borrowQuantity <= Math.min(item.quantity, book.availability.availableCopies);
  });

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const next: BorrowBatchItemResult[] = [];
      for (const item of items) {
        const availableCopies = freshBooks.get(item.book.id)?.availability.availableCopies ?? 0;
        const short = availableCopies < item.quantity;
        const decision = decisions[item.book.id];
        try {
          next.push(await borrowingService.submitBorrowBatchItem({
            bookId: item.book.id,
            requestedQuantity: item.quantity,
            borrowQuantity: short ? decision?.borrowQuantity ?? 0 : item.quantity,
            requestedDurationDays: item.requestedDurationDays,
            reserveRemainder: short && Boolean(decision?.reserveRemainder),
          }));
        } catch (error) {
          next.push({
            bookId: item.book.id,
            bookTitle: item.book.title,
            requestedQuantity: item.quantity,
            requestedDurationDays: item.requestedDurationDays,
            requests: [],
            reservationCreated: false,
            unfulfilledQuantity: item.quantity,
            messages: [describeError(error)],
          });
        }
      }
      setResults(next);
      clear();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The borrow list could not be submitted.");
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <PageHero eyebrow="Student" title="My Borrow List" description="Review each title, quantity, and duration before submitting. Each title is processed independently." leading={<BackButton fallback={ROUTES.student.dashboard} />} />

      {results && (
        <section className="stack" aria-live="polite">
          <h2>Submission results</h2>
          {results.map((result) => {
            const state = outcome(result);
            const fulfilled = result.requests.length + (result.reservationCreated ? 1 : 0);
            return (
              <Alert key={result.bookId} kind={state === "success" ? "ok" : state === "partial" ? "info" : "error"}>
                <strong>{result.bookTitle}:</strong> {state === "success" ? "completed" : state === "partial" ? "partially completed" : "not completed"}. {result.requests.length} borrowing {result.requests.length === 1 ? "request" : "requests"} approved{result.reservationCreated ? "; one reservation placed" : ""}; {result.unfulfilledQuantity} of {result.requestedQuantity} requested {result.unfulfilledQuantity === 1 ? "copy remains" : "copies remain"} unfulfilled.
                {result.messages.map((message) => <div key={message}>{message}</div>)}
                {fulfilled > 0 && <div>Approved requests are held for pickup; the loan begins only after physical handover.</div>}
              </Alert>
            );
          })}
          <Link to={ROUTES.student.requests}>View borrowing requests</Link>
        </section>
      )}

      {submitError && <Alert kind="error">{submitError}</Alert>}

      {availability.loading && items.length > 0 ? (
        <LoadingState rows={3} />
      ) : availability.error ? (
        <ErrorState message={availability.error} onRetry={() => void availability.reload()} />
      ) : items.length === 0 ? (
        !results && <EmptyState title="Your borrow list is empty" text="Add available titles from the catalog, then review them here." action={<Link to={ROUTES.student.books} className="btn btn-primary">Browse books</Link>} />
      ) : (
        <div className="stack">
          {items.map((item) => {
            const book = freshBooks.get(item.book.id);
            const availableCopies = book?.availability.availableCopies ?? 0;
            const short = availableCopies < item.quantity;
            const decision = decisions[item.book.id] ?? { borrowQuantity: null, reserveRemainder: false };
            const remainder = item.quantity - (decision.borrowQuantity ?? 0);
            return (
              <article key={item.book.id} className="card card-pad stack">
                <div className="row-actions" style={{ justifyContent: "space-between" }}>
                  <div>
                    <h2>{item.book.title}</h2>
                    <p className="subtle">{item.book.authors.map((author) => author.name).join(", ") || "Unknown author"} · {availableCopies} available now</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(item.book.id)}>Remove</Button>
                </div>
                <div className="form-row">
                  <InputField
                    label="Requested quantity"
                    type="number"
                    min={1}
                    max={LIMITS.MAX_ACTIVE_SAME_TITLE}
                    step={1}
                    value={item.quantity}
                    error={!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > LIMITS.MAX_ACTIVE_SAME_TITLE ? `Enter 1 to ${LIMITS.MAX_ACTIVE_SAME_TITLE} copies.` : null}
                    onChange={(event) => changeQuantity(item.book.id, Number(event.target.value))}
                  />
                  <SelectField label="Borrowing duration" value={item.requestedDurationDays} onChange={(event) => updateItem(item.book.id, { requestedDurationDays: Number(event.target.value) as typeof item.requestedDurationDays })}>
                    {[3, 7, 14, 21, 30, 60].map((days) => <option key={days} value={days}>{days} days</option>)}
                  </SelectField>
                </div>
                {short && (
                  <div className="stack">
                    <Alert kind="warn">You requested {item.quantity}, but only {availableCopies} {availableCopies === 1 ? "copy is" : "copies are"} available. Choose a reduced quantity explicitly; the system will not lower it for you.</Alert>
                    <SelectField
                      label="Copies to request now"
                      value={decision.borrowQuantity ?? ""}
                      onChange={(event) => setDecisions((current) => ({ ...current, [item.book.id]: { ...decision, borrowQuantity: Number(event.target.value) } }))}
                    >
                      <option value="" disabled>Choose a quantity</option>
                      {Array.from({ length: Math.min(item.quantity, availableCopies) + 1 }, (_, quantity) => <option key={quantity} value={quantity}>{quantity} {quantity === 1 ? "copy" : "copies"}</option>)}
                    </SelectField>
                    {decision.borrowQuantity !== null && remainder > 0 && (
                      <CheckboxField
                        label={`Explicitly place one reservation for the remaining ${remainder} ${remainder === 1 ? "copy" : "copies"}`}
                        checked={decision.reserveRemainder}
                        onChange={(event) => setDecisions((current) => ({ ...current, [item.book.id]: { ...decision, reserveRemainder: event.target.checked } }))}
                      />
                    )}
                    {decision.reserveRemainder && remainder > 1 && <p className="subtle">The current reservation workflow queues one copy per title, so additional copies in this remainder cannot be represented.</p>}
                  </div>
                )}
              </article>
            );
          })}
          {items.length > 0 && (
            <div className="row-actions">
              <Button onClick={() => setConfirming(true)} disabled={!canSubmit || submitting}>Submit reviewed list</Button>
              <Link to={ROUTES.student.books} className="btn btn-ghost">Continue browsing</Link>
            </div>
          )}
          {confirming && (
            <ConfirmDialog
              title="Submit your reviewed borrow list?"
              message={`We will submit requests for ${items.map((item) => item.book.title).join(", ")} and any reservations you explicitly selected.`}
              details={items.slice(0, 3).map((item) => ({ label: "Book", value: `${item.book.title} · ${item.quantity} ${item.quantity === 1 ? "copy" : "copies"}` }))}
              confirmLabel="Submit list"
              onClose={() => setConfirming(false)}
              onConfirm={submit}
            />
          )}
        </div>
      )}
    </div>
  );
}