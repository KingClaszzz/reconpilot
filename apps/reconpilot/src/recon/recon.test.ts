import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSheet } from "read-excel-file/universal";
import { detectDateOrder, normalizeRef, parseAmount, parseCsv, parseDate, parseSignedAmount, parseTable } from "./parse";
import { reconcile } from "./match";

describe("parseAmount", () => {
  it.each([
    ["1250000.00", 1250000],
    ["1.250.000,00", 1250000],
    ["1,250,000.00", 1250000],
    ["Rp 1.250.000", 1250000],
    ["$1,625.00", 1625],
    ["USD 1,625.00", 1625],
    ["€1.625,50", 1625.5],
    ["6.500,00", 6500],
    ["1250,50", 1250.5],
    ["(500.000,00)", -500000],
    ["abc", null],
  ])("%s -> %s", (raw, expected) => expect(parseAmount(raw)).toBe(expected));
});

describe("parseSignedAmount", () => {
  it.each([
    ["1,625.00 CR", 1625],
    ["6.50 DB", -6.5],
    ["6.50 DR", -6.5],
    ["1.625,00 K", 1625],
    ["1.625,00 D", -1625],
    ["1625.00", 1625],
  ])("%s -> %s", (raw, expected) => expect(parseSignedAmount(raw)).toBe(expected));
});

describe("parseDate", () => {
  it("reads ISO dates", () => expect(parseDate("2026-11-03")).toBe("2026-11-03"));
  it("reads day-first dates", () => expect(parseDate("03/11/2026")).toBe("2026-11-03"));
  it("reads day > 12", () => expect(parseDate("25/11/2026")).toBe("2026-11-25"));
  it("reads month-first when told to", () => expect(parseDate("11/03/2026", "mdy")).toBe("2026-11-03"));
  it("reads month names", () => {
    expect(parseDate("22 Nov 2026")).toBe("2026-11-22");
    expect(parseDate("Nov 22, 2026")).toBe("2026-11-22");
    expect(parseDate("22-Des-2026")).toBe("2026-12-22");
  });
  it("rejects impossible dates", () => expect(parseDate("31/02/2026")).toBeNull());
});

describe("detectDateOrder", () => {
  it("is sure about day-first when a day is above 12", () => expect(detectDateOrder(["03/11/2026", "22/11/2026"])).toEqual({ order: "dmy", certain: true }));
  it("is sure about month-first when a day is in the middle", () => expect(detectDateOrder(["11/03/2026", "11/22/2026"])).toEqual({ order: "mdy", certain: true }));
  it("admits when it can't tell", () => expect(detectDateOrder(["03/11/2026", "05/11/2026"])).toEqual({ order: "dmy", certain: false }));
  it("is sure when every date is ISO", () => expect(detectDateOrder(["2026-11-03"]).certain).toBe(true));
});

describe("normalizeRef", () => {
  it("trims and uppercases", () => expect(normalizeRef(" inv-1001 ")).toBe("INV-1001"));
});

describe("real-world layouts", () => {
  it("skips account info above the table and reads semicolon CSVs saved by Excel", () => {
    const p = parseCsv("﻿Statement for 0123456789\r\nPeriod: November\r\n\r\nTanggal;Referensi;Keterangan;Nominal\r\n22/11/2026;INV-1007;TRF;1.625,00\r\n");
    expect(p.skipped).toBe(2);
    expect(p.missing).toEqual([]);
    expect(p.txns[0]).toMatchObject({ ref: "INV-1007", date: "2026-11-22", amount: 1625 });
  });
  it("combines Debit and Credit columns", () => {
    const p = parseTable([["Date", "Reference", "Debit", "Credit"], ["2026-11-22", "INV-1", "", "1,625.00"], ["2026-11-23", "FEE-100", "6.50", ""]]);
    expect(p.columns.amount).toBe("Credit − Debit");
    expect(p.txns.map((t) => t.amount)).toEqual([1625, -6.5]);
  });
  it("finds the reference inside the description when there is no reference column", () => {
    const p = parseCsv("Date,Description,Amount\n22/11/2026,TRF UD BERKAH inv-1007 ,925.00\n");
    expect(p.refFromText).toBe(true);
    expect(p.txns[0].ref).toBe("INV-1007");
  });
  it("drops footer lines", () => {
    const p = parseCsv("Date,Reference,Amount\n22/11/2026,INV-1,10.00\n\nSaldo Akhir : 1,234.00\n");
    expect(p.txns).toHaveLength(1);
  });
  it("keeps lines without a reference so a person sees them", () => {
    const r = reconcile(parseCsv("Date,Reference,Amount\n22/11/2026,,10.00\n").txns, []);
    expect(r.rows[0]).toMatchObject({ status: "unmatched_a", ref: "(no reference)" });
  });
});

describe("sample files reconcile the same in every format", () => {
  const dir = join(__dirname, "..", "..", "public", "samples");
  const erp = parseCsv(readFileSync(join(dir, "erp.csv"), "utf8"));
  const expected = { matched: 39, amount_mismatch: 3, unmatched_a: 2, unmatched_b: 3, duplicate: 2 };

  it("bank.csv", () => {
    const bank = parseCsv(readFileSync(join(dir, "bank.csv"), "utf8"));
    expect(bank.missing).toEqual([]);
    const r = reconcile(bank.txns, erp.txns);
    expect(r.counts).toEqual(expected);
    expect(r.rows.find((x) => x.ref === "INV-1007")?.diff).toBe(50);
  });
  it("mutasi-rekening.csv (header rows, CR/DB, refs in text)", () => {
    const bank = parseCsv(readFileSync(join(dir, "mutasi-rekening.csv"), "utf8"));
    expect(bank.skipped).toBe(4); // account info lines; the blank line is dropped first
    expect(bank.refFromText).toBe(true);
    expect(reconcile(bank.txns, erp.txns).counts).toEqual(expected);
  });
  it("bank-statement.xlsx (title rows, Debit/Credit, date cells)", async () => {
    const buf = readFileSync(join(dir, "bank-statement.xlsx"));
    const rows = await readSheet(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const bank = parseTable(rows);
    expect(bank.columns.amount).toBe("Credit − Debit");
    expect(bank.txns.find((t) => t.ref === "INV-1007")).toMatchObject({ date: "2026-11-22", amount: 925 });
    expect(reconcile(bank.txns, erp.txns).counts).toEqual(expected);
  });
});

describe("export", () => {
  it("neutralises spreadsheet formulas from uploaded text", async () => {
    const { toCsv } = await import("./match");
    const t = { row: 1, date: "2026-11-01", ref: "INV-1", rawRef: "INV-1", rawDate: "", rawAmount: "", description: '=HYPERLINK("http://evil","x")', amount: -5 };
    const csv = toCsv({ rows: [{ id: "a", status: "unmatched_a", ref: "INV-1", a: t, b: null, diff: null }], counts: {} as never, totals: { a: 0, b: 0, net: 0 } });
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain(",-5,");
  });
});
