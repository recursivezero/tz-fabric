import CategoryPicker from "./CategoryPicker";
import LimitSlider from "./LimitSlider";

interface ImagePreviewProps {
  originalUrl: string;
  croppedUrl: string | null;
  searchLimit: number;
  selectedCategories: string[];
  loading: boolean;
  onClear: () => void;
  onRecrop: () => void;
  onSetCategories: (cats: string[]) => void;
  onSetLimit: (v: number) => void;
  onSearch: () => void;
}

export default function ImagePreview({
  originalUrl, croppedUrl, searchLimit,
  selectedCategories, loading,
  onClear, onRecrop, onSetCategories, onSetLimit, onSearch,
}: ImagePreviewProps) {
  return (
    <div className="image-preview">
      <div className="image-preview__pane">
        <p className="image-preview__pane-title">Original Image</p>
        <div className="image-preview__frame">
          <img className="image-preview__img" src={originalUrl} alt="original" />
          <div className="image-preview__frame-actions image-preview__frame-actions--top">
            <button
              className="btn btn--primary btn--sm"
              onClick={onClear}
              type="button"
            >
              <span aria-hidden="true">🗑️</span>
              <span>Clear Search</span>
            </button>
          </div>
          <div className="image-preview__frame-actions image-preview__frame-actions--bottom">
            <button className="btn btn--outline btn--sm" onClick={onRecrop} type="button">
              <span aria-hidden="true">✂️</span>
              <span>Recrop</span>
            </button>
          </div>
        </div>
      </div>

      {croppedUrl && (
        <>
          <div className="image-preview__pane">
            <p className="image-preview__pane-title">Cropped Image</p>
            <div className="image-preview__frame">
              <img className="image-preview__img" src={croppedUrl} alt="cropped" />
            </div>
          </div>

          <div className="image-preview__options">
            <CategoryPicker selected={selectedCategories} onChange={onSetCategories} />
          </div>

          <div className="image-preview__search-row">
            <LimitSlider value={searchLimit} onChange={onSetLimit} label="Limit" />
            <button
              className="btn btn--primary"
              onClick={onSearch}
              disabled={loading}
              type="button"
            >
              <span aria-hidden="true">🔎</span>
              <span>Search</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
