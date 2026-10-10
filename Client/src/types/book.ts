import type { ISODate, PageParams, UUID } from "./api";
import type { AvailabilityFilter, BookCopyStatus, CopyCondition } from "./enums";

export interface CategorySummary {
  id: UUID;
  name: string;
}

export interface AuthorSummary {
  id: UUID;
  name: string;
}

export interface BookAvailability {
  availableCopies: number;
  totalUsableCopies: number;
}

// books -> BookSummary. authors is ALWAYS an array (ordered by author_order); never a single text field.
export interface BookSummary {
  id: UUID;
  isbn: string | null;
  title: string;
  description: string | null;
  category: CategorySummary | null;
  authors: AuthorSummary[];
  availability: BookAvailability;
  coverImageUrl: string | null;
}

/** Staff-only extras on create/update. Visibility to students is TO CONFIRM. */
export interface BookDetail extends BookSummary {
  publisher: string | null;
  publicationYear: number | null;
  language: string | null;
  isArchived: boolean;
}

export interface CopyRef {
  id: UUID;
  barcode: string;
}

// book_copies -> BookCopy (derived, staff)
export interface BookCopy {
  id: UUID;
  bookId: UUID;
  barcode: string;
  status: BookCopyStatus;
  condition: CopyCondition;
  shelfLocation: string | null;
  acquisitionDate: ISODate | null;
  notes: string | null;
}

/** Copy row with its title, for cross-title staff lists (maintenance page). */
export interface StaffCopyRow extends BookCopy {
  bookTitle: string;
}

// ----- Query / request bodies -----

export interface BookListParams extends PageParams {
  search?: string; // title, ISBN, author name
  categoryId?: UUID;
  availability?: AvailabilityFilter;
}

/** C4 POST /books. authorIds keeps the author order. Author endpoints are not in the source (TO CONFIRM). */
export interface CreateBookRequest {
  isbn?: string | null;
  title: string;
  description?: string | null;
  categoryId?: UUID | null;
  authorIds: UUID[];
  publisher?: string | null;
  publicationYear?: number | null;
  language?: string | null;
  coverImageUrl?: string | null;
}

/** C5 PATCH /books/:bookId */
export type UpdateBookRequest = Partial<CreateBookRequest> & { isArchived?: boolean };

/** C6 POST /books/:bookId/copies */
export interface CreateCopyRequest {
  barcode: string;
  condition: CopyCondition;
  shelfLocation?: string | null;
  acquisitionDate?: ISODate | null;
  notes?: string | null;
}

/** C7 PATCH /copies/:copyId */
export interface UpdateCopyRequest {
  status?: BookCopyStatus;
  condition?: CopyCondition;
  shelfLocation?: string | null;
  notes?: string | null;
}

/** Category / author management endpoints are not in the source. Mock only. TO CONFIRM. */
export interface SaveCategoryRequest {
  name: string;
}
export interface SaveAuthorRequest {
  name: string;
}