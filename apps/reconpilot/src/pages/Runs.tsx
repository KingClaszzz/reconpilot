import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { store } from "../lib/store";
import type { Account, Run, RunStatus } from "../lib/types";
import { Empty, Icon, PageHead } from "../components/ui";
import { RunsTable } from "../components/RunsTable";

export default function Runs() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [status, setStatus] = useState<RunStatus | "all">("all");
  const [account, setAccount] = useState("all");

  useEffect(() => {
    Promise.all([store.listRuns(), store.listAccounts()]).then(([r, a]) => {
      setRuns(r);
      setAccounts(a);
    });
  }, []);

  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const shown = (runs ?? []).filter((r) => (status === "all" || r.status === status) && (account === "all" || r.account_id === account));
  const count = (s: RunStatus | "all") => (runs ?? []).filter((r) => s === "all" || r.status === s).length;

  return (
    <div className="page">
      <PageHead
        eyebrow="Reconciliations"
        title="Periods"
        sub="One reconciliation per bank account per month. A period stays in review until every exception has an answer, then it is closed and locked."
        actions={
          <Link to="/app/runs/new" className="btn primary">
            <Icon name="plus" size={16} /> New reconciliation
          </Link>
        }
      />
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Filter by status">
          {(["all", "in_review", "closed"] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : s === "in_review" ? "In review" : "Closed"} <span className="count">{count(s)}</span>
            </button>
          ))}
        </div>
        <label className="select">
          <span className="visually-hidden">Bank account</span>
          <select value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="all">All bank accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.bank} {a.name} ••{a.last4}</option>
            ))}
          </select>
        </label>
      </div>
      <section className="card flush">
        {!runs ? (
          <div className="skeleton-rows" aria-busy="true"><span /><span /><span /></div>
        ) : shown.length ? (
          <RunsTable runs={shown} accounts={accMap} />
        ) : (
          <Empty title={runs.length ? "No periods match this filter" : "No reconciliations yet"} action={!runs.length ? <Link className="btn primary" to="/app/runs/new">Start one</Link> : undefined} />
        )}
      </section>
    </div>
  );
}
