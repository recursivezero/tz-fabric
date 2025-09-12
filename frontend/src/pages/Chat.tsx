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
    retryLast,
    newChat,
    scrollerRef,
    uploadedPreviewUrl,
    handleUpload,
    clearUpload,
    pendingAction,
    acceptAction,
    rejectAction,
  } = useChat();

  const pickSample = useCallback((text: string) => setInput(text), [setInput]);
  console.log("Pending action:", pendingAction);

  return (
    <div className="chat-page">
      <button className="link" onClick={newChat}>New Chat</button>

      {messages.length === 0 ? (
        <EmptyState onPick={pickSample} />
      ) : (
        <MessageList messages={messages} scrollerRef={scrollerRef} />
      )}

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

      <Composer
        value={input}
        onChange={setInput}
        onSend={send}
        disabled={status === "sending"}
        onUpload={handleUpload}
        previewUrl={uploadedPreviewUrl}
        onClearUpload={clearUpload}
      />
    </div>
  );
}
