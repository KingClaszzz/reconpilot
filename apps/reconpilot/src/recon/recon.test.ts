import { describe, expect, it } from "vitest";
import { normalizeRef, parseAmount, parseDate } from "./parse";

describe("parser", () => {
  it("parses amounts", () => expect(parseAmount("1250000.00")).toBe(1250000));
  it("parses comma-thousands amounts", () => expect(parseAmount("1,250,000.00")).toBe(1250000));
  it("parses dot-thousands, comma-decimal amounts", () => expect(parseAmount("1.250.000,00")).toBe(1250000));
  it("parses a comma decimal", () => expect(parseAmount("6,50")).toBe(6.5));
  it("parses ISO dates", () => expect(parseDate("2026-11-03")).toBe("2026-11-03"));
  it("parses day-first slash dates", () => expect(parseDate("22/11/2026")).toBe("2026-11-22"));
  it("parses month-first slash dates", () => expect(parseDate("11/22/2026", "mdy")).toBe("2026-11-22"));
  it("uppercases references", () => expect(normalizeRef("inv-1001")).toBe("INV-1001"));
  it("trims references", () => expect(normalizeRef(" inv-1001 ")).toBe("INV-1001"));
});
