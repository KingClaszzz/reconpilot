import { reconcile, type ResultRow } from "../recon/match";
import { normalizeRef, type Txn } from "../recon/parse";
import type { Preset, Store } from "./types";

// Seeded so every demo workspace looks the same.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMERS = ["PT Kencana Mas", "CV Maju Bersama", "Toko Abadi", "UD Berkah", "PT Sinar Jaya", "CV Delta Teknik", "PT Arunika Retail", "Koperasi Sejahtera", "PT Lintas Samudra", "CV Mitra Logam"];

const NOTES: Record<string, string[]> = {
  amount_mismatch: ["Customer short-paid; credit note issued", "Bank charge deducted by sender — booked to 6105 Bank charges", "FX rounding on USD invoice, written off"],
  unmatched_a: ["Bank admin fee — journal posted to 6105", "Interest income — journal posted to 7101", "Unidentified receipt traced to PT Sinar Jaya, invoice raised"],
  unmatched_b: ["Payment arrived after cut-off; cleared next period", "Cheque not yet presented by customer"],
  duplicate: ["Bank reversed the double posting on the next day", "ERP entry posted twice, voided with a reversing journal"],
};

interface Shape {
  period: string;
  lines: number;
  mismatch: number;
  onlyBank: number;
  onlyErp: number;
  dup: number;
  seed: number;
}

function month({ period, lines, mismatch, onlyBank, onlyErp, dup, seed }: Shape) {
  const r = rng(seed);
  const [y, m] = period.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const bank: Txn[] = [];
  const erp: Txn[] = [];
  const t = (row: number, ref: string, day: number, amount: number, desc: string): Txn => {
    const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { row, date, ref: normalizeRef(ref), rawRef: ref, rawDate: date, rawAmount: String(amount), description: desc, amount };
  };
  const base = 1000 + (m % 12) * 100;
  for (let i = 0; i < lines; i++) {
    const ref = `INV-${base + i}`;
    const amount = Math.round((0.5 + r() * 14.5) * 40) * 25;
    const day = 1 + Math.floor(r() * days);
    const who = CUSTOMERS[Math.floor(r() * CUSTOMERS.length)];
    const bankAmount = i < mismatch ? amount + [50, -125, 1, -7.5][i % 4] : amount;
    bank.push(t(bank.length + 1, ref, day, bankAmount, `TRF ${who}`));
    if (i >= lines - onlyErp) continue;
    erp.push(t(erp.length + 1, ref, day, amount, `Payment ${who}`));
  }
  for (let i = 0; i < onlyErp; i++) bank.pop();
  for (let i = 0; i < onlyErp; i++) {
    const ref = `INV-${base + lines + i}`;
    erp.push(t(erp.length + 1, ref, 1 + Math.floor(r() * days), Math.round((1 + r() * 8) * 40) * 25, `Payment ${CUSTOMERS[i % CUSTOMERS.length]}`));
  }
  for (let i = 0; i < onlyBank; i++) bank.push(t(bank.length + 1, `TRF-${2000 + seed % 100 + i}`, 1 + Math.floor(r() * days), [-6.5, 2150, 48.25][i % 3], ["Bank admin fee", "Incoming transfer, no invoice reference", "Interest income"][i % 3]));
  for (let i = 0; i < dup; i++) {
    const src = bank[3 + i * 5];
    bank.push({ ...src, row: bank.length + 1 });
  }
  return { bank, erp };
}

function presetFor(closed: boolean, openShare: number, seed: number) {
  const r = rng(seed);
  return (row: ResultRow): Preset | null => {
    if (!closed && r() < openShare) return null;
    const notes = NOTES[row.status] ?? ["Reviewed"];
    const ignore = row.status === "unmatched_b" && r() < 0.5;
    return { resolution: ignore ? "ignored" : "resolved", note: notes[Math.floor(r() * notes.length)] };
  };
}

export async function seedDemo(store: Store) {
  const [accounts, runs] = await Promise.all([store.listAccounts(), store.listRuns()]);
  if (accounts.length || runs.length) return;

  const ops = await store.createAccount({ name: "Operating", bank: "BCA", last4: "4821", currency: "USD" });
  const payroll = await store.createAccount({ name: "Collections", bank: "Mandiri", last4: "0937", currency: "USD" });

  const history: Array<Shape & { account: string; acct: string; closed: boolean; open: number }> = [
    { account: ops.id, acct: "BCA Operating", period: "2026-08", lines: 52, mismatch: 2, onlyBank: 2, onlyErp: 1, dup: 0, seed: 8, closed: true, open: 0 },
    { account: payroll.id, acct: "Mandiri Collections", period: "2026-08", lines: 31, mismatch: 1, onlyBank: 1, onlyErp: 1, dup: 0, seed: 18, closed: true, open: 0 },
    { account: ops.id, acct: "BCA Operating", period: "2026-09", lines: 58, mismatch: 1, onlyBank: 2, onlyErp: 2, dup: 1, seed: 9, closed: true, open: 0 },
    { account: payroll.id, acct: "Mandiri Collections", period: "2026-09", lines: 34, mismatch: 2, onlyBank: 1, onlyErp: 0, dup: 0, seed: 19, closed: true, open: 0 },
    { account: ops.id, acct: "BCA Operating", period: "2026-10", lines: 61, mismatch: 3, onlyBank: 3, onlyErp: 2, dup: 1, seed: 10, closed: false, open: 0.55 },
    { account: payroll.id, acct: "Mandiri Collections", period: "2026-10", lines: 36, mismatch: 2, onlyBank: 2, onlyErp: 1, dup: 1, seed: 20, closed: false, open: 0.7 },
  ];

  for (const h of history) {
    const { bank, erp } = month(h);
    const [y, m] = h.period.split("-").map(Number);
    const created = new Date(Date.UTC(y, m, 3, 2, 15 + h.seed)).toISOString();
    const closedAt = new Date(Date.UTC(y, m, 6, 9, 40)).toISOString();
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" });
    const name = `${h.acct} · ${label}`;
    const run = await store.createRun({
      account_id: h.account,
      name,
      period: h.period,
      bank_file: `mutasi-${h.acct.split(" ")[0].toLowerCase()}-${h.period}.csv`,
      erp_file: `gl-1102-${h.period}.csv`,
      bank_lines: bank.length,
      erp_lines: erp.length,
      result: reconcile(bank, erp),
      created_at: created,
      status: h.closed ? "closed" : "in_review",
      closed_at: h.closed ? closedAt : null,
      preset: presetFor(h.closed, h.open, h.seed * 7),
    });
    await store.log("Ran reconciliation", name, run.id, created);
    if (h.closed) await store.log("Closed period", name, run.id, closedAt);
  }
}
