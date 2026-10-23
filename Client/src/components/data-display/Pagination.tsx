import Button from "../ui/Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function Pagination({ page, totalPages, from, to, total, onPrev, onNext }: PaginationProps) {
  if (total === 0 || totalPages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={onPrev}>
        ← Prev
      </Button>
      <span className="subtle">
        {from}–{to} of {total} · Page {page} of {totalPages}
      </span>
      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={onNext}>
        Next →
      </Button>
    </nav>
  );
}