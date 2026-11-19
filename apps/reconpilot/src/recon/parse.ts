import Papa from "papaparse";

export interface Txn {
  row: number;
  date: string | null; // yyyy-mm-dd
  ref: string; // normalized
  rawRef: string;
  rawDate: string;
  rawAmount: string;
  description: string;
  amount: number | null;
}

export type Cell = unknown;
export type DateOrder = "dmy" | "mdy";

const HEADER_ALIASES = {
  date: ["date", "tanggal", "tgl", "transaction date", "tanggal transaksi", "tgl transaksi", "posting date", "booking date", "value date", "trans date"],
  ref: ["ref", "reference", "referensi", "no ref", "ref no", "reference no", "reference number", "no referensi", "invoice", "invoice no", "doc no", "document no", "transaction id", "cheque no", "check no", "no bukti"],
  description: ["description", "desc", "keterangan", "memo", "narrative", "narration", "details", "particulars", "remark", "remarks", "uraian", "keterangan transaksi"],
  amount: ["amount", "nominal", "jumlah", "mutasi", "value", "total", "transaction amount"],
  debit: ["debit", "debet", "db", "dr", "withdrawal", "withdrawals", "money out", "paid out", "debit amount", "mutasi debet"],
  credit: ["credit", "kredit", "cr", "deposit", "deposits", "money in", "paid in", "credit amount", "mutasi kredit"],
};
type Field = keyof typeof HEADER_ALIASES;

function canon(h: string): string {
  return h
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // "Amount (USD)" -> "amount"
    .replace(/[_\-.:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectColumns(headers: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    out[field] = headers.find((h) => aliases.includes(canon(h)));
  }
  return out;
}

// "inv-1001 " and "INV-1001" should match.
export function normalizeRef(raw: string): string {
  return raw.replace(/\s+/g, " ").toUpperCase();
}

// Handles "1.250.000,00", "1,250,000.00" and "1250000.00".
export function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.,-]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Bank-style "1,625.00 CR" / "6.50 DB" (also D/K, DR): debits are money out.
export function parseSignedAmount(raw: string): number | null {
  const m = raw.trim().match(/^(.*?)\s*(CR|DB|DR|D|K)\.?$/i);
  if (!m || !/\d/.test(m[1])) return parseAmount(raw);
  const n = parseAmount(m[1]);
  if (n === null) return null;
  return /^(DB|DR|D)$/i.test(m[2]) ? -Math.abs(n) : Math.abs(n);
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, ags: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };

// Slash dates are day-first by default (dd/mm/yyyy); pass "mdy" for US-style files.
export function parseDate(raw: string, order: DateOrder = "dmy"): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  let named: RegExpMatchArray | null;
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (order === "mdy") [d, m] = [m, d];
    if (y < 100) y += 2000;
  } else if ((named = s.match(/^(\d{1,2})[\s\-]+([a-z]{3})[a-z]*\.?[\s\-,]+(\d{4})$/i))) {
    [d, m, y] = [Number(named[1]), MONTHS[named[2].toLowerCase()] ?? 0, Number(named[3])];
  } else if ((named = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i))) {
    [d, m, y] = [Number(named[2]), MONTHS[named[1].toLowerCase()] ?? 0, Number(named[3])];
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

// Look at every slash date in the file. A first part above 12 proves day-first, a second
// part above 12 proves month-first. If nothing proves it either way, say so.
export function detectDateOrder(raws: string[]): { order: DateOrder; certain: boolean } {
  let dmy = false, mdy = false;
  for (const r of raws) {
    const m = r.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.]\d{2,4}$/);
    if (!m) continue;
    if (Number(m[1]) > 12) dmy = true;
    if (Number(m[2]) > 12) mdy = true;
  }
  if (mdy && !dmy) return { order: "mdy", certain: true };
  if (dmy && !mdy) return { order: "dmy", certain: true };
  const anySlash = raws.some((r) => /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(r.trim()));
  return { order: "dmy", certain: !anySlash };
}

// Reference buried in a bank description, e.g. "TRF PT KENCANA MAS INV-1004".
const REF_IN_TEXT = /\b([A-Z]{2,5}[-/]?\d{3,}(?:[-/]\d+)*)\b/i;

export interface ParsedFile {
  txns: Txn[];
  columns: Record<string, string | undefined>;
  missing: string[];
  /** rows above the header that were skipped (account info, titles) */
  skipped: number;
  dateOrder: DateOrder;
  dateOrderCertain: boolean;
  refFromText: boolean;
  /** the raw table, kept so the date order can be switched without re-reading the file */
  table: string[][];
}

function cellText(c: Cell): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  return String(c);
}

function headerScore(row: string[]): number {
  const cols = detectColumns(row.filter(Boolean));
  const hasMoney = cols.amount || cols.debit || cols.credit;
  return hasMoney ? Object.values(cols).filter(Boolean).length : 0;
}

export function parseTable(input: Cell[][], opts: { dateOrder?: DateOrder } = {}): ParsedFile {
  const table = input.map((r) => r.map(cellText));
  // The header is the first row (within the first 30) that names an amount column.
  let headerAt = 0, best = 0;
  for (let i = 0; i < Math.min(table.length, 30); i++) {
    const s = headerScore(table[i]);
    if (s > best) [best, headerAt] = [s, i];
  }
  const headers = table[headerAt] ?? [];
  const idx = (name: string | undefined) => (name === undefined ? -1 : headers.indexOf(name));
  const found = detectColumns(headers);
  const col = Object.fromEntries((Object.keys(HEADER_ALIASES) as Field[]).map((f) => [f, idx(found[f])])) as Record<Field, number>;

  const splitMoney = col.amount < 0 && (col.debit >= 0 || col.credit >= 0);
  const refFromText = col.ref < 0 && col.description >= 0;
  const columns: Record<string, string | undefined> = {
    date: found.date,
    ref: refFromText ? `${found.description} (found in text)` : found.ref,
    description: found.description,
    amount: splitMoney ? "Credit − Debit" : found.amount,
  };
  const missing = ["ref", "amount"].filter((f) => !columns[f]);

  const body = table.slice(headerAt + 1).filter((r) => r.some((c) => c.trim()));
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const rawDates = body.map((r) => at(r, col.date));
  const detected = detectDateOrder(rawDates);
  const dateOrder = opts.dateOrder ?? detected.order;

  const txns: Txn[] = [];
  body.forEach((r) => {
    const description = at(r, col.description);
    let rawRef = col.ref >= 0 ? (r[col.ref] ?? "") : "";
    if (refFromText) rawRef = description.match(REF_IN_TEXT)?.[1] ?? "";
    let rawAmount = at(r, col.amount);
    let amount: number | null = null;
    if (splitMoney) {
      const debit = parseAmount(at(r, col.debit) || "0") ?? 0;
      const credit = parseAmount(at(r, col.credit) || "0") ?? 0;
      rawAmount = [at(r, col.credit) && `+${at(r, col.credit)}`, at(r, col.debit) && `-${at(r, col.debit)}`].filter(Boolean).join(" ");
      amount = at(r, col.debit) || at(r, col.credit) ? Math.round((credit - debit) * 100) / 100 : null;
    } else if (col.amount >= 0) {
      amount = parseSignedAmount(rawAmount);
    }
    const rawDate = at(r, col.date);
    const date = col.date >= 0 ? parseDate(rawDate, dateOrder) : null;
    // titles and footers such as "Saldo Akhir : 1,234.00": no amount, and no real reference or date
    if (amount === null && (!rawRef.trim() || (rawDate && !date))) return;
    txns.push({ row: txns.length + 1, date, ref: normalizeRef(rawRef), rawRef, rawDate, rawAmount, description, amount });
  });

  return { txns, columns, missing, skipped: headerAt, dateOrder, dateOrderCertain: opts.dateOrder ? true : detected.certain, refFromText, table };
}

export function parseCsv(text: string, opts: { dateOrder?: DateOrder } = {}): ParsedFile {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  return parseTable(result.data, opts);
}
