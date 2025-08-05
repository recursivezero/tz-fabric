import { useUploadAndRecord } from "../hooks/feature";
import Loader from "../components/Loader";

const UploadPage = () => {
    const {
        imageUrl,
        audioUrl,
        isRecording,
        recordTime,
        searchInput,
        loading,
        error,
        setSearchInput,
        handleImageUpload,
        handleAudioUpload,
        startRecording,
        stopRecording,
        handleSubmit,
        handleSearch

    } = useUploadAndRecord();

    return (
        <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto" }}>
            <h2>📤 Upload Image & Audio (Max 1 min)</h2>


            <div>
                <label>Upload Image:</label><br />
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                    }}
                />
                {imageUrl && (
                    <div>
                        <img
                            src={imageUrl}
                            alt="preview"
                            width="200"
                            style={{ marginTop: "10px", borderRadius: "8px" }}
                        />
                    </div>
                )}
            </div>

            <div style={{ marginTop: "20px" }}>
                <label>Upload Audio (max 1 min):</label><br />
                <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAudioUpload(file);
                    }}
                />
            </div>


            <div style={{ marginTop: "15px" }}>
                <button onClick={startRecording} disabled={isRecording}>
                    🎙 Start Recording
                </button>
                <button onClick={stopRecording} disabled={!isRecording} style={{ marginLeft: "10px" }}>
                    ⏹ Stop Recording
                </button>
            </div>


            {isRecording && (
                <div
                    style={{
                        marginTop: "12px",
                        fontWeight: "bold",
                        color: "red",
                        fontSize: "16px",
                    }}
                >
                    🔴 Recording... {String(recordTime).padStart(2, "0")} / 60 seconds
                </div>
            )}


            {audioUrl && (
                <div style={{ marginTop: "15px" }}>
                    <label style={{ fontWeight: "bold" }}>🎧 Preview Audio:</label><br />
                    <audio controls src={audioUrl}></audio>
                </div>
            )}


            <div style={{ marginTop: "30px" }}>
                <button
                    onClick={handleSubmit}
                    disabled={!imageUrl || !audioUrl}
                    style={{
                        padding: "10px 20px",
                        fontSize: "16px",
                        backgroundColor: (!imageUrl || !audioUrl) ? "#ccc" : "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: (!imageUrl || !audioUrl) ? "not-allowed" : "pointer"
                    }}
                >
                    🚀 Submit
                </button>
            </div>

            <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto" }}>
                <h2>🔍 Search Audio by Image Filename</h2>

                <input
                    type="text"
                    placeholder="Enter image filename (e.g., fabric1.jpg)"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                />

                <button onClick={handleSearch} disabled={loading}>
                    {loading ? (
                        <>
                            Searching...
                            <div>
                                <Loader />
                            </div>
                        </>
                    ) : (
                        "Search"
                    )}
                </button>

                {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}

                {audioUrl && (
                    <div style={{ marginTop: "20px" }}>
                        <p>🎧 Matching Audio Found:</p>
                        <audio controls src={audioUrl}></audio>
                    </div>
                )}
            </div>
        </div>
    );

};

export default UploadPage;
