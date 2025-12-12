import React, { useEffect, useRef, useState } from "react";
import { FULL_API_URL, BASE_URL } from "@/constants";

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
};

type StageType=keyof Stage;

const FabricGen
: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "👋 Welcome! Let's transform your fabric. Upload your *single fabric image* to begin.",
      fileUpload: true,
    },
  ]);

  const [stage, setStage] = useState<StageType>(Stage.AskSingle);

  const [singleImage, setSingleImage] = useState<File | null>(null);
  const [groupImage, setGroupImage] = useState<File | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const append = (msg: ChatMessage) => setMessages((m) => [...m, msg]);

  useEffect(() => {
    chatBoxRef.current?.scrollTo({
      top: chatBoxRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  const showTyping = () => {
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 800);
  };

  // ---------------------------
  // FILE UPLOAD HANDLERS
  // ---------------------------
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (stage === Stage.AskSingle) {
      setSingleImage(file);
      append({ role: "user", text: `📄 Selected single: ${file.name}` });

      showTyping();
      setTimeout(() => {
        append({
          role: "bot",
          text: "Great! Now upload your *group fabric image*. This provides the color palette.",
          fileUpload: true,
        });
      }, 700);

      setStage(Stage.AskGroup);
    }

    if (stage === Stage.AskGroup) {
      setGroupImage(file);
      append({ role: "user", text: `📄 Selected group: ${file.name}` });

      showTyping();
      setTimeout(() => {
        append({
          role: "bot",
          text: "Choose your generation mode:",
          buttons: ["Fabric Mask (Smooth Blend)", "Hue Shift (HSV)"],
        });
      }, 700);

      setStage(Stage.AskMode);
    }
  };

  // ---------------------------
  // UPLOAD TEMP TO BACKEND
  // ---------------------------
  const uploadTemp = async (single: File, group: File, mode: string) => {
    const fd = new FormData();
    fd.append("single_image", single);
    fd.append("group_image", group);

    const res = await fetch(`${FULL_API_URL}/upload_temp`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    setSessionId(data.session_id);

    return data;
  };

  // ---------------------------
  // MODE SELECTION
  // ---------------------------
  const handleModeSelect = async (mode: string) => {
    append({ role: "user", text: `🎛 Mode selected: ${mode}` });

    showTyping();
    setTimeout(() => {
      append({
        role: "bot",
        text: "Uploading your images…",
      });
    }, 500);

    const temp = await uploadTemp(singleImage!, groupImage!, mode);

    showTyping();
    setTimeout(() => {
      append({ role: "bot", text: "Preparing generation engine… ⚙️" });
    }, 500);

    startWebSocket(temp.session_id, temp.single_filename, temp.group_filename, mode);
    setStage(Stage.Generating);
  };

  // ---------------------------
  // WEBSOCKET PROCESS
  // ---------------------------
  const startWebSocket = (
    session_id: string,
    single_filename: string,
    group_filename: string,
    mode: string
  ) => {

    const backendWs =
      BASE_URL.startsWith("https")
        ? BASE_URL.replace("https", "wss")
        : BASE_URL.replace("http", "ws");

    const wsUrl = `${backendWs}/api/v1/ws/chat`;
    console.log("WS URL:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WS OPEN");

      ws.send(
        JSON.stringify({
          type: "start",
          session_id,
          single_filename,
          group_filename,
          mode,
        })
      );
    };

    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);

      if (data.type === "status") {
        append({ role: "bot", text: `⏳ ${data.message}` });
      }

      if (data.type === "error") {
        append({ role: "bot", text: `❌ ${data.message}` });
      }

      if (data.type === "done") {
        const urls = data.images.map((p: string) => `${BASE_URL}${p}`);
        append({
          role: "bot",
          text: "🎉 Done! Here are your fabric variations:",
          images: urls,
        });
      }
    };
  };

  // ---------------------------
  // UI COMPONENTS
  // ---------------------------
  const Bubble = ({ msg }: { msg: ChatMessage }) => (
    <div
      style={{
        display: "flex",
        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          maxWidth: "65%",
          background: msg.role === "user" ? "#0A84FF" : "#eee",
          color: msg.role === "user" ? "white" : "black",
          padding: "12px 16px",
          borderRadius: 14,
          lineHeight: 1.45,
          fontSize: "0.95rem",
          boxShadow: "0px 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        {msg.text && <div dangerouslySetInnerHTML={{ __html: msg.text }} />}

        {msg.buttons && (
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            {msg.buttons.map((b) => (
              <button
                onClick={() => handleModeSelect(b)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "#222",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {msg.fileUpload && (
          <div style={{ marginTop: 10 }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleFilePicked}
              style={{ cursor: "pointer" }}
            />
          </div>
        )}

        {msg.images && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 12 }}>
            {msg.images.map((src) => (
              <img
                key={src}
                src={src}
                style={{
                  width: 160,
                  height: 160,
                  objectFit: "cover",
                  borderRadius: 10,
                  cursor: "zoom-in",
                  transition: "0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: 20 }}>FabricAI Chat</h1>

      <div
        ref={chatBoxRef}
        style={{
          height: "75vh",
          overflowY: "auto",
          background: "#f8f8f8",
          borderRadius: 12,
          padding: 20,
          border: "1px solid #ddd",
        }}
      >
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} />
        ))}

        {isTyping && (
          <div style={{ opacity: 0.7, marginLeft: 8 }}>FabricAI is thinking…</div>
        )}
      </div>
    </div>
  );
};

export default FabricGen
;
