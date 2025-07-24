import { useState } from "react";
import "../styles/SearchBar.css";

const AnimatedSearchBox = ({ onSearch, loading }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setShowPrompt(true);

      if (onSearch) {
        onSearch(file);
      }
    }
  };

  return (
    <div className="search-container">
      {!showPrompt && !selectedImage && (
        <div className="top-texts">
          <span className="animated-placeholder shimmer-text">
            Upload a fabric image <span style={{ margin: "0 8px" }}>or</span>
            <span className="sample-text">Try with our sample images →</span>
          </span>
        </div>
      )}

      <div className="search-box">
        <label htmlFor="file-upload" className="upload-icon">📁</label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          hidden
          disabled={loading}
        />

        {showPrompt && selectedImage ? (
          <>
            <span className="file-name">{selectedImage?.name}</span>
            <p className="search-instruction">Image uploaded successfully. Showing preview...</p>
          </>
        ) : (
          <div className="text-container" />
        )}

        <button className="search-btn" disabled>🔍</button>
      </div>
    </div>
  );
};

export default AnimatedSearchBox;
