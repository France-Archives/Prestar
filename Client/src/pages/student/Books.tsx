import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookCard from "../../components/BookCard";
import BookModal from "../../components/BookModal";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import Pager from "../../components/Pager";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { usePaged } from "../../hooks/usePaged";
import * as api from "../../services/api";
import type { Book, BookActionType } from "../../types";

const PAGE_SIZE = 8;
type SortKey = "title" | "newest" | "popular";
type PendingAction = { book: Book; action: "request" | "reserve" };

export default function Books() {
  const { db, user, act } = useAuthedLibrary();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState("all");
  const [avail, setAvail] = useState("all");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState<SortKey>("title");
  const [selected, setSelected] = useState<Book | null>(null);
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, wrap] = useBusy();

  // MOCK API — REPLACE WITH REAL API CALL LATER (simulated loading state)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    // popularity is derived from loan counts, not stored
    const pop: Record<number, number> = {};
    db.borrowed_books.forEach((l) => {
      pop[l.book_id] = (pop[l.book_id] ?? 0) + 1;
    });
    const list = db.books.filter(
      (b) =>
        b.status === "Active" &&
        (category === "all" || b.category_id === Number(category)) &&
        (!term || [b.title, b.author, b.isbn ?? ""].some((s) => s.toLowerCase().includes(term))) &&
        (!year || String(b.year_published) === year.trim()) &&
        (avail === "all" || (api.freeToRequest(b.book_id) > 0) === (avail === "available")),
    );
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "newest") list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else list.sort((a, b) => (pop[b.book_id] ?? 0) - (pop[a.book_id] ?? 0));
    return list;
  }, [db, q, category, avail, year, sort]);

  const { page, pages, setPage, slice } = usePaged(results, PAGE_SIZE);
  useEffect(() => {
    setPage(1);
  }, [q, category, avail, year, sort, setPage]);

  const clear = () => {
    setQ("");
    setCategory("all");
    setAvail("all");
    setYear("");
    setSort("title");
  };

  const ask = (book: Book, action: BookActionType) => {
    if (action === "request" || action === "reserve") setConfirm({ book, action });
  };

  const run = wrap(async () => {
    if (!confirm) return;
    const { book, action } = confirm;
    const call = action === "request" ? api.createRequest(user.user_id, book.book_id) : api.createReservation(user.user_id, book.book_id);
    const res = await act(call, action === "request" ? "Request sent." : "You joined the waiting list.");
    setConfirm(null);
    if (res.ok) setSelected(null);
  });

  const queue = confirm ? api.bookAvailability(confirm.book.book_id).queueLength : 0;

  return (
    <>
      <span className="eyebrow">BOOK COLLECTION</span>
      <h1 className="page-title">Books</h1>
      <div className="toolbar">
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author or ISBN…" aria-label="Search books" />
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {db.categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
        </select>
        <select className="input" value={avail} onChange={(e) => setAvail(e.target.value)} aria-label="Availability">
          <option value="all">All</option>
          <option value="available">Available now</option>
          <option value="not">Not available</option>
        </select>
        <input className="input narrow" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" aria-label="Publication year" />
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="title">Title A–Z</option>
          <option value="newest">Newest added</option>
          <option value="popular">Most borrowed</option>
        </select>
        <button className="btn ghost sm" onClick={clear}>Clear filters</button>
      </div>

      {loading ? (
        <p className="muted">Loading books…</p>
      ) : results.length === 0 ? (
        <EmptyState title="No books match your search" text="Try different words or clear the filters." action={<button className="btn ghost sm" onClick={clear}>Clear filters</button>} />
      ) : (
        <>
          <div className="shelf-row">
            {slice.map((b) => <BookCard key={b.book_id} book={b} onOpen={setSelected} onAction={ask} />)}
          </div>
          <Pager page={page} pages={pages} onChange={setPage} />
        </>
      )}

      {selected && <BookModal book={selected} onClose={() => setSelected(null)} onAction={ask} />}

      {confirm && (
        <ConfirmDialog
          title={confirm.action === "request" ? "Request this book?" : "Join the waiting list?"}
          confirmLabel={confirm.action === "request" ? "Request" : "Reserve"}
          busy={busy}
          onConfirm={run}
          onClose={() => setConfirm(null)}
        >
          <p><b>{confirm.book.title}</b></p>
          {confirm.action === "request" ? (
            <p>If approved, you will have a limited time to pick it up at the library.</p>
          ) : (
            <p>{queue} {queue === 1 ? "student is" : "students are"} waiting. You keep your place in the queue.</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}