// src/pages/Chat.tsx
import { useCallback } from "react";
import "../styles/chat.css";
import useChat from "../hooks/chat";
import MessageList from "../components/messageList";
import Composer from "../components/composer";
import EmptyState from "../components/emptyState";
import TypingIndicator from "../components/typingIndicator";
import HandleRedirectAction from "../components/handleRedirectAction";

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
    stop
  } = useChat();

  const pickSample = useCallback((text: string) => setInput(text), [setInput]);

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
              <button className="download-link">Download Chat</button>
            </div>
          </div>

          <div className="chat-body">
            <div className="chat-scroll-area">
              {/* Always show the EmptyState (examples / chips) above the message stream */}
              <EmptyState onPick={pickSample} />

              {/* MessageList shows the actual conversation bubbles.
                  Your useChat hook should inject the assistant welcome message
                  into messages when appropriate. */}
              <MessageList messages={messages} scrollerRef={scrollerRef} />

              {pendingAction && (
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
              onStop={stop}
              disabled={status === "sending"}
              onUpload={handleImageUpload}
              onAudioUpload={handleAudioUpload}
              previewUrl={uploadedPreviewUrl}
              audioUrl={uploadedAudioUrl}
              onClearUpload={clearImage}
              onClearAudio={clearAudio}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
