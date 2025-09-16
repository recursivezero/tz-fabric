import React, { useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onUpload?: (file: File) => void;
  previewUrl?: string | null;
  onClearUpload?: () => void;
}

export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
  onUpload,
  previewUrl,
  onClearUpload,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  };

  const canSend = !!value.trim() || !!previewUrl;

  return (
    <div className="composer">
      {previewUrl && (
        <div className="upload-preview">
          <img src={previewUrl} alt="preview" className="upload-thumb" />
          <button
            type="button"
            className="upload-remove"
            onClick={onClearUpload}
            title="Remove image"
          >
            ×
          </button>
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask me anything about fabrics or the app…"
        rows={1}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="btn-secondary"
        title="Attach image"
      >
        📎
      </button>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <button onClick={onSend} disabled={disabled || !canSend}>
        ASK
      </button>
    </div>
  );
}
