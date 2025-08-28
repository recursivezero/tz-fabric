import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message } from "../services/chat_api";

type Status = "idle" | "sending" | "error";

export default function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || status === "sending") return;

    setStatus("sending");
    setError("");

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");

    try {
      const reply = await chatOnce(next);
      setMessages((prev) => [...prev, reply]);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Something went wrong.");
    }
  }, [input, messages, status]);

  const retryLast = useCallback(async () => {
    if (status === "sending" || messages.length === 0) return;
    setStatus("sending");
    setError("");
    try {
      const reply = await chatOnce(messages);
      setMessages((prev) => [...prev, reply]);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Something went wrong.");
    }
  }, [messages, status]);

  const newChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setStatus("idle");
    setError("");
  }, []);

  return {
    messages,
    input,
    setInput,
    status,
    error,
    send,
    retryLast,
    newChat,
    scrollerRef,
  };
}
