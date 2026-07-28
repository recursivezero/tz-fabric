import { type FormEvent, useEffect, useState } from "react";
import type { LanceSortColumn, LanceSortOrder } from "@/api/lancedbAdmin";

interface LanceFilterBarProps {
  appliedTag: string;
  sortBy: LanceSortColumn | null;
  sortOrder: LanceSortOrder;
  pageSize: number;
  loading: boolean;
  onTagApply: (tag: string) => void;
  onSortChange: (column: LanceSortColumn | null, order: LanceSortOrder) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function LanceFilterBar({
  appliedTag,
  sortBy,
  sortOrder,
  pageSize,
  loading,
  onTagApply,
  onSortChange,
  onPageSizeChange,
}: LanceFilterBarProps) {
  const [tagInput, setTagInput] = useState(appliedTag);

  useEffect(() => setTagInput(appliedTag), [appliedTag]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onTagApply(tagInput);
  };

  return (
    <section className="lance-admin-filter" aria-label="Row filtering and sorting">
      <form className="lance-admin-filter__tag" onSubmit={submit}>
        <label className="lance-admin-field">
          <span>Exact tag filter</span>
          <input
            type="search"
            value={tagInput}
            maxLength={128}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder="e.g. product"
            disabled={loading}
          />
        </label>
        <button type="submit" className="lance-admin-button" disabled={loading}>
          Apply
        </button>
        {(appliedTag || tagInput) && (
          <button
            type="button"
            className="lance-admin-button lance-admin-button--quiet"
            onClick={() => {
              setTagInput("");
              onTagApply("");
            }}
            disabled={loading}
          >
            Clear
          </button>
        )}
      </form>
      <label className="lance-admin-field">
        <span>Sort column</span>
        <select
          value={sortBy ?? ""}
          onChange={(event) =>
            onSortChange(
              (event.target.value || null) as LanceSortColumn | null,
              sortOrder,
            )
          }
          disabled={loading}
        >
          <option value="">Default order</option>
          <option value="image_uri">Image URI</option>
          <option value="tag">Tag</option>
          <option value="hash">Hash</option>
          <option value="mtime">Modified time</option>
        </select>
      </label>
      <label className="lance-admin-field">
        <span>Direction</span>
        <select
          value={sortOrder}
          onChange={(event) =>
            onSortChange(sortBy, event.target.value as LanceSortOrder)
          }
          disabled={loading || !sortBy}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
      <label className="lance-admin-field">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          disabled={loading}
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
