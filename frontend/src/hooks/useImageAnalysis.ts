import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { analyzeImage, regenerateResponse, validateImageAPI } from "../services/analyze_api.ts";
import { fetchImageAsFile } from "../utils/image-helper.ts";

type Mode = "short" | "long";

const extractFilename = (path: string, fallback = "fabric.jpg"): string => {
  const base = path.split(/[?#]/)[0]; // strip query/hash
  const seg = base.split("/").filter(Boolean).pop();
  return seg ?? fallback;
};

const useImageAnalysis = () => {
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentMode, setCurrentMode] = useState<Mode | null>(null);
  const [showUploadedImage, setShowUploadedImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(true);
  const [typedText, setTypedText] = useState("");
  const [isValidImage, setIsValidImage] = useState<boolean | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [canUpload, setCanUpload] = useState(true);

  const location = useLocation();
  const latestRunIdRef = useRef(0);

  const handleRunAnalysis = useCallback(
    async (file: File | null, mode: Mode) => {
      if (!file) return;
      const runId = ++latestRunIdRef.current;

      setShowResults(true);
      setLoading(true);
      setCurrentMode(mode);
      setShowDrawer(false);
      setCanUpload(false);

      try {
        const response = await analyzeImage(file, mode);
        if (runId !== latestRunIdRef.current) return;

        const firstObject = response.response;
        const first = (firstObject?.response as string) ?? "";

        const allResponses = Array<string>(6).fill("");
        allResponses[0] = first;

        setResponses(allResponses);
        setDescription(first);
        setCurrentIndex(0);
        setCacheKey((response as { cache_key?: string })?.cache_key ?? null);
      } catch (err) {
        if (runId !== latestRunIdRef.current) return;
        console.error(`${mode} analysis failed:`, err);
        alert(`${mode} analysis failed.`);
        setIsValidImage(false);
      } finally {
        if (runId === latestRunIdRef.current) setLoading(false);
      }
    },
    []
  );

  // Auto-run from query params (?mode=&image_url=)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modeParam = params.get("mode") as Mode | null;
    const imageUrl = params.get("image_url");

    if (imageUrl && modeParam && !currentFile) {
      (async () => {
        try {
          const filename = extractFilename(imageUrl);
          const file = await fetchImageAsFile(imageUrl, filename);
          setCurrentFile(file);
          setUploadedImageUrl(imageUrl);
          await handleRunAnalysis(file, modeParam);
        } catch (err) {
          console.error("Failed to auto-run analysis from query params:", err);
        }
      })();
    }
  }, [location.search, handleRunAnalysis, currentFile]);

  // Typing effect for the very first response
  useEffect(() => {
    if (currentIndex !== 0 || !description) return;

    const tokens = description.split(" ");
    let index = 0;
    let currentText = "";
    setTypedText("");

    let cancelled = false;

    const simulatePrediction = async () => {
      while (!cancelled && index < tokens.length) {
        await new Promise((res) => setTimeout(res, 170));
        const nextToken = tokens[index];
        currentText = currentText ? `${currentText} ${nextToken}` : nextToken;
        setTypedText(currentText);
        index++;
      }
      if (!cancelled) setCanUpload(true);
    };

    simulatePrediction();
    return () => {
      cancelled = true;
    };
  }, [description, currentIndex]);

  const handleSampleShortAnalysis = async (imagePath: string) => {
    setShowDrawer(false);
    setSampleImageUrl(imagePath);
    setShowResults(true);
    setLoading(true);
    setCanUpload(false);
    setIsValidImage(null);
    setValidationMessage("");
    setUploadedImageUrl(null);
    setShowUploadedImage(false);
    setDescription("");
    setTypedText("");
    setResponses([]);
    setCurrentIndex(0);
    setCacheKey(null);

    try {
      const filename = extractFilename(imagePath);
      const file = await fetchImageAsFile(imagePath, filename);
      const response = await analyzeImage(file, "short");

      const firstObject = response.response;
      const first = (firstObject?.response as string) ?? "";

      const allResponses = Array<string>(6).fill("");
      allResponses[0] = first;

      setResponses(allResponses);
      setDescription(first);
      setCacheKey((response as { cache_key?: string })?.cache_key ?? null);
      setCurrentIndex(0);
      setCurrentFile(file);
      setCurrentMode("short");
      setShowUploadedImage(true);

      const objUrl = URL.createObjectURL(file);
      setUploadedImageUrl(objUrl);
      setSampleImageUrl(objUrl);
    } catch (err) {
      console.error("Short analysis failed:", err);
      alert("Upload a valid fabric image.");
    } finally {
      setLoading(false);
    }
  };

  const validateImage = useCallback(
    async (imageFile: File | null): Promise<void> => {
      if (!imageFile) {
        setValidationMessage("No image provided.");
        setIsValidImage(false);
        return;
      }

      setValidationLoading(true);
      setIsValidImage(null);
      setValidationMessage("");

      try {
        const data = await validateImageAPI(imageFile);
        if (data?.valid) {
          setIsValidImage(true);
        } else {
          setIsValidImage(false);
          setValidationMessage(
            "This image doesn't focus on fabric. Please upload a close-up fabric image."
          );
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          setValidationMessage(error.message);
        } else {
          setValidationMessage(String(error ?? "An unknown error occurred during image validation."));
        }
        setIsValidImage(false);
      } finally {
        setValidationLoading(false);
      }
    },
    []
  );

  const handleUploadedImage = (file: File) => {
    setShowDrawer(false);
    setUploadedImageUrl(URL.createObjectURL(file));
    setCurrentFile(file);
    setShowUploadedImage(true);
    setCurrentMode(null);
    setSampleImageUrl(null);
    void validateImage(file);
    setDescription("");
    setShowResults(false);
    setResponses([]);
    setCacheKey(null);
    setCurrentIndex(0);
    setTypedText("");
  };

  // Auto-run short analysis after validation passes for uploaded images
  useEffect(() => {
    if (isValidImage === true && currentFile && !sampleImageUrl && !loading && currentMode === null) {
      void handleRunAnalysis(currentFile, "short");
    }
  }, [isValidImage, currentFile, loading, currentMode, sampleImageUrl, handleRunAnalysis]);

  const handleNext = async () => {
    const newIndex = currentIndex + 1;

    // Use cached response if available
    if (responses[newIndex]) {
      setCurrentIndex(newIndex);
      setDescription(responses[newIndex]);
      return;
    }

    if (!cacheKey) {
      alert("No more responses available.");
      return;
    }

    try {
      const res = await regenerateResponse(cacheKey, String(newIndex));
      const nextText = (res?.response as string) ?? "";
      if (nextText) {
        const updated = [...responses];
        // Ensure array is long enough
        if (updated.length <= newIndex) {
          updated.length = newIndex + 1;
          for (let i = 0; i < updated.length; i++) {
            if (typeof updated[i] !== "string") updated[i] = "";
          }
        }
        updated[newIndex] = nextText;
        setResponses(updated);
        setCurrentIndex(newIndex);
        setDescription(nextText);
      } else {
        alert("No more responses available.");
      }
    } catch (err) {
      console.error("Next response fetch failed:", err);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setDescription(responses[newIndex] ?? "");
    }
  };

  const clearImage = () => {
    setShowUploadedImage(false);
    setUploadedImageUrl(null);
    setCurrentFile(null);
    setSampleImageUrl(null);
  };

  return {
    showResults,
    loading,
    description,
    cacheKey,
    responses,
    currentIndex,
    currentFile,
    currentMode,
    showUploadedImage,
    uploadedImageUrl,
    sampleImageUrl,
    showDrawer,
    typedText,
    isValidImage,
    validationLoading,
    validationMessage,
    canUpload,
    setShowDrawer,
    handleSampleShortAnalysis,
    handleUploadedImage,
    handleRunAnalysis,
    handleNext,
    handlePrev,
    clearImage
  };
};

export default useImageAnalysis;
