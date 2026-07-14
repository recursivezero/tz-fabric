import { FULL_API_URL } from "../constants";
import { canonicalizeApiTimestamp } from "../utils/dateTime";
import {
  ensureOk,
  fetchWithTimeout,
  toUserFacingNetworkError,
} from "../utils/http";

export type MediaItem = {
  _id: string;
  imageUrl: string;
  audioUrl: string | null;
  createdAt: string | null;

  basename?: string;
  imageFilename?: string;
  audioFilename?: string | null;
};

export type ContentResponse = {
  items: MediaItem[];
  page: number;
  limit: number;
  total: number;
};

type ApiMediaItem = Record<string, unknown>;
type ApiContentResponse = {
  items?: unknown;
  page?: unknown;
  limit?: unknown;
  total?: unknown;
};

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const asFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function normalizeMediaItem(value: unknown): MediaItem | null {
  if (!value || typeof value !== "object") return null;

  const item = value as ApiMediaItem;
  const imageUrl = asOptionalString(item.imageUrl ?? item.image_url);
  if (!imageUrl) return null;

  const idValue = item._id ?? item.id ?? imageUrl;
  const createdAt = canonicalizeApiTimestamp(
    item.createdAt ??
      item.created_on ??
      item.created_at ??
      item.uploadedAt ??
      item.uploaded_at ??
      item.timestamp,
  );

  return {
    _id: String(idValue),
    imageUrl,
    audioUrl: asNullableString(item.audioUrl ?? item.audio_url),
    createdAt,
    basename: asOptionalString(item.basename),
    imageFilename: asOptionalString(
      item.imageFilename ?? item.image_filename ?? item.filename,
    ),
    audioFilename: asNullableString(item.audioFilename ?? item.audio_filename),
  };
}

export async function fetchContent(
  page = 1,
  limit = 4,
  signal?: AbortSignal,
): Promise<ContentResponse> {
  try {
    const response = await fetchWithTimeout(
      `${FULL_API_URL}/media/content?page=${page}&limit=${limit}`,
      { signal },
      15_000,
    );

    await ensureOk(response, `Failed to load content (${response.status}).`);

    const raw = (await response.json()) as ApiContentResponse;
    const items = Array.isArray(raw.items)
      ? raw.items
          .map(normalizeMediaItem)
          .filter((item): item is MediaItem => !!item)
      : [];

    return {
      items,
      page: Math.max(1, asFiniteNumber(raw.page, page)),
      limit: Math.max(1, asFiniteNumber(raw.limit, limit)),
      total: Math.max(0, asFiniteNumber(raw.total, items.length)),
    };
  } catch (error) {
    throw toUserFacingNetworkError(
      error,
      "Unable to load the fabric list. Please check your connection and try again.",
    );
  }
}
