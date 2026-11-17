import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { formatIDR, formatIDRShort } from "../format";
import type { Status } from "../recon/match";
import { STATUS_ORDER } from "../status";
import { useAuth } from "../lib/auth";
import { store } from "../lib/store";
import { atStake, type Account, type Activity, type Item, type Run } from "../lib/types";
import { BarList, Empty, Icon, Kpi, PageHead, StatusChip, TrendChart, formatPeriod, timeAgo } from "../components/ui";
import { Decode, Reveal } from "../lib/motion";
import { RunsTable } from "../components/RunsTable";

export default function Overview() {
  const { user } = useAuth();
  const [data, setData] = useState<{ runs: Run[]; open: Item[]; activity: Activity[]; accounts: Account[] } | null>(null);

  useEffect(() => {
    Promise.all([store.listRuns(), store.listOpenItems(), store.listActivity(8), store.listAccounts()]).then(([runs, open, activity, accounts]) => setData({ runs, open, activity, accounts }));
  }, []);

  const m = useMemo(() => {
    if (!data) return null;
    const { runs, open } = data;
    const latest = runs[0];
    const byPeriod = new Map<string, { matched: number; total: number; runs: number }>();
    for (const r of runs) {
      const p = byPeriod.get(r.period) ?? { matched: 0, total: 0, runs: 0 };
      p.matched += r.counts.matched;
      p.total += STATUS_ORDER.reduce((s, k) => s + r.counts[k], 0);
      p.runs++;
      byPeriod.set(r.period, p);
    }
    const trend = [...byPeriod.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, p]) => ({ label: formatPeriod(period), value: p.total ? (p.matched / p.total) * 100 : 0, detail: `${p.matched.toLocaleString("en")} of ${p.total.toLocaleString("en")} lines · ${p.runs} account${p.runs > 1 ? "s" : ""}` }));
    const last = trend.at(-1)?.value ?? 0;
    const prev = trend.at(-2)?.value;
    const byType = STATUS_ORDER.filter((s) => s !== "matched").map((s) => {
      const list = open.filter((i) => i.status === s);
      return { key: s as Status, value: list.length, sub: formatIDR(list.reduce((t, i) => t + atStake(i), 0)) };
    });
    const atRisk = open.reduce((t, i) => t + atStake(i), 0);
    const inReview = runs.filter((r) => r.status === "in_review");
    const top = [...open].sort((a, b) => atStake(b) - atStake(a)).slice(0, 5);
    return { latest, trend, last, prev, byType, atRisk, inReview, top, closed: runs.filter((r) => r.status === "closed").length };
  }, [data]);

  const runsById = useMemo(() => new Map((data?.runs ?? []).map((r) => [r.id, r])), [data]);
  const hour = new Date().getHours();
  const hello = hour < 11 ? "Good morning" : hour < 15 ? "Good afternoon" : "Good evening";

  return (
    <div className="page">
      <PageHead
        eyebrow={<Decode text={`${hello} · ${user?.workspace ?? ""}`} />}
        title="Overview"
        sub={m?.inReview.length ? `${m.inReview.length} period${m.inReview.length > 1 ? "s" : ""} still in review. Close them once every exception has an answer.` : "Every period is closed. Nice."}
        actions={
          <Link to="/app/runs/new" className="btn primary">
            <Icon name="plus" size={16} /> New reconciliation
          </Link>
        }
      />

      {!data || !m ? (
        <div className="skeleton-grid" aria-busy="true">
          <span /><span /><span /><span />
        </div>
      ) : !data.runs.length ? (
        <Empty title="No reconciliations yet" action={<Link className="btn primary" to="/app/runs/new">Run your first reconciliation</Link>}>
          Upload a bank statement and an ERP ledger export. ReconPilot matches them line by line and lists only what needs a person.
        </Empty>
      ) : (
        <>
          <Reveal className="kpis">
            <Kpi
              label="Match rate"
              value={m.last}
              format={(n) => `${n.toFixed(1)}%`}
              foot={m.prev !== undefined ? <><Delta now={m.last} prev={m.prev} /> vs previous period</> : "latest period"}
            />
            <Kpi label="Open exceptions" value={data.open.length} foot={`across ${m.inReview.length} period${m.inReview.length === 1 ? "" : "s"} in review`} />
            <Kpi label="Unreconciled amount" value={m.atRisk} format={(n) => formatIDRShort(n)} tone={m.atRisk ? "neg" : undefined} foot={formatIDR(m.atRisk)} />
            <Kpi label="Periods closed" value={m.closed} format={(n) => `${Math.round(n)} / ${data.runs.length}`} foot={`${data.accounts.length} bank account${data.accounts.length === 1 ? "" : "s"}`} />
          </Reveal>

          <div className="grid-2">
            <section className="card">
              <header className="card-head">
                <h2>Match rate by period</h2>
                <span className="muted">all accounts</span>
              </header>
              <TrendChart points={m.trend} />
            </section>
            <section className="card">
              <header className="card-head">
                <h2>Open exceptions by type</h2>
                <Link to="/app/exceptions" className="link-arrow">Queue <Icon name="arrow" size={14} /></Link>
              </header>
              {data.open.length ? <BarList rows={m.byType} /> : <p className="muted pad">Nothing open. Every exception has an answer.</p>}
            </section>
          </div>

          <div className="grid-2 wide-left">
            <section className="card">
              <header className="card-head">
                <h2>Needs attention</h2>
                <span className="muted">largest open amounts</span>
              </header>
              {m.top.length ? (
                <ul className="attention">
                  {m.top.map((i) => {
                    const r = runsById.get(i.run_id);
                    return (
                      <li key={i.id}>
                        <Link to={`/app/runs/${i.run_id}?item=${i.id}`}>
                          <StatusChip status={i.status} />
                          <span className="mono ref">{i.ref}</span>
                          <span className="muted where">{r ? `${r.name.split(" · ")[0]} · ${formatPeriod(r.period)}` : ""}</span>
                          <strong className="num">{formatIDR(atStake(i))}</strong>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted pad">No open exceptions.</p>
              )}
            </section>
            <section className="card">
              <header className="card-head">
                <h2>Recent activity</h2>
                <Link to="/app/audit" className="link-arrow">Audit log <Icon name="arrow" size={14} /></Link>
              </header>
              <ol className="feed">
                {data.activity.map((a) => (
                  <li key={a.id}>
                    <span className="feed-dot" aria-hidden />
                    <div>
                      <p><b>{a.action}</b> <span className="feed-target">{a.target}</span></p>
                      <span className="muted">{a.actor} · {timeAgo(a.at)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="card">
            <header className="card-head">
              <h2>Periods</h2>
              <Link to="/app/runs" className="link-arrow">All reconciliations <Icon name="arrow" size={14} /></Link>
            </header>
            <RunsTable runs={data.runs.slice(0, 5)} />
          </section>
        </>
      )}
    </div>
  );
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const d = now - prev;
  return <span className={d >= 0 ? "up" : "down"}>{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)} pt</span>;
}
