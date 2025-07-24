import { useState, useEffect } from "react";
import { fetchImageAsFile } from "../utils/imageUtils";
import { analyzeImage, regenerateresposne, validateImageAPI } from "../services/analyze_Api";

const useImageAnalysis = () => {
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [cacheKey, setCacheKey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentFile, setCurrentFile] = useState(null);
  const [currentMode, setCurrentMode] = useState(null);
  const [showUploadedImage, setShowUploadedImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [sampleImageUrl, setSampleImageUrl] = useState(null);
  const [showDrawer, setShowDrawer] = useState(true);
  const [typedText, setTypedText] = useState("");
  const [isValidImage, setIsValidImage] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [canUpload, setCanUpload] = useState(true);

  useEffect(() => {
    if (currentIndex !== 0 || !description) return;

    let index = 0;
    setTypedText("");

    const interval = setInterval(() => {
      setTypedText((prev) => prev + description.charAt(index));
      index++;
      if (index >= description.length) {
        clearInterval(interval);
        setCanUpload(true);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [description, currentIndex]);

  const handleSampleShortAnalysis = async (imagePath) => {
    setShowDrawer(false);
    setSampleImageUrl(imagePath);
    setShowResults(true);
    setLoading(true);
    setCanUpload(false);
    try {
      const file = await fetchImageAsFile(imagePath);
      const response = await analyzeImage(file, "short");
      const first = response.first.response;
      const allResponses = Array(6).fill(null);
      allResponses[0] = first;
      setResponses(allResponses);
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

  const validateImage = async (imageFile) => {
  setValidationLoading(true);
  setIsValidImage(null);
  setValidationMessage("");

  try {
    const data = await validateImageAPI(imageFile);

    if (data.valid) {
      setIsValidImage(true);
    } else {
      setIsValidImage(false);
      setValidationMessage("This image doesn't focus on fabric. Please upload a close-up fabric image.");
    }
  } catch (error) {
    setValidationMessage(error.message);
    setIsValidImage(false);
  }

  setValidationLoading(false);
};

  const handleUploadedImage = (file) => {
    setShowDrawer(false);
    setUploadedImageUrl(URL.createObjectURL(file));
    setCurrentFile(file);
    setShowUploadedImage(true);
    setCurrentMode(null);
    setIsValidImage(null);
    setValidationMessage("");
    validateImage(file);
    setDescription("");
    setShowResults(false);
    setResponses([]);
    setDescription("");
    setCacheKey(null);
    setCurrentIndex(0);
    setTypedText("");
  };

  const handleRunAnalysis = async (file, mode) => {
    setShowResults(true);
    setLoading(true);
    setCurrentMode(mode);
    setShowDrawer(false);
    setCanUpload(false);
    try {
      const response = await analyzeImage(file, mode);
      const first = response.first.response;
      const allResponses = Array(6).fill(null);
      allResponses[0] = first;
      setResponses(allResponses);
      setDescription(allResponses[0]);
      setCurrentIndex(0);
      setCacheKey(response.cache_key);
    } catch (err) {
      console.error(`${mode} analysis failed:`, err);
      alert(`${mode} analysis failed.`);
    }
    setLoading(false);
  };

  const handleNext = async () => {
    const newIndex = currentIndex + 1;
    if (responses[newIndex]) {
      setCurrentIndex(newIndex);
      setDescription(responses[newIndex]);
      return;
    }
    try {
      const res = await regenerateresposne(cacheKey, newIndex + 1);
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
    handlePrev
  };
};

export default useImageAnalysis;
