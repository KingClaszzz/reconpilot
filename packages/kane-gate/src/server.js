import { spawn } from "node:child_process";

async function isUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

// Start the app if it isn't up yet. We leave it running so the next round is fast.
export async function ensureServer(config, log = () => {}) {
  if (await isUp(config.baseUrl)) return { ok: true, started: false };
  if (!config.startCommand) return { ok: false, error: `Nothing is answering at ${config.baseUrl} and no startCommand is configured.` };

  log(`starting app: ${config.startCommand}`);
  const child = spawn(config.startCommand, { cwd: config.root, shell: true, detached: true, stdio: "ignore", windowsHide: true });
  child.unref();

  const deadline = Date.now() + config.serverTimeoutSec * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isUp(config.baseUrl)) return { ok: true, started: true };
  }
  return { ok: false, error: `Started \`${config.startCommand}\` but ${config.baseUrl} did not respond within ${config.serverTimeoutSec}s.` };
}
