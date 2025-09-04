import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message, type ChatResponse } from "../services/chat_api";
import { useNavigate } from "react-router-dom";

type Status = "idle" | "sending" | "error";

export default function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleUpload = useCallback((file: File) => {
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedFile(file);
    setUploadedPreviewUrl(URL.createObjectURL(file));
  }, [uploadedPreviewUrl]);

  const clearUpload = useCallback(() => {
    setUploadedFile(null);
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedPreviewUrl(null);
  }, [uploadedPreviewUrl]);

  const handleResponse = useCallback(
    (res: ChatResponse) => {
      if (res.bot_messages && res.bot_messages.length > 0) {
        setMessages((prev) => [
          ...prev,
          ...res.bot_messages.map((txt) => ({ role: "assistant", content: txt })),
        ]);
      } else {
        setMessages((prev) => [...prev, res.reply]);
      }
      if (res.action?.type === "redirect_to_analysis") {
        const { image_url, mode } = res.action.params;
        navigate(`/describe?mode=${mode}${image_url ? `&image_url=${encodeURIComponent(image_url)}` : ""}`);
      }
    },
    [navigate]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !uploadedFile) || status === "sending") return;

    setStatus("sending");
    setError("");

    const next: Message[] = text ? [...messages, { role: "user", content: text }] : [...messages];
    if (text) setMessages(next);
    setInput("");

    try {
      let res: ChatResponse;
      if (uploadedFile) {
        
        const formData = new FormData();
        formData.append("image", uploadedFile);
        formData.append("analysis_type", "short");
        const resp = await fetch("http://127.0.0.1:8000/api/analyse", { method: "POST", body: formData });
        const data = await resp.json();
        res = {
          reply: { role: "assistant", content: "Image uploaded and analyzed." },
          bot_messages: [data?.response?.response || "Analysis complete."],
        };
      } else {
        res = await chatOnce(next);
      }

      handleResponse(res);
      setStatus("idle");
      
      clearUpload();
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Something went wrong.");
    }
  }, [input, messages, status, uploadedFile, handleResponse, clearUpload]);

  const retryLast = useCallback(async () => {
    if (status === "sending" || messages.length === 0) return;
    setStatus("sending");
    setError("");
    try {
      const res = await chatOnce(messages);
      handleResponse(res);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Something went wrong.");
    }
  }, [messages, status, handleResponse]);

  const newChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setStatus("idle");
    setError("");
    clearUpload();
  }, [clearUpload]);

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
    uploadedPreviewUrl,
    handleUpload,
    clearUpload,
  };
}
