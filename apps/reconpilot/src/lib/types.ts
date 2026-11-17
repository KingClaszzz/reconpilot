import type { ReconResult, ResultRow, Status } from "../recon/match";
import type { Txn } from "../recon/parse";

export type Resolution = "auto" | "open" | "resolved" | "ignored";
export type RunStatus = "in_review" | "closed";

export interface User {
  id: string;
  email: string;
  workspace: string;
  demo: boolean;
}

export interface Account {
  id: string;
  name: string;
  bank: string;
  last4: string;
  currency: string;
  created_at: string;
}

export interface Run {
  id: string;
  account_id: string | null;
  name: string;
  period: string; // yyyy-mm
  bank_file: string;
  erp_file: string;
  bank_lines: number;
  erp_lines: number;
  counts: Record<Status, number>;
  totals: { a: number; b: number; net: number };
  exceptions: number;
  resolved: number;
  status: RunStatus;
  created_at: string;
  closed_at: string | null;
}

export interface Item {
  id: string;
  run_id: string;
  position: number;
  status: Status;
  ref: string;
  a: Txn | null;
  b: Txn | null;
  diff: number | null;
  source: "A" | "B" | null;
  resolution: Resolution;
  note: string | null;
  resolved_at: string | null;
}

export interface Activity {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  run_id: string | null;
}

export interface Preset {
  resolution: Resolution;
  note: string | null;
}

export interface NewRunInput {
  account_id: string | null;
  name: string;
  period: string;
  bank_file: string;
  erp_file: string;
  bank_lines: number;
  erp_lines: number;
  result: ReconResult;
  // only set by the demo seed
  created_at?: string;
  status?: RunStatus;
  closed_at?: string | null;
  preset?: (row: ResultRow, index: number) => Preset | null;
}

export interface Store {
  mode: "supabase" | "local";
  currentUser(): Promise<User | null>;
  onAuthChange(cb: (u: User | null) => void): () => void;
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string, workspace: string): Promise<User | "confirm">;
  demoSignIn(): Promise<User>;
  signOut(): Promise<void>;

  listAccounts(): Promise<Account[]>;
  createAccount(a: Omit<Account, "id" | "created_at">): Promise<Account>;
  deleteAccount(id: string): Promise<void>;

  listRuns(): Promise<Run[]>;
  getRun(id: string): Promise<Run | null>;
  listItems(runId: string): Promise<Item[]>;
  listOpenItems(): Promise<Item[]>;
  createRun(input: NewRunInput): Promise<Run>;
  setResolution(item: Item, resolution: Resolution, note: string | null): Promise<Item>;
  closeRun(run: Run): Promise<Run>;
  deleteRun(id: string): Promise<void>;

  listActivity(limit?: number): Promise<Activity[]>;
  log(action: string, target: string, runId?: string | null, at?: string): Promise<void>;
  resetWorkspace(): Promise<void>;
}

export function toItems(input: NewRunInput, runId: string, makeId: () => string): Item[] {
  return input.result.rows.map((r, i) => {
    const preset = r.status === "matched" ? null : input.preset?.(r, i) ?? null;
    const resolution: Resolution = r.status === "matched" ? "auto" : preset?.resolution ?? "open";
    return {
      id: makeId(),
      run_id: runId,
      position: i,
      status: r.status,
      ref: r.ref,
      a: r.a,
      b: r.b,
      diff: r.diff,
      source: r.source ?? null,
      resolution,
      note: preset?.note ?? null,
      resolved_at: resolution === "resolved" || resolution === "ignored" ? input.closed_at ?? input.created_at ?? new Date().toISOString() : null,
    };
  });
}

export function runRow(input: NewRunInput, items: Item[]) {
  const exceptions = items.filter((i) => i.status !== "matched").length;
  const resolved = items.filter((i) => i.resolution === "resolved" || i.resolution === "ignored").length;
  return {
    account_id: input.account_id,
    name: input.name,
    period: input.period,
    bank_file: input.bank_file,
    erp_file: input.erp_file,
    bank_lines: input.bank_lines,
    erp_lines: input.erp_lines,
    counts: input.result.counts,
    totals: input.result.totals,
    exceptions,
    resolved,
    status: input.status ?? ("in_review" as RunStatus),
    created_at: input.created_at ?? new Date().toISOString(),
    closed_at: input.closed_at ?? null,
  };
}

export function atStake(i: Pick<Item, "status" | "diff" | "a" | "b">): number {
  if (i.status === "amount_mismatch") return Math.abs(i.diff ?? 0);
  return Math.abs(i.a?.amount ?? i.b?.amount ?? 0);
}

export const RESOLUTION_LABEL: Record<Resolution, string> = {
  auto: "Auto-matched",
  open: "Open",
  resolved: "Resolved",
  ignored: "Ignored",
};
