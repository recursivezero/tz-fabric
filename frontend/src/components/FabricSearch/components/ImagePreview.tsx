import { CategoryPicker } from './CategoryPicker';
import { LimitSlider } from './LimitSlider';

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

export const ImagePreview = ({
  originalUrl, croppedUrl, searchLimit,
  selectedCategories, loading,
  onClear, onRecrop, onSetCategories, onSetLimit, onSearch,
}: ImagePreviewProps) => {
  return (
    <div className="image-preview">
      {/* Original */}
      <div className="image-preview__pane">
        <p className="image-preview__pane-title">Original Image</p>
        <div className="image-preview__frame">
          <img className="image-preview__img" src={originalUrl} alt="original" />
          <div className="image-preview__frame-actions image-preview__frame-actions--top">
            <button
              className="btn btn--primary btn--sm"
              onClick={onClear}
            >
              🗑️ Clear Search
            </button>
          </div>
          <div className="image-preview__frame-actions image-preview__frame-actions--bottom">
            <button className="btn btn--outline btn--sm" onClick={onRecrop}>
              ✂️ Recrop
            </button>
          </div>
        </div>
      </div>

      {/* Cropped */}
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
            >
              🔎 Search
            </button>
          </div>
        </>
      )}
    </div>
  );
};