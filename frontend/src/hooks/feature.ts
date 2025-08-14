import { useCallback, useState, useRef } from "react";

export const useUploadAndRecord = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (file: File) => {
    setImageFile(null);
    setImageUrl("")
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  };


  const handleAudioUpload = useCallback(async (file: File) => {
    const allowedMimeTypes = new Set([
      "audio/mpeg",   
      "audio/wav",   
      "audio/webm",   
      "audio/ogg",    
      "video/webm",   
      "video/mp4",    
    ]);

    if (!file.type.startsWith("audio/") && !allowedMimeTypes.has(file.type)) {
      alert("Please upload a valid audio file (mp3, wav, webm, or mp4).");
      return;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const duration = buffer?.duration ?? Number.POSITIVE_INFINITY;
        await ctx.close?.();

        if (!Number.isFinite(duration)) {
          throw new Error("Duration not finite, fallback to <audio>.");
        }
        if (duration > 60) {
          alert("Audio is longer than 1 minute.");
          return;
        }

        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        return;
      }
    } catch {
    }

    const tempUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve) => {
      const probe = new Audio();
      const cleanup = () => {
        probe.onloadedmetadata = null;
        probe.onerror = null;
      };
      probe.onloadedmetadata = () => {
        const dur = probe.duration;
        if (Number.isFinite(dur) && dur <= 60) {
          setAudioUrl(tempUrl);
        } else {
          URL.revokeObjectURL(tempUrl);
          alert(
            Number.isFinite(dur)
              ? "Audio is longer than 1 minute."
              : "Audio duration could not be determined. Please try a different file."
          );
        }
        cleanup();
        resolve();
      };
      probe.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        alert("Could not read audio. Please try a different file.");
        cleanup();
        resolve();
      };
      probe.src = tempUrl;
    });
  }, [audioUrl]);



  const startRecording = async () => {
    try {
      setAudioUrl(null);
      setRecordTime(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const file = new File([blob], "recorded_audio.webm", { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioFile(file);
        setAudioUrl(url);
        setIsRecording(false);
        setRecordTime(0);

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setInterval(() => {
        setRecordTime((prev) => {
          if (prev >= 59) {
            stopRecording(); 
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      alert("Microphone access denied or error occurred.");
    }
  };



  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };


  const handleSubmit = async () => {
    if (!imageFile || !audioFile) return;

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("audio", audioFile);

    try {
      const res = await fetch("http://localhost:8000/api/submit", {
        method: "POST",
        body: formData,
      });

      if (res.ok) alert("Submitted successfully!");
      else alert("Submission failed");
    } catch (err) {
      alert("Error submitting files");
    }
  };

  const handleBack = () => {
    setAudioUrl(null);
    setIsRecording(false);
    setRecordTime(0);
  }

  const clearImage = () => {
    setImageFile(null);
    setImageUrl(null);
  };

  return {
    imageUrl,
    audioUrl,
    isRecording,
    recordTime,
    searchInput,
    loading,
    error,
    setImageUrl,
    setAudioUrl,
    setSearchInput,
    handleImageUpload,
    handleAudioUpload,
    startRecording,
    stopRecording,
    handleSubmit,
    handleBack,
    clearImage
  };
};
