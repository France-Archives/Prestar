import type { NotificationItem, NotificationType, RelatedEntityType, UUID } from "@/types";
import { formatDate } from "@/utils/formatDate";
import { borrowingRequestId, loanId } from "./mockBorrowings";
import { fineId } from "./mockFines";
import { NS, at, uid } from "./mockHelpers";
import { reservationId } from "./mockReservations";
import { USER_ID } from "./mockUsers";
import { verificationId } from "./mockVerifications";

// TEMPORARY MOCK IMPLEMENTATION: fake notifications and read/unread statuses.
// Replace with real notification API responses (S6 to S8). In the real system the BACKEND creates notifications
// only after the business transaction commits. Titles are proposed (TC-20).
// userId = users.id (owner of the notification). Staff receive COR_SUBMITTED in their own feed.

export type MockNotification = NotificationItem & { userId: UUID };

let seq = 0;
function note(
  userId: UUID,
  type: NotificationType,
  title: string,
  message: string,
  related: [RelatedEntityType, UUID] | null,
  days: number,
  hours: number,
  read: boolean,
): MockNotification {
  const createdAt = at(days, hours);
  return {
    id: uid(NS.notification, ++seq),
    userId,
    type,
    title,
    message,
    relatedEntityType: related ? related[0] : null,
    relatedEntityId: related ? related[1] : null,
    readAt: read ? createdAt : null,
    createdAt,
  };
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  // Ana
  note(USER_ID.ana, "LOAN_ISSUED", "Book issued", "You borrowed Atomic Habits. It is due on " + formatDate(at(2)) + ".", ["LOAN", loanId(1)], -5, 0, true),
  note(USER_ID.ana, "RENEWAL_APPROVED", "Renewal approved", "Your renewal for The Pragmatic Programmer was approved. New due date: " + formatDate(at(13)) + ".", ["LOAN", loanId(7)], -1, 0, true),
  note(USER_ID.ana, "DUE_SOON", "Due soon", "Atomic Habits is due on " + formatDate(at(2)) + ".", ["LOAN", loanId(1)], -0, -2, false),
  note(USER_ID.ana, "RESERVATION_OFFERED", "A copy is ready", "A copy of Thinking, Fast and Slow is held for you until " + formatDate(at(2)) + ".", ["RESERVATION", reservationId(3)], -1, 0, false),
  // Ben
  note(USER_ID.ben, "BORROW_REQUEST_APPROVED", "Request approved", "Your request for The Midnight Library was approved. Pick it up by " + formatDate(at(2)) + " at the library.", ["BORROWING_REQUEST", borrowingRequestId(8)], -1, 0, false),
  note(USER_ID.ben, "RESERVATION_CONFIRMED", "Reservation confirmed", "You are in the reservation queue for The Design of Everyday Things. We will notify you when a copy is offered.", ["RESERVATION", reservationId(2)], -2, 0, true),
  note(USER_ID.ben, "COR_SUBMITTED", "COR submitted", "Your COR was submitted and is awaiting review.", ["STUDENT_VERIFICATION", verificationId(5)], -2, 0, true),
  note(USER_ID.ben, "HANDOVER_REJECTED", "Handover not possible", "The library could not release Deep Work: Copy barcode does not match. Contact the library for next steps.", ["BORROWING_REQUEST", borrowingRequestId(12)], -6, 0, true),
  // Carla
  note(USER_ID.carla, "OVERDUE_RESTRICTION", "Borrowing restricted", "A loan is more than 3 days overdue. Return it to borrow again.", ["LOAN", loanId(2)], -1, 0, false),
  note(USER_ID.carla, "BORROW_REQUEST_ON_HOLD", "Pickup on hold", "Your pickup is on hold: Overdue loan to resolve. Please resolve this with the library before " + formatDate(at(1)) + ".", ["BORROWING_REQUEST", borrowingRequestId(9)], -1, -3, false),
  note(USER_ID.carla, "FINE_RECORDED", "Fine recorded", "A fine of ₱100.00 was recorded for Minor damage. Pay it in person at the library.", ["FINE", fineId(1)], -42, 0, true),
  // Felix
  note(USER_ID.felix, "ACCOUNT_SUSPENDED", "Account suspended", "Your account is suspended. You cannot start new borrowing until it is reactivated.", ["USER", USER_ID.felix], -8, 0, false),
  note(USER_ID.felix, "FINE_PAYMENT_RECORDED", "Payment recorded", "A payment of ₱300.00 was recorded. Remaining balance: ₱200.00.", ["FINE", fineId(2)], -20, 0, true),
  // Gina
  note(USER_ID.gina, "COR_REJECTED", "COR not approved", "Your COR was not approved. Reason: The image is blurry and the course codes are unreadable. Upload a corrected document for review.", ["STUDENT_VERIFICATION", verificationId(8)], -4, 0, true),
  note(USER_ID.gina, "COR_SUBMITTED", "COR submitted", "Your COR was submitted and is awaiting review.", ["STUDENT_VERIFICATION", verificationId(9)], -1, 0, false),
  // Dan and Ella
  note(USER_ID.dan, "EMAIL_VERIFIED", "Email verified", "Your email has been verified. Submit an approved COR for the current term before borrowing.", ["USER", USER_ID.dan], -70, 0, true),
  note(USER_ID.ella, "EMAIL_VERIFICATION_REQUIRED", "Verify your email", "Verify your email to activate your account.", ["USER", USER_ID.ella], -1, 0, false),
  // Staff feed: Admin and Librarians with COR_REVIEW are notified of new CORs
  note(USER_ID.leo, "COR_SUBMITTED", "COR awaiting review", "A student COR submission is waiting for review.", ["STUDENT_VERIFICATION", verificationId(9)], -1, 0, false),
  note(USER_ID.leo, "COR_SUBMITTED", "COR awaiting review", "A student COR submission is waiting for review.", ["STUDENT_VERIFICATION", verificationId(5)], -2, 0, false),
  note(USER_ID.admin, "COR_SUBMITTED", "COR awaiting review", "A student COR submission is waiting for review.", ["STUDENT_VERIFICATION", verificationId(9)], -1, 0, false),
  note(USER_ID.admin, "COR_SUBMITTED", "COR awaiting review", "A student COR submission is waiting for review.", ["STUDENT_VERIFICATION", verificationId(5)], -2, 0, false),
];