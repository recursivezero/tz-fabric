import { FULL_API_URL } from "../constants";
import {
  ensureOk,
  fetchWithTimeout,
  toUserFacingNetworkError,
} from "../utils/http";

export interface SearchItem {
  score: number;
  metadata: {
    id?: number;
    filename?: string;
    relPath?: string;
    imagePath?: string;
    imageUrl?: string;
    audioUrl?: string;
    audioPath?: string;
    audioRelPath?: string;
    basename?: string;
    imageFilename?: string;
    audioFilename?: string;
    [key: string]: string | number | boolean | null | undefined;
  };
}

export interface SearchResponse {
  count: number;
  results: SearchItem[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeSearchItem(value: unknown): SearchItem | null {
  if (typeof value === "string" && value.trim()) {
    const filename = value.split(/[?#]/)[0].split("/").pop() ?? value;
    return {
      score: 1,
      metadata: { imageUrl: value, relPath: value, filename },
    };
  }

  const record = asRecord(value);
  if (!record) return null;
  const metadataRecord = asRecord(record.metadata) ?? record;
  const imageUrl = [
    metadataRecord.imageUrl,
    metadataRecord.image_url,
    metadataRecord.imagePath,
    metadataRecord.relPath,
    metadataRecord.filename,
  ].find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
  if (!imageUrl) return null;

  const scoreValue = Number(record.score ?? metadataRecord.score ?? 1);
  const metadata: SearchItem["metadata"] = {};
  for (const [key, item] of Object.entries(metadataRecord)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null ||
      typeof item === "undefined"
    ) {
      metadata[key] = item;
    }
  }
  metadata.imageUrl ??= imageUrl;

  return {
    score: Number.isFinite(scoreValue) ? scoreValue : 1,
    metadata,
  };
}

export async function searchSimilar(
  file: File,
  order: "recent" | "score" = "recent",
  debugTs = false,
  minSimilarity = 0.5,
  requireAudio = true,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const minSimClamped = Number.isFinite(minSimilarity)
    ? Math.max(0, Math.min(1, minSimilarity))
    : 0.5;

  const form = new FormData();
  form.append("file", file);

  const params = new URLSearchParams({
    order,
    debug_ts: debugTs ? "true" : "false",
    min_sim: String(minSimClamped),
    require_audio: requireAudio ? "true" : "false",
  });

  try {
    const response = await fetchWithTimeout(
      `${FULL_API_URL}/search?${params.toString()}`,
      { method: "POST", body: form, signal },
      45_000,
    );
    await ensureOk(response, `Search failed (${response.status}).`);

    const raw = (await response.json()) as {
      count?: unknown;
      results?: unknown;
    };
    const rawResults = Array.isArray(raw.results) ? raw.results : [];
    const results = rawResults
      .map(normalizeSearchItem)
      .filter((item): item is SearchItem => item !== null);

    if (rawResults.length > 0 && results.length === 0) {
      throw new Error(
        "The search service returned an unsupported result format.",
      );
    }

    return {
      count: Number.isFinite(Number(raw.count))
        ? Number(raw.count)
        : results.length,
      results,
    };
  } catch (error) {
    throw toUserFacingNetworkError(
      error,
      "Unable to complete the search. Please check your connection and try again.",
    );
  }
}
