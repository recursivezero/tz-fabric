import type { LanceRowSummary } from "@/api/lancedbAdmin";
import {
  compactValue,
  formatLanceMtime,
  rowCopyPayload,
} from "./explorerUtils";

interface LanceRowGridProps {
  rows: LanceRowSummary[];
  loading: boolean;
  appliedTag: string;
  onCopy: (value: string, successMessage: string) => void;
  onViewVector: (row: LanceRowSummary, trigger: HTMLButtonElement) => void;
  onClearFilter: () => void;
}

interface RowActionsProps {
  row: LanceRowSummary;
  onCopy: LanceRowGridProps["onCopy"];
  onViewVector: LanceRowGridProps["onViewVector"];
}

function RowActions({ row, onCopy, onViewVector }: RowActionsProps) {
  return (
    <div className="lance-admin-row-actions">
      <button
        type="button"
        onClick={() => onCopy(rowCopyPayload(row), "Row JSON copied")}
      >
        Copy JSON
      </button>
      <button
        type="button"
        onClick={(event) => onViewVector(row, event.currentTarget)}
      >
        View vector
      </button>
      {row.image_uri && (
        <button
          type="button"
          onClick={() => onCopy(row.image_uri ?? "", "Image URI copied")}
        >
          Copy URI
        </button>
      )}
      {row.hash && (
        <button
          type="button"
          onClick={() => onCopy(row.hash ?? "", "Hash copied")}
        >
          Copy hash
        </button>
      )}
    </div>
  );
}

export default function LanceRowGrid({
  rows,
  loading,
  appliedTag,
  onCopy,
  onViewVector,
  onClearFilter,
}: LanceRowGridProps) {
  if (loading) {
    return (
      <div className="lance-admin-grid-state" role="status" aria-live="polite">
        Loading table rows…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="lance-admin-grid-state lance-admin-grid-state--empty">
        <strong>
          {appliedTag
            ? `No rows match tag “${appliedTag}”.`
            : "The selected table has no rows."}
        </strong>
        {appliedTag && (
          <button
            type="button"
            className="lance-admin-button lance-admin-button--secondary"
            onClick={onClearFilter}
          >
            Clear filter
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="lance-admin-rows" aria-labelledby="lance-rows-heading">
      <div className="lance-admin-panel__heading lance-admin-rows__heading">
        <div>
          <p className="lance-admin-eyebrow">Read-only records</p>
          <h2 id="lance-rows-heading">Table rows</h2>
        </div>
      </div>

      <div className="lance-admin-table-scroll">
        <table className="lance-admin-table">
          <thead>
            <tr>
              <th scope="col">Row ID</th>
              <th scope="col">Image URI</th>
              <th scope="col">Tag</th>
              <th scope="col">Hash</th>
              <th scope="col">Modified</th>
              <th scope="col">Vector</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.row_id}>
                <td><code>{row.row_id}</code></td>
                <td title={row.image_uri ?? undefined}>
                  <code>{compactValue(row.image_uri, 34)}</code>
                </td>
                <td>
                  <span className="lance-admin-tag">{row.tag ?? "—"}</span>
                </td>
                <td title={row.hash ?? undefined}>
                  <code>{compactValue(row.hash, 22)}</code>
                </td>
                <td>{formatLanceMtime(row.mtime)}</td>
                <td>{row.vector.length.toLocaleString()} dimensions</td>
                <td>
                  <RowActions row={row} onCopy={onCopy} onViewVector={onViewVector} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lance-admin-row-cards">
        {rows.map((row) => (
          <article className="lance-admin-row-card" key={row.row_id}>
            <div className="lance-admin-row-card__topline">
              <strong>Row {row.row_id}</strong>
              <span className="lance-admin-tag">{row.tag ?? "—"}</span>
            </div>
            <dl>
              <div>
                <dt>Image URI</dt>
                <dd title={row.image_uri ?? undefined}>{compactValue(row.image_uri, 42)}</dd>
              </div>
              <div>
                <dt>Hash</dt>
                <dd title={row.hash ?? undefined}>{compactValue(row.hash, 32)}</dd>
              </div>
              <div>
                <dt>Modified</dt>
                <dd>{formatLanceMtime(row.mtime)}</dd>
              </div>
              <div>
                <dt>Vector</dt>
                <dd>{row.vector.length.toLocaleString()} dimensions</dd>
              </div>
            </dl>
            <RowActions row={row} onCopy={onCopy} onViewVector={onViewVector} />
          </article>
        ))}
      </div>
    </section>
  );
}
