// src/services/chat_api.ts
import { FULL_API_URL } from "../constants";

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isRole(v: unknown): v is Role {
  return v === "user" || v === "assistant" || v === "system";
}

function isMessage(v: unknown): v is Message {
  return (
    isRecord(v) &&
    isRole(v.role) &&
    typeof v.content === "string"
  );
}

function isAction(v: unknown): v is Action {
  return isRecord(v) && typeof v.type === "string";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === "string");
}

function isAnalysisItem(v: unknown): v is AnalysisItem {
  return (
    isRecord(v) &&
    (typeof v.id === "string" || typeof v.id === "number" || typeof v.id === "undefined") &&
    (typeof v.text === "string" || typeof v.text === "undefined")
  );
}

function isAnalysisArray(v: unknown): v is AnalysisItem[] {
  return Array.isArray(v) && v.every(isAnalysisItem);
}

function coerceChatResponse(u: unknown): ChatResponse {
  if (!isRecord(u)) return {};
  const out: ChatResponse = {};

  if (isMessage(u.reply)) out.reply = u.reply;

  if (isAction(u.action)) out.action = u.action as Action;

  if (isStringArray(u.bot_messages)) out.bot_messages = u.bot_messages;

  if (isAnalysisArray(u.analysis_responses)) {
    out.analysis_responses = u.analysis_responses;
  }

  return out;
}

export async function chatOnce(messages: Message[]): Promise<ChatResponse> {
  console.log("chatOnce called, messages:", messages);

  const res = await fetch(`${FULL_API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  console.log("response received from /api/chat", res);
  console.log("/api/chat status:", res.status);

  let raw: unknown;
  try {
    raw = await res.json();
    console.log("/api/chat response json:", raw);
  } catch (e) {
    console.error("Failed to parse /api/chat JSON response", e);
    throw new Error(`Failed to parse server response (status ${res.status})`);
  }

  if (!res.ok) {
    let msg = `Request failed with ${res.status}`;
    if (isRecord(raw) && typeof raw.detail === "string") msg = raw.detail;
    else if (typeof raw === "string") msg = raw;
    throw new Error(msg);
  }

  const parsed = coerceChatResponse(raw);

  if (!parsed.reply && !parsed.bot_messages && !parsed.analysis_responses) {
    const sample = isRecord(raw) ? JSON.stringify(raw) : String(raw);
    throw new Error(`Unexpected response shape from /chat: ${sample}`);
  }

  return parsed;
}
