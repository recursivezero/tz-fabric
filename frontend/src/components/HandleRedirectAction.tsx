// src/components/HandleRedirectAction.tsx
type ToolActionParams = {
  cache_key?: string;
  image_url?: string;
  audio_url?: string | null;
  filename?: string;
  mode?: "short" | "long" | string;
  [k: string]: unknown;
};

type ToolAction = {
  type: string;
  params?: ToolActionParams;
};

type Props = {
  pendingAction: {
    action: ToolAction;
    analysis_responses?: { id: string; text: string }[];
    used_ids?: string[];
  } | null;
  onAccept: () => void;
  onReject: () => void;
  onRegenerateFresh?: () => void;
};

export default function HandleRedirectAction({
  pendingAction,
  onAccept,
  onReject,
}: Props) {
  if (!pendingAction) return null;

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        padding: 10,
        borderRadius: 6,
        marginTop: 8,
        background: "#fff",
        marginLeft: 48,
        width: "50%",
      }}
    >
      <div style={{ marginBottom: 8, color: "black" }}>
        Do you prefer this response? (Yes / No)
      </div>

      <div>
        <button onClick={onAccept}>Yes — I prefer this</button>
        <button onClick={onReject} style={{ marginLeft: 8 }}>
          No — show another
        </button>
      </div>
    </div>
  );
}
