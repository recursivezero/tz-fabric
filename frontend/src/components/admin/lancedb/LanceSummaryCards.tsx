import type { LanceTableDetails } from "@/api/lancedbAdmin";

interface LanceSummaryCardsProps {
  tableCount: number;
  details: LanceTableDetails | null;
  loading: boolean;
}

export default function LanceSummaryCards({
  tableCount,
  details,
  loading,
}: LanceSummaryCardsProps) {
  const vectorDimension = details?.vector_columns[0]?.dimension ?? 0;
  const cards = [
    { label: "Available tables", value: tableCount },
    { label: "Rows", value: details?.row_count ?? 0 },
    { label: "Schema fields", value: details?.schema.length ?? 0 },
    { label: "Vector dimension", value: vectorDimension || "—" },
  ];

  return (
    <section className="lance-admin-summary" aria-label="Selected table summary">
      {cards.map((card) => (
        <article className="lance-admin-summary__card" key={card.label} aria-busy={loading}>
          <span>{card.label}</span>
          <strong>{loading ? "…" : card.value.toLocaleString()}</strong>
        </article>
      ))}
    </section>
  );
}
