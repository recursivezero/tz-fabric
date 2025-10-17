// src/components/EmptyState.tsx
import "../styles/EmptyState.css";

const samples = [
  "Explain knit vs woven (simple).",
  "How do I use the image analysis feature?",
  "Suggest tags for a denim fabric photo.",
  "What is GSM in fabrics?",
];

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export default function EmptyState({ onSend, disabled }: Props) {
  const handleClick = (text: string) => {
    if (disabled) return;
    onSend(text);
  };

  return (
    <div className="empty-state-large">
      <h3>Ask questions about fabrics</h3>
      <p>Try one of the sample prompts below to get started.</p>
      <div className="chips" role="list">
        {samples.map((s, i) => (
          <button
            key={i}
            className="chip"
            onClick={() => handleClick(s)}
            role="listitem"
            aria-label={`Use sample prompt: ${s}`}
            disabled={disabled}
            style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
