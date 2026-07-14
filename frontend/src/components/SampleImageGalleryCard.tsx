import "@/assets/styles/SampleImageGalleryCard.css";

const sampleImages = [
  { id: 1, name: "Sample 1", path: "../assets/sample1.jpeg" },
  { id: 2, name: "Sample 2", path: "../assets/sample2.jpeg" },
  { id: 3, name: "Sample 3", path: "../assets/sample3.jpeg" },
];

type SampleImageGalleryProps = {
  onAnalyze: (samplePath: string) => void | Promise<void>;
  loading: boolean;
};

const SampleImageGallery = ({ onAnalyze, loading }: SampleImageGalleryProps) => {
  return (
    <div className="sample-gallery">
      <h2>Try with Sample Images</h2>
      <div className="sample-grid">
        {sampleImages.map((img) => (
          <button
            key={img.id}
            type="button"
            className="sample-card"
            style={{ opacity: loading ? 0.5 : 1 }}
            disabled={loading}
            aria-label={`Analyze ${img.name}`}
            onClick={() => onAnalyze(img.path)}
          >
            <img src={img.path} alt={img.name} className="sample-img" loading="lazy" decoding="async" />
            <span className="sample-card__select" aria-hidden="true">
              Select
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SampleImageGallery;
