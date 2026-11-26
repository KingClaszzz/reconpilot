import { useState } from "react";
import { Decode, Reveal } from "../lib/motion";

const REPO = "https://github.com/KingClaszzz/reconpilot";

const CODE = {
  Spec: {
    file: ".kane/specs/reconcile-summary.md",
    text: `---
name: Reconcile sample files — summary counts
url: /
---
Click "Try the live demo".
Click "New reconciliation".
Click the "Load sample data" button, then click the "Reconcile" button.
Verify the summary cards on the reconciliation page show exactly these numbers:
- Matched: 39
- Amount mismatch: 3
- Only in Bank: 2
- Only in ERP: 3
- Duplicate: 2`,
  },
  Hook: {
    file: ".claude/settings.json",
    text: `{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "npx --no-install kane-gate hook",
        "timeout": 1800
      }]
    }]
  }
}`,
  },
  Setup: {
    file: "terminal",
    text: `npm install -g @testmuai/kane-cli
kane-cli login

npx kane-gate init      # config, hook, CLAUDE.md, a first spec
npx kane-gate run       # every spec through Kane, exits 1 on failure
npx kane-gate report --open`,
  },
  Triage: {
    file: "packages/kane-gate/src/kane.js",
    text: `const verdict = runEnd?.verdict;
// Kane triages its own failures; only an application_issue is worth sending the agent after
const notApp = verdict?.family && verdict.family !== "application_issue";
const infra = status !== "passed" && (notApp || (!steps.some((s) => s.status === "failed") && INFRA_ERROR.test(\`\${runEnd?.reason ?? ""} \${stderr}\`)));
if (infra) status = "error";
// ...
diagnosis: verdict?.root_cause
  ? { family: verdict.family, rootCause: verdict.root_cause, suggestion: verdict.suggestion ?? null, confidence: verdict.confidence ?? null }
  : null,`,
  },
} as const;
type Tab = keyof typeof CODE;

export function KaneProof() {
  const [tab, setTab] = useState<Tab>("Spec");
  const [copied, setCopied] = useState(false);
  const cur = CODE[tab];

  return (
    <section id="verified" className="section kproof">
      <div className="wrap">
        <header className="sec-head">
          <p className="eyebrow"><Decode text="VERIFIED BY KANE CLI" /></p>
          <h2>Unit tests said done. Kane opened the app.</h2>
          <p className="muted">
            ReconPilot is built by a coding agent behind <b>kane-gate</b>, a Claude Code Stop hook. Before the agent may stop, Kane CLI runs every
            spec in a real Chrome. This is a real run where it mattered: Claude was asked for a small button, and a parser bug from an earlier commit was waiting.
          </p>
        </header>

        <Reveal className="kp-vs">
          <div className="kp-term">
            <p className="kp-head"><span className="dot ok" /> npm test · what the agent saw</p>
            <pre>{`✓ src/recon/recon.test.ts (3)

 Tests  3 passed (3)
 tsc --noEmit  clean

Claude: "Unit tests pass (3 of 3) and the
type check is clean."  → tries to stop`}</pre>
          </div>
          <div className="kp-term bad">
            <p className="kp-head"><span className="dot no" /> kane-gate · real Chrome</p>
            <pre>
              {`✗ Reconcile sample files — summary counts
  Check "Matched is 39"
    expected 39, observed `}<mark>0</mark>{`
  Check "Amount mismatch is 3"
    expected 3, observed 34
✗ Amount mismatch row: Difference $50.00
    observed $91,625.00

Kane: application_issue · confidence 0.97
"read with the wrong number format"
→ stop blocked, attempt 1/3`}
            </pre>
          </div>
        </Reveal>

        <Reveal as="ol" className="kp-loop">
          <li><b>Stop</b> Claude finishes the button and tries to end its turn.</li>
          <li><b>Run</b> kane-gate sends 3 specs to Kane CLI in Chrome.</li>
          <li><b>Block</b> 2 fail. Claude gets the checks and Kane's diagnosis.</li>
          <li><b>Fix</b> It traces the cause to an earlier commit and fixes 3 parser bugs.</li>
          <li><b>Pass</b> Kane re-runs: 3 of 3. 33 turns, 15 minutes, no human.</li>
        </Reveal>

        <div className="kp-code">
          <div className="kp-tabs" role="tablist" aria-label="kane-gate code">
            {(Object.keys(CODE) as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); setCopied(false); }}>
                {t}
              </button>
            ))}
            <span className="kp-file">{cur.file}</span>
            <button
              type="button"
              className="kp-copy"
              onClick={() => navigator.clipboard?.writeText(cur.text).then(() => setCopied(true), () => {})}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre role="tabpanel" aria-label={tab}>{cur.text}</pre>
        </div>

        <p className="kp-links">
          <a href={REPO} target="_blank" rel="noreferrer">Full transcript and gate logs on GitHub →</a>
          <a href="https://www.npmjs.com/package/kane-gate" target="_blank" rel="noreferrer">kane-gate on npm →</a>
        </p>
      </div>
    </section>
  );
}
