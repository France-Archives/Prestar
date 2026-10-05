type PagerProps = { page: number; pages: number; onChange: (page: number) => void };

export default function Pager({ page, pages, onChange }: PagerProps) {
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn ghost sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn ghost sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}