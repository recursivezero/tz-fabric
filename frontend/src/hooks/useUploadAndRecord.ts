import { useCallback, useRef, useState } from "react";
import { FULL_API_URL } from "../constants";

export const useUploadAndRecord = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [audioNotification, setAudioNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const successNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => {
        setNotification(null);
      }, 2000);
    },
    []
  );

  const errorNotification = useCallback((type: "error", message: string) => {
    setAudioNotification({ type, message });
    setError(message);

    setTimeout(() => {
      setAudioNotification(null);
    }, 2000);
  }, []);

  const handleImageUpload = (file: File) => {
    setImageFile(null);
    setImageUrl("");
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  };

  const handleAudioUpload = useCallback(
    async (file: File) => {
      const allowedMimeTypes = new Set([
        "audio/mpeg",
        "audio/wav",
        "audio/webm",
        "audio/ogg",
        "video/webm",
        "video/mp4",
      ]);

      if (!file.type.startsWith("audio/") && !allowedMimeTypes.has(file.type)) {
        errorNotification("error", "Please upload a valid audio file (mp3, wav, webm, or mp4).");
        return;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioCtx =
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext ?? window.AudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          const duration = buffer?.duration ?? Number.POSITIVE_INFINITY;
          await ctx.close?.();

          if (!Number.isFinite(duration)) {
            throw new Error("Duration not finite, fallback to <audio>.");
          }
          if (duration > 61) {
            errorNotification("error", "Audio is longer than 1 minute.");
            return;
          }

          const url = URL.createObjectURL(file);
          setAudioUrl(url);
          setAudioFile(file);
          return;
        }
      } catch (e) {
        console.warn("Web Audio API failed, fallback to <audio>.", e);
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
            errorNotification(
              "error",
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
          errorNotification("error", "Could not read audio. Please try a different file.");
          cleanup();
          resolve();
        };
        probe.src = tempUrl;
      });
    },
    [audioUrl, errorNotification]
  );

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
        const file = new File([blob], "recorded_audio.webm", {
          type: "audio/webm",
        });
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
    } catch (error) {
      errorNotification("error", "Microphone access denied or error occurred.");
      console.error("Error accessing microphone:", error);
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
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

  const handleSubmit = async (name?: string) => {
    if (!imageFile || !audioFile) return;

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("audio", audioFile);

    if (name?.trim()) formData.append("name", name.trim());
    setLoading(true);
    setNotification(null);

    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`${FULL_API_URL}/submit`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        successNotification("success", `Submitted! Saved as ${data.base}`);
      } else {
        errorNotification("error", "Submission failed");
      }
      setImageFile(null);
      setAudioFile(null);
      setImageUrl(null);
      setAudioUrl(null);
    } catch (error) {
      setNotification({ message: "Error submitting files", type: "error" });
      console.error("Submission error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setAudioUrl(null);
    setIsRecording(false);
    setRecordTime(0);
  };

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
    notification,
    setNotification,
    audioNotification,
    setAudioNotification,
    setImageUrl,
    setAudioUrl,
    setSearchInput,
    handleImageUpload,
    handleAudioUpload,
    startRecording,
    stopRecording,
    handleSubmit,
    handleBack,
    clearImage,
  };
};
