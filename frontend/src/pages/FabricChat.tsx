import { useCallback, useEffect } from "react";
import Composer from "../components/Composer";
import EmptyState from "../components/EmptyState";
import HandleRedirectAction from "../components/HandleRedirectAction";
import MessageList from "../components/MessageList";
import TypingIndicator from "../components/TypingIndicator";
import useChat from "../hooks/chat";
import "../styles/FabricChat.css";
import { jsPDF } from "jspdf";

type ChatDisplayMessage = { id?: string; role?: string; content?: unknown };

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
    morePrompt,
    confirmMoreYes,
    confirmMoreNo,
    onAssistantRendered,
    stopGenerating,
    isFrontendTyping,
  } = useChat();

  const isLanding =
    messages.length === 0 ||
    (messages.length === 1 && (messages as ChatDisplayMessage[])[0]?.id === "welcome");

  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const target = e.target as HTMLElement | null;
    const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    const url = href.startsWith("/")
      ? new URL(href, window.location.origin).toString()
      : href;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

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
      const exportables = (messages as ChatDisplayMessage[]).filter(m => m.id !== "welcome");
      if (exportables.length === 0) return;

      const doc = new jsPDF();
      let y = 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(16); doc.text("Chat Export", 10, y); y += 10;
      doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 10, y); y += 10;

      if (uploadedPreviewUrl) {
        const imgData = await fileToDataUrl(uploadedPreviewUrl);
        if (imgData) { doc.addImage(imgData, "JPEG", 10, y, 60, 60); y += 70; }
      }
      if (uploadedAudioUrl) {
        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Attached Audio:", 10, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.text(uploadedAudioUrl, 10, y); y += 10;
      }

      doc.setFontSize(12); doc.text("----------------------------", 10, y); y += 10;

      exportables.forEach((m) => {
        const role = String(m.role ?? "unknown").toUpperCase();
        const content = contentToString(m.content);
        doc.setFont("helvetica", "bold"); doc.text(`${role}:`, 10, y); y += 6;
        doc.setFont("helvetica", "normal");
        const clean = content.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\u2011|\uFFFD)/g, "");
        const split = doc.splitTextToSize(clean, 180);
        doc.text(split, 10, y); y += split.length * 6 + 8;
        if (y > 270) { doc.addPage(); y = 10; }
      });

      const filename = `chat-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("downloadChat (PDF) failed:", err);
    }
  }, [messages, uploadedPreviewUrl, uploadedAudioUrl, fileToDataUrl]);

  useEffect(() => { }, []);

  const downloadDisabled =
    messages.length === 0 ||
    (messages.length === 1 && (messages as ChatDisplayMessage[])[0]?.id === "welcome");

  return (
    <div className={`page-root ${isLanding ? "is-empty" : ""}`}>
      <div className="chat-card-topbar">
        <div className="chat-card-title">
          <div className="avatar-sm">FI</div>
          <div className="title-text">
            <div className="main">FabricAI Assistant</div>
            <div className="status-dot" title="online" />
          </div>
        </div>

        <div className="chat-card-actions">
          <button className="btn btn-secondary" onClick={newChat}>New Chat</button>
          <button className="btn btn-ghost" onClick={downloadChat} disabled={downloadDisabled}>
            Download Chat
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="chat-body">
        <div className="chat-scroll-area" onClick={handleLinkClick}>
          <EmptyState onSend={send} disabled={!!(uploadedPreviewUrl || uploadedAudioUrl)} />

          <MessageList
            messages={messages}
            scrollerRef={scrollerRef}
            onLastAssistantRendered={onAssistantRendered}
            morePrompt={morePrompt}
            confirmMoreYes={confirmMoreYes}
            confirmMoreNo={confirmMoreNo}
          />

          {pendingAction?.action?.type === "redirect_to_analysis" && (
            <HandleRedirectAction
              pendingAction={pendingAction}
              onAccept={acceptAction}
              onReject={rejectAction}
            />
          )}

          {(status === "sending" || isFrontendTyping) && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <TypingIndicator
                text={
                  status === "validating"
                    ? "Validating image…"
                    : isFrontendTyping
                      ? "Generating response…"
                      : "Bot is thinking…"
                }
              />
            </div>
          )}

          {error && <div className="error">{error} "Please try again"</div>}
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
          status={status}
          stopGenerating={stopGenerating}
          isFrontendTyping={isFrontendTyping}
        />
      </div>
    </div>
  );
}
