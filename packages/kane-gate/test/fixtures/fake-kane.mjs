// Fake kane-cli for tests. FAKE_KANE=pass|fail|infra; each call is logged to FAKE_KANE_LOG.
import { appendFileSync } from "node:fs";

const mode = process.env.FAKE_KANE ?? "pass";
if (process.env.FAKE_KANE_LOG) appendFileSync(process.env.FAKE_KANE_LOG, mode + "\n");
const out = (o) => process.stdout.write(JSON.stringify({ ...o, v: 1 }) + "\n");

out({ type: "stream_start", surface: "run" });
out({ step: 2, status: "done", remark: "navigate: Navigate to the app" });
if (mode === "pass") {
  out({ step: 3, status: "done", remark: "assert: total is 39" });
  out({ type: "run_end", status: "passed", one_liner: "verified total", reason: "Objective completed", credits_consumed: 10, context: { memory: {} } });
  process.exit(0);
}
if (mode === "infra") {
  out({ type: "run_end", status: "failed", reason: "Screenshot failed: TargetClosedError: Target page, context or browser has been closed", context: { memory: {} } });
  process.exit(1);
}
out({ step: 3, status: "failed", remark: "assert: total is 39" });
out({
  type: "run_end",
  status: "failed",
  one_liner: "Total shows 0 instead of 39",
  reason: 'Final verification failed: "total is 39"',
  credits_consumed: 12,
  context: { memory: { total: { condition: "total is 39", expected_value: "39", extracted_value: "0", reasoning: "value '0' equals '39' -> FAIL" } } },
});
process.stderr.write("evidence: view locally with `kane-cli evidence serve C:\\tmp\\pack.evidence`\n");
process.exit(1);
