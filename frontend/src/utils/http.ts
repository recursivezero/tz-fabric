const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ERROR_MESSAGE_LENGTH = 320;

export class RequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`);
    this.name = "RequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function safeMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const text = value.replace(/\s+/g, " ").trim();
  if (!text || /<\/?(?:html|body|script|style)\b/i.test(text)) return null;

  return text.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function messageFromJson(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["detail", "message", "error", "reason"]) {
    const direct = safeMessage(record[key]);
    if (direct) return direct;
  }

  return null;
}

/**
 * Browser fetch with a deterministic timeout while preserving an optional
 * caller-provided AbortSignal. A caller abort remains an AbortError; only the
 * internal timeout is converted into RequestTimeoutError.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;

  const abortFromCaller = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timer = globalThis.setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    Math.max(1, timeoutMs),
  );

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut && isAbortError(error)) {
      throw new RequestTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function readResponseError(
  response: Response,
  fallback: string,
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as unknown;
      return messageFromJson(json) ?? fallback;
    }

    const text = safeMessage(await response.text());
    return text ?? fallback;
  } catch {
    return fallback;
  }
}

export async function ensureOk(
  response: Response,
  fallback: string,
): Promise<Response> {
  if (response.ok) return response;
  throw new HttpError(
    response.status,
    await readResponseError(response, fallback),
  );
}

export function toUserFacingNetworkError(
  error: unknown,
  fallback = "Unable to connect to the server. Please try again.",
): Error {
  if (error instanceof DOMException && error.name === "AbortError") {
    return error;
  }

  // API response bodies and status-derived messages are useful for diagnostics,
  // but they must not leak implementation details or raw status codes into the
  // interface. Callers keep the original error for logging and receive a
  // stable, user-facing message for rendering.
  return new Error(fallback);
}
