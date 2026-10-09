// Read-only oversight view. Librarians own catalog changes.
import { useMemo, useState } from "react";
import Badge from "../../components/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import Modal from "../../components/Modal";
import { useAuthedLibrary } from "../../context/LibraryContext";
import * as api from "../../services/api";
import type { Book } from "../../types";
import { fullName, indexBy } from "../../utils/lookup";

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const STAT_VALUE = "font-['Playfair_Display',serif] text-[28px] text-[#0B3D32] mt-1.5 leading-[1.1]";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";
const SUB_TITLE = "font-['Playfair_Display',serif] text-lg text-[#07352C] mt-5 mb-2";

function CopiesDialog({ bookId, onClose }: { bookId: number; onClose: () => void }) {
  const { db } = useAuthedLibrary();
  const book = db.books.find((b) => b.book_id === bookId);
  if (!book) return null;

  const users = indexBy(db.users, "user_id");
  const copies = db.book_copies.filter((c) => c.book_id === bookId);
  const borrower = (copyId: number) => {
    const l = db.borrowed_books.find((x) => x.copy_id === copyId && x.status === "Borrowed");
    return l ? fullName(users[l.user_id]) : "—";
  };
  const queue = db.reservations.filter((r) => r.book_id === bookId && ["Waiting", "Ready"].includes(r.status));

  return (
    <Modal title={book.title} onClose={onClose} wide>
      <p className="text-sm text-[#6B756F] m-0">
        {book.author} · ISBN {book.isbn ?? "—"} · Shelf {book.shelf_location ?? "—"}
      </p>

      <h3 className={SUB_TITLE}>Copies</h3>
      <div className="tbl-wrap overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr><th>Accession no.</th><th>Status</th><th>Condition</th><th>Borrower</th></tr>
          </thead>
          <tbody>
            {copies.map((c) => (
              <tr key={c.copy_id}>
                <td>{c.accession_no}</td>
                <td><Badge status={c.status} /></td>
                <td><Badge status={c.condition_status} /></td>
                <td>{borrower(c.copy_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={SUB_TITLE}>Queue</h3>
      {queue.length === 0 ? (
        <p className="muted">No reservations.</p>
      ) : (
        queue.map((r) => (
          <div className="line" key={r.reservation_id}>
            <div>{fullName(users[r.user_id])} <Badge status={r.status} /></div>
          </div>
        ))
      )}
    </Modal>
  );
}

type CatalogRow = Book & {
  id: number;
  category: string | undefined;
  copies: number;
  free: number;
  borrowed: number;
  queue: number;
};

export default function AdminCatalog() {
  const { db } = useAuthedLibrary();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo((): CatalogRow[] => {
    const term = q.trim().toLowerCase();
    const cats = indexBy(db.categories, "category_id");
    return db.books
      .filter(
        (b) =>
          (!term || [b.title, b.author, b.isbn ?? ""].some((s) => s.toLowerCase().includes(term))) &&
          (category === "all" || b.category_id === Number(category)) &&
          (status === "all" || b.status === status),
      )
      .map((b) => {
        const a = api.bookAvailability(b.book_id);
        const borrowed = db.book_copies.filter((c) => c.book_id === b.book_id && c.status === "Borrowed").length;
        return {
          ...b,
          id: b.book_id,
          category: cats[b.category_id]?.category_name,
          copies: a.totalCopies,
          free: a.free,
          borrowed,
          queue: a.queueLength,
        };
      });
  }, [db, q, category, status]);

  // Summary figures are totals of the rows currently listed.
  const totals = useMemo(
    () => ({
      titles: rows.length,
      copies: rows.reduce((n, r) => n + r.copies, 0),
      free: rows.reduce((n, r) => n + r.free, 0),
      borrowed: rows.reduce((n, r) => n + r.borrowed, 0),
      queue: rows.reduce((n, r) => n + r.queue, 0),
    }),
    [rows],
  );

  const columns: Column<CatalogRow>[] = [
    { key: "title", label: "Title" },
    { key: "author", label: "Author" },
    { key: "isbn", label: "ISBN", render: (b) => b.isbn ?? "—" },
    { key: "category", label: "Category" },
    { key: "year_published", label: "Year" },
    { key: "copies", label: "Copies" },
    { key: "free", label: "Free to request" },
    { key: "borrowed", label: "Borrowed" },
    { key: "queue", label: "Waiting" },
    { key: "status", label: "Status", render: (b) => <Badge status={b.status} /> },
  ];

  const hasFilters = Boolean(q || category !== "all" || status !== "all");

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Books / Catalog</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[680px] leading-relaxed">
        Oversee the catalog and its stock. Select a title to see its copies, borrowers and reservation queue. Catalog changes are made by librarians.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#0B3D32]`}>
          <div className={LABEL}>Titles</div>
          <div className={STAT_VALUE}>{totals.titles}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#07352C]`}>
          <div className={LABEL}>Total copies</div>
          <div className={STAT_VALUE}>{totals.copies}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#6F9B78]`}>
          <div className={LABEL}>Free to request</div>
          <div className={STAT_VALUE}>{totals.free}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#D9C19A]`}>
          <div className={LABEL}>Borrowed</div>
          <div className={STAT_VALUE}>{totals.borrowed}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#B98A4A]`}>
          <div className={LABEL}>Waiting</div>
          <div className={STAT_VALUE}>{totals.queue}</div>
        </div>
      </div>

      <div className={`toolbar ${CARD} px-[18px] py-3.5 mb-5 flex flex-wrap items-center gap-3`}>
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author or ISBN…" />
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {db.categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All</option>
          <option>Active</option>
          <option>Archived</option>
        </select>
      </div>

      <section className={`${CARD} overflow-hidden`}>
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>Catalog</h2>
            <p className={PANEL_NOTE}>Select a title to view its copies and queue.</p>
          </div>
          <span className="text-[13px] font-medium text-[#1F2A27]">
            {rows.length} {rows.length === 1 ? "title" : "titles"}
            {hasFilters ? " (filtered)" : ""}
          </span>
        </header>

        {/* Desktop and tablet: management table */}
        <div className="hidden md:block overflow-x-auto">
          <DataTable columns={columns} rows={rows} empty="No books match." onRowClick={(b) => setOpen(b.book_id)} />
        </div>

        {/* Mobile: title cards */}
        <div className="md:hidden p-3 grid gap-3">
          {rows.length === 0 && <p className="muted text-center py-6 m-0">No books match.</p>}
          {rows.map((b) => (
            <button
              key={b.book_id}
              type="button"
              onClick={() => setOpen(b.book_id)}
              className={`w-full text-left bg-[#FBFAF5] border border-[#D9DDD7] border-l-4 rounded-[12px] px-4 py-3.5 cursor-pointer transition-colors hover:bg-[#F5F3EA] ${
                b.free > 0 ? "border-l-[#6F9B78]" : "border-l-[#B98A4A]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-['Playfair_Display',serif] text-[17px] text-[#0B3D32] leading-snug">{b.title}</div>
                  <div className="text-[13px] text-[#6B756F]">{b.author}</div>
                </div>
                <Badge status={b.status} />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-3 mb-0">
                <div>
                  <dt className={LABEL}>Category</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27]">{b.category ?? "—"}</dd>
                </div>
                <div>
                  <dt className={LABEL}>ISBN</dt>
                  <dd className="m-0 mt-0.5 text-sm text-[#1F2A27] break-words">{b.isbn ?? "—"}</dd>
                </div>
              </dl>

              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#D9DDD7] text-center">
                <div>
                  <div className="font-['Playfair_Display',serif] text-lg text-[#0B3D32]">{b.copies}</div>
                  <div className={LABEL}>Copies</div>
                </div>
                <div>
                  <div className="font-['Playfair_Display',serif] text-lg text-[#0B3D32]">{b.free}</div>
                  <div className={LABEL}>Free</div>
                </div>
                <div>
                  <div className="font-['Playfair_Display',serif] text-lg text-[#0B3D32]">{b.borrowed}</div>
                  <div className={LABEL}>Out</div>
                </div>
                <div>
                  <div className="font-['Playfair_Display',serif] text-lg text-[#0B3D32]">{b.queue}</div>
                  <div className={LABEL}>Waiting</div>
                </div>
              </div>

              <div className="mt-3 text-[13px] font-medium text-[#0B3D32]">View copies and queue →</div>
            </button>
          ))}
        </div>
      </section>

      {open !== null && <CopiesDialog bookId={open} onClose={() => setOpen(null)} />}
    </>
  );
}