import Pagination from "./Pagination";
import ResultCard from "./ResultCard";
import type { ResultItem } from "./types";

interface ResultsSectionProps {
  results: ResultItem[];
  paginatedResults: ResultItem[];
  page: number;
  totalPages: number;
  selectedCategories: string[];
  isTextSearch: boolean;
  onSetCategories: (cats: string[]) => void;
  onPrev: () => void;
  onNext: () => void;
  onZoom: (src: string, caption: string) => void;
  onBadImage: (src: string) => void;
}

export default function ResultsSection({
  results,
  paginatedResults,
  page,
  totalPages,
  onPrev,
  onNext,
  onZoom,
  onBadImage,
}: ResultsSectionProps) {
  return (
    <div className="results-section">
      <div className="results-section__meta">
        <div>{results.length} results</div>
        <Pagination page={page} totalPages={totalPages} onPrev={onPrev} onNext={onNext} />
      </div>

      <div className="result-grid result-grid--full">
        {paginatedResults.map((item, idx: number) => (
          <ResultCard
            key={idx}
            item={item}
            index={idx}
            onZoom={onZoom}
            onBadImage={onBadImage}
          />
        ))}
      </div>
    </div>
  );
}
