import { ArrowLeft, ArrowRight } from "lucide-react";
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
      <Button variant="ghost" size="sm" className="pager__button pager__previous" aria-label="Previous page" disabled={page <= 1} onClick={onPrev}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span className="pager__button-label">Prev</span>
      </Button>
      <span className="pager__summary">
        <span className="pager__range">{from}–{to} of {total}</span>
        <span className="pager__page">Page {page} of {totalPages}</span>
        <span className="pager__progress" aria-hidden="true">
          <span className="pager__progress-fill" style={{ width: `${(page / totalPages) * 100}%` }} />
        </span>
      </span>
      <Button variant="ghost" size="sm" className="pager__button pager__next" aria-label="Next page" disabled={page >= totalPages} onClick={onNext}>
        <span className="pager__button-label">Next</span>
        <ArrowRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}