import type { LanceSchemaField } from "@/api/lancedbAdmin";

interface LanceSchemaPanelProps {
  fields: LanceSchemaField[];
  loading: boolean;
}

export default function LanceSchemaPanel({ fields, loading }: LanceSchemaPanelProps) {
  return (
    <section className="lance-admin-panel" aria-labelledby="lance-schema-heading">
      <div className="lance-admin-panel__heading">
        <div>
          <p className="lance-admin-eyebrow">Structure</p>
          <h2 id="lance-schema-heading">Arrow schema</h2>
        </div>
        <span className="lance-admin-count">{fields.length} fields</span>
      </div>
      {loading ? (
        <div className="lance-admin-skeleton" role="status">Loading schema…</div>
      ) : fields.length === 0 ? (
        <p className="lance-admin-empty">No schema fields were reported.</p>
      ) : (
        <div className="lance-admin-schema-list">
          {fields.map((field) => (
            <div className="lance-admin-schema-row" key={field.name}>
              <div>
                <strong>{field.name}</strong>
                {field.is_vector && <span className="lance-admin-badge">vector</span>}
              </div>
              <code>{field.type}</code>
              <span>{field.nullable ? "nullable" : "required"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
