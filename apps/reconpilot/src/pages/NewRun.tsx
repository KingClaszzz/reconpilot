import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { parseCsv, parseTable, type DateOrder, type ParsedFile } from "../recon/parse";
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

  // CSV is read as text; Excel workbooks are unzipped in the browser (nothing is uploaded).
  async function parseFile(name: string, data: Blob): Promise<ParsedFile> {
    const lower = name.toLowerCase();
    if (lower.endsWith(".xls")) throw new Error(`${name} is an old Excel 97 file. Save it as .xlsx or CSV and try again.`);
    const head = new Uint8Array(await data.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b; // "PK": .xlsx even if renamed
    if (lower.endsWith(".xlsx") || isZip) {
      const { readSheet } = await import("read-excel-file/universal");
      return parseTable(await readSheet(await data.arrayBuffer()));
    }
    return parseCsv(await data.text());
  }
  async function readFile(side: Side, f: File) {
    if (f.size > MAX_BYTES) return toast(`${f.name} is larger than 15 MB. Split the export by month.`, "err");
    try {
      const parsed = await parseFile(f.name, f);
      setFiles((x) => ({ ...x, [side]: { name: f.name, parsed } }));
    } catch (e) {
      toast(errMsg(e) || `Couldn't read ${f.name}`, "err");
    }
  }
  function setDateOrder(side: Side, order: DateOrder) {
    setFiles((x) => {
      const cur = x[side];
      return cur ? { ...x, [side]: { ...cur, parsed: parseTable(cur.parsed.table, { dateOrder: order }) } } : x;
    });
  }
  async function loadSamples(bankFile = "bank.csv") {
    try {
      const [bank, erp] = await Promise.all([bankFile, "erp.csv"].map((u) => fetch(`/samples/${u}`).then((r) => r.blob())));
      const [a, b] = await Promise.all([parseFile(bankFile, bank), parseFile("erp.csv", erp)]);
      setFiles({ A: { name: bankFile, parsed: a }, B: { name: "erp.csv", parsed: b } });
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
          <button type="button" className="btn ghost" onClick={() => loadSamples()} data-testid="load-samples">
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
              <DropZone step={1} title="Bank statement" hint="Statement export from internet banking, CSV or .xlsx" testid="upload-bank" file={files.A} onFile={(f) => readFile("A", f)} onDateOrder={(o) => setDateOrder("A", o)} />
              <DropZone step={2} title="ERP ledger" hint="Cash/bank GL lines from your ERP" testid="upload-erp" file={files.B} onFile={(f) => readFile("B", f)} onDateOrder={(o) => setDateOrder("B", o)} />
            </div>
            <div className="samples-row">
              <span>Real-world exports:</span>
              <button type="button" className="hint" onClick={() => loadSamples("mutasi-rekening.csv")} data-testid="sample-internet-banking">Internet banking CSV</button>
              <button type="button" className="hint" onClick={() => loadSamples("bank-statement.xlsx")} data-testid="sample-xlsx">Excel workbook (.xlsx)</button>
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
                : "CSV or Excel. References are compared after trimming spaces and ignoring case; 1,625.00 and 1.625,00 both work, and the day/month order is worked out per file."}
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
