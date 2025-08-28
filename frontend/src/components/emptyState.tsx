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
    <div className="empty-state">
      <h2>Chatbot</h2>
      <p>Ask questions about fabrics or how to use this app.</p>
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
