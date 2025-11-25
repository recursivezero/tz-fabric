import { useEffect, useRef, useState } from "react";
import DescriptionBox from "../components/DescriptionBox";
import DrawerToggle from "../components/DrawerToggle";
import Header from "../components/ImageDescriptorHeader";
import ImagePreview from "../components/ImagePreviewPanel";
import SampleImageGallery from "../components/SampleImageGalleryCard";
import useImageAnalysis from "../hooks/useImageAnalysis";
import "../styles/ImageDescription.css";

const ImageDescription = () => {
  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");

  }, []);

  const {
    showResults,
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
    setShowDrawer,
    handleUploadedImage,
    handleRunAnalysis,
    handleSampleShortAnalysis,
    handlePrev,
    handleNext,
    clearImage
  } = useImageAnalysis();

  const [openDescription, setOpenDescription] = useState(false);
  const imageInputRef = useRef(null);

  const wrappedRunAnalysis = async (file, mode) => {
    try {
      const res = handleRunAnalysis?.(file, mode);
      if (res && typeof res.then === "function") await res;
    } catch (err) {
      // swallow
    }
  };

  useEffect(() => {
    const hasPartial = (typedText && typedText.trim().length > 0) || (responses && responses.length > 0);
    if (hasPartial) setOpenDescription(true);
  }, [typedText, responses]);

  useEffect(() => {
    if (!uploadedImageUrl && !sampleImageUrl) setOpenDescription(false);
  }, [uploadedImageUrl, sampleImageUrl]);

  return (
    <div className="home-container">
      <Header />

      <div className="top-texts">
        <span className="animated-placeholder shimmer-text">
          Upload a fabric image <span style={ { margin: "0 8px" } }>or</span>
          <span className="sample-text">Try with our sample images →</span>
        </span>
      </div>

      <div className="result-wrapper grid">
        <section className="preview-col">
          <ImagePreview
            uploadedImageUrl={ uploadedImageUrl }
            sampleImageUrl={ sampleImageUrl }
            validationLoading={ validationLoading }
            isValidImage={ isValidImage }
            loading={ loading }
            currentFile={ currentFile }
            handleRunAnalysis={ wrappedRunAnalysis }
            handleUploadedImage={ handleUploadedImage }
            imageInputRef={ imageInputRef }
            clearImage={ clearImage }
          />

          <input
            ref={ imageInputRef }
            type="file"
            accept="image/*"
            hidden
            onChange={ (e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadedImage(file);
            } }
          />
        </section>

        <section className="action-col">
          <div className="description-area slide-in-right">
            <DescriptionBox
              isValidImage={ isValidImage }
              validationMessage={ validationMessage }
              showResults={ showResults }
              loading={ loading }
              responses={ responses }
              currentIndex={ currentIndex }
              typedText={ typedText }
              description={ description }
              handlePrev={ handlePrev }
              handleNext={ handleNext }
            />
          </div>
        </section>
      </div>

      <DrawerToggle showDrawer={ showDrawer } setShowDrawer={ setShowDrawer } />

      { showDrawer && (
        <div className="drawer-panel">
          <SampleImageGallery
            onAnalyze={ (samplePath) => {
              handleSampleShortAnalysis(samplePath);
            } }
            loading={ loading }
          />
        </div>
      ) }
    </div>
  );
};

export default ImageDescription;
