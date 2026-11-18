import { useEffect, useRef, useState } from "react";
import type { Txn } from "../recon/parse";
import { formatDate, formatMoney } from "../format";
import type { Item, Resolution, Run } from "../lib/types";
import { store } from "../lib/store";
import { errMsg, useToast } from "../lib/toast";
import { Icon, ResolutionChip, StatusChip } from "./ui";

function explain(r: Item): string {
  switch (r.status) {
    case "matched":
      return "Reference and amount agree in both files. Nothing to do.";
    case "amount_mismatch": {
      const d = r.diff ?? 0;
      return `Same reference, but the bank shows ${formatMoney(Math.abs(d))} ${d > 0 ? "more" : "less"} than the ERP ledger.`;
    }
    case "unmatched_a":
      return "Money moved in the bank, but nothing in the ERP ledger carries this reference.";
    case "unmatched_b":
      return "Recorded in the ERP ledger, but no bank transaction carries this reference.";
    case "duplicate":
      return `This reference appears more than once in the ${r.source === "B" ? "ERP ledger" : "bank statement"}. Only its first line was used for matching.`;
  }
}

const HINTS: Record<Item["status"], string[]> = {
  matched: [],
  amount_mismatch: ["Customer short-paid; credit note issued", "Bank charge deducted by sender"],
  unmatched_a: ["Bank admin fee — journal posted", "Interest income — journal posted"],
  unmatched_b: ["Payment arrived after cut-off", "Cheque not yet presented"],
  duplicate: ["Bank reversed the double posting", "Duplicate ERP entry voided"],
};

// Trailing spaces are invisible but break matching, so draw them.
function Raw({ value }: { value: string }) {
  const m = value.match(/^(\s*)(.*?)(\s*)$/s) ?? ["", "", value, ""];
  const mark = (ws: string) => (ws ? <span className="ws" title={`${ws.length} hidden space(s)`}>{"·".repeat(ws.length)}</span> : null);
  return (
    <code className="raw">
      {mark(m[1])}
      {m[2] || <span className="muted">(empty)</span>}
      {mark(m[3])}
    </code>
  );
}

function Side({ title, t, highlight }: { title: string; t: Txn | null; highlight: boolean }) {
  return (
    <section className="side">
      <h3>{title}</h3>
      {t ? (
        <dl>
          <dt>Line</dt>
          <dd className="num">#{t.row}</dd>
          <dt>Reference</dt>
          <dd><Raw value={t.rawRef} /></dd>
          <dt>Date</dt>
          <dd>
            {formatDate(t.date)}
            <span className="from">from <Raw value={t.rawDate} /></span>
          </dd>
          <dt>Amount</dt>
          <dd className={highlight ? "hl" : ""}>
            <span className="num">{formatMoney(t.amount)}</span>
            <span className="from">from <Raw value={t.rawAmount} /></span>
          </dd>
          <dt>Description</dt>
          <dd>{t.description || <span className="muted">—</span>}</dd>
        </dl>
      ) : (
        <p className="absent">No line in this file.</p>
      )}
    </section>
  );
}

export function ItemPanel({ item, run, onClose, onChange }: { item: Item; run: Run | undefined; onClose: () => void; onChange: (i: Item) => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const [note, setNote] = useState(item.note ?? "");
  const [busy, setBusy] = useState<Resolution | null>(null);

  useEffect(() => setNote(item.note ?? ""), [item.id, item.note]);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item.id, onClose]);

  const locked = run?.status === "closed";
  const isException = item.status !== "matched";

  async function act(resolution: Resolution) {
    setBusy(resolution);
    try {
      const next = await store.setResolution(item, resolution, resolution === "open" ? item.note : note.trim() || null);
      onChange(next);
      toast(resolution === "resolved" ? `${item.ref} resolved` : resolution === "ignored" ? `${item.ref} ignored` : `${item.ref} reopened`);
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(null);
    }
  }

  const mismatch = item.status === "amount_mismatch";
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <aside className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <header className="panel-head">
          <div>
            <div className="panel-chips">
              <StatusChip status={item.status} />
              {isException && <ResolutionChip r={item.resolution} />}
            </div>
            <h2 id="panel-title" className="mono">{item.ref}</h2>
            {run && <p className="panel-run">{run.name}</p>}
          </div>
          <button ref={closeBtn} type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            <Icon name="close" />
          </button>
        </header>

        <p className="explain">{explain(item)}</p>
        {mismatch && (
          <div className="delta">
            <span>Difference</span>
            <strong className="num">{formatMoney(item.diff)}</strong>
          </div>
        )}

        <div className="sides">
          <Side title="Bank statement" t={item.a} highlight={mismatch} />
          <Side title="ERP ledger" t={item.b} highlight={mismatch} />
        </div>

        {isException && (
          <section className="resolve">
            <h3>Resolution</h3>
            {locked ? (
              <p className="locked">
                <Icon name="lock" size={14} /> This period is closed. {item.note ? <>Note: <q>{item.note}</q></> : "No note was recorded."}
              </p>
            ) : item.resolution === "open" ? (
              <>
                <label className="field">
                  <span>Resolution note</span>
                  <textarea aria-label="Resolution note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened, and what did you book?" />
                </label>
                <div className="hint-row">
                  {HINTS[item.status].map((h) => (
                    <button key={h} type="button" className="hint" onClick={() => setNote(h)}>{h}</button>
                  ))}
                </div>
                <div className="resolve-actions">
                  <button type="button" className="btn primary" disabled={busy !== null} onClick={() => act("resolved")}>
                    <Icon name="check" size={16} /> {busy === "resolved" ? "Saving…" : "Mark resolved"}
                  </button>
                  <button type="button" className="btn ghost" disabled={busy !== null} onClick={() => act("ignored")}>
                    {busy === "ignored" ? "Saving…" : "Ignore"}
                  </button>
                </div>
              </>
            ) : (
              <div className="resolved-box">
                <p>
                  <ResolutionChip r={item.resolution} /> {item.resolved_at && <span className="muted">{new Date(item.resolved_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>}
                </p>
                {item.note && <blockquote>{item.note}</blockquote>}
                <button type="button" className="text-btn" disabled={busy !== null} onClick={() => act("open")}>Reopen</button>
              </div>
            )}
          </section>
        )}
        <p className="panel-foot muted">Dots mark spaces hidden in the source file. Press Esc to close.</p>
      </aside>
    </>
  );
}
