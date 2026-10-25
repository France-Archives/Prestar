import type { ISODateTime, UUID } from "./api";
import type { FineType, PaymentMethod } from "./enums";
import type { StudentRef } from "./user";

// fine_payments -> FinePayment (derived, staff). Payments are in person, recorded by staff only.
export interface FinePayment {
  id: UUID;
  fineId: UUID;
  amount: number; // Live payments must equal the full unpaid fine amount.
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  paidAt: ISODateTime;
  recordedByUserId: UUID;
}

/** Payment record joined for the staff payment history list. */
export interface StaffPayment extends FinePayment {
  student: StudentRef;
  fineType: FineType | string;
  recordedByName: string;
  receiptNo?: string | null;
  bookTitle?: string | null;
  fineTypeLabel?: string;
  remarks?: string | null;
}

/** POST /api/fines/:id/payments. Live payments are cash-only and full-amount. */
export interface RecordFinePaymentRequest {
  amount: number;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string | null;
  receiptNo?: string;
  remarks?: string | null;
}