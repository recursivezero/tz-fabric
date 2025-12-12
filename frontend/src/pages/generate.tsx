import { useState } from "react";
import { FULL_API_URL, BASE_URL } from "@/constants";

const Generate = () => {
  const [singleImage, setSingleImage] = useState<File | null>(null);
  const [groupImage, setGroupImage] = useState<File | null>(null);
  const [mode, setMode] = useState("Fabric Mask (Smooth Blend)");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);

  const previewSingle = singleImage ? URL.createObjectURL(singleImage) : null;
  const previewGroup = groupImage ? URL.createObjectURL(groupImage) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResponse(null);

    if (!singleImage || !groupImage) {
      setError("Both single and group images must be uploaded.");
      return;
    }

    const formData = new FormData();
    formData.append("single_image", singleImage);
    formData.append("group_image", groupImage);
    formData.append("mode", mode);

    setLoading(true);

    try {
      const res = await fetch(`${FULL_API_URL}/generate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setResponse(json);
    } catch (err: any) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 40, maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "3rem", fontWeight: 700, marginBottom: 20 }}>
        Fabric Generator
      </h1>

      <form onSubmit={handleSubmit}>

        {/* MODE */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 600 }}>Mode:</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{
              marginLeft: 10,
              padding: "6px 12px",
              fontSize: "1rem",
              borderRadius: "6px",
            }}
          >
            <option>Fabric Mask (Smooth Blend)</option>
            <option>Hue Shift (HSV)</option>
          </select>
        </div>

        {/* IMAGE INPUTS */}
        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <label style={{ fontWeight: 600 }}>Single Image:</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSingleImage(e.target.files?.[0] || null)}
            />
            {previewSingle && (
              <img
                src={previewSingle}
                style={{
                  width: 180,
                  marginTop: 10,
                  borderRadius: 10,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                }}
              />
            )}
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Group Image:</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setGroupImage(e.target.files?.[0] || null)}
            />
            {previewGroup && (
              <img
                src={previewGroup}
                style={{
                  width: 180,
                  marginTop: 10,
                  borderRadius: 10,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                }}
              />
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 25,
            padding: "12px 24px",
            fontSize: "1.2rem",
            fontWeight: 600,
            background: "black",
            color: "white",
            borderRadius: 8,
          }}
        >
          {loading ? "Processing…" : "Generate"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: 20 }}>{error}</p>}

      {/* RESULTS */}
      {response && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: "2rem", marginBottom: 20 }}>
            Generated Outputs
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 20,
            }}
          >
            {response.generated_images?.map((img: string, i: number) => {
              const url = `${BASE_URL}/generated/${response.parent_folder}/${img}`;
              return (
                <div
                  key={i}
                  style={{
                    padding: 10,
                    background: "#1a1a1a",
                    borderRadius: 10,
                  }}
                >
                  <img
                    src={url}
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      objectFit: "cover",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Generate;
