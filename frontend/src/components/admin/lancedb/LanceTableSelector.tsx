import type { LanceTableItem } from "@/api/lancedbAdmin";

interface LanceTableSelectorProps {
  tables: LanceTableItem[];
  selectedTable: string | null;
  loading: boolean;
  refreshing: boolean;
  onSelect: (tableName: string) => void;
  onRefresh: () => void;
  onLock: () => void;
}

export default function LanceTableSelector({
  tables,
  selectedTable,
  loading,
  refreshing,
  onSelect,
  onRefresh,
  onLock,
}: LanceTableSelectorProps) {
  return (
    <section className="lance-admin-toolbar" aria-label="LanceDB table controls">
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
          {refreshing ? "Refreshing…" : "Refresh"}
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
