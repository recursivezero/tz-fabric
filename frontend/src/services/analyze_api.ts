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
      if (res.status === 503) {
        throw new Error("Server unavailable — check your network");
      }
      if (res.status === 400) {
        throw new Error("Invalid image — please upload a proper fabric image.");
      }
      if (res.status === 500) {
        throw new Error("Server error during analysis — try again later.");
      }

      throw new Error(`Unexpected error (${res.status})`);
    }

    return await res.json();

  } catch (err) {
    throw new Error("Cannot reach the server. Check your network");
  }
}

export async function regenerateResponse(cache_key:string, index:string) {
  try {
    const res = await fetch(
      `${FULL_API_URL}/regenerate?key=${cache_key}&index=${index}`,
      {
        method: "GET",
      },
    );
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("failed to regenerate to other responses", error);
  }
  return null;
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
      if (res.status === 503) throw new Error("Validation service unavailable — check server.");
      if (res.status === 500) throw new Error("Validation failed on server.");
      if (res.status === 400) throw new Error("Invalid image file.");
      throw new Error(`Unexpected error (${res.status})`);
    }

    return await res.json();

  } catch (err) {
    throw new Error("Cannot reach the server. Check your network.");
  }
}

