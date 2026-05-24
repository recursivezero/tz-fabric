import { CategoryPicker } from './CategoryPicker';
import { LimitSlider } from './LimitSlider';

interface HeroProps {
  textQuery: string;
  setTextQuery: (v: string) => void;
  onTextSearch: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputId: string;
  searchLimit: number;
  onSetLimit: (v: number) => void;
  selectedCategories: string[];
  onSetCategories: (cats: string[]) => void;
  loading: boolean;
}

export const Hero = ({
  textQuery, setTextQuery, onTextSearch,
  onFileChange, fileInputId,
  searchLimit, onSetLimit,
  selectedCategories, onSetCategories,
  loading,
}: HeroProps) => {

  console.log("Rendering Hero with props:", {
    textQuery, searchLimit, selectedCategories, loading
  });
  return (
    <div className="hero">
      <header className="hero__header">
        <div className="hero__eyebrow">Fabric Intelligence</div>
        <h1 className="hero__title">
          Find the clothing
          <br />
          <span className="hero__title-accent">you couldn't find.</span>
        </h1>
        <p className="hero__subtitle">Visual &amp; semantic search — powered by vectors</p>
      </header>

      <div className="hero__search-controls">
        {/* Text search */}
        <div className="hero__search-row">
          <input
            type="text"
            className="hero__search-input"
            placeholder="Search by name, fabric or color"
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onTextSearch()}
          />
          <button
            className="btn btn--primary"
            onClick={onTextSearch}
            disabled={loading || !textQuery.trim()}
          >
            Search
          </button>
        </div>

        {/* Limit */}
        <LimitSlider value={searchLimit} onChange={onSetLimit} />

        {/* Divider */}
        <div className="hero__divider">or</div>

        {/* Image upload */}
        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hero__file-input"
        />
        <button
          className="btn btn--ghost hero__upload-btn"
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          📷 Drop your Image
        </button>
      </div>

      {/* Category filter */}
      <div className="hero__categories">
        <CategoryPicker selected={selectedCategories} onChange={onSetCategories} />
      </div>
    </div>
  );
}