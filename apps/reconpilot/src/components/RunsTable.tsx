import { Link, useNavigate } from "react-router";
import { STATUS_ORDER } from "../status";
import type { Account, Run } from "../lib/types";
import { RunStatusChip, formatPeriod } from "./ui";

export const matchRate = (r: Run) => {
  const total = STATUS_ORDER.reduce((s, k) => s + r.counts[k], 0);
  return total ? (r.counts.matched / total) * 100 : 0;
};

export function RunsTable({ runs, accounts }: { runs: Run[]; accounts?: Map<string, Account> }) {
  const nav = useNavigate();
  return (
    <div className="table-scroll">
      <table className="ledger runs-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Reconciliation</th>
            <th className="num">Lines</th>
            <th>Match rate</th>
            <th>Review</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const pct = matchRate(r);
            const acct = r.account_id ? accounts?.get(r.account_id) : undefined;
            return (
              <tr key={r.id} className="link-row" onClick={() => nav(`/app/runs/${r.id}`)}>
                <td className="nowrap">
                  <Link to={`/app/runs/${r.id}`} className="row-link" onClick={(e) => e.stopPropagation()}>{formatPeriod(r.period)}</Link>
                </td>
                <td>
                  {r.name.split(" · ")[0]}
                  <span className="muted small block">{acct ? `${acct.bank} ••${acct.last4} · ` : ""}{r.bank_file}</span>
                </td>
                <td className="num">{(r.bank_lines + r.erp_lines).toLocaleString("en")}</td>
                <td className="nowrap">
                  <span className="minibar" aria-hidden><span style={{ width: `${pct}%` }} /></span>
                  <span className="num small">{pct.toFixed(1)}%</span>
                </td>
                <td className="nowrap">
                  {r.resolved} / {r.exceptions} <span className="muted small">resolved</span>
                </td>
                <td><RunStatusChip s={r.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
