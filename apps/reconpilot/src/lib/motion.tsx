import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const GLYPHS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789#%&/+=<>";

export function useInView<T extends Element>(margin = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!("IntersectionObserver" in window)) return setSeen(true);
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen] as const;
}

// Scrambles into the real text left to right. Screen readers get the real text via aria-label.
export function Decode({ text, as: Tag = "span", delay = 0, speed = 28, className }: { text: string; as?: ElementType; delay?: number; speed?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLElement>();
  const [out, setOut] = useState(() => (reducedMotion() ? text : text.replace(/\S/g, " ")));
  useEffect(() => {
    if (!seen) return;
    if (reducedMotion()) return setOut(text);
    let frame = 0;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, now - start);
      const settled = Math.floor(t / speed);
      frame++;
      setOut(
        [...text]
          .map((ch, i) => {
            if (ch === " " || i < settled) return ch;
            if (i > settled + 6) return " ";
            return frame % 2 ? GLYPHS[(i * 7 + frame) % GLYPHS.length] : GLYPHS[(i * 13 + frame * 3) % GLYPHS.length];
          })
          .join(""),
      );
      if (settled < text.length) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, text, delay, speed]);
  return (
    <Tag ref={ref} className={`decode ${className ?? ""}`} aria-label={text}>
      <span aria-hidden>{out}</span>
    </Tag>
  );
}

export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en"), duration = 900, className }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>("0px");
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!seen) return;
    if (reducedMotion()) return setShown(value);
    const a = from.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration]);
  return (
    <span ref={ref} className={className}>
      {format(seen || reducedMotion() ? shown : 0)}
    </span>
  );
}

export function Reveal({ children, as: Tag = "div", className, stagger = 70 }: { children: ReactNode; as?: ElementType; className?: string; stagger?: number }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <Tag ref={ref} className={`reveal ${seen ? "in" : ""} ${className ?? ""}`} style={{ ["--stagger" as string]: `${stagger}ms` }}>
      {children}
    </Tag>
  );
}
