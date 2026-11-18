import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { store } from "../lib/store";
import { errMsg, useToast } from "../lib/toast";
import type { Account, Run } from "../lib/types";
import { Icon, PageHead, RunStatusChip, formatPeriod } from "../components/ui";
import { matchRate } from "../components/RunsTable";
import { Reveal } from "../lib/motion";

const BANKS = ["BCA", "Mandiri", "BNI", "BRI", "CIMB Niaga", "Chase", "Bank of America", "Wells Fargo", "HSBC", "Citi", "DBS", "Barclays", "Wise", "Other"];
const CURRENCIES = ["USD", "EUR", "GBP", "SGD", "IDR", "AUD", "JPY"];

export default function Accounts() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [form, setForm] = useState({ name: "", bank: "BCA", number: "", currency: "USD" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([store.listAccounts(), store.listRuns()]).then(([a, r]) => {
      setAccounts(a);
      setRuns(r);
    });
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    const digits = form.number.replace(/\D/g, "");
    if (digits.length < 4) return toast("Enter at least the last 4 digits of the account number.", "err");
    setAdding(true);
    try {
      const acc = await store.createAccount({ name: form.name.trim().slice(0, 80), bank: form.bank, last4: digits.slice(-4), currency: form.currency });
      setAccounts((l) => [...(l ?? []), acc]);
      setForm({ ...form, name: "", number: "" });
      toast(`${acc.bank} ${acc.name} added`);
    } catch (err) {
      toast(errMsg(err), "err");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Bank accounts" title="Accounts" sub="The bank accounts you reconcile each month. Only the last four digits of an account number are ever stored." />
      <Reveal className="acct-grid">
        {(accounts ?? []).map((a) => {
          const mine = runs.filter((r) => r.account_id === a.id);
          const latest = mine[0];
          return (
            <article key={a.id} className="acct">
              <header>
                <span className="acct-bank">{a.bank}</span>
                <span className="acct-no">{a.currency} · •••• {a.last4}</span>
              </header>
              <h3>{a.name}</h3>
              <dl>
                <div><dt>Periods</dt><dd>{mine.length}</dd></div>
                <div><dt>Latest</dt><dd>{latest ? formatPeriod(latest.period) : "—"}</dd></div>
                <div><dt>Match rate</dt><dd>{latest ? `${matchRate(latest).toFixed(1)}%` : "—"}</dd></div>
              </dl>
              <footer>
                {latest ? <RunStatusChip s={latest.status} /> : <span className="muted small">No reconciliation yet</span>}
                {latest && <Link to={`/app/runs/${latest.id}`} className="link-arrow">Open <Icon name="arrow" size={14} /></Link>}
              </footer>
            </article>
          );
        })}
        <form className="acct add" onSubmit={add}>
          <h3>Add a bank account</h3>
          <label className="field">
            <span>Name</span>
            <input required maxLength={80} placeholder="e.g. Operating" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Bank</span>
              <select value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })}>
                {BANKS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Account number</span>
              <input inputMode="numeric" autoComplete="off" placeholder="last 4 is enough" maxLength={24} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>Currency</span>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <button type="submit" className="btn primary" disabled={adding}>
            <Icon name="plus" size={16} /> {adding ? "Adding…" : "Add account"}
          </button>
        </form>
      </Reveal>
    </div>
  );
}
