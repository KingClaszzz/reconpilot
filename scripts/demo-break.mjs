// Plants three bugs in the parser. Unit tests on clean data still pass; the real bank export breaks.
//   1. "1.625.000,00" is read as 1.625
//   2. references aren't trimmed
//   3. 08/11/2026 is read as 11 Aug
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "apps", "reconpilot", "src", "recon", "parse.ts");
let src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");

function swap(label, pattern, replacement) {
  if (!pattern.test(src)) {
    console.error(`✗ could not plant bug "${label}" (already planted, or parse.ts changed)`);
    process.exit(1);
  }
  src = src.replace(pattern, replacement);
  console.log(`✓ planted: ${label}`);
}

swap(
  "amounts ignore Indonesian thousand separators",
  /export function parseAmount\(raw: string\): number \| null \{[\s\S]*?\n\}\n/,
  `export function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.,-]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
`,
);

swap("references are not trimmed", /return raw\.trim\(\)\.replace\(\/\\s\+\/g, " "\)\.toUpperCase\(\);/, `return raw.replace(/\\s+/g, " ").toUpperCase();`);

swap("slash dates read month-first", /\[d, m, y\] = \[Number\(match\[1\]\), Number\(match\[2\]\), Number\(match\[3\]\)\];/, "[m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];");

writeFileSync(file, src);

// the tests a rushed agent would write
const testFile = join(root, "apps", "reconpilot", "src", "recon", "recon.test.ts");
writeFileSync(
  testFile,
  `import { describe, expect, it } from "vitest";
import { normalizeRef, parseAmount, parseDate } from "./parse";

describe("parser", () => {
  it("parses amounts", () => expect(parseAmount("1250000.00")).toBe(1250000));
  it("parses ISO dates", () => expect(parseDate("2026-11-03")).toBe("2026-11-03"));
  it("uppercases references", () => expect(normalizeRef("inv-1001")).toBe("INV-1001"));
});
`,
);
console.log("✓ trimmed unit tests to the happy path (they still pass)");
