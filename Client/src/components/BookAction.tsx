import type { BookActionState } from "../types";

// Shows the Request / Reserve button the backend decided on, plus the reason when it is disabled.
type BookActionProps = { state: BookActionState; onClick: () => void };

export default function BookAction({ state, onClick }: BookActionProps) {
  const canClick = !state.disabled && (state.action === "request" || state.action === "reserve");
  return (
    <>
      <button className="btn primary" disabled={!canClick} onClick={onClick}>{state.label}</button>
      {state.reason && <small className="reason">{state.reason}</small>}
    </>
  );
}