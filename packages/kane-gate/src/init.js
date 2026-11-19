import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { CONFIG_FILE, DEFAULTS } from "./config.js";
import { colors as c } from "./verify.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const CLAUDE_MD_MARK = "<!-- kane-gate -->";

const CLAUDE_MD_SECTION = `
${CLAUDE_MD_MARK}
## Verification with kane-gate (Kane CLI)

This project is gated by **kane-gate**. When you finish a turn, a Stop hook runs every spec in \`.kane/specs/\` through Kane CLI in a real browser. If any spec fails you will receive Kane's findings and must keep working.

- Every user-facing feature or bug fix needs a spec in \`.kane/specs/<short-name>.md\`. Write or update the spec **before** the code.
- A spec is plain English: front matter with \`name\` and \`url\` (path relative to the app), then the steps and the exact things to verify (visible text, numbers, states).
- Specs are the source of truth. When Kane reports a failure, fix the application, never weaken the spec, unless the user asked for different behaviour.
- Keep specs short and focused: one user flow per file.
${CLAUDE_MD_MARK}
`;

const EXAMPLE_SPEC = `---
name: Home page loads
url: /
---
Open the home page and verify the main heading is visible and the page shows no error message.
`;

function detectProject(root) {
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch {
    /* no package.json */
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const dev = pkg.scripts?.dev ?? "";
  let port = 3000;
  if (deps.vite || /vite/.test(dev)) port = 5173;
  if (deps.next || /next/.test(dev)) port = 3000;
  if (deps["@angular/core"]) port = 4200;
  const m = dev.match(/--port[ =](\d+)/);
  if (m) port = Number(m[1]);
  return { baseUrl: `http://localhost:${port}`, startCommand: pkg.scripts?.dev ? "npm run dev" : "" };
}

function writeIfMissing(file, content, label, done) {
  if (existsSync(file)) return done.push(c.dim(`• ${label} already exists`));
  writeFileSync(file, content);
  done.push(c.green(`✓ created ${label}`));
}

export function init(root = process.cwd()) {
  const done = [];

  const detected = detectProject(root);
  writeIfMissing(
    join(root, CONFIG_FILE),
    JSON.stringify({ baseUrl: detected.baseUrl, startCommand: detected.startCommand, specsDir: DEFAULTS.specsDir, maxAttempts: DEFAULTS.maxAttempts, headless: true }, null, 2) + "\n",
    CONFIG_FILE,
    done,
  );

  const specsDir = join(root, DEFAULTS.specsDir);
  mkdirSync(specsDir, { recursive: true });
  const hasSpecs = hasMarkdown(specsDir);
  if (!hasSpecs) writeIfMissing(join(specsDir, "home.md"), EXAMPLE_SPEC, ".kane/specs/home.md", done);
  else done.push(c.dim("• .kane/specs already has specs"));

  const settingsDir = join(root, ".claude");
  const settingsFile = join(settingsDir, "settings.json");
  mkdirSync(settingsDir, { recursive: true });
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(settingsFile, "utf8"));
  } catch {
    /* new file */
  }
  // Node projects get kane-gate as a devDependency so the hook never downloads anything;
  // anything else runs a pinned version through npx.
  const pkgFile = join(root, "package.json");
  const pkg = existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, "utf8")) : null;
  settings.hooks ??= {};
  settings.hooks.Stop ??= [];
  const already = JSON.stringify(settings.hooks.Stop).includes("kane-gate hook");
  if (already) done.push(c.dim("• Claude Code Stop hook already installed"));
  else {
    const command = pkg ? "npx --no-install kane-gate hook" : `npx -y kane-gate@${version} hook`;
    settings.hooks.Stop.push({ hooks: [{ type: "command", command, timeout: 1800 }] });
    writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");
    done.push(c.green("✓ installed Claude Code Stop hook in .claude/settings.json"));
  }
  if (pkg && !{ ...pkg.dependencies, ...pkg.devDependencies }["kane-gate"] && !pkg.workspaces) {
    try {
      execSync(`npm install --save-dev kane-gate@${version}`, { cwd: root, stdio: "ignore" });
      done.push(c.green("✓ added kane-gate to devDependencies"));
    } catch {
      done.push(c.red("! couldn't add kane-gate to devDependencies, run: npm install -D kane-gate"));
    }
  }

  const claudeMd = join(root, "CLAUDE.md");
  const existing = existsSync(claudeMd) ? readFileSync(claudeMd, "utf8") : "";
  if (existing.includes(CLAUDE_MD_MARK)) done.push(c.dim("• CLAUDE.md already has kane-gate rules"));
  else {
    appendFileSync(claudeMd, (existing ? "\n" : "# Project notes\n") + CLAUDE_MD_SECTION);
    done.push(c.green("✓ added verification rules to CLAUDE.md"));
  }

  const gi = join(root, ".gitignore");
  const giText = existsSync(gi) ? readFileSync(gi, "utf8") : "";
  if (!giText.includes(".kane/runs")) {
    appendFileSync(gi, `${giText && !giText.endsWith("\n") ? "\n" : ""}# kane-gate\n.kane/runs/\n.kane/state/\n.kane/report.html\n`);
    done.push(c.green("✓ ignored .kane/runs and .kane/state in .gitignore"));
  }

  let kaneOk = true;
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", ["kane-cli"], { stdio: "ignore" });
  } catch {
    kaneOk = false;
  }

  console.log(c.bold("\nkane-gate initialised\n"));
  for (const line of done) console.log("  " + line);
  console.log("");
  if (!kaneOk) console.log(c.red("  ! kane-cli not found. Install it: npm install -g @testmuai/kane-cli && kane-cli login\n"));
  console.log(`  Next:`);
  console.log(`    1. Check ${CONFIG_FILE} (baseUrl ${detected.baseUrl})`);
  console.log(`    2. ${c.cyan("npx kane-gate run")}   — verify your specs once by hand`);
  console.log(`    3. Start Claude Code. It can no longer say "done" until Kane agrees.\n`);
}

function hasMarkdown(dir) {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".md"));
  } catch {
    return false;
  }
}
