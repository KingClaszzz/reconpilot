const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rupiahShort = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 1 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatIDR(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return rupiah.format(n).replace(/ /g, " ");
}

export function formatIDRShort(n: number): string {
  return rupiahShort.format(n).replace(/ /g, " ");
}

// "2026-11-08" -> "8 Nov 2026"
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatShare(part: number, whole: number): string {
  if (!whole) return "0%";
  const pct = (part / whole) * 100;
  return `${pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)}%`;
}
