import { useState } from "react";
import { FaRegCopy } from "react-icons/fa";
import "../styles/DescriptionBox.css";
import Loader from "./Loader";

const DescriptionBox = ({
  isValidImage,
  validationMessage,
  showResults,
  loading,
  responses,
  currentIndex,
  typedText,
  description,
  handlePrev,
  handleNext
}) => {
  const [copied, setCopied] = useState(false);
  const isError = isValidImage === false && validationMessage;

  const handleCopy = () => {
    const textToCopy = description || typedText;
    if (!textToCopy) return;
    navigator.clipboard.writeText(description || typedText || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!showResults && !isError) return null;

  return (
    <div className="description-wrapper">
      {!isError && (
        <div className="nav-buttons">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`nav-btn ${currentIndex === 0 ? "disabled" : ""}`}
          >
            ⬅ Prev
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === responses.length - 1}
            className={`nav-btn ${currentIndex === responses.length - 1 ? "disabled" : ""}`}
          >
            Next ➡
          </button>
        </div>
      )}

      <div className={`description-box ${isError ? "error" : ""}`}>
        <div className="description-content">
          {loading ? (
            <div className="loader-wrapper">
              <Loader />
            </div>
          ) : isError ? (
            <p className="error-text">{validationMessage}</p>
          ) : currentIndex === 0 ? (
            typedText || "Waiting for response..."
          ) : (
            description || "Waiting for response..."
          )}
        </div>

        {!loading && !isError && responses.length > 0 && (
          <div className="response-counter">
            <span className="response-counter">
              Viewing response {currentIndex + 1} of {responses.length}
            </span>
            <span className="copy-btn" onKeyDown={handleCopy}>
              {copied ? "Copied" : <FaRegCopy />}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DescriptionBox;
