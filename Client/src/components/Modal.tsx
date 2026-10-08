import { useEffect, type ReactNode } from "react";

type ModalProps = { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean };

export default function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="dlg-overlay fixed inset-0 z-[100] grid place-items-center bg-[rgba(7,53,44,0.62)] p-4 backdrop-blur-[3px] animate-[fade_0.25s_cubic-bezier(.22,.8,.3,1)] sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`dlg ${wide ? "wide" : ""} flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[20px] border border-[#D9DDD7] bg-[#FBFAF5] font-sans text-[#1F2A27] shadow-[0_24px_64px_rgba(7,53,44,0.28),0_4px_14px_rgba(7,53,44,0.08)] animate-[rise_0.35s_cubic-bezier(.22,.8,.3,1)] sm:max-h-[88vh] ${
          wide ? "max-w-[820px]" : "max-w-[520px]"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dlg-head flex items-start justify-between gap-4 border-b border-[#D9DDD7] px-5 py-4 sm:px-8 sm:py-5">
          <h2 className="font-serif text-[22px] font-medium leading-tight tracking-[-0.005em] text-[#0B3D32] sm:text-[26px]">
            {title}
          </h2>
          <button
            className="icon-btn grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[16px] text-[#0B3D32] transition-colors duration-200 hover:bg-[#DCE5D7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="dlg-body flex-1 overflow-y-auto px-5 py-5 text-[14px] leading-relaxed text-[#1F2A27] sm:px-8 sm:py-6">
          {children}
        </div>
        {footer && (
          <div className="dlg-foot flex flex-wrap items-center justify-end gap-3 border-t border-[#D9DDD7] bg-[#F5F3EA] px-5 py-4 sm:px-8">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}