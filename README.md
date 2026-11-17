# kane-gate

AI coding agents love to say "done" before anything has been checked. kane-gate makes Claude Code prove it first.

It's a Claude Code Stop hook. When Claude tries to end its turn, kane-gate runs your specs through [Kane CLI](https://www.testmuai.com/support/docs/kane-cli-introduction) in a real Chrome. If a spec fails, Claude isn't allowed to stop. It gets Kane's findings instead (what was expected, what the page actually showed, which step broke) and keeps going until everything passes.

```
Claude: "Done! Reconciliation now supports the bank export."
kane-gate ▸ verifying 4 spec(s) against http://localhost:5173
✗ FAIL  Reconcile sample files — summary counts
        Matched: expected "39", observed "0"
  blocked, Claude reads the findings and fixes parseAmount()
✓ PASS  4/4 specs verified by Kane CLI after 1 fix round
```

## Setup

You need Kane CLI and a TestMu account:

```bash
npm install -g @testmuai/kane-cli
kane-cli login
```

kane-gate isn't on npm yet. This repo already has it wired up. To use it in another project, `npm link` the `packages/kane-gate` folder, then run `kane-gate init` in your project. That adds:

| File | What it's for |
| --- | --- |
| `kane-gate.config.json` | app URL, how to start the app, how many fix rounds to allow |
| `.kane/specs/*.md` | your specs, one user flow per file |
| `.claude/settings.json` | the Stop hook |
| `CLAUDE.md` | tells Claude to write a spec before the code, and to fix the app rather than the spec |

A spec is just a short markdown file:

```md
---
name: Reconcile sample files — summary counts
url: /
---
Click "Try the live demo", then "New reconciliation".
Click "Load sample data", then "Reconcile".
Verify the summary cards show Matched 39, Amount mismatch 3, Only in Bank 2, Only in ERP 3 and Duplicate 2.
```

## How it works

1. Claude finishes a turn and Claude Code calls `kane-gate hook`.
2. kane-gate checks the app is running and starts it if it isn't.
3. Each spec goes through `kane-cli run --agent`.
4. If everything passes, Claude can stop.
5. If something fails, the hook blocks the stop and hands Claude the failures.
6. After a few rounds (`maxAttempts`) it gives up, lets Claude stop and tells you what's still broken.

A few things that keep it from being annoying:

- If nothing changed since the last green run, it doesn't run Kane again. No credits wasted.
- Browser hiccups like `TargetClosedError` are retried once and never reported to Claude as app bugs.
- If Claude edits a spec while it's supposed to be fixing the code, kane-gate calls it out.
- Text from the page is treated as data, so a page can't sneak instructions into Claude's prompt.
- If kane-gate itself crashes, Claude can still stop.

## Commands

| Command | |
| --- | --- |
| `kane-gate init` | set up a project |
| `kane-gate run [--headed]` | verify now; exits 1 on failure, so it works in CI too |
| `kane-gate watch` | live view of what Kane is doing |
| `kane-gate report --open` | HTML history of runs, failures caught and credits used |

## The demo app: ReconPilot

`apps/reconpilot` is what kane-gate guards in this repo. It's a bank-to-ERP reconciliation app for Indonesian finance teams, built with React, Vite and Supabase.

You upload a bank statement and an ERP ledger export. ReconPilot matches the lines by reference and puts everything that doesn't match into a queue. You resolve each one with a note, and once nothing is open you close the period. Closed periods are locked by the database. There's also an overview dashboard, multiple bank accounts and an audit log.

"Try the live demo" logs you into a demo workspace with two bank accounts and three months of history.

### Supabase

1. Create a Supabase project.
2. Run [`apps/reconpilot/supabase/schema.sql`](apps/reconpilot/supabase/schema.sql) in the SQL editor.
3. Turn off "Confirm email" (Authentication → Sign In / Providers → Email) so the demo user can sign up on first use.
4. Copy `apps/reconpilot/.env.example` to `.env.local`.
5. Fill in the URL, the publishable key and a demo password.

If you skip this, the app still works. Data is just kept in the browser instead.

### Breaking it on purpose

`npm run demo:break` plants three bugs in the parser. The unit tests still pass. The real bank export doesn't:

| Bug | What Kane sees |
| --- | --- |
| `1.625.000,00` read as `1.625` | 0 matched instead of 39 |
| references not trimmed | 10 "Only in Bank" instead of 2 |
| `22/11/2026` read month-first | bank date shows "—" instead of "22 Nov 2026" |

Try it:

```bash
npm install
npm run dev          # http://localhost:5173
npm run gate         # 4/4 pass
npm run demo:break
npm run gate         # fails, with expected vs observed values
```

Then ask Claude Code to make sure ReconPilot handles the sample bank export, and watch it get blocked until the parser is fixed.

## Layout

```
packages/kane-gate   the hook and CLI (Node, no dependencies)
apps/reconpilot      the demo app
apps/site            kane-gate landing page
.kane/specs          specs for this repo
scripts/             sample data and the bug planter
```

Built for the Kane CLI Hackathon.
