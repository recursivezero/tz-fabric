import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLanceRowDetail,
  fetchLanceRows,
  fetchLanceTableDetails,
  fetchLanceTables,
  isAdminAccessError,
  isMissingTableError,
  type LanceRowDetail,
  type LanceRowSummary,
  type LanceRowsResponse,
  type LanceTableDetails,
  type LanceTableItem,
  type LanceSortColumn,
  type LanceSortOrder,
} from "@/api/lancedbAdmin";
import LanceAdminGate from "@/components/admin/lancedb/LanceAdminGate";
import LanceFilterBar from "@/components/admin/lancedb/LanceFilterBar";
import LanceMetadataPanel from "@/components/admin/lancedb/LanceMetadataPanel";
import LancePagination from "@/components/admin/lancedb/LancePagination";
import LanceRowGrid from "@/components/admin/lancedb/LanceRowGrid";
import LanceSchemaPanel from "@/components/admin/lancedb/LanceSchemaPanel";
import LanceSummaryCards from "@/components/admin/lancedb/LanceSummaryCards";
import LanceTableSelector from "@/components/admin/lancedb/LanceTableSelector";
import VectorViewer from "@/components/admin/lancedb/VectorViewer";
import {
  applyExplorerPageSize,
  applyExplorerSort,
  applyExplorerTag,
  resetExplorerQuery,
  writeTextToClipboard,
  type ExplorerQueryState,
} from "@/components/admin/lancedb/explorerUtils";
import { logger } from "@/utils/logger";
import "@/assets/styles/LanceDBExplorer.css";

const ACCESS_REJECTED_MESSAGE = "Administrator access was rejected.";
const BACKEND_UNAVAILABLE_MESSAGE =
  "LanceDB could not be reached. Check the backend and try refreshing.";

function readableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export default function LanceDBExplorer() {
  const [secret, setSecret] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [tables, setTables] = useState<LanceTableItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const selectedTableRef = useRef<string | null>(null);
  const [details, setDetails] = useState<LanceTableDetails | null>(null);
  const [rowsResponse, setRowsResponse] = useState<LanceRowsResponse | null>(null);
  const [query, setQuery] = useState<ExplorerQueryState>(resetExplorerQuery);

  const [tablesLoading, setTablesLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tablesRevision, setTablesRevision] = useState(0);
  const [detailsRevision, setDetailsRevision] = useState(0);
  const [rowsRevision, setRowsRevision] = useState(0);

  const [vectorRow, setVectorRow] = useState<LanceRowSummary | null>(null);
  const [vectorDetail, setVectorDetail] = useState<LanceRowDetail | null>(null);
  const [vectorLoading, setVectorLoading] = useState(false);
  const [vectorError, setVectorError] = useState<string | null>(null);
  const [vectorTrigger, setVectorTrigger] = useState<HTMLButtonElement | null>(null);
  const vectorControllerRef = useRef<AbortController | null>(null);

  const [copyStatus, setCopyStatus] = useState("");
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  const clearExplorerData = useCallback(() => {
    selectedTableRef.current = null;
    setTables([]);
    setSelectedTable(null);
    setDetails(null);
    setRowsResponse(null);
    setQuery(resetExplorerQuery());
    setTablesError(null);
    setDetailsError(null);
    setRowsError(null);
    setNotice(null);
    setVectorRow(null);
    setVectorDetail(null);
    setVectorError(null);
  }, []);

  const lockExplorer = useCallback(
    (message: string | null = null) => {
      vectorControllerRef.current?.abort();
      setSecret(null);
      setUnlocking(false);
      setAccessError(message);
      clearExplorerData();
    },
    [clearExplorerData],
  );

  const handleRequestFailure = useCallback(
    (
      error: unknown,
      fallback: string,
      setRequestError: (message: string | null) => void,
    ) => {
      if (isAdminAccessError(error)) {
        lockExplorer(ACCESS_REJECTED_MESSAGE);
        return;
      }
      logger.error("LanceDB administrator request failed", error);
      setRequestError(readableError(error, fallback));
    },
    [lockExplorer],
  );

  useEffect(() => {
    if (!secret) return undefined;

    const controller = new AbortController();
    setTablesLoading(true);
    setTablesError(null);

    void fetchLanceTables(secret, controller.signal)
      .then((response) => {
        const available = response.tables;
        const current = selectedTableRef.current;
        setTables(available);

        if (current && available.some((table) => table.name === current)) {
          return;
        }

        if (current) {
          setNotice(
            "The previously selected table no longer exists. The table list was refreshed.",
          );
        }

        const nextTable = available[0]?.name ?? null;
        selectedTableRef.current = nextTable;
        setSelectedTable(nextTable);
        setDetails(null);
        setRowsResponse(null);
        setQuery(resetExplorerQuery());
        setVectorRow(null);
        setVectorDetail(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        handleRequestFailure(
          error,
          BACKEND_UNAVAILABLE_MESSAGE,
          setTablesError,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTablesLoading(false);
          setUnlocking(false);
        }
      });

    return () => controller.abort();
  }, [handleRequestFailure, secret, tablesRevision]);

  useEffect(() => {
    if (!secret || !selectedTable) return undefined;

    const controller = new AbortController();
    setDetailsLoading(true);
    setDetailsError(null);

    void fetchLanceTableDetails(selectedTable, secret, controller.signal)
      .then((response) => {
        setDetails(response);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isMissingTableError(error)) {
          setNotice("The selected table no longer exists. Reloading available tables.");
          setTablesRevision((revision) => revision + 1);
          return;
        }
        handleRequestFailure(
          error,
          "Unable to load the selected table details.",
          setDetailsError,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });

    return () => controller.abort();
  }, [detailsRevision, handleRequestFailure, secret, selectedTable]);

  useEffect(() => {
    if (!secret || !selectedTable) return undefined;

    const controller = new AbortController();
    setRowsLoading(true);
    setRowsError(null);

    void fetchLanceRows(
      selectedTable,
      secret,
      {
        page: query.page,
        pageSize: query.pageSize,
        tag: query.tag,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      controller.signal,
    )
      .then((response) => {
        setRowsResponse(response);
        if (response.pagination.page !== query.page) {
          setQuery((current) => ({
            ...current,
            page: response.pagination.page,
          }));
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isMissingTableError(error)) {
          setNotice("The selected table no longer exists. Reloading available tables.");
          setTablesRevision((revision) => revision + 1);
          return;
        }
        handleRequestFailure(
          error,
          "Unable to load LanceDB rows.",
          setRowsError,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRowsLoading(false);
      });

    return () => controller.abort();
  }, [handleRequestFailure, query, rowsRevision, secret, selectedTable]);

  useEffect(
    () => () => {
      vectorControllerRef.current?.abort();
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    },
    [],
  );

  const unlockExplorer = (enteredSecret: string) => {
    clearExplorerData();
    setAccessError(null);
    setUnlocking(true);
    setSecret(enteredSecret);
  };

  const selectTable = (tableName: string) => {
    selectedTableRef.current = tableName;
    setTablesError(null);
    setSelectedTable(tableName);
    setDetails(null);
    setRowsResponse(null);
    setQuery(resetExplorerQuery());
    setDetailsError(null);
    setRowsError(null);
    setNotice(null);
    setVectorRow(null);
    setVectorDetail(null);
  };

  const refreshExplorer = () => {
    setTablesError(null);
    setDetailsError(null);
    setRowsError(null);
    setNotice(null);
    setTablesRevision((revision) => revision + 1);
    setDetailsRevision((revision) => revision + 1);
    setRowsRevision((revision) => revision + 1);
  };

  const copyText = async (value: string, successMessage: string) => {
    try {
      await writeTextToClipboard(value);
      setCopyStatus(successMessage);
    } catch (error) {
      logger.warn("Clipboard write failed", error);
      setCopyStatus("Copy failed. Your browser may block clipboard access.");
    }

    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopyStatus(""), 2400);
  };

  const closeVector = useCallback(() => {
    vectorControllerRef.current?.abort();
    setVectorRow(null);
    setVectorDetail(null);
    setVectorError(null);
    setVectorLoading(false);
    setVectorTrigger(null);
  }, []);

  const loadVector = useCallback(
    (row: LanceRowSummary, trigger: HTMLButtonElement | null) => {
      if (!secret || !selectedTable) return;

      vectorControllerRef.current?.abort();
      const controller = new AbortController();
      vectorControllerRef.current = controller;
      setVectorRow(row);
      if (trigger) setVectorTrigger(trigger);
      setVectorDetail(null);
      setVectorError(null);
      setVectorLoading(true);

      void fetchLanceRowDetail(
        selectedTable,
        row.row_id,
        secret,
        controller.signal,
      )
        .then((response) => setVectorDetail(response))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (isAdminAccessError(error)) {
            lockExplorer(ACCESS_REJECTED_MESSAGE);
            return;
          }
          logger.error("LanceDB vector detail request failed", error, {
            table: selectedTable,
            rowId: row.row_id,
          });
          setVectorError(readableError(error, "Unable to load the full vector."));
        })
        .finally(() => {
          if (!controller.signal.aborted) setVectorLoading(false);
        });
    },
    [lockExplorer, secret, selectedTable],
  );

  if (!secret) {
    return (
      <div className="lance-admin-page lance-admin-page--locked">
        <LanceAdminGate
          loading={unlocking}
          error={accessError}
          onUnlock={unlockExplorer}
        />
      </div>
    );
  }

  const refreshing = tablesLoading || detailsLoading || rowsLoading;
  const rows = rowsResponse?.rows ?? [];
  const pageError = tablesError ?? detailsError ?? rowsError;

  return (
    <div className="lance-admin-page">
      <header className="lance-admin-hero">
        <div>
          <p className="lance-admin-eyebrow">Admin · Read-only</p>
          <h1>LanceDB Explorer</h1>
          <p>
            Inspect tables, Arrow schema, embedding metadata, and paginated
            records without loading full vectors into the row grid.
          </p>
        </div>
        <span className="lance-admin-readonly">No write operations</span>
      </header>

      <LanceTableSelector
        tables={tables}
        selectedTable={selectedTable}
        loading={tablesLoading}
        refreshing={refreshing}
        onSelect={selectTable}
        onRefresh={refreshExplorer}
        onLock={() => lockExplorer()}
      />

      {notice && (
        <div className="lance-admin-notice" role="status">
          {notice}
        </div>
      )}
      {pageError && (
        <div className="lance-admin-alert" role="alert">
          <span>{pageError}</span>
          <button type="button" onClick={refreshExplorer}>
            Try again
          </button>
        </div>
      )}

      {tablesLoading && tables.length === 0 ? (
        <div className="lance-admin-grid-state" role="status">
          Loading LanceDB tables…
        </div>
      ) : tables.length === 0 ? (
        <div className="lance-admin-grid-state lance-admin-grid-state--empty">
          <strong>No LanceDB tables were found.</strong>
          <button
            type="button"
            className="lance-admin-button lance-admin-button--secondary"
            onClick={refreshExplorer}
          >
            Refresh tables
          </button>
        </div>
      ) : (
        <>
          <LanceSummaryCards
            tableCount={tables.length}
            details={details}
            loading={detailsLoading}
          />

          <div className="lance-admin-inspection-grid">
            <LanceSchemaPanel
              fields={details?.schema ?? []}
              loading={detailsLoading}
            />
            <LanceMetadataPanel
              metadata={details?.schema_metadata ?? {}}
              embeddingFunctions={details?.embedding_functions ?? []}
              vectorColumns={details?.vector_columns ?? []}
              loading={detailsLoading}
            />
          </div>

          <LanceFilterBar
            appliedTag={query.tag}
            sortBy={query.sortBy}
            sortOrder={query.sortOrder}
            pageSize={query.pageSize}
            loading={rowsLoading}
            onTagApply={(tag) =>
              setQuery((current) => applyExplorerTag(current, tag))
            }
            onSortChange={(column: LanceSortColumn | null, order: LanceSortOrder) =>
              setQuery((current) => applyExplorerSort(current, column, order))
            }
            onPageSizeChange={(pageSize) =>
              setQuery((current) => applyExplorerPageSize(current, pageSize))
            }
          />

          <LanceRowGrid
            rows={rows}
            loading={rowsLoading}
            appliedTag={query.tag}
            onCopy={(value, message) => void copyText(value, message)}
            onViewVector={(row, trigger) => loadVector(row, trigger)}
            onClearFilter={() =>
              setQuery((current) => applyExplorerTag(current, ""))
            }
          />

          <LancePagination
            pagination={rowsResponse?.pagination ?? null}
            loading={rowsLoading}
            onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          />
        </>
      )}

      <div className="lance-admin-live" aria-live="polite" aria-atomic="true">
        {copyStatus}
      </div>

      <VectorViewer
        row={vectorRow}
        detail={vectorDetail}
        loading={vectorLoading}
        error={vectorError}
        returnFocusElement={vectorTrigger}
        onClose={closeVector}
        onCopy={(value, message) => void copyText(value, message)}
        onRetry={() => {
          if (vectorRow) loadVector(vectorRow, null);
        }}
      />
    </div>
  );
}
