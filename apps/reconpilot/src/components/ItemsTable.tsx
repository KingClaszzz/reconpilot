import { useEffect, useState } from "react";
import { formatDate, formatMoney } from "../format";
import type { Item, Run } from "../lib/types";
import { ResolutionChip, StatusChip, formatPeriod } from "./ui";

// Rendering 20k rows at once freezes the tab. Exceptions sort first, so the first page is what matters.
const PAGE = 200;

interface Props {
  items: Item[];
  selectedId?: string;
  onOpen: (i: Item) => void;
  runs?: Map<string, Run>;
  emptyText: string;
}

export function ItemsTable({ items, selectedId, onOpen, runs, emptyText }: Props) {
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [items]);
  const shown = items.length > limit ? items.slice(0, limit) : items;

  return (
    <>
      <div className="table-scroll">
        <table data-testid="results" className="ledger">
          <thead>
            <tr>
              <th>Status</th>
              <th>Reference</th>
              {runs && <th>Period</th>}
              <th>Bank date</th>
              <th className="num">Bank amount</th>
              <th>ERP date</th>
              <th className="num">ERP amount</th>
              <th className="num">Difference</th>
              <th>Resolution</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const run = runs?.get(r.run_id);
              return (
                <tr
                  key={r.id}
                  data-ref={r.ref}
                  tabIndex={0}
                  className={selectedId === r.id ? "sel" : ""}
                  onClick={() => onOpen(r)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(r))}
                  aria-label={`${r.ref}, open details`}
                >
                  <td><StatusChip status={r.status} /></td>
                  <td className="mono">{r.ref}</td>
                  {runs && <td className="nowrap">{run ? `${formatPeriod(run.period)} · ${run.name.split(" · ")[0]}` : "—"}</td>}
                  <td className="nowrap">{r.a ? formatDate(r.a.date) : ""}</td>
                  <td className="num">{r.a ? formatMoney(r.a.amount) : ""}</td>
                  <td className="nowrap">{r.b ? formatDate(r.b.date) : ""}</td>
                  <td className="num">{r.b ? formatMoney(r.b.amount) : ""}</td>
                  <td className={`num ${r.diff ? "neg" : ""}`}>{r.diff !== null ? formatMoney(r.diff) : ""}</td>
                  <td><ResolutionChip r={r.resolution} /></td>
                  <td className="desc">{r.a?.description || r.b?.description}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr className="empty-row">
                <td colSpan={runs ? 10 : 9}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {items.length > shown.length && (
        <div className="more-row">
          <span>Showing {shown.length.toLocaleString("en")} of {items.length.toLocaleString("en")} lines</span>
          <button type="button" className="btn ghost sm" onClick={() => setLimit((l) => l + PAGE * 5)} data-testid="show-more">
            Show {Math.min(PAGE * 5, items.length - shown.length).toLocaleString("en")} more
          </button>
        </div>
      )}
    </>
  );
}
