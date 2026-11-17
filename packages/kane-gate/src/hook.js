import { loadConfig } from "./config.js";
import { loadSpecs } from "./specs.js";
import { blockMessage, passMessage } from "./feedback.js";
import { makeLogger, readState, treeFingerprint, verify, writeState } from "./verify.js";

async function readStdin() {
  if (process.stdin.isTTY) return {};
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  try {
    return data.trim() ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

const emit = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");

// Stop hook. Pass -> let Claude stop. Fail -> block and hand Claude the failures.
// Still failing after maxAttempts -> give up and tell the user. Unchanged tree -> skip.
export async function hook() {
  const input = await readStdin();
  const config = loadConfig(input.cwd || process.cwd());
  if (!config) return;
  if (process.env.KANE_GATE_DISABLE === "1") return;

  const log = makeLogger(config.root, { echo: false });
  const state = readState(config.root);
  const fingerprint = treeFingerprint(config.root);

  // a normal stop (not one we forced) starts a new cycle
  if (!input.stop_hook_active || state.sessionId !== input.session_id) {
    state.attempts = 0;
    state.specHashes = null;
  }
  state.sessionId = input.session_id ?? null;

  if (fingerprint && fingerprint === state.lastGreenFingerprint) {
    log("tree unchanged since last green run — skipping verification");
    writeState(config.root, state);
    return;
  }

  const attempt = (state.attempts ?? 0) + 1;
  const { results } = await verify(config, { trigger: "claude-code stop hook", attempt, log });
  if (results.length === 0) {
    writeState(config.root, state);
    return;
  }

  if (results.every((r) => r.status === "passed")) {
    state.attempts = 0;
    state.specHashes = null;
    state.lastGreenFingerprint = treeFingerprint(config.root);
    writeState(config.root, state);
    log("gate open ✓ — Claude may stop");
    emit({ systemMessage: passMessage(results, attempt) });
    return;
  }

  // Only browser/tooling errors? Don't send Claude after a bug that isn't there.
  if (!results.some((r) => r.status !== "passed" && !r.infra)) {
    writeState(config.root, state);
    const n = results.filter((r) => r.infra).length;
    log(`${n} spec(s) could not run (browser/tooling error) — not blocking Claude`);
    emit({ systemMessage: `kane-gate ! Kane could not complete ${n} spec(s) because of a browser/tooling error (not an app failure). Run \`npx kane-gate run\` to re-check.` });
    return;
  }

  // so we can tell if Claude "fixes" the spec instead of the code
  const specs = loadSpecs(config.root, config.specsDir);
  const current = Object.fromEntries(specs.map((s) => [s.file, s.hash]));
  state.specHashes ??= current;
  const tamperedSpecs = Object.keys(state.specHashes).filter((f) => current[f] && current[f] !== state.specHashes[f]);

  state.attempts = attempt;
  writeState(config.root, state);

  if (attempt >= config.maxAttempts + 1) {
    const failing = results.filter((r) => r.status !== "passed").map((r) => r.name).join(", ");
    log(`giving up after ${config.maxAttempts} fix rounds — letting Claude stop`);
    emit({ systemMessage: `kane-gate ✗ still failing after ${config.maxAttempts} fix rounds: ${failing}. Run \`npx kane-gate report\` for details.` });
    return;
  }

  log(`gate closed ✗ — sending Kane's findings back to Claude (round ${attempt}/${config.maxAttempts})`);
  emit({ decision: "block", reason: blockMessage(results, { attempt, maxAttempts: config.maxAttempts, tamperedSpecs }) });
}
