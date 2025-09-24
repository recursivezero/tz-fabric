// src/components/SuggestionChips.tsx
import  { useEffect, useMemo, useState } from "react";
import "../styles/SuggestionChips.css";

type Props = {
  hasImage: boolean;
  hasAudio: boolean;
 
  onAction: (actionId: string, opts?: { name?: string }) => void;
  resetKey?: string | number | null;
  hint?: string;
  name?: string | null;
};

export default function SuggestionChips({
  hasImage,
  hasAudio,
  onAction,
  resetKey = null,
  hint,
  name = null,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  // Reset selection when inputs change
  useEffect(() => {
    setSelected(null);
  }, [resetKey, hasImage, hasAudio]);

  const chips = useMemo(() => {
    if (hasImage && !hasAudio) {
      return [
        { id: "image:analyze_short", label: "Short analysis of this image", primary: true },
        { id: "image:analyze_long", label: "Long analysis of this image" },
      ];
    }

    if (hasImage && hasAudio) {
      return [
        { id: "submit:both", label: "Submit files", primary: true },
        {
          id: "submit:both_with_names",
          label: name ? `Submit the files with a name of ${name}` : "Submit the files with a name",
        },
      ];
    }

    // audio only -> no chips
    return [];
  }, [hasImage, hasAudio, name]);

  if (!chips.length) return null;

  const onClick = (id: string) => {
    if (selected) return;
    setSelected(id);

    if (id === "submit:both_with_names") {
      onAction(id, { name: name ?? undefined });
    } else {
      onAction(id);
    }
  };

  return (
    <div className="suggestion-chips" aria-live="polite">
      {hint && <div className="suggestion-hint">{hint}</div>}

      <div className="chips-row">
        {selected
          ? chips
              .filter((c) => c.id === selected)
              .map((c) => (
                <button key={c.id} className="chip selected" disabled>
                  {c.label}
                </button>
              ))
          : chips.map((c) => (
              <button
                key={c.id}
                className={`chip ${c.primary ? "primary" : ""}`}
                type="button"
                onClick={() => onClick(c.id)}
              >
                {c.label}
              </button>
            ))}
      </div>
    </div>
  );
}
