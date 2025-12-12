import React, { useState, useRef, useEffect } from "react";
import { BASE_URL, FULL_API_URL } from "@/constants";

type ChatMessage = {
  role: "bot" | "user";
  text?: string;
  images?: string[];
  buttons?: string[];
  fileUpload?: boolean;
};

const Stage = {
  AskSingle: "AskSingle",
  AskGroup: "AskGroup",
  AskMode: "AskMode",
  ReadyToGenerate: "ReadyToGenerate",
  Generating: "Generating",
} as const;

type Stage = typeof Stage[keyof typeof Stage];

const FabricGen
: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: "Hi! Upload your *single fabric image* to begin.", fileUpload: true },
  ]);

  const [stage, setStage] = useState<Stage>(Stage.AskSingle);

  const [singleImage, setSingleImage] = useState<File | null>(null);
  const [groupImage, setGroupImage] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  // auto scroll
  useEffect(() => {
    chatBoxRef.current?.scrollTo({
      top: chatBoxRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const append = (msg: ChatMessage) => {
    setMessages((old) => [...old, msg]);
  };

  // ---------------------------
  // FILE UPLOAD HANDLERS
  // ---------------------------

  const handleSingleUpload = (file: File) => {
    setSingleImage(file);
    append({ role: "user", text: `Uploaded single image: ${file.name}` });

    append({
      role: "bot",
      text: "Great! Now upload your *group fabric image*.",
      fileUpload: true,
    });

    setStage(Stage.AskGroup);
  };

  const handleGroupUpload = (file: File) => {
    setGroupImage(file);
    append({ role: "user", text: `Uploaded group image: ${file.name}` });

    append({
      role: "bot",
      text: "Perfect! Now choose a mode:",
      buttons: ["Fabric Mask (Smooth Blend)", "Hue Shift (HSV)"],
    });

    setStage(Stage.AskMode);
  };

  const handleModeSelect = (mode: string) => {
    append({ role: "user", text: `Selected: ${mode}` });

    append({
      role: "bot",
      text: "Uploading your images…",
    });

    uploadTemp(singleImage!, groupImage!, mode);
  };

  // ---------------------------
  // BACKEND: UPLOAD TEMP FILES
  // ---------------------------
  const uploadTemp = async (single: File, group: File, mode: string) => {
    const fd = new FormData();
    fd.append("single_image", single);
    fd.append("group_image", group);

    const res = await fetch(`${FULL_API_URL}/upload_temp`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      append({ role: "bot", text: "Upload failed." });
      return;
    }

    const data = await res.json();
    console.log("UPLOAD RESPONSE:", data);
    setSessionId(data.session_id);

    append({ role: "bot", text: "Images uploaded. Starting generation…" });

    startWebSocket(data.session_id, single.name, group.name, mode);
  };

  // ---------------------------
  // WEBSOCKET HANDLING
  // ---------------------------
  const startWebSocket = (
    session_id: string,
    single_filename: string,
    group_filename: string,
    mode: string
  ) => {
    const backendWs =
      FULL_API_URL.startsWith("https")
        ? FULL_API_URL.replace("https", "wss")
        : FULL_API_URL.replace("http", "ws");

    const wsUrl = `${backendWs}/ws/chat`;
    console.log("WS URL:", wsUrl);


    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;


    ws.onopen = () => {
      console.log("🟢 WS OPEN");

      const payload = {
        type: "start",
        session_id,
        single_filename,
        group_filename,
        mode,
      };

      console.log("📤 Sending START:", payload);

      ws.send(JSON.stringify(payload));
    };

    ws.onerror = (err) => {
      console.log("🔴 WS ERROR:", err);
    };

    ws.onclose = () => {
      console.log("⚪ WS CLOSED");
    };

    ws.onmessage = (ev) => {
      console.log("📩 WS MESSAGE:", ev.data);
      const data = JSON.parse(ev.data);

      if (data.type === "status") append({ role: "bot", text: data.message });
      if (data.type === "error") append({ role: "bot", text: `❌ ${data.message}` });
      if (data.type === "done") {
        const urls = data.images.map((p: string) => `${BASE_URL}${p}`);
        append({ role: "bot", text: "🎉 Done!", images: urls });
      }
    };
  };


  // ---------------------------
  // CHAT UI INTERACTIONS
  // ---------------------------
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (stage === Stage.AskSingle) return handleSingleUpload(file);
    if (stage === Stage.AskGroup) return handleGroupUpload(file);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: "2.4rem", marginBottom: 20 }}>Fabric Chat</h1>

      {/* CHAT WINDOW */}
      <div
        ref={chatBoxRef}
        style={{
          height: "75vh",
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 15,
          overflowY: "auto",
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 15,
              textAlign: m.role === "user" ? "right" : "left",
            }}
          >
            <div
              style={{
                display: "inline-block",
                background: m.role === "user" ? "#0b74ff" : "#eee",
                color: m.role === "user" ? "white" : "black",
                padding: "10px 15px",
                borderRadius: 14,
                maxWidth: "75%",
              }}
            >
              {m.text && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}

              {m.buttons && (
                <div style={{ marginTop: 10 }}>
                  {m.buttons.map((b) => (
                    <button
                      key={b}
                      onClick={() => handleModeSelect(b)}
                      style={{
                        marginRight: 10,
                        padding: "6px 12px",
                        borderRadius: 8,
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}

              {m.images && (
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {m.images.map((src, idx) => (
                    <img
                      key={idx}
                      src={src}
                      style={{
                        width: 150,
                        height: 150,
                        borderRadius: 10,
                        objectFit: "cover",
                      }}
                    />
                  ))}
                </div>
              )}

              {m.fileUpload && (
                <div style={{ marginTop: 10 }}>
                  <input type="file" accept="image/*" onChange={handleFilePicked} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FabricGen
;
