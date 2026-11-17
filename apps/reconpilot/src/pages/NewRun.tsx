import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { parseCsv, type ParsedFile } from "../recon/parse";
import { reconcile } from "../recon/match";
import { store } from "../lib/store";
import { errMsg, useToast } from "../lib/toast";
import type { Account } from "../lib/types";
import { DropZone } from "../components/DropZone";
import { Icon, PageHead, formatPeriod } from "../components/ui";

type Side = "A" | "B";
interface Loaded {
  name: string;
  parsed: ParsedFile;
}

const thisMonth = () => new Date().toISOString().slice(0, 7);
const MAX_BYTES = 15 * 1024 * 1024;

export default function NewRun() {
  const nav = useNavigate();
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [period, setPeriod] = useState(thisMonth());
  const [files, setFiles] = useState<Partial<Record<Side, Loaded>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    store.listAccounts().then((a) => {
      setAccounts(a);
      if (a[0]) setAccountId((id) => id || a[0].id);
    });
  }, []);

  function setFile(side: Side, name: string, text: string) {
    setFiles((f) => ({ ...f, [side]: { name, parsed: parseCsv(text) } }));
  }
  async function readFile(side: Side, f: File) {
    if (f.size > MAX_BYTES) return toast(`${f.name} is larger than 15 MB. Split the export by month.`, "err");
    setFile(side, f.name, await f.text());
  }
  async function loadSamples() {
    try {
      const [bank, erp] = await Promise.all(["/samples/bank.csv", "/samples/erp.csv"].map((u) => fetch(u).then((r) => r.text())));
      setFile("A", "bank.csv", bank);
      setFile("B", "erp.csv", erp);
      setPeriod("2026-11");
    } catch (e) {
      toast(errMsg(e), "err");
    }
  }

  const missing = (["A", "B"] as Side[]).flatMap((s) => (files[s]?.parsed.missing.length ? [`${files[s]!.name} has no ${files[s]!.parsed.missing.join(" or ")} column`] : []));
  const empty = (["A", "B"] as Side[]).flatMap((s) => (files[s] && !files[s]!.parsed.txns.length ? [`${files[s]!.name} has no rows`] : []));
  const ready = Boolean(files.A && files.B && !missing.length && !empty.length && /^\d{4}-\d{2}$/.test(period));
  const account = accounts.find((a) => a.id === accountId);

  async function run() {
    if (!files.A || !files.B) return;
    setBusy(true);
    try {
      const result = reconcile(files.A.parsed.txns, files.B.parsed.txns);
      const name = `${account ? `${account.bank} ${account.name}` : "Bank"} · ${formatPeriod(period)}`;
      const saved = await store.createRun({
        account_id: account?.id ?? null,
        name,
        period,
        bank_file: files.A.name,
        erp_file: files.B.name,
        bank_lines: files.A.parsed.txns.length,
        erp_lines: files.B.parsed.txns.length,
        result,
      });
      nav(`/app/runs/${saved.id}`);
    } catch (e) {
      toast(errMsg(e), "err");
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <PageHead
        eyebrow={<Link to="/app/runs" className="crumb">← Reconciliations</Link>}
        title="New reconciliation"
        sub="Pick the bank account and month, then drop the two exports. Files are parsed in your browser; only the matched result is saved."
        actions={
          <button type="button" className="btn ghost" onClick={loadSamples} data-testid="load-samples">
            Load sample data
          </button>
        }
      />

      <ol className="wizard">
        <li className="wiz-step">
          <div className="wiz-num">01</div>
          <div className="wiz-body">
            <h2>Account and period</h2>
            <div className="field-row">
              <label className="field">
                <span>Bank account</span>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.bank} {a.name} ••{a.last4}</option>
                  ))}
                  <option value="">Other / not listed</option>
                </select>
              </label>
              <label className="field">
                <span>Period</span>
                <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
              </label>
            </div>
            {!accounts.length && <p className="muted small">No bank accounts yet. <Link to="/app/accounts">Add one</Link> to track periods per account.</p>}
          </div>
        </li>
        <li className="wiz-step">
          <div className="wiz-num">02</div>
          <div className="wiz-body">
            <h2>Exports</h2>
            <div className="drops">
              <DropZone step={1} title="Bank statement" hint="Mutasi rekening from internet banking" testid="upload-bank" file={files.A} onFile={(f) => readFile("A", f)} />
              <DropZone step={2} title="ERP ledger" hint="Cash/bank GL lines from your ERP" testid="upload-erp" file={files.B} onFile={(f) => readFile("B", f)} />
            </div>
            {[...missing, ...empty].map((m) => (
              <p key={m} className="warn">⚠ {m}. Rename the header or export again.</p>
            ))}
          </div>
        </li>
        <li className="wiz-step">
          <div className="wiz-num">03</div>
          <div className="wiz-body">
            <h2>Match</h2>
            <p className="muted">
              {files.A && files.B
                ? `${files.A.parsed.txns.length.toLocaleString("en")} bank lines against ${files.B.parsed.txns.length.toLocaleString("en")} ERP lines, matched on reference.`
                : "References are compared after trimming spaces and ignoring case. Dates like 22/11/2026 and amounts like 1.625.000,00 are read as Indonesian banks write them."}
            </p>
            <button type="button" className="btn primary lg" disabled={!ready || busy} onClick={run} data-testid="reconcile">
              {busy ? "Saving…" : "Reconcile"} <Icon name="arrow" size={16} />
            </button>
          </div>
        </li>
      </ol>
    </div>
  );
}
