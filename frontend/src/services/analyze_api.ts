import { FULL_API_URL } from "../constants";
import {
  ensureOk,
  fetchWithTimeout,
  toUserFacingNetworkError,
} from "../utils/http";

export type AnalysisMode = "short" | "long";

export type AnalyzeResponse = {
  response?: {
    response?: string;
    [key: string]: unknown;
  };
  cache_key?: string;
  [key: string]: unknown;
};

export type ValidationResponse = {
  valid?: boolean;
  reason?: string;
  [key: string]: unknown;
};

export async function analyzeImage(
  file: File,
  analysisType: AnalysisMode,
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("analysis_type", analysisType);

  try {
    const response = await fetchWithTimeout(
      `${FULL_API_URL}/analyse`,
      {
        method: "POST",
        body: formData,
      },
      90_000,
    );

    const fallback =
      response.status === 400
        ? "Invalid image — please upload a proper fabric image."
        : response.status === 503
          ? "Analysis service unavailable. Please try again shortly."
          : "Server error during analysis. Please try again later.";
    await ensureOk(response, fallback);

    const data = (await response.json()) as AnalyzeResponse;
    const text = data.response?.response;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(
        "The server returned an empty analysis. Please retry the request.",
      );
    }

    return data;
  } catch (error) {
    throw toUserFacingNetworkError(
      error,
      "Unable to reach the analysis service. Check your connection and try again.",
    );
  }
}

export async function regenerateResponse(
  cacheKey: string,
  index: string,
): Promise<Record<string, unknown>> {
  try {
    const response = await fetchWithTimeout(
      `${FULL_API_URL}/regenerate?key=${encodeURIComponent(cacheKey)}&index=${encodeURIComponent(index)}`,
      { method: "GET" },
      35_000,
    );
    await ensureOk(
      response,
      `Unable to generate another response (${response.status}).`,
    );
    return (await response.json()) as Record<string, unknown>;
  } catch (error) {
    throw toUserFacingNetworkError(
      error,
      "Unable to generate another response. Please try again.",
    );
  }
}

export async function validateImageAPI(
  imageFile: File,
): Promise<ValidationResponse> {
  const formData = new FormData();
  formData.append("image", imageFile);

  try {
    const response = await fetchWithTimeout(
      `${FULL_API_URL}/validate-image`,
      {
        method: "POST",
        body: formData,
      },
      30_000,
    );
    await ensureOk(response, "Unable to validate this image.");
    return (await response.json()) as ValidationResponse;
  } catch (error) {
    throw toUserFacingNetworkError(
      error,
      "Unable to reach the image validation service.",
    );
  }
}
