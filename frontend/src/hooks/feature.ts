import { useState, useRef } from "react";

export const useUploadAndRecord = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);

  
  const handleImageUpload = (file: File) => {
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  };

  
  const handleAudioUpload = (file: File) => {
    const tempUrl = URL.createObjectURL(file);
    const audio = new Audio(tempUrl);
    audio.onloadedmetadata = () => {
      if (audio.duration > 60) {
        alert("Audio is longer than 1 minute.");
      } else {
        setAudioFile(file);
        setAudioUrl(tempUrl);
      }
    };
  };

  const startRecording = async () => {
  try {
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
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
    setRecordTime(0);

    const timer = setInterval(() => {
      setRecordTime((prev) => {
        if (prev >= 59) {
          clearInterval(timer);
        }
        return prev + 1;
      });
    }, 1000);

    setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      clearInterval(timer);
    }, 60000);
  } catch (err) {
    alert("Microphone access denied or error occurred.");
  }
};


  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
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

  return {
    imageUrl,
    audioUrl,
    isRecording,
    recordTime,
    handleImageUpload,
    handleAudioUpload,
    startRecording,
    stopRecording,
    handleSubmit,
  };
};
