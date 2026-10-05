import ConfirmDialog from "./ConfirmDialog";
import { useAuthedLibrary } from "../context/LibraryContext";
import { useBusy } from "../hooks/useBusy";
import * as api from "../services/api";
import type { Book, BorrowedBook } from "../types";
import { CONFIG } from "../utils/constants";
import { addDaysToDate, fmtDate } from "../utils/dates";

type RenewDialogProps = { loan: BorrowedBook; book: Book; onClose: () => void };

export default function RenewDialog({ loan, book, onClose }: RenewDialogProps) {
  const { user, act } = useAuthedLibrary();
  const [busy, wrap] = useBusy();
  const newDue = addDaysToDate(loan.due_date, CONFIG.RENEWAL_DAYS);

  const confirm = wrap(async () => {
    const res = await act(api.renewLoan(user.user_id, loan.borrow_id), `Renewed. New due date: ${fmtDate(newDue)}.`);
    if (res.ok) onClose();
  });

  return (
    <ConfirmDialog title="Renew this book?" confirmLabel="Renew" busy={busy} onConfirm={confirm} onClose={onClose}>
      <p><b>{book.title}</b></p>
      <p>Current due date: {fmtDate(loan.due_date)}</p>
      <p>New due date: <b>{fmtDate(newDue)}</b></p>
    </ConfirmDialog>
  );
}