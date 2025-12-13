import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Message } from "../services/chat_api";
import MessageBubble from "./MessageBubble";
import "@/assets/styles/Messages.css";

interface Props {
  messages: Message[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  onLastAssistantRendered?: (lastAssistant: Message) => void; // fired only when the last assistant bubble has fully settled
  morePrompt?: { question: string; prompt?: string } | null;
  confirmMoreYes?: () => Promise<void> | void;
  confirmMoreNo?: () => void;
}

type MaybeMedia = {
  type?: "text" | "image" | "audio";
  url?: string;
  filename?: string;
};

export default function MessageList({
  messages,
  scrollerRef,
  onLastAssistantRendered,
  morePrompt = null,
  confirmMoreYes = () => { },
  confirmMoreNo = () => { },
}: Props) {
  const lastAssistantRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantMsgRef = useRef<Message | null>(null);
  const rafRef = useRef<number | null>(null);

  // Always keep scroll pinned to bottom on commit
  useLayoutEffect(() => {
    const el = scrollerRef?.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, scrollerRef]);

  const waitForSettled = (
    node: HTMLElement,
    container: HTMLElement,
    msgIndex: number,
    onSettled: () => void
  ) => {
    const imgs = Array.from(node.querySelectorAll("img"));
    const pendingImgs = imgs.filter((im) => !im.complete);

    let lastH = -1;
    let sameCount = 0;

    const atBottom = () =>
      Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) <= 2;

    const isStillTyping = () =>
      !!node.querySelector('[data-typing="true"]');

    const cleanup = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const trackRAF = () => {
      rafRef.current = requestAnimationFrame(() => {
        // If a new message arrived, abort; outer effect will re-run for the new last node
        const latestIdx = Number(node.getAttribute("data-idx") ?? msgIndex);
        if (latestIdx !== msgIndex) {
          cleanup();
          return;
        }

        const h = node.getBoundingClientRect().height;
        if (h === lastH) sameCount += 1;
        else {
          sameCount = 0;
          lastH = h;
        }

        if (sameCount >= 2 && atBottom() && !isStillTyping()) {
          onSettled();
          cleanup();
        } else {
          trackRAF();
        }
      });
    };

    if (pendingImgs.length === 0) {
      trackRAF();
    } else {
      let loaded = 0;
      const onDone = () => {
        loaded += 1;
        if (loaded >= pendingImgs.length) trackRAF();
      };
      for (const im of pendingImgs) {
        im.addEventListener("load", onDone, { once: true });
        im.addEventListener("error", onDone, { once: true });
      }
    }

    return cleanup;
  };

  // Resolve and observe the last assistant bubble, then call the callback only when settled
  useEffect(() => {
    if (!onLastAssistantRendered) return;

    const last = messages[messages.length - 1];
    if (!last || (last.role ?? "").toLowerCase() !== "assistant") return;
    lastAssistantMsgRef.current = last;

    const raf = requestAnimationFrame(() => {
      const container = scrollerRef.current;
      if (!container) return;

      const wrappers = container.querySelectorAll<HTMLDivElement>(
        '.message-wrapper[data-role="assistant"]'
      );
      const lastWrapper = wrappers[wrappers.length - 1] || null;
      lastAssistantRef.current = lastWrapper;

      if (!lastWrapper) return;

      // Use the rendered idx to detect if new messages arrive mid-check
      const idxAttr = lastWrapper.getAttribute("data-idx");
      const msgIndex = idxAttr ? Number(idxAttr) : messages.length - 1;

      // Start watching immediately even if it's typing; the RAF loop waits until typing ends.
      const cleanup = waitForSettled(lastWrapper, container, msgIndex, () => {
        if (lastAssistantMsgRef.current) {
          onLastAssistantRendered(lastAssistantMsgRef.current);
        }
      });

      // ensure cleanup on re-run/unmount
      return cleanup;
    });

    return () => {
      cancelAnimationFrame(raf);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [messages, onLastAssistantRendered, scrollerRef]);

  // helper to decide whether a message contains the "ask more" prompt
  const messageIncludesAskMore = (content: string | undefined) => {
    if (!content) return false;
    return content.toLowerCase().includes("would you like to know more");
  };

  // robust detection whether this assistant bubble should show inline quick replies:
  const shouldShowQuickRepliesFor = (content: string | undefined) => {
    if (!content) return false;
    if (!morePrompt) return false;
    const rawContent = content.replace(/\s+/g, " ").trim().toLowerCase();

    // 1) If the backend provided a prompt string to match, try substring match (not strict equality)
    if (typeof morePrompt.prompt === "string" && morePrompt.prompt.trim().length > 0) {
      const normalizedPrompt = morePrompt.prompt.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalizedPrompt && rawContent.includes(normalizedPrompt)) {
        return true;
      }
    }

    // 2) Fallback: detect presence of the phrase in bubble text
    if (messageIncludesAskMore(content)) return true;

    return false;
  };

  return (
    <div className="chat-list" ref={scrollerRef}>
      <div className="content-col">
        {messages.map((m, i) => {
          // ✅ Keep role strongly typed as Message["role"]
          const role: Message["role"] = m.role ?? "assistant";
          // ✅ Separate lowercased string for DOM attributes / CSS hooks
          const roleAttr = String(role).toLowerCase();
          const content = (m.content ?? "") as string;

          let type: MaybeMedia["type"];
          let url: MaybeMedia["url"];
          let filename: MaybeMedia["filename"];

          if ("type" in m) type = (m as { type?: MaybeMedia["type"] }).type;
          if ("url" in m) url = (m as { url?: string }).url;
          if ("filename" in m) filename = (m as { filename?: string }).filename;

          const isAssistant = role === "assistant";
          const includesAskMore = isAssistant && shouldShowQuickRepliesFor(content);

          return (
            <div
              key={i}
              className="message-wrapper"
              data-role={roleAttr}
              data-idx={i}
            >
              <MessageBubble
                role={role}
                content={content}
                type={type}
                url={url}
                filename={filename}
              />

              <div className={`ask-more-container ${morePrompt ? "show" : ""}`}>
                {includesAskMore && morePrompt && (
                  <div className="quick-replies inline-quick-replies" aria-live="polite">
                    <div className="quick-replies-row">
                      <button
                        type="button"
                        className="chip"
                        onClick={async () => {
                          try {
                            await confirmMoreYes?.();
                          } catch (err) {
                            console.error("confirmMoreYes error", err);
                          }
                        }}
                      >
                        Yes
                      </button>

                      <button
                        type="button"
                        className="chip"
                        onClick={() => {
                          try {
                            confirmMoreNo?.();
                          } catch (err) {
                            console.error("confirmMoreNo error", err);
                          }
                        }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
