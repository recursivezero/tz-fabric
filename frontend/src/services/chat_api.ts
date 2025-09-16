// src/services/chat_api.ts
export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

export interface Action {
  type: "redirect_to_analysis";
  params: { image_url: string | null; mode: string };
}

export interface ChatResponse {
  reply: Message;
  action?: Action;
  bot_messages?: string[];
  analysis_responses?: { id: string; text: string }[];
}

const API_BASE = "http://127.0.0.1:8000";

export async function chatOnce(messages: Message[]): Promise<ChatResponse> {
  console.log("chatOnce called, messages:", messages);
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  console.log("response received from /api/chat", res);
  console.log("/api/chat status:", res.status);

  let json: any;
  try {
    json = await res.json();
    console.log("/api/chat response json:", json);
  } catch (e) {
    console.error("Failed to parse /api/chat JSON response", e);
    throw new Error(`Failed to parse server response (status ${res.status})`);
  }

  if (!res.ok) {
    let msg = `Request failed with ${res.status}`;
    if (json?.detail) msg = String(json.detail);
    else if (typeof json === "string") msg = json;
    throw new Error(msg);
  }

  return json as ChatResponse;
}
