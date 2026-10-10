import type { CreateFineRequest, FineStatus, RecordFinePaymentRequest, StaffFine, StaffPayment, UUID, WaiveFineRequest } from "@/types";
import { PAYMENT_METHODS } from "@/types";
import { statusLabel } from "@/utils/constants";
import { fail } from "@/utils/errors";
import { formatPeso, roundMoney } from "@/utils/formatCurrency";
import { begin, recordFine, studentName, studentRef, studentUserId, toFineSummary, toStaffFine } from "./mockEngine";
import { audit, commit, db, matches, newId, notify, nowIso, out, requireCapability } from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real fines/payment API (F1, F2, P10, P11).
// Payments are made IN PERSON and recorded by staff only. Nothing here moves money. Fine amounts (₱100 / ₱200 / ₱500)
// are chosen by the server, never sent by the client. There is NO student "My Fines" page: students see fines
// only through notifications. Viewing fines is a staff capability; assessing and recording payments needs
// FINE_PAYMENT (Admin always passes). Waiving is Admin only and audited (workflow TO CONFIRM, TC-15).

/** P10 GET /staff/fines (proposed) */
export async function listFines(params: { status?: FineStatus; search?: string } = {}): Promise<StaffFine[]> {
  await begin();
  requireCapability("STAFF_AREA");
  const rows = db.fines
    .filter((f) => !params.status || f.status === params.status)
    .map(toStaffFine)
    .filter((f) => matches(params.search, f.student.firstName, f.student.lastName, f.student.studentNumber, f.bookTitle, statusLabel(f.fineType)))
    .sort((a, b) => (a.balance > 0 ? 0 : 1) - (b.balance > 0 ? 0 : 1) || b.recordedAt.localeCompare(a.recordedAt));
  return out(rows);
}

/** F1 POST /staff/loans/:loanId/fines. Amount is chosen by the server. */
export async function createFine(loanId: UUID, req: CreateFineRequest): Promise<StaffFine> {
  await begin();
  const staff = requireCapability("FINE_MANAGE");
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) fail("NOT_FOUND", "We could not find that loan.");
  if (!req.notes.trim()) fail("VALIDATION_ERROR", "Notes are required to record a fine.", 422);
  if (req.fineType === "LOST_BOOK" && loan.status !== "LOST") fail("INVALID_STATE", "A lost-book fine needs the loan to be marked lost first.", 409);
  if (req.fineType !== "LOST_BOOK" && loan.status === "LOST") fail("INVALID_STATE", "A lost loan can only have a lost-book fine.", 409);
  if (db.fines.some((f) => f.loanId === loanId && f.fineType === req.fineType && f.status !== "WAIVED")) {
    fail("CONFLICT", "This loan already has a fine of this type.");
  }
  const fine = recordFine(staff, loan, req.fineType, req.notes.trim());
  commit();
  return out(toStaffFine(fine));
}

/** F2 POST /staff/fines/:fineId/payments. Amount must be > 0 and <= the balance. */
export async function recordPayment(fineId: UUID, req: RecordFinePaymentRequest): Promise<StaffFine> {
  await begin();
  const staff = requireCapability("FINE_MANAGE");
  const fine = db.fines.find((f) => f.id === fineId);
  if (!fine) fail("NOT_FOUND", "We could not find that fine.");
  if (fine.status === "PAID" || fine.status === "WAIVED") fail("INVALID_STATE", "This fine has no balance to pay.", 409);
  if (!PAYMENT_METHODS.includes(req.paymentMethod)) fail("VALIDATION_ERROR", "Choose a payment method.", 422);
  const { balance } = toFineSummary(fine);
  const amount = roundMoney(Number(req.amount));
  if (!(amount > 0)) fail("VALIDATION_ERROR", "Enter an amount greater than 0.", 422);
  if (amount > balance) fail("VALIDATION_ERROR", `The amount cannot be more than the balance (${formatPeso(balance)}).`, 422);

  db.payments.unshift({
    id: newId(),
    fineId: fine.id,
    amount,
    paymentMethod: req.paymentMethod,
    referenceNumber: req.referenceNumber?.trim() || null,
    paidAt: nowIso(),
    recordedByUserId: staff.user.id,
  });
  const remaining = roundMoney(balance - amount);
  fine.status = remaining === 0 ? "PAID" : "PARTIALLY_PAID";
  notify(studentUserId(fine.studentId), "FINE_PAYMENT_RECORDED", "Payment recorded", `A payment of ${formatPeso(amount)} was recorded. Remaining balance: ${formatPeso(remaining)}.`, ["FINE", fine.id]);
  audit(staff, "FINE_PAYMENT_RECORDED", "FINE", fine.id, `Recorded a ${formatPeso(amount)} in-person payment from ${studentName(fine.studentId)}.`);
  commit();
  return out(toStaffFine(fine));
}

/** Payment history for the staff payment page. No list endpoint exists in the source: derived, TO CONFIRM. */
export async function listPayments(params: { search?: string } = {}): Promise<StaffPayment[]> {
  await begin();
  requireCapability("STAFF_AREA");
  const rows = db.payments
    .map((p): StaffPayment => {
      const fine = db.fines.find((f) => f.id === p.fineId);
      if (!fine) fail("INVALID_STATE", "Payment without a fine.", 409);
      return {
        ...p,
        student: studentRef(fine.studentId),
        fineType: fine.fineType,
        recordedByName: db.accounts.find((a) => a.user.id === p.recordedByUserId)?.displayName ?? "Unknown",
      };
    })
    .filter((p) => matches(params.search, p.student.firstName, p.student.lastName, p.student.studentNumber, p.referenceNumber, p.recordedByName))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  return out(rows);
}

/** P11 POST /staff/fines/:fineId/waive (proposed). Admin only, audited. */
export async function waiveFine(fineId: UUID, req: WaiveFineRequest): Promise<StaffFine> {
  await begin();
  const admin = requireCapability("FINE_WAIVE");
  const fine = db.fines.find((f) => f.id === fineId);
  if (!fine) fail("NOT_FOUND", "We could not find that fine.");
  if (fine.status === "PAID" || fine.status === "WAIVED") fail("INVALID_STATE", "Only a fine with an unpaid balance can be waived.", 409);
  if (!req.reason.trim()) fail("VALIDATION_ERROR", "A reason is required to waive a fine.", 422);
  fine.status = "WAIVED";
  fine.notes = `${fine.notes ? `${fine.notes} ` : ""}Waived: ${req.reason.trim()}`;
  notify(studentUserId(fine.studentId), "GENERAL", "Fine waived", `Your ${statusLabel(fine.fineType).toLowerCase()} fine was waived.`, ["FINE", fine.id]);
  audit(admin, "FINE_WAIVED", "FINE", fine.id, `Waived the ${formatPeso(fine.amount)} ${statusLabel(fine.fineType).toLowerCase()} fine of ${studentName(fine.studentId)}: ${req.reason.trim()}`);
  commit();
  return out(toStaffFine(fine));
}