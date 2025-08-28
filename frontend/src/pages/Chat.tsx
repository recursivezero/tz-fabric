import { useCallback } from "react";
import "../styles/chat.css";
import useChat from "../hooks/chat";
import MessageList from "../components/messageList";
import Composer from "../components/composer";
import EmptyState from "../components/emptyState";
import TypingIndicator from "../components/typingIndicator";

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
    } = useChat();

    const pickSample = useCallback(
        (text: string) => {
            setInput(text);
        },
        [setInput]
    );

    return (
        <div className="chat-page">
            <button className="link" onClick={newChat}>
                New Chat
            </button>

            {messages.length === 0 ? (
                <EmptyState onPick={pickSample} />
            ) : (
                <MessageList messages={messages} scrollerRef={scrollerRef} />
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
            />
        </div>
    );
}
