const samples = [
  "Explain knit vs woven (simple).",
  "How do I use the image analysis feature?",
  "Suggest tags for a denim fabric photo.",
  "What is GSM in fabrics?",
];

interface Props {
  onPick: (text: string) => void;
}

export default function EmptyState({ onPick }: Props) {
  return (
    <div className="empty-state-large">
      <h3>Ask questions about fabrics</h3>
      <p>Try one of the sample prompts below to get started.</p>
      <div className="chips">
        {samples.map((s, i) => (
          <button key={i} className="chip" onClick={() => onPick(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
