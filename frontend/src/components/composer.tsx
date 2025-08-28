import React from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export default function Composer({ value, onChange, onSend, disabled }: Props) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="composer">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask me anything about fabrics or the app…"
        rows={1}
      />
      <button onClick={onSend} disabled={disabled || !value.trim()}>
        Send
      </button>
    </div>
  );
}
