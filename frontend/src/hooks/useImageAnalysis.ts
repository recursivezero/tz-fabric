import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchImageAsFile } from "../utils/imageUtils.ts";
import { analyzeImage, regenerateResponse, validateImageAPI } from "../services/analyze_Api.ts";

const useImageAnalysis = () => {
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [cacheKey, setCacheKey] = useState(null);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentMode, setCurrentMode] = useState<"short" | "long" | null>(null);
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const imageUrl = params.get("image_url");

    if (imageUrl && mode && !currentFile) {
      // Auto-fetch image from URL and run analysis
      const run = async () => {
        try {
          const filename = imageUrl.split("/").pop() || "fabric.jpg";
          const file = await fetchImageAsFile(imageUrl, filename);
          setCurrentFile(file);
          setUploadedImageUrl(imageUrl);
          await handleRunAnalysis(file, mode);
        } catch (err) {
          console.error("Failed to auto-run analysis from query params:", err);
        }
      };
      run();
    }
  }, [location.search]);
  useEffect(() => {
    const tokens = description.split(" ");
    if (currentIndex !== 0 || !description) return;

    let index = 0;
    let currentText = "";
    setTypedText("");

    const simulatePrediction = async () => {
      while (index < tokens.length) {
        await new Promise((res) => setTimeout(res, 170));

        const nextToken = tokens[index];
        currentText = currentText ? `${currentText} ${nextToken}` : nextToken;

        setTypedText(currentText);
        index++;
      }

      setCanUpload(true);
    };

    simulatePrediction();
  }, [description, currentIndex]);

  const handleSampleShortAnalysis = async (imagePath) => {
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
      const filename = imagePath.split("/").pop();
      const file = await fetchImageAsFile(imagePath, filename);
      const response = await analyzeImage(file, "short");
      console.log("🔍 analyzeImage() returned:", response);
      const firstObject = response.response;
      const first = firstObject?.response;
      const allResponses = Array(6).fill(null);
      allResponses[0] = first;
      setResponses(allResponses as string[]);
      setDescription(first);
      setCacheKey(response.cache_key);
      setCurrentIndex(0);
      setCurrentFile(file);
      setCurrentMode("short");
      setShowUploadedImage(true);
      setUploadedImageUrl(URL.createObjectURL(file));
      setSampleImageUrl(URL.createObjectURL(file));
    } catch (err) {
      console.error("Short analysis failed:", err);
      alert("Upload a valid fabric image.");
    }
    setLoading(false);
  };

  const validateImage = useCallback(
    async (imageFile: File | null): Promise<void> => {
      // defensive: handle no-file case early
      if (!imageFile) {
        setValidationMessage("No image provided.");
        setIsValidImage(false);
        return;
      }

      setValidationLoading(true);
      setIsValidImage(null);
      setValidationMessage("");

      try {
        const data = await validateImageAPI(imageFile); // typed at its declaration ideally

        if (data?.valid) {
          setIsValidImage(true);
        } else {
          setIsValidImage(false);
          setValidationMessage(
            "This image doesn't focus on fabric. Please upload a close-up fabric image.",
          );
        }
      } catch (error: unknown) {
        // Narrow the unknown to Error
        if (error instanceof Error) {
          setValidationMessage(error.message);
        } else {
          // fallback for non-Error throws (string, number, etc.)
          setValidationMessage(
            String(
              error ?? "An unknown error occurred during image validation.",
            ),
          );
        }
        setIsValidImage(false);
      } finally {
        setValidationLoading(false);
      }
    },
    [],
  );

  const handleUploadedImage = (file) => {
    setShowDrawer(false);
    setUploadedImageUrl(URL.createObjectURL(file));
    setCurrentFile(file);
    setShowUploadedImage(true);
    setCurrentMode(null);
    setSampleImageUrl(null);
    validateImage(file);
    setDescription("");
    setShowResults(false);
    setResponses([]);
    setDescription("");
    setCacheKey(null);
    setCurrentIndex(0);
    setTypedText("");
  };

  const latestRunIdRef = useRef(0);

  const handleRunAnalysis = useCallback(
    async (file: File | null, mode: "short" | "long") => {
      if (!file) return;
      const runId = latestRunIdRef.current;
      setShowResults(true);
      setLoading(true);
      setCurrentMode(mode);
      setShowDrawer(false);
      setCanUpload(false);
      try {
        const response = await analyzeImage(file, mode);
        if (runId !== latestRunIdRef.current) return;
        const firstObject = response.response;
        const first = firstObject?.response;
        const allResponses = Array(6).fill(null);
        allResponses[0] = first;
        setResponses(allResponses);
        setDescription(allResponses[0]);
        setCurrentIndex(0);
        setCacheKey(response.cache_key);
      } catch (err) {
        if (runId !== latestRunIdRef.current) return;
        console.error(`${mode} analysis failed:`, err);
        alert(`${mode} analysis failed.`);
        setIsValidImage(false);
      } finally {
        // only flip loading off for the latest run
        if (runId === latestRunIdRef.current) setLoading(false);
      }
    },
    // dependencies for the callback:
    // - include any non-stable values used inside (e.g. analyzeImage if it's a prop or re-created)
    // - state setters (setX) are stable and don't need to be listed
    // Example: [analyzeImage] if analyzeImage is not a module-level import.
    [],
  );

  useEffect(() => {
    if (
      isValidImage === true &&
      currentFile &&
      !sampleImageUrl &&
      !loading &&
      currentMode === null
    ) {
      handleRunAnalysis(currentFile, "short");
    }
  }, [
    isValidImage,
    currentFile,
    loading,
    currentMode,
    sampleImageUrl,
    handleRunAnalysis,
  ]);

  const handleNext = async () => {
    const newIndex = currentIndex + 1;
    if (responses[newIndex]) {
      setCurrentIndex(newIndex);
      setDescription(responses[newIndex]);
      return;
    }
    try {
      const res = await regenerateResponse(cacheKey, newIndex);
      if (res?.response) {
        const updated = [...responses];
        updated[newIndex] = res.response;
        setResponses(updated);
        setCurrentIndex(newIndex);
        setDescription(res.response);
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
      setDescription(responses[newIndex]);
    }
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
  };
};

export default useImageAnalysis;
