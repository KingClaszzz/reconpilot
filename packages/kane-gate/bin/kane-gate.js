#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig, paths } from "../src/config.js";
import { hook } from "../src/hook.js";
import { init } from "../src/init.js";
import { writeReport } from "../src/report.js";
import { colors as c, makeLogger, verify } from "../src/verify.js";

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const positional = rest.filter((a) => !a.startsWith("--"));

const HELP = `
${c.bold("kane-gate")} — your AI coding agent can't say "done" until Kane CLI proves it works.

Usage:
  kane-gate init              Set up config, specs folder, Claude Code Stop hook and CLAUDE.md rules
  kane-gate run [spec...]     Verify specs now (exit 1 if any fail)   --headed to watch the browser
  kane-gate hook              Claude Code Stop hook entry point (reads hook JSON on stdin)
  kane-gate watch             Follow verification activity live (run in a second terminal)
  kane-gate report [--open]   Write .kane/report.html from the run history
`;

function requireConfig() {
  const config = loadConfig();
  if (!config) {
    console.error(c.red("No kane-gate.config.json found. Run `npx kane-gate init` first."));
    process.exit(2);
  }
  return config;
}

async function main() {
  switch (command) {
    case "init":
      return init(process.cwd());

    case "run": {
      const config = requireConfig();
      if (flags.has("--headed")) config.headless = false;
      const log = makeLogger(config.root);
      const { results } = await verify(config, { only: positional, trigger: "manual", log });
      const failed = results.filter((r) => r.status !== "passed").length;
      log(failed ? c.red(`${failed}/${results.length} spec(s) failed`) : c.green(`all ${results.length} spec(s) passed`));
      process.exitCode = failed ? 1 : 0;
      return;
    }

    case "hook":
      return hook();

    case "watch": {
      const config = requireConfig();
      const { liveLog } = paths(config.root);
      mkdirSync(dirname(liveLog), { recursive: true });
      if (!existsSync(liveLog)) writeFileSync(liveLog, "");
      console.log(c.bold("kane-gate watch") + c.dim(" — waiting for the agent to finish a turn…\n"));
      let pos = statSync(liveLog).size;
      setInterval(() => {
        const size = statSync(liveLog).size;
        if (size < pos) pos = 0;
        if (size > pos) {
          const buf = readFileSync(liveLog).subarray(pos, size);
          pos = size;
          process.stdout.write(colorize(buf.toString()));
        }
      }, 300);
      return;
    }

    case "report": {
      const config = requireConfig();
      const { file, stats } = writeReport(config.root);
      console.log(`${c.green("✓")} wrote ${file}`);
      console.log(c.dim(`  ${stats.runs} rounds · ${stats.caught} failures caught · ${stats.saves} fixed · ${stats.credits.toFixed(1)} credits`));
      if (flags.has("--open")) {
        const { spawn } = await import("node:child_process");
        const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : process.platform === "darwin" ? ["open", [file]] : ["xdg-open", [file]];
        spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).unref();
      }
      return;
    }

    default:
      console.log(HELP);
      process.exitCode = command && command !== "help" && command !== "--help" ? 2 : 0;
  }
}

function colorize(text) {
  return text
    .split("\n")
    .map((l) =>
      /✗|FAIL|ERROR|gate closed|giving up/.test(l) ? c.red(l)
      : /✓|PASS|gate open/.test(l) ? c.green(l)
      : /kane-gate ▸/.test(l) ? c.bold(l)
      : c.dim(l),
    )
    .join("\n");
}

main().catch((err) => {
  console.error(c.red(err.stack || String(err)));
  // If the hook itself crashes, let Claude stop instead of getting stuck.
  process.exitCode = command === "hook" ? 0 : 1;
});
