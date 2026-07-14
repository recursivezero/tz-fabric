import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpError,
  RequestTimeoutError,
  ensureOk,
  fetchWithTimeout,
  readResponseError,
  toUserFacingNetworkError,
} from "./http";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("HTTP utilities", () => {
  it("extracts safe JSON error messages", async () => {
    const response = new Response(JSON.stringify({ detail: "Invalid image" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

    expect(await readResponseError(response, "Fallback")).toBe("Invalid image");
  });

  it("does not surface raw HTML error pages", async () => {
    const response = new Response("<html>proxy failure</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    });

    expect(await readResponseError(response, "Service unavailable")).toBe(
      "Service unavailable",
    );
  });

  it("throws a typed HttpError for non-success responses", async () => {
    const response = new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });

    await expect(ensureOk(response, "Request failed")).rejects.toEqual(
      expect.objectContaining({
        name: "HttpError",
        status: 404,
        message: "Not found",
      }),
    );
  });

  it("aborts stalled requests after the configured timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      }),
    );

    const request = fetchWithTimeout("/slow", {}, 25);
    const rejection =
      expect(request).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(25);
    await rejection;
  });

  it("sanitizes unknown network failures for the UI", () => {
    const error = toUserFacingNetworkError(
      new Error("ECONNREFUSED 10.0.0.5:27017"),
      "Unable to connect.",
    );

    expect(error.message).toBe("Unable to connect.");
    expect(new HttpError(500, "Known").message).toBe("Known");
  });
});
