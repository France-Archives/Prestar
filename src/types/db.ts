// Row types for prestar_db (12 tables) + university_db.students (read-only).
// Names and values come from the ERD and the Final System Design Document (Part 9).
// DATETIME columns are ISO strings. DATE columns (due_date, end_date, start_date, manual_verified_until) are "YYYY-MM-DD".

export type UserRole = "Student" | "Librarian" | "Admin";
export type UserStatus = "Active" | "Inactive";
export type EnrollmentStatus = "Enrolled" | "Graduated" | "Dropped" | "LOA";

export type StudentType = "Regular" | "Transferee" | "Returnee" | "Other";
export type MatchStatus = "Matched" | "Unmatched";
export type VerificationType = "Auto" | "Manual";
export type SignupStatus = "Pending" | "For Review" | "Needs Info" | "Approved" | "Rejected";
export type VerificationAction = "Submitted" | "Info Requested" | "Resubmitted" | "Approved" | "Rejected";

export type BookStatus = "Active" | "Archived";
export type CopyStatus = "Available" | "Borrowed" | "Maintenance" | "Lost";
export type ConditionStatus = "Good" | "Damaged";

export type RequestStatus = "Pending" | "Approved" | "Issued" | "Rejected" | "Cancelled" | "Expired";
export type ReservationStatus = "Waiting" | "Ready" | "Fulfilled" | "Cancelled" | "Expired";
export type LoanStatus = "Borrowed" | "Returned" | "Lost"; // Overdue is derived, never stored

export type PenaltyType = "Overdue" | "Damaged" | "Lost";
export type PenaltyStatus = "Unpaid" | "Paid" | "Waived";
export type SuspensionReason = "Violation" | "Lost Book" | "Damaged Book" | "Other";
export type SuspensionStatus = "Active" | "Lifted";

// Owned by the university. PRESTAR never writes to this table.
export interface UniversityStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  course: string;
  year_level: number;
  enrollment_status: EnrollmentStatus;
}

export interface User {
  user_id: number;
  student_id: string | null; // logical link to university_db, no FK
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  manual_verified_until: string | null;
  created_at: string;
  updated_at: string;
}

// What the browser is allowed to hold: a user without the password hash.
export type PublicUser = Omit<User, "password_hash">;

export interface Signup {
  signup_id: number;
  reference_no: string;
  student_id: string | null;
  submitted_student_no: string | null;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  submitted_course: string | null;
  submitted_year_level: number | null;
  student_type: StudentType;
  previous_school: string | null;
  match_status: MatchStatus;
  verification_type: VerificationType;
  email_verified_at: string | null;
  proof_file: string | null;
  status: SignupStatus;
  submitted_at: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  remarks: string | null;
  created_user_id: number | null;
}

export interface SignupVerification {
  verification_id: number;
  signup_id: number;
  actor_id: number | null;
  action: VerificationAction;
  remarks: string | null;
  action_date: string;
}

export interface Category {
  category_id: number;
  category_name: string;
  description: string | null;
}

export interface Book {
  book_id: number;
  category_id: number;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  year_published: number | null;
  edition: string | null;
  description: string | null;
  cover_image: string | null;
  shelf_location: string | null;
  price: number | null;
  status: BookStatus;
  color: string; // UI-only placeholder cover colour. NOT a database column.
  created_at: string;
  updated_at: string;
}

export interface BookCopy {
  copy_id: number;
  book_id: number;
  accession_no: string;
  condition_status: ConditionStatus;
  status: CopyStatus;
  created_at: string;
}

export interface BorrowRequest {
  request_id: number;
  user_id: number;
  book_id: number;
  request_date: string;
  pickup_deadline: string | null;
  status: RequestStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  remarks: string | null;
}

export interface Reservation {
  reservation_id: number;
  user_id: number;
  book_id: number;
  reservation_date: string;
  ready_at: string | null;
  expires_at: string | null;
  status: ReservationStatus;
  closed_at: string | null;
  remarks: string | null;
}

export interface BorrowedBook {
  borrow_id: number;
  request_id: number | null;
  reservation_id: number | null;
  user_id: number;
  book_id: number;
  copy_id: number;
  borrow_date: string;
  due_date: string;
  renewal_count: number;
  status: LoanStatus;
  issued_by: number;
  lost_at: string | null;
}

export interface ReturnedBook {
  return_id: number;
  borrow_id: number;
  received_by: number;
  return_date: string;
  condition_status: ConditionStatus;
  days_overdue: number;
  remarks: string | null;
}

export interface Penalty {
  penalty_id: number;
  borrow_id: number;
  user_id: number;
  penalty_type: PenaltyType;
  amount: number;
  status: PenaltyStatus;
  created_at: string;
  created_by: number;
  paid_at: string | null;
  received_by: number | null;
  receipt_no: string | null;
  waived_by: number | null;
  waived_at: string | null;
  waive_remarks: string | null;
  remarks: string | null;
}

export interface Suspension {
  suspension_id: number;
  user_id: number;
  borrow_id: number | null;
  reason_type: SuspensionReason;
  reason_details: string;
  suspended_by: number;
  start_date: string;
  end_date: string | null;
  status: SuspensionStatus;
  lifted_by: number | null;
  lifted_at: string | null;
  lift_remarks: string | null;
}

// The whole mock database: one array per table.
export interface Database {
  university_students: UniversityStudent[];
  users: User[];
  signups: Signup[];
  signup_verifications: SignupVerification[];
  categories: Category[];
  books: Book[];
  book_copies: BookCopy[];
  borrow_requests: BorrowRequest[];
  reservations: Reservation[];
  borrowed_books: BorrowedBook[];
  returned_books: ReturnedBook[];
  penalties: Penalty[];
  suspensions: Suspension[];
}