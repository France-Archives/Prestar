import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField, SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import * as booksService from "@/services/booksService";
import type { AuthorSummary, BookDetail, CategorySummary, CreateBookRequest, UpdateBookRequest, UUID } from "@/types";
import { describeError, toApiError } from "@/utils/errors";
import { can } from "@/utils/permissions";
import { USE_MOCKS } from "@/utils/constants";
import AddCategoryDialog, { addCreatedCategory } from "./AddCategoryDialog";

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateCoverFile(file: File): string | null {
  if (!COVER_TYPES.includes(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size > MAX_COVER_BYTES) return "Cover images must be 5 MB or smaller.";
  return null;
}

export interface BookFormValues {
  title: string;
  isbn: string;
  description: string;
  categoryId: string;
  publisher: string;
  publicationYear: string;
  language: string;
  price: string;
  initialCopies: string;
  coverImageUrl: string;
}

export function validateBookForm(
  values: BookFormValues,
  authorId: string,
  authorIds: UUID[],
  file: File | null,
  liveMode = !USE_MOCKS,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.title.trim()) errors.title = "Title is required.";
  else if (values.title.trim().length > 300) errors.title = "Title must be 300 characters or fewer.";
  if (values.isbn.trim().length > 20) errors.isbn = "ISBN must be 20 characters or fewer.";
  if (liveMode ? !authorId : authorIds.length === 0) errors.author = "Choose an author.";
  if (values.publicationYear) {
    const year = Number(values.publicationYear);
    if (!/^\d{4}$/.test(values.publicationYear) || !Number.isInteger(year) || year < 1000 || year > 3000) {
      errors.publicationYear = "Enter a year from 1000 to 3000.";
    }
  }
  if (values.price && (!/^\d+(\.\d{1,2})?$/.test(values.price) || Number(values.price) < 0)) {
    errors.price = "Enter a non-negative price.";
  }
  if (liveMode && values.initialCopies
    && (!/^\d+$/.test(values.initialCopies) || !Number.isSafeInteger(Number(values.initialCopies)))) {
    errors.initialCopies = "Enter a whole number of copies.";
  }
  if (file) {
    const fileError = validateCoverFile(file);
    if (fileError) errors.coverImage = fileError;
  }
  return errors;
}

interface BookFormProps {
  book?: BookDetail | null;
  categories: CategorySummary[];
  authors: AuthorSummary[];
  authorsLoading?: boolean;
  authorsError?: string | null;
  onRetryAuthors?: () => void;
  onClose: () => void;
  onDone: () => void;
}

export function bookFormErrorFields(error: unknown): { fields: Record<string, string>; message: string | null } {
  const apiError = toApiError(error);
  const message = apiError.message;
  if (apiError.status === 409 || apiError.code === "CONFLICT") {
    return { fields: { isbn: "ISBN already exists." }, message: null };
  }
  if (apiError.status === 422 || apiError.code === "VALIDATION_ERROR") {
    if (/author/i.test(message)) return { fields: { author: message }, message: null };
    if (/categor(y|ies)|category/i.test(message)) return { fields: { categoryId: message }, message: null };
  }
  if (apiError.status === 400 || apiError.code === "VALIDATION_ERROR") {
    if (/title/i.test(message)) return { fields: { title: message }, message: null };
    if (/isbn/i.test(message)) return { fields: { isbn: message }, message: null };
    if (/year|publication/i.test(message)) return { fields: { publicationYear: message }, message: null };
    if (/price/i.test(message)) return { fields: { price: message }, message: null };
  }
  return { fields: {}, message: describeError(apiError) };
}

function initialFormValues(book?: BookDetail | null): BookFormValues {
  return {
    title: book?.title ?? "",
    isbn: book?.isbn ?? "",
    description: book?.description ?? "",
    categoryId: book?.category?.id ?? "",
    publisher: book?.publisher ?? "",
    publicationYear: book?.publicationYear ? String(book.publicationYear) : "",
    language: book?.language ?? "",
    price: book?.price ?? "",
    initialCopies: "0",
    coverImageUrl: book?.coverImageUrl ?? "",
  };
}

export default function BookForm({
  book,
  categories,
  authors,
  authorsLoading = false,
  authorsError,
  onRetryAuthors,
  onClose,
  onDone,
}: BookFormProps) {
  const toast = useToast();
  const { user } = useAuth();
  const canManageCategories = can(user, "CATALOG_MANAGE");
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [addingCategory, setAddingCategory] = useState(false);
  const [v, setV] = useState<BookFormValues>(() => initialFormValues(book));
  const [authorId, setAuthorId] = useState(book?.authors[0]?.id ?? "");
  const [authorIds, setAuthorIds] = useState<UUID[]>(book?.authors.map((author) => author.id) ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => setCategoryOptions(categories), [categories]);

  const text = (key: keyof BookFormValues) => ({
    value: v[key],
    error: errors[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setV((current) => ({ ...current, [key]: event.target.value }));
      setErrors((current) => ({ ...current, [key]: "" }));
      setFormError(null);
    },
  });

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!selected) return;
    const validationError = validateCoverFile(selected);
    setFileError(validationError);
    setErrors((current) => ({ ...current, coverImage: validationError ?? "" }));
    if (validationError) return;
    setFile(selected);
    setV((current) => ({ ...current, coverImageUrl: "" }));
  };

  const toggleAuthor = (id: UUID) => setAuthorIds((current) => (
    current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]
  ));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const found = validateBookForm(v, authorId, authorIds, file);
    if (!USE_MOCKS && book?.isbn && !v.isbn.trim()) {
      found.isbn = "An existing ISBN cannot be cleared.";
    }
    if (fileError) found.coverImage = fileError;
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const trimmed = {
      title: v.title.trim(),
      isbn: v.isbn.trim(),
      description: v.description.trim(),
      categoryId: v.categoryId,
      publisher: v.publisher.trim(),
      publicationYear: v.publicationYear.trim(),
      language: v.language.trim(),
      price: v.price.trim(),
      coverImageUrl: v.coverImageUrl.trim(),
    };
    const selectedAuthors = USE_MOCKS ? authorIds : [authorId];
    const createBody: CreateBookRequest = {
      title: trimmed.title,
      isbn: trimmed.isbn || null,
      description: trimmed.description || null,
      categoryId: trimmed.categoryId || null,
      authorIds: selectedAuthors,
      publisher: trimmed.publisher || null,
      publicationYear: trimmed.publicationYear ? Number(trimmed.publicationYear) : null,
      language: trimmed.language || null,
      coverImageUrl: trimmed.coverImageUrl || null,
      ...(!USE_MOCKS ? { price: trimmed.price ? Number(trimmed.price) : null } : {}),
      ...(!USE_MOCKS ? { initialCopies: Number(v.initialCopies || "0") } : {}),
      ...(!USE_MOCKS && file ? { coverImage: file } : {}),
    };

    setBusy(true);
    submitting.current = true;
    try {
      if (!book) {
        await booksService.createBook(createBody);
      } else {
        const original = initialFormValues(book);
        const patch: UpdateBookRequest = {};
        if (trimmed.title !== original.title) patch.title = trimmed.title;
        if (trimmed.isbn !== original.isbn) patch.isbn = trimmed.isbn || null;
        if (trimmed.description !== original.description) patch.description = trimmed.description || null;
        if (trimmed.categoryId !== original.categoryId) patch.categoryId = trimmed.categoryId || null;
        if (USE_MOCKS) {
          if (authorIds.join(",") !== book.authors.map((author) => author.id).join(",")) patch.authorIds = authorIds;
        } else if (authorId !== (book.authors[0]?.id ?? "")) {
          patch.authorIds = [authorId];
        }
        if (trimmed.publisher !== original.publisher) patch.publisher = trimmed.publisher || null;
        if (trimmed.publicationYear !== original.publicationYear) {
          patch.publicationYear = trimmed.publicationYear ? Number(trimmed.publicationYear) : null;
        }
        if (trimmed.language !== original.language) patch.language = trimmed.language || null;
        if (!USE_MOCKS && trimmed.price !== original.price) patch.price = trimmed.price ? Number(trimmed.price) : null;
        if (!file && trimmed.coverImageUrl !== original.coverImageUrl) {
          patch.coverImageUrl = trimmed.coverImageUrl || null;
        }
        if (!USE_MOCKS && file) patch.coverImage = file;
        if (Object.keys(patch).length) await booksService.updateBook(book.id, patch);
      }
      toast.success(book ? "Book updated." : "Book added.");
      onDone();
      onClose();
    } catch (error) {
      const mapped = bookFormErrorFields(error);
      setErrors((current) => ({ ...current, ...mapped.fields }));
      setFormError(mapped.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const displayedCover = previewUrl ?? (file ? null : v.coverImageUrl || null);

  return (
    <Modal
      title={book ? "Edit book" : "Add book"}
      wide
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="manage-book-form" loading={busy} disabled={busy}>Save book</Button>
        </>
      }
    >
      <form id="manage-book-form" className="stack book-form" onSubmit={(event) => void submit(event)} noValidate>
        <InputField label="Title" required maxLength={300} {...text("title")} />
        <div className="form-row">
          <InputField label="ISBN" maxLength={20} hint={!book ? "Leave empty to auto-generate." : undefined} {...text("isbn")} />
          {!USE_MOCKS && <InputField label="Price" type="number" min="0" step="0.01" {...text("price")} />}
        </div>
        {!USE_MOCKS ? (
          <SelectField
            label="Author"
            required
            value={authorId}
            error={errors.author}
            disabled={authorsLoading || authors.length === 0}
            onChange={(event) => {
              setAuthorId(event.target.value);
              setErrors((current) => ({ ...current, author: "" }));
            }}
          >
            <option value="">{authorsLoading ? "Loading authors…" : "Choose an author"}</option>
            {authors.map((author) => <option key={author.id} value={author.id}>{author.name}</option>)}
          </SelectField>
        ) : (
          <fieldset>
            <legend className="label">Authors * <span className="subtle">(in selected order)</span></legend>
            <div className="book-author-list">
              {authors.map((author) => (
                <label key={author.id} className="check">
                  <input type="checkbox" checked={authorIds.includes(author.id)} onChange={() => toggleAuthor(author.id)} />
                  <span>{author.name}{authorIds.includes(author.id) && <span className="subtle"> · #{authorIds.indexOf(author.id) + 1}</span>}</span>
                </label>
              ))}
            </div>
            {errors.author && <span className="error">{errors.author}</span>}
          </fieldset>
        )}
        {authorsError && (
          <Alert kind="error">
            {authorsError} {onRetryAuthors && <button type="button" className="link-btn" onClick={onRetryAuthors}>Retry</button>}
          </Alert>
        )}
        {!authorsLoading && !authorsError && authors.length === 0 && <Alert kind="info">No authors yet</Alert>}

        <div className="book-category-row">
          <SelectField
            label="Category"
            value={v.categoryId}
            error={errors.categoryId}
            onChange={(event) => setV((current) => ({ ...current, categoryId: event.target.value }))}
          >
            <option value="">No category</option>
            {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </SelectField>
          {canManageCategories && (
            <Button type="button" variant="ghost" onClick={() => setAddingCategory(true)}>Add category</Button>
          )}
        </div>
        <div className="form-row">
          <InputField label="Publication year" type="number" min="1000" max="3000" step="1" {...text("publicationYear")} />
          <InputField label="Publisher" {...text("publisher")} />
          <InputField label="Language" {...text("language")} />
        </div>
        <TextareaField label="Description" value={v.description} error={errors.description} onChange={(event) => setV((current) => ({ ...current, description: event.target.value }))} />
        {!book && !USE_MOCKS && (
          <InputField
            label="Initial copies"
            type="number"
            min="0"
            step="1"
            hint="Additional copies cannot be managed here yet."
            {...text("initialCopies")}
          />
        )}

        <div className="book-cover-control">
          <div className="book-cover-control__fields">
            <InputField
              label="Cover image URL"
              value={v.coverImageUrl}
              onChange={(event) => {
                setFile(null);
                setFileError(null);
                setV((current) => ({ ...current, coverImageUrl: event.target.value }));
              }}
            />
            {!USE_MOCKS && (
              <label className="field">
                <span className="label">Or upload a cover</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={busy} />
                <span className="hint">JPEG, PNG, or WebP · maximum 5 MB</span>
                {(errors.coverImage || fileError) && <span className="error" role="alert">{errors.coverImage || fileError}</span>}
              </label>
            )}
            {(file || v.coverImageUrl) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setFileError(null);
                  setV((current) => ({ ...current, coverImageUrl: "" }));
                }}
              >
                <X size={15} aria-hidden="true" /> Remove cover
              </Button>
            )}
          </div>
          <div className="book-cover-preview" aria-label="Cover preview">
            {displayedCover
              ? <img src={displayedCover} alt="Book cover preview" />
              : <span><ImagePlus size={22} aria-hidden="true" /> Cover preview</span>}
          </div>
        </div>
        {formError && <Alert kind="error">{formError}</Alert>}
      </form>
      {addingCategory && (
        <AddCategoryDialog
          onClose={() => setAddingCategory(false)}
          onCreated={(category) => {
            const selection = addCreatedCategory(categoryOptions, category);
            setCategoryOptions(selection.categories);
            setV((current) => ({ ...current, categoryId: selection.selectedCategoryId }));
          }}
        />
      )}
    </Modal>
  );
}
