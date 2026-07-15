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
  originalUrl,
  croppedUrl,
  searchLimit,
  selectedCategories,
  loading,
  onClear,
  onRecrop,
  onSetCategories,
  onSetLimit,
  onSearch,
}: ImagePreviewProps) {
  return (
    <div className="image-preview">
      <div className="image-preview__pane">
        <div className="image-preview__frame">
          <div className="image-preview__frame-header">
            <p className="image-preview__pane-title">Original Image</p>
          </div>

          <div className="image-preview__media image-preview__media--with-actions">
            <img
              className="image-preview__img"
              src={originalUrl}
              alt="Original fabric"
            />
            <div
              className="image-preview__frame-actions image-preview__action-rail"
              role="group"
              aria-label="Original image actions"
            >
              <button
                className="btn btn--primary btn--sm"
                onClick={onClear}
                type="button"
                aria-label="Clear image search"
              >
                <span aria-hidden="true">🗑️</span>
                <span>Clear</span>
              </button>
              <button
                className="btn btn--outline btn--sm"
                onClick={onRecrop}
                type="button"
              >
                <span aria-hidden="true">✂️</span>
                <span>Recrop</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {croppedUrl && (
        <>
          <div className="image-preview__pane">
            <div className="image-preview__frame">
              <div className="image-preview__frame-header">
                <p className="image-preview__pane-title">Cropped Image</p>
              </div>
              <div className="image-preview__media">
                <img
                  className="image-preview__img"
                  src={croppedUrl}
                  alt="Cropped fabric"
                />
              </div>
            </div>
          </div>

          <div className="image-preview__options">
            <CategoryPicker
              selected={selectedCategories}
              onChange={onSetCategories}
            />
          </div>

          <div className="image-preview__search-row">
            <LimitSlider
              value={searchLimit}
              onChange={onSetLimit}
              label="Limit"
            />
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
