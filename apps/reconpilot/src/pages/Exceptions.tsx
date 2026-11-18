import { useCallback, useEffect, useMemo, useState } from "react";
import { STATUS_LABEL, type Status } from "../recon/match";
import { STATUS_ORDER } from "../status";
import { formatMoney } from "../format";
import { store } from "../lib/store";
import { atStake, type Item, type Run } from "../lib/types";
import { CountUp, Reveal } from "../lib/motion";
import { usePageContext } from "../lib/assistant-context";
import { ItemPanel } from "../components/ItemPanel";
import { ItemsTable } from "../components/ItemsTable";
import { Empty, Icon, PageHead } from "../components/ui";

type Sort = "amount" | "age";

export default function Exceptions() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [runs, setRuns] = useState<Map<string, Run>>(new Map());
  const [type, setType] = useState<Status | "all">("all");
  const [sort, setSort] = useState<Sort>("amount");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Item | null>(null);

  useEffect(() => {
    Promise.all([store.listOpenItems(), store.listRuns()]).then(([its, rs]) => {
      setRuns(new Map(rs.map((r) => [r.id, r])));
      setItems(its.filter((i) => rs.find((r) => r.id === i.run_id)?.status === "in_review"));
    });
  }, []);

  const age = useCallback((i: Item) => {
    const r = runs.get(i.run_id);
    return r ? Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000) : 0;
  }, [runs]);

  const list = useMemo(() => {
    const q = query.trim().toUpperCase();
    const out = (items ?? []).filter((i) => i.resolution === "open" && (type === "all" || i.status === type) && (!q || i.ref.includes(q)));
    return out.sort((a, b) => (sort === "amount" ? atStake(b) - atStake(a) : age(b) - age(a)));
  }, [items, type, sort, query, age]);

  const open = (items ?? []).filter((i) => i.resolution === "open");
  const buckets = [
    { label: "0–7 days", n: open.filter((i) => age(i) <= 7).length },
    { label: "8–30 days", n: open.filter((i) => age(i) > 7 && age(i) <= 30).length },
    { label: "Over 30 days", n: open.filter((i) => age(i) > 30).length },
  ];
  const total = open.reduce((t, i) => t + atStake(i), 0);
  usePageContext(
    items
      ? [`Exception queue: ${open.length} open, ${formatMoney(total)} at stake.`, ...list.slice(0, 25).map((i) => `${i.ref} | ${STATUS_LABEL[i.status]} | ${runs.get(i.run_id)?.name ?? ""} | at stake ${formatMoney(atStake(i))} | ${age(i)} days old`)].join("\n")
      : null,
  );

  return (
    <div className="page">
      <PageHead eyebrow="Exceptions" title="Review queue" sub="Every open exception from periods still in review, in one place. Resolve each with a note so the audit trail explains the books." />

      {!items ? (
        <div className="skeleton-grid" aria-busy="true"><span /><span /><span /><span /></div>
      ) : !open.length ? (
        <Empty title="Queue is empty">Every exception in every open period has an answer.</Empty>
      ) : (
        <>
          <Reveal className="kpis">
            <div className="kpi">
              <span className="kpi-label">Open</span>
              <strong className="kpi-value"><CountUp value={open.length} /></strong>
              <span className="kpi-foot">{formatMoney(total)} at stake</span>
            </div>
            {buckets.map((b) => (
              <div className="kpi" key={b.label}>
                <span className="kpi-label">{b.label}</span>
                <strong className={`kpi-value ${b.label.startsWith("Over") && b.n ? "neg" : ""}`}><CountUp value={b.n} /></strong>
                <span className="kpi-foot">since the reconciliation ran</span>
              </div>
            ))}
          </Reveal>

          <div className="toolbar">
            <div className="segmented" role="tablist" aria-label="Filter by type">
              <button type="button" role="tab" aria-selected={type === "all"} className={type === "all" ? "on" : ""} onClick={() => setType("all")}>
                All <span className="count">{open.length}</span>
              </button>
              {STATUS_ORDER.filter((s) => s !== "matched").map((s) => (
                <button key={s} type="button" role="tab" aria-selected={type === s} className={type === s ? "on" : ""} onClick={() => setType(s)}>
                  <i className={`swatch s-${s}`} aria-hidden /> {STATUS_LABEL[s]} <span className="count">{open.filter((i) => i.status === s).length}</span>
                </button>
              ))}
            </div>
            <div className="toolbar-right">
              <label className="select">
                <span className="visually-hidden">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="amount">Largest amount first</option>
                  <option value="age">Oldest first</option>
                </select>
              </label>
              <label className="search">
                <Icon name="search" size={16} />
                <input placeholder="Search reference…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search reference" />
              </label>
            </div>
          </div>

          <section className="card flush">
            <ItemsTable items={list} runs={runs} selectedId={sel?.id} onOpen={setSel} emptyText="No open exceptions match." />
          </section>
        </>
      )}

      {sel && (
        <ItemPanel
          item={sel}
          run={runs.get(sel.run_id)}
          onClose={() => setSel(null)}
          onChange={(next) => {
            setItems((l) => (l ?? []).map((i) => (i.id === next.id ? next : i)));
            setSel(next);
          }}
        />
      )}
    </div>
  );
}
