// services/search_api.ts
import { FULL_API_URL } from "../constants";

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

    [k: string]: string | number | boolean | null | undefined;
  };
}

export interface SearchResponse {
  count: number;
  results: SearchItem[];
}

export async function searchSimilar(
  file: File,
  order: "recent" | "score" = "recent",
  debug_ts: boolean = false,
  min_sim: number = 0.5,
  require_audio: boolean = true
): Promise<SearchResponse> {
  const minSimClamped =
    typeof min_sim === "number"
      ? Math.max(0, Math.min(1, min_sim))
      : 0.5;

  const form = new FormData();
  form.append("file", file);

  const params = new URLSearchParams();
  params.set("order", order);
  params.set("debug_ts", debug_ts ? "true" : "false");
  params.set("min_sim", String(minSimClamped));
  params.set("require_audio", require_audio ? "true" : "false");

  let res: Response;
  try {
    res = await fetch(`${FULL_API_URL}/search?${params.toString()}`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    console.error("searchSimilar network error:", err);
    throw new Error("Cannot reach server — check your network ");
  }

  if (!res.ok) {
    // try to read any text body for extra info
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch (_) {
      /* ignore */
    }

    if (res.status === 503) {
      throw new Error(
        bodyText || "Search service unavailable — check yournetwork."
      );
    }
    if (res.status === 504) {
      throw new Error(bodyText || "Search timed out — try again later.");
    }
    if (res.status === 400) {
      throw new Error(bodyText || "Bad search request (invalid input).");
    }
    if (res.status === 500) {
      throw new Error(bodyText || "Server error while searching — try again later.");
    }

    throw new Error(bodyText || `Search failed: ${res.status}`);
  }

  try {
    return await res.json();
  } catch (err) {
    console.error("searchSimilar JSON parse error:", err);
    throw new Error("Failed to parse search response.");
  }
}
