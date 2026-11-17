import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { paths } from "./config.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

export function loadRuns(root) {
  const { runsDir } = paths(root);
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(runsDir, f), "utf8")));
}

export function stats(runs) {
  const all = runs.flatMap((r) => r.results);
  const caught = all.filter((r) => r.status === "failed").length;
  // a "save" = a failing run followed by a green one
  let saves = 0;
  for (let i = 1; i < runs.length; i++) if (!runs[i - 1].passed && runs[i].passed) saves++;
  return {
    runs: runs.length,
    specRuns: all.length,
    caught,
    saves,
    credits: all.reduce((s, r) => s + (r.credits ?? 0), 0),
    seconds: all.reduce((s, r) => s + (r.durationSec ?? 0), 0),
  };
}

export function writeReport(root) {
  const runs = loadRuns(root);
  const s = stats(runs);
  const rows = [...runs]
    .reverse()
    .map((run) => {
      const specs = run.results
        .map((r) => {
          const checks = (r.checks ?? [])
            .filter((c) => c.passed === false)
            .map((c) => `<div class="check">expected <b>${esc(JSON.stringify(c.expected))}</b>, saw <b>${esc(JSON.stringify(c.observed))}</b> <span class="muted">— ${esc(c.condition)}</span></div>`)
            .join("");
          const failedSteps = (r.steps ?? []).filter((x) => x.status === "failed").map((x) => `<div class="check">failed step: ${esc(x.remark)}</div>`).join("");
          return `<li class="${r.status}">
            <span class="pill ${r.status}">${r.status === "passed" ? "PASS" : r.status === "failed" ? "FAIL" : "ERROR"}</span>
            <b>${esc(r.name)}</b> <span class="muted">${esc(r.file)} · ${r.durationSec ?? "?"}s${r.credits ? ` · ${r.credits.toFixed(1)} cr` : ""}</span>
            ${r.status !== "passed" ? `<div class="why">${esc(r.oneLiner || r.reason || "")}</div>${failedSteps}${checks}` : ""}
            ${r.evidence ? `<div class="muted ev">evidence: <code>kane-cli evidence serve ${esc(r.evidence)}</code></div>` : ""}
          </li>`;
        })
        .join("");
      return `<section class="run ${run.passed ? "ok" : "bad"}">
        <header><span class="dot"></span><b>${run.passed ? "Gate open" : "Gate closed"}</b>
        <span class="muted">${new Date(run.startedAt).toLocaleString()} · ${esc(run.trigger)} · attempt ${run.attempt}</span></header>
        <ul>${specs}</ul></section>`;
    })
    .join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>kane-gate report</title><style>
:root{--ink:#111827;--muted:#6b7280;--line:#e5e7eb;--ok:#15803d;--bad:#b91c1c;--bg:#f6f7f9}
body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:900px;margin:0 auto;padding:32px 16px}
h1{margin:0 0 4px;font-size:22px}.muted{color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0 28px}
.stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px}.stat b{display:block;font-size:26px}
.run{background:#fff;border:1px solid var(--line);border-left:4px solid var(--ok);border-radius:10px;margin-bottom:12px;padding:12px 16px}
.run.bad{border-left-color:var(--bad)}.run header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
ul{list-style:none;margin:8px 0 0;padding:0}li{padding:8px 0;border-top:1px solid var(--line)}
.pill{display:inline-block;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;margin-right:6px;color:#fff;background:var(--ok)}
.pill.failed,.pill.error{background:var(--bad)}.why{color:var(--bad);margin-top:4px}.check{font-size:13px;margin-top:2px}
.ev{font-size:12px;margin-top:4px}code{font-size:12px;word-break:break-all}
@media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main>
<h1>kane-gate report</h1><div class="muted">Every time the agent said "done", Kane CLI checked it in a real browser.</div>
<div class="stats">
<div class="stat"><b>${s.runs}</b><span class="muted">verification rounds</span></div>
<div class="stat"><b>${s.caught}</b><span class="muted">failures caught by Kane</span></div>
<div class="stat"><b>${s.saves}</b><span class="muted">broken → green fixes</span></div>
<div class="stat"><b>${s.credits.toFixed(0)}</b><span class="muted">Kane credits used</span></div>
</div>
${rows || '<p class="muted">No runs yet. Run <code>npx kane-gate run</code>.</p>'}
</main></body></html>`;
  const { report } = paths(root);
  writeFileSync(report, html);
  return { file: report, stats: s };
}
