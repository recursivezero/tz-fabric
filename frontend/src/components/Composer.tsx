// src/components/Composer.tsx
import type React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import "../styles/Composer.css";
import Loader from "./Loader";
import SuggestionChips from "./SuggestionChips";
import { formatFileName } from "../utils/formatFilename";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: (overrideText?: string) => void;
  disabled?: boolean;
  onUpload?: (f: File) => void;
  onAudioUpload?: (f: File) => void;
  previewUrl?: string | null;
  audioUrl?: string | null;
  onClearUpload?: () => void;
  onClearAudio?: () => void;
  onChipAction?: (actionId: string, opts?: { name?: string }) => void;
  fileName?: string;
  setFileName?: (name: string) => void;
  status?: string;
};

const MAX_SECONDS = 60;

type Mode = "free" | "analysis" | "submitName" | "searchK";

const textForAnalysisShort = "Analyze this image (short analysis).";
const textForAnalysisLong = "Analyze this image (long analysis).";
const textForSubmitName = (nm: string) =>
  nm.trim() ? `Submit files — Name: ${nm}` : `Submit files — Name: [name]`;
const textForSearchK = (k: number) =>
  `Search similar images (k=${Math.max(1, Math.floor(k || 1))}).`;

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
  onUpload,
  onAudioUpload,
  previewUrl,
  audioUrl,
  onClearUpload,
  onClearAudio,
  onChipAction,
  status,
}: Props) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachBtnRef = useRef<HTMLButtonElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const [mode, setMode] = useState<Mode>("free");
  const [nameOnly, setNameOnly] = useState<string>("");
  const [kOnly, setKOnly] = useState<number>(3);

  const [imageMeta, setImageMeta] = useState<{ name: string; size: string } | null>(null);
  const [audioMeta, setAudioMeta] = useState<{ name: string; size: string } | null>(null);

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && onUpload) {
      onUpload(f);
      setImageMeta({ name: f.name, size: formatSize(f.size) });
    }
    (e.target as HTMLInputElement).value = "";
    setShowAttachMenu(false);
  };

  const onAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    (e.target as HTMLInputElement).value = "";

    const url = URL.createObjectURL(f);
    const audio = document.createElement("audio");
    audio.src = url;

    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      URL.revokeObjectURL(url);

      if (duration > MAX_SECONDS) {
        setError("Audio file too long. Please upload a clip of 1 minute or less.");
        onClearAudio?.();
        return;
      }

      onAudioUpload?.(f);
      setAudioMeta({ name: f.name, size: formatSize(f.size) });
      setError(null);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read audio file. Try again with a supported format.");
    };

    setShowAttachMenu(false);
  };

  const handleChipActionDefault = (actionId: string, _opts?: { name?: string }) => {
    if (actionId === "image:analyze_short") {
      setMode("analysis");
      onChange(textForAnalysisShort);
      onSend(textForAnalysisShort);
      return;
    }
    if (actionId === "image:analyze_long") {
      setMode("analysis");
      onChange(textForAnalysisLong);
      onSend(textForAnalysisLong);
      return;
    }
    if (actionId === "image:search_similar") {
      setMode("searchK");
      onChange("Search similar images — choose a number: <10 or >10.");
      return;
    }
    if (actionId === "submit:both") {
      onChange("Submit files");
      onSend("Submitted files");
      return;
    }
    if (actionId === "submit:both_with_names") {
      setMode("submitName");
      setNameOnly("");
      onChange(textForSubmitName(""));
      return;
    }
  };

  const fmt = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const errorMessage = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : (typeof e === "string" ? e : fallback);

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Microphone not supported in this browser.");
      return;
    }
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];

      mr.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const mime = blob.type || "audio/webm";
          let ext = "webm";
          if (mime.includes("ogg")) ext = "ogg";
          else if (mime.includes("wav")) ext = "wav";
          else if (mime.includes("mpeg") || mime.includes("mp3")) ext = "mp3";
          const filename = `recording-${timestamp}.${ext}`;
          const file = new File([blob], filename, { type: mime });

          onAudioUpload?.(file);
          setAudioMeta({ name: file.name, size: formatSize(file.size) });
        } catch (ex) {
          console.error("onstop processing error", ex);
          setError("Failed to process recording.");
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          startTimeRef.current = null;
          setIsRecording(false);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setSeconds(0);

      startTimeRef.current = performance.now();

      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current == null) return;
        const elapsedMs = performance.now() - startTimeRef.current;
        const sec = Math.floor(elapsedMs / 1000);
        setSeconds(sec);
        if (sec >= MAX_SECONDS) {
          stopRecording();
        }
      }, 250);
    } catch (err: unknown) {
      console.error("startRecording err", err);
      setError(errorMessage(err, "Could not access microphone."));
    }
  };

  const stopRecording = () => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
    } catch (err) {
      console.error("stopRecording err", err);
      setError("Failed to stop recording.");
    } finally {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      startTimeRef.current = null;
      mediaRecorderRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      startTimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!attachMenuRef.current || !attachBtnRef.current) return;
      if (
        attachMenuRef.current.contains(ev.target as Node) ||
        attachBtnRef.current.contains(ev.target as Node)
      ) return;
      setShowAttachMenu(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const NAME_MAX = 26;

  return (
    <>
      {isRecording && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1200,
            background: "#fff5f5",
            border: "1px solid #ffcccc",
            padding: "8px 12px",
            borderRadius: 10,
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 14,
          }}
        >
          <span style={{ fontWeight: 600, color: "#c72525" }}>● Recording</span>
          <span style={{ color: "black", opacity: 0.85 }}>
            {fmt(seconds)} / {fmt(MAX_SECONDS)}
          </span>
        </div>
      )}

      {error && (
        <div role="alert" style={{ color: "salmon", marginTop: 8 }}>
          {error}
        </div>
      )}

      <div className="composer" style={{ paddingTop: isRecording ? 48 : undefined }}>
        {status === "validating" && !previewUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader />
          </div>
        )}

        {(previewUrl || audioUrl) && (
          <div className="upload-previews" role="region" aria-label="Upload previews">
            {previewUrl && (
              <div className="upload-preview image-preview">
                <img src={previewUrl} className="upload-thumb" alt="image preview" />
                {imageMeta && (
                  <div style={{ color: "black", fontSize: 18, marginTop: 4 }} title={imageMeta.name}>
                    {formatFileName(imageMeta.name, NAME_MAX)} ({imageMeta.size})
                  </div>
                )}
                <button
                  className="upload-remove"
                  onClick={() => {
                    onClearUpload?.();
                    setImageMeta(null);
                  }}
                  type="button"
                  aria-label="Remove image"
                >
                  Remove
                </button>
              </div>
            )}

            {audioUrl && (
              <div className="upload-preview audio-preview">
                <audio controls src={audioUrl} />
                {audioMeta && (
                  <div style={{ color: "black", fontSize: 18, marginTop: 4 }} title={audioMeta.name}>
                    {formatFileName(audioMeta.name, NAME_MAX)} ({audioMeta.size})
                  </div>
                )}
                <button
                  className="upload-remove"
                  onClick={() => {
                    onClearAudio?.();
                    setAudioMeta(null);
                  }}
                  type="button"
                  aria-label="Remove audio"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}

        {/* Line 1: [+] textarea [▶] */}
        <div className="composer-row">
          <div className="composer-middle">
            <div className="composer-input-wrapper">
              <button
                ref={attachBtnRef}
                type="button"
                className="attach-btn inside"
                aria-haspopup="menu"
                aria-expanded={showAttachMenu}
                onClick={() => setShowAttachMenu((s) => !s)}
                title="Attachments"
                disabled={disabled}
              >
                +
              </button>

              <textarea
                className="composer-input"
                placeholder="Ask about your fabric analysis..."
                value={value}
                onChange={(e) => {
                  if (mode === "free") onChange(e.target.value);
                  else e.preventDefault();
                }}
                style={{ color: "black" }}
                rows={1}
                disabled={disabled}
                readOnly={mode !== "free"}
              />

              {/* ▶ Send (inside input, right) */}
              <button
                className="send-btn inside"
                onClick={() => onSend()}
                disabled={disabled || (!value.trim() && !previewUrl && !audioUrl)}
                title="Send"
                aria-label="Send message"
              >
                <svg className="send-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor" />
                </svg>
              </button>

              {showAttachMenu && (
                <div className="attach-menu" ref={attachMenuRef} role="menu" aria-label="Attachment options">
                  <button
                    className="attach-menu-item"
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    🖼️ Upload image
                  </button>
                  <button
                    className="attach-menu-item"
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                  >
                    🎙️ Upload audio
                  </button>
                </div>
              )}

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={onImageFile}
                style={{ display: "none" }}
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={onAudioFile}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </div>

        {/* Line 2: label + Start/Stop (new row) */}
        <div className="composer-audio-row">
          <span className="audio-label">record your audio</span>

          <button
            style={{ color: "black" }}
            type="button"
            onClick={startRecording}
            disabled={isRecording}
            aria-pressed={isRecording}
            title="Start recording (max 1 minute)"
            className="record-btn start-btn"
          >
            ⏺ Start
          </button>

          <button
            style={{ color: "black" }}
            type="button"
            onClick={stopRecording}
            disabled={!isRecording}
            aria-pressed={!isRecording}
            title="Stop recording"
            className="record-btn stop-btn"
          >
            ⏹ Stop
          </button>
        </div>

        {mode === "analysis" && (
          <div className="locked-controls" style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }} />
        )}

        {mode === "submitName" && (
          <div className="locked-controls" style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 18, color: "black" }}>Name:</label>
            <input
              type="text"
              value={nameOnly}
              onChange={(e) => {
                const nm = e.target.value;
                setNameOnly(nm);
                onChange(textForSubmitName(nm));
                setMode("free");
              }}
              placeholder="Your name"
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #000000ff" }}
            />
          </div>
        )}

        {mode === "searchK" && (
          <div className="locked-controls" style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 16, color: "black" }}>Choose a number:</span>

            <button
              type="button"
              className="attach-menu-item"
              onClick={() => {
                const k = randInt(1, 10);
                setKOnly(k);
                const cmd = textForSearchK(k);
                onSend(cmd);
                onChange("");
                onClearUpload?.();
                onClearAudio?.();
                setMode("free");
              }}
              disabled={disabled}
              aria-label="Pick k less than 10"
              title="Pick k in 1–10"
            >
              &lt; 10
            </button>

            <button
              type="button"
              className="attach-menu-item"
              onClick={() => {
                const k = randInt(11, 100);
                setKOnly(k);
                onChange(textForSearchK(k));
              }}
              disabled={disabled}
              aria-label="Pick k greater than 10"
              title="Pick k in 11–100"
            >
              &gt; 10
            </button>
            <span aria-live="polite" style={{ marginLeft: 6, opacity: 0.8 }}>
              {Number.isFinite(kOnly) ? `Selected k: ${kOnly}` : ""}
            </span>
          </div>
        )}

        <SuggestionChips
          hasImage={!!previewUrl}
          hasAudio={!!audioUrl}
          resetKey={`${previewUrl ?? ""}|${audioUrl ?? ""}`}
          hint={
            previewUrl && !audioUrl
              ? "Image uploaded — choose an analysis:"
              : previewUrl && audioUrl
              ? "Image + audio uploaded — quick submission options:"
              : undefined
          }
          name={value ? value.trim() : null}
          onAction={(actionId, opts) => {
            if (typeof onChipAction === "function") {
              onChipAction(actionId, opts);
              return;
            }
            handleChipActionDefault(actionId, opts);
          }}
        />
      </div>
    </>
  );
}
