import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureOk,
  fetchWithTimeout,
  toUserFacingNetworkError,
} from "../../utils/http";
import { API_BASE, USER_FRIENDLY_SERVER_ERROR } from "./searchConfig";
import {
  getAllImageSearchCategories,
  shouldRetryEmptyImageSearch,
  toResultItem,
} from "./searchUtils";
import type { ResultItem, SearchApiResponse } from "./types";

const SEARCH_TIMEOUT_MS = 45_000;

type SearchInput =
  | { kind: "image"; file: File }
  | { kind: "text"; term: string };

export function useSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const executeSearch = useCallback(
    async (
      input: SearchInput,
      category?: string[],
      limit = 20,
      preserveResultsOnError = false,
    ) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setError(null);

      try {
        const requestResults = async (
          categories?: string[],
        ): Promise<ResultItem[]> => {
          const form = new FormData();
          if (input.kind === "image") form.append("file", input.file);
          else form.append("search_term", input.term);
          form.append("limit", String(limit));
          form.append("page", "1");
          form.append("per_page", String(limit));
          categories?.forEach((value) => {
            form.append("category", value);
          });

          const response = await fetchWithTimeout(
            `${API_BASE}/search`,
            {
              method: "POST",
              body: form,
              signal: controller.signal,
            },
            SEARCH_TIMEOUT_MS,
          );
          await ensureOk(response, `Search failed (${response.status}).`);

          const data = (await response.json()) as SearchApiResponse;
          const rawResults = Array.isArray(data.results) ? data.results : [];
          const normalized = rawResults
            .map(toResultItem)
            .filter((item): item is ResultItem => item !== null);

          if (rawResults.length > 0 && normalized.length === 0) {
            throw new Error(
              "The search service returned an unsupported result format.",
            );
          }

          return normalized;
        };

        let normalized = await requestResults(category);

        // Some vector indexes only return tagged rows once a category predicate
        // is present. Preserve the normal unfiltered request, but recover from an
        // empty image response by retrying once across every visible category.
        if (
          input.kind === "image" &&
          shouldRetryEmptyImageSearch(category, normalized.length) &&
          !controller.signal.aborted
        ) {
          normalized = await requestResults(getAllImageSearchCategories());
        }

        if (requestId === requestIdRef.current) setResults(normalized);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError")
          return;

        const failure = toUserFacingNetworkError(
          caught,
          USER_FRIENDLY_SERVER_ERROR,
        );
        if (requestId === requestIdRef.current) {
          setError(failure.message);
          if (!preserveResultsOnError) setResults([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          requestRef.current = null;
        }
      }
    },
    [],
  );

  const runImageSearch = useCallback(
    (
      file: File,
      category?: string[],
      limit = 20,
      preserveResultsOnError = false,
    ) =>
      executeSearch(
        { kind: "image", file },
        category,
        limit,
        preserveResultsOnError,
      ),
    [executeSearch],
  );

  const runTextSearch = useCallback(
    (
      term: string,
      category?: string[],
      limit = 20,
      preserveResultsOnError = false,
    ) =>
      executeSearch(
        { kind: "text", term },
        category,
        limit,
        preserveResultsOnError,
      ),
    [executeSearch],
  );

  const clear = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    requestIdRef.current += 1;
    setLoading(false);
    setResults([]);
    setError(null);
  }, []);

  return { loading, error, results, runImageSearch, runTextSearch, clear };
}
