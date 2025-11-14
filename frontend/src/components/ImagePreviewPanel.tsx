import React from "react";
import "../styles/ImagePreviewPanel.css";

/**
 * ImagePreviewPanel
 * - always renders the buttons in a dedicated container below the visual area
 * - accepts `showButtons` (default true) so parent can override, but default is visible
 * - logs a debug message so you can confirm rendering
 */
const ImagePreviewPanel = ({
  uploadedImageUrl,
  sampleImageUrl,
  validationLoading,
  isValidImage,
  loading,
  currentFile,
  handleRunAnalysis,
  handleUploadedImage,
  imageInputRef,
  showButtons = true,
}) => {
  const giveFileNameAndSize = (currentFile) => {
    if (!currentFile) return "";
    const fileName = currentFile.name;
    const fileSize = (currentFile.size / 1024).toFixed(2); // KB
    return `${fileName} (${fileSize} KB)`;
  };

  const hasImage = Boolean(uploadedImageUrl || sampleImageUrl);
  const isImageValid = sampleImageUrl ? true : isValidImage;
  const canRun = hasImage && !validationLoading && !loading && isImageValid;

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && typeof handleUploadedImage === "function") handleUploadedImage(file);
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && typeof handleUploadedImage === "function") handleUploadedImage(file);
  };

  // Debug log to confirm rendering
  // Remove or comment out in production
  console.log("ImagePreviewPanel render — showButtons:", showButtons, "hasImage:", hasImage, "canRun:", canRun);

  return (
    <div className="image-preview-container">
      {/* Visual area (preview or dropzone) */}
      <div className="preview-visual">
        {hasImage ? (
          <div className="preview-wrap">
            <img
              src={uploadedImageUrl || sampleImageUrl}
              alt="Preview"
              className="preview-image"
            />
          </div>
        ) : (
          <div
            className="dropzone big-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => imageInputRef?.current?.click?.()}
            role="button"
            aria-label="Upload image"
          >
            <div className="dz-icon">🖼️</div>
            <div className="dz-text">
              <strong>Drop image</strong> or <span className="link">browse</span>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              style={{ display: "none" }}
            />
          </div>
        )}
      </div>

      {/* file name / size */}
      <div className="filesize-name">
        <span className="filename">{giveFileNameAndSize(currentFile)}</span>
      </div>

      {showButtons && (
        <div className="preview-buttons-container" data-debug="preview-buttons">
          {validationLoading ? (
            <p className="validation-text">🔍 Checking if this is a valid fabric image...</p>
          ) : (
            <>
              <button
                onClick={() => handleRunAnalysis(currentFile, "short")}
                disabled={!canRun}
                className={`analysis-btn short ${!canRun ? "disabled" : ""}`}
                title={!hasImage ? "Upload an image first" : !isImageValid ? "Image invalid" : ""}
                data-testid="short-btn"
              >
                Short Analysis
              </button>

              <button
                onClick={() => handleRunAnalysis(currentFile, "long")}
                disabled={!canRun}
                className={`analysis-btn long ${!canRun ? "disabled" : ""}`}
                title={!hasImage ? "Upload an image first" : !isImageValid ? "Image invalid" : ""}
                data-testid="long-btn"
              >
                Long Analysis
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ImagePreviewPanel;
