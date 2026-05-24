import { API_BASE } from '@/constants';
import type { ResultItem, SearchApiResponse } from '@/types/common';
import  { toResultItem } from '@/utils/search.helper';
import { useState, useCallback } from 'react';

export const useSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);

  const runImageSearch = useCallback(async (file: File, category?: string[], limit = 40) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("limit", String(limit));
      if (category?.length) category.forEach((c) => { form.append("category", c) });
      console.log("Image search form data:", { form });
      const res = await fetch(`${API_BASE}/search`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch((err) => {
          console.error("Error parsing error response:", err);
        });
        throw new Error(err?.detail ?? `Search failed (${res.status})`);
      }
      const data: SearchApiResponse = await res.json();
      console.log("Search response data:", data);
      setResults((data.results ?? []).map(toResultItem));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runTextSearch = useCallback(async (term: string, category?: string[], limit = 40) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("search_term", term);
      form.append("limit", String(limit));
      if (category?.length) category.forEach((c) => { form.append("category", c) });
      console.log("Text search form data:", { form });
      const res = await fetch(`${API_BASE}/search`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail ?? `Search failed (${res.status})`);
      }
      const data: SearchApiResponse = await res.json();
      setResults((data.results ?? []).map(toResultItem));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setResults([]);
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