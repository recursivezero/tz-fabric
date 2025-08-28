export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

interface ChatResponse {
  reply: Message;
}

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8001";

export async function chatOnce(messages: Message[]): Promise<Message> {
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

  const data = (await res.json()) as ChatResponse;
  return data.reply;
}
