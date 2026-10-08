import { useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

type ToastProps = {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
};

const EXIT_MS = 300;

const TYPE_CLASS: Record<ToastType, string> = {
  success: "bg-[#0B3D32] border-[#6F9B78]",
  error: "bg-[#8A3B35] border-[#E6C7BD]",
  warning: "bg-[#0B3D32] border-[#B98A4A]",
  info: "bg-[#0B3D32] border-[#DCE5D7]",
};

const ICON: Record<ToastType, string> = {
  success: "✓",
  error: "!",
  warning: "!",
  info: "i",
};

const ICON_CLASS: Record<ToastType, string> = {
  success: "bg-[#6F9B78] text-[#07352C]",
  error: "bg-[#F1DDD6] text-[#8A3B35]",
  warning: "bg-[#B98A4A] text-white",
  info: "bg-[#DCE5D7] text-[#0B3D32]",
};

export default function Toast({ message, type = "success", onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  const exitTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dismiss = () => {
    setVisible(false);
    window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(() => onCloseRef.current(), EXIT_MS);
  };

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setVisible(true));
    const hide = window.setTimeout(() => {
      setVisible(false);
      exitTimer.current = window.setTimeout(() => onCloseRef.current(), EXIT_MS);
    }, duration);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(hide);
      window.clearTimeout(exitTimer.current);
    };
  }, [message, type, duration]);

  return (
    <div
      className={`toast pointer-events-none fixed bottom-4 left-1/2 z-[200] w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 transition-all duration-300 ease-[cubic-bezier(.22,.8,.3,1)] sm:bottom-7 sm:w-auto sm:min-w-[260px] ${
        visible ? "show translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      }`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-[12px] border-l-4 px-5 py-3 font-sans text-[13px] leading-snug text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${TYPE_CLASS[type]}`}
      >
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold leading-none ${ICON_CLASS[type]}`}
          aria-hidden="true"
        >
          {ICON[type]}
        </span>
        <span className="min-w-0 flex-1 break-words">{message}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close notification"
          className="icon-btn grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] text-white/80 transition-colors duration-200 hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}