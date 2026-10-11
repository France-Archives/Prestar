import type { ISODateTime, UUID } from "./api";
import type { FineType, PaymentMethod } from "./enums";
import type { StudentRef } from "./user";

// fine_payments -> FinePayment (derived, staff). Payments are in person, recorded by staff only.
export interface FinePayment {
  id: UUID;
  fineId: UUID;
  amount: number; // > 0 and <= balance
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  paidAt: ISODateTime;
  recordedByUserId: UUID;
}

/** Payment record joined for the staff payment history list. */
export interface StaffPayment extends FinePayment {
  student: StudentRef;
  fineType: FineType;
  recordedByName: string;
}

/** F2 POST /staff/fines/:fineId/payments */
export interface RecordFinePaymentRequest {
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
}