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

const HEADER_ALIASES: Record<keyof Omit<Txn, "row" | "rawRef" | "rawDate" | "rawAmount">, string[]> = {
  date: ["date", "tanggal", "tgl", "transaction date", "posting date", "value date"],
  ref: ["ref", "reference", "referensi", "no ref", "no. ref", "ref no", "invoice", "invoice no", "doc no", "document no"],
  description: ["description", "desc", "keterangan", "memo", "narrative", "remark"],
  amount: ["amount", "nominal", "jumlah", "value", "total"],
};

function canon(h: string): string {
  return h.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
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
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

// Handles "1.250.000,00", "1,250,000.00" and "1250000.00".
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/^rp\.?/i, "").replace(/\s/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // whichever separator comes last is the decimal one
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "1250,5" -> decimal; "1,250,000" -> thousands
    normalized = /^\d+,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    // "1.250.000" or "1.250" -> thousands (Indonesian); "1250.50" -> decimal
    normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// Slash dates are day-first (dd/mm/yyyy), like Indonesian bank exports.
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export interface ParsedFile {
  txns: Txn[];
  columns: Record<string, string | undefined>;
  missing: string[];
}

export function parseCsv(text: string): ParsedFile {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });
  const headers = result.meta.fields ?? [];
  const columns = detectColumns(headers);
  const missing = ["ref", "amount"].filter((f) => !columns[f]);
  const txns: Txn[] = result.data.map((r, i) => {
    const rawRef = columns.ref ? r[columns.ref] ?? "" : "";
    const rawDate = columns.date ? r[columns.date] ?? "" : "";
    const rawAmount = columns.amount ? r[columns.amount] ?? "" : "";
    return {
      row: i + 1,
      date: columns.date ? parseDate(rawDate) : null,
      ref: normalizeRef(rawRef),
      rawRef,
      rawDate,
      rawAmount,
      description: columns.description ? (r[columns.description] ?? "").trim() : "",
      amount: columns.amount ? parseAmount(rawAmount) : null,
    };
  });
  return { txns, columns, missing };
}
