// Read-only oversight view. Librarians own catalog changes.
import { useMemo, useState } from "react";
import Badge from "../../components/Badge";
import DataTable, { type Column } from "../../components/DataTable";
import Modal from "../../components/Modal";
import { useAuthedLibrary } from "../../context/LibraryContext";
import * as api from "../../services/api";
import type { Book } from "../../types";
import { fullName, indexBy } from "../../utils/lookup";

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
      <p className="muted">{book.author} · ISBN {book.isbn ?? "—"} · Shelf {book.shelf_location ?? "—"}</p>
      <h3>Copies</h3>
      <div className="tbl-wrap">
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
      <h3>Queue</h3>
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

type CatalogRow = Book & { id: number; category: string | undefined; copies: number; free: number; queue: number };

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
        return { ...b, id: b.book_id, category: cats[b.category_id]?.category_name, copies: a.totalCopies, free: a.free, queue: a.queueLength };
      });
  }, [db, q, category, status]);

  const columns: Column<CatalogRow>[] = [
    { key: "title", label: "Title" },
    { key: "author", label: "Author" },
    { key: "isbn", label: "ISBN", render: (b) => b.isbn ?? "—" },
    { key: "category", label: "Category" },
    { key: "year_published", label: "Year" },
    { key: "copies", label: "Copies" },
    { key: "free", label: "Free to request" },
    { key: "queue", label: "Waiting" },
    { key: "status", label: "Status", render: (b) => <Badge status={b.status} /> },
  ];

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">Books / Catalog</h1>
      <div className="toolbar">
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
      <DataTable columns={columns} rows={rows} empty="No books match." onRowClick={(b) => setOpen(b.book_id)} />
      {open !== null && <CopiesDialog bookId={open} onClose={() => setOpen(null)} />}
    </>
  );
}