// src/components/Composer.tsx
import type React from "react";
import { useEffect, useRef, useState } from "react";
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
  stopGenerating?: () => void;
  isFrontendTyping?: boolean;
};

const MAX_SECONDS = 60;

type Mode = "free" | "analysis" | "submitName" | "searchK";

const textForAnalysisShort = "Analyze this image (short analysis).";
const textForAnalysisLong = "Analyze this image (long analysis).";
const textForSubmitName = (nm: string) =>
  nm.trim() ? `Submit files — Name: ${nm}` : `Submit files — Name: [name]`;
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
  setFileName,
  stopGenerating,
  isFrontendTyping,
}: Props) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachBtnRef = useRef<HTMLButtonElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const [mode, setMode] = useState<Mode>("free");
  const [nameOnly, setNameOnly] = useState<string>("");

  const [imageMeta, setImageMeta] = useState<{ name: string; size: string } | null>(null);
  const [audioMeta, setAudioMeta] = useState<{ name: string; size: string; trimmed?: boolean } | null>(null);

  const FILE_NAME_MAX = 20;
  // A: new state
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);
  const [pendingAudio, setPendingAudio] = useState<{ file: File; url: string } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<null | { kind: "image" | "audio"; name?: string }>(null);

  // A: handlers for remove
  const requestRemoveImage = () => setPendingRemove({ kind: "image", name: imageMeta?.name });
  const requestRemoveAudio = () => setPendingRemove({ kind: "audio", name: audioMeta?.name });

  const confirmRemove = () => {
    if (!pendingRemove) return;
    if (pendingRemove.kind === "image") {
      onClearUpload?.();
      setImageMeta(null);
      setMode("free");
    } else {
      onClearAudio?.();
      setAudioMeta(null);
      setInfo(null);
      setError(null);
      setMode("analysis");
    }
    setPendingRemove(null);
  };

  const cancelRemove = () => setPendingRemove(null);


  const encodeWAV = (audioBuffer: AudioBuffer) => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numChannels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);

    let offset = 0;

    const writeString = (s: string) => {
      for (let i = 0; i < s.length; i++) {
        view.setUint8(offset + i, s.charCodeAt(i));
      }
      offset += s.length;
    };

    const floatTo16BitPCM = (output: DataView, offsetOut: number, input: Float32Array) => {
      for (let i = 0; i < input.length; i++, offsetOut += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7fff;
        output.setInt16(offsetOut, s, true);
      }
    };

    writeString("RIFF");
    view.setUint32(offset, 36 + audioBuffer.length * numChannels * 2, true);
    offset += 4;
    writeString("WAVE");
    writeString("fmt ");
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, numChannels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, sampleRate * numChannels * 2, true);
    offset += 4;
    view.setUint16(offset, numChannels * 2, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeString("data");
    view.setUint32(offset, audioBuffer.length * numChannels * 2, true);
    offset += 4;

    const interleaved = new Float32Array(audioBuffer.length * numChannels);
    for (let ch = 0; ch < numChannels; ch++) {
      audioBuffer.copyFromChannel(interleaved.subarray(ch, interleaved.length), ch, 0); // not correct to subarray like this
    }
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channelData.push(new Float32Array(audioBuffer.getChannelData(ch)));
    }
    let interleavedIdx = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        interleaved[interleavedIdx++] = channelData[ch][i];
      }
    }

    floatTo16BitPCM(view, offset, interleaved);

    return new Blob([view], { type: "audio/wav" });
  };

  const trimAudioFile = async (file: File): Promise<File> => {
    const arrayBuffer = await file.arrayBuffer();
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
      const decoded = await ac.decodeAudioData(arrayBuffer.slice(0));
      const duration = decoded.duration;
      if (duration <= MAX_SECONDS) {
        ac.close().catch(() => { });
        return file;
      }
      const sampleRate = decoded.sampleRate;
      const targetLength = Math.floor(MAX_SECONDS * sampleRate);
      const trimmedBuffer = ac.createBuffer(decoded.numberOfChannels, targetLength, sampleRate);

      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const channelData = decoded.getChannelData(ch).subarray(0, targetLength);
        trimmedBuffer.copyToChannel(channelData, ch, 0);
      }

      const wavBlob = encodeWAV(trimmedBuffer);
      const base = file.name.replace(/\.\w+$/, "");
      const newName = `${base} (trimto1min).wav`;
      const trimmedFile = new File([wavBlob], newName, { type: "audio/wav" });
      ac.close().catch(() => { });
      return trimmedFile;
    } catch (err) {
      try { ac.close().catch(() => { }); } catch { }
      throw err;
    }
  };

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    (e.target as HTMLInputElement).value = "";
    setShowAttachMenu(false);
    if (!f) return;

    const url = URL.createObjectURL(f);
    setPendingImage({ file: f, url });
  };

  // --- CHANGED: onAudioFile now sets pendingAudio and shows confirmation modal ---
  const onAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    (e.target as HTMLInputElement).value = "";
    setShowAttachMenu(false);
    setError(null);
    setInfo(null);
    if (!f) return;

    const url = URL.createObjectURL(f);
    setPendingAudio({ file: f, url });
  };

  // --- NEW: confirm handlers for pending image/audio ---
  const confirmImageUpload = () => {
    if (!pendingImage) return;
    const { file, url } = pendingImage;
    // call original onUpload callback
    onUpload?.(file);
    setImageMeta({ name: file.name, size: formatSize(file.size) });
    // parent probably sets previewUrl; we still revoke local URL to avoid leak
    try { URL.revokeObjectURL(url); } catch { }
    setPendingImage(null);
  };

  const cancelImageUpload = () => {
    if (pendingImage) {
      try { URL.revokeObjectURL(pendingImage.url); } catch { }
    }
    setPendingImage(null);
  };

  // For audio confirm we must preserve trimming logic (copy of your existing behavior)
  const confirmAudioUpload = async () => {
    if (!pendingAudio) return;
    const { file, url } = pendingAudio;

    // we emulate the same behavior you had: check duration and possibly trim
    const audioEl = document.createElement("audio");
    audioEl.src = url;

    audioEl.onloadedmetadata = async () => {
      try {
        const duration = audioEl.duration;
        try { URL.revokeObjectURL(url); } catch { }
        if (duration > MAX_SECONDS + 0.1) {
          // attempt to trim
          try {
            const trimmedFile = await trimAudioFile(file);
            onAudioUpload?.(trimmedFile);
            const base = file.name.replace(/\.\w+$/, "");
            setAudioMeta({
              name: `${base}.wav`,
              size: formatSize(trimmedFile.size),
              trimmed: true,
            });
          } catch (err) {
            console.error("trimAudioFile error", err);
            setError("Audio is too long and could not be trimmed. Try a shorter clip.");
            onClearAudio?.();
          }
        } else {
          onAudioUpload?.(file);
          setAudioMeta({ name: file.name, size: formatSize(file.size), trimmed: false });
          setError(null);
        }
      } catch (err) {
        console.error("confirmAudioUpload error", err);
        setError("Failed to upload audio.");
      } finally {
        setPendingAudio(null);
      }
    };

    audioEl.onerror = () => {
      try { URL.revokeObjectURL(url); } catch { }
      setError("Could not read audio file. Try again with a supported format.");
      setPendingAudio(null);
    };
  };

  const cancelAudioUpload = () => {
    if (pendingAudio) {
      try { URL.revokeObjectURL(pendingAudio.url); } catch { }
    }
    setPendingAudio(null);
  };

  // NOTE: keep the rest of your logic unchanged (recording functions etc.)
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
      onSend("Search similar images");
      setMode("free");
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
    setInfo(null);
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
        try { mediaRecorderRef.current.stop(); } catch { }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      startTimeRef.current = null;
      // revoke any pending object URLs on unmount
      if (pendingImage) try { URL.revokeObjectURL(pendingImage.url); } catch { }
      if (pendingAudio) try { URL.revokeObjectURL(pendingAudio.url); } catch { }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {info && (
        <div role="status" style={{ color: "seagreen", marginTop: 8 }}>
          {info}
        </div>
      )}

      {/* --- NEW: Confirmation modal for image upload --- */}
      {pendingImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm image upload"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1300,
            background: "rgba(0,0,0,0.4)",
            padding: 16,
          }}
        >
          <div style={{ background: "white", padding: 16, borderRadius: 8, maxWidth: 520, width: "100%" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: "0 0 120px" }}>
                <img src={pendingImage.url} alt="Confirm preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 6 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Upload this image?</div>
                <div style={{ color: "rgba(0,0,0,0.7)" }}>{pendingImage.file.name} — {formatSize(pendingImage.file.size)}</div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button onClick={confirmImageUpload} type="button" style={{ padding: "8px 12px", background: "#0f172a", color: "#fff", borderRadius: 6 }}>
                    Confirm
                  </button>
                  <button onClick={cancelImageUpload} type="button" style={{ padding: "8px 12px", background: "#fff", color: "#111827", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {pendingAudio && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm audio upload"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1300,
            background: "rgba(0,0,0,0.4)",
            padding: 16,
          }}
        >
          <div style={{ background: "white", padding: 16, borderRadius: 8, maxWidth: 520, width: "100%" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: "0 0 120px" }}>
                <audio controls src={pendingAudio.url} style={{ width: 120 }} controlsList="nodownload" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Upload this audio?</div>
                <div style={{ color: "rgba(0,0,0,0.7)" }}>{pendingAudio.file.name} — {formatSize(pendingAudio.file.size)}</div>
                <div style={{ marginTop: 8, fontSize: 13, color: "rgba(0,0,0,0.6)" }}>
                  If longer than 1 minute we will trim it automatically.
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button onClick={confirmAudioUpload} type="button" style={{ padding: "8px 12px", background: "#0f172a", color: "#fff", borderRadius: 6 }}>
                    Confirm
                  </button>
                  <button onClick={cancelAudioUpload} type="button" style={{ padding: "8px 12px", background: "#fff", color: "#111827", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
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
                  onClick={requestRemoveImage}
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
                    {audioMeta.trimmed ? " — trimmed to 1min" : ""}
                  </div>
                )}
                <button
                  className="upload-remove"
                  onClick={requestRemoveAudio}
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3 3 0 014.24 4.24l-9.2 9.19a1 1 0 01-1.41-1.41l8.48-8.48" />
                </svg>

              </button>

              <textarea
                className="composer-input"
                placeholder="Ask about your fabric..."
                value={value}
                onChange={(e) => {
                  if (mode === "free") onChange(e.target.value);
                  else e.preventDefault();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend(value);
                  }
                }}
                style={{ color: "black" }}
                rows={1}
                readOnly={mode !== "free"}
              />
              {(status === "sending" || isFrontendTyping) && (
                <div className="stop-overlay" role="status" aria-live="polite">
                  <div className="stop-overlay-inner" onMouseDown={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="stop-overlay-btn"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof stopGenerating === "function") stopGenerating();
                        else console.warn("stopGenerating not provided");
                      }}
                    >
                      ⏹ Stop Generating
                    </button>
                  </div>
                </div>
              )}

              <button
                className="send-btn inside"
                onClick={() => onSend(value)}
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

        {!audioUrl && (
          <div className="composer-audio-row">
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

            <span className="audio-label">Record your audio</span>

          </div>
        )}

        {mode === "analysis" && (
          <div className="locked-controls" style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }} />
        )}

        {mode === "submitName" && (
          <div
            className="locked-controls"
            style={{
              marginTop: 6,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ fontSize: 16, color: "black" }}>Type File name:</label>
            <input
              type="text"
              value={nameOnly}
              onChange={(e) => {
                const v = e.target.value.slice(0, FILE_NAME_MAX);
                setNameOnly(v);
              }}
              placeholder="NeonFabric"
              maxLength={FILE_NAME_MAX}
              style={{
                padding: "8px 8px",
                borderRadius: 6,
                border: "1px solid #000000ff",
                minWidth: 200,
              }}
              aria-label={`File name (max ${FILE_NAME_MAX} chars)`}
            />
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.6)", marginLeft: 6 }}>
              {nameOnly.length}/{FILE_NAME_MAX}
            </div>
            <button
              type="button"
              onClick={() => {
                const nm = nameOnly.trim().slice(0, FILE_NAME_MAX);
                setFileName?.(nm);
                onSend(textForSubmitName(nm));
                setMode("free");
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #0f172a",
                background: "#0f172a",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
              aria-label="Confirm name"
              title="Confirm name"
              disabled={nameOnly.trim().length === 0}
            >
              OK
            </button>

            <button
              type="button"
              onClick={() => setMode("free")}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#111827",
                cursor: "pointer",
              }}
              aria-label="Cancel"
              title="Cancel"
            >
              Cancel
            </button>
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
        {pendingRemove && (
          <div role="dialog" aria-modal="true" aria-label={`Confirm remove ${pendingRemove.kind}`} style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300, background: "rgba(0,0,0,0.4)", padding: 16 }}>
            <div style={{ background: "white", padding: 16, borderRadius: 8, maxWidth: 520, width: "100%" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: "0 0 84px" }}>
                  <div style={{ width: 84, height: 84, background: "#f3f4f6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
                    {pendingRemove.kind === "image" ? "Image" : "Audio"}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{pendingRemove.kind === "image" ? "Remove this image?" : "Remove this audio?"}</div>
                  {pendingRemove.name && <div style={{ color: "rgba(0,0,0,0.7)" }}>{pendingRemove.name}</div>}
                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <button onClick={confirmRemove} type="button" style={{ padding: "8px 12px", background: "#0f172a", color: "#fff", borderRadius: 6 }}>Confirm</button>
                    <button onClick={cancelRemove} type="button" style={{ padding: "8px 12px", background: "#fff", color: "#111827", borderRadius: 6, border: "1px solid #e5e7eb" }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
