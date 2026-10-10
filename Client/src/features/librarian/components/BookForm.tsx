import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField, SelectField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import type { AuthorSummary, BookDetail, CategorySummary, CreateBookRequest, UpdateBookRequest, UUID } from "@/types";
import { describeError } from "@/utils/errors";

interface BookFormProps {
  book?: BookDetail | null;
  categories: CategorySummary[];
  authors: AuthorSummary[];
  onClose: () => void;
  onDone: () => void;
}

// Books can have several authors (ordered). Authors are a list, never a single text field.
export default function BookForm({ book, categories, authors, onClose, onDone }: BookFormProps) {
  const toast = useToast();
  const [v, setV] = useState({
    title: book?.title ?? "",
    isbn: book?.isbn ?? "",
    description: book?.description ?? "",
    categoryId: book?.category?.id ?? "",
    publisher: book?.publisher ?? "",
    publicationYear: book?.publicationYear ? String(book.publicationYear) : "",
    language: book?.language ?? "",
    coverImageUrl: book?.coverImageUrl ?? "",
  });
  const [authorIds, setAuthorIds] = useState<UUID[]>(book?.authors.map((a) => a.id) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const text = (key: keyof typeof v) => ({
    value: v[key],
    error: errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [key]: e.target.value }),
  });

  const toggleAuthor = (id: UUID) => setAuthorIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    const found: Record<string, string> = {};
    if (!v.title.trim()) found.title = "Title is required.";
    if (authorIds.length === 0) found.authors = "Choose at least one author.";
    if (v.publicationYear && !/^\d{4}$/.test(v.publicationYear.trim())) found.publicationYear = "Enter a 4-digit year.";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const body = {
      title: v.title.trim(),
      isbn: v.isbn.trim() || null,
      description: v.description.trim() || null,
      categoryId: v.categoryId || null,
      authorIds,
      publisher: v.publisher.trim() || null,
      publicationYear: v.publicationYear.trim() ? Number(v.publicationYear) : null,
      language: v.language.trim() || null,
      coverImageUrl: v.coverImageUrl.trim() || null,
    };
    setBusy(true);
    try {
      if (book) await booksService.updateBook(book.id, body as unknown as UpdateBookRequest);
      else await booksService.createBook(body as unknown as CreateBookRequest);
      toast.success(book ? "Book updated." : "Book added.");
      onDone();
      onClose();
    } catch (e) {
      setFormError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={book ? "Edit book" : "Add book"}
      wide
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save book
          </Button>
        </>
      }
    >
      <InputField label="Title" required {...text("title")} />
      <div className="form-row">
        <InputField label="ISBN" {...text("isbn")} />
        <SelectField label="Category" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>
      <fieldset>
        <legend className="label" style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-forest)" }}>
          Authors * <span className="subtle">(the order you tick them is the author order)</span>
        </legend>
        <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--color-line)", borderRadius: "var(--radius-sm)", padding: 8, display: "grid", gap: 4, background: "#fff" }}>
          {authors.map((a) => (
            <label key={a.id} className="check">
              <input type="checkbox" checked={authorIds.includes(a.id)} onChange={() => toggleAuthor(a.id)} />
              <span>
                {a.name}
                {authorIds.includes(a.id) && <span className="subtle"> · #{authorIds.indexOf(a.id) + 1}</span>}
              </span>
            </label>
          ))}
        </div>
        {errors.authors && <span style={{ fontSize: "0.75rem", color: "var(--color-brick)" }}>{errors.authors}</span>}
      </fieldset>
      <TextareaField label="Description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      <div className="form-row">
        <InputField label="Publisher" {...text("publisher")} />
        <InputField label="Year" {...text("publicationYear")} />
        <InputField label="Language" {...text("language")} />
      </div>
      <InputField label="Cover image URL" {...text("coverImageUrl")} />
      {formError && <Alert kind="error">{formError}</Alert>}
    </Modal>
  );
}