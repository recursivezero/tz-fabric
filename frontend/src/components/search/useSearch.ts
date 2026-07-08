import { useCallback, useState } from "react";
import { API_BASE, USER_FRIENDLY_SERVER_ERROR } from "./searchConfig";
import { toResultItem } from "./searchUtils";
import type { ResultItem, SearchApiResponse } from "./types";

export function useSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);

  const runImageSearch = useCallback(async (file: File, category?: string[], limit = 20, preserveResultsOnError = false) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("limit", String(limit));
      form.append("page", "1");
      form.append("per_page", String(limit));
      if (category?.length) category.forEach((c) => { form.append("category", c); });
      const res = await fetch(`${API_BASE}/search`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? `Search failed (${res.status})`);
      }
      const data: SearchApiResponse = await res.json();
      setResults((data.results ?? []).map(toResultItem));
    } catch (e) {
      console.error("Image search failed:", e);
      setError(USER_FRIENDLY_SERVER_ERROR);
      if (!preserveResultsOnError) setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runTextSearch = useCallback(async (term: string, category?: string[], limit = 20, preserveResultsOnError = false) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("search_term", term);
      form.append("limit", String(limit));
      form.append("page", "1");
      form.append("per_page", String(limit));
      if (category?.length) category.forEach((c) => { form.append("category", c); });
      const res = await fetch(`${API_BASE}/search`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? `Search failed (${res.status})`);
      }
      const data: SearchApiResponse = await res.json();
      setResults((data.results ?? []).map(toResultItem));
    } catch (e) {
      console.error("Text search failed:", e);
      setError(USER_FRIENDLY_SERVER_ERROR);
      if (!preserveResultsOnError) setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { loading, error, results, runImageSearch, runTextSearch, clear };
}
