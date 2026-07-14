import { useEffect, useRef, useState } from "react";

import DescriptionBox from "../components/DescriptionBox";
import DrawerToggle from "../components/DrawerToggle";
import Header from "../components/ImageDescriptorHeader";
import ImagePreview from "../components/ImagePreviewPanel";
import SampleImageGallery from "../components/SampleImageGalleryCard";
import useImageAnalysis from "../hooks/useImageAnalysis";
import "@/assets/styles/ImageDescription.css";

const ImageDescription = () => {
  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");

    return () => {
      wrapper?.classList.remove("upload-bg");
    };
  }, []);

  const {
    loading,
    description,
    responses,
    currentIndex,
    currentFile,
    uploadedImageUrl,
    sampleImageUrl,
    showDrawer,
    typedText,
    isValidImage,
    validationLoading,
    validationMessage,
    analysisPopupMessage,
    setShowDrawer,
    handleUploadedImage,
    handleRunAnalysis,
    handleSampleShortAnalysis,
    handlePrev,
    handleNext,
    clearImage,
    dismissAnalysisPopup,
  } = useImageAnalysis();

  const [, setOpenDescription] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const popupCardRef = useRef<HTMLDivElement | null>(null);
  const popupButtonRef = useRef<HTMLButtonElement | null>(null);

  const wrappedRunAnalysis = async (
    file: File | null,
    mode: "short" | "long",
  ) => {
    try {
      const res = handleRunAnalysis?.(file, mode);
      if (res && typeof res.then === "function") await res;
    } catch (err) {
      console.error("Error in wrappedRunAnalysis:", err);
    }
  };

  useEffect(() => {
    const hasPartial =
      (typedText && typedText.trim().length > 0) ||
      (responses && responses.length > 0);
    if (hasPartial) setOpenDescription(true);
  }, [typedText, responses]);

  useEffect(() => {
    if (!uploadedImageUrl && !sampleImageUrl) setOpenDescription(false);
  }, [uploadedImageUrl, sampleImageUrl]);

  useEffect(() => {
    if (!analysisPopupMessage) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    popupButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissAnalysisPopup();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        popupCardRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus?.();
    };
  }, [analysisPopupMessage, dismissAnalysisPopup]);

  return (
    <div
      className={`home-container analysis-page ${showDrawer ? "drawer-open" : ""}`}
    >
      <Header />

      <div className="top-texts">
        <span className="animated-placeholder shimmer-text">
          Upload a fabric image <span style={{ margin: "0 8px" }}>or</span>
          <span className="sample-text">Try with our sample images →</span>
        </span>
      </div>

      <div className="result-wrapper analysis-grid">
        <section className="analysis-preview-col">
          <ImagePreview
            uploadedImageUrl={uploadedImageUrl}
            sampleImageUrl={sampleImageUrl}
            validationLoading={validationLoading}
            isValidImage={isValidImage}
            loading={loading}
            currentFile={currentFile}
            handleRunAnalysis={wrappedRunAnalysis}
            handleUploadedImage={handleUploadedImage}
            imageInputRef={imageInputRef}
            clearImage={clearImage}
          />
        </section>

        <section className="analysis-action-col">
          <div className="analysis-description-area slide-in-right">
            <DescriptionBox
              isValidImage={isValidImage}
              validationMessage={validationMessage}
              loading={loading}
              responses={responses}
              currentIndex={currentIndex}
              typedText={typedText}
              description={description}
              handlePrev={handlePrev}
              handleNext={handleNext}
            />
          </div>
        </section>
      </div>

      <DrawerToggle showDrawer={showDrawer} setShowDrawer={setShowDrawer} />

      {showDrawer && (
        <div className="drawer-panel">
          <SampleImageGallery
            onAnalyze={(samplePath: string) => {
              handleSampleShortAnalysis(samplePath);
            }}
            loading={loading}
          />
        </div>
      )}

      {analysisPopupMessage && (
        <div className="analysis-popup" role="alertdialog" aria-modal="true">
          <div className="analysis-popup__card" ref={popupCardRef}>
            <div className="analysis-popup__icon" aria-hidden="true">
              ⚠️
            </div>
            <div className="analysis-popup__content">
              <h3>Invalid image</h3>
              <p>{analysisPopupMessage}</p>
            </div>
            <button
              type="button"
              className="analysis-popup__button"
              onClick={dismissAnalysisPopup}
              ref={popupButtonRef}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageDescription;
