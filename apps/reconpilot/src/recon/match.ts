import type { Txn } from "./parse";

export type Status = "matched" | "amount_mismatch" | "unmatched_a" | "unmatched_b" | "duplicate";

export const STATUS_LABEL: Record<Status, string> = {
  matched: "Matched",
  amount_mismatch: "Amount mismatch",
  unmatched_a: "Only in Bank",
  unmatched_b: "Only in ERP",
  duplicate: "Duplicate",
};

export interface ResultRow {
  id: string;
  status: Status;
  ref: string;
  a: Txn | null;
  b: Txn | null;
  diff: number | null; // bank minus ERP, mismatches only
  source?: "A" | "B";
}

export interface ReconResult {
  rows: ResultRow[];
  counts: Record<Status, number>;
  totals: { a: number; b: number; net: number };
}

const TOLERANCE = 0.01;

function splitDuplicates(txns: Txn[], source: "A" | "B", rows: ResultRow[]): Map<string, Txn> {
  const first = new Map<string, Txn>();
  for (const t of txns) {
    if (!t.ref) continue;
    if (first.has(t.ref)) {
      rows.push({ id: `dup-${source}-${t.row}`, status: "duplicate", ref: t.ref, a: source === "A" ? t : null, b: source === "B" ? t : null, diff: null, source });
    } else {
      first.set(t.ref, t);
    }
  }
  return first;
}

export function reconcile(bank: Txn[], erp: Txn[]): ReconResult {
  const rows: ResultRow[] = [];
  const a = splitDuplicates(bank, "A", rows);
  const b = splitDuplicates(erp, "B", rows);

  for (const [ref, ta] of a) {
    const tb = b.get(ref);
    if (!tb) {
      rows.push({ id: `a-${ta.row}`, status: "unmatched_a", ref, a: ta, b: null, diff: null });
      continue;
    }
    const diff = (ta.amount ?? 0) - (tb.amount ?? 0);
    const same = ta.amount !== null && tb.amount !== null && Math.abs(diff) < TOLERANCE;
    rows.push({ id: `m-${ta.row}-${tb.row}`, status: same ? "matched" : "amount_mismatch", ref, a: ta, b: tb, diff: same ? null : Math.round(diff * 100) / 100 });
  }
  for (const [ref, tb] of b) {
    if (!a.has(ref)) rows.push({ id: `b-${tb.row}`, status: "unmatched_b", ref, a: null, b: tb, diff: null });
  }

  const order: Status[] = ["amount_mismatch", "unmatched_a", "unmatched_b", "duplicate", "matched"];
  rows.sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status) || x.ref.localeCompare(y.ref));

  const counts = { matched: 0, amount_mismatch: 0, unmatched_a: 0, unmatched_b: 0, duplicate: 0 } as Record<Status, number>;
  for (const r of rows) counts[r.status]++;
  const sum = (ts: Txn[]) => Math.round(ts.reduce((s, t) => s + (t.amount ?? 0), 0) * 100) / 100;
  const totals = { a: sum(bank), b: sum(erp), net: 0 };
  totals.net = Math.round((totals.a - totals.b) * 100) / 100;
  return { rows, counts, totals };
}

// Text starting with = + - @ would run as a formula in Excel, so prefix it with a quote.
export function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(result: ReconResult): string {
  const esc = csvCell;
  const header = ["status", "reference", "bank_date", "bank_amount", "erp_date", "erp_amount", "difference", "description"];
  const lines = result.rows.map((r) =>
    [STATUS_LABEL[r.status], r.ref, r.a?.date, r.a?.amount, r.b?.date, r.b?.amount, r.diff, r.a?.description || r.b?.description].map(esc).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
