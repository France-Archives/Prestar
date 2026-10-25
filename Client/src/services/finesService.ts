import type {
  CreateFineRequest,
  FineStatus,
  Paginated,
  RecordFinePaymentRequest,
  StaffFine,
  StaffPayment,
  UUID,
  WaiveFineRequest,
} from "@/types";
import { PAYMENT_METHODS } from "@/types";
import { statusLabel } from "@/utils/constants";
import { ApiError, fail, toApiError } from "@/utils/errors";
import { formatPeso, roundMoney } from "@/utils/formatCurrency";
import { apiClient } from "@/services/apiClient";
import { USE_MOCKS } from "@/utils/constants";
import {
  begin,
  recordFine,
  studentName,
  studentRef,
  studentUserId,
  toFineSummary,
  toStaffFine,
} from "./mockEngine";
import { audit, commit, db, matches, newId, notify, nowIso, out, requireAccount, requireCapability } from "./mockStore";

export interface FineListParams {
  status?: FineStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface ServerPage {
  data?: unknown;
  total?: unknown;
  page?: unknown;
  limit?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function idString(value: unknown, label: string): UUID {
  if ((typeof value !== "string" && typeof value !== "number") || !String(value).trim()) {
    throw new ApiError("UNKNOWN", `The Server returned a fine without a valid ${label}.`);
  }
  return String(value);
}

function amountNumber(value: unknown, label: string): number {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount < 0) throw new ApiError("UNKNOWN", `The Server returned an invalid ${label}.`);
  return amount;
}

function mapServerFine(value: unknown): StaffFine {
  if (!isRecord(value)) throw new ApiError("UNKNOWN", "The Server returned an invalid fine.");
  const student = value.student;
  const book = value.book;
  if (!isRecord(student) || !isRecord(book)) throw new ApiError("UNKNOWN", "The Server returned a fine without student or book details.");
  const fineType = value.fineType;
  const fineTypeLabel = value.fineTypeLabel;
  const status = value.status;
  if (typeof fineType !== "string" || typeof fineTypeLabel !== "string"
    || (status !== "Unpaid" && status !== "Paid" && status !== "Waived")) {
    throw new ApiError("UNKNOWN", "The Server returned a fine with invalid type or status.");
  }
  const firstName = student.firstName;
  const lastName = student.lastName;
  const studentNumber = student.studentNumber;
  const bookTitle = typeof book.title === "string" ? book.title : value.bookTitle;
  if (typeof firstName !== "string" || typeof lastName !== "string"
    || typeof studentNumber !== "string" || typeof bookTitle !== "string") {
    throw new ApiError("UNKNOWN", "The Server returned incomplete fine details.");
  }
  const amount = amountNumber(value.amount, "fine amount");
  const paidAmount = amountNumber(value.paidAmount, "paid amount");
  const balance = amountNumber(value.balance, "fine balance");
  if (typeof value.recordedAt !== "string") throw new ApiError("UNKNOWN", "The Server returned a fine without a recording date.");
  const typeMap: Record<string, FineStatus> = {
    Unpaid: "UNPAID",
    Paid: "PAID",
    Waived: "WAIVED",
  };
  return {
    id: idString(value.id ?? value.penaltyId, "ID"),
    penaltyId: idString(value.penaltyId ?? value.id, "penalty ID"),
    loanId: value.borrowId === undefined || value.borrowId === null ? null : String(value.borrowId),
    borrowId: value.borrowId === undefined || value.borrowId === null ? null : String(value.borrowId),
    returnId: value.returnId === undefined || value.returnId === null ? null : String(value.returnId),
    fineType,
    fineTypeLabel,
    amount,
    paidAmount,
    balance,
    status: typeMap[status],
    recordedAt: value.recordedAt,
    student: {
      id: idString(student.id ?? student.userId, "student ID"),
      userId: student.userId === undefined ? undefined : String(student.userId),
      studentNumber,
      firstName,
      lastName,
      email: typeof student.email === "string" ? student.email : undefined,
    },
    bookTitle,
    book: {
      id: idString(book.id, "book ID"),
      title: bookTitle,
      isbn: typeof book.isbn === "string" ? book.isbn : null,
    },
    notes: typeof value.reason === "string" ? value.reason : null,
    waivedAt: typeof value.waivedAt === "string" ? value.waivedAt : null,
    waivedBy: value.waivedBy === undefined || value.waivedBy === null ? null : String(value.waivedBy),
    waiveRemarks: typeof value.waiveRemarks === "string" ? value.waiveRemarks : null,
  };
}

function pageMeta(value: ServerPage): { page: number; pageSize: number; total: number } {
  const page = value.page;
  const pageSize = value.limit;
  const total = value.total;
  if (typeof page !== "number" || !Number.isSafeInteger(page) || page < 1
    || typeof pageSize !== "number" || !Number.isSafeInteger(pageSize) || pageSize < 1
    || typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
    throw new ApiError("UNKNOWN", "The Server returned invalid pagination details.");
  }
  if (pageSize > 100) throw new ApiError("UNKNOWN", "The Server returned an invalid page size.");
  return { page, pageSize, total };
}

function assertPageParams(page: number, pageSize: number, max = 100): void {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > max) {
    fail("VALIDATION_ERROR", `Page must be positive and page size must be from 1 to ${max}.`, 400);
  }
}

async function getLivePage<T>(url: string, params: Record<string, unknown>, map: (row: unknown) => T): Promise<Paginated<T>> {
  try {
    const response = (await apiClient.get<ServerPage>(url, { params })).data;
    if (!isRecord(response) || !Array.isArray(response.data)) {
      throw new ApiError("UNKNOWN", "The Server returned an invalid list.");
    }
    return {
      data: response.data.map(map),
      meta: pageMeta(response),
    };
  } catch (error) {
    throw toApiError(error);
  }
}

function apiFineStatus(status?: FineStatus): string | undefined {
  if (status === "UNPAID") return "Unpaid";
  if (status === "PAID") return "Paid";
  if (status === "WAIVED") return "Waived";
  return undefined;
}

function mockPage<T>(rows: T[], page: number, pageSize: number): Paginated<T> {
  const total = rows.length;
  return { data: rows.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total } };
}

export async function listFinesPage(params: FineListParams = {}): Promise<Paginated<StaffFine>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  assertPageParams(page, pageSize);
  if (!USE_MOCKS) {
    return getLivePage("/fines", {
      ...(apiFineStatus(params.status) ? { status: apiFineStatus(params.status) } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      page,
      limit: pageSize,
    }, mapServerFine);
  }
  const rows = await listFines({ ...params, page, pageSize });
  return mockPage(rows, page, pageSize);
}

/** List endpoint retained for existing mock consumers. */
export async function listFines(params: FineListParams = {}): Promise<StaffFine[]> {
  if (!USE_MOCKS) return (await listFinesPage(params)).data;
  await begin();
  requireCapability("STAFF_AREA");
  return out(db.fines
    .filter((fine) => !params.status || fine.status === params.status)
    .map(toStaffFine)
    .filter((fine) => matches(params.search, fine.student.firstName, fine.student.lastName, fine.student.studentNumber, fine.bookTitle, statusLabel(fine.fineType)))
    .sort((a, b) => (a.balance > 0 ? 0 : 1) - (b.balance > 0 ? 0 : 1) || b.recordedAt.localeCompare(a.recordedAt)));
}

/** Student's own penalties and total outstanding balance. */
export async function getMyPenalties(): Promise<{ fines: StaffFine[]; totalBalance: number; message: string }> {
  if (!USE_MOCKS) {
    try {
      const response = (await apiClient.get<unknown>("/me/penalties")).data;
      if (!isRecord(response) || !Array.isArray(response.data) || typeof response.totalBalance !== "number"
        || !Number.isFinite(response.totalBalance) || response.totalBalance < 0 || typeof response.message !== "string") {
        throw new ApiError("UNKNOWN", "The Server returned invalid student penalty details.");
      }
      return {
        fines: response.data.map(mapServerFine),
        totalBalance: response.totalBalance,
        message: response.message,
      };
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  const account = requireAccount();
  if (!account.student) return out({ fines: [], totalBalance: 0, message: "Please pay in cash at the library counter. The library accepts cash only in full." });
  const fines = db.fines.filter((fine) => fine.studentId === account.student!.id).map(toStaffFine);
  return out({
    fines,
    totalBalance: fines.filter((fine) => fine.status === "UNPAID" || fine.status === "PARTIALLY_PAID").reduce((sum, fine) => sum + fine.balance, 0),
    message: "Please pay in cash at the library counter. The library accepts cash only in full.",
  });
}

/** F1 remains mock-only; live fines are created automatically by Server circulation workflows. */
export async function createFine(loanId: UUID, req: CreateFineRequest): Promise<StaffFine> {
  if (!USE_MOCKS) throw new ApiError("UNSUPPORTED_OPERATION", "Fines are created automatically when a book is returned damaged or marked lost.", 501);
  await begin();
  const staff = requireCapability("FINE_MANAGE");
  const loan = db.loans.find((item) => item.id === loanId);
  if (!loan) fail("NOT_FOUND", "We could not find that loan.");
  if (!req.notes.trim()) fail("VALIDATION_ERROR", "Notes are required to record a fine.", 422);
  if (req.fineType === "LOST_BOOK" && loan.status !== "LOST") fail("INVALID_STATE", "A lost-book fine needs the loan to be marked lost first.", 409);
  if (req.fineType !== "LOST_BOOK" && loan.status === "LOST") fail("INVALID_STATE", "A lost loan can only have a lost-book fine.", 409);
  if (db.fines.some((fine) => fine.loanId === loanId && fine.fineType === req.fineType && fine.status !== "WAIVED")) {
    fail("CONFLICT", "This loan already has a fine of this type.");
  }
  const fine = recordFine(staff, loan, req.fineType, req.notes.trim());
  commit();
  return out(toStaffFine(fine));
}

export async function recordPayment(fineId: UUID, req: RecordFinePaymentRequest): Promise<StaffFine | void> {
  if (!USE_MOCKS) {
    try {
      const receiptNo = req.receiptNo?.trim() || req.referenceNumber?.trim();
      const response = (await apiClient.post<unknown>(`/fines/${fineId}/payments`, {
        amount: req.amount,
        receiptNo,
        ...(req.remarks?.trim() ? { remarks: req.remarks.trim() } : {}),
      })).data;
      if (!isRecord(response) || typeof response.message !== "string"
        || !isRecord(response.payment) || !isRecord(response.fine)) {
        throw new ApiError("UNKNOWN", "The Server returned an invalid payment result.");
      }
      idString(response.payment.id ?? response.payment.paymentId, "payment ID");
      amountNumber(response.payment.amount, "payment amount");
      idString(response.fine.id, "fine ID");
      if (typeof (response.payment.receiptNo ?? response.payment.referenceNumber) !== "string"
        || typeof response.payment.paidAt !== "string"
        || response.payment.paymentMethod !== "Cash"
        || response.fine.status !== "Paid") {
        throw new ApiError("UNKNOWN", "The Server returned an incomplete payment result.");
      }
      amountNumber(response.fine.balance, "fine balance");
      amountNumber(response.fine.paidAmount, "paid amount");
      return;
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  const staff = requireCapability("FINE_MANAGE");
  const fine = db.fines.find((item) => item.id === fineId);
  if (!fine) fail("NOT_FOUND", "We could not find that fine.");
  if (fine.status === "PAID" || fine.status === "WAIVED") fail("INVALID_STATE", "This fine has no balance to pay.", 409);
  if (!PAYMENT_METHODS.includes(req.paymentMethod ?? "CASH")) fail("VALIDATION_ERROR", "Choose a payment method.", 422);
  const { balance } = toFineSummary(fine);
  const amount = roundMoney(Number(req.amount));
  if (!(amount > 0)) fail("VALIDATION_ERROR", "Enter an amount greater than 0.", 422);
  if (amount > balance) fail("VALIDATION_ERROR", `The amount cannot be more than the balance (${formatPeso(balance)}).`, 422);
  db.payments.unshift({
    id: newId(),
    fineId: fine.id,
    amount,
    paymentMethod: req.paymentMethod ?? "CASH",
    referenceNumber: req.receiptNo?.trim() || req.referenceNumber?.trim() || null,
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

function mapServerPayment(value: unknown): StaffPayment {
  if (!isRecord(value) || !isRecord(value.student)) throw new ApiError("UNKNOWN", "The Server returned an invalid payment.");
  const student = value.student;
  const id = value.id ?? value.paymentId;
  const fineId = value.fineId ?? value.penaltyId;
  const receiptNo = value.receiptNo ?? value.referenceNumber;
  if (typeof student.firstName !== "string" || typeof student.lastName !== "string"
    || typeof student.studentNumber !== "string" || typeof value.fineType !== "string"
    || typeof value.fineTypeLabel !== "string" || typeof value.bookTitle !== "string"
    || typeof value.paidAt !== "string" || typeof receiptNo !== "string" || typeof value.recordedByName !== "string") {
    throw new ApiError("UNKNOWN", "The Server returned incomplete payment details.");
  }
  return {
    id: idString(id, "payment ID"),
    fineId: idString(fineId, "fine ID"),
    amount: amountNumber(value.amount, "payment amount"),
    paymentMethod: "CASH",
    referenceNumber: receiptNo,
    receiptNo,
    paidAt: value.paidAt,
    recordedByUserId: idString(value.recordedByUserId, "receiver ID"),
    recordedByName: value.recordedByName,
    fineType: value.fineType,
    fineTypeLabel: value.fineTypeLabel,
    bookTitle: value.bookTitle,
    remarks: typeof value.remarks === "string" ? value.remarks : null,
    student: {
      id: idString(student.id ?? student.userId, "student ID"),
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName,
    },
  };
}

export async function listPaymentsPage(params: { search?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<StaffPayment>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  assertPageParams(page, pageSize);
  if (!USE_MOCKS) {
    return getLivePage("/fines/payments", {
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      page,
      limit: pageSize,
    }, mapServerPayment);
  }
  const rows = await listPayments(params);
  return mockPage(rows, page, pageSize);
}

/** Mock payment history retained for demo-mode consumers. */
export async function listPayments(params: { search?: string; page?: number; pageSize?: number } = {}): Promise<StaffPayment[]> {
  if (!USE_MOCKS) return (await listPaymentsPage(params)).data;
  await begin();
  requireCapability("STAFF_AREA");
  return out(db.payments
    .map((payment): StaffPayment => {
      const fine = db.fines.find((item) => item.id === payment.fineId);
      if (!fine) fail("INVALID_STATE", "Payment without a fine.", 409);
      return {
        ...payment,
        student: studentRef(fine.studentId),
        fineType: fine.fineType,
        fineTypeLabel: statusLabel(fine.fineType),
        bookTitle: toStaffFine(fine).bookTitle,
        receiptNo: payment.referenceNumber,
        recordedByName: db.accounts.find((account) => account.user.id === payment.recordedByUserId)?.displayName ?? "Unknown",
      };
    })
    .filter((payment) => matches(params.search, payment.student.firstName, payment.student.lastName, payment.student.studentNumber, payment.referenceNumber, payment.recordedByName))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt)));
}

export async function waiveFine(fineId: UUID, req: WaiveFineRequest): Promise<StaffFine> {
  if (!USE_MOCKS) {
    try {
      const response = (await apiClient.post<unknown>(`/fines/${fineId}/waive`, { reason: req.reason.trim() })).data;
      if (!isRecord(response) || typeof response.message !== "string" || !isRecord(response.fine)) {
        throw new ApiError("UNKNOWN", "The Server returned an invalid waiver result.");
      }
      return mapServerFine(response.fine);
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  const staff = requireCapability("FINE_MANAGE");
  const fine = db.fines.find((item) => item.id === fineId);
  if (!fine) fail("NOT_FOUND", "We could not find that fine.");
  if (fine.status === "PAID" || fine.status === "WAIVED") fail("INVALID_STATE", "Only an unpaid fine can be waived.", 409);
  if (!req.reason.trim()) fail("VALIDATION_ERROR", "A reason is required to waive a fine.", 422);
  fine.status = "WAIVED";
  fine.notes = `${fine.notes ? `${fine.notes} ` : ""}Waived: ${req.reason.trim()}`;
  notify(studentUserId(fine.studentId), "GENERAL", "Fine waived", `Your ${statusLabel(fine.fineType).toLowerCase()} fine was waived.`, ["FINE", fine.id]);
  audit(staff, "FINE_WAIVED", "FINE", fine.id, `Waived the ${formatPeso(fine.amount)} ${statusLabel(fine.fineType).toLowerCase()} fine of ${studentName(fine.studentId)}: ${req.reason.trim()}`);
  commit();
  return out(toStaffFine(fine));
}

export async function getUnpaidFineById(fineId: UUID): Promise<StaffFine | null> {
  if (!USE_MOCKS) {
    const first = await listFinesPage({ status: "UNPAID", page: 1, pageSize: 100 });
    const match = first.data.find((fine) => fine.id === fineId);
    if (match || first.data.length >= first.meta.total) return match ?? null;
    for (let page = 2; page <= Math.ceil(first.meta.total / first.meta.pageSize); page += 1) {
      const result = await listFinesPage({ status: "UNPAID", page, pageSize: 100 });
      const found = result.data.find((fine) => fine.id === fineId);
      if (found) return found;
    }
    return null;
  }
  return (await listFines({ status: "UNPAID" })).find((fine) => fine.id === fineId) ?? null;
}
