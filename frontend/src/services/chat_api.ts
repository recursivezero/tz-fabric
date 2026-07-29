import { FULL_API_URL } from "../constants";
import { fetchWithTimeout } from "../utils/http";

export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

export interface Action {
  type: string;
  params?: Record<string, unknown>;
}

export interface AnalysisItem {
  id?: string | number;
  text?: string;
}

export interface ChatResponse {
  reply?: Message;
  action?: Action;
  bot_messages?: string[];
  analysis_responses?: AnalysisItem[];
}

export interface ChatRequestOptions {
  /** Retry one temporary transport/gateway failure for idempotent text chat. */
  retryTransient?: boolean;
  signal?: AbortSignal;
}

const API_READY_DELAYS_MS = [0, 250, 500, 1000] as const;
const API_READY_TIMEOUT_MS = 1500;
const CHAT_REQUEST_TIMEOUT_MS = 60_000;
const CHAT_RETRY_DELAY_MS = 400;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

let apiReady = false;
let apiReadinessPromise: Promise<void> | null = null;

class ChatApiError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    message: string,
    options?: { retryable?: boolean; status?: number },
  ) {
    super(message);
    this.name = "ChatApiError";
    this.retryable = options?.retryable ?? false;
    this.status = options?.status;
  }
}

const delay = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = window.setTimeout(resolve, milliseconds);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Unknown connection error";
};

async function probeApiHealth(): Promise<void> {
  const response = await fetchWithTimeout(
    `${FULL_API_URL}/health`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
    API_READY_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new ChatApiError(
      `API readiness check failed with status ${response.status}`,
      {
        retryable: RETRYABLE_STATUS_CODES.has(response.status),
        status: response.status,
      },
    );
  }
}

async function ensureApiReady(): Promise<void> {
  if (apiReady) return;
  if (apiReadinessPromise) return apiReadinessPromise;

  apiReadinessPromise = (async () => {
    let lastError: unknown = new Error("API readiness check did not run");

    for (const waitMilliseconds of API_READY_DELAYS_MS) {
      if (waitMilliseconds > 0) await delay(waitMilliseconds);

      try {
        await probeApiHealth();
        apiReady = true;
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw new ChatApiError(`Cannot reach server — ${errorMessage(lastError)}`, {
      retryable: true,
    });
  })();

  try {
    await apiReadinessPromise;
  } finally {
    apiReadinessPromise = null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRole(value: unknown): value is Role {
  return value === "user" || value === "assistant" || value === "system";
}

function isMessage(value: unknown): value is Message {
  return (
    isRecord(value) && isRole(value.role) && typeof value.content === "string"
  );
}

function isAction(value: unknown): value is Action {
  return isRecord(value) && typeof value.type === "string";
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isAnalysisItem(value: unknown): value is AnalysisItem {
  return (
    isRecord(value) &&
    (typeof value.id === "string" ||
      typeof value.id === "number" ||
      typeof value.id === "undefined") &&
    (typeof value.text === "string" || typeof value.text === "undefined")
  );
}

function isAnalysisArray(value: unknown): value is AnalysisItem[] {
  return Array.isArray(value) && value.every(isAnalysisItem);
}

function coerceChatResponse(value: unknown): ChatResponse {
  if (!isRecord(value)) return {};
  const response: ChatResponse = {};

  if (isMessage(value.reply)) response.reply = value.reply;
  if (isAction(value.action)) response.action = value.action;
  if (isStringArray(value.bot_messages)) {
    response.bot_messages = value.bot_messages;
  }
  if (isAnalysisArray(value.analysis_responses)) {
    response.analysis_responses = value.analysis_responses;
  }

  return response;
}

function extractServerMessage(raw: unknown, status: number): string {
  if (isRecord(raw) && typeof raw.detail === "string" && raw.detail.trim()) {
    return raw.detail.slice(0, 320);
  }
  if (isRecord(raw) && typeof raw.message === "string" && raw.message.trim()) {
    return raw.message.slice(0, 320);
  }

  if (status === 503) {
    return "Chat service unavailable. Please try again shortly.";
  }
  return `Chat request failed (${status}).`;
}

async function requestChat(
  messages: Message[],
  signal?: AbortSignal,
): Promise<ChatResponse> {
  let response: Response;

  try {
    response = await fetchWithTimeout(
      `${FULL_API_URL}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal,
      },
      CHAT_REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    apiReady = false;
    throw new ChatApiError("Cannot reach server — check your network", {
      retryable: true,
    });
  }

  const rawText = await response.text();
  let raw: unknown = null;

  if (rawText) {
    try {
      raw = JSON.parse(rawText) as unknown;
    } catch {
      if (!response.ok) {
        const retryable = RETRYABLE_STATUS_CODES.has(response.status);
        if (retryable) apiReady = false;
        throw new ChatApiError(`Chat request failed (${response.status}).`, {
          retryable,
          status: response.status,
        });
      }
      throw new ChatApiError("The chat service returned an invalid response.", {
        status: response.status,
      });
    }
  }

  if (!response.ok) {
    const retryable = RETRYABLE_STATUS_CODES.has(response.status);
    if (retryable) apiReady = false;
    throw new ChatApiError(extractServerMessage(raw, response.status), {
      retryable,
      status: response.status,
    });
  }

  const parsed = coerceChatResponse(raw);
  if (!parsed.reply && !parsed.bot_messages && !parsed.analysis_responses) {
    throw new ChatApiError(
      "The chat service returned an unsupported response.",
    );
  }

  return parsed;
}

export async function chatOnce(
  messages: Message[],
  options: ChatRequestOptions = {},
): Promise<ChatResponse> {
  if (options.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  await ensureApiReady();

  const maxAttempts = options.retryTransient ? 2 : 1;
  let lastError: unknown = new Error("Chat request did not run");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestChat(messages, options.signal);
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < maxAttempts &&
        error instanceof ChatApiError &&
        error.retryable &&
        !options.signal?.aborted;

      if (!canRetry) throw error;

      await delay(CHAT_RETRY_DELAY_MS, options.signal);
      await ensureApiReady();
    }
  }

  throw lastError;
}
