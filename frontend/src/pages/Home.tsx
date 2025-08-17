import useImageAnalysis from "../hooks/useImageAnalysis";
import Header from "../components/Header";
import SampleImageGallery from "../components/SampleImageGalleryCard";
import AnimatedSearchBox from "../components/SearchBar";
import ImagePreview from "../components/imagePreviewPanel";
import DescriptionBox from "../components/descriptionBox";
import DrawerToggle from "../components/drawerToggle";
import "../styles/Home.css";

const Home = () => {
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
    handleNext
  } = useImageAnalysis();

  return (
    <div className="home-container">
      <Header  />

      <div className="upload-wrapper">
        <div className="upload-inner">
          <AnimatedSearchBox onSearch={handleUploadedImage} loading={!canUpload} />
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
          <SampleImageGallery onAnalyze={handleSampleShortAnalysis} loading={loading} vertical />
        </div>
      )}
    </div>
  );
};

export default Home;
