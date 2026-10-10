import Skeleton from "../ui/Skeleton";

export default function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={i === 0 ? 28 : 56} width={i === 0 ? "40%" : "100%"} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}