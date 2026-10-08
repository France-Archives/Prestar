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

const CONTROL_CLS =
  "input h-11 rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-3.5 font-sans text-[13px] text-[#1F2A27] shadow-none transition-all duration-200 placeholder:text-[#9AA59F] hover:border-[#6F9B78] focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40";

const FIELD_CLS = "field flex min-w-0 flex-1 flex-col gap-1.5";
const LABEL_CLS = "font-sans text-[11px] font-bold tracking-[0.03em] text-[#0B3D32]";
const FORM_INPUT_CLS =
  "h-11 w-full rounded-[10px] border border-[#D9DDD7] bg-[#F5F3EA] px-3.5 font-sans text-[13.5px] text-[#1F2A27] transition-all duration-200 focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40";
const ROW_CLS = "row flex flex-col gap-4 sm:flex-row";

const GHOST_SM =
  "btn ghost sm inline-flex h-9 items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-4 font-sans text-[12px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]";

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
    { key: "title", label: "Title", render: (b) => <span className="font-serif text-[15px] font-medium text-[#0B3D32]">{b.title}</span> },
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
        <div className="row-actions flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <button className={GHOST_SM} onClick={() => openForm(b)}>Edit</button>
          <button className={GHOST_SM} onClick={() => setDialog({ kind: "archive", row: b })}>{b.status === "Active" ? "Archive" : "Restore"}</button>
        </div>
      ),
    },
  ];

  const details = dialog?.kind === "details" ? dialog.row : null;
  const archiving = dialog?.kind === "archive" ? dialog.row : null;
  const impact = archiving ? api.archiveImpact(archiving.book_id) : null;

  return (
    <div className="mx-auto w-full font-sans text-[#1F2A27]">
      {/* Header */}
      <header className="relative overflow-hidden rounded-[22px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 py-8 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCE5D7]/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#D9C19A]/40 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow mb-2 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
              <span className="h-px w-8 bg-[#B98A4A]" />
              LIBRARIAN
            </span>
            <h1 className="page-title font-serif text-[clamp(32px,5.5vw,52px)] font-medium leading-[1.08] tracking-[-0.01em] text-[#0B3D32]">
              Catalog
            </h1>
            <p className="sub mt-2 font-sans text-[13px] text-[#6B756F]">
              {rows.length} {rows.length === 1 ? "book" : "books"} shown
            </p>
          </div>
          <button
            className="btn primary sm inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-6 font-sans text-[13px] font-medium text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] active:scale-[0.98] sm:w-auto"
            onClick={() => openForm()}
          >
            Add book
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar mt-6 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
        <input className={`${CONTROL_CLS} grow sm:min-w-[260px] sm:flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author or ISBN…" />
        <select className={CONTROL_CLS} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
        </select>
        <select className={CONTROL_CLS} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="Active">Active</option>
          <option value="Archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-2 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-1 shadow-[0_4px_14px_rgba(11,61,50,0.05)]">
        <DataTable columns={columns} rows={rows} empty="No books match." onRowClick={(b) => setDialog({ kind: "details", row: b })} />
      </div>

      {dialog?.kind === "form" && (
        <ConfirmDialog title={f.book_id ? "Edit book" : "Add book"} confirmLabel="Save" busy={busy} onConfirm={save} onClose={() => setDialog(null)}>
          <div className="flex flex-col gap-4">
            <div className={ROW_CLS}>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>Title</span><input className={FORM_INPUT_CLS} value={f.title} onChange={set("title")} /></label>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>Author</span><input className={FORM_INPUT_CLS} value={f.author} onChange={set("author")} /></label>
            </div>
            <div className={ROW_CLS}>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>ISBN</span><input className={FORM_INPUT_CLS} value={f.isbn ?? ""} onChange={set("isbn")} /></label>
              <label className={FIELD_CLS}>
                <span className={LABEL_CLS}>Category</span>
                <select className={FORM_INPUT_CLS} value={f.category_id} onChange={set("category_id")}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                </select>
              </label>
            </div>
            <div className={ROW_CLS}>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>Publisher</span><input className={FORM_INPUT_CLS} value={f.publisher ?? ""} onChange={set("publisher")} /></label>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>Year</span><input className={FORM_INPUT_CLS} type="number" value={f.year_published ?? ""} onChange={set("year_published")} /></label>
            </div>
            <div className={ROW_CLS}>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>Edition</span><input className={FORM_INPUT_CLS} value={f.edition ?? ""} onChange={set("edition")} /></label>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>Shelf location</span><input className={FORM_INPUT_CLS} value={f.shelf_location ?? ""} onChange={set("shelf_location")} /></label>
            </div>
            <div className={ROW_CLS}>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>Price (for lost-book penalty)</span><input className={FORM_INPUT_CLS} type="number" min="0" value={f.price ?? ""} onChange={set("price")} /></label>
              <label className={FIELD_CLS}><span className={LABEL_CLS}>Cover image URL</span><input className={FORM_INPUT_CLS} value={f.cover_image ?? ""} onChange={set("cover_image")} /></label>
            </div>
            <label className={FIELD_CLS}>
              <span className={LABEL_CLS}>Description</span>
              <textarea
                className="w-full rounded-[10px] border border-[#D9DDD7] bg-[#F5F3EA] px-3.5 py-2.5 font-sans text-[13.5px] text-[#1F2A27] transition-all duration-200 focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40"
                rows={3}
                value={f.description ?? ""}
                onChange={set("description")}
              />
            </label>
            {error && (
              <p className="form-error rounded-[10px] border border-[#E6C7BD] bg-[#F1DDD6] px-3 py-2 font-sans text-[12px] text-[#8A3B35]">{error}</p>
            )}
          </div>
        </ConfirmDialog>
      )}

      {archiving && impact && (
        <ConfirmDialog title={archiving.status === "Active" ? "Archive this book?" : "Restore this book?"} confirmLabel={archiving.status === "Active" ? "Archive" : "Restore"} danger={archiving.status === "Active"} busy={busy} onConfirm={toggleArchive} onClose={() => setDialog(null)}>
          <p className="font-serif text-[17px] text-[#0B3D32]">“{archiving.title}”</p>
          {archiving.status === "Active" ? (
            <p className="muted mt-2 font-sans text-[13px] leading-relaxed text-[#6B756F]">Archiving hides the book from students and cancels {impact.requests} open request(s) and {impact.reservations} reservation(s). Existing loans and all history are kept.</p>
          ) : (
            <p className="muted mt-2 font-sans text-[13px] leading-relaxed text-[#6B756F]">The book will appear in the student catalog again.</p>
          )}
        </ConfirmDialog>
      )}

      {details && <BookDetails row={details} onClose={() => setDialog(null)} />}
    </div>
  );
}

function BookDetails({ row, onClose }: { row: lib.CatalogRow; onClose: () => void }) {
  const copies = useLive(() => lib.getCopyRows(row.book_id));
  const th = "whitespace-nowrap border-b border-[#D9DDD7] bg-[#F5F3EA] px-4 py-3 text-left font-sans text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#6B756F]";
  const td = "border-b border-[#D9DDD7] px-4 py-3 font-sans text-[13px] text-[#1F2A27]";
  return (
    <Modal title={row.title} onClose={onClose} wide>
      <p className="muted font-sans text-[13px] leading-relaxed text-[#6B756F]">
        {row.author} · {row.category} · ISBN {row.isbn ?? "—"} · Shelf {row.shelf_location ?? "—"}
      </p>
      {row.description && <p className="mt-3 font-sans text-[14px] leading-relaxed text-[#1F2A27]">{row.description}</p>}
      <h3 className="mb-3 mt-6 font-serif text-[19px] font-medium text-[#0B3D32]">Physical copies ({copies.length})</h3>
      <div className="tbl-wrap overflow-x-auto rounded-[12px] border border-[#D9DDD7]">
        <table className="tbl w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Accession no.</th>
              <th className={th}>Status</th>
              <th className={th}>Condition</th>
              <th className={th}>Borrower</th>
            </tr>
          </thead>
          <tbody>
            {copies.map((c) => (
              <tr key={c.id} className="transition-colors duration-150 hover:bg-[#F5F3EA]">
                <td className={td}>{c.accessionNo}</td>
                <td className={td}><Badge status={c.status} /></td>
                <td className={td}><Badge status={c.condition} /></td>
                <td className={td}>{c.borrower}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}