import { useState } from "react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import "@/assets/styles/ImagePreviewPanel.css";

type AnalysisMode = "short" | "long";

type ImagePreviewPanelProps = {
  uploadedImageUrl: string | null;
  sampleImageUrl: string | null;
  validationLoading: boolean;
  isValidImage: boolean | null;
  loading: boolean;
  currentFile: File | null;
  handleRunAnalysis: (
    file: File | null,
    mode: AnalysisMode,
  ) => void | Promise<void>;
  handleUploadedImage: (file: File) => void;
  imageInputRef: RefObject<HTMLInputElement | null>;
  showButtons?: boolean;
  clearImage: () => void;
};

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
  clearImage,
}: ImagePreviewPanelProps) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const giveFileNameAndSize = (file: File | null) => {
    if (!file) return "";
    const fileName = file.name;
    const fileSize = (file.size / 1024).toFixed(2); // KB
    return `${fileName} (${fileSize} KB)`;
  };

  const hasImage = Boolean(uploadedImageUrl || sampleImageUrl);
  const isImageValid = sampleImageUrl ? true : isValidImage;
  const canRun =
    Boolean(currentFile) &&
    hasImage &&
    !validationLoading &&
    !loading &&
    isImageValid;

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && typeof handleUploadedImage === "function")
      handleUploadedImage(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && typeof handleUploadedImage === "function")
      handleUploadedImage(file);
  };

  const handleClearClick = () => {
    // open modal
    setShowConfirm(true);
  };

  const confirmClear = () => {
    setShowConfirm(false);
    if (typeof clearImage === "function") clearImage();
  };

  const cancelClear = () => {
    setShowConfirm(false);
  };

  return (
    <div className="image-preview-container">
      {showButtons && (
        <div className="preview-buttons-container" data-debug="preview-buttons">
          {validationLoading ? (
            <p className="validation-text">
              🔍 Checking if this is a valid fabric image...
            </p>
          ) : (
            <>
              <button
                onClick={() => handleRunAnalysis(currentFile, "short")}
                disabled={!canRun}
                className={`analysis-btn short ${!canRun ? "disabled" : ""}`}
                title={
                  !hasImage || !currentFile
                    ? "Upload an image first"
                    : !isImageValid
                      ? "Image invalid"
                      : ""
                }
                data-testid="short-btn"
              >
                Short Analysis
              </button>

              <button
                onClick={() => handleRunAnalysis(currentFile, "long")}
                disabled={!canRun}
                className={`analysis-btn long ${!canRun ? "disabled" : ""}`}
                title={
                  !hasImage || !currentFile
                    ? "Upload an image first"
                    : !isImageValid
                      ? "Image invalid"
                      : ""
                }
                data-testid="long-btn"
              >
                Long Analysis
              </button>
            </>
          )}
        </div>
      )}
      <div className="preview-visual">
        {hasImage ? (
          <div className="preview-wrap">
            <img
              src={uploadedImageUrl ?? sampleImageUrl ?? undefined}
              alt="Preview"
              className="preview-image"
            />

            <button
              className="chip chip-clear"
              onClick={handleClearClick}
              title="Remove image"
            >
              ✕
            </button>
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
              <strong>Drop image</strong> or{" "}
              <span className="link">browse</span>
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
      <div
        className={`filesize-name ${hasImage && currentFile ? "filesize-name--visible" : "filesize-name--empty"}`}
      >
        {hasImage && currentFile ? (
          <span className="filename">{giveFileNameAndSize(currentFile)}</span>
        ) : (
          <span className="filename" />
        )}
      </div>

      {showConfirm && (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-modal">
            <div className="confirm-title">Remove Image!</div>
            <div className="confirm-body">
              Are you sure you want to remove this image?
            </div>
            <div className="confirm-actions">
              <button className="btn btn-cancel" onClick={cancelClear}>
                Cancel
              </button>
              <button className="btn btn-confirm" onClick={confirmClear}>
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePreviewPanel;
