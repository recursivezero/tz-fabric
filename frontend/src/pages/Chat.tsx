// src/pages/Chat.tsx
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Composer from "../components/Composer";
import EmptyState from "../components/EmptyState";
import HandleRedirectAction from "../components/HandleRedirectAction";
import MessageList from "../components/MessageList";
import TypingIndicator from "../components/TypingIndicator";
import useChat from "../hooks/chat";
import "../styles/Chat.css";
import { jsPDF } from "jspdf";

type ChatDisplayMessage = { role?: string; content: unknown };

const contentToString = (value: unknown): string => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export default function Chat() {
  const {
    messages,
    input,
    setInput,
    status,
    error,
    send,
    newChat,
    retryLast,
    scrollerRef,
    uploadedPreviewUrl,
    uploadedAudioUrl,
    handleImageUpload,
    handleAudioUpload,
    clearImage,
    clearAudio,
    pendingAction,
    acceptAction,
    rejectAction,
    fileName,
    setFileName,
    shouldNavigateToList,
    setShouldNavigateToList,
  } = useChat();

  const navigate = useNavigate();

  const pickSample = useCallback((text: string) => setInput(text), [setInput]);

  const fileToDataUrl = useCallback(async (url: string): Promise<string | null> => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error("fileToDataUrl failed", err);
      return null;
    }
  }, []);

  const downloadChat = useCallback(async () => {
    try {
      const doc = new jsPDF();
      let y = 10;

      doc.setFont("helvetica", "normal");

      doc.setFontSize(16);
      doc.text("Chat Export", 10, y);
      y += 10;

      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 10, y);
      y += 10;

      if (uploadedPreviewUrl) {
        const imgData = await fileToDataUrl(uploadedPreviewUrl);
        if (imgData) {
          doc.addImage(imgData, "JPEG", 10, y, 60, 60);
          y += 70;
        }
      }

      if (uploadedAudioUrl) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Attached Audio:", 10, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.text(uploadedAudioUrl, 10, y);
        y += 10;
      }

      doc.setFontSize(12);
      doc.text("----------------------------", 10, y);
      y += 10;

      (messages as ChatDisplayMessage[]).forEach((m) => {
        const role = String(m.role ?? "unknown").toUpperCase();
        const content = contentToString(m.content);

        doc.setFont("helvetica", "bold");
        doc.text(`${role}:`, 10, y);
        y += 6;

        doc.setFont("helvetica", "normal");
        const cleanContent = content.replace(
          /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\u2011|\uFFFD)/g,
          ""
        );
        const splitText = doc.splitTextToSize(cleanContent, 180);
        doc.text(splitText, 10, y);
        y += splitText.length * 6 + 8;

        if (y > 270) {
          doc.addPage();
          y = 10;
        }
      });

      const filename = `chat-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("downloadChat (PDF) failed:", err);
    }
  }, [messages, uploadedPreviewUrl, uploadedAudioUrl, fileToDataUrl]); 

  useEffect(() => {
    if (!shouldNavigateToList) return;
    navigate("/view");
    setShouldNavigateToList(false);
  }, [shouldNavigateToList, navigate, setShouldNavigateToList]);

  return (
    <div className="page-root">
      <header className="page-hero">
        <h1>AI Chat Assistant</h1>
        <p className="subtitle">Discuss your fabric analysis results with our AI expert</p>
      </header>

      <div className="chat-container">
        <div className="chat-card">
          <div className="chat-card-topbar">
            <div className="chat-card-title">
              <div className="avatar-sm">FI</div>
              <div className="title-text">
                <div className="main">FabricAI Assistant</div>
                <div className="status-dot" title="online" />
              </div>
            </div>
            <button onClick={newChat}>New Chat</button>
            <div className="chat-card-actions">
              <button className="download-link" onClick={downloadChat}>Download Chat</button>
            </div>
          </div>

          <div className="chat-body">
            <div className="chat-scroll-area">
              <EmptyState onPick={pickSample} />

              <MessageList messages={messages} scrollerRef={scrollerRef} />

              {pendingAction?.action?.type === "redirect_to_analysis" && (
                <HandleRedirectAction
                  pendingAction={pendingAction}
                  onAccept={acceptAction}
                  onReject={rejectAction}
                />
              )}

              {status === "sending" && <TypingIndicator />}

              {error && (
                <div className="error">
                  {error} <button onClick={retryLast}>Retry</button>
                </div>
              )}
            </div>

            <Composer
              value={input}
              onChange={setInput}
              onSend={send}
              disabled={status === "sending"}
              onUpload={handleImageUpload}
              onAudioUpload={handleAudioUpload}
              previewUrl={uploadedPreviewUrl}
              audioUrl={uploadedAudioUrl}
              onClearUpload={clearImage}
              onClearAudio={clearAudio}
              fileName={fileName}
              setFileName={setFileName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
