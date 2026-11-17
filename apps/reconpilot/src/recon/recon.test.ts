import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeRef, parseAmount, parseCsv, parseDate } from "./parse";
import { reconcile } from "./match";

describe("parseAmount", () => {
  it.each([
    ["1250000.00", 1250000],
    ["1.250.000,00", 1250000],
    ["1,250,000.00", 1250000],
    ["Rp 1.250.000", 1250000],
    ["6.500,00", 6500],
    ["1250,50", 1250.5],
    ["(500.000,00)", -500000],
    ["abc", null],
  ])("%s -> %s", (raw, expected) => expect(parseAmount(raw)).toBe(expected));
});

describe("parseDate", () => {
  it("reads ISO dates", () => expect(parseDate("2026-11-03")).toBe("2026-11-03"));
  it("reads day-first dates", () => expect(parseDate("03/11/2026")).toBe("2026-11-03"));
  it("reads day > 12", () => expect(parseDate("25/11/2026")).toBe("2026-11-25"));
  it("rejects impossible dates", () => expect(parseDate("31/02/2026")).toBeNull());
});

describe("normalizeRef", () => {
  it("trims and uppercases", () => expect(normalizeRef(" inv-1001 ")).toBe("INV-1001"));
});

describe("reconcile sample files", () => {
  const dir = join(__dirname, "..", "..", "public", "samples");
  const bank = parseCsv(readFileSync(join(dir, "bank.csv"), "utf8"));
  const erp = parseCsv(readFileSync(join(dir, "erp.csv"), "utf8"));
  const result = reconcile(bank.txns, erp.txns);

  it("detects columns in both files", () => {
    expect(bank.missing).toEqual([]);
    expect(erp.missing).toEqual([]);
  });
  it("produces the expected counts", () => {
    expect(result.counts).toEqual({ matched: 39, amount_mismatch: 3, unmatched_a: 2, unmatched_b: 3, duplicate: 2 });
  });
  it("reports the INV-1007 difference", () => {
    expect(result.rows.find((r) => r.ref === "INV-1007")?.diff).toBe(50000);
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
