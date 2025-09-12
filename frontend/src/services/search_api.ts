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

    [k: string]: any;
  };
}

export interface SearchResponse {
  count: number;
  results: SearchItem[];
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function searchSimilar(
  file: File,
  k: number = 50,
  order: "recent" | "score" = "recent",
  debug_ts: boolean = false,
  min_sim: number = 0.5,
  require_audio: boolean = true
): Promise<SearchResponse> {
  const form = new FormData();
  form.append("file", file);

  const params = new URLSearchParams({
    k: String(k),
    order,
    debug_ts: String(debug_ts),
    min_sim: String(min_sim),
    require_audio: String(require_audio),
  });

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

export { API_BASE };
