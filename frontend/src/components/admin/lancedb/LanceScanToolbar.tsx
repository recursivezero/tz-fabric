import type { LanceDataSource, LanceTableItem } from "@/api/lancedbAdmin";

interface LanceScanToolbarProps {
  source: LanceDataSource;
  tables: LanceTableItem[];
  selectedTable: string | null;
  loading: boolean;
  refreshing: boolean;
  onSelect: (tableName: string) => void;
  onRefresh: () => void;
  onChangeSource: () => void;
  onLock: () => void;
}

export default function LanceScanToolbar({
  source,
  tables,
  selectedTable,
  loading,
  refreshing,
  onSelect,
  onRefresh,
  onChangeSource,
  onLock,
}: LanceScanToolbarProps) {
  const storageLabel =
    source.storage === "s3"
      ? "Amazon S3"
      : source.storage === "r2"
        ? "Cloudflare R2"
        : "Local database";
  const sourceLocation =
    source.location?.trim() || "Backend configured source";

  return (
    <section className="lance-admin-toolbar" aria-label="LanceDB table controls">
      <div className="lance-admin-toolbar__source">
        <span>{storageLabel}</span>
        <code title={sourceLocation}>{sourceLocation}</code>
      </div>
      <label className="lance-admin-field lance-admin-field--table">
        <span>Table</span>
        <select
          value={selectedTable ?? ""}
          onChange={(event) => onSelect(event.target.value)}
          disabled={loading || tables.length === 0}
        >
          {tables.length === 0 ? (
            <option value="">No tables available</option>
          ) : (
            tables.map((table) => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))
          )}
        </select>
      </label>
      <div className="lance-admin-toolbar__actions">
        <button
          type="button"
          className="lance-admin-button lance-admin-button--secondary"
          onClick={onRefresh}
          disabled={refreshing || loading}
        >
          {refreshing ? "Scanning…" : "Rescan"}
        </button>
        <button
          type="button"
          className="lance-admin-button lance-admin-button--secondary"
          onClick={onChangeSource}
        >
          Change source
        </button>
        <button
          type="button"
          className="lance-admin-button lance-admin-button--quiet"
          onClick={onLock}
        >
          Lock explorer
        </button>
      </div>
    </section>
  );
}
