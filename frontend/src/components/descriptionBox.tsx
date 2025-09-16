import { useState } from "react";
import { FaRegCopy } from "react-icons/fa";
import "../styles/DescriptionBox.css";
import Loader from "./Loader";

const DescriptionBox = ({
  isValidImage,
  validationMessage,
  showResults,
  loading,
  responses = [],
  currentIndex = 0,
  typedText = "",
  description = "",
  handlePrev,
  handleNext,
}) => {
  const [copied, setCopied] = useState(false);
  const isError = isValidImage === false && validationMessage;

  // Determine the text currently shown to the user
  const displayedText = isError
    ? validationMessage
    : loading
      ? ""
      : currentIndex === 0
        ? typedText || "Waiting for response..."
        : description || "Waiting for response...";

  const handleCopy = async () => {
    const textToCopy =
      // if it's an error or loading or placeholder, don't copy
      isError || loading ? "" : currentIndex === 0 ? typedText : description;

    if (!textToCopy) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Optionally surface an error notification
      console.warn("Copy failed", err);
    }
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
            type="button"
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
          ) : (
            <p>{displayedText}</p>
          )}
        </div>

        {!loading && !isError && responses.length > 0 && (
          <div className="response-counter">
            <span className="response-counter">
              Viewing response {currentIndex + 1} of {responses.length}
            </span>

            {/* Use button for accessibility. */}
            <button
              type="button"
              className="copy-btn"
              onClick={handleCopy}
              aria-label="Copy response to clipboard"
            >
              {copied ? "Copied" : <FaRegCopy />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DescriptionBox;
