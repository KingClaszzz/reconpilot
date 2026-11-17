import { useEffect } from "react";

// Pages describe what's on screen so the assistant can answer about it.
let current = "";
export const getPageContext = () => current;

export function usePageContext(text: string | null) {
  useEffect(() => {
    if (!text) return;
    current = text;
    return () => {
      if (current === text) current = "";
    };
  }, [text]);
}
