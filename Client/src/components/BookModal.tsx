import { useCallback, useEffect, useState } from "react";
import Badge from "./Badge";
import BookAction from "./BookAction";
import Cover from "./Cover";
import { useAuthedLibrary } from "../context/LibraryContext";
import * as api from "../services/api";
import type { Book, BookActionType } from "../types";
import { availabilityText } from "../utils/lookup";

type BookModalProps = {
  book: Book;
  onClose: () => void;
  onAction: (book: Book, action: BookActionType) => void;
};

export default function BookModal({ book, onClose, onAction }: BookModalProps) {
  const { db, user } = useAuthedLibrary();
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const state = api.bookActionState(user.user_id, book.book_id);
  const avail = api.bookAvailability(book.book_id);
  const category = db.categories.find((c) => c.category_id === book.category_id)?.category_name;

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "ISBN", value: book.isbn ?? "—" },
    { label: "Publisher", value: book.publisher ?? "—" },
    { label: "Edition", value: book.edition ?? "—" },
    { label: "Published", value: book.year_published ?? "—" },
    { label: "Shelf", value: book.shelf_location ?? "—" },
    { label: "Copies", value: `${avail.free} free of ${avail.circulating}` },
    { label: "Waiting", value: avail.queueLength },
  ];

  return (
    <div
      className={`overlay ${closing ? "out" : ""} fixed inset-0 z-[100] grid place-items-center bg-[rgba(7,53,44,0.62)] p-3 backdrop-blur-[3px] transition-opacity duration-200 sm:p-6 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className={`modal relative flex max-h-[94vh] w-full max-w-[960px] flex-col overflow-y-auto rounded-[20px] border border-[#D9DDD7] bg-[#FBFAF5] font-sans text-[#1F2A27] shadow-[0_24px_64px_rgba(7,53,44,0.3),0_4px_14px_rgba(7,53,44,0.08)] transition-all duration-200 ease-[cubic-bezier(.22,.8,.3,1)] md:max-h-[88vh] md:flex-row md:overflow-hidden ${
          closing ? "translate-y-3 scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
      >
        <button
          className="modal-close absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-[#FBFAF5]/90 text-[15px] text-[#0B3D32] shadow-[0_2px_8px_rgba(7,53,44,0.15)] transition-colors duration-200 hover:bg-[#DCE5D7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] md:right-4 md:top-4"
          onClick={close}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="modal-cover flex shrink-0 items-center justify-center bg-[#F5F3EA] px-8 pb-6 pt-10 md:w-[340px] md:border-r md:border-[#D9DDD7] md:px-10 md:py-10">
          <div className="w-[170px] drop-shadow-[0_18px_28px_rgba(7,53,44,0.28)] sm:w-[200px] md:w-full md:max-w-[260px]">
            <Cover book={book} large />
          </div>
        </div>

        <div className="modal-body flex min-w-0 flex-1 flex-col gap-3 px-5 pb-6 pt-5 sm:px-8 md:overflow-y-auto md:px-10 md:py-10">
          <span className="eyebrow block font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
            {category}
          </span>
          <h2 className="pr-8 font-serif text-[28px] font-medium leading-[1.12] tracking-[-0.005em] text-[#0B3D32] sm:text-[34px] md:text-[38px]">
            {book.title}
          </h2>
          <p className="author font-sans text-[14px] text-[#6B756F]">by {book.author}</p>
          <div className="modal-badges flex flex-wrap items-center gap-2">
            <Badge status={avail.free > 0 ? "Available" : "Lost"}>{availabilityText(avail)}</Badge>
          </div>
          {book.description && (
            <p className="desc mt-1 max-w-[62ch] font-sans text-[14px] leading-relaxed text-[#1F2A27]">{book.description}</p>
          )}

          <dl className="facts mt-3 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[#D9DDD7] pt-5 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="font-sans text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#6B756F]">{f.label}</dt>
                <dd className="m-0 mt-0.5 break-words font-sans text-[13.5px] font-medium text-[#1F2A27]">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="modal-actions mt-4 flex flex-wrap items-center gap-3 border-t border-[#D9DDD7] pt-5 [&>*]:w-full sm:[&>*]:w-auto sm:[&>*]:min-w-[200px]">
            <BookAction state={state} onClick={() => onAction(book, state.action)} />
          </div>
        </div>
      </div>
    </div>
  );
}