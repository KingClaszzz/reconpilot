// Sample files. bank.csv looks like a real Indonesian export (22/11/2026, 1.250.000,00, messy refs).
// Expected result, checked by the Kane specs: 39 matched, 3 mismatch, 2 bank-only, 3 ERP-only, 2 duplicates.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "reconpilot", "public", "samples");
mkdirSync(out, { recursive: true });

const vendors = ["PT Sinar Jaya", "CV Maju Bersama", "PT Nusantara Logistik", "Toko Abadi", "PT Kencana Mas", "CV Delta Teknik", "PT Samudra Raya", "UD Berkah"];
const pad = (n) => String(n).padStart(2, "0");

const erp = [];
for (let i = 1; i <= 45; i++) {
  const day = ((i * 7) % 28) + 1;
  const cents = i % 9 === 0 ? 0.5 : 0;
  const amount = ((i * 1_375_000) % 9_000_000) + 250_000 + cents;
  erp.push({ ref: `INV-${1000 + i}`, date: `2026-11-${pad(day)}`, day, amount, desc: `Payment ${vendors[i % vendors.length]}` });
}

const idAmount = (n) => {
  const [int, dec] = n.toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
};
const csvCell = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const mismatch = { "INV-1007": 50_000, "INV-1019": -125_000, "INV-1033": 1_000 };
const messyRef = (ref, i) => (i % 5 === 0 ? `${ref} ` : i % 7 === 0 ? ref.toLowerCase() : ref);

const bank = [];
erp.slice(0, 42).forEach((t, idx) => {
  const i = idx + 1;
  bank.push({ ref: messyRef(t.ref, i), day: t.day, amount: t.amount + (mismatch[t.ref] ?? 0), desc: `TRF ${t.desc.replace("Payment ", "")}` });
});
// posted twice by the bank
bank.push({ ...bank[11] }); // INV-1012
bank.push({ ...bank[24] }); // INV-1025
// bank-only items
bank.push({ ref: "TRF-2001", day: 14, amount: 6_500, desc: "Biaya admin bank" });
bank.push({ ref: "TRF-2002", day: 27, amount: 2_150_000, desc: "Transfer masuk tanpa referensi invoice" });

writeFileSync(
  join(out, "bank.csv"),
  ["Tanggal,Referensi,Keterangan,Nominal", ...bank.map((t) => [`${pad(t.day)}/11/2026`, t.ref, t.desc, idAmount(t.amount)].map(csvCell).join(","))].join("\n") + "\n",
);
writeFileSync(
  join(out, "erp.csv"),
  ["date,reference,description,amount", ...erp.map((t) => [t.date, t.ref, t.desc, t.amount.toFixed(2)].map(csvCell).join(","))].join("\n") + "\n",
);
console.log(`wrote ${bank.length} bank rows and ${erp.length} ERP rows to ${out}`);
