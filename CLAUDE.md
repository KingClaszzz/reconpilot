# Project notes

<!-- kane-gate -->
## Verification with kane-gate (Kane CLI)

This project is gated by **kane-gate**. When you finish a turn, a Stop hook runs every spec in `.kane/specs/` through Kane CLI in a real browser. If any spec fails you will receive Kane's findings and must keep working.

- Every user-facing feature or bug fix needs a spec in `.kane/specs/<short-name>.md`. Write or update the spec **before** the code.
- A spec is plain English: front matter with `name` and `url` (path relative to the app), then the steps and the exact things to verify (visible text, numbers, states).
- Specs are the source of truth. When Kane reports a failure, fix the application, never weaken the spec, unless the user asked for different behaviour.
- Keep specs short and focused: one user flow per file.
<!-- kane-gate -->
