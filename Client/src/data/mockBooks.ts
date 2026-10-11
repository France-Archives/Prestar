import type { AuthorSummary, BookCopy, BookDetail, CategorySummary, UUID } from "@/types";
import { NS, uid } from "./mockHelpers";

// TEMPORARY MOCK IMPLEMENTATION: fake book, author, category and copy records.
// Replace with the real Books API (C1 to C7). Availability, category and authors are JOINED/COMPUTED by the
// service, never stored here, so they stay correct when copies change.

export type MockBook = Omit<BookDetail, "category" | "authors" | "availability"> & {
  categoryId: UUID | null;
  authorIds: UUID[]; // order = author_order
};

const CATEGORY_NAMES = [
  "Psychology",
  "Fiction",
  "Computer Science",
  "Design",
  "Productivity",
  "History",
  "Literature",
  "Business",
  "Information Technology",
  "Mathematics and Statistics",
  "Science",
  "Engineering",
  "General Education",
  "Reference",
];
export const MOCK_CATEGORIES: CategorySummary[] = CATEGORY_NAMES.map((name, i) => ({ id: uid(NS.category, i + 1), name }));
const categoryId = (no: number) => uid(NS.category, no);

const AUTHOR_NAMES = [
  "James Clear", // 1
  "Matt Haig", // 2
  "Thomas H. Cormen", // 3
  "Charles E. Leiserson", // 4
  "Ronald L. Rivest", // 5
  "Clifford Stein", // 6
  "Don Norman", // 7
  "Cal Newport", // 8
  "Robert C. Martin", // 9
  "Daniel Kahneman", // 10
  "David Thomas", // 11
  "Andrew Hunt", // 12
  "Yuval Noah Harari", // 13
  "Rick Rubin", // 14
  "Tara Westover", // 15
  "Morgan Housel", // 16
  "Eric Matthes", // 17
  "James F. Kurose", // 18
  "Keith W. Ross", // 19
  "Abraham Silberschatz", // 20
  "Henry F. Korth", // 21
  "S. Sudarshan", // 22
  "Kenneth H. Rosen", // 23
  "James Stewart", // 24
  "David Halliday", // 25
  "Robert Resnick", // 26
  "Jearl Walker", // 27
  "N. Gregory Mankiw", // 28
  "Stephen P. Robbins", // 29
  "Mary Coulter", // 30
  "William Strunk Jr.", // 31
  "E. B. White", // 32
  "David Anderson", // 33
  "Dennis Sweeney", // 34
  "Thomas Williams", // 35
  "Raymond Murphy", // 36
  "James Morris", // 37
  "Daniel Hartl", // 38
  "Andrew Knoll", // 39
  "Richard Feynman", // 40
  "Robert Leighton", // 41
  "Matthew Sands", // 42
  "Trevor Hastie", // 43
  "Robert Tibshirani", // 44
  "Jerome Friedman", // 45
];
export const MOCK_AUTHORS: AuthorSummary[] = AUTHOR_NAMES.map((name, i) => ({ id: uid(NS.author, i + 1), name }));

interface BookRow {
  title: string;
  category: number; // 1-based index into CATEGORY_NAMES
  authors: number[]; // 1-based indexes into AUTHOR_NAMES
  year: number;
  publisher: string;
  copies: number;
  description: string;
  isbn?: string;
}

// Book numbers 1..12 are referenced by other seed files; keep their order stable.
const ROWS: BookRow[] = [
  { title: "Atomic Habits", category: 5, authors: [1], year: 2018, publisher: "Avery", copies: 2, description: "A practical framework for building good habits and breaking bad ones through tiny, consistent changes.", isbn: "9780735211292" },
  { title: "The Midnight Library", category: 2, authors: [2], year: 2020, publisher: "Canongate", copies: 2, description: "Between life and death is a library where every book is a different life Nora could have lived.", isbn: "9780525559474" },
  { title: "Introduction to Algorithms", category: 3, authors: [3, 4, 5, 6], year: 2022, publisher: "MIT Press", copies: 1, description: "A comprehensive reference on algorithm design and analysis.", isbn: "9780262046305" },
  { title: "The Design of Everyday Things", category: 4, authors: [7], year: 2013, publisher: "Basic Books", copies: 1, description: "A landmark study of how design serves people, and why well-designed objects feel effortless to use.", isbn: "9780465050659" },
  { title: "Deep Work", category: 5, authors: [8], year: 2016, publisher: "Grand Central Publishing", copies: 2, description: "Rules for focused success in a distracted world.", isbn: "9781455586691" },
  { title: "Clean Code", category: 3, authors: [9], year: 2008, publisher: "Prentice Hall", copies: 2, description: "A handbook of agile software craftsmanship on writing readable, maintainable code.", isbn: "9780132350884" },
  { title: "Thinking, Fast and Slow", category: 1, authors: [10], year: 2011, publisher: "Farrar, Straus and Giroux", copies: 1, description: "A tour of the two systems that drive the way we think, and the biases that shape our decisions.", isbn: "9780374533557" },
  { title: "The Pragmatic Programmer", category: 3, authors: [11, 12], year: 2019, publisher: "Addison-Wesley Professional", copies: 1, description: "Timeless lessons for developers who want to grow from journeyman to master craftsperson.", isbn: "9780135957059" },
  { title: "Sapiens", category: 6, authors: [13], year: 2015, publisher: "Harper", copies: 1, description: "A sweeping history of humankind, from the Stone Age to the age of technology.", isbn: "9780062316097" },
  { title: "The Creative Act", category: 4, authors: [14], year: 2023, publisher: "Penguin Press", copies: 1, description: "A meditation on the creative process and how to live in a way that nurtures the work.", isbn: "9780593652886" },
  { title: "Educated", category: 7, authors: [15], year: 2018, publisher: "Random House", copies: 1, description: "A memoir of a young woman who leaves her survivalist family and earns a PhD from Cambridge.", isbn: "9780399590504" },
  { title: "The Psychology of Money", category: 8, authors: [16], year: 2020, publisher: "Harriman House", copies: 1, description: "Timeless lessons on wealth, greed and happiness, told through short stories.", isbn: "9780857197689" },
  { title: "Python Crash Course", category: 3, authors: [17], year: 2023, publisher: "No Starch Press", copies: 2, description: "A project-based introduction to programming with Python, followed by practical projects.", isbn: "9781718502703" },
  { title: "Computer Networking: A Top-Down Approach", category: 9, authors: [18, 19], year: 2021, publisher: "Pearson", copies: 2, description: "An introduction to networking organized around the application layer and the internet's architecture." },
  { title: "Database System Concepts", category: 9, authors: [20, 21, 22], year: 2019, publisher: "McGraw-Hill Education", copies: 2, description: "Core concepts in database systems, relational design, SQL, transactions, and data management." },
  { title: "Discrete Mathematics and Its Applications", category: 10, authors: [23], year: 2019, publisher: "McGraw-Hill Education", copies: 2, description: "A broad introduction to discrete mathematics, logic, proof techniques, and combinatorics." },
  { title: "Calculus: Early Transcendentals", category: 10, authors: [24], year: 2016, publisher: "Cengage Learning", copies: 2, description: "A widely used introduction to single-variable and multivariable calculus." },
  { title: "Fundamentals of Physics", category: 12, authors: [25, 26, 27], year: 2021, publisher: "Wiley", copies: 2, description: "A calculus-based introduction to mechanics, waves, thermodynamics, electricity, and modern physics." },
  { title: "Principles of Economics", category: 8, authors: [28], year: 2021, publisher: "Cengage Learning", copies: 2, description: "An introduction to economic principles, markets, policy, and decision-making." },
  { title: "Management", category: 8, authors: [29, 30], year: 2020, publisher: "Pearson", copies: 2, description: "An introduction to management functions, organizational behavior, and decision-making." },
  { title: "The Elements of Style", category: 14, authors: [31, 32], year: 1999, publisher: "Longman", copies: 2, description: "A concise reference guide to English usage, composition, and clear writing." },
  { title: "Statistics for Business and Economics", category: 10, authors: [33, 34, 35], year: 2020, publisher: "Cengage Learning", copies: 2, description: "An applied introduction to statistical reasoning, data analysis, and business decision-making." },
  { title: "English Grammar in Use", category: 13, authors: [36], year: 2019, publisher: "Cambridge University Press", copies: 2, description: "A self-study reference and practice book for intermediate English grammar." },
  { title: "Biology: How Life Works", category: 11, authors: [37, 38, 39], year: 2020, publisher: "W. H. Freeman", copies: 2, description: "An introductory biology text that connects molecular processes to the larger systems of life." },
  { title: "The Elements of Statistical Learning", category: 14, authors: [43, 44, 45], year: 2009, publisher: "Springer", copies: 2, description: "A graduate-level reference on statistical learning, data mining, and predictive modeling." },
  { title: "The Feynman Lectures on Physics, Volume I", category: 12, authors: [40, 41, 42], year: 2011, publisher: "Basic Books", copies: 2, description: "A classic university-level introduction to mechanics, radiation, and heat." },
];

export const bookId = (no: number): UUID => uid(NS.book, no);

export const MOCK_BOOKS: MockBook[] = ROWS.map(
  (r, i): MockBook => ({
    id: bookId(i + 1),
    isbn: r.isbn ?? null,
    title: r.title,
    description: r.description,
    publisher: r.publisher,
    publicationYear: r.year,
    language: "English",
    isArchived: false,
    coverImageUrl: null, // UI falls back to /images/default-book-cover.png
    categoryId: categoryId(r.category),
    authorIds: r.authors.map((n) => uid(NS.author, n)),
  }),
);

export const bookTitle = (id: UUID): string => MOCK_BOOKS.find((b) => b.id === id)?.title ?? "Unknown title";

export const barcode = (bookNo: number, copyNo: number): string => `PR-${String(bookNo).padStart(4, "0")}-${copyNo}`;

// Copy states that must agree with the borrowing / reservation / fine seed files.
const COPY_OVERRIDES: Record<string, Partial<Pick<BookCopy, "status" | "condition" | "notes">>> = {
  "PR-0001-1": { status: "ON_LOAN" }, // Ana's loan
  "PR-0002-1": { status: "RESERVED" }, // Ben's approved request, awaiting pickup
  "PR-0004-1": { status: "ON_LOAN" }, // Carla's overdue loan (only copy: students must reserve)
  "PR-0006-2": { status: "MAINTENANCE", condition: "DAMAGED", notes: "Torn cover; awaiting repair." },
  "PR-0007-1": { status: "RESERVED" }, // offered to Ana's reservation
  "PR-0008-1": { status: "ON_LOAN" }, // Ana's renewed loan
  "PR-0009-1": { status: "LOST", condition: "UNUSABLE", notes: "Confirmed lost with the borrower." },
  "PR-0010-1": { condition: "FAIR" }, // returned with minor damage
  "PR-0011-1": { status: "RESERVED" }, // Carla's pickup, currently on hold
  "PR-0013-2": { status: "MAINTENANCE", condition: "DAMAGED", notes: "Loose binding; awaiting repair." },
  "PR-0014-2": { status: "WITHDRAWN", condition: "UNUSABLE", notes: "Withdrawn from circulation." },
  "PR-0015-2": { status: "MAINTENANCE", condition: "DAMAGED", notes: "Missing pages; awaiting review." },
  "PR-0017-2": { status: "WITHDRAWN", condition: "UNUSABLE", notes: "Withdrawn from circulation." },
  "PR-0020-2": { status: "MAINTENANCE", condition: "DAMAGED", notes: "Water damage; awaiting review." },
};

let copySeq = 0;
export const MOCK_COPIES: BookCopy[] = ROWS.flatMap((r, i) =>
  Array.from({ length: r.copies }, (_, k): BookCopy => {
    const code = barcode(i + 1, k + 1);
    return {
      id: uid(NS.copy, ++copySeq),
      bookId: bookId(i + 1),
      barcode: code,
      status: "AVAILABLE",
      condition: "GOOD",
      shelfLocation: `S-${String(i + 1).padStart(2, "0")}`,
      acquisitionDate: "2024-06-15",
      notes: null,
      ...COPY_OVERRIDES[code],
    };
  }),
);

/** Copy id by book number and copy number (1-based). Throws if the seed is inconsistent. */
export function copyId(bookNo: number, copyNo: number): UUID {
  const code = barcode(bookNo, copyNo);
  const c = MOCK_COPIES.find((x) => x.barcode === code);
  if (!c) throw new Error(`Seed copy ${code} not found`);
  return c.id;
}