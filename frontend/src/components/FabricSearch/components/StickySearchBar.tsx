import { CategoryPicker } from './CategoryPicker';
import { LimitSlider } from './LimitSlider';

interface StickySearchBarProps {
  textQuery: string;
  setTextQuery: (v: string) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  isImageMode: boolean;
  previewUrl: string | null;
  onRecrop: () => void;
  fileInputId: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedCategories: string[];
  onSetCategories: (cats: string[]) => void;
  searchLimit: number;
  onSetLimit: (v: number) => void;
}

export const StickySearchBar = (props: StickySearchBarProps) => {
  const {
    textQuery,
    setTextQuery,
    onSearch,
    onClear,
    loading,
    isImageMode,
    previewUrl,
    onRecrop,
    fileInputId,
    onFileChange,

    selectedCategories,
    onSetCategories,
    searchLimit,
    onSetLimit,
  } = props;
  return (
    <div className="search-bar search-bar--sticky">
      <div className="search-bar__inner">

        {isImageMode && previewUrl ? (
          <div className="search-bar__image-row">
            <div className="search-bar__thumb-wrap">
              <img src={previewUrl} alt="query" className="search-bar__thumb" />
            </div>

            <div className="search-bar__image-actions">
              <button className="btn btn--outline btn--sm" onClick={onRecrop}>
                ✂️ Recrop
              </button>

              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="search-bar__file-input"
              />

              <button
                className="btn btn--ghost btn--sm"
                onClick={() => document.getElementById(fileInputId)?.click()}
              >
                📷 New Image
              </button>
            </div>
          </div>
        ) : (
          <div className="search-bar__text-row">
            <div className="search-bar__input-wrap">
              <input
                type="text"
                className="search-bar__input"
                placeholder="Refine search…"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
            </div>

            <button
              className="btn btn--primary btn--sm"
              onClick={onSearch}
              disabled={loading || !textQuery.trim()}
            >
              Search
            </button>
          </div>
        )}

        <button className="btn btn--ghost btn--sm" onClick={onClear}>
          ✕ Clear
        </button>
      </div>

      {/* ✅ NEW: filters always visible */}
      <div className="search-bar__filters">
        <CategoryPicker
          selected={selectedCategories}
          onChange={onSetCategories}
          compact
        />

        <LimitSlider
          value={searchLimit}
          onChange={onSetLimit}
          label="Limit"
        />
      </div>
    </div>
  );
}