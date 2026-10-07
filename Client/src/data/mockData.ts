import type { Book, BookCopy, Category, Database, User } from "../types";
import { nowIso, todayStr } from "../utils/dates";

// MOCK DATA — REPLACE WITH API FETCH LATER
// Table and column names follow the ERD. Demo password for every account: password123
const pad = (n: number) => String(n).padStart(2, "0");

// [title, author, category_id, color, year_published, price, description]
// `color` is a UI-only placeholder for the cover (not a DB column; the DB has cover_image).
type BookRow = [string, string, number, string, number, number, string];
const BOOK_ROWS: BookRow[] = [
  ["Atomic Habits", "James Clear", 1, "#3F566B", 2018, 450, "A practical framework for building good habits and breaking bad ones through tiny, consistent changes that compound over time."],
  ["The Midnight Library", "Matt Haig", 2, "#5E4A6B", 2020, 380, "Between life and death is a library where every book is a different life. Nora must choose which one is truly worth living."],
  ["Introduction to Algorithms", "Thomas H. Cormen", 3, "#B98A4A", 2022, 2800, "The definitive reference on algorithms, covering design, analysis and implementation with rigorous mathematical treatment."],
  ["The Design of Everyday Things", "Don Norman", 4, "#8A4B45", 2013, 520, "A landmark study of how design serves people, and why well-designed objects feel effortless to use."],
  ["Deep Work", "Cal Newport", 5, "#37444D", 2016, 420, "Rules for focused success in a distracted world, and how to cultivate the ability to concentrate without distraction."],
  ["Clean Code", "Robert C. Martin", 3, "#07352C", 2008, 1100, "A handbook of agile software craftsmanship that teaches how to write readable, maintainable code."],
  ["Thinking, Fast and Slow", "Daniel Kahneman", 1, "#6B4A3C", 2011, 600, "A tour of the two systems that drive the way we think, and the biases that shape our judgments and decisions."],
  ["The Pragmatic Programmer", "David Thomas", 3, "#0B3D32", 2019, 950, "Timeless lessons for developers who want to grow from journeyman to master craftsperson."],
  ["Sapiens", "Yuval Noah Harari", 6, "#6F566E", 2015, 550, "A sweeping history of humankind, from the Stone Age to the modern age of technology."],
  ["The Creative Act", "Rick Rubin", 4, "#C4B08A", 2023, 700, "A meditation on the creative process and how to live in a way that nurtures the work."],
  ["Educated", "Tara Westover", 7, "#A56A4F", 2018, 480, "A memoir of a young woman who leaves her survivalist family and earns a PhD from Cambridge."],
  ["The Psychology of Money", "Morgan Housel", 8, "#5F7A66", 2020, 420, "Timeless lessons on wealth, greed and happiness, told through short stories about how people think about money."],
];

const books: Book[] = BOOK_ROWS.map(
  ([title, author, category_id, color, year_published, price, description], i): Book => ({
    book_id: i + 1,
    category_id,
    isbn: `978-0-00-0000${pad(i + 1)}`,
    title,
    author,
    publisher: null,
    year_published,
    edition: null,
    description,
    cover_image: null,
    shelf_location: `S-${pad(i + 1)}`,
    price,
    status: "Active",
    color,
    created_at: nowIso(-90),
    updated_at: nowIso(-90),
  }),
);

const COPY_COUNTS = [2, 2, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1];
let copyId = 0;
const copies: BookCopy[] = BOOK_ROWS.flatMap((_, i) =>
  Array.from(
    { length: COPY_COUNTS[i] },
    (__, n): BookCopy => ({
      copy_id: ++copyId,
      book_id: i + 1,
      accession_no: `PR-${pad(i + 1)}-${n + 1}`,
      condition_status: "Good",
      status: "Available",
      created_at: nowIso(-60),
    }),
  ),
);

const copy = (accessionNo: string): BookCopy => {
  const c = copies.find((x) => x.accession_no === accessionNo);
  if (!c) throw new Error(`Seed copy ${accessionNo} not found`);
  return c;
};
copy("PR-01-1").status = "Borrowed"; // Ana's loan
copy("PR-04-1").status = "Borrowed"; // Carla's overdue loan (the only copy of that title)
Object.assign(copy("PR-06-2"), { status: "Maintenance", condition_status: "Damaged" });

const student = (user_id: number, student_id: string, first_name: string, last_name: string, email: string): User => ({
  user_id,
  student_id,
  first_name,
  last_name,
  email,
  password_hash: "password123",
  role: "Student",
  status: "Active",
  manual_verified_until: null,
  created_at: nowIso(-120),
  updated_at: nowIso(-120),
});

const CATEGORY_ROWS: [number, string][] = [
  [1, "Psychology"],
  [2, "Fiction"],
  [3, "Computer Science"],
  [4, "Design"],
  [5, "Productivity"],
  [6, "History"],
  [7, "Literature"],
  [8, "Business"],
];

export const SEED: Database = {
  // Owned by the university. READ-ONLY for PRESTAR (the app never writes to this table).
  university_students: [
    { student_id: "2024-00101", first_name: "Ana", last_name: "Reyes", email: "ana@university.edu", course: "BS Computer Science", year_level: 3, enrollment_status: "Enrolled" },
    { student_id: "2024-00102", first_name: "Ben", last_name: "Lim", email: "ben@university.edu", course: "BS Information Technology", year_level: 2, enrollment_status: "Enrolled" },
    { student_id: "2023-00087", first_name: "Carla", last_name: "Diaz", email: "carla@university.edu", course: "BS Education", year_level: 4, enrollment_status: "Enrolled" },
    { student_id: "2019-00045", first_name: "Dan", last_name: "Uy", email: "dan@university.edu", course: "BS Business Administration", year_level: 4, enrollment_status: "Graduated" },
    { student_id: "2025-00999", first_name: "Zed", last_name: "Ramos", email: "zed@university.edu", course: "BS Computer Science", year_level: 1, enrollment_status: "Enrolled" },
  ],
  users: [
    { user_id: 1, student_id: null, first_name: "Mia", last_name: "Santos", email: "admin@university.edu", password_hash: "password123", role: "Admin", status: "Active", manual_verified_until: null, created_at: nowIso(-200), updated_at: nowIso(-200) },
    { user_id: 2, student_id: null, first_name: "Leo", last_name: "Cruz", email: "librarian@university.edu", password_hash: "password123", role: "Librarian", status: "Active", manual_verified_until: null, created_at: nowIso(-200), updated_at: nowIso(-200) },
    student(3, "2024-00101", "Ana", "Reyes", "ana@university.edu"),
    student(4, "2024-00102", "Ben", "Lim", "ben@university.edu"),
    student(5, "2023-00087", "Carla", "Diaz", "carla@university.edu"),
    student(6, "2019-00045", "Dan", "Uy", "dan@university.edu"),
    { ...student(7, "", "Pia", "Lopez", "pia@university.edu"), student_id: null, manual_verified_until: todayStr(60) }, // provisional
  ],
  signups: [
    { signup_id: 1, reference_no: `APP-${new Date().getFullYear()}-0001`, student_id: null, submitted_student_no: null, first_name: "Rico", last_name: "Tan", email: "rico@university.edu", password_hash: "password123", submitted_course: "BS Information Technology", submitted_year_level: 2, student_type: "Transferee", previous_school: "Other University", match_status: "Unmatched", verification_type: "Manual", email_verified_at: nowIso(-2), proof_file: "cor-rico.pdf", status: "For Review", submitted_at: nowIso(-2), reviewed_by: null, reviewed_at: null, remarks: null, created_user_id: null },
  ],
  signup_verifications: [
    { verification_id: 1, signup_id: 1, actor_id: null, action: "Submitted", remarks: null, action_date: nowIso(-2) },
  ],
  categories: CATEGORY_ROWS.map(([category_id, category_name]): Category => ({ category_id, category_name, description: null })),
  books,
  book_copies: copies,
  borrow_requests: [
    { request_id: 1, user_id: 3, book_id: 1, request_date: nowIso(-4), pickup_deadline: nowIso(-2), status: "Issued", reviewed_by: 2, reviewed_at: nowIso(-4), remarks: null },
    { request_id: 2, user_id: 5, book_id: 4, request_date: nowIso(-14), pickup_deadline: nowIso(-12), status: "Issued", reviewed_by: 2, reviewed_at: nowIso(-14), remarks: null },
    { request_id: 3, user_id: 4, book_id: 2, request_date: nowIso(-1), pickup_deadline: null, status: "Pending", reviewed_by: null, reviewed_at: null, remarks: null },
    { request_id: 4, user_id: 3, book_id: 3, request_date: nowIso(-1), pickup_deadline: nowIso(2), status: "Approved", reviewed_by: 2, reviewed_at: nowIso(0), remarks: null },
  ],
  reservations: [
    { reservation_id: 1, user_id: 4, book_id: 4, reservation_date: nowIso(-1), ready_at: null, expires_at: null, status: "Waiting", closed_at: null, remarks: null },
  ],
  borrowed_books: [
    { borrow_id: 1, request_id: 1, reservation_id: null, user_id: 3, book_id: 1, copy_id: copy("PR-01-1").copy_id, borrow_date: nowIso(-3), due_date: todayStr(4), renewal_count: 0, status: "Borrowed", issued_by: 2, lost_at: null },
    { borrow_id: 2, request_id: 2, reservation_id: null, user_id: 5, book_id: 4, copy_id: copy("PR-04-1").copy_id, borrow_date: nowIso(-12), due_date: todayStr(-5), renewal_count: 0, status: "Borrowed", issued_by: 2, lost_at: null },
  ],
  returned_books: [],
  penalties: [],
  suspensions: [],
};