import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { errMsg, useToast } from "../lib/toast";
import { CountUp, Decode, Reveal, reducedMotion, useInView } from "../lib/motion";
import { Icon, Logo, Mascot } from "../components/ui";

export function DemoButton({ className = "btn primary lg", label = "Try the live demo" }: { className?: string; label?: string }) {
  const { startDemo } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await startDemo();
          nav("/app");
        } catch (e) {
          toast(errMsg(e), "err");
          setBusy(false);
        }
      }}
    >
      {busy ? "Opening demo…" : label}
      <Icon name="arrow" size={16} />
    </button>
  );
}

function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--dot").trim() || "#c9c4b6";
    const accent = css.getPropertyValue("--accent").trim() || "#2b44ff";
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mouse = { x: -999, y: -999, tx: -999, ty: -999 };
    const GAP = 22;
    const resize = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      ctx.clearRect(0, 0, w, h);
      for (let y = GAP / 2; y < h; y += GAP) {
        for (let x = GAP / 2; x < w; x += GAP) {
          const d = Math.hypot(x - mouse.x, y - mouse.y);
          const k = Math.max(0, 1 - d / 170);
          ctx.fillStyle = k > 0.35 ? accent : ink;
          ctx.globalAlpha = 0.55 + k * 0.45;
          ctx.beginPath();
          ctx.arc(x, y, 1 + k * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      mouse.tx = e.clientX - r.left;
      mouse.ty = e.clientY - r.top;
    };
    const leave = () => {
      mouse.tx = -999;
      mouse.ty = -999;
    };
    resize();
    window.addEventListener("resize", resize);
    if (reducedMotion()) {
      draw();
      cancelAnimationFrame(raf);
    } else {
      window.addEventListener("pointermove", move);
      document.addEventListener("pointerleave", leave);
      raf = requestAnimationFrame(draw);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <canvas ref={ref} className="dotfield" aria-hidden />;
}

type Verdict = "ok" | "diff" | "bank" | "erp" | "dup";
const LINES: { bank: string | null; bankAmt: string; erp: string | null; erpAmt: string; v: Verdict; note: string }[] = [
  { bank: "INV-1001", bankAmt: "1.625,00", erp: "INV-1001", erpAmt: "1625.00", v: "ok", note: "matched" },
  { bank: "INV-1007", bankAmt: "925,00", erp: "INV-1007", erpAmt: "875.00", v: "diff", note: "+$50.00" },
  { bank: "inv-1012·", bankAmt: "7.750,00", erp: "INV-1012", erpAmt: "7750.00", v: "ok", note: "case + space fixed" },
  { bank: "TRF-2001", bankAmt: "6,50 DB", erp: null, erpAmt: "", v: "bank", note: "only in bank" },
  { bank: "INV-1019", bankAmt: "8.250,00", erp: "INV-1019", erpAmt: "8375.00", v: "diff", note: "−$125.00" },
  { bank: "INV-1025", bankAmt: "7.625,00", erp: "INV-1025", erpAmt: "7625.00", v: "ok", note: "matched" },
  { bank: "INV-1025", bankAmt: "7.625,00", erp: null, erpAmt: "", v: "dup", note: "posted twice" },
  { bank: null, bankAmt: "", erp: "INV-1043", erpAmt: "5375.00", v: "erp", note: "only in ERP" },
];
const STAMP: Record<Verdict, string> = { ok: "✓", diff: "≠", bank: "?", erp: "?", dup: "×2" };

function Machine() {
  const [ref, seen] = useInView<HTMLDivElement>("0px");
  const [step, setStep] = useState(reducedMotion() ? LINES.length : -1);
  useEffect(() => {
    if (!seen || reducedMotion()) return;
    let s = -1;
    const id = window.setInterval(() => {
      s = s >= LINES.length + 5 ? -1 : s + 1;
      setStep(s);
    }, 520);
    return () => window.clearInterval(id);
  }, [seen]);
  const done = Math.min(step, LINES.length);
  const review = LINES.slice(0, Math.max(0, done)).filter((l) => l.v !== "ok").length;
  const matched = Math.max(0, done) - review;

  const finished = step >= LINES.length;
  return (
    <div className="machine-wrap">
    <div ref={ref} className="machine" aria-label="Animated example: bank lines matched against ERP lines">
      <div className="machine-head">
        <span><i className="led" /> mutasi_bca_nov.csv</span>
        <span className="machine-vs">↔</span>
        <span>gl_1102_nov.csv <i className="led" /></span>
      </div>
      <div className="machine-body">
        {step >= 0 && step < LINES.length && <div className="scan" style={{ transform: `translateY(${step * 100}%)` }} />}
        {LINES.map((l, i) => {
          const state = i < done ? "done" : i === step ? "now" : "wait";
          return (
            <div key={i} className={`mline ${state} v-${l.v}`}>
              <span className="mcell bank">{l.bank ? <><b>{l.bank}</b><em>{l.bankAmt}</em></> : <span className="gap">—</span>}</span>
              <span className="mlink" aria-hidden><span /></span>
              <span className="mcell erp">{l.erp ? <><b>{l.erp}</b><em>{l.erpAmt}</em></> : <span className="gap">—</span>}</span>
              <span className="stamp" title={l.note}>{STAMP[l.v]}</span>
              <span className="mnote">{l.note}</span>
            </div>
          );
        })}
      </div>
      <div className="machine-foot">
        <span><b>{matched}</b> matched</span>
        <span><b className="warn-ink">{review}</b> need a person</span>
        <span className="muted">{finished ? "done" : "matching…"}</span>
      </div>
    </div>
      <span className={`bubble ${finished ? "cheer" : ""}`} key={finished ? "done" : "busy"} aria-hidden>
        {finished ? `Done. Only ${review} need you.` : "Checking every line…"}
      </span>
      <div className={`buddy ${finished ? "cheer" : ""}`} aria-hidden>
        <Mascot size={118} eager />
      </div>
    </div>
  );
}

const FORMATS = [".xlsx", "22/11/2026", "11/22/2026", "$1,625.00", "1.625,00", "1,625.00 CR", "6.50 DB", "(125.00)", "Debit · Credit", "inv-1012␠", "Tanggal · Referensi · Nominal", "Nov 22, 2026", "Date · Reference · Amount", "€1.625,50"];

export default function Landing() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="landing">
      <header className={`lnav ${scrolled ? "scrolled" : ""}`}>
        <div className="wrap lnav-in">
          <Link to="/" aria-label="ReconPilot home"><Logo /></Link>
          <nav className="lnav-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#system">Product</a>
            <a href="#security">Security</a>
          </nav>
          <div className="lnav-cta">
            {user ? (
              <Link to="/app" className="btn primary">Open workspace <Icon name="arrow" size={16} /></Link>
            ) : (
              <>
                <Link to="/login" className="btn quiet">Sign in</Link>
                <DemoButton className="btn primary hide-sm" />
              </>
            )}
          </div>
        </div>
      </header>

      <section className="hero">
        <DotField />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><Decode text="BANK ↔ ERP RECONCILIATION FOR FINANCE TEAMS" speed={18} /></p>
            <h1>
              Close the books
              <br />
              without the <span className="strike-word">spreadsheet<span aria-hidden className="strike" /></span>
            </h1>
            <p className="lede">
              Upload your bank statement and ERP ledger. ReconPilot matches every line on its reference, puts the ten that don’t match in a queue, and keeps the
              notes, the sign-off and the audit trail in one place.
            </p>
            <div className="hero-cta">
              <DemoButton />
              <Link to="/signup" className="btn ghost lg">Create a workspace</Link>
            </div>
            <ul className="hero-proof">
              <li><Icon name="check" size={14} /> Reads CSV and Excel, any date or number format</li>
              <li><Icon name="check" size={14} /> Row-level security per workspace</li>
              <li><Icon name="check" size={14} /> No card, demo data included</li>
            </ul>
          </div>
          <Machine />
        </div>
      </section>

      <div className="marquee" aria-label="Formats ReconPilot reads">
        <div className="marquee-track">
          {[...FORMATS, ...FORMATS].map((f, i) => (
            <span key={i} aria-hidden={i >= FORMATS.length}>{f}</span>
          ))}
        </div>
      </div>

      <section id="how" className="section">
        <div className="wrap">
          <header className="sec-head">
            <p className="eyebrow"><Decode text="HOW IT WORKS" /></p>
            <h2>Month-end in three moves</h2>
          </header>
          <Reveal className="steps3">
            <article className="step3">
              <span className="step3-n">01</span>
              <h3>Drop two exports</h3>
              <p>Your bank statement and your ERP cash ledger, as CSV or Excel. Header rows, Debit/Credit columns and references buried in descriptions are handled for you.</p>
            </article>
            <article className="step3">
              <span className="step3-n">02</span>
              <h3>Every line, matched</h3>
              <p>References are compared after trimming hidden spaces and ignoring case. Amounts must agree to the cent. 20,000 lines take under a second.</p>
            </article>
            <article className="step3">
              <span className="step3-n">03</span>
              <h3>Resolve, then lock</h3>
              <p>Work the exception queue with a note on each line. When nothing is open, close the period. The database locks it for good.</p>
            </article>
          </Reveal>
        </div>
      </section>

      <section id="system" className="section alt">
        <div className="wrap">
          <header className="sec-head">
            <p className="eyebrow"><Decode text="THE SYSTEM" /></p>
            <h2>Not a one-off script. A place the books get closed.</h2>
          </header>
          <Reveal className="bento">
            <article className="tile t-queue">
              <h3>Exception queue</h3>
              <p>Every open line from every account, sorted by money at stake or by age.</p>
              <div className="mini-queue" aria-hidden>
                <div><i className="s-amount_mismatch" /> INV-1019 <b>$125.00</b></div>
                <div><i className="s-unmatched_a" /> TRF-2002 <b>$2,150.00</b></div>
                <div><i className="s-duplicate" /> INV-1025 <b>$7,625.00</b></div>
                <div><i className="s-unmatched_b" /> INV-1043 <b>$5,375.00</b></div>
              </div>
            </article>
            <article className="tile t-close">
              <h3>Close & lock</h3>
              <p>A period closes only when every exception has an answer. After that, nobody can change it.</p>
              <div className="mini-lock" aria-hidden>
                <span className="mini-bar"><span /></span>
                <span>10 of 10 resolved</span>
                <span className="mini-lockchip"><Icon name="lock" size={13} /> Closed</span>
              </div>
            </article>
            <article className="tile t-audit">
              <h3>Audit trail</h3>
              <p>Append-only log of who ran, resolved, noted and closed what.</p>
              <ol className="mini-feed" aria-hidden>
                <li><b>Closed period</b> BCA Operasional · Oct</li>
                <li><b>Resolved</b> INV-1007 — credit note issued</li>
                <li><b>Ran reconciliation</b> Mandiri Collections</li>
              </ol>
            </article>
            <article className="tile t-trend">
              <h3>Overview</h3>
              <p>Match rate per month, open amounts by type, and what needs attention first.</p>
              <svg viewBox="0 0 200 64" className="mini-trend" aria-hidden>
                <path d="M4 40 L52 24 L100 30 L148 14 L196 18" />
                {[[4, 40], [52, 24], [100, 30], [148, 14], [196, 18]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.2" />)}
              </svg>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="section stats">
        <div className="wrap stats-grid">
          <div>
            <strong><CountUp value={20000} /></strong>
            <span>lines matched in under a second, right in the browser</span>
          </div>
          <div>
            <strong><CountUp value={5} /></strong>
            <span>kinds of exception, each explained in plain language</span>
          </div>
          <div>
            <strong><CountUp value={0} format={() => "0"} /></strong>
            <span>VLOOKUPs, pivot tables or macros to maintain</span>
          </div>
        </div>
      </section>

      <section id="security" className="section">
        <div className="wrap sec-split">
          <header className="sec-head">
            <p className="eyebrow"><Decode text="SECURITY" /></p>
            <h2>Built for money data</h2>
            <p className="muted">Bank statements are sensitive. ReconPilot keeps as little as it can, and isolates what it keeps.</p>
          </header>
          <Reveal as="ul" className="sec-list">
            <li><b>Row-level security.</b> Every query is limited to your workspace by Postgres itself, not by app code.</li>
            <li><b>Parsed in your browser.</b> Raw CSV files never leave your machine; only matched lines are saved.</li>
            <li><b>Last four digits only.</b> Full account numbers are never stored.</li>
            <li><b>Formula-safe exports.</b> A description like <code>=HYPERLINK(…)</code> can’t run when the CSV opens in Excel.</li>
            <li><b>Locked periods.</b> Closed months are read-only at the database level.</li>
            <li><b>Strict CSP.</b> No third-party scripts on the page.</li>
          </Reveal>
        </div>
      </section>

      <section className="section kane">
        <div className="wrap kane-in">
          <p className="eyebrow">QUALITY</p>
          <p className="kane-line">
            Every change to ReconPilot is tested by <b>Kane CLI</b> in a real browser before the coding agent is allowed to call it done.
          </p>
        </div>
      </section>

      <section className="section final">
        <div className="wrap final-in">
          <Mascot className="final-mascot" size={140} />
          <h2>See November reconciled in a minute.</h2>
          <p>The demo workspace has two bank accounts and three months of history. Nothing to install.</p>
          <div className="hero-cta">
            <DemoButton />
            <Link to="/signup" className="btn ghost lg">Create a workspace</Link>
          </div>
        </div>
      </section>

      <footer className="lfoot">
        <div className="wrap lfoot-in">
          <Logo />
          <span className="muted">Bank ↔ ERP reconciliation · Made in Indonesia</span>
        </div>
      </footer>
    </div>
  );
}
