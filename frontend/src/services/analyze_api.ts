import { FULL_API_URL } from "../constants";

export async function analyzeImage(file, analysisType) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("analysis_type", analysisType);

  try {
    const res = await fetch(`${FULL_API_URL}/analyse`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      let backendMessage = "";
      try {
        const data = await res.json();
        backendMessage = data?.detail || data?.error || data?.message || "";
      } catch {
        backendMessage = "";
      }

      if (res.status === 503) {
        throw new Error(
          backendMessage || "Server unavailable — check your network.",
        );
      }
      if (res.status === 400) {
        throw new Error(
          backendMessage ||
            "Invalid image — please upload a proper fabric image.",
        );
      }
      if (res.status === 500) {
        throw new Error(
          backendMessage || "Server error during analysis — try again later.",
        );
      }

      throw new Error(backendMessage || `Unexpected error (${res.status})`);
    }

    const data = await res.json();
    const text = data?.response?.response;
    if (!text) {
      // Keep this message actionable. In normal cases the backend now returns a
      // local fallback instead of an empty response, so this only appears for a
      // genuinely malformed server payload.
      throw new Error(
        "The server returned an empty analysis. Please retry or restart the backend.",
      );
    }
    return data;
  } catch (err) {
    console.error("Error analyzing image:", err);
    if (err instanceof TypeError) {
      throw new Error("Cannot reach the server. Check your network");
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Cannot reach the server. Check your network");
  }
}

export async function regenerateResponse(cache_key: string, index: string) {
  try {
    const res = await fetch(
      `${FULL_API_URL}/regenerate?key=${encodeURIComponent(cache_key)}&index=${encodeURIComponent(index)}`,
      {
        method: "GET",
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof data?.detail === "string"
          ? data.detail
          : typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
              ? data.error
              : `Regenerate failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  } catch (error) {
    console.error("failed to regenerate to other responses", error);
    if (error instanceof Error) throw error;
    throw new Error("Unable to generate another response.");
  }
}

export async function validateImageAPI(imageFile) {
  const formData = new FormData();
  formData.append("image", imageFile);

  try {
    const res = await fetch(`${FULL_API_URL}/validate-image`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 503)
        throw new Error("Validation service unavailable — check server.");
      if (res.status === 500) throw new Error("Validation failed on server.");
      if (res.status === 400) throw new Error("Invalid image file.");
      throw new Error(`Unexpected error (${res.status})`);
    }

    return await res.json();
  } catch (err) {
    console.error("Error validating image:", err);
    if (err instanceof TypeError) {
      throw new Error("Cannot reach the server. Check your network.");
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Cannot reach the server. Check your network.");
  }
}
