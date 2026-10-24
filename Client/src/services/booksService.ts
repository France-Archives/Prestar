import type {
  AuthorSummary,
  BookCopy,
  BookCopyStatus,
  BookDetail,
  BookListParams,
  BookSummary,
  CategorySummary,
  CreateBookRequest,
  CreateCopyRequest,
  Paginated,
  SaveAuthorRequest,
  SaveCategoryRequest,
  StaffCopyRow,
  UpdateBookRequest,
  UpdateCopyRequest,
  UUID,
} from "@/types";
import type { MockBook } from "@/data";
import { MOCK_RECOMMENDATIONS } from "@/data";
import { ApiError, fail, toApiError } from "@/utils/errors";
import { can } from "@/utils/permissions";
import { validateRequired } from "@/utils/validators";
import { USE_MOCKS } from "@/utils/constants";
import { apiClient, apiGet, apiGetPage, apiPatch, apiPost } from "./apiClient";
import { authorsOf, availabilityOf, begin, fillQueues, toBookDetail, toBookSummary } from "./mockEngine";
import { commit, db, generateCopyBarcode, matches, newId, out, paginate, requireAccount, requireCapability, requireStudent, sessionUserOf } from "./mockStore";

// Mock implementations remain for demo mode; supported catalog reads and book writes use live endpoints when mocks are off.

const check = (message: string | null): void => {
  if (message) fail("VALIDATION_ERROR", message, 422);
};

interface BackendBookRecord {
  id: number | string;
  title: string;
  isbn?: string | null;
  description?: string | null;
  publisher?: string | null;
  publicationYear?: number | null;
  language?: string | null;
  price?: string | null;
  coverImageUrl?: string | null;
  status?: string;
  isArchived?: boolean;
  author?: BackendAuthor | null;
  authors?: BackendAuthor[];
  category?: BackendBookCategory | null;
  availability?: BackendAvailability;
  availableCopies?: number;
}

interface BackendAuthor {
  id: number | string;
  name: string | null;
}

interface BackendBookCategory {
  id: number | string;
  name: string;
}

interface BackendAvailability {
  availableCopies: number;
  totalUsableCopies: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveId(value: unknown): value is number | string {
  return (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
    || (typeof value === "string" && /^[1-9]\d*$/.test(value));
}

function mapBackendBook(value: unknown): BookDetail {
  if (!isRecord(value) || !positiveId(value.id) || typeof value.title !== "string" || !value.title.trim()) {
    throw new ApiError("UNKNOWN", "The Server returned a book with invalid fields.");
  }
  const availability = value.availability;
  if (!isRecord(availability)
    || typeof availability.availableCopies !== "number"
    || !Number.isSafeInteger(availability.availableCopies)
    || availability.availableCopies < 0
    || typeof availability.totalUsableCopies !== "number"
    || !Number.isSafeInteger(availability.totalUsableCopies)
    || availability.totalUsableCopies < availability.availableCopies) {
    throw new ApiError("UNKNOWN", "The Server returned a book with invalid availability.");
  }
  const authorValues = value.authors ?? (value.author ? [value.author] : []);
  if (!Array.isArray(authorValues)) {
    throw new ApiError("UNKNOWN", "The Server returned invalid book authors.");
  }
  const authors: BackendAuthor[] = authorValues.map((author) => {
    if (!isRecord(author) || !positiveId(author.id) || typeof author.name !== "string") {
      throw new ApiError("UNKNOWN", "The Server returned invalid book authors.");
    }
    return { id: author.id, name: author.name };
  });
  const category = value.category;
  let mappedCategory: BackendBookCategory | null = null;
  if (category !== null && category !== undefined) {
    if (!isRecord(category) || !positiveId(category.id) || typeof category.name !== "string") {
      throw new ApiError("UNKNOWN", "The Server returned an invalid book status.");
    }
    mappedCategory = { id: category.id, name: category.name };
  }
  if (value.isArchived !== undefined && typeof value.isArchived !== "boolean") {
    throw new ApiError("UNKNOWN", "The Server returned an invalid book status.");
  }
  if (value.price !== undefined && value.price !== null
    && (typeof value.price !== "string" || !Number.isFinite(Number(value.price)) || Number(value.price) < 0)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid book price.");
  }
  for (const field of ["isbn", "description", "publisher", "language", "coverImageUrl"] as const) {
    if (value[field] !== undefined && value[field] !== null && typeof value[field] !== "string") {
      throw new ApiError("UNKNOWN", `The Server returned an invalid book ${field}.`);
    }
  }
  if (value.publicationYear !== undefined && value.publicationYear !== null
    && (typeof value.publicationYear !== "number" || !Number.isInteger(value.publicationYear)
      || value.publicationYear < 1000 || value.publicationYear > 3000)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid book publication year.");
  }
  if (value.status !== undefined && value.status !== "Active" && value.status !== "Archived") {
    throw new ApiError("UNKNOWN", "The Server returned an invalid book status.");
  }
  if (typeof value.isArchived !== "boolean" && value.status !== "Active" && value.status !== "Archived") {
    throw new ApiError("UNKNOWN", "The Server returned a book without a status.");
  }
  if (typeof value.isArchived === "boolean" && value.status
    && value.isArchived !== (value.status === "Archived")) {
    throw new ApiError("UNKNOWN", "The Server returned inconsistent book status fields.");
  }

  const record: BackendBookRecord = {
    id: value.id,
    title: value.title,
    isbn: typeof value.isbn === "string" ? value.isbn : null,
    description: typeof value.description === "string" ? value.description : null,
    publisher: typeof value.publisher === "string" ? value.publisher : null,
    publicationYear: typeof value.publicationYear === "number" ? value.publicationYear : null,
    language: typeof value.language === "string" ? value.language : null,
    price: typeof value.price === "string" ? value.price : null,
    coverImageUrl: typeof value.coverImageUrl === "string" ? value.coverImageUrl : null,
    authors,
    category: mappedCategory,
    availability: {
      availableCopies: availability.availableCopies,
      totalUsableCopies: availability.totalUsableCopies,
    },
    isArchived: typeof value.isArchived === "boolean" ? value.isArchived : value.status === "Archived",
    status: typeof value.status === "string" ? value.status : undefined,
  };
  return { ...mapBackendBookSummary(record), publisher: record.publisher ?? null,
    publicationYear: record.publicationYear ?? null, language: record.language ?? null,
    price: record.price ?? null, isArchived: record.isArchived ?? false };
}

interface BackendCategoryOption {
  id?: string | number;
  categoryId?: string | number;
  category_id?: string | number;
  name?: string;
  category_name?: string;
  description?: string | null;
}

function mapBackendCategory(value: unknown): CategorySummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid category.");
  }
  const row = value as BackendCategoryOption;
  const id = row.id ?? row.categoryId ?? row.category_id;
  const name = row.name ?? row.category_name;
  if (!positiveId(id) || typeof name !== "string" || !name.trim()
    || (row.description !== undefined && row.description !== null && typeof row.description !== "string")) {
    throw new ApiError("UNKNOWN", "The Server returned a category without an ID or name.");
  }
  return {
    id: String(id),
    name,
    description: row.description ?? null,
  };
}

function mapBackendBookSummary(book: BackendBookRecord): BookSummary {
  const authors = book.authors ?? (book.author ? [book.author] : []);
  const availableCopies = Number(book.availability?.availableCopies ?? book.availableCopies ?? 0);
  return {
    id: String(book.id),
    title: book.title,
    isbn: book.isbn ?? null,
    description: book.description ?? null,
    category: book.category
      ? { id: String(book.category.id), name: book.category.name }
      : null,
    authors: authors.map((author) => ({ id: String(author.id), name: author.name ?? "" })),
    availability: {
      availableCopies,
      totalUsableCopies: Number(book.availability?.totalUsableCopies ?? availableCopies),
    },
    coverImageUrl: book.coverImageUrl ?? null,
  };
}

function mapBackendBookDetail(value: unknown): BookDetail {
  return mapBackendBook(value);
}

function liveBookQuery(params: BookListParams, page: number, limit: number) {
  const categoryId = params.categoryId === undefined ? undefined : Number(params.categoryId);
  if (categoryId !== undefined && (!Number.isSafeInteger(categoryId) || categoryId <= 0)) {
    fail("VALIDATION_ERROR", "Category id must be a positive integer.", 400);
  }
  return {
    page,
    limit,
    ...(categoryId === undefined ? {} : { category_id: categoryId }),
    ...(params.search?.trim() ? { search: params.search.trim() } : {}),
  };
}

function apiId(id: UUID, label: string): number {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    fail("VALIDATION_ERROR", `${label} must be a positive integer.`, 400);
  }
  return Number(id);
}

function bookRequestFields(req: Partial<UpdateBookRequest>, includeInitialCopies: boolean): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};
  if (req.title !== undefined) fields.title = req.title;
  if (req.isbn !== undefined) fields.isbn = req.isbn;
  if (req.authorIds !== undefined) {
    if (req.authorIds.length !== 1) fail("VALIDATION_ERROR", "Choose one author.", 422);
    fields.authorId = apiId(req.authorIds[0], "Author id");
  }
  if (req.categoryId !== undefined) fields.categoryId = req.categoryId === null ? null : apiId(req.categoryId, "Category id");
  if (req.publisher !== undefined) fields.publisher = req.publisher;
  if (req.publicationYear !== undefined) fields.publicationYear = req.publicationYear;
  if (req.language !== undefined) fields.language = req.language;
  if (req.price !== undefined) fields.price = req.price;
  if (req.description !== undefined) fields.description = req.description;
  if (req.coverImageUrl !== undefined) fields.coverImageUrl = req.coverImageUrl;
  if (includeInitialCopies && req.initialCopies !== undefined) fields.initialCopies = req.initialCopies;
  if ("isArchived" in req && req.isArchived !== undefined) fields.isArchived = req.isArchived;
  return fields;
}

function appendFormFields(form: FormData, fields: Record<string, string | number | boolean | null>): void {
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value === null ? "" : String(value));
  }
}

function mapBackendAuthor(value: unknown): AuthorSummary {
  if (!isRecord(value)) throw new ApiError("UNKNOWN", "The Server returned an invalid author.");
  const id = value.id ?? value.authorId;
  if (!positiveId(id) || typeof value.name !== "string") {
    throw new ApiError("UNKNOWN", "The Server returned an author without an ID or name.");
  }
  return { id: String(id), name: value.name };
}

async function listLiveStaffBooks(params: BookListParams): Promise<Paginated<BookDetail>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    fail("VALIDATION_ERROR", "Page must be positive and page size must be from 1 to 100.", 400);
  }
  let response: Paginated<unknown>;
  try {
    response = await apiGetPage<unknown>("/books", liveBookQuery(params, page, pageSize));
  } catch (error) {
    throw toApiError(error);
  }
  if (!response || !Array.isArray(response.data) || !isRecord(response.meta)
    || typeof response.meta.page !== "number"
    || typeof response.meta.pageSize !== "number"
    || typeof response.meta.total !== "number"
    || !Number.isFinite(response.meta.page)
    || !Number.isFinite(response.meta.pageSize)
    || !Number.isFinite(response.meta.total)) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid book list.");
  }
  return {
    data: response.data.map(mapBackendBook),
    meta: {
      page: response.meta.page,
      pageSize: response.meta.pageSize,
      total: response.meta.total,
    },
  };
}

async function listLiveBooks(params: BookListParams): Promise<Paginated<BookSummary>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  if (!params.availability) {
    const result = await apiGetPage<BackendBookRecord>(
      "/books",
      liveBookQuery(params, page, pageSize),
    );
    return {
      data: result.data.map(mapBackendBookSummary),
      meta: result.meta,
    };
  }

  // The API has no availability query. Load its matching pages before filtering
  // so the Client's existing availability filter and pagination remain accurate.
  const firstPage = await apiGetPage<BackendBookRecord>("/books", liveBookQuery(params, 1, 100));
  const allBooks = [...firstPage.data];
  const pageCount = Math.ceil(firstPage.meta.total / firstPage.meta.pageSize);
  for (let currentPage = 2; currentPage <= pageCount; currentPage += 1) {
    const result = await apiGetPage<BackendBookRecord>(
      "/books",
      liveBookQuery(params, currentPage, 100),
    );
    allBooks.push(...result.data);
  }

  const filtered = allBooks
    .map(mapBackendBookSummary)
    .filter((book) => params.availability === "AVAILABLE"
      ? book.availability.availableCopies > 0
      : book.availability.availableCopies === 0);
  const start = (page - 1) * pageSize;
  return {
    data: filtered.slice(start, start + pageSize),
    meta: { page, pageSize, total: filtered.length },
  };
}

function filterBooks(rows: MockBook[], params: BookListParams): MockBook[] {
  return rows
    .filter((b) => !params.categoryId || b.categoryId === params.categoryId)
    .filter((b) => matches(params.search, b.title, b.isbn, ...authorsOf(b).map((a) => a.name)))
    .filter((b) => {
      if (!params.availability) return true;
      const available = availabilityOf(b.id).availableCopies > 0;
      return params.availability === "AVAILABLE" ? available : !available;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** C1 GET /books. Archived titles are hidden from the catalog. */
export async function listBooks(params: BookListParams = {}): Promise<Paginated<BookSummary>> {
  if (!USE_MOCKS) return listLiveBooks(params);
  await begin();
  requireAccount();
  const rows = filterBooks(db.books.filter((b) => !b.isArchived), params);
  return out(paginate(rows.map(toBookSummary), params.page, params.pageSize));
}

/** Maps the compact personalized-recommendation book shape to the shared book-card type. */
export function mapRecommendedBook(value: unknown): BookSummary {
  if (!isRecord(value)) throw new ApiError("UNKNOWN", "The Server returned an invalid recommended book.");
  const id = value.id ?? value.bookId;
  const availability = value.availability;
  const category = value.category;
  if (
    (typeof id !== "string" && typeof id !== "number")
    || typeof value.title !== "string"
    || !isRecord(availability)
    || typeof availability.availableCopies !== "number"
    || typeof availability.totalUsableCopies !== "number"
    || (category !== null && category !== undefined
      && (!isRecord(category) || (typeof category.id !== "string" && typeof category.id !== "number") || typeof category.name !== "string"))
  ) {
    throw new ApiError("UNKNOWN", "The Server returned a recommended book with invalid fields.");
  }
  const authors = value.authors;
  if (authors !== undefined && (!Array.isArray(authors) || authors.some((author) => !isRecord(author) || (typeof author.id !== "string" && typeof author.id !== "number") || typeof author.name !== "string"))) {
    throw new ApiError("UNKNOWN", "The Server returned invalid recommended book authors.");
  }
  return mapBackendBookSummary({
    ...value,
    id,
    title: value.title,
    authors: authors as BackendBookRecord["authors"],
    availability: {
      availableCopies: availability.availableCopies,
      totalUsableCopies: availability.totalUsableCopies,
    },
  } as BackendBookRecord);
}

/** GET /api/me/recommended-books. */
export async function getRecommendedBooks(): Promise<BookSummary[]> {
  if (!USE_MOCKS) {
    const response = await apiGet<unknown>("/me/recommended-books");
    if (!Array.isArray(response)) throw new ApiError("UNKNOWN", "The Server returned an invalid recommended book list.");
    return response.map(mapRecommendedBook);
  }
  await begin();
  const { student } = requireStudent();
  return out((MOCK_RECOMMENDATIONS[student.id] ?? [])
    .map((id) => db.books.find((book) => book.id === id && !book.isArchived))
    .filter((book): book is MockBook => Boolean(book))
    .map(toBookSummary));
}

/** C1 for staff screens: includes archived titles and the staff-only fields. */
export async function listBooksForStaff(params: BookListParams = {}): Promise<Paginated<BookDetail>> {
  if (!USE_MOCKS) return listLiveStaffBooks(params);
  await begin();
  requireCapability("STAFF_AREA");
  return out(paginate(filterBooks(db.books, params).map(toBookDetail), params.page, params.pageSize));
}

/** C2 GET /books/:bookId */
export async function getBook(bookId: UUID): Promise<BookDetail> {
  if (!USE_MOCKS) {
    if (!/^[1-9]\d*$/.test(bookId) || !Number.isSafeInteger(Number(bookId))) {
      fail("VALIDATION_ERROR", "Book id must be a positive integer.", 400);
    }
    return mapBackendBookDetail(await apiGet<unknown>(`/books/${bookId}`));
  }
  await begin();
  const account = requireAccount();
  const book = db.books.find((b) => b.id === bookId);
  const staff = can(sessionUserOf(account), "STAFF_AREA");
  if (!book || (book.isArchived && !staff)) fail("NOT_FOUND", "We could not find that book.");
  return out(toBookDetail(book));
}

/** C3 GET /categories */
export async function listCategories(): Promise<CategorySummary[]> {
  if (!USE_MOCKS) {
    const response = await apiGet<unknown>("/categories");
    if (!Array.isArray(response)) {
      throw new ApiError("UNKNOWN", "The Server returned an invalid category list.");
    }
    return response.map(mapBackendCategory);
  }
  await begin();
  requireAccount();
  return out([...db.categories].sort((a, b) => a.name.localeCompare(b.name)));
}

/** C3.7 POST /categories */
export async function createCategory(req: SaveCategoryRequest): Promise<CategorySummary> {
  if (!USE_MOCKS) {
    try {
      const category = await apiPost<unknown>("/categories", {
        name: req.name,
        ...(req.description?.trim() ? { description: req.description.trim() } : {}),
      });
      return mapBackendCategory(category);
    } catch (error) {
      throw toApiError(error);
    }
  }
  return saveCategory(req);
}

/** Mock only (no author endpoint in the source). */
export async function listAuthors(): Promise<AuthorSummary[]> {
  if (!USE_MOCKS) {
    const response = await apiGet<unknown>("/authors");
    if (!Array.isArray(response)) throw new ApiError("UNKNOWN", "The Server returned an invalid author list.");
    return response.map(mapBackendAuthor);
  }
  await begin();
  requireAccount();
  return out([...db.authors].sort((a, b) => a.name.localeCompare(b.name)));
}

function validateBookInput(req: Partial<CreateBookRequest>, partial: boolean, selfId?: UUID): void {
  if (!partial || req.title !== undefined) check(validateRequired(req.title ?? "", "Title", 300));
  if (!partial || req.authorIds !== undefined) {
    const ids = req.authorIds ?? [];
    if (!ids.length) fail("VALIDATION_ERROR", "Choose at least one author.", 422);
    if (!ids.every((id) => db.authors.some((a) => a.id === id))) fail("VALIDATION_ERROR", "One of the chosen authors does not exist.", 422);
  }
  if (req.categoryId && !db.categories.some((c) => c.id === req.categoryId)) fail("VALIDATION_ERROR", "The chosen category does not exist.", 422);
  const isbn = req.isbn?.trim();
  if (isbn && db.books.some((b) => b.isbn === isbn && b.id !== selfId)) fail("CONFLICT", "A book with this ISBN already exists.");
}

/** C4 POST /books (Admin, or Librarian with catalog permission) */
export async function createBook(req: CreateBookRequest): Promise<BookDetail> {
  if (!USE_MOCKS) {
    const fields = bookRequestFields(req, true);
    if (req.authorIds === undefined || req.authorIds.length !== 1) {
      fail("VALIDATION_ERROR", "Choose one author.", 422);
    }
    try {
      if (req.coverImage) {
        const form = new FormData();
        appendFormFields(form, fields);
        form.append("coverImage", req.coverImage);
        const response = await apiClient.post<{ data: unknown }>("/books", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return mapBackendBookDetail(response.data.data);
      }
      return mapBackendBookDetail(await apiPost<unknown>("/books", fields));
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  requireCapability("CATALOG_MANAGE");
  validateBookInput(req, false);
  const book: MockBook = {
    id: newId(),
    isbn: req.isbn?.trim() || null,
    title: req.title.trim(),
    description: req.description?.trim() || null,
    publisher: req.publisher?.trim() || null,
    publicationYear: req.publicationYear ?? null,
    language: req.language?.trim() || null,
    isArchived: false,
    coverImageUrl: req.coverImageUrl?.trim() || null,
    categoryId: req.categoryId ?? null,
    authorIds: [...req.authorIds],
  };
  db.books.push(book);
  commit();
  return out(toBookDetail(book));
}

const hasOpenCommitments = (bookId: UUID): boolean =>
  db.loans.some((l) => l.bookId === bookId && l.status === "ACTIVE") ||
  db.requests.some((r) => r.bookId === bookId && (r.status === "APPROVED" || r.status === "ON_HOLD")) ||
  db.reservations.some((r) => r.bookId === bookId && (r.status === "WAITING" || r.status === "OFFERED"));

/** C5 PATCH /books/:bookId */
export async function updateBook(bookId: UUID, req: UpdateBookRequest): Promise<BookDetail> {
  if (!USE_MOCKS) {
    apiId(bookId, "Book id");
    const fields = bookRequestFields(req, false);
    try {
      if (req.coverImage) {
        const form = new FormData();
        appendFormFields(form, fields);
        form.append("coverImage", req.coverImage);
        const response = await apiClient.patch<{ data: unknown }>(`/books/${bookId}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return mapBackendBookDetail(response.data.data);
      }
      return mapBackendBookDetail(await apiPatch<unknown>(`/books/${bookId}`, fields));
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  requireCapability("CATALOG_MANAGE");
  const book = db.books.find((b) => b.id === bookId);
  if (!book) fail("NOT_FOUND", "We could not find that book.");
  validateBookInput(req, true, bookId);
  if (req.isArchived === true && !book.isArchived && hasOpenCommitments(bookId)) {
    fail("INVALID_STATE", "This title has active loans, pickups or reservations. Resolve them before archiving.", 409);
  }
  if (req.title !== undefined) book.title = req.title.trim();
  if (req.isbn !== undefined) book.isbn = req.isbn?.trim() || null;
  if (req.description !== undefined) book.description = req.description?.trim() || null;
  if (req.categoryId !== undefined) book.categoryId = req.categoryId;
  if (req.authorIds !== undefined) book.authorIds = [...req.authorIds];
  if (req.publisher !== undefined) book.publisher = req.publisher?.trim() || null;
  if (req.publicationYear !== undefined) book.publicationYear = req.publicationYear;
  if (req.language !== undefined) book.language = req.language?.trim() || null;
  if (req.coverImageUrl !== undefined) book.coverImageUrl = req.coverImageUrl?.trim() || null;
  if (req.isArchived !== undefined) book.isArchived = req.isArchived;
  commit();
  return out(toBookDetail(book));
}

// ---------- copies ----------

/** Staff view of the copies of one title. */
export async function listBookCopies(bookId: UUID): Promise<BookCopy[]> {
  await begin();
  requireCapability("STAFF_AREA");
  if (!db.books.some((b) => b.id === bookId)) fail("NOT_FOUND", "We could not find that book.");
  return out(db.copies.filter((c) => c.bookId === bookId).sort((a, b) => a.barcode.localeCompare(b.barcode)));
}

/** Mock only (no cross-title copy endpoint in the source): used by the maintenance page. TO CONFIRM. */
export async function listAllCopies(params: { search?: string; status?: BookCopyStatus } = {}): Promise<StaffCopyRow[]> {
  await begin();
  requireCapability("STAFF_AREA");
  const rows = db.copies
    .map((c): StaffCopyRow => ({ ...c, bookTitle: db.books.find((b) => b.id === c.bookId)?.title ?? "Unknown title" }))
    .filter((c) => !params.status || c.status === params.status)
    .filter((c) => {
      const book = db.books.find((b) => b.id === c.bookId);
      return matches(params.search, c.barcode, c.id, c.bookTitle, c.shelfLocation, book?.isbn, ...(book ? authorsOf(book).map((author) => author.name) : []));
    })
    .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || a.barcode.localeCompare(b.barcode));
  return out(rows);
}

/** C6 POST /books/:bookId/copies */
export async function createCopy(bookId: UUID, req: CreateCopyRequest): Promise<BookCopy> {
  await begin();
  requireCapability("CATALOG_MANAGE");
  if (!db.books.some((b) => b.id === bookId)) fail("NOT_FOUND", "We could not find that book.");
  const barcode = generateCopyBarcode();
  if (db.copies.some((c) => c.barcode === barcode)) fail("CONFLICT", "A copy with this barcode already exists.");
  const copy: BookCopy = {
    id: newId(),
    bookId,
    barcode,
    status: req.condition === "UNUSABLE" ? "WITHDRAWN" : req.condition === "DAMAGED" ? "MAINTENANCE" : "AVAILABLE",
    condition: req.condition,
    shelfLocation: req.shelfLocation?.trim() || null,
    section: req.section?.trim() || null,
    shelfCode: req.shelfCode?.trim() || null,
    levelOrRow: req.levelOrRow?.trim() || null,
    locationNotes: req.locationNotes?.trim() || null,
    acquisitionDate: req.acquisitionDate ?? null,
    notes: req.notes?.trim() || null,
  };
  db.copies.push(copy);
  fillQueues(); // a new copy may be offered to the first waiting student
  commit();
  return out(copy);
}

/** C7 PATCH /copies/:copyId. ON_LOAN and RESERVED are changed only by handover, returns, cancellation and expiry. */
export async function updateCopy(copyId: UUID, req: UpdateCopyRequest): Promise<BookCopy> {
  await begin();
  requireCapability("CATALOG_MANAGE");
  const copy = db.copies.find((c) => c.id === copyId);
  if (!copy) fail("NOT_FOUND", "We could not find that copy.");
  if (req.status && req.status !== copy.status) {
    const locked = copy.status === "ON_LOAN" || copy.status === "RESERVED";
    if (locked || req.status === "ON_LOAN" || req.status === "RESERVED") {
      fail("INVALID_STATE", "A copy that is on loan or reserved changes only through returns, handover or cancellation.", 409);
    }
    copy.status = req.status;
  }
  if (req.condition) copy.condition = req.condition;
  if (req.shelfLocation !== undefined) copy.shelfLocation = req.shelfLocation?.trim() || null;
  if (req.notes !== undefined) copy.notes = req.notes?.trim() || null;
  fillQueues();
  commit();
  return out(copy);
}

// ---------- categories and authors (mock only, TO CONFIRM) ----------

export async function saveCategory(req: SaveCategoryRequest, id?: UUID): Promise<CategorySummary> {
  if (!USE_MOCKS) {
    if (id) throw new ApiError("UNSUPPORTED_OPERATION", "Updating categories is not available in the Server API.");
    return createCategory(req);
  }
  await begin();
  requireCapability("CATALOG_MANAGE");
  check(validateRequired(req.name, "Category name", 100));
  const name = req.name.trim();
  if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)) fail("CONFLICT", "This category already exists.");
  let category = id ? db.categories.find((c) => c.id === id) : undefined;
  if (id && !category) fail("NOT_FOUND", "Category not found.");
  if (category) category.name = name;
  else {
    category = { id: newId(), name };
    db.categories.push(category);
  }
  commit();
  return out(category);
}

export async function deleteCategory(id: UUID): Promise<void> {
  await begin();
  requireCapability("CATALOG_MANAGE");
  const used = db.books.filter((b) => b.categoryId === id).length;
  if (used) fail("CONFLICT", `This category is used by ${used} ${used === 1 ? "title" : "titles"}.`);
  db.categories = db.categories.filter((c) => c.id !== id);
  commit();
}

export async function saveAuthor(req: SaveAuthorRequest, id?: UUID): Promise<AuthorSummary> {
  await begin();
  requireCapability("CATALOG_MANAGE");
  check(validateRequired(req.name, "Author name", 150));
  const name = req.name.trim();
  if (db.authors.some((a) => a.name.toLowerCase() === name.toLowerCase() && a.id !== id)) fail("CONFLICT", "This author already exists.");
  let author = id ? db.authors.find((a) => a.id === id) : undefined;
  if (id && !author) fail("NOT_FOUND", "Author not found.");
  if (author) author.name = name;
  else {
    author = { id: newId(), name };
    db.authors.push(author);
  }
  commit();
  return out(author);
}

export async function deleteAuthor(id: UUID): Promise<void> {
  await begin();
  requireCapability("CATALOG_MANAGE");
  const used = db.books.filter((b) => b.authorIds.includes(id)).length;
  if (used) fail("CONFLICT", `This author is linked to ${used} ${used === 1 ? "title" : "titles"}.`);
  db.authors = db.authors.filter((a) => a.id !== id);
  commit();
}