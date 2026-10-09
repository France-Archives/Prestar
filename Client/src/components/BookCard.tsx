import Badge from "./Badge";
import BookAction from "./BookAction";
import Cover from "./Cover";
import { useAuthedLibrary } from "../context/LibraryContext";
import * as api from "../services/api";
import type { Book, BookActionType } from "../types";
import { availabilityText } from "../utils/lookup";

type BookCardProps = {
  book: Book;
  onOpen: (book: Book) => void;
  onAction: (book: Book, action: BookActionType) => void;
};

export default function BookCard({ book, onOpen, onAction }: BookCardProps) {
  const { db, user } = useAuthedLibrary();
  const state = api.bookActionState(user.user_id, book.book_id);
  const avail = api.bookAvailability(book.book_id);
  const category = db.categories.find((c) => c.category_id === book.category_id)?.category_name;

  return (
    <article className="book-card group flex h-full flex-col rounded-[16px] border border-[#D9DDD7] bg-[#FBFAF5] p-3 shadow-[0_4px_14px_rgba(11,61,50,0.05)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.3,1)] hover:-translate-y-1.5 hover:scale-[1.015] hover:border-[#6F9B78] hover:shadow-[0_18px_40px_rgba(11,61,50,0.16)] focus-within:-translate-y-1.5 focus-within:border-[#6F9B78] focus-within:shadow-[0_18px_40px_rgba(11,61,50,0.16)]">
      <div className="book-cover-wrap relative overflow-hidden rounded-[12px] bg-[#DCE5D7] shadow-[0_8px_22px_rgba(7,53,44,0.2)]">
        <button
          className="cover-btn block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-[12px] transition-transform duration-500 ease-[cubic-bezier(.22,.8,.3,1)] group-hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]"
          onClick={() => onOpen(book)}
          aria-label={`View ${book.title}`}
        >
          <Cover book={book} />
        </button>
        <div className="pointer-events-none absolute inset-0 rounded-[12px] bg-gradient-to-t from-[#07352C]/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      <div className="shelf mx-1 mt-2 h-[3px] rounded-full bg-[#D9C19A]/70" />
      <div className="book-meta flex flex-1 flex-col gap-1.5 px-1 pb-1 pt-3">
        <span className="eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
          {category}
        </span>
        <h3 className="line-clamp-2 font-serif text-[18px] font-medium leading-snug text-[#0B3D32]">{book.title}</h3>
        <p className="font-sans text-[12.5px] text-[#6B756F]">{book.author}</p>
        <div className="mt-1">
          <Badge status={avail.free > 0 ? "Available" : "Lost"}>{availabilityText(avail)}</Badge>
        </div>
        <div className="card-actions mt-auto flex flex-col gap-2 pt-3 transition-all duration-300 md:translate-y-1 md:opacity-80 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
          <BookAction state={state} onClick={() => onAction(book, state.action)} />
          <button
            className="btn ghost inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-4 font-sans text-[13px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98]"
            onClick={() => onOpen(book)}
          >
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}