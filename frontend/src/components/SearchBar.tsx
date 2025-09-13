import { useId, useState } from "react";
import "../styles/SearchBar.css";

type SelectedImage = File | string | null;

type AnimatedSearchBoxProps = {
  onSearch?: (file: File) => void;
  loading?: boolean;
};

const AnimatedSearchBox = ({ onSearch, loading = false }: AnimatedSearchBoxProps) => {
  const [selectedImage, setSelectedImage] = useState<SelectedImage>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setSelectedImage(file);
      setShowPrompt(true);

      if (onSearch) {
        onSearch(file);
      }
    }
  };

  // useId() can include ":" in generated id on some runtimes — remove it to be safe for htmlFor
  const rawId = useId();
  const fileid = rawId.replace(/[:]/g, "");

  return (
    <div className="searchbar-container">
      <div className="top-texts">
        <span className="animated-placeholder shimmer-text">
          Upload a fabric image <span style={{ margin: "0 8px" }}>or</span>
          <span className="sample-text">Try with our sample images →</span>
        </span>
      </div>

      <div className="search-box">
        {/* htmlFor now matches the input id */}
        <label htmlFor={fileid} className="upload-icon" role="button" aria-disabled={loading}>
          📁
        </label>

        {/* keep input present but visually hidden; label will trigger it */}
        <input
          id={fileid}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: "none" }}
          disabled={!!loading}
        />

        {showPrompt && selectedImage ? (
          <>
            <span className="file-name">{typeof selectedImage === "string" ? selectedImage : selectedImage.name}</span>
            <p className="search-instruction">Image uploaded successfully. Showing preview...</p>
          </>
        ) : (
          <div className="text-container" />
        )}

        <button className="search-btn" disabled>
          🔍
        </button>
      </div>
    </div>
  );
};

export default AnimatedSearchBox;
