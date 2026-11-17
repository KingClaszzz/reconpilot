import { useState } from "react";
import type { Status } from "../recon/match";
import { STATUS_LABEL } from "../recon/match";
import { DARK_INK_ON, STATUS_ORDER } from "../status";
import { formatShare } from "../format";

interface Props {
  counts: Record<Status, number>;
  active: Status | "all";
  onPick: (s: Status) => void;
}

export function Composition({ counts, active, onPick }: Props) {
  const total = STATUS_ORDER.reduce((s, k) => s + counts[k], 0);
  const [hover, setHover] = useState<Status | null>(null);
  const parts = STATUS_ORDER.filter((s) => counts[s] > 0);
  const summary = parts.map((s) => `${STATUS_LABEL[s]} ${counts[s]} (${formatShare(counts[s], total)})`).join(", ");

  return (
    <figure className="composition">
      <div className="bar" role="group" aria-label={`Result lines by status: ${summary}`}>
        {parts.map((s) => {
          const share = counts[s] / total;
          return (
            <button
              key={s}
              type="button"
              className={`seg s-${s} ${DARK_INK_ON.includes(s) ? "ink-dark" : ""} ${active !== "all" && active !== s ? "dim" : ""}`}
              style={{ flexGrow: counts[s] }}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s)}
              onBlur={() => setHover(null)}
              onClick={() => onPick(s)}
              aria-label={`${STATUS_LABEL[s]}: ${counts[s]} of ${total} (${formatShare(counts[s], total)})`}
            >
              {share >= 0.08 && <span className="seg-label">{formatShare(counts[s], total)}</span>}
              {hover === s && (
                <span className="tip" role="tooltip">
                  <b>{STATUS_LABEL[s]}</b>
                  <span>{counts[s]} of {total} lines · {formatShare(counts[s], total)}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <figcaption className="legend">
        {parts.map((s) => (
          <span key={s} className="legend-item">
            <span className={`swatch s-${s}`} aria-hidden />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
