type Props = {
  pendingAction: {
    action: { type: string; params: any };
    analysis_responses?: { id: string; text: string }[];
    used_ids?: string[];
  } | null;
  onAccept: () => void;
  onReject: () => void;
  onRegenerateFresh?: () => void;
};

export default function HandleRedirectAction({ pendingAction, onAccept, onReject }: Props) {
  if (!pendingAction) return null;
  const { analysis_responses } = pendingAction;
  const firstText = analysis_responses && analysis_responses.length ? analysis_responses[0].text : null;

  return (
    <div style={{ border: "1px solid #e2e8f0", padding: 10, borderRadius: 6, marginTop: 8, background: "#fff" }}>

      <div style={{ marginBottom: 8, color:"black"}}>Do you prefer this response? (Yes / No)</div>

      <div>
        <button onClick={onAccept}>Yes — I prefer this</button>
        <button onClick={onReject} style={{ marginLeft: 8 }}>No — show another</button>
      </div>
    </div>
  );
}