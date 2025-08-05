import { useUploadAndRecord } from "../hooks/feature";

const UploadPage = () => {
    const {
        imageUrl,
        audioUrl,
        isRecording,
        recordTime,
        handleImageUpload,
        handleAudioUpload,
        startRecording,
        stopRecording,
        handleSubmit,
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
        </div>
    );

};

export default UploadPage;
