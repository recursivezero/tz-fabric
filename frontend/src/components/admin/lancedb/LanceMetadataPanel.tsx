import type {
  LanceEmbeddingFunction,
  LanceVectorColumn,
} from "@/api/lancedbAdmin";

interface LanceMetadataPanelProps {
  metadata: Record<string, unknown>;
  embeddingFunctions: LanceEmbeddingFunction[];
  vectorColumns: LanceVectorColumn[];
  loading: boolean;
}

function JsonBlock({ value, label }: { value: unknown; label: string }) {
  return (
    <div className="lance-admin-json-group">
      <h3>{label}</h3>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export default function LanceMetadataPanel({
  metadata,
  embeddingFunctions,
  vectorColumns,
  loading,
}: LanceMetadataPanelProps) {
  return (
    <section className="lance-admin-panel" aria-labelledby="lance-metadata-heading">
      <div className="lance-admin-panel__heading">
        <div>
          <p className="lance-admin-eyebrow">Configuration</p>
          <h2 id="lance-metadata-heading">Metadata</h2>
        </div>
      </div>
      {loading ? (
        <div className="lance-admin-skeleton" role="status">Loading metadata…</div>
      ) : (
        <div className="lance-admin-json-stack">
          <JsonBlock value={embeddingFunctions} label="Embedding functions" />
          <JsonBlock value={vectorColumns} label="Vector columns" />
          <JsonBlock value={metadata} label="Schema metadata" />
        </div>
      )}
    </section>
  );
}
