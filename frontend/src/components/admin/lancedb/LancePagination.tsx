import type { LancePagination as PaginationState } from "@/api/lancedbAdmin";

interface LancePaginationProps {
  pagination: PaginationState | null;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export default function LancePagination({
  pagination,
  loading,
  onPageChange,
}: LancePaginationProps) {
  if (!pagination || pagination.total_rows === 0) return null;

  const firstRow = (pagination.page - 1) * pagination.page_size + 1;
  const lastRow = Math.min(
    pagination.page * pagination.page_size,
    pagination.total_rows,
  );

  return (
    <nav className="lance-admin-pagination" aria-label="LanceDB row pages">
      <p>
        Showing <strong>{firstRow.toLocaleString()}–{lastRow.toLocaleString()}</strong>
        {" of "}
        <strong>{pagination.total_rows.toLocaleString()}</strong> rows
      </p>
      <div>
        <button
          type="button"
          className="lance-admin-button lance-admin-button--secondary"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={loading || !pagination.has_previous}
        >
          ← Previous
        </button>
        <span aria-current="page">
          Page {pagination.page.toLocaleString()} / {pagination.total_pages.toLocaleString()}
        </span>
        <button
          type="button"
          className="lance-admin-button lance-admin-button--secondary"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={loading || !pagination.has_next}
        >
          Next →
        </button>
      </div>
    </nav>
  );
}
