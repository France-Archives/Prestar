import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
  descriptionId?: string;
  role?: "dialog" | "alertdialog";
  initialFocus?: "cancel" | "confirm";
  closeBlocked?: boolean;
  /** Dim + blur backdrop with a pop-in animation (used by the book details popup). */
  cinema?: boolean;
}

export default function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
  cinema = false,
  className = "",
  descriptionId,
  role = "dialog",
  initialFocus,
  closeBlocked = false,
}: ModalProps) {
  const titleId = useId();
  const overlayClass = className.split(" ").includes("confirm-dialog") ? " dialog-overlay--confirm" : "";
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closeBlockedRef = useRef(closeBlocked);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  onCloseRef.current = onClose;
  closeBlockedRef.current = closeBlocked;

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const getFocusable = () => [...(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])].filter((element) => {
      const style = window.getComputedStyle(element);
      return !element.closest("[hidden]") && style.visibility !== "hidden" && style.display !== "none";
    });
    const preferredFocus = initialFocus
      ? dialog?.querySelector<HTMLElement>(`[data-modal-focus="${initialFocus}"]:not([disabled])`)
      : null;
    (preferredFocus ?? getFocusable()[0] ?? dialog)?.focus();
    const onKey = (e: KeyboardEvent) => {
      const overlays = document.querySelectorAll(".dialog-overlay");
      if (overlays[overlays.length - 1] !== overlayRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (!closeBlockedRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      previousFocusRef.current?.focus();
    };
  }, [initialFocus]);

  return (
    <div ref={overlayRef} className={`dialog-overlay${cinema ? " dialog-overlay-cinema" : ""}${overlayClass}`} onMouseDown={(e) => e.target === e.currentTarget && !closeBlocked && onClose()}>
      <div
        ref={dialogRef}
        className={`dialog ${wide ? "dialog-wide" : ""} ${cinema ? "dialog-cinema" : ""} ${className}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="link-btn" onClick={onClose} aria-label="Close dialog" disabled={closeBlocked}>
            ✕
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}