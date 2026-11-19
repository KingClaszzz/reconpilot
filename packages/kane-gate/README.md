# kane-gate

A Claude Code Stop hook that won't let the agent say "done" until [Kane CLI](https://www.testmuai.com/support/docs/kane-cli-introduction) has checked the work in a real browser.

When Claude tries to end its turn, kane-gate runs your plain-English specs through Kane. If one fails, the stop is blocked and Claude gets what Kane found: the expected and observed values, the step that broke, and Kane's own diagnosis of the cause. Claude fixes it, tries to stop again, and Kane re-checks.

## Install

You need Node 18+, Kane CLI and a TestMu account:

```bash
npm install -g @testmuai/kane-cli
kane-cli login
```

Then, in your project:

```bash
npx kane-gate init
```

That creates:

- `kane-gate.config.json` with your app's URL and start command (detected from `package.json`)
- `.kane/specs/home.md`, an example spec
- a Stop hook in `.claude/settings.json`
- a short section in `CLAUDE.md` telling Claude to write a spec before the code and to fix the app, not the spec
- `.gitignore` entries for kane-gate's run history

In a Node project it also adds `kane-gate` to your devDependencies, so the hook never has to download anything.

Run `npx kane-gate run` once by hand to check your specs pass, then start Claude Code.

## Specs

One user flow per file in `.kane/specs/`. Front matter has a name and the path to start from; the body is what Kane should do and check:

```md
---
name: Checkout shows the right total
url: /cart
---
Add the first product to the cart and open the cart.
Verify the total is $19.00 and the "Checkout" button is enabled.
```

Be specific about what to verify: exact text, numbers, states. Vague specs give vague results.

## What happens on a stop

1. If nothing changed since the last green run, Claude stops right away. No Kane credits are spent.
2. kane-gate makes sure your app is running, starting it with `startCommand` if needed.
3. Every spec runs through `kane-cli run --agent`.
4. All pass: Claude stops.
5. Something failed and Kane classifies it as an `application_issue`: the stop is blocked and Claude gets the findings.
6. Kane blames the environment or its own automation, or the browser crashed: retried once, then Claude may stop, and you get a warning instead of Claude chasing a bug that isn't there.
7. After `maxAttempts` blocked rounds, kane-gate gives up, lets Claude stop, and tells you what's still failing.

Text that came from the page under test is passed to Claude as quoted data, so a page can't inject instructions into the agent's prompt. If Claude edits a spec while it's meant to be fixing the code, the next message points that out.

## Commands

| | |
| --- | --- |
| `kane-gate init` | set up the current project |
| `kane-gate run [spec…] [--headed]` | verify now; exits 1 on failure, so it also works in CI |
| `kane-gate hook` | what the Stop hook calls |
| `kane-gate watch` | follow what Kane is doing while Claude works |
| `kane-gate report [--open]` | HTML history of runs, failures caught and credits used |

## Config

`kane-gate.config.json`:

| Key | Default | |
| --- | --- | --- |
| `baseUrl` | detected | where your app runs |
| `startCommand` | `npm run dev` | how to start it if it isn't running |
| `specsDir` | `.kane/specs` | |
| `maxAttempts` | `3` | blocked rounds before giving up |
| `headless` | `true` | |
| `maxSteps` | `30` | per spec, passed to Kane |
| `timeoutSec` | `300` | per spec |
| `serverTimeoutSec` | `60` | how long to wait for the app to come up |
| `infraRetries` | `1` | retries for browser or tooling errors |
| `concurrency` | `1` | specs run in parallel |
| `kaneArgs` | `[]` | extra arguments for `kane-cli run` |
| `kaneCommand` | `kane-cli` | how to launch Kane, as a string or an array |

`startCommand` and `kaneCommand` run as shell commands, the same way Claude Code runs hooks from `.claude/settings.json`. Only use kane-gate in projects you trust.

## Example

[ReconPilot](https://github.com/KingClaszzz/reconpilot) is a reconciliation app built under kane-gate. Its README walks through a real session where Kane caught a bug Claude didn't know about and Claude fixed it before being allowed to stop.

## License

MIT
