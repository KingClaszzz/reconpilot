const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cache = new Map<string, Intl.NumberFormat>();
function fmt(currency: string, compact: boolean) {
  const key = `${currency}:${compact}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency, ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
    cache.set(key, f);
  }
  return f;
}

// "$1,625.00"; pass an account's currency for anything else.
export function formatMoney(n: number | null | undefined, currency = "USD"): string {
  if (n === null || n === undefined) return "—";
  return fmt(currency, false).format(n);
}

// "$36.1K"
export function formatMoneyShort(n: number, currency = "USD"): string {
  return fmt(currency, true).format(n);
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
