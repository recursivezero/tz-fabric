// src/components/Composer.tsx
import { useRef, useState, useEffect } from "react";
import type React from "react";
import SuggestionChips from "./SuggestionChips";
import "../styles/Composer.css";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
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
};

const MAX_SECONDS = 60;

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
}: Props) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // attach menu state
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachBtnRef = useRef<HTMLButtonElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && onUpload) onUpload(f);
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
        if (onClearAudio) onClearAudio();
        return;
      }

      if (onAudioUpload) onAudioUpload(f);
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
      onChange("Analyze this image (short analysis).");
      return;
    }
    if (actionId === "image:analyze_long") {
      onChange("Analyze this image (long analysis).");
      return;
    }
    if (actionId === "image:search_similar") {
      const DEFAULT_K = 3;
      onChange(`Search similar images (k=${DEFAULT_K}).`);
      return;
    }
    if (actionId === "submit:both") {
      onChange("Submit files");
      return;
    }
    if (actionId === "submit:both_with_names") {
      const trimmed = value ? value.trim() : "";
      if (!trimmed) {
        onChange("Please submit the attached image and audio with [name].");
      }
      return;
    }
  };

  const fmt = (s: number) => {
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
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
      // clear any existing timer to avoid duplicates
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

          if (onAudioUpload) onAudioUpload(file);
        } catch (ex) {
          console.error("onstop processing error", ex);
          setError("Failed to process recording.");
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => {
              t.stop();
            });
            streamRef.current = null;
          }
          // ensure timer is cleared and state is reset
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

      // record precise start time
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
        try {
          mediaRecorderRef.current.stop();
        } catch { }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
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
      ) {
        return;
      }
      setShowAttachMenu(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch { }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
        streamRef.current = null;
      }
    };
  }, []);

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
          <span style={{ color: "black", opacity: 0.85 }}>{fmt(seconds)} / {fmt(MAX_SECONDS)}</span>
        </div>
      )}

      {error && (
        <div role="alert" style={{ color: "salmon", marginTop: 8 }}>
          {error}
        </div>
      )}

      <div className="composer" style={{ paddingTop: isRecording ? 48 : undefined }}>
        {(previewUrl || audioUrl) && (
          <div className="upload-previews" role="region" aria-label="Upload previews">
            {previewUrl && (
              <div className="upload-preview image-preview">
                <img src={previewUrl} className="upload-thumb" alt="image preview" />
                <button
                  className="upload-remove"
                  onClick={onClearUpload}
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
                <button
                  className="upload-remove"
                  onClick={onClearAudio}
                  type="button"
                  aria-label="Remove audio"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}

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
                className={`composer-input`}
                placeholder="Ask about your fabric analysis..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={1}
                disabled={disabled}
              />

              {showAttachMenu && (
                <div
                  className="attach-menu"
                  ref={attachMenuRef}
                  role="menu"
                  aria-label="Attachment options"
                >
                  <button
                    className="attach-menu-item"
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    Upload image
                  </button>
                  <button
                    className="attach-menu-item"
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                  >
                    Upload audio
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

          <div className="composer-right">
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
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
                type="button"
                onClick={stopRecording}
                disabled={!isRecording}
                aria-pressed={!isRecording}
                title="Stop recording"
                className="record-btn stop-btn"
              >
                ⏹ Stop
              </button>

              <button
                className="send-btn"
                onClick={onSend}
                disabled={disabled || (!value.trim() && !previewUrl && !audioUrl)}
                title="Send"
                aria-label="Send message"
              >
                <svg className="send-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </div>

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
