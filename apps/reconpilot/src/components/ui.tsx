import { useState, type ReactNode } from "react";
import { STATUS_LABEL, type Status } from "../recon/match";
import { RESOLUTION_LABEL, type Resolution, type RunStatus } from "../lib/types";
import { CountUp } from "../lib/motion";

const PATHS: Record<string, string> = {
  overview: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  runs: "M4 6h16M4 12h16M4 18h10M18 16l2 2 3-4",
  exceptions: "M12 3l9 16H3zM12 10v4M12 17v.5",
  accounts: "M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M12 3l9 5H3z",
  audit: "M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  out: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  trash: "M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13",
  check: "M5 12.5l4.5 4.5L19 7.5",
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--ink)" />
        <path d="M8 11h9M8 16h6M8 21h9" stroke="var(--paper)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M18.5 17.5l3 3 5-7" stroke="var(--accent-bright)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && <span className="logo-word">ReconPilot</span>}
    </span>
  );
}

export function PageHead({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Kpi({ label, value, format, foot, tone }: { label: string; value: number; format?: (n: number) => string; foot?: ReactNode; tone?: "neg" | "pos" }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className={`kpi-value ${tone ?? ""}`}>
        <CountUp value={value} format={format} />
      </strong>
      {foot && <span className="kpi-foot">{foot}</span>}
    </div>
  );
}

export function StatusChip({ status }: { status: Status }) {
  return (
    <span className={`chip s-${status}`}>
      <i aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ResolutionChip({ r }: { r: Resolution }) {
  if (r === "auto") return <span className="res res-auto">—</span>;
  return <span className={`res res-${r}`}>{RESOLUTION_LABEL[r]}</span>;
}

export function RunStatusChip({ s }: { s: RunStatus }) {
  return s === "closed" ? (
    <span className="run-chip closed">
      <Icon name="lock" size={13} /> Closed
    </span>
  ) : (
    <span className="run-chip review">
      <i aria-hidden /> In review
    </span>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Progress({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total ? (done / total) * 100 : 100;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label ?? "Progress"}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function formatPeriod(p: string, long = false) {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en", { month: long ? "long" : "short", year: "numeric", timeZone: "UTC" });
}

export function timeAgo(iso: string) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "min"], [3600, "h"], [86400, "d"], [86400 * 30, "mo"]];
  let label = "";
  for (const [secs, u] of units) if (s >= secs) label = `${Math.floor(s / secs)}${u === "min" ? " min" : u} ago`;
  return label;
}

export interface TrendPoint {
  label: string;
  value: number; // percent
  detail: string;
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, L = 44, R = 16, T = 16, B = 30;
  if (!points.length) return null;
  const min = Math.max(0, Math.floor((Math.min(...points.map((p) => p.value)) - 6) / 5) * 5);
  const max = 100;
  const x = (i: number) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + ((max - v) * (H - T - B)) / (max - min || 1);
  const ticks = [min, min + (max - min) / 2, max].map((v) => Math.round(v));
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${d} L${x(points.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Match rate by period: ${points.map((p) => `${p.label} ${p.value.toFixed(1)}%`).join(", ")}`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}%</text>
          </g>
        ))}
        <path d={area} fill="url(#trend-fill)" className="trend-area" />
        <path d={d} className="trend-line" pathLength={1} />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="crosshair" />}
        {points.map((p, i) => (
          <g key={p.label}>
            <text x={x(i)} y={H - 8} textAnchor="middle" className="axis">{p.label}</text>
            <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 6 : 4.5} className="trend-dot" />
            <rect
              x={x(i) - 28}
              y={T}
              width={56}
              height={H - T - B}
              fill="transparent"
              tabIndex={0}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${p.label}: ${p.value.toFixed(1)}%`}
            />
          </g>
        ))}
      </svg>
      {h && hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          <b>{h.label}</b>
          <span>{h.value.toFixed(1)}% matched</span>
          <span className="muted">{h.detail}</span>
        </div>
      )}
    </div>
  );
}

export function BarList({ rows, format }: { rows: { key: Status; value: number; sub?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key} title={`${STATUS_LABEL[r.key]}: ${format ? format(r.value) : r.value}`}>
          <span className="barlist-label">{STATUS_LABEL[r.key]}</span>
          <span className="barlist-track">
            <span className={`barlist-fill s-${r.key}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="barlist-value">{format ? format(r.value) : r.value}</span>
          {r.sub && <span className="barlist-sub">{r.sub}</span>}
        </li>
      ))}
    </ul>
  );
}
