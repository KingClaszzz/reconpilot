import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveUrl } from "./specs.js";

let cachedCmd = null;

const INFRA_ERROR = /TargetClosedError|Target page, context or browser has been closed|Screenshot failed|ECONNRESET|socket hang up|Browser closed|net::ERR_(?!CONNECTION_REFUSED)|Rate limit|503 Service/i;

// Launch kane-cli without a shell. cmd.exe mangles multi-line arguments on Windows.
export function resolveKane(config) {
  if (config.kaneCommand) {
    const [cmd, ...pre] = Array.isArray(config.kaneCommand) ? config.kaneCommand : [config.kaneCommand];
    return { cmd, pre };
  }
  if (cachedCmd) return cachedCmd;
  if (process.platform === "win32") {
    try {
      const hits = execFileSync("where", ["kane-cli"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
      for (const hit of hits) {
        const cjs = join(dirname(hit), "node_modules", "@testmuai", "kane-cli", "bin", "kane-cli.cjs");
        if (existsSync(cjs)) return (cachedCmd = { cmd: process.execPath, pre: [cjs] });
      }
    } catch {
      /* fall through */
    }
    return (cachedCmd = { cmd: "kane-cli.cmd", pre: [], shell: true });
  }
  return (cachedCmd = { cmd: "kane-cli", pre: [] });
}

function checksFrom(runEnd) {
  const memory = runEnd?.context?.memory ?? {};
  return Object.values(memory)
    .filter((m) => m && (m.condition || m.query))
    .map((m) => ({
      condition: m.condition || m.query,
      expected: m.expected_value ?? null,
      observed: m.extracted_value ?? null,
      passed: /->\s*PASS\s*$/i.test(m.reasoning ?? "") ? true : /->\s*FAIL\s*$/i.test(m.reasoning ?? "") ? false : null,
    }));
}

export function runSpec(spec, config, onEvent = () => {}) {
  const { cmd, pre, shell } = resolveKane(config);
  const url = resolveUrl(config.baseUrl, spec.url);
  const args = [
    ...pre,
    "run",
    spec.objective,
    "--url", url,
    "--agent",
    "--max-steps", String(config.maxSteps),
    "--timeout", String(config.timeoutSec),
    ...(config.headless ? ["--headless"] : []),
    ...config.kaneArgs,
  ];
  const started = Date.now();

  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: config.root, shell: Boolean(shell), windowsHide: true, env: { ...process.env, NO_COLOR: "1" } });
    const steps = [];
    let runEnd = null;
    let evidence = null;
    let stderr = "";
    let buf = "";

    const handle = (line) => {
      if (!line.trim().startsWith("{")) return;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        return;
      }
      if (typeof ev.step === "number" && ev.status && ev.status !== "running") steps.push({ step: ev.step, status: ev.status, remark: ev.remark });
      if (ev.type === "coverage" && ev.pack) evidence = ev.pack;
      if (ev.type === "run_end") runEnd = ev;
      onEvent(ev, spec);
    };

    child.stdout.on("data", (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      resolvePromise({ spec: spec.id, name: spec.name, file: spec.file, url, status: "error", reason: `Could not start kane-cli: ${err.message}`, steps, checks: [], durationSec: 0 });
    });
    child.on("close", (code) => {
      if (buf) handle(buf);
      const evidenceMatch = stderr.match(/kane-cli evidence serve ([^\s`'"]+)/);
      let status = runEnd?.status === "passed" && code === 0 ? "passed" : runEnd ? "failed" : "error";
      const verdict = runEnd?.verdict;
      // Kane triages its own failures; only an application_issue is worth sending the agent after
      const notApp = verdict?.family && verdict.family !== "application_issue";
      const infra = status !== "passed" && (notApp || (!steps.some((s) => s.status === "failed") && INFRA_ERROR.test(`${runEnd?.reason ?? ""} ${stderr}`)));
      if (infra) status = "error";
      resolvePromise({
        spec: spec.id,
        name: spec.name,
        file: spec.file,
        url,
        status,
        infra,
        exitCode: code,
        oneLiner: runEnd?.one_liner ?? null,
        summary: runEnd?.summary ?? null,
        reason: runEnd?.reason ?? (status === "error" ? stderr.trim().split(/\r?\n/).slice(-5).join("\n") : null),
        finalState: runEnd?.final_state ?? null,
        checks: checksFrom(runEnd),
        diagnosis: verdict?.root_cause ? { family: verdict.family, rootCause: verdict.root_cause, suggestion: verdict.suggestion ?? null, confidence: verdict.confidence ?? null } : null,
        steps,
        evidence: evidenceMatch?.[1] ?? evidence,
        sessionDir: runEnd?.session_dir ?? null,
        credits: runEnd?.credits_consumed ?? null,
        durationSec: Math.round((Date.now() - started) / 100) / 10,
      });
    });
  });
}

export async function runSpecs(specs, config, onEvent, onDone = () => {}) {
  const results = new Array(specs.length);
  let next = 0;
  const worker = async () => {
    while (next < specs.length) {
      const i = next++;
      let r = await runSpec(specs[i], config, onEvent);
      for (let retry = 0; r.infra && retry < (config.infraRetries ?? 1); retry++) {
        onEvent({ type: "kane_gate_retry", reason: r.reason }, specs[i]);
        r = { ...(await runSpec(specs[i], config, onEvent)), retried: retry + 1 };
      }
      results[i] = r;
      onDone(results[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(config.concurrency, specs.length)) }, worker));
  return results;
}
