import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import Notification from "../components/Notification";
import { useUploadAndRecord } from "../hooks/useUploadAndRecord";
import "../styles/UploadPage.css";
import { generateFabricName } from "../utils/fabric-name";

type AudioMode = "upload" | "record";



;
const UploadPage = () => {
  const location = useLocation();
  const prefill = location.state?.prefill;
  const {
    imageUrl,
    audioUrl,
    isRecording,
    recordTime,
    loading,
    notification,
    audioNotification,
    setImageUrl,
    setAudioUrl,
    handleImageUpload,
    handleAudioUpload,
    startRecording,
    stopRecording,
    handleSubmit,
    handleBack,
    clearImage,
  } = useUploadAndRecord();

  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");

    return () => {
      wrapper?.classList.remove("upload-bg");
    };
  }, []);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [audioMode, setAudioMode] = useState<AudioMode>("record");
  const [name, setName] = useState<string>(() => generateFabricName());
  const [showConfirm, setShowConfirm] = useState(false);
  const [showConfirmAudio, setShowConfirmAudio] = useState(false);

  const canSubmit = !!imageUrl && !!audioUrl && !loading;
  const showUploadAudio = audioMode === "upload" && !audioUrl;

  const recordPct = useMemo(() => {
    const pct = Math.min(100, Math.round((recordTime / 60) * 100));
    return Number.isFinite(pct) ? pct : 0;
  }, [recordTime]);

  useEffect(() => {
    if (prefill?.imageUrl) setImageUrl(prefill.imageUrl);
    if (prefill?.audioUrl) setAudioUrl(prefill.audioUrl);

    if (prefill?.audioUrl) setAudioMode("record");
  }, [prefill, setImageUrl, setAudioUrl]);

  const onDropImage = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  };

  const onDropAudio = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleAudioUpload(file);
  };

  const handleClearClick = () => {
    // open modal
    setShowConfirm(true);
  };

  const confirmClear = () => {
    setShowConfirm(false);
    if (typeof clearImage === "function") clearImage();
  };

  const cancelClear = () => {
    setShowConfirm(false);
  };

  const handleClearAudio = () => {
    setShowConfirmAudio(true);
  };

  const confirmClearAudio = () => {
    setShowConfirmAudio(false);
    // handleBack currently removes/discards audio; call it to remove
    if (typeof handleBack === "function") handleBack();
  };

  const cancelClearAudio = () => {
    setShowConfirmAudio(false);
  };

  const navigate = useNavigate();
  console.log("notification :", notification)

  return (
    <div className="upload-page">
      <div className="upload-card">
        <header className="upload-header">
          <h2>Upload Image & Audio</h2>
          <p className="sub">Upload audio or switch to recording (max 60s)</p>
        </header>

        <div className="grid">
          <section className="preview-col">
            {imageUrl ? (
              <div className="image-preview-wrap">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="image-preview-plain"
                />
                <button
                  className="chip chip-clear img-clear-btn"
                  onClick={handleClearClick}
                  title="Remove image"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropImage}
                onClick={() => imageInputRef.current?.click()}
                role="button"
                aria-label="Upload image"
              >
                <div className="dz-icon">🖼️</div>
                <div className="dz-text">
                  <strong>Drop image</strong> or{" "}
                  <span className="link">browse</span>
                </div>
              </div>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
          </section>

          <section className="action-col">
            {audioMode === "record" && !audioUrl && (
              <>
                <div className="rec-controls">
                  <button
                    className="btn primary"
                    onClick={startRecording}
                    disabled={isRecording}
                  >
                    🎙 Start Recording
                  </button>
                  <button
                    className="btn"
                    onClick={stopRecording}
                    disabled={!isRecording}
                  >
                    Stop
                  </button>
                </div>
                <span className="alt-text">
                  OR
                </span>
                <div className="alt-switch">
                  <button
                    className="link-btn"
                    onClick={() => setAudioMode("upload")}
                    disabled={isRecording}
                  >
                    ← Upload
                  </button>
                </div>

                <div className="recording-area">
                  {isRecording ? (
                    <div className="record-chip" aria-live="polite">
                      <span className="dot" />
                      Recording… {String(recordTime).padStart(2, "0")}/60s
                      <div className="progress">
                        <div
                          className="bar"
                          style={{ width: `${recordPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="hint">
                      Press Start to begin. Stop to see a preview.
                    </div>
                  )}
                </div>
                {audioNotification && (
                  <Notification
                    message={audioNotification.message}
                    type={audioNotification.type}
                  />
                )}
              </>
            )}

            {showUploadAudio && (
              <>
                {audioUrl ? (
                  <div className="audio-card">
                    <div className="lock-note">
                      Start/Stop disabled while preview exists. Clear to re-record
                      or Submit.
                    </div>
                    <div className="audio-clear">
                      <div className="audio-player">
                        <audio controls src={audioUrl} />
                      </div>

                      <div className="img-footer">
                        <button className="chip chip-clear" onClick={() => setShowConfirmAudio(true)} title="Remove audio">✕ Clear Audio</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDropAudio}
                    onClick={() => audioInputRef.current?.click()}
                    role="button"
                    aria-label="Upload audio"
                  >
                    <div className="dz-icon">🎧</div>
                    <div className="dz-text">
                      <strong>Drop audio of max 1 min</strong> or{" "}
                      <span className="link">browse</span>
                    </div>
                    {audioNotification && (
                      <Notification
                        message={audioNotification.message}
                        type={audioNotification.type}
                      />
                    )}
                  </div>
                )}

                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAudioUpload(file);
                  }}
                />

                <div className="alt-switch">
                  <button
                    className="link-btn"
                    onClick={() => {
                      if (audioInputRef.current)
                        audioInputRef.current.value = "";
                      setAudioMode("record");
                    }}
                  >
                    or Record instead →
                  </button>
                </div>
              </>
            )}

            {audioUrl && (
              <div className="audio-card">
                <div className="lock-note">
                  Start/Stop disabled while preview exists. Clear to re-record
                  or Submit.
                </div>
                <div className="audio-clear">
                  <div className="audio-player">
                    <audio controls src={audioUrl} />
                  </div>

                  <div className="img-footer">
                    <button className="chip chip-clear" onClick={() => setShowConfirmAudio(true)} title="Remove audio">✕ Clear Audio</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      <div className="name-field">
        <div>
          <label className="name-label">File Name(optional)</label>
        </div>
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Optional name for saving files"
          />
        </div>
        <div className="submit-wrapper">
          <button
            className="btn submit"
            onClick={async () => {
              await handleSubmit(name);
              handleBack();
            }}
            disabled={!canSubmit}
          >
            {loading ? "Submitting…" : "Submit"}
          </button>
        </div>
        <div>
          <button className="cancel" onClick={() => navigate("/")}>cancel</button>
        </div>
      </div>
      {loading && <Loader />}

      {notification && (
        <Notification message={notification.message} type={notification.type} />
      )}

      {showConfirm && (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-modal">
            <div className="confirm-title">Remove Image!</div>
            <div className="confirm-body">Are you sure you want to remove this image?</div>
            <div className="confirm-actions">
              <button className="btn btn-cancel" onClick={cancelClear}>Cancel</button>
              <button className="btn btn-confirm" onClick={confirmClear}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmAudio && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Remove audio confirmation">
          <div className="confirm-modal">
            <div className="confirm-title">Remove <A></A>udio!</div>
            <div className="confirm-body">Are you sure you want to remove this audio?</div>
            <div className="confirm-actions">
              <button className="btn btn-cancel" onClick={cancelClearAudio}>Cancel</button>
              <button className="btn btn-confirm" onClick={confirmClearAudio}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UploadPage;
