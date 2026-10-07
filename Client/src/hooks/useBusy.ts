import { useState } from "react";

// const [busy, wrap] = useBusy();  const onClick = wrap(async () => {...});
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const wrap =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      setBusy(true);
      try {
        return await fn(...args);
      } finally {
        setBusy(false);
      }
    };
  return [busy, wrap] as const;
}