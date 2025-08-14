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

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export async function searchSimilar(file: File, k = 12,  order: "recent" | "score" = "recent"): Promise<SearchResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/search?k=${k}&order=${order}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export { API_BASE };
