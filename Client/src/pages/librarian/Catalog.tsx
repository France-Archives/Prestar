import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import Modal from "../../components/Modal";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { BookFormData } from "../../types";

const EMPTY: BookFormData = { title: "", author: "", isbn: "", category_id: "", publisher: "", year_published: "", edition: "", description: "", cover_image: "", shelf_location: "", price: "" };
type Dialog = { kind: "form" } | { kind: "details"; row: lib.CatalogRow } | { kind: "archive"; row: lib.CatalogRow } | null;

const toForm = (b: lib.CatalogRow): BookFormData => ({
  book_id: b.book_id,
  title: b.title,
  author: b.author,
  isbn: b.isbn ?? "",
  category_id: b.category_id,
  publisher: b.publisher ?? "",
  year_published: b.year_published ?? "",
  edition: b.edition ?? "",
  description: b.description ?? "",
  cover_image: b.cover_image ?? "",
  shelf_location: b.shelf_location ?? "",
  price: b.price ?? "",
});

// Books are catalog records. Physical copies live on the Inventory page (one book, many copies).
export default function LibrarianCatalog() {
  const { user, act } = useAuthedLibrary();
  const books = useLive(lib.getCatalogRows);
  const categories = useLive(lib.getCategories);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("Active");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [f, setF] = useState<BookFormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, wrap] = useBusy();

  const term = q.trim().toLowerCase();
  const rows = books.filter(
    (b) =>
      (!term || [b.title, b.author, b.isbn ?? ""].some((s) => s.toLowerCase().includes(term))) &&
      (category === "all" || b.category_id === Number(category)) &&
      (status === "all" || b.status === status),
  );
  const set = (k: keyof BookFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const openForm = (b?: lib.CatalogRow) => {
    setF(b ? toForm(b) : EMPTY);
    setError(null);
    setDialog({ kind: "form" });
  };
  const save = wrap(async () => {
    const res = await act(api.saveBook(user.user_id, f), "Book saved.");
    if (!res.ok) return setError(res.error);
    setDialog(null);
  });
  const toggleArchive = wrap(async () => {
    if (dialog?.kind !== "archive") return;
    const b = dialog.row;
    await act(b.status === "Active" ? api.archiveBook(user.user_id, b.book_id) : api.restoreBook(user.user_id, b.book_id), b.status === "Active" ? "Book archived. History is kept." : "Book restored.");
    setDialog(null);
  });

  const columns: Column<lib.CatalogRow>[] = [
    { key: "title", label: "Title" },
    { key: "author", label: "Author" },
    { key: "isbn", label: "ISBN", render: (b) => b.isbn ?? "—" },
    { key: "category", label: "Category" },
    { key: "copies", label: "Copies" },
    { key: "free", label: "Free" },
    { key: "queue", label: "Waiting" },
    { key: "status", label: "Status", render: (b) => <Badge status={b.status} /> },
    {
      key: "actions",
      label: "",
      render: (b) => (
        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn ghost sm" onClick={() => openForm(b)}>Edit</button>
          <button className="btn ghost sm" onClick={() => setDialog({ kind: "archive", row: b })}>{b.status === "Active" ? "Archive" : "Restore"}</button>
        </div>
      ),
    },
  ];

  const details = dialog?.kind === "details" ? dialog.row : null;
  const archiving = dialog?.kind === "archive" ? dialog.row : null;
  const impact = archiving ? api.archiveImpact(archiving.book_id) : null;

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Catalog</h1>
      <div className="toolbar">
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author or ISBN…" />
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="Active">Active</option>
          <option value="Archived">Archived</option>
          <option value="all">All</option>
        </select>
        <button className="btn primary sm" onClick={() => openForm()}>Add book</button>
      </div>
      <DataTable columns={columns} rows={rows} empty="No books match." onRowClick={(b) => setDialog({ kind: "details", row: b })} />

      {dialog?.kind === "form" && (
        <ConfirmDialog title={f.book_id ? "Edit book" : "Add book"} confirmLabel="Save" busy={busy} onConfirm={save} onClose={() => setDialog(null)}>
          <div className="row">
            <label className="field"><span>Title</span><input value={f.title} onChange={set("title")} /></label>
            <label className="field"><span>Author</span><input value={f.author} onChange={set("author")} /></label>
          </div>
          <div className="row">
            <label className="field"><span>ISBN</span><input value={f.isbn ?? ""} onChange={set("isbn")} /></label>
            <label className="field">
              <span>Category</span>
              <select value={f.category_id} onChange={set("category_id")}>
                <option value="">Choose…</option>
                {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <label className="field"><span>Publisher</span><input value={f.publisher ?? ""} onChange={set("publisher")} /></label>
            <label className="field"><span>Year</span><input type="number" value={f.year_published ?? ""} onChange={set("year_published")} /></label>
          </div>
          <div className="row">
            <label className="field"><span>Edition</span><input value={f.edition ?? ""} onChange={set("edition")} /></label>
            <label className="field"><span>Shelf location</span><input value={f.shelf_location ?? ""} onChange={set("shelf_location")} /></label>
          </div>
          <div className="row">
            <label className="field"><span>Price (for lost-book penalty)</span><input type="number" min="0" value={f.price ?? ""} onChange={set("price")} /></label>
            <label className="field"><span>Cover image URL</span><input value={f.cover_image ?? ""} onChange={set("cover_image")} /></label>
          </div>
          <label className="field"><span>Description</span><textarea rows={3} value={f.description ?? ""} onChange={set("description")} /></label>
          {error && <p className="form-error">{error}</p>}
        </ConfirmDialog>
      )}

      {archiving && impact && (
        <ConfirmDialog title={archiving.status === "Active" ? "Archive this book?" : "Restore this book?"} confirmLabel={archiving.status === "Active" ? "Archive" : "Restore"} danger={archiving.status === "Active"} busy={busy} onConfirm={toggleArchive} onClose={() => setDialog(null)}>
          <p>“{archiving.title}”</p>
          {archiving.status === "Active" ? (
            <p className="muted">Archiving hides the book from students and cancels {impact.requests} open request(s) and {impact.reservations} reservation(s). Existing loans and all history are kept.</p>
          ) : (
            <p className="muted">The book will appear in the student catalog again.</p>
          )}
        </ConfirmDialog>
      )}

      {details && <BookDetails row={details} onClose={() => setDialog(null)} />}
    </>
  );
}

function BookDetails({ row, onClose }: { row: lib.CatalogRow; onClose: () => void }) {
  const copies = useLive(() => lib.getCopyRows(row.book_id));
  return (
    <Modal title={row.title} onClose={onClose} wide>
      <p className="muted">{row.author} · {row.category} · ISBN {row.isbn ?? "—"} · Shelf {row.shelf_location ?? "—"}</p>
      {row.description && <p>{row.description}</p>}
      <h3>Physical copies ({copies.length})</h3>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Accession no.</th><th>Status</th><th>Condition</th><th>Borrower</th></tr></thead>
          <tbody>
            {copies.map((c) => (
              <tr key={c.id}><td>{c.accessionNo}</td><td><Badge status={c.status} /></td><td><Badge status={c.condition} /></td><td>{c.borrower}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}