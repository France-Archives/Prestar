import { useCallback, useState } from "react";
import ConfirmDialog, { type ConfirmDetails, type ConfirmVariant } from "@/components/feedback/ConfirmDialog";
import type { ReactNode } from "react";

export interface ConfirmationRequest {
  title: string;
  message?: string;
  details?: ConfirmDetails[];
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function useConfirm() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const ask = useCallback((next: ConfirmationRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);
  const dialog = request ? (
    <ConfirmDialog {...request} onClose={close} />
  ) : null;

  return { ask, close, dialog };
}
