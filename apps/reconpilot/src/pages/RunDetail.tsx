import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { STATUS_LABEL, csvCell, type Status } from "../recon/match";
import { STATUS_HINT, STATUS_ORDER } from "../status";
import { formatMoney, formatShare } from "../format";
import { store } from "../lib/store";
import { errMsg, useToast } from "../lib/toast";
import { RESOLUTION_LABEL, type Account, type Item, type Run } from "../lib/types";
import { CountUp } from "../lib/motion";
import { usePageContext } from "../lib/assistant-context";
import { atStake } from "../lib/types";
import { Composition } from "../components/Composition";
import { ItemPanel } from "../components/ItemPanel";
import { ItemsTable } from "../components/ItemsTable";
import { Empty, Icon, PageHead, Progress, RunStatusChip, formatPeriod } from "../components/ui";

export default function RunDetail() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [run, setRun] = useState<Run | null | undefined>(undefined);
  const [account, setAccount] = useState<Account | undefined>();
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Status | "all" | "open">("all");
  const [query, setQuery] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    Promise.all([store.getRun(id), store.listItems(id), store.listAccounts()]).then(([r, its, accs]) => {
      if (!live) return;
      setRun(r);
      setItems(its);
      setAccount(accs.find((a) => a.id === r?.account_id));
    });
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedId = params.get("item");
  const selected = items.find((i) => i.id === selectedId);
  const open = useCallback((i: Item) => setParams({ item: i.id }, { replace: true }), [setParams]);
  const closePanel = useCallback(() => setParams({}, { replace: true }), [setParams]);

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    return items.filter((r) => (filter === "all" || (filter === "open" ? r.resolution === "open" : r.status === filter)) && (!q || r.ref.includes(q)));
  }, [items, filter, query]);

  const selectedRef = items.find((i) => i.id === params.get("item"));
  const contextText = useMemo(() => {
    if (!run) return null;
    const open = items.filter((i) => i.resolution === "open").sort((a, b) => atStake(b) - atStake(a));
    const line = (i: Item) => `${i.ref} | ${STATUS_LABEL[i.status]} | bank ${i.a ? `${i.a.date} ${formatMoney(i.a.amount)}` : "-"} | ERP ${i.b ? `${i.b.date} ${formatMoney(i.b.amount)}` : "-"}${i.diff ? ` | diff ${formatMoney(i.diff)}` : ""} | ${(i.a?.description || i.b?.description || "").slice(0, 60)}`;
    return [
      `Reconciliation: ${run.name} (${run.status === "closed" ? "closed" : "in review"})`,
      `Files: ${run.bank_file} vs ${run.erp_file}`,
      `Counts: ${STATUS_ORDER.map((s) => `${STATUS_LABEL[s]} ${run.counts[s]}`).join(", ")}`,
      `Totals: bank ${formatMoney(run.totals.a)}, ERP ${formatMoney(run.totals.b)}, net ${formatMoney(run.totals.net)}`,
      `Exceptions resolved: ${items.filter((i) => i.resolution === "resolved" || i.resolution === "ignored").length} of ${items.filter((i) => i.status !== "matched").length}`,
      selectedRef ? `Line the user has open: ${line(selectedRef)}${selectedRef.note ? ` | note: ${selectedRef.note}` : ""}` : "",
      open.length ? `Open exceptions (largest first):\n${open.slice(0, 25).map(line).join("\n")}` : "No open exceptions.",
    ].filter(Boolean).join("\n");
  }, [run, items, selectedRef]);
  usePageContext(contextText);

  if (run === undefined) return <div className="page"><div className="skeleton-grid" aria-busy="true"><span /><span /><span /><span /></div></div>;
  if (run === null)
    return (
      <div className="page">
        <Empty title="Reconciliation not found" action={<Link className="btn primary" to="/app/runs">Back to reconciliations</Link>}>
          It may have been deleted, or it belongs to another workspace.
        </Empty>
      </div>
    );

  const resolved = items.filter((i) => i.resolution === "resolved" || i.resolution === "ignored").length;
  const exceptions = items.filter((i) => i.status !== "matched").length;
  const remaining = exceptions - resolved;
  const total = items.length;
  const locked = run.status === "closed";

  function onChange(next: Item) {
    setItems((list) => list.map((i) => (i.id === next.id ? next : i)));
  }

  function exportCsv() {
    const header = ["status", "reference", "bank_date", "bank_amount", "erp_date", "erp_amount", "difference", "resolution", "note", "description"];
    const lines = items.map((r) => [STATUS_LABEL[r.status], r.ref, r.a?.date, r.a?.amount, r.b?.date, r.b?.amount, r.diff, RESOLUTION_LABEL[r.resolution], r.note, r.a?.description || r.b?.description].map(csvCell).join(","));
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reconciliation-${run!.period}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    store.log("Exported CSV", run!.name, run!.id);
  }

  async function doClose() {
    setClosing(true);
    try {
      setRun(await store.closeRun(run!));
      toast(`${formatPeriod(run!.period)} closed and locked`);
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setClosing(false);
      setConfirmClose(false);
    }
  }

  async function doDelete() {
    try {
      await store.deleteRun(run!.id);
      await store.log("Deleted reconciliation", run!.name);
      nav("/app/runs");
    } catch (e) {
      toast(errMsg(e), "err");
    }
  }

  const sharePct = total ? (run.counts.matched / total) * 100 : 0;

  return (
    <div className="page">
      <PageHead
        eyebrow={<Link to="/app/runs" className="crumb">← Reconciliations</Link>}
        title={run.name}
        sub={
          <span className="run-meta">
            <RunStatusChip s={run.status} />
            {account && <span>{account.bank} ••{account.last4}</span>}
            <span className="mono">{run.bank_file}</span>
            <span aria-hidden>vs</span>
            <span className="mono">{run.erp_file}</span>
          </span>
        }
        actions={
          <>
            <button type="button" className="btn ghost" onClick={exportCsv}>
              <Icon name="download" size={16} /> Export CSV
            </button>
            {!locked && (
              <button type="button" className="btn primary" disabled={remaining > 0} onClick={() => setConfirmClose(true)} title={remaining > 0 ? `Resolve ${remaining} open exception${remaining > 1 ? "s" : ""} first` : "Lock this period"}>
                <Icon name="lock" size={16} /> Close period
              </button>
            )}
          </>
        }
      />

      {confirmClose && (
        <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
          <div>
            <h3 id="confirm-title">Close {formatPeriod(run.period, true)}?</h3>
            <p>All {exceptions} exceptions have an answer. Closing locks the period: lines can no longer be changed, by you or anyone else in this workspace.</p>
          </div>
          <div className="confirm-actions">
            <button type="button" className="btn ghost" onClick={() => setConfirmClose(false)}>Cancel</button>
            <button type="button" className="btn primary" disabled={closing} onClick={doClose}>{closing ? "Closing…" : "Close and lock"}</button>
          </div>
        </div>
      )}

      <section className="review-strip">
        <div className="review-text">
          <p className="review-count" data-testid="review-progress">
            <strong>{resolved} of {exceptions}</strong> exceptions resolved
          </p>
          <p className="muted small">
            {locked ? `Closed ${run.closed_at ? new Date(run.closed_at).toLocaleDateString("en-GB", { dateStyle: "medium" }) : ""}. Read-only.` : remaining ? `${remaining} still open. Open a line to record what happened.` : "Everything has an answer. You can close the period."}
          </p>
        </div>
        <Progress done={resolved} total={exceptions} label="Exceptions resolved" />
        {!locked && remaining > 0 && (
          <button type="button" className={`btn ghost sm ${filter === "open" ? "on" : ""}`} onClick={() => setFilter(filter === "open" ? "all" : "open")}>
            {filter === "open" ? "Show all lines" : "Show open only"}
          </button>
        )}
      </section>

      <section className="summary">
        <div className="summary-head">
          <p className="headline">
            <CountUp value={sharePct} format={(n) => `${n.toFixed(0)}%`} className="headline-num" />
            <span>of lines matched</span>
          </p>
          <dl className="totals">
            <div><dt>Bank total</dt><dd data-testid="total-bank">{formatMoney(run.totals.a)}</dd></div>
            <div><dt>ERP total</dt><dd data-testid="total-erp">{formatMoney(run.totals.b)}</dd></div>
            <div><dt>Net difference</dt><dd data-testid="total-net" className={run.totals.net ? "neg" : ""}>{formatMoney(run.totals.net)}</dd></div>
          </dl>
        </div>
        <Composition counts={run.counts} active={filter === "open" ? "all" : filter} onPick={(s) => setFilter(filter === s ? "all" : s)} />
        <div className="cards">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`card-btn ${filter === s ? "on" : ""}`}
              onClick={() => setFilter(filter === s ? "all" : s)}
              aria-pressed={filter === s}
              aria-label={`${STATUS_LABEL[s]}: ${run.counts[s]}`}
              data-testid={`count-${s}`}
            >
              <span className="card-label"><i className={`swatch s-${s}`} aria-hidden />{STATUS_LABEL[s]}</span>
              <span className="card-num"><CountUp value={run.counts[s]} /></span>
              <span className="card-hint">{STATUS_HINT[s]}</span>
              <span className="card-share">{formatShare(run.counts[s], total)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card flush">
        <div className="table-tools">
          <span className="muted">
            {visible.length.toLocaleString("en")} of {total.toLocaleString("en")} lines
            {filter !== "all" && (
              <button type="button" className="text-btn" onClick={() => setFilter("all")}> · clear filter</button>
            )}
          </span>
          <label className="search">
            <Icon name="search" size={16} />
            <input ref={search} placeholder="Search reference…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search reference" />
            <kbd aria-hidden>/</kbd>
          </label>
        </div>
        <ItemsTable items={visible} selectedId={selected?.id} onOpen={open} emptyText={`No lines match “${query}”${filter !== "all" && filter !== "open" ? ` in ${STATUS_LABEL[filter]}` : ""}.`} />
      </section>

      {!locked && (
        <p className="danger-zone">
          <button type="button" className="text-btn danger" onClick={doDelete}>
            <Icon name="trash" size={14} /> Delete this reconciliation
          </button>
        </p>
      )}

      {selected && <ItemPanel item={selected} run={run} onClose={closePanel} onChange={onChange} />}
    </div>
  );
}
