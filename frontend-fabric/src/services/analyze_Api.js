export async function analyzeImage(file, analysisType) {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("analysis_type", analysisType);

  try {
    const res = await fetch("http://localhost:8000/api/analyse", {
      method: "POST",
      body: formData,
    });

    console.log("Status:", res.status); 
    const data = await res.json();
    console.log("Received:", data);     

    return data;
  } catch (error) {
    console.error("Error while fetching:", error);
    throw error;
  }
}

export async function regenerateresposne(cachekey, index) {
    try{
      const res = await fetch(`http://localhost:8000/api/regenerate?key=${cachekey}&index=${index}`)
      const data = await res.json();
      return data
    } catch(error){
      console.error("failed to regenerate to other responses", error)
    }
    return null;
}

export async function validateImageAPI(imageFile) {
  const formData = new FormData();
  formData.append("image", imageFile);

  try {
    const res = await fetch("http://localhost:8000/api/validate-image", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Validation error:", error);
    throw new Error("Error validating image.");
  }
};