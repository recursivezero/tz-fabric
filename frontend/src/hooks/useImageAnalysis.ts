import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  analyzeImage,
  regenerateResponse,
  validateImageAPI,
} from "../services/analyze_api.ts";
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
  const [analysisPopupMessage, setAnalysisPopupMessage] = useState<
    string | null
  >(null);

  const location = useLocation();
  const latestRunIdRef = useRef(0);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const createTrackedObjectUrl = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  const releaseTrackedObjectUrl = useCallback((url: string | null) => {
    if (!url || !objectUrlsRef.current.has(url)) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore already-revoked preview URLs.
    } finally {
      objectUrlsRef.current.delete(url);
    }
  }, []);

  const replaceUploadedImageUrl = useCallback(
    (url: string | null) => {
      setUploadedImageUrl((prev) => {
        if (prev !== url) releaseTrackedObjectUrl(prev);
        return url;
      });
    },
    [releaseTrackedObjectUrl],
  );

  const replaceSampleImageUrl = useCallback(
    (url: string | null) => {
      setSampleImageUrl((prev) => {
        if (prev !== url) releaseTrackedObjectUrl(prev);
        return url;
      });
    },
    [releaseTrackedObjectUrl],
  );

  const handleRunAnalysis = useCallback(
    async (file: File | null, mode: Mode) => {
      if (!file) {
        setCurrentFile(null);
        setAnalysisPopupMessage("Upload a valid fabric image.");
        return;
      }
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
        const message =
          err instanceof Error ? err.message : `${mode} analysis failed.`;
        setValidationMessage(message || `${mode} analysis failed.`);
        setIsValidImage(false);
        setAnalysisPopupMessage(
          "Unable to analyze this image. Upload a valid fabric image or try again later.",
        );
        setCanUpload(true);
      } finally {
        if (runId === latestRunIdRef.current) setLoading(false);
      }
    },
    [],
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
        await new Promise((res) => setTimeout(res, 35));
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
    replaceSampleImageUrl(imagePath);
    setShowResults(true);
    setLoading(true);
    setCanUpload(false);
    setIsValidImage(null);
    setValidationMessage("");
    replaceUploadedImageUrl(null);
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

      const objUrl = createTrackedObjectUrl(file);
      replaceUploadedImageUrl(objUrl);
      replaceSampleImageUrl(objUrl);
    } catch (err) {
      console.error("Short analysis failed:", err);
      setCanUpload(true);
      setAnalysisPopupMessage("Upload a valid fabric image.");
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
          setValidationMessage("");
        } else {
          setIsValidImage(false);
          setValidationMessage(
            data?.reason ||
              "This image does not look like usable fabric/textile content.",
          );
        }
      } catch (error: unknown) {
        console.warn(
          "Image validation failed; allowing analysis to continue.",
          error,
        );
        // Validation is only a guardrail. Do not block real fabric/product images
        // when the validator endpoint is slow, unavailable, or overly cautious.
        setValidationMessage("");
        setIsValidImage(true);
      } finally {
        setValidationLoading(false);
      }
    },
    [],
  );

  const handleUploadedImage = (file: File) => {
    setShowDrawer(false);
    replaceUploadedImageUrl(createTrackedObjectUrl(file));
    setCurrentFile(file);
    setShowUploadedImage(true);
    setCurrentMode(null);
    replaceSampleImageUrl(null);
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
    if (
      isValidImage === true &&
      currentFile &&
      !sampleImageUrl &&
      !loading &&
      currentMode === null
    ) {
      void handleRunAnalysis(currentFile, "short");
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

    // Use cached response if available
    if (responses[newIndex]) {
      setCurrentIndex(newIndex);
      setDescription(responses[newIndex]);
      return;
    }

    if (!cacheKey) {
      setAnalysisPopupMessage("No more responses available.");
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
        setAnalysisPopupMessage("No more responses available.");
      }
    } catch (err) {
      console.error("Next response fetch failed:", err);
      setAnalysisPopupMessage(
        "Unable to generate another response. Please try after some time.",
      );
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
    latestRunIdRef.current += 1;
    setShowUploadedImage(false);
    replaceUploadedImageUrl(null);
    setCurrentFile(null);
    replaceSampleImageUrl(null);
    setResponses([]);
    setDescription("");
    setTypedText("");
    setCurrentIndex(0);
    setCacheKey(null);
    setCurrentMode(null);
    setShowResults(false);
    setLoading(false);
    setValidationLoading(false);
    setIsValidImage(null);
    setValidationMessage("");
    setCanUpload(true);
    setAnalysisPopupMessage(null);
  };

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore stale preview URLs during teardown.
        }
      }
      objectUrlsRef.current.clear();
    };
  }, []);

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
    analysisPopupMessage,
    setShowDrawer,
    handleSampleShortAnalysis,
    handleUploadedImage,
    handleRunAnalysis,
    handleNext,
    handlePrev,
    clearImage,
    dismissAnalysisPopup: () => setAnalysisPopupMessage(null),
  };
};

export default useImageAnalysis;
