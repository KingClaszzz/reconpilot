import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "../lib/motion";

const LINES = ["All 39 matched!", "Only 10 need a person.", "Kane checked this page.", "Close the month, not the laptop."];

// Critically-damped-ish spring step: returns [position, velocity].
const step = (x: number, v: number, target: number, k: number, damp: number) => {
  v = (v + (target - x) * k) * damp;
  return [x + v, v] as const;
};
const clamp = (n: number, lim: number) => Math.max(-lim, Math.min(lim, n));

// Idles like it's alive (sways, breathes, glances around), follows the cursor,
// and does a small happy wiggle when clicked.
function animate(el: HTMLElement, kick: { current: () => void }) {
  const body = el.firstElementChild as HTMLElement;
  let tx = 0, ty = 0, hover = 0, raf = 0, moved = 0, glance = 0, side = 1;
  let rx = 0, vrx = 0, ry = 0, vry = 0, h = 0, vh = 0, hop = 0, vhop = 0, sq = 0, vsq = 0, wob = 0, vwob = 0;

  const frame = (t: number) => {
    if (t - moved > 2500 && t > glance) {
      [tx, ty] = Math.random() < 0.3 ? [0, 0] : [(Math.random() * 2 - 1) * 10, (Math.random() * 2 - 1) * 5];
      glance = t + 1600 + Math.random() * 2400;
    }
    [rx, vrx] = step(rx, vrx, tx, 0.05, 0.84);
    [ry, vry] = step(ry, vry, ty, 0.05, 0.84);
    [h, vh] = step(h, vh, hover, 0.08, 0.8);
    [wob, vwob] = step(wob, vwob, 0, 0.12, 0.86);
    if (hop < 0 || vhop < 0) {
      vhop += 0.5;
      hop += vhop;
      if (hop >= 0) [hop, vhop, vsq] = [0, 0, vsq + 0.06];
    }
    [sq, vsq] = step(sq, vsq, 0, 0.2, 0.75);
    const sway = Math.sin(t / 1300) * 1.6, bob = Math.sin(t / 800) * 1.5, breathe = Math.sin(t / 650) * 0.014;
    body.style.transform = `translateY(${hop + bob - 4 * h}px) rotateX(${-ry}deg) rotateY(${rx}deg) rotate(${rx * 0.25 + sway + wob}deg) scale(${1 + sq + 0.03 * h}, ${1 - sq + breathe + 0.03 * h})`;
    raf = requestAnimationFrame(frame);
  };
  const look = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    moved = performance.now();
    tx = clamp(((e.clientX - r.left - r.width / 2) / innerWidth) * 44, 16);
    ty = clamp(((e.clientY - r.top - r.height / 2) / innerHeight) * 30, 11);
  };
  const rest = () => (moved = 0);
  const enter = () => (hover = 1);
  const leave = () => (hover = 0);
  kick.current = () => {
    if (hop === 0) vhop = -3.2;
    vwob += 2.6 * (side = -side);
    vsq -= 0.04;
  };

  addEventListener("pointermove", look);
  document.addEventListener("pointerleave", rest);
  el.addEventListener("pointerenter", enter);
  el.addEventListener("pointerleave", leave);
  // only animate while on screen
  const io = new IntersectionObserver(([e]) => {
    cancelAnimationFrame(raf);
    if (e.isIntersecting) raf = requestAnimationFrame(frame);
  });
  io.observe(el);
  return () => {
    io.disconnect();
    cancelAnimationFrame(raf);
    removeEventListener("pointermove", look);
    document.removeEventListener("pointerleave", rest);
    el.removeEventListener("pointerenter", enter);
    el.removeEventListener("pointerleave", leave);
  };
}

export function Mascot({ className = "", size = 160, eager = false, interactive = false }: { className?: string; size?: number; eager?: boolean; interactive?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const kick = useRef(() => {});
  const said = useRef(-1);
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (interactive && ref.current && !reducedMotion()) return animate(ref.current, kick);
  }, [interactive]);
  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => setLine(null), 2600);
    return () => clearTimeout(t);
  }, [line]);

  const picture = (
    <picture className={interactive ? "mascot-body" : `mascot ${className}`}>
      <source srcSet="/brand/mascot.webp" type="image/webp" />
      <img src="/brand/mascot.png" alt="" width={size} height={Math.round(size * 1.17)} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />
    </picture>
  );
  if (!interactive) return picture;

  return (
    <button
      ref={ref}
      type="button"
      className={`mascot mascot-live ${className}`}
      aria-label="ReconPilot mascot. Click to say hi"
      onClick={() => {
        kick.current();
        said.current = (said.current + 1) % LINES.length;
        setLine(LINES[said.current]);
      }}
    >
      {picture}
      {line && <span key={said.current} className="mascot-bubble" role="status">{line}</span>}
    </button>
  );
}
