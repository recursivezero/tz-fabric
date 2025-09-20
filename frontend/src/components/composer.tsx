import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onUpload?: (f: File) => void;
  onAudioUpload?: (f: File) => void;
  previewUrl?: string | null;      // image preview blob URL
  audioUrl?: string | null;        // audio preview blob URL
  onClearUpload?: () => void;
  onClearAudio?: () => void;
};

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
}: Props) {
  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && onUpload) onUpload(f);
    // reset input value so same file can be re-selected later if desired
    (e.target as HTMLInputElement).value = "";
  };

  const onAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && onAudioUpload) onAudioUpload(f);
    (e.target as HTMLInputElement).value = "";
  };

  return (
    <div className="composer">
      {/* PREVIEWS WRAPPER (image + audio) */}
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

      <textarea
        className="composer-input"
        placeholder="Ask about your fabric analysis..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={1}
      />
      <div className="composer-controls">
        <label className="file-upload-btn" title="Upload image">
          <input type="file" accept="image/*" onChange={onImageFile} />
          📷
        </label>

        <label className="file-upload-btn" title="Upload audio">
          <input type="file" accept="audio/*" onChange={onAudioFile} />
          🎤
        </label>

        <button
          className="send-btn"
          onClick={onSend}
          disabled={disabled || (!value.trim() && !previewUrl && !audioUrl)}
          title="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
