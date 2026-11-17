import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const CONFIG_FILE = "kane-gate.config.json";

export const DEFAULTS = {
  baseUrl: "http://localhost:3000",
  startCommand: "npm run dev",
  specsDir: ".kane/specs",
  maxAttempts: 3,
  headless: true,
  concurrency: 1,
  infraRetries: 1,
  maxSteps: 30,
  timeoutSec: 300,
  serverTimeoutSec: 60,
  kaneArgs: [],
};

export function findRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadConfig(start) {
  const root = findRoot(start);
  if (!root) return null;
  const raw = JSON.parse(readFileSync(join(root, CONFIG_FILE), "utf8"));
  return { root, ...DEFAULTS, ...raw };
}

export const paths = (root) => ({
  kaneDir: join(root, ".kane"),
  runsDir: join(root, ".kane", "runs"),
  stateFile: join(root, ".kane", "state", "gate.json"),
  liveLog: join(root, ".kane", "state", "live.log"),
  report: join(root, ".kane", "report.html"),
});
