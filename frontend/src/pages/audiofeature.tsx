import React, { useMemo, useRef, useState, useEffect } from "react";
import { useUploadAndRecord } from "../hooks/feature";
import { useNavigate, useLocation } from "react-router-dom";
import Loader from "../components/Loader";
import "../styles/UploadPage.css";

type AudioMode = "upload" | "record";

const UploadPage = () => {
    const navigate = useNavigate();
    const location = useLocation()
    const prefill = (location.state as any)?.prefill;
    const {
        imageUrl,
        audioUrl,
        isRecording,
        recordTime,
        loading,
        setImageUrl,
        setAudioUrl,
        handleImageUpload,
        handleAudioUpload,
        startRecording,
        stopRecording,
        handleSubmit,
        handleBack, 
        clearImage, 
    } = useUploadAndRecord();

    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const audioInputRef = useRef<HTMLInputElement | null>(null);
    const [audioMode, setAudioMode] = useState<AudioMode>("record");

    const canSubmit = !!imageUrl && !!audioUrl && !loading;
    const showUploadAudio = audioMode === "upload" && !audioUrl ;

    const recordPct = useMemo(() => {
        const pct = Math.min(100, Math.round((recordTime / 60) * 100));
        return Number.isFinite(pct) ? pct : 0;
    }, [recordTime]);

    useEffect(()=>{
        if(prefill?.imageUrl) setImageUrl(prefill.imageUrl)
        if(prefill?.audioUrl) setAudioUrl(prefill.audioUrl)

        if (prefill?.audioUrl) setAudioMode("record");
    }, [prefill, setImageUrl, setAudioUrl]);

    const onDropImage = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleImageUpload(file);
    };

    const onDropAudio = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleAudioUpload(file);
    };

    return (
        <div className="upload-page">
            <div className="upload-card">
                <header className="upload-header">
                    <h2>Upload Image & Audio</h2>
                    <p className="sub">Upload audio or switch to recording (max 60s)</p>
                </header>

                
                <div className="grid">
                    <section className="preview-col">
                        {imageUrl ? (
                            <div className="image-preview-wrap">
                                <img src={imageUrl} alt="Preview" className="image-preview-plain" />
                                <button
                                    className="chip chip-clear img-clear-btn"
                                    onClick={clearImage}
                                    title="Remove image"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div
                                className="dropzone"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={onDropImage}
                                onClick={() => imageInputRef.current?.click()}
                                role="button"
                                aria-label="Upload image"
                            >
                                <div className="dz-icon">🖼️</div>
                                <div className="dz-text">
                                    <strong>Drop image</strong> or <span className="link">browse</span>
                                </div>
                            </div>
                        )}

                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file);
                            }}
                        />
                    </section>

                    
                    <section className="action-col">
                        {audioMode === "record" && !audioUrl && (
                            <>
                                <div className="rec-controls">
                                    <button
                                        className="btn primary"
                                        onClick={startRecording}
                                        disabled={isRecording}
                                    >
                                        🎙 Start Recording
                                    </button>
                                    <button
                                        className="btn"
                                        onClick={stopRecording}
                                        disabled={!isRecording}
                                    >
                                        Stop
                                    </button>
                                </div>
                                <div className="alt-switch">
                                    <button
                                        className="link-btn"
                                        onClick={() => setAudioMode("upload")}
                                        disabled={isRecording}
                                    >
                                        ← Upload
                                    </button>
                                </div>

                                <div className="recording-area">
                                    {isRecording ? (
                                        <div className="record-chip" aria-live="polite">
                                            <span className="dot" />
                                            Recording… {String(recordTime).padStart(2, "0")}/60s
                                            <div className="progress">
                                                <div className="bar" style={{ width: `${recordPct}%` }} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="hint">Press Start to begin. Stop to see a preview.</div>
                                    )}
                                </div>
                            </>
                        )}
                        
                        {showUploadAudio && (
                            <>
                                {audioUrl ? (
                                    <div className="audio-card">
                                        <div className="audio-player">
                                            <audio controls src={audioUrl} />
                                        </div>
                                        <div className="img-footer">
                                            <span className="chip chip-ok">Audio ready</span>
                                            <button
                                                className="chip chip-clear"
                                                onClick={handleBack}
                                                title="Remove audio"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="dropzone"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={onDropAudio}
                                        onClick={() => audioInputRef.current?.click()}
                                        role="button"
                                        aria-label="Upload audio"
                                    >
                                        <div className="dz-icon">🎧</div>
                                        <div className="dz-text">
                                            <strong>Drop audio</strong> or <span className="link">browse</span>
                                        </div>
                                    </div>
                                )}

                                <input
                                    ref={audioInputRef}
                                    type="file"
                                    accept="audio/*"
                                    hidden
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleAudioUpload(file);
                                    }}
                                />

                                <div className="alt-switch">
                                    <button
                                        className="link-btn"
                                        onClick={() => {
                                            if (audioInputRef.current) audioInputRef.current.value = "";
                                            setAudioMode("record");
                                        }}
                                    >
                                        or Record instead →
                                    </button>
                                </div>
                            </>
                        )}

                        {audioUrl && (
                            <div className="audio-card">
                                <div className="audio-player">
                                    <audio controls src={audioUrl} />
                                </div>
                                <div className="lock-note">
                                    Start/Stop disabled while preview exists. Discard to re-record or Submit.
                                </div>
                                <div className="img-footer">
                                    <span className="chip chip-ok">Audio ready</span>
                                    <button
                                        className="chip chip-clear"
                                        onClick={handleBack}
                                        title="Remove audio"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>

        
            <div className="submit-wrapper">
                <button
                    className="btn submit"
                    onClick={async () => {
                        await handleSubmit();
                        handleBack();
                    }}
                    disabled={!canSubmit}
                >
                    {loading ? "Submitting…" : "Submit"}
                </button>

                <div className="navigation">
                    <button onClick={() => navigate("/view")}>Your Media</button>
                </div>
            </div>

            {loading && <Loader />}
        </div>
    );
};

export default UploadPage;
