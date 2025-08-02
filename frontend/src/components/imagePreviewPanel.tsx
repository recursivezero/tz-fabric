import "../styles/ImagePreviewPanel.css";

const ImagePreviewPanel = ({
  uploadedImageUrl,
  sampleImageUrl,
  validationLoading,
  isValidImage,
  loading,
  currentFile,
  handleRunAnalysis
}) => {
  
  const giveFileNameAndSize = (currentFile) => {
    if (!currentFile) return "";
    const fileName = currentFile.name;
    const fileSize = (currentFile.size / 1024).toFixed(2); // Size in KB
    return `${fileName} (${fileSize} KB)`;
  }
  const isImageValid = sampleImageUrl ? true : isValidImage;
  

  return (
    <div className="image-preview-container">
      <img
        src={uploadedImageUrl || sampleImageUrl}
        alt="Preview"
        className="preview-image"
      />
      <div className="filesize-name">
        <span className="filename">
          {giveFileNameAndSize(currentFile)}
        </span>
      </div>
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
          </>
        )}
      </div>
    </div>
  );
};

export default ImagePreviewPanel;
