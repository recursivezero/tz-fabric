import type { ChangeEvent } from "react";
import CategoryPicker from "./CategoryPicker";
import LimitSlider from "./LimitSlider";

interface HeroProps {
  textQuery: string;
  setTextQuery: (v: string) => void;
  onTextSearch: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputId: string;
  searchLimit: number;
  onSetLimit: (v: number) => void;
  selectedCategories: string[];
  onSetCategories: (cats: string[]) => void;
  loading: boolean;
}

export default function SearchHero({
  textQuery, setTextQuery, onTextSearch,
  onFileChange, fileInputId,
  searchLimit, onSetLimit,
  selectedCategories, onSetCategories,
  loading,
}: HeroProps) {
  return (
    <div className="hero">
      <header className="hero__header">
        <div className="hero__eyebrow">Fabric Intelligence</div>

        <h1 className="hero__title">
          Find the clothing
          <br />
          <span className="hero__title-accent">
            you couldn't find.
          </span>
        </h1>

        <p className="hero__subtitle">
          Visual &amp; semantic search — powered by vectors
        </p>
      </header>

      <div className="hero__search-controls">
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
            type="button"
          >
            Search
          </button>
        </div>

        <LimitSlider value={searchLimit} onChange={onSetLimit} />

        <div className="hero__divider">or</div>

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
          type="button"
        >
          <span aria-hidden="true">📷</span>
          <span>Drop your Image</span>
        </button>
      </div>

      <div className="hero__categories">
        <CategoryPicker selected={selectedCategories} onChange={onSetCategories} />
      </div>
    </div>
  );
}
