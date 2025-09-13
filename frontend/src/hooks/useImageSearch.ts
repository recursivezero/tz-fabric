import { useState } from "react";
import { BASE_URL } from "../constants";
import { searchSimilar, type SearchItem, type SearchResponse } from "../services/search_api";

export type UiItem = {
  score: number;
  filename: string;      
  imageSrc?: string;
  audioSrc?: string;
  raw: SearchItem;
};

function pickDisplayName(md: SearchItem["metadata"] | undefined): string{
  if (md?.basename) return md.basename;                               
  if (md?.imageFilename) return String(md.imageFilename).replace(/\.[^.]+$/, "");
  if (md?.filename) return String(md.filename).replace(/\.[^.]+$/, "");
  if (md?.relPath) return String(md.relPath).split("/").pop()?.replace(/\.[^.]+$/, "") ?? "result";
  return "result";
}
function buildImageUrl(md: SearchItem["metadata"]): string | undefined{
  if (md?.imageUrl) return md.imageUrl;
  if (md?.imagePath) return md.imagePath;
  if (md?.relPath)  return `${BASE_URL}/static/${md.relPath}`;
  return undefined;
}

function buildAudioUrl(md: SearchItem["metadata"] ): string | undefined {
  if (md?.audioUrl) return md.audioUrl;
  if (md?.audioPath) return md.audioPath;
  if (md?.audioRelPath) return `${BASE_URL}/static/${md.audioRelPath}`;
  if (md?.relPath) {
    const swapped = String(md.relPath).replace(/\/images\//, "/audios/");
    const withWebm = swapped.replace(/\.[a-zA-Z0-9]+$/, ".webm");
    return `${BASE_URL}/static/${withWebm}`;
  }
  return undefined;
}

function toUiItem(item: SearchItem): UiItem {
  const md = item.metadata ?? {};
  return {
    score: item.score,
    filename: pickDisplayName(md),       
    imageSrc: buildImageUrl(md),
    audioSrc: buildAudioUrl(md),
    raw: item,
  };
}

function getErrorMessage(e: unknown, fallback = "Search failed"): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null && "message" in e) {
    const maybe = (e as { message?: unknown }).message;
    if (typeof maybe === "string") return maybe;
  }
  return fallback;
}


export default function useImageSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UiItem[]>([]);

  const runSearch = async (file: File, k = 50, minSim = 0.5) => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res: SearchResponse = await searchSimilar(file, k, "recent", true, minSim, true);
      console.log("[search] count", res.count, res.results?.length);
      const mapped = (res.results ?? []).map(toUiItem);
      const filtered = mapped.filter(it => it.score >= minSim && !!it.audioSrc);
      setResults(filtered.slice(0, k));
      console.log("[search] mapped/filtered", mapped.length, filtered.length);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setResults([]);
    setError(null);
  };

  return { loading, error, results, exactMatches: results, runSearch, clear };
}
