// src/components/DescriptionBox.jsx
import React, { useState } from "react";
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

  // displayedText: fallback flow when there are responses
  const displayedText = isError
    ? validationMessage
    : loading
      ? ""
      : currentIndex === 0
        ? typedText || "Waiting for response..."
        : description || "Waiting for response...";

  const handleCopy = async () => {
    const textToCopy =
      isError || loading ? "" : currentIndex === 0 ? typedText : description;

    if (!textToCopy) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
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
      console.warn("Copy failed", err);
    }
  };

  // Always render the component (so nav is present). We'll show placeholder content
  // if there are no responses and not loading.
  // Debug log (remove if you want)
  // console.log("DescriptionBox render", { showResults, responsesLength: responses?.length, currentIndex, typedText });

  const hasResponses = Array.isArray(responses) && responses.length > 0;

  return (
    <div className="description-wrapper">
      {/* Nav buttons always present in the UI (but disabled when no responses or at edges) */}
      <div className="nav-buttons">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!hasResponses || currentIndex === 0}
          className={`nav-btn ${!hasResponses || currentIndex === 0 ? "disabled" : ""}`}
          title={!hasResponses ? "No responses yet" : "Previous response"}
        >
          ⬅ Prev
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!hasResponses || currentIndex >= responses.length - 1}
          className={`nav-btn ${!hasResponses || currentIndex >= responses.length - 1 ? "disabled" : ""}`}
          title={!hasResponses ? "No responses yet" : "Next response"}
        >
          Next ➡
        </button>
      </div>

      <div className={`description-box ${isError ? "error" : ""}`}>
        <div className="description-content">
          {loading ? (
            <div className="loader-wrapper">
              <Loader />
            </div>
          ) : isError ? (
            <p className="error-text">{validationMessage}</p>
          ) : !hasResponses ? (
            // Placeholder when there are no responses yet
            <div className="placeholder-text">
              <h4 className="placeholder-title">Analysis will appear here</h4>
              <p className="placeholder-body">
                Upload an image or try a sample. Then click <strong>Short Analysis</strong> or{" "}
                <strong>Long Analysis</strong> to see results.
              </p>
            </div>
          ) : (
            // Normal content when we have responses
            <p>{displayedText}</p>
          )}
        </div>

        {/* Bottom counter + copy: only when not loading and not an error and responses exist */}
        {!loading && !isError && hasResponses && (
          <div className="response-counter">
            <span className="response-counter-text">
              Viewing response {currentIndex + 1} of {responses.length}
            </span>

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
