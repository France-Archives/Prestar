import type { ReactNode } from "react";
import Modal from "./Modal";

type ConfirmDialogProps = {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmDialog({ title, children, confirmLabel = "Confirm", danger, busy, confirmDisabled, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`btn primary sm ${danger ? "danger" : ""}`} onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}