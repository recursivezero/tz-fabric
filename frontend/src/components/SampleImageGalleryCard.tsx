import '../styles/SampleImageGalleryCard.css'


const sampleImages = [
  { id: 1, name: "Sample 1", path: "src/assets/20250312_224758__10_45_28_PM.jpeg" },
  { id: 2, name: "Sample 2", path: "src/assets/20250323_093907__10_24_31_PM.jpeg" },
  { id: 3, name: "Sample 3", path: "src/assets/20250323_094209__10_22_53_PM.jpeg" },
];

const SampleImageGallery = ({ onAnalyze, loading }) => {
  return (
    <div className="sample-gallery">
      <h2>Try with Sample Images</h2>
      <div className="sample-grid">
        {sampleImages.map((img) => (
          <div key={img.id} className="sample-card"  style={{
              opacity: loading ? 0.5 : 1,
              pointerEvents: loading ? "none" : "auto",
            }}>
            <img src={img.path} alt={img.name} className="sample-img" />
            <button
              className="analyze-button"
              onClick={() => onAnalyze(img.path)}
              disabled={loading}
            >
              Short Analysis
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SampleImageGallery;