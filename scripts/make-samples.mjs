// Sample files. The same transactions are written in three bank formats, and every one of
// them must reconcile to: 39 matched, 3 mismatch, 2 bank-only, 3 ERP-only, 2 duplicates.
//   bank.csv               clean CSV, 22/11/2026 dates, "1.625,00" amounts, messy refs
//   mutasi-rekening.csv    internet-banking export: account info above the table,
//                          "1,625.00 CR" amounts, references buried in the description
//   bank-statement.xlsx    Excel workbook: title rows, real date cells, Debit/Credit columns
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import writeExcelFile from "write-excel-file/node";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "reconpilot", "public", "samples");
mkdirSync(out, { recursive: true });

const vendors = ["PT Sinar Jaya", "CV Maju Bersama", "PT Nusantara Logistik", "Toko Abadi", "PT Kencana Mas", "CV Delta Teknik", "PT Samudra Raya", "UD Berkah"];
const pad = (n) => String(n).padStart(2, "0");

const erp = [];
for (let i = 1; i <= 45; i++) {
  const day = ((i * 7) % 28) + 1;
  const cents = i % 9 === 0 ? 0.5 : 0;
  const amount = ((i * 1375) % 9000) + 250 + cents;
  erp.push({ ref: `INV-${1000 + i}`, date: `2026-11-${pad(day)}`, day, amount, desc: `Payment ${vendors[i % vendors.length]}` });
}

const dotted = (n) => {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
};
const commas = (n) => Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const csvCell = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const mismatch = { "INV-1007": 50, "INV-1019": -125, "INV-1033": 1 };
const messyRef = (ref, i) => (i % 5 === 0 ? `${ref} ` : i % 7 === 0 ? ref.toLowerCase() : ref);

const bank = [];
erp.slice(0, 42).forEach((t, idx) => {
  const i = idx + 1;
  bank.push({ ref: messyRef(t.ref, i), day: t.day, amount: t.amount + (mismatch[t.ref] ?? 0), desc: `TRF ${t.desc.replace("Payment ", "")}` });
});
bank.push({ ...bank[11] }); // INV-1012, posted twice by the bank
bank.push({ ...bank[24] }); // INV-1025, posted twice by the bank
bank.push({ ref: "TRF-2001", day: 14, amount: -6.5, desc: "Bank admin fee" });
bank.push({ ref: "TRF-2002", day: 27, amount: 2150, desc: "Incoming transfer, no invoice reference" });

// 1. clean CSV
writeFileSync(
  join(out, "bank.csv"),
  ["Tanggal,Referensi,Keterangan,Nominal", ...bank.map((t) => [`${pad(t.day)}/11/2026`, t.ref, t.desc, (t.amount < 0 ? "-" : "") + dotted(t.amount)].map(csvCell).join(","))].join("\n") + "\n",
);

// 2. internet-banking export
const sorted = [...bank].sort((a, b) => a.day - b.day);
let balance = 120000;
const mutasi = [
  "No. rekening : 0123456789",
  "Nama : PT NUSANTARA NIAGA",
  "Periode : 01/11/2026 - 30/11/2026",
  "Kode Mata Uang : USD",
  "",
  "Tanggal Transaksi,Keterangan,Cabang,Jumlah,Saldo",
  ...sorted.map((t) => {
    balance += t.amount;
    return [`${pad(t.day)}/11/2026`, `${t.desc.toUpperCase()} ${t.ref}`, "0998", `${commas(t.amount)} ${t.amount < 0 ? "DB" : "CR"}`, commas(balance)].map(csvCell).join(",");
  }),
  "",
  `Saldo Awal : ${commas(120000)}`,
  `Saldo Akhir : ${commas(balance)}`,
];
writeFileSync(join(out, "mutasi-rekening.csv"), mutasi.join("\n") + "\n");

// 3. Excel workbook
const money = (v) => (v ? { value: v, format: "#,##0.00" } : null);
balance = 120000;
const sheet = [
  [{ value: "Account statement — Operating account ••4821", fontWeight: "bold" }],
  ["Period: 1–30 November 2026 · Currency: USD"],
  [],
  ["Date", "Description", "Reference", "Debit", "Credit", "Balance"].map((h) => ({ value: h, fontWeight: "bold" })),
  ...sorted.map((t) => {
    balance += t.amount;
    return [
      { value: new Date(Date.UTC(2026, 10, t.day)), type: Date, format: "mm/dd/yyyy" },
      t.desc,
      t.ref,
      money(t.amount < 0 ? -t.amount : 0),
      money(t.amount > 0 ? t.amount : 0),
      money(balance),
    ];
  }),
];
await writeExcelFile(sheet, { columns: [{ width: 12 }, { width: 38 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 }] }).toFile(join(out, "bank-statement.xlsx"));

writeFileSync(
  join(out, "erp.csv"),
  ["date,reference,description,amount", ...erp.map((t) => [t.date, t.ref, t.desc, t.amount.toFixed(2)].map(csvCell).join(","))].join("\n") + "\n",
);
console.log(`wrote ${bank.length} bank rows in 3 formats and ${erp.length} ERP rows to ${out}`);
