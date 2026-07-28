import type {
  LanceRowDetail,
  LanceRowSummary,
  LanceSortColumn,
  LanceSortOrder,
} from "@/api/lancedbAdmin";

export interface ExplorerQueryState {
  page: number;
  pageSize: number;
  tag: string;
  sortBy: LanceSortColumn | null;
  sortOrder: LanceSortOrder;
}

export const DEFAULT_EXPLORER_QUERY: ExplorerQueryState = {
  page: 1,
  pageSize: 25,
  tag: "",
  sortBy: null,
  sortOrder: "asc",
};

export function resetExplorerQuery(): ExplorerQueryState {
  return { ...DEFAULT_EXPLORER_QUERY };
}

export function applyExplorerTag(
  state: ExplorerQueryState,
  tag: string,
): ExplorerQueryState {
  return { ...state, tag: tag.trim(), page: 1 };
}

export function applyExplorerSort(
  state: ExplorerQueryState,
  sortBy: LanceSortColumn | null,
  sortOrder: LanceSortOrder,
): ExplorerQueryState {
  return { ...state, sortBy, sortOrder, page: 1 };
}

export function applyExplorerPageSize(
  state: ExplorerQueryState,
  pageSize: number,
): ExplorerQueryState {
  return { ...state, pageSize, page: 1 };
}

export function formatLanceMtime(value: number | string | null): string {
  if (value === null || value === "") return "—";

  const numeric = typeof value === "number" ? value : Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(Math.abs(numeric) < 1_000_000_000_000 ? numeric * 1000 : numeric)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function compactValue(value: string | null, length = 28): string {
  if (!value) return "—";
  if (value.length <= length) return value;
  const edge = Math.max(4, Math.floor((length - 1) / 2));
  return `${value.slice(0, edge)}…${value.slice(-edge)}`;
}

export function rowCopyPayload(row: LanceRowSummary): string {
  return JSON.stringify(row, null, 2);
}

export function completeRowCopyPayload(row: LanceRowDetail): string {
  return JSON.stringify(row, null, 2);
}

export async function writeTextToClipboard(value: string): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Some browsers expose the Clipboard API but reject it outside a secure
    // context. Fall back to a temporary textarea in that case.
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard access is unavailable.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "-9999px auto auto -9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Clipboard copy was rejected.");
  } finally {
    textarea.remove();
  }
}
