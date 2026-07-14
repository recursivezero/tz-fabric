import { useCallback, useEffect, useRef, useState } from "react";
import { FULL_API_URL } from "../constants";
import { fetchWithTimeout } from "../utils/http";

const SUBMIT_SERVER_ERROR =
  "Unable to connect to the server, please try after some time.";
const MISSING_SUBMIT_MEDIA_ERROR =
  "Please upload a valid fabric image and audio before submitting.";

type UploadNotification = {
  message: string;
  type: "success" | "error";
} | null;

const isObjectUrl = (url: string | null | undefined) =>
  Boolean(url?.startsWith("blob:"));

const revokeObjectUrl = (url: string | null | undefined) => {
  if (!isObjectUrl(url)) return;
  try {
    URL.revokeObjectURL(url as string);
  } catch {
    // Ignore stale object URLs.
  }
};

const getServerMessage = (
  data: { detail?: unknown; message?: unknown; error?: unknown } | null,
) => {
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  return "";
};

export const useUploadAndRecord = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const audioNotificationTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrlState] = useState<string | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrlState] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [notification, setNotification] = useState<UploadNotification>(null);
  const [audioNotification, setAudioNotification] =
    useState<UploadNotification>(null);

  const replaceImageUrl = useCallback((nextUrl: string | null) => {
    setImageUrlState((prevUrl) => {
      if (prevUrl !== nextUrl) revokeObjectUrl(prevUrl);
      imageUrlRef.current = nextUrl;
      return nextUrl;
    });
  }, []);

  const replaceAudioUrl = useCallback((nextUrl: string | null) => {
    setAudioUrlState((prevUrl) => {
      if (prevUrl !== nextUrl) revokeObjectUrl(prevUrl);
      audioUrlRef.current = nextUrl;
      return nextUrl;
    });
  }, []);

  const showNotification = useCallback(
    (message: string, type: "success" | "error") => {
      if (notificationTimerRef.current)
        clearTimeout(notificationTimerRef.current);
      setNotification({ type, message });
      notificationTimerRef.current = setTimeout(() => {
        setNotification(null);
        notificationTimerRef.current = null;
      }, 2000);
    },
    [],
  );

  const successNotification = useCallback(
    (type: "success" | "error", message: string) => {
      showNotification(message, type);
    },
    [showNotification],
  );

  const errorNotification = useCallback((type: "error", message: string) => {
    if (audioNotificationTimerRef.current)
      clearTimeout(audioNotificationTimerRef.current);
    setAudioNotification({ type, message });
    setError(message);

    audioNotificationTimerRef.current = setTimeout(() => {
      setAudioNotification(null);
      audioNotificationTimerRef.current = null;
    }, 2000);
  }, []);

  const handleImageUpload = useCallback(
    (file: File) => {
      setError(null);
      setImageFile(file);
      replaceImageUrl(URL.createObjectURL(file));
    },
    [replaceImageUrl],
  );

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
        setAudioFile(null);
        replaceAudioUrl(null);
        errorNotification(
          "error",
          "Please upload a valid audio file (mp3, wav, webm, or mp4).",
        );
        return;
      }

      setError(null);
      setAudioFile(null);
      replaceAudioUrl(null);

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

          setAudioFile(file);
          replaceAudioUrl(URL.createObjectURL(file));
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
            setAudioFile(file);
            replaceAudioUrl(tempUrl);
          } else {
            revokeObjectUrl(tempUrl);
            setAudioFile(null);
            errorNotification(
              "error",
              Number.isFinite(dur)
                ? "Audio is longer than 1 minute."
                : "Audio duration could not be determined. Please try a different file.",
            );
          }
          cleanup();
          resolve();
        };
        probe.onerror = () => {
          revokeObjectUrl(tempUrl);
          setAudioFile(null);
          errorNotification(
            "error",
            "Could not read audio. Please try a different file.",
          );
          cleanup();
          resolve();
        };
        probe.src = tempUrl;
      });
    },
    [errorNotification, replaceAudioUrl],
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      setAudioFile(null);
      replaceAudioUrl(null);
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
        setAudioFile(file);
        replaceAudioUrl(URL.createObjectURL(file));
        setIsRecording(false);
        setRecordTime(0);

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        for (const track of stream.getTracks()) {
          track.stop();
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

  const handleSubmit = async (name?: string): Promise<boolean> => {
    if (!imageFile || !audioFile) {
      setError(MISSING_SUBMIT_MEDIA_ERROR);
      setNotification({ message: MISSING_SUBMIT_MEDIA_ERROR, type: "error" });
      return false;
    }

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("audio", audioFile);

    if (name?.trim()) formData.append("name", name.trim());
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetchWithTimeout(
        `${FULL_API_URL}/submit`,
        {
          method: "POST",
          body: formData,
        },
        90_000,
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          detail?: unknown;
          message?: unknown;
          error?: unknown;
        } | null;
        const serverDetail = getServerMessage(data);
        const message = SUBMIT_SERVER_ERROR;
        console.error("Submission failed:", {
          status: res.status,
          serverDetail,
          data,
        });
        setError(message);
        setNotification({ message, type: "error" });
        return false;
      }

      const data = await res.json();
      setError(null);
      successNotification("success", `Submitted! Saved as ${data.base}`);
      setImageFile(null);
      setAudioFile(null);
      replaceImageUrl(null);
      replaceAudioUrl(null);
      return true;
    } catch (error) {
      setError(SUBMIT_SERVER_ERROR);
      setNotification({
        message: SUBMIT_SERVER_ERROR,
        type: "error",
      });
      console.error("Submission error:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    stopRecording();
    setAudioFile(null);
    replaceAudioUrl(null);
    setIsRecording(false);
    setRecordTime(0);
  };

  const clearImage = () => {
    setImageFile(null);
    replaceImageUrl(null);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (notificationTimerRef.current)
        clearTimeout(notificationTimerRef.current);
      if (audioNotificationTimerRef.current)
        clearTimeout(audioNotificationTimerRef.current);
      revokeObjectUrl(imageUrlRef.current);
      revokeObjectUrl(audioUrlRef.current);
    };
  }, []);

  return {
    imageUrl,
    audioUrl,
    imageFile,
    audioFile,
    hasImageFile: Boolean(imageFile),
    hasAudioFile: Boolean(audioFile),
    canSubmitFiles: Boolean(imageFile && audioFile),
    isRecording,
    recordTime,
    searchInput,
    loading,
    error,
    notification,
    setNotification,
    audioNotification,
    setAudioNotification,
    setImageUrl: replaceImageUrl,
    setAudioUrl: replaceAudioUrl,
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
