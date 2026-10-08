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

const CONTROL_CLS =
  "input h-11 rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-3.5 font-sans text-[13px] text-[#1F2A27] shadow-none transition-all duration-200 placeholder:text-[#9AA59F] hover:border-[#6F9B78] focus:border-[#6F9B78] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6F9B78]/40";

const CHIP_BASE =
  "shrink-0 rounded-full border px-4 py-1.5 font-sans text-[12px] font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]";

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
    <div className="mx-auto w-full font-sans text-[#1F2A27]">
      {/* Heading */}
      <header className="relative overflow-hidden rounded-[22px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 py-8 shadow-[0_4px_14px_rgba(11,61,50,0.05)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#DCE5D7]/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#D9C19A]/40 blur-3xl" />
        <div className="relative">
          <span className="eyebrow mb-2 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
            <span className="h-px w-8 bg-[#B98A4A]" />
            BOOK COLLECTION
          </span>
          <h1 className="page-title font-serif text-[clamp(32px,5.5vw,52px)] font-medium leading-[1.08] tracking-[-0.01em] text-[#0B3D32]">
            Books
          </h1>
          <div className="relative mt-6 max-w-[720px]">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[#6B756F]" aria-hidden="true">
              ⌕
            </span>
            <input
              className={`${CONTROL_CLS} h-12 w-full rounded-full pl-11 pr-5 text-[14px] shadow-[0_4px_14px_rgba(11,61,50,0.05)]`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, author or ISBN…"
              aria-label="Search books"
            />
          </div>
        </div>
      </header>

      {/* Category chips */}
      <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-2">
        <button
          type="button"
          className={`${CHIP_BASE} ${
            category === "all"
              ? "border-[#0B3D32] bg-[#0B3D32] text-white shadow-[0_4px_10px_rgba(11,61,50,0.2)]"
              : "border-[#D9DDD7] bg-[#FBFAF5] text-[#0B3D32] hover:border-[#6F9B78]"
          }`}
          onClick={() => setCategory("all")}
        >
          All categories
        </button>
        {db.categories.map((c) => {
          const active = category === String(c.category_id);
          return (
            <button
              key={c.category_id}
              type="button"
              className={`${CHIP_BASE} ${
                active
                  ? "border-[#0B3D32] bg-[#0B3D32] text-white shadow-[0_4px_10px_rgba(11,61,50,0.2)]"
                  : "border-[#D9DDD7] bg-[#FBFAF5] text-[#0B3D32] hover:border-[#6F9B78]"
              }`}
              onClick={() => setCategory(String(c.category_id))}
            >
              {c.category_name}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="toolbar mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
        <select
          className={`${CONTROL_CLS} col-span-2 sm:col-span-1`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
        >
          <option value="all">All categories</option>
          {db.categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.category_name}
            </option>
          ))}
        </select>
        <select className={CONTROL_CLS} value={avail} onChange={(e) => setAvail(e.target.value)} aria-label="Availability">
          <option value="all">All</option>
          <option value="available">Available now</option>
          <option value="not">Not available</option>
        </select>
        <input
          className={`${CONTROL_CLS} narrow w-full sm:w-[110px]`}
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Year"
          aria-label="Publication year"
        />
        <select className={CONTROL_CLS} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="title">Title A–Z</option>
          <option value="newest">Newest added</option>
          <option value="popular">Most borrowed</option>
        </select>
        <button
          className="btn ghost sm col-span-2 inline-flex h-11 items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 font-sans text-[12.5px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] sm:col-span-1 sm:ml-auto"
          onClick={clear}
        >
          Clear filters
        </button>
      </div>

      {/* Results */}
      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[420px] animate-pulse rounded-[16px] border border-[#D9DDD7] bg-[#DCE5D7]/50" />
            ))}
            <p className="muted sr-only">Loading books…</p>
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title="No books match your search"
            text="Try different words or clear the filters."
            action={
              <button
                className="btn ghost sm inline-flex h-10 items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-5 font-sans text-[12.5px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98]"
                onClick={clear}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <p className="muted mb-4 font-sans text-[12.5px] text-[#6B756F]">
              {results.length} {results.length === 1 ? "book" : "books"}
            </p>
            <div className="shelf-row grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {slice.map((b) => (
                <BookCard key={b.book_id} book={b} onOpen={setSelected} onAction={ask} />
              ))}
            </div>
            <div className="mt-8">
              <Pager page={page} pages={pages} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      {selected && <BookModal book={selected} onClose={() => setSelected(null)} onAction={ask} />}

      {confirm && (
        <ConfirmDialog
          title={confirm.action === "request" ? "Request this book?" : "Join the waiting list?"}
          confirmLabel={confirm.action === "request" ? "Request" : "Reserve"}
          busy={busy}
          onConfirm={run}
          onClose={() => setConfirm(null)}
        >
          <p>
            <b>{confirm.book.title}</b>
          </p>
          {confirm.action === "request" ? (
            <p>If approved, you will have a limited time to pick it up at the library.</p>
          ) : (
            <p>
              {queue} {queue === 1 ? "student is" : "students are"} waiting. You keep your place in the queue.
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}