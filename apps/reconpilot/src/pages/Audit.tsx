import { useEffect, useState } from "react";
import { Link } from "react-router";
import { store } from "../lib/store";
import type { Activity } from "../lib/types";
import { Empty, PageHead } from "../components/ui";

export default function Audit() {
  const [rows, setRows] = useState<Activity[] | null>(null);
  useEffect(() => {
    store.listActivity(300).then(setRows);
  }, []);

  return (
    <div className="page">
      <PageHead eyebrow="Audit log" title="Who did what, when" sub="Append-only. Every reconciliation, resolution, note and period close is recorded here and cannot be edited or deleted." />
      <section className="card flush">
        {!rows ? (
          <div className="skeleton-rows" aria-busy="true"><span /><span /><span /></div>
        ) : !rows.length ? (
          <Empty title="Nothing recorded yet" />
        ) : (
          <div className="table-scroll">
            <table className="ledger audit">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap mono small">{new Date(a.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="nowrap">{a.actor}</td>
                    <td className="nowrap"><b>{a.action}</b></td>
                    <td>{a.run_id ? <Link to={`/app/runs/${a.run_id}`}>{a.target}</Link> : a.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
