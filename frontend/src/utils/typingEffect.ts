// src/utils/typingEffect.ts
import { useEffect, useRef, useState } from "react";


export default function useTypingEffect(text: string, speed: number = 30) {
  const [displayedText, setDisplayedText] = useState("");
  const timerRef = useRef<number | null>(null);
  const prevTextRef = useRef<string>("");
  const stoppedRef = useRef(false);
  const currentIndexRef = useRef(0); 

  useEffect(() => {
    if (prevTextRef.current === text) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stoppedRef.current = false;
    currentIndexRef.current = 0;
    setDisplayedText("");

    if (!text || text.length <= 1) {
      setDisplayedText(text || "");
      window.dispatchEvent(new CustomEvent("fabricai:typing-end"));
      prevTextRef.current = text;
      return;
    }

    window.dispatchEvent(new CustomEvent("fabricai:typing-start"));

    timerRef.current = window.setInterval(() => {
      if (stoppedRef.current) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        window.dispatchEvent(new CustomEvent("fabricai:typing-end"));
        prevTextRef.current = text;
        return;
      }

      const nextIndex = currentIndexRef.current + 1;
      setDisplayedText(text.slice(0, nextIndex));
      currentIndexRef.current = nextIndex;

      if (nextIndex >= text.length) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        window.dispatchEvent(new CustomEvent("fabricai:typing-end"));
        prevTextRef.current = text;
      }
    }, Math.max(5, speed));

    const onStop = () => {
      stoppedRef.current = true;
    };
    window.addEventListener("fabricai:stop-typing", onStop);

    return () => {
      window.removeEventListener("fabricai:stop-typing", onStop);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, speed]);

  return displayedText;
}
