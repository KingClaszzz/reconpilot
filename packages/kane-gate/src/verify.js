import { appendFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { paths } from "./config.js";
import { loadSpecs } from "./specs.js";
import { runSpecs } from "./kane.js";
import { ensureServer } from "./server.js";

const c = process.stderr.isTTY && !process.env.NO_COLOR
  ? { red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`, cyan: (s) => `\x1b[36m${s}\x1b[0m` }
  : { red: (s) => s, green: (s) => s, dim: (s) => s, bold: (s) => s, cyan: (s) => s };
export { c as colors };

// logs to stderr and to .kane/state/live.log for `kane-gate watch`
export function makeLogger(root, { echo = true } = {}) {
  const { liveLog } = paths(root);
  mkdirSync(dirname(liveLog), { recursive: true });
  return (msg) => {
    const line = `${new Date().toLocaleTimeString()}  ${msg}`;
    try {
      appendFileSync(liveLog, line + "\n");
    } catch {
      /* ignore */
    }
    if (echo) process.stderr.write(line + "\n");
  };
}

// hash of the working tree, so an unchanged tree isn't verified twice
export function treeFingerprint(root) {
  try {
    const git = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
    // ignore our own output even if it isn't gitignored
    const scope = ["--", ".", ":(exclude).kane/runs", ":(exclude).kane/state", ":(exclude).kane/report.html"];
    const status = git("status", "--porcelain", "--untracked-files=all", ...scope);
    let diff = "";
    try {
      diff = git("diff", "HEAD", ...scope);
    } catch {
      diff = git("diff", ...scope);
    }
    // git diff skips untracked files
    const untracked = status.split(/\r?\n/).filter((l) => l.startsWith("??")).map((l) => l.slice(3));
    const h = createHash("sha1").update(status).update(diff);
    for (const f of untracked) {
      try {
        h.update(readFileSync(join(root, f)));
      } catch {
        /* ignore */
      }
    }
    return h.digest("hex");
  } catch {
    return null; // not a git repo
  }
}

export function readState(root) {
  const { stateFile } = paths(root);
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return {};
  }
}

export function writeState(root, state) {
  const { stateFile } = paths(root);
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

export async function verify(config, { only = [], trigger = "manual", attempt = 1, log }) {
  const specs = loadSpecs(config.root, config.specsDir, only);
  const startedAt = new Date();
  if (specs.length === 0) {
    log(c.dim(`no specs in ${config.specsDir} — nothing to verify`));
    return { specs, results: [], record: null };
  }

  log(c.bold(`kane-gate ▸ verifying ${specs.length} spec(s) against ${config.baseUrl}`) + c.dim(` (${trigger}, attempt ${attempt})`));
  const server = await ensureServer(config, (m) => log(c.dim(m)));
  if (!server.ok) {
    const results = specs.map((s) => ({ spec: s.id, name: s.name, file: s.file, url: config.baseUrl, status: "error", reason: server.error, steps: [], checks: [], durationSec: 0 }));
    return { specs, results, record: persist(config, { startedAt, trigger, attempt, results }) };
  }

  const results = await runSpecs(
    specs,
    config,
    (ev, spec) => {
      if (typeof ev.step === "number" && ev.status === "done") log(c.dim(`  ${spec.id} · ${ev.remark}`));
      if (typeof ev.step === "number" && ev.status === "failed") log(c.red(`  ${spec.id} · FAILED ${ev.remark}`));
      if (ev.type === "kane_gate_retry") log(c.dim(`  ${spec.id} · browser/tooling hiccup (${String(ev.reason).slice(0, 80)}), retrying once`));
    },
    (r) => {
      const mark = r.status === "passed" ? c.green("✓ PASS") : c.red(r.status === "error" ? "! ERROR" : "✗ FAIL");
      log(`${mark}  ${r.name} ${c.dim(`(${r.durationSec}s)`)}`);
      if (r.status !== "passed" && (r.oneLiner || r.reason)) log(c.red(`        ${r.oneLiner || r.reason}`));
    },
  );
  return { specs, results, record: persist(config, { startedAt, trigger, attempt, results }) };
}

function persist(config, { startedAt, trigger, attempt, results }) {
  const { runsDir } = paths(config.root);
  mkdirSync(runsDir, { recursive: true });
  const record = {
    id: startedAt.toISOString().replace(/[:.]/g, "-"),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    trigger,
    attempt,
    passed: results.every((r) => r.status === "passed"),
    results,
  };
  writeFileSync(join(runsDir, `${record.id}.json`), JSON.stringify(record, null, 2));
  return record;
}

export function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}
