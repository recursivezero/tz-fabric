// src/hooks/chat.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message, type ChatResponse } from "../services/chat_api";
import { BASE_URL } from "../constants";

type Status = "idle" | "sending" | "error";

export default function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");

  // Media uploads
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    action: { type: string; params: any };
    analysis_responses?: { id: string; text: string }[];
    used_ids?: string[];
  } | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingAction, currentResponse]);

  // ---- Media handlers ----
  const handleImageUpload = useCallback(
    (file: File) => {
      if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
      setUploadedImageFile(file);
      setUploadedPreviewUrl(URL.createObjectURL(file));
    },
    [uploadedPreviewUrl]
  );

  const handleAudioUpload = useCallback(
    (file: File) => {
      if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
      setUploadedAudioFile(file);
      setUploadedAudioUrl(URL.createObjectURL(file));
    },
    [uploadedAudioUrl]
  );

  const clearImage = useCallback(() => {
    setUploadedImageFile(null);
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedPreviewUrl(null);
  }, [uploadedPreviewUrl]);

  const clearAudio = useCallback(() => {
    setUploadedAudioFile(null);
    if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
    setUploadedAudioUrl(null);
  }, [uploadedAudioUrl]);

  // ---- Helpers ----
  const normalizeId = useCallback((id: any) => {
    if (id === undefined || id === null) return "";
    return String(id);
  }, []);

  const extractFilenameFromText = (text: string): string | null => {
    const m = text.match(/(?:as|named)\s+(\w+)/i);
    return m ? m[1] : null;
  };

  // ---- MCP helper ----
  const callMcp = useCallback(async (tool: string, args: Record<string, any> = {}) => {
    const resp = await fetch(`${BASE_URL}/api/mcp/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, args }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${txt}`);
    }
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "MCP call failed");
    return data.result;
  }, []);

  // ---- Response handling ----
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

      if ((res as any).action?.type === "redirect_to_analysis" || (res as any).action?.type === "redirect_to_media_analysis") {
        const action = (res as any).action;
        const rawResponses = (res as any).analysis_responses || [];

        const normalizedResponses = rawResponses.map((r: any, i: number) => ({
          id: normalizeId(r.id ?? `r${i}`),
          text: r.text ?? r.content ?? String(r),
        }));

        if (normalizedResponses.length > 0) {
          const firstText = normalizedResponses[0].text;
          setMessages((prev) => [...prev, { role: "assistant", content: firstText }]);
          setCurrentResponse(firstText);
        }

        setPendingAction({
          action,
          analysis_responses: normalizedResponses,
          used_ids: normalizedResponses.length > 0 ? [normalizedResponses[0].id] : [],
        });
        return;
      }

      setPendingAction(null);
    },
    [normalizeId]
  );

  const acceptAction = useCallback(() => {
    if (!pendingAction) return;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Great — glad that helped!" },
    ]);
    setPendingAction(null);
  }, [pendingAction]);

  const rejectAction = useCallback(async () => {
    if (!pendingAction) return;
    // TODO: implement regenerate if needed
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Showing another alternative (mock)..." },
    ]);
    setPendingAction(null);
  }, [pendingAction]);

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !uploadedImageFile && !uploadedAudioFile) || status === "sending") return;

    setStatus("sending");
    setError("");

    if (text) setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const wantsAnalysis = /(?:\banalyz(?:e|ing|ed)\b|\banalyse\b|\binspect\b|\binspect(?:ion)?\b|\bscan\b)/i.test(text);

      // If there are files (image or audio), always upload them using single API:
      if (uploadedImageFile || uploadedAudioFile) {
        const form = new FormData();
        if (uploadedImageFile) form.append("image", uploadedImageFile);
        if (uploadedAudioFile) form.append("audio", uploadedAudioFile);

        // optional basename/filename coming from text
        const filename = extractFilenameFromText(text);
        if (filename) form.append("filename", filename);

        const upResp = await fetch(`${BASE_URL}/api/uploads/tmp_media`, { method: "POST", body: form });
        if (!upResp.ok) {
          const t = await upResp.text().catch(() => "");
          throw new Error(`Upload failed: ${upResp.status} ${t}`);
        }
        const upJson = await upResp.json();

        const hasAudio = Boolean(upJson.audio_url) || Boolean(uploadedAudioFile);
        const imageUrl = upJson.image_url;
        const audioUrl = upJson.audio_url;

        if (hasAudio) {
          const toolArgs: any = { image_url: imageUrl, audio_url: audioUrl, filename: upJson.basename ?? upJson.filename ?? filename };
          const mcpResult = await callMcp("redirect_to_media_analysis", toolArgs);

          handleResponse({
            reply: { role: "assistant", content: "Media uploaded and queued." },
            bot_messages: mcpResult.bot_messages || [],
            action: mcpResult.action,
          } as any);

        } else {
          if (wantsAnalysis && imageUrl) {
            const mcpResult = await callMcp("redirect_to_analysis", { image_url: imageUrl, mode: "short" });

            handleResponse({
              reply: { role: "assistant", content: "Image uploaded and analysis started." },
              bot_messages: mcpResult.bot_messages || [],
              action: mcpResult.action,
            } as any);
          } else {
           
            const mcpResult = await callMcp("redirect_to_media_analysis", { image_url: imageUrl, audio_url: null, filename: upJson.basename ?? upJson.filename ?? filename });

            handleResponse({
              reply: { role: "assistant", content: "Image uploaded and queued for processing." },
              bot_messages: mcpResult.bot_messages || [],
              action: mcpResult.action,
            } as any);
          }
        }

        // cleanup
        clearImage();
        clearAudio();
        setStatus("idle");
        return;
      }

      // No files: fallback to normal chat flow
      const chatRes = await chatOnce([...messages, { role: "user", content: text }]);
      handleResponse(chatRes);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Something went wrong.");
    }
  }, [input, messages, uploadedImageFile, uploadedAudioFile, status, callMcp, handleResponse, clearImage, clearAudio]);


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
    clearImage();
    clearAudio();
    setPendingAction(null);
    setCurrentResponse(null);
  }, [clearImage, clearAudio]);

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
    uploadedAudioUrl,
    handleImageUpload,
    handleAudioUpload,
    clearImage,
    clearAudio,
    pendingAction,
    acceptAction,
    rejectAction,
    currentResponse,
  };
}
