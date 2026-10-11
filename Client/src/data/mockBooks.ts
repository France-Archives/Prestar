import type { AuthorSummary, BookCopy, BookDetail, CategorySummary, UUID } from "@/types";
import { NS, uid } from "./mockHelpers";

// TEMPORARY MOCK IMPLEMENTATION: fake book, author, category and copy records.
// Replace with the real Books API (C1 to C7). Availability, category and authors are JOINED/COMPUTED by the
// service, never stored here, so they stay correct when copies change.

export type MockBook = Omit<BookDetail, "category" | "authors" | "availability"> & {
  categoryId: UUID | null;
  authorIds: UUID[]; // order = author_order
};

const CATEGORY_NAMES = ["Psychology", "Fiction", "Computer Science", "Design", "Productivity", "History", "Literature", "Business"];
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
}

// Book numbers 1..12 follow this order. Other seed files refer to books by this number.
const ROWS: BookRow[] = [
  { title: "Atomic Habits", category: 5, authors: [1], year: 2018, publisher: "Avery", copies: 2, description: "A practical framework for building good habits and breaking bad ones through tiny, consistent changes." },
  { title: "The Midnight Library", category: 2, authors: [2], year: 2020, publisher: "Canongate", copies: 2, description: "Between life and death is a library where every book is a different life Nora could have lived." },
  { title: "Introduction to Algorithms", category: 3, authors: [3, 4, 5, 6], year: 2022, publisher: "MIT Press", copies: 1, description: "The definitive reference on algorithm design and analysis, with a rigorous mathematical treatment." },
  { title: "The Design of Everyday Things", category: 4, authors: [7], year: 2013, publisher: "Basic Books", copies: 1, description: "A landmark study of how design serves people, and why well-designed objects feel effortless to use." },
  { title: "Deep Work", category: 5, authors: [8], year: 2016, publisher: "Grand Central", copies: 2, description: "Rules for focused success in a distracted world." },
  { title: "Clean Code", category: 3, authors: [9], year: 2008, publisher: "Prentice Hall", copies: 2, description: "A handbook of agile software craftsmanship on writing readable, maintainable code." },
  { title: "Thinking, Fast and Slow", category: 1, authors: [10], year: 2011, publisher: "Farrar, Straus and Giroux", copies: 1, description: "A tour of the two systems that drive the way we think, and the biases that shape our decisions." },
  { title: "The Pragmatic Programmer", category: 3, authors: [11, 12], year: 2019, publisher: "Addison-Wesley", copies: 1, description: "Timeless lessons for developers who want to grow from journeyman to master craftsperson." },
  { title: "Sapiens", category: 6, authors: [13], year: 2015, publisher: "Harper", copies: 1, description: "A sweeping history of humankind, from the Stone Age to the age of technology." },
  { title: "The Creative Act", category: 4, authors: [14], year: 2023, publisher: "Penguin Press", copies: 1, description: "A meditation on the creative process and how to live in a way that nurtures the work." },
  { title: "Educated", category: 7, authors: [15], year: 2018, publisher: "Random House", copies: 1, description: "A memoir of a young woman who leaves her survivalist family and earns a PhD from Cambridge." },
  { title: "The Psychology of Money", category: 8, authors: [16], year: 2020, publisher: "Harriman House", copies: 1, description: "Timeless lessons on wealth, greed and happiness, told through short stories." },
];

export const bookId = (no: number): UUID => uid(NS.book, no);

export const MOCK_BOOKS: MockBook[] = ROWS.map(
  (r, i): MockBook => ({
    id: bookId(i + 1),
    isbn: `9780000000${String(i + 1).padStart(3, "0")}`, // placeholder ISBNs
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