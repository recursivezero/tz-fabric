export interface SearchItem {
  score: number;
  metadata: {
    id: number;
    filename: string;
    relPath: string;
    imagePath?: string;
    imageUrl?: string;
    audioUrl?: string;
    audioPath?: string;
    audioRelPath?: string;
    [k: string]: any;
  };
}
export interface SearchResponse {
  count: number;
  results: SearchItem[];
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8001";

export async function searchSimilar(file: File, k = 1,  order: "recent" | "score" = "recent", debug_ts=false): Promise<SearchResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/search?k=${k}&order=${order}&debug_ts=${debug_ts}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export { API_BASE };
