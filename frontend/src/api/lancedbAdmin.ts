import { FULL_API_URL } from "@/constants";
import {
  ensureOk,
  fetchWithTimeout,
  HttpError,
  toUserFacingNetworkError,
} from "@/utils/http";

export type LanceSortColumn = "image_uri" | "tag" | "hash" | "mtime";
export type LanceSortOrder = "asc" | "desc";
export type LanceStorageType = "local" | "s3";

export interface LanceDataSource {
  storage: LanceStorageType;
  location: string;
}

export interface LanceLocalDirectoryItem {
  name: string;
  path: string;
}

export interface LanceLocalBrowseResponse {
  current_path: string;
  parent_path: string | null;
  directories: LanceLocalDirectoryItem[];
}

export interface LanceTableItem {
  name: string;
}

export interface LanceAdminAccessResponse {
  authenticated: true;
  auth_mode: "internal-secret-header";
  header_name: "X-Internal-Secret";
}

export interface LanceTablesResponse {
  source: LanceDataSource;
  tables: LanceTableItem[];
}

export interface LanceSchemaField {
  name: string;
  type: string;
  nullable: boolean;
  is_vector: boolean;
}

export interface LanceEmbeddingFunction {
  name: string;
  source_column: string;
  vector_column: string;
}

export interface LanceVectorColumn {
  name: string;
  dimension: number;
}

export interface LanceTableDetails {
  name: string;
  row_count: number;
  schema: LanceSchemaField[];
  schema_metadata: Record<string, unknown>;
  embedding_functions: LanceEmbeddingFunction[];
  vector_columns: LanceVectorColumn[];
}

export interface LanceVectorSummary {
  length: number;
  included: false;
}

export interface LanceRowSummary {
  row_id: number;
  image_uri: string | null;
  tag: string | null;
  hash: string | null;
  mtime: number | string | null;
  vector: LanceVectorSummary;
}

export interface LancePagination {
  page: number;
  page_size: number;
  total_rows: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface LanceRowsResponse {
  table: string;
  rows: LanceRowSummary[];
  pagination: LancePagination;
  filter: { tag: string | null };
  sort: { column: LanceSortColumn | null; order: LanceSortOrder };
}

export interface LanceRowDetail {
  row_id: number;
  image_uri: string | null;
  tag: string | null;
  hash: string | null;
  mtime: number | string | null;
  vector: {
    length: number;
    values: Array<number | null>;
  };
}

export interface LanceRowsRequest {
  page: number;
  pageSize: number;
  tag?: string | null;
  sortBy?: LanceSortColumn | null;
  sortOrder?: LanceSortOrder;
}

const ADMIN_BASE_URL = `${FULL_API_URL}/admin/lancedb`;
const ADMIN_TIMEOUT_MS = 20_000;

function adminHeaders(
  secret: string,
  source?: LanceDataSource,
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Internal-Secret": secret,
  };

  if (source) {
    headers["X-LanceDB-Storage"] = source.storage;
    headers["X-LanceDB-Location"] = source.location;
  }

  return headers;
}

async function getAdminJson<T>(
  url: string,
  secret: string,
  signal?: AbortSignal,
  source?: LanceDataSource,
): Promise<T> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: adminHeaders(secret, source),
        cache: "no-store",
        signal,
      },
      ADMIN_TIMEOUT_MS,
    );
    await ensureOk(
      response,
      "Unable to read the LanceDB administrator resource.",
    );
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw toUserFacingNetworkError(
      error,
      "LanceDB could not be reached. Try refreshing.",
    );
  }
}

export function buildLanceRowsUrl(
  tableName: string,
  request: LanceRowsRequest,
): string {
  const params = new URLSearchParams({
    page: String(request.page),
    page_size: String(request.pageSize),
  });

  const cleanTag = request.tag?.trim();
  if (cleanTag) params.set("tag", cleanTag);
  if (request.sortBy) params.set("sort_by", request.sortBy);
  if (request.sortOrder) params.set("sort_order", request.sortOrder);

  return `${ADMIN_BASE_URL}/${encodeURIComponent(tableName)}/rows?${params.toString()}`;
}

export function verifyLanceAdminAccess(
  secret: string,
  signal?: AbortSignal,
): Promise<LanceAdminAccessResponse> {
  return getAdminJson<LanceAdminAccessResponse>(
    `${ADMIN_BASE_URL}/access`,
    secret,
    signal,
  );
}

export function browseLanceLocalDirectories(
  secret: string,
  path?: string,
  signal?: AbortSignal,
): Promise<LanceLocalBrowseResponse> {
  const params = new URLSearchParams();
  const cleanPath = path?.trim();
  if (cleanPath) params.set("path", cleanPath);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return getAdminJson<LanceLocalBrowseResponse>(
    `${ADMIN_BASE_URL}/sources/local${suffix}`,
    secret,
    signal,
  );
}

export function scanLanceTables(
  source: LanceDataSource,
  secret: string,
  signal?: AbortSignal,
): Promise<LanceTablesResponse> {
  return getAdminJson<LanceTablesResponse>(
    `${ADMIN_BASE_URL}/scan`,
    secret,
    signal,
    source,
  );
}

/**
 * Backward-compatible alias for code that still imports the old method name.
 * New code should use scanLanceTables so the client terminology mirrors /scan.
 */
export const fetchLanceTables = scanLanceTables;

export function fetchLanceTableDetails(
  tableName: string,
  source: LanceDataSource,
  secret: string,
  signal?: AbortSignal,
): Promise<LanceTableDetails> {
  return getAdminJson<LanceTableDetails>(
    `${ADMIN_BASE_URL}/${encodeURIComponent(tableName)}`,
    secret,
    signal,
    source,
  );
}

export function fetchLanceRows(
  tableName: string,
  source: LanceDataSource,
  secret: string,
  request: LanceRowsRequest,
  signal?: AbortSignal,
): Promise<LanceRowsResponse> {
  return getAdminJson<LanceRowsResponse>(
    buildLanceRowsUrl(tableName, request),
    secret,
    signal,
    source,
  );
}

export function fetchLanceRowDetail(
  tableName: string,
  rowId: number,
  source: LanceDataSource,
  secret: string,
  signal?: AbortSignal,
): Promise<LanceRowDetail> {
  return getAdminJson<LanceRowDetail>(
    `${ADMIN_BASE_URL}/${encodeURIComponent(tableName)}/rows/${rowId}`,
    secret,
    signal,
    source,
  );
}

export function isAdminAccessError(error: unknown): boolean {
  return error instanceof HttpError && error.status === 403;
}

export function isMissingTableError(error: unknown): boolean {
  return error instanceof HttpError && error.status === 404;
}
