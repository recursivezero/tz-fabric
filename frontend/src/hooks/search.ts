import { useState } from "react";
import { searchSimilar, type SearchResponse, type SearchItem, API_BASE } from "../services/search_api";

export type UiItem = {
  score: number;
  filename: string;
  imageSrc: string | undefined;
  audioSrc: string | undefined;
  raw: SearchItem;
};

function isExactScore(score: number): boolean {
  return Number(score.toFixed(4)) === 1;
}

function buildImageUrl(item: SearchItem): string | undefined {
  const md = item.metadata || {};
  if (md.imageUrl) return md.imageUrl;
  if (md.imagePath) return md.imagePath;
  if (md.relPath)  return `${API_BASE}/static/${md.relPath}`;
  return undefined;
}

function buildAudioUrl(item: SearchItem): string | undefined {
  const md = item.metadata || {};
  if (md.audioUrl) return md.audioUrl;
  if (md.audioPath) return md.audioPath;
  if (md.audioRelPath) return `${API_BASE}/static/${md.audioRelPath}`;
  if (md.relPath) {
    const swapped = md.relPath.replace(/\/images\//, "/audios/");
    const withWebm = swapped.replace(/\.[a-zA-Z0-9]+$/, ".webm");
    return `${API_BASE}/static/${withWebm}`;
  }
  return undefined;
}

function toUiItem(item: SearchItem): UiItem {
  const imageSrc = buildImageUrl(item);
  const audioSrc = buildAudioUrl(item);
  const filename = item.metadata?.filename || item.metadata?.relPath || "result";
  return { score: item.score, filename, imageSrc, audioSrc, raw: item };
}

function getCreatedAtMs(it: UiItem): number {
  const md = it.raw?.metadata || {};
  const val = md.createdAt || md.created_at || md.created_on || md.timestamp || null;
  const t = val ? Date.parse(String(val)) : NaN;
  if (!Number.isNaN(t)) return t;
  if (typeof md.id === "number") return md.id;
  const maybeNum = Number(md.id);
  if (!Number.isNaN(maybeNum)) return maybeNum;
  return 0;
}

export default function useImageSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exactMatches, setExactMatches] = useState<UiItem[]>([]);

  const runSearch = async (file: File, k = 200) => {
    setLoading(true);
    setError(null);
    setExactMatches([]);

    try {
      const res: SearchResponse = await searchSimilar(file, k);
      const mapped = (res.results ?? []).map(toUiItem);
      const onlyExact = mapped.filter((x) => isExactScore(x.score));
      const recencySorted = onlyExact.sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));
      const limited = recencySorted.slice(0, k);
      setExactMatches(limited);
    } catch (e: any) {
      setError(e?.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setExactMatches([]);
    setError(null);
  };

  return { loading, error, exactMatches, runSearch, clear };
}
