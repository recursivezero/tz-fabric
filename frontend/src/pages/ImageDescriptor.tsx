import Header from "../components/ImageDescriptorHeader";
import SampleImageGallery from "../components/SampleImageGalleryCard";
import AnimatedSearchBox from "../components/SearchBar";
import DescriptionBox from "../components/DescriptionBox";
import DrawerToggle from "../components/DrawerToggle";
import ImagePreview from "../components/ImagePreviewPanel";
import useImageAnalysis from "../hooks/useImageAnalysis";
import "../styles/ImageDescription.css";
import { useEffect } from "react";

const ImageDescription = () => {

  useEffect(() => {
    const wrapper = document.querySelector(".app-wrapper");
    wrapper?.classList.add("upload-bg");

    const header = document.querySelector(".site-header");
    header?.classList.add("header-width");

    return () => {
      wrapper?.classList.remove("upload-bg", "header-width");
      header?.classList.remove("header-width");
    };
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
    canUpload,
    setShowDrawer,
    handleUploadedImage,
    handleRunAnalysis,
    handleSampleShortAnalysis,
    handlePrev,
    handleNext,
  } = useImageAnalysis();

  return (
    <div className="home-container">
      <Header />

      <div className="upload-wrapper">
        <div className="upload-inner">
          <AnimatedSearchBox
            onSearch={handleUploadedImage}
            loading={!canUpload}
          />
        </div>
      </div>

      {(uploadedImageUrl || sampleImageUrl) && (
        <div className="result-wrapper">
          <ImagePreview
            uploadedImageUrl={uploadedImageUrl}
            sampleImageUrl={sampleImageUrl}
            validationLoading={validationLoading}
            isValidImage={isValidImage}
            loading={loading}
            currentFile={currentFile}
            handleRunAnalysis={handleRunAnalysis}
          />

          <DescriptionBox
            isValidImage={isValidImage}
            validationMessage={validationMessage}
            showResults={showResults}
            loading={loading}
            responses={responses}
            currentIndex={currentIndex}
            typedText={typedText}
            description={description}
            handlePrev={handlePrev}
            handleNext={handleNext}
          />
        </div>
      )}

      <DrawerToggle showDrawer={showDrawer} setShowDrawer={setShowDrawer} />

      {showDrawer && (
        <div className="drawer-panel">
          <SampleImageGallery
            onAnalyze={handleSampleShortAnalysis}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};

export default ImageDescription;
