import React from "react";
import "../styles/ImagePreviewPanel.css";

const ImagePreviewPanel = ({
  uploadedImageUrl,
  sampleImageUrl,
  validationLoading,
  isValidImage,
  validationMessage,
  loading,
  currentFile,
  handleRunAnalysis
}) => {
  const isImageValid = sampleImageUrl || isValidImage;

  return (
    <div className="image-preview-container">
      <img
        src={uploadedImageUrl || sampleImageUrl}
        alt="Preview"
        className="preview-image"
      />

      <div className="preview-buttons-container">
        {validationLoading ? (
          <p className="validation-text">🔍 Checking if this is a valid fabric image...</p>
        ) : isImageValid ? (
          <>
            <button
              onClick={() => handleRunAnalysis(currentFile, "short")}
              disabled={loading}
              className={`analysis-btn short ${loading ? "disabled" : ""}`}
            >
              Short Analysis
            </button>
            <button
              onClick={() => handleRunAnalysis(currentFile, "long")}
              disabled={loading}
              className={`analysis-btn long ${loading ? "disabled" : ""}`}
            >
              Long Analysis
            </button>
          </>
        ) : (
          <>
            <button style={{ visibility: "hidden" }}>Short</button>
            <button style={{ visibility: "hidden" }}>Long</button>
            {validationMessage && (
              <p className="error-text">{validationMessage}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImagePreviewPanel;
