export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

// NEW: Action type from backend
export interface Action {
  type: "redirect_to_analysis";
  params: { image_url: string | null; mode: string };
}

export interface ChatResponse {
  reply: Message;
  action?: Action;
  bot_messages?: string[];
}

const API_BASE = "http://127.0.0.1:8000";

export async function chatOnce(messages: Message[]): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    let msg = `Request failed with ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) msg = String(data.detail);
    } catch {
      try {
        msg = await res.text();
      } catch {}
    }
    throw new Error(msg);
  }

  return (await res.json()) as ChatResponse;
}
