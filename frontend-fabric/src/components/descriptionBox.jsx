import React from "react";
import Loader from "./Loader";
import "../styles/DescriptionBox.css";

const DescriptionBox = ({
  showResults,
  loading,
  responses,
  currentIndex,
  typedText,
  description,
  handlePrev,
  handleNext
}) => {
  return (
    showResults && (
      <div className="description-wrapper">
        {/* Navigation Buttons */}
        <div className="nav-buttons">
          <button
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
        <div className="description-box">
          <div className="description-content">
            {loading ? (
              <div className="loader-wrapper">
                <Loader />
              </div>
            ) : currentIndex === 0 ? (
              typedText || "Waiting for response..."
            ) : (
              description || "Waiting for response..."
            )}
          </div>
          {!loading && responses.length > 0 && (
            <div className="response-counter">
              Viewing response {currentIndex + 1} of {responses.length}
            </div>
          )}
        </div>
      </div>
    )
  );
};

export default DescriptionBox;
