import { FULL_API_URL } from "@/constants";
import {
  ensureOk,
  fetchWithTimeout,
  HttpError,
  toUserFacingNetworkError,
} from "@/utils/http";

export type LanceSortColumn = "image_uri" | "tag" | "hash" | "mtime";
export type LanceSortOrder = "asc" | "desc";
export type LanceStorageType = "local" | "s3" | "r2";

export interface LanceDataSource {
  storage: LanceStorageType;
  /** Cloud database URI. Local mode intentionally has no client path. */
  location?: string;
}

export interface LanceS3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  bucketName: string;
}

export interface LanceR2Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  accountId: string;
  bucketName: string;
  endpoint: string;
  region: string;
}

export interface LanceExplorerCredentials {
  adminSecret: string;
  s3: LanceS3Credentials;
  r2: LanceR2Credentials;
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
  credentials: LanceExplorerCredentials,
  source?: LanceDataSource,
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Internal-Secret": credentials.adminSecret,
  };

  if (!source) return headers;

  headers["X-LanceDB-Storage"] = source.storage;
  if (source.storage !== "local") {
    const location = source.location?.trim();
    if (location) headers["X-LanceDB-Location"] = location;
  }

  if (source.storage === "s3") {
    const s3 = credentials.s3;
    if (s3.accessKeyId.trim())
      headers["X-LanceDB-AWS-Access-Key-ID"] = s3.accessKeyId.trim();
    if (s3.secretAccessKey)
      headers["X-LanceDB-AWS-Secret-Access-Key"] = s3.secretAccessKey;
    if (s3.sessionToken)
      headers["X-LanceDB-AWS-Session-Token"] = s3.sessionToken;
    if (s3.region.trim()) headers["X-LanceDB-AWS-Region"] = s3.region.trim();
    if (s3.bucketName.trim())
      headers["X-LanceDB-AWS-Bucket"] = s3.bucketName.trim();
  }

  if (source.storage === "r2") {
    const r2 = credentials.r2;
    if (r2.accessKeyId.trim())
      headers["X-LanceDB-R2-Access-Key-ID"] = r2.accessKeyId.trim();
    if (r2.secretAccessKey)
      headers["X-LanceDB-R2-Secret-Access-Key"] = r2.secretAccessKey;
    if (r2.accountId.trim())
      headers["X-LanceDB-R2-Account-ID"] = r2.accountId.trim();
    if (r2.bucketName.trim())
      headers["X-LanceDB-R2-Bucket"] = r2.bucketName.trim();
    if (r2.endpoint.trim())
      headers["X-LanceDB-R2-Endpoint"] = r2.endpoint.trim();
    if (r2.region.trim()) headers["X-LanceDB-R2-Region"] = r2.region.trim();
  }

  return headers;
}

async function getAdminJson<T>(
  url: string,
  credentials: LanceExplorerCredentials,
  signal?: AbortSignal,
  source?: LanceDataSource,
): Promise<T> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: adminHeaders(credentials, source),
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
  credentials: LanceExplorerCredentials,
  signal?: AbortSignal,
): Promise<LanceAdminAccessResponse> {
  return getAdminJson<LanceAdminAccessResponse>(
    `${ADMIN_BASE_URL}/access`,
    credentials,
    signal,
  );
}

export function scanLanceTables(
  source: LanceDataSource,
  credentials: LanceExplorerCredentials,
  signal?: AbortSignal,
): Promise<LanceTablesResponse> {
  return getAdminJson<LanceTablesResponse>(
    `${ADMIN_BASE_URL}/scan`,
    credentials,
    signal,
    source,
  );
}

export function fetchLanceTableDetails(
  tableName: string,
  source: LanceDataSource,
  credentials: LanceExplorerCredentials,
  signal?: AbortSignal,
): Promise<LanceTableDetails> {
  return getAdminJson<LanceTableDetails>(
    `${ADMIN_BASE_URL}/${encodeURIComponent(tableName)}`,
    credentials,
    signal,
    source,
  );
}

export function fetchLanceRows(
  tableName: string,
  source: LanceDataSource,
  credentials: LanceExplorerCredentials,
  request: LanceRowsRequest,
  signal?: AbortSignal,
): Promise<LanceRowsResponse> {
  return getAdminJson<LanceRowsResponse>(
    buildLanceRowsUrl(tableName, request),
    credentials,
    signal,
    source,
  );
}

export function fetchLanceRowDetail(
  tableName: string,
  rowId: number,
  source: LanceDataSource,
  credentials: LanceExplorerCredentials,
  signal?: AbortSignal,
): Promise<LanceRowDetail> {
  return getAdminJson<LanceRowDetail>(
    `${ADMIN_BASE_URL}/${encodeURIComponent(tableName)}/rows/${rowId}`,
    credentials,
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
