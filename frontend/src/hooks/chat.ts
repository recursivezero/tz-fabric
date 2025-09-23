// src/hooks/chat.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message, type ChatResponse } from "../services/chat_api";
import { FULL_API_URL } from "../constants";

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

  // Abort controller ref for stop functionality
  const abortRef = useRef<AbortController | null>(null);

  // Helper: create a fresh AbortController and return its signal; also store it in abortRef
  const createAbort = useCallback(() => {
    // abort previous if still present
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    const ac = new AbortController();
    abortRef.current = ac;
    return ac.signal;
  }, []);

  // Helper: wrap any promise so it rejects quickly if current abortRef is aborted
  // If the promise doesn't accept a signal, this will still allow us to cancel via race
  const withAbort = useCallback(
    <T,>(p: Promise<T>) => {
      const ac = abortRef.current;
      if (!ac) return p;
      return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
          const err = new Error("Aborted");
          // mimic DOMException name to allow detection
          (err as any).name = "AbortError";
          reject(err);
        };

        if (ac.signal.aborted) {
          onAbort();
          return;
        }

        ac.signal.addEventListener("abort", onAbort, { once: true });

        p.then((v) => {
          ac.signal.removeEventListener("abort", onAbort);
          resolve(v);
        }).catch((err) => {
          ac.signal.removeEventListener("abort", onAbort);
          reject(err);
        });
      });
    },
    []
  );

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `👋 Hi, I’m FabricAI!  
I can help you with:
- 📤 Uploading fabric images or audio
- 📝 Giving short or long analysis
- 🔁 Regenerating and comparing results  

👉 Try typing: "Analyze this image" or upload a file to begin.`,
        },
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingAction, currentResponse]);

  // ---- Media handlers ----
  const validateImageFile = useCallback(async (file: File) => {
    try {
      const form = new FormData();
      form.append("image", file);
      const resp = await fetch(`${FULL_API_URL}/validate-image`, {
        method: "POST",
        body: form,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { ok: false, reason: `Validation service error: ${resp.status} ${txt}` };
      }

      const json = await resp.json().catch(() => ({}));
      if (json && json.valid) return { ok: true };
      if (json && typeof json.reason === "string") return { ok: false, reason: json.reason };
      return { ok: false, reason: "Image did not pass fabric validation." };
    } catch (err: any) {
      console.error("validateImageFile error:", err);
      return { ok: false, reason: err?.message || "Validation request failed" };
    }
  }, []);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (uploadedPreviewUrl) {
        try { URL.revokeObjectURL(uploadedPreviewUrl); } catch { }
      }

      setStatus("sending");
      setError("");

      try {
        const res = await validateImageFile(file);
        if (!res.ok) {
          setStatus("idle");
          setError(res.reason || "Image validation failed. Please try another close-up fabric photo.");
          setUploadedImageFile(null);
          setUploadedPreviewUrl(null);
          return;
        }

        setUploadedImageFile(file);
        const url = URL.createObjectURL(file);
        setUploadedPreviewUrl(url);
        setStatus("idle");
        setError("");
      } catch (err: any) {
        console.error("handleImageUpload error:", err);
        setStatus("idle");
        setError(err?.message || "Failed to upload image for validation.");
      }
    },
    [uploadedPreviewUrl, validateImageFile]
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

  // ---- MCP helper (now supports optional signal) ----
  const callMcp = useCallback(async (tool: string, args: Record<string, any> = {}) => {
    // include signal if abortRef exists
    const signal = abortRef.current ? abortRef.current.signal : undefined;
    const resp = await fetch(`${FULL_API_URL}/mcp/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, args }),
      signal,
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

    const { analysis_responses = [], used_ids = [], action } = pendingAction;

    // 1) Try local unused response first
    const nextLocal = (analysis_responses || []).find((r) => !used_ids?.includes(r.id));
    if (nextLocal) {
      setMessages((prev) => [...prev, { role: "assistant", content: nextLocal.text }]);
      setCurrentResponse(nextLocal.text);
      setPendingAction((prev) =>
        prev ? { ...prev, used_ids: [...(prev.used_ids || []), nextLocal.id] } : prev
      );
      return;
    }

    // 2) No local left → call regenerate
    try {
      const regenArgs: any = { used_ids };
      const cacheKey = action?.params?.cache_key;
      if (cacheKey) regenArgs.cache_key = cacheKey;
      if (action?.params?.image_url) regenArgs.image_url = action.params.image_url;
      if (action?.params?.mode) regenArgs.mode = action.params.mode;

      // create abort signal for this call
      createAbort();
      const regenResult = await withAbort(callMcp("regenerate", regenArgs));

      // Normalize responses
      let newResponses: { id: string; text: string }[] = [];
      if (regenResult?.response) {
        newResponses = [
          {
            id: String(regenResult.response.id ?? regenResult.selected_index ?? `r${Date.now()}`),
            text:
              regenResult.response.response ??
              regenResult.response.text ??
              regenResult.response.message ??
              String(regenResult.response),
          },
        ];
      } else if (Array.isArray(regenResult?.responses)) {
        newResponses = regenResult.responses.map((x: any, i: number) => ({
          id: String(x.id ?? x.response_id ?? x.rid ?? `r${i}`),
          text: x.response ?? x.text ?? x.content ?? String(x),
        }));
      }

      const prevIds = new Set([...(used_ids || []), ...(analysis_responses || []).map((r) => r.id)]);
      const prevTexts = new Set((analysis_responses || []).map((r) => r.text));

      const filtered = newResponses.filter(
        (r) => !prevIds.has(r.id) && !prevTexts.has(r.text)
      );

      if (filtered.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "No new cached alternatives available." },
        ]);
        setPendingAction(null);
        return;
      }

      const sel = filtered[0];

      setMessages((prev) => [...prev, { role: "assistant", content: sel.text }]);
      setCurrentResponse(sel.text);

      setPendingAction((prev) =>
        prev
          ? {
            ...prev,
            analysis_responses: [...(prev.analysis_responses || []), ...filtered],
            used_ids: [...(prev.used_ids || []), sel.id],
          }
          : prev
      );
    } catch (err: any) {
      if ((err as any)?.name === "AbortError") {
        // user aborted regenerate -> just clear abort and return
        console.log("[rejectAction] aborted by user");
      } else {
        console.error("[rejectAction] regenerate error:", err);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Failed to fetch another alternative. Please try again." },
        ]);
      }
      setPendingAction(null);
    } finally {
      // clear abort controller
      if (abortRef.current) {
        abortRef.current = null;
      }
    }
  }, [pendingAction, callMcp, setMessages, setPendingAction, setCurrentResponse, createAbort, withAbort]);

  // ---- send / retry / stop ----
  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !uploadedImageFile && !uploadedAudioFile) || status === "sending") return;

    // create new abort controller for this send operation
    createAbort();

    setStatus("sending");
    setError("");

    if (text) setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const wantsAnalysis = /(?:\banalyz(?:e|ing|ed)\b|\banalyse\b|\binspect\b|\binspect(?:ion)?\b|\bscan\b)/i.test(text);

      if (uploadedImageFile || uploadedAudioFile) {
        const form = new FormData();
        if (uploadedImageFile) form.append("image", uploadedImageFile);
        if (uploadedAudioFile) form.append("audio", uploadedAudioFile);

        const filename = extractFilenameFromText(text);
        if (filename) form.append("filename", filename);

        // Upload temporarily (we pass the current abort signal implicitly via fetch inside callMcp)
        const upResp = await withAbort(fetch(`${FULL_API_URL}/uploads/tmp_media`, { method: "POST", body: form }), );
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
          const mcpResult = await withAbort(callMcp("redirect_to_media_analysis", toolArgs));
          handleResponse({
            reply: { role: "assistant", content: "Media uploaded and queued." },
            bot_messages: mcpResult.bot_messages || [],
            action: mcpResult.action,
          } as any);
        } else {
          if (wantsAnalysis && imageUrl) {
            const mcpResult = await withAbort(callMcp("redirect_to_analysis", { image_url: imageUrl, mode: "short" }));
            handleResponse({
              reply: { role: "assistant", content: "Image uploaded and analysis started." },
              bot_messages: mcpResult.bot_messages || [],
              action: mcpResult.action,
            } as any);
          } else {
            const mcpResult = await withAbort(callMcp("redirect_to_media_analysis", { image_url: imageUrl, audio_url: null, filename: upJson.basename ?? upJson.filename ?? filename }));
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
        // clear controller
        if (abortRef.current) {
          abortRef.current = null;
        }
        return;
      }
      const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: text }]));
      handleResponse(chatRes);
      setStatus("idle");
      if (abortRef.current) abortRef.current = null;
    } catch (e: any) {
      if ((e as any)?.name === "AbortError" || e?.message === "Aborted") {
        // user stopped the request
        setStatus("idle");
        setError("");
      } else {
        setStatus("error");
        setError(e?.message || "Something went wrong.");
      }
      // Clear any lingering controller
      if (abortRef.current) abortRef.current = null;
    }
  }, [input, messages, uploadedImageFile, uploadedAudioFile, status, callMcp, handleResponse, clearImage, clearAudio, createAbort, withAbort]);

  const retryLast = useCallback(async () => {
    if (status === "sending" || messages.length === 0) return;

    createAbort();
    setStatus("sending");
    setError("");
    try {
      const res = await withAbort(chatOnce(messages));
      handleResponse(res);
      setStatus("idle");
    } catch (e: any) {
      if ((e as any)?.name === "AbortError") {
        setStatus("idle");
        setError("");
      } else {
        setStatus("error");
        setError(e?.message || "Something went wrong.");
      }
    } finally {
      if (abortRef.current) abortRef.current = null;
    }
  }, [messages, status, handleResponse, createAbort, withAbort]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
      abortRef.current = null;
    }
    setStatus("idle");
  }, []);

  const newChat = useCallback(() => {
    // cancel any in-flight request
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
      abortRef.current = null;
    }

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
    stop, 
  };
}
