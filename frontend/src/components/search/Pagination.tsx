interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  variant?: "inline" | "bottom";
}

export default function Pagination({ page, totalPages, onPrev, onNext, variant = "bottom" }: PaginationProps) {
  return (
    <div className={`pagination pagination--${variant}`}>
      <button className="pagination__btn" onClick={onPrev} disabled={page === 1} type="button">
        ← Prev
      </button>
      <span className="pagination__label">Page {page} / {totalPages}</span>
      <button className="pagination__btn" onClick={onNext} disabled={page === totalPages} type="button">
        Next →
      </button>
    </div>
  );
}
