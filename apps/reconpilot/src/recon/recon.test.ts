import { describe, expect, it } from "vitest";
import { normalizeRef, parseAmount, parseDate } from "./parse";

describe("parser", () => {
  it("parses amounts", () => expect(parseAmount("1250000.00")).toBe(1250000));
  it("parses ISO dates", () => expect(parseDate("2026-11-03")).toBe("2026-11-03"));
  it("uppercases references", () => expect(normalizeRef("inv-1001")).toBe("INV-1001"));
});
