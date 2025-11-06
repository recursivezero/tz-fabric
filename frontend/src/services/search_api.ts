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

  const res = await fetch(`${FULL_API_URL}/search?${params.toString()}`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Search failed: ${res.status} ${msg}`);
  }

  return res.json();
}
