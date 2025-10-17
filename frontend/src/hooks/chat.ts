import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message, type ChatResponse } from "../services/chat_api";
import { FULL_API_URL } from "../constants";
import { extractFilenameFromText } from "../utils/extractFilenameFromText";

type Status = "idle" | "sending" | "error" | "validating";

type AnalysisItem = { id?: string; text?: string; content?: string };
type ToolActionParams = {
  cache_key?: string;
  image_url?: string;
  audio_url?: string | null;
  filename?: string;
  mode?: "short" | "long" | string;
  [k: string]: unknown;
};
type ToolAction = { type: string; params?: ToolActionParams };

type RichChatResponse = ChatResponse & Partial<{
  bot_messages: string[];
  action: ToolAction;
  analysis_responses: AnalysisItem[];
  results: unknown[];
}>;

const normalizeLLMText = (t: unknown): string => {
  if (t == null) return "";
  if (typeof t === "object") {
    const o = t as Record<string, unknown>;
    const inner =
      (o.response as Record<string, unknown> | undefined)?.response ??
      (o.response as Record<string, unknown> | undefined)?.text ??
      (o.response as Record<string, unknown> | undefined)?.message ??
      o.response ?? o.text ?? o.message ?? null;
    if (inner != null) return normalizeLLMText(inner);
    try { return JSON.stringify(t); } catch { return String(t); }
  }
  let s = String(t).trim();
  s = s.replace(/\\n/g, "\n").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n");
  return s.trim();
};

const PRESET_QA: Record<string, string> = {
  "explain knit vs woven (simple).": `Here’s the quick difference:

• Knit: Made by interlocking loops (like T-shirts, hoodies).
  - Feel: Stretchy, soft, drapes well.
  - Edge: Doesn’t fray easily, curls at edges.

• Woven: Two yarn sets (warp & weft) crossing at right angles (like shirts, jeans).
  - Feel: Usually less stretchy (unless elastane added), more structured.
  - Edge: Frays when cut.`,
  "how do i use the image analysis feature?": `Quick steps:
1) Upload a close-up fabric photo (texture visible).
2) Pick “Analyze (short)” for a quick overview or “Analyze (long)” for details.
3) Optional: Add audio to describe context (e.g., “This is cotton twill”).
4) Use “Search similar” to find nearest matches in your library.
Tip: Avoid full garments or backgrounds; close-up of weave/texture works best.`,
  "suggest tags for a denim fabric photo.": `Suggested tags:
• Material: Denim, Cotton, Indigo
• Construction: Twill, 3x1, Ring-spun
• Look: Faded, Raw, Distressed, Slub
• Weight: Mid-weight, Heavy
• Use: Jeans, Jacket, Workwear
Pick the 5–8 most relevant for clarity.`,
  "what is gsm in fabrics?": `GSM = Grams per Square Meter (fabric weight).
• Lower GSM (e.g., 120–160): lighter, airy (tees, summer).
• Mid GSM (180–240): everyday knits/wovens.
• Higher GSM (260+): heavier, warmer, more structured.
Rule of thumb: Higher GSM = thicker/denser, but fiber & weave also affect feel and drape.`,
};
const norm = (s: string) => (s || "").trim().toLowerCase();

export default function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [shouldNavigateToList, setShouldNavigateToList] = useState<boolean>(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    action: ToolAction;
    analysis_responses?: { id: string; text: string }[];
    used_ids?: string[];
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const navigateTimeoutRef = useRef<number | null>(null);
  const lastMsgCountRef = useRef<number>(0);

  // Preset follow-up control
  const pendingPresetRef = useRef<string | null>(null);
  const [morePrompt, setMorePrompt] = useState<{ question: string } | null>(null);
  const lastFollowedUpRef = useRef<string | null>(null); // prevents early/dup follow-ups

  const scheduleNavigateToList = useCallback((delay = 3000) => {
    if (navigateTimeoutRef.current) {
      window.clearTimeout(navigateTimeoutRef.current);
      navigateTimeoutRef.current = null;
    }
    navigateTimeoutRef.current = window.setTimeout(() => {
      setShouldNavigateToList(true);
      navigateTimeoutRef.current = null;
    }, delay);
  }, []);

  const createAbort = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* ignore */ }
    }
    const ac = new AbortController();
    abortRef.current = ac;
    return ac.signal;
  }, []);

  const withAbort = useCallback(<T,>(p: Promise<T>) => {
    const ac = abortRef.current;
    if (!ac) return p;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (ac.signal.aborted) {
        onAbort(); return;
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
  }, []);

  // Show welcome only once per tab
  useEffect(() => {
    const seen = sessionStorage.getItem("fabricAI_welcome_seen");
    if (messages.length === 0 && !seen) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: normalizeLLMText(`👋 Hi, I’m FabricAI! I can help you with:
- 📤 Uploading fabric images and audio
- 📝 Giving short or long analysis
- 🔍 Searching for similar images
- 🔁 Regenerating and comparing results`),
      }]);
      sessionStorage.setItem("fabricAI_welcome_seen", "1");
    }
  }, [messages.length]);

  // Auto-scroll
  useEffect(() => {
    const prev = lastMsgCountRef.current;
    const curr = messages.length;
    if (curr !== prev) {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      lastMsgCountRef.current = curr;
    }
  });

  const errorMsg = useCallback(
    (err: unknown, fallback = "Something went wrong.") =>
      err instanceof Error ? err.message : (typeof err === "string" ? err : fallback),
    []
  );

  const validateImageFile = useCallback(async (file: File) => {
    const t0 = performance.now();
    try {
      const form = new FormData();
      form.append("image", file);
      const tForm = performance.now();

      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 30000);

      const resp = await fetch(`${FULL_API_URL}/validate-image`, {
        method: "POST",
        body: form,
        signal: ac.signal,
      });
      clearTimeout(timeout);
      const tResp = performance.now();

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.log("[timing] form:", (tForm - t0).toFixed(0), "ms | request:", (tResp - tForm).toFixed(0), "ms");
        return { ok: false as const, reason: `Validation service error: ${resp.status} ${txt}` };
      }

      const json: unknown = await resp.json().catch(() => ({}));
      const tJson = performance.now();

      console.log("[timing] form:", (tForm - t0).toFixed(0), "ms | request:", (tResp - tForm).toFixed(0), "ms | json:", (tJson - tResp).toFixed(0), "ms");

      const valid = typeof json === "object" && json !== null && (json as { valid?: boolean }).valid === true;
      if (valid) return { ok: true as const };

      const reason = (json as { reason?: string }).reason;
      if (typeof reason === "string") return { ok: false as const, reason };
      return { ok: false as const, reason: "Image did not pass fabric validation." };
    } catch (err: unknown) {
      console.error("validateImageFile error:", err);
      return { ok: false as const, reason: errorMsg(err, "Validation request failed") };
    }
  }, [errorMsg]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (uploadedPreviewUrl) {
      try { URL.revokeObjectURL(uploadedPreviewUrl); } catch { }
    }
    setStatus("validating");
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
    } catch (err: unknown) {
      console.error("handleImageUpload error:", err);
      setStatus("idle");
      setError(errorMsg(err, "Failed to upload image for validation."));
    }
  }, [uploadedPreviewUrl, validateImageFile, errorMsg]);

  const handleAudioUpload = useCallback((file: File) => {
    if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
    setUploadedAudioFile(file);
    setUploadedAudioUrl(URL.createObjectURL(file));
  }, [uploadedAudioUrl]);

  const getModeFromText = useCallback((text: string | undefined | null): "short" | "long" => {
    if (!text) return "short";
    const s = String(text).toLowerCase();
    if (/\blong\b|\bdetailed\b|\bfull\b|\bin-depth\b|\bextended\b|\bcomprehensive\b/.test(s)) return "long";
    if (/\bshort\b|\bbrief\b|\bsummary\b|\bconcise\b|\bquick\b/.test(s)) return "short";
    return "short";
  }, []);

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

  const fileToBase64 = useCallback((file: File): Promise<{ base64: string; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        if (comma === -1) {
          resolve({ base64: result, dataUrl: result }); return;
        }
        const dataUrl = result;
        const base64 = result.slice(comma + 1);
        resolve({ base64, dataUrl });
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const getAction = useCallback((r: RichChatResponse): ToolAction | undefined => r.action, []);
  const getAnalysis = useCallback(
    (r: RichChatResponse): AnalysisItem[] => Array.isArray(r.analysis_responses) ? r.analysis_responses : [],
    []
  );
  const getBots = useCallback(
    (r: RichChatResponse): string[] => Array.isArray(r.bot_messages) ? r.bot_messages : [],
    []
  );

  const handleResponse = useCallback((res: ChatResponse) => {
    const rc = res as RichChatResponse;
    setMessages(prev => {
      const next = [...prev];
      const bots = getBots(rc);
      if (bots.length) {
        next.push(...bots.map(txt => ({ role: "assistant", content: normalizeLLMText(txt) })));
      } else if (rc.reply) {
        next.push({ role: "assistant", content: normalizeLLMText(rc.reply.content) });
      }
      const action = getAction(rc);
      const raw = getAnalysis(rc);
      const hasCache = Boolean(action?.params?.cache_key);
      const normalized = raw.map((r, i) => ({
        id: hasCache ? String(i + 1) : String(r.id ?? `r${i}`),
        text: r.text ?? r.content ?? String(r ?? ""),
      }));
      if (
        action &&
        (action.type === "redirect_to_analysis" || action.type === "redirect_to_media_analysis") &&
        normalized.length > 0
      ) {
        const firstText = normalizeLLMText(normalized[0].text);
        const lastAssistant = next.slice().reverse().find(m => m.role === "assistant");
        const alreadyIncluded =
          bots.includes(firstText) || (lastAssistant && lastAssistant.content === firstText);
        if (!alreadyIncluded) {
          next.push({ role: "assistant", content: firstText });
        }
        setCurrentResponse(firstText);
        setPendingAction({
          action,
          analysis_responses: normalized.map(r => ({ ...r, text: normalizeLLMText(r.text) })),
          used_ids: [normalized[0].id],
        });
      } else {
        setPendingAction(null);
      }
      return next;
    });
  }, [getBots, getAction, getAnalysis]);

  const acceptAction = useCallback(() => {
    if (!pendingAction) return;
    setMessages(prev => [...prev, { role: "assistant", content: "Great — glad that helped!" }]);
    setPendingAction(null);
  }, [pendingAction]);

  const rejectAction = useCallback(async () => {
    if (!pendingAction) return;
    const { action } = pendingAction;
    const cacheKey = action?.params?.cache_key;
    const imageUrl = action?.params?.image_url;
    const mode = (action?.params?.mode as ("short" | "long" | undefined)) || "short";
    if (!cacheKey) {
      setMessages(prev => [...prev, { role: "assistant", content: "No cache_key found." }]);
      return;
    }
    const instr = `Regenerate: cache_key=${cacheKey} image_url=${imageUrl} mode=${mode}`;
    try {
      createAbort();
      const regenChatRes = await withAbort(
        chatOnce([...messages, { role: "user", content: instr }])
      );
      const rc = regenChatRes as RichChatResponse;
      let responseText: string | null = null;
      if (rc.response) {
        const r = rc.response as unknown as Record<string, unknown>;
        responseText =
          (r.response as string | undefined) ??
          (r.text as string | undefined) ??
          (r.message as string | undefined) ??
          String(rc.response);
      } else if (rc.analysis_responses?.[0]) {
        responseText = rc.analysis_responses[0]?.text ?? "";
      } else if (rc.bot_messages?.[0]) {
        responseText = rc.bot_messages[0] ?? "";
      } else if (rc.reply?.content) {
        responseText = rc.reply.content ?? "";
      } else {
        responseText = String(regenChatRes);
      }
      const clean = normalizeLLMText(responseText);
      if (!clean) {
        setMessages(prev => [...prev, { role: "assistant", content: "No new alternative available." }]);
        setPendingAction(null);
        return;
      }
      const lower = clean.toLowerCase();
      if (lower.includes("all cached alternatives") || lower.includes("no more") || lower.includes("finished")) {
        setMessages(prev => [...prev, { role: "assistant", content: clean }]);
        setPendingAction(null);
        return;
      }
      setMessages(prev => [...prev, { role: "assistant", content: clean }]);
      setCurrentResponse(clean);
    } catch (err: unknown) {
      console.error("[rejectAction error]", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Failed to get a new alternative." }]);
    } finally {
      if (abortRef.current) abortRef.current = null;
    }
  }, [pendingAction, messages, createAbort, withAbort]);

  const searchSimilar = useCallback(async (k: number, min_sim = 0.5) => {
    if (!uploadedImageFile) {
      setError("No image uploaded to search with.");
      return null;
    }
    try {
      createAbort();
      setStatus("sending");
      setError("");
      const { base64, dataUrl } = await fileToBase64(uploadedImageFile);
      const form = new FormData();
      form.append("image", uploadedImageFile);
      const upResp = await withAbort(fetch(`${FULL_API_URL}/uploads/tmp_media`, { method: "POST", body: form }));
      if (!upResp.ok) {
        const t = await upResp.text().catch(() => "");
        throw new Error(`Upload failed: ${upResp.status} ${t}`);
      }
      const upJson = (await upResp.json()) as Record<string, unknown>;
      const imageUrl = upJson.image_url as string | undefined;
      console.log("[searchSimilar] uploaded image, imageUrl:", imageUrl);
      if (!imageUrl) {
        console.warn("[searchSimilar] no image_url returned from upload - falling back to base64 search via /search endpoint");
        const args = {
          image_b64: base64, k: Number(k) || 1, min_sim: Number(min_sim),
          order: "recent" as const, require_audio: false,
        };
        const searchResp = await withAbort(fetch(`${FULL_API_URL}/search`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args),
        }));
        if (!searchResp.ok) throw new Error(`Search failed: ${searchResp.status}`);
        const mcpResult = (await searchResp.json()) as { results?: unknown[] };
        const payload = {
          createdAt: Date.now(), k: args.k, min_sim: args.min_sim, queryPreview: dataUrl, results: mcpResult.results ?? [],
        };
        try { sessionStorage.setItem("mcp_last_search", JSON.stringify(payload)); } catch (err) { console.warn("sessionStorage set failed", err); }
        return payload;
      }
      const searchInstruction = `Search similar images: image_url=${imageUrl} k=${k} min_sim=${min_sim} order=recent require_audio=false`;
      const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: searchInstruction }]));
      console.log("[searchSimilar] chatRes:", chatRes);
      const rc = chatRes as RichChatResponse;
      const results = rc.analysis_responses ?? (rc as unknown as { results?: unknown[] }).results ?? rc.bot_messages ?? [];
      const payload = { createdAt: Date.now(), k: Number(k) || 1, min_sim: Number(min_sim), queryPreview: dataUrl, results: Array.isArray(results) ? results : [] };
      try { sessionStorage.setItem("mcp_last_search", JSON.stringify(payload)); } catch (err) { console.warn("sessionStorage set failed", err); }
      return payload;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        console.log("[searchSimilar] aborted");
      } else {
        console.error("[searchSimilar] error:", err);
        setError(errorMsg(err, "Search failed"));
      }
      return null;
    } finally {
      setStatus("idle");
      if (abortRef.current) abortRef.current = null;
    }
  }, [uploadedImageFile, fileToBase64, withAbort, createAbort, messages, errorMsg]);

  const send = useCallback(async (overrideText?: string, opts?: { forceApi?: boolean }) => {
    const raw = typeof overrideText === "string" ? overrideText : input;
    const text = raw.trim();
    const forceApi = Boolean(opts?.forceApi);

    if ((!text && !uploadedImageFile && !uploadedAudioFile) || status === "sending") return;

    // If we're in preset mode and user typed "yes" (but not forced API), escalate to API
    if (!forceApi && pendingPresetRef.current && text) {
      const yesRegex = /\b(yes|yeah|yep|ya|sure|ok|okay|more|tell me more|details|go ahead)\b/i;
      if (yesRegex.test(text)) {
        const original = pendingPresetRef.current;
        pendingPresetRef.current = null;
        setMorePrompt(null);
        setMessages(prev => [...prev, { role: "assistant", content: "Great — fetching more details…" }]);
        await send(original, { forceApi: true });
        return;
      }
    }

    // PRESET canned answer branch (no API)
    const presetAnswer = !forceApi ? PRESET_QA[norm(text)] : undefined;
    if (presetAnswer && !uploadedImageFile && !uploadedAudioFile) {
      setMessages(prev => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: presetAnswer },
      ]);
      pendingPresetRef.current = text;  // Remember which preset we answered
      setInput("");
      setMorePrompt(null);               // Hide previous quick replies
      lastFollowedUpRef.current = null;  // reset follow-up guard for this preset
      return;
    }

    // Regular API path
    createAbort();
    setStatus("sending");
    setError("");

    if (text) setMessages(prev => [...prev, { role: "user", content: text }]);
    if (!overrideText) setInput("");

    try {
      const searchIntentMatch = text.match(/^\s*search\s+similar\s+images\b/i);
      if (searchIntentMatch) {
        const kMatch = text.match(/k\s*[:=]?\s*(\d+)/i) || text.match(/\(\s*k\s*=\s*(\d+)\s*\)/i);
        const k = kMatch ? Math.max(1, Math.min(300, Number(kMatch[1]))) : 3;
        const payload = await searchSimilar(k);
        if (payload) {
          setMessages(prev => [...prev, { role: "assistant", content: "Thanks — preparing your search and redirecting to results now…" }]);
          setStatus("idle");
          if (abortRef.current) abortRef.current = null;
          window.setTimeout(() => { window.location.href = "/search"; }, 2000);
          return;
        } else {
          setStatus("idle");
          if (abortRef.current) abortRef.current = null;
          setMessages(prev => [...prev, { role: "assistant", content: "Search did not start (see console). Please try again." }]);
          return;
        }
      }

      if (uploadedImageFile || uploadedAudioFile) {
        const form = new FormData();
        if (uploadedImageFile) form.append("image", uploadedImageFile);
        if (uploadedAudioFile) form.append("audio", uploadedAudioFile);

        const filenameFromText = extractFilenameFromText(text);
        if (filenameFromText) {
          form.append("filename", filenameFromText);
          setFileName(filenameFromText);
        }

        try {
          const formDebug: Record<string, unknown> = {};
          for (const pair of (Array.from(form.entries()) as [string, FormDataEntryValue][])) {
            const k = pair[0];
            const v = pair[1];
            if (typeof v === "object" && "name" in v && typeof (v as File).name === "string") {
              const f = v as File;
              formDebug[k] = { filename: f.name, type: f.type || "unknown", size: typeof f.size === "number" ? f.size : "?" };
            } else {
              formDebug[k] = String(v);
            }
          }
          console.log("[DEBUG] Upload FormData prepared:", formDebug);
        } catch { }

        const upResp = await withAbort(fetch(`${FULL_API_URL}/uploads/tmp_media`, { method: "POST", body: form }));
        if (!upResp.ok) {
          const t = await upResp.text().catch(() => "");
          throw new Error(`Upload failed: ${upResp.status} ${t}`);
        }
        const upJson = (await upResp.json()) as Record<string, unknown>;
        const finalBasename =
          (filenameFromText && filenameFromText.trim().length > 0)
            ? filenameFromText.trim()
            : (upJson && (upJson.basename ?? upJson.filename) ? String(upJson.basename ?? upJson.filename) : null);

        const hasAudio = Boolean(upJson.audio_url) || Boolean(uploadedAudioFile);
        const imageUrl = upJson.image_url as string | undefined;
        const audioUrl = upJson.audio_url as string | undefined;

        if (hasAudio) {
          const toolArgs: Record<string, unknown> = { image_url: imageUrl, audio_url: audioUrl };
          if (finalBasename) toolArgs.filename = finalBasename;
          const mediaMsgParts: string[] = [];
          if (toolArgs.image_url) mediaMsgParts.push(`image_url=${toolArgs.image_url as string}`);
          if (toolArgs.audio_url) mediaMsgParts.push(`audio_url=${toolArgs.audio_url as string}`);
          if (toolArgs.filename) mediaMsgParts.push(`filename=${String(toolArgs.filename)}`);
          const mediaInstruction = `Analyze media: ${mediaMsgParts.join(" ")}`;

          const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: mediaInstruction }]));
          const rc = chatRes as RichChatResponse;
          handleResponse({
            reply: { role: "assistant", content: "Media uploaded and queued." },
            bot_messages: rc.bot_messages || [],
            action: rc.action,
            analysis_responses: rc.analysis_responses,
          } as ChatResponse);

          setMessages(prev => [...prev, { role: "assistant", content: "Thanks — your media has been uploaded. Redirecting you to the view page…" }]);
          scheduleNavigateToList();
        } else {
          const wantsAnalysis = /(?:\banalyz(?:e|ing|ed)\b|\banalyse\b|\binspect\b|\binspect(?:ion)?\b|\bscan\b)/i.test(text);
          if (wantsAnalysis && imageUrl) {
            const mode = getModeFromText(text);
            const analysisInstruction = `Analyze image: image_url=${imageUrl} mode=${mode}`;
            const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: analysisInstruction }]));
            const rc = chatRes as RichChatResponse;
            handleResponse({
              reply: { role: "assistant", content: `Image uploaded and ${mode} analysis started.` },
              bot_messages: rc.bot_messages || [],
              action: rc.action,
              analysis_responses: rc.analysis_responses,
            } as ChatResponse);
          } else {
            const toolArgs: Record<string, unknown> = { image_url: imageUrl, audio_url: null };
            if (finalBasename) toolArgs.filename = finalBasename;
            const mediaMsgParts: string[] = [];
            if (toolArgs.image_url) mediaMsgParts.push(`image_url=${toolArgs.image_url as string}`);
            if (toolArgs.filename) mediaMsgParts.push(`filename=${String(toolArgs.filename)}`);
            const mediaInstruction = `Analyze media: ${mediaMsgParts.join(" ")}`;

            const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: mediaMsgParts.length ? mediaInstruction : "Analyze media" }]));
            const rc = chatRes as RichChatResponse;
            handleResponse({
              reply: { role: "assistant", content: "Image uploaded and queued for processing." },
              bot_messages: rc.bot_messages || [],
              action: rc.action,
              analysis_responses: rc.analysis_responses,
            } as ChatResponse);
          }
        }

        clearImage();
        clearAudio();
        setStatus("idle");
        if (abortRef.current) {
          abortRef.current = null;
        }
        return;
      }

      const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: text }]));
      handleResponse(chatRes);
      setStatus("idle");
      if (abortRef.current) abortRef.current = null;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("idle"); setError("");
      } else {
        setStatus("error"); setError(errorMsg(e, "Something went wrong."));
      }
    } finally {
      if (abortRef.current) abortRef.current = null;
    }
  }, [
    input, messages, uploadedImageFile, uploadedAudioFile, status,
    handleResponse, clearImage, clearAudio, createAbort, withAbort,
    scheduleNavigateToList, getModeFromText, searchSimilar, errorMsg
  ]);
  const onAssistantRendered = useCallback((lastAssistant: Message) => {
  const q = pendingPresetRef.current;
  if (!q || morePrompt) return;

  const expectedAnswer = PRESET_QA[norm(q)];
  if (!expectedAnswer) return;

  const rendered = String(lastAssistant.content ?? "").trim();
  const expected = expectedAnswer.trim();

  if (rendered === expected && lastFollowedUpRef.current !== expected) {
    lastFollowedUpRef.current = expected; // guard
    setMessages(prev => [
      ...prev,
      { role: "assistant", content: "Would you like to know more about this?" }
    ]);
    setMorePrompt({ question: q });
  }
}, [morePrompt]);



  const confirmMoreYes = useCallback(async () => {
    const q = pendingPresetRef.current;
    setMorePrompt(null);
    if (!q) return;
    pendingPresetRef.current = null;
    lastFollowedUpRef.current = null;
    setMessages(prev => [...prev, { role: "assistant", content: "Great — fetching more details…" }]);
    await send(q, { forceApi: true });
  }, [send]);

  const confirmMoreNo = useCallback(() => {
    pendingPresetRef.current = null;
    lastFollowedUpRef.current = null;
    setMorePrompt(null);
    setMessages(prev => [...prev, { role: "assistant", content: "Okay! Ask me anything else or upload an image when ready." }]);
  }, []);

  const retryLast = useCallback(async () => {
    if (status === "sending" || messages.length === 0) return;
    createAbort();
    setStatus("sending");
    setError("");
    try {
      const res = await withAbort(chatOnce(messages));
      handleResponse(res);
      setStatus("idle");
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("idle"); setError("");
      } else {
        setStatus("error"); setError(errorMsg(e, "Something went wrong."));
      }
    } finally {
      if (abortRef.current) abortRef.current = null;
    }
  }, [messages, status, handleResponse, createAbort, withAbort, errorMsg]);

  const newChat = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { }
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
    setMorePrompt(null);
    pendingPresetRef.current = null;
    lastFollowedUpRef.current = null;
  }, [clearImage, clearAudio]);

  return {
    messages,
    input, setInput,
    status, error,
    send, retryLast, newChat,
    scrollerRef,
    uploadedPreviewUrl, uploadedAudioUrl, uploadedAudioFile,
    handleImageUpload, handleAudioUpload,
    clearImage, clearAudio,
    pendingAction, acceptAction, rejectAction,
    currentResponse,
    fileName, setFileName,
    shouldNavigateToList, setShouldNavigateToList,
    searchSimilar,
    morePrompt, confirmMoreYes, confirmMoreNo,
    onAssistantRendered, 
  };
}
