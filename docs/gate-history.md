# kane-gate run history

Every kane-gate run on this repo, exported from the local `.kane/runs/` folder (which is gitignored because it holds machine paths). "Stop hook" runs were triggered by Claude Code trying to end a turn; the others were run by hand. Each failed row names the spec that caught it. The one error is Kane CLI itself not being logged in on that run, which kane-gate treats as an environment problem, not an app bug.

The two headless Claude sessions behind the README story ran in a separate worktree; their logs are in [loop-demo/](loop-demo/).

| Started | Trigger | Passed | Failed | Error | Minutes | What failed |
| --- | --- | --: | --: | --: | --: | --- |
| 2026-11-17 04:06 UTC | kane-gate run | 1 | 1 | 0 | 3.2 | Amount mismatch row shows correct dates and difference |
| 2026-11-17 04:10 UTC | kane-gate run | 2 | 0 | 0 | 3.1 |  |
| 2026-11-17 04:14 UTC | kane-gate run | 0 | 2 | 0 | 3.9 | Amount mismatch row shows correct dates and difference; Reconcile sample files — summary counts |
| 2026-11-17 04:21 UTC | Stop hook | 2 | 0 | 0 | 2.6 |  |
| 2026-11-17 04:35 UTC | kane-gate run | 2 | 0 | 0 | 2.5 |  |
| 2026-11-17 04:38 UTC | Stop hook | 2 | 0 | 0 | 2.4 |  |
| 2026-11-17 05:38 UTC | Stop hook | 2 | 0 | 0 | 4.4 |  |
| 2026-11-17 07:44 UTC | kane-gate run | 2 | 0 | 0 | 2.7 |  |
| 2026-11-17 07:47 UTC | Stop hook | 2 | 0 | 0 | 2.8 |  |
| 2026-11-17 07:50 UTC | kane-gate run | 2 | 0 | 0 | 2.5 |  |
| 2026-11-17 08:16 UTC | kane-gate run | 4 | 0 | 0 | 9.5 |  |
| 2026-11-17 08:26 UTC | Stop hook | 4 | 0 | 0 | 8.9 |  |
| 2026-11-17 08:51 UTC | kane-gate run | 4 | 0 | 0 | 10.7 |  |
| 2026-11-17 08:52 UTC | Stop hook | 4 | 0 | 0 | 9.8 |  |
| 2026-11-17 09:07 UTC | Stop hook | 4 | 0 | 0 | 7.7 |  |
| 2026-11-17 09:37 UTC | kane-gate run | 4 | 0 | 0 | 9.7 |  |
| 2026-11-17 09:54 UTC | kane-gate run | 4 | 0 | 0 | 8.7 |  |
| 2026-11-17 10:13 UTC | kane-gate run | 5 | 0 | 0 | 9.9 |  |
| 2026-11-18 04:19 UTC | kane-gate run | 5 | 0 | 0 | 23.3 |  |
| 2026-11-18 04:43 UTC | Stop hook | 5 | 0 | 0 | 15.5 |  |
| 2026-11-18 07:18 UTC | kane-gate run | 7 | 0 | 0 | 27.1 |  |
| 2026-11-18 07:46 UTC | kane-gate run | 0 | 2 | 0 | 6.5 | Amount mismatch row shows correct dates and difference; Reconcile sample files — summary counts |
| 2026-11-18 07:53 UTC | kane-gate run | 2 | 0 | 0 | 6.9 |  |
| 2026-11-18 09:10 UTC | kane-gate run | 1 | 0 | 0 | 4.6 |  |
| 2026-11-25 02:50 UTC | kane-gate run | 1 | 0 | 0 | 7.5 |  |
| 2026-11-25 02:50 UTC | Stop hook | 8 | 0 | 1 | 22.8 |  |
