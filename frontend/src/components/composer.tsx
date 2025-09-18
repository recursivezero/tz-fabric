import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onUpload?: (f: File) => void;
  previewUrl?: string | null;
  onClearUpload?: () => void;
};

export default function Composer({ value, onChange, onSend, disabled, onUpload, previewUrl, onClearUpload }: Props) {
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && onUpload) onUpload(f);
  };

  return (
    <div className="composer">
      {previewUrl && (
        <div className="upload-preview">
          <img src={previewUrl} className="upload-thumb" alt="preview" />
          <button className="upload-remove" onClick={onClearUpload}>Remove</button>
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
        <label className="file-upload-btn">
          <input type="file" accept="image/*" onChange={onFile} />
          📷
        </label>
        <button className="send-btn" onClick={onSend} disabled={disabled || !value.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
