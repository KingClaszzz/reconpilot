import type { Account, Activity, Item, Resolution, Run, Store, User } from "./types";
import { runRow, toItems } from "./types";

// Used when Supabase isn't configured. Keeps the same rules (closed periods are read-only, etc).
interface Workspace {
  accounts: Account[];
  runs: Run[];
  items: Record<string, Item[]>;
  activity: Activity[];
}
interface LocalUser extends User {
  hash: string;
}

const SESSION = "reconpilot.session";
const USERS = "reconpilot.users";
const DEMO: User = { id: "demo", email: "demo@reconpilot.app", workspace: "PT Nusantara Niaga (demo)", demo: true };

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("This browser ran out of local storage. Connect Supabase to keep large reconciliations.");
  }
}
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function localStore(): Store {
  const listeners = new Set<(u: User | null) => void>();
  let me: User | null = read<User | null>(SESSION, null);
  if (!me) {
    try {
      const s = sessionStorage.getItem(SESSION);
      if (s) me = JSON.parse(s);
    } catch {
      /* ignore */
    }
  }

  const key = () => `reconpilot.ws.${me?.id ?? "anon"}`;
  const ws = (): Workspace => read<Workspace>(key(), { accounts: [], runs: [], items: {}, activity: [] });
  const save = (w: Workspace) => write(key(), w);
  const setMe = (u: User | null) => {
    me = u;
    try {
      if (u) localStorage.setItem(SESSION, JSON.stringify(u));
      else localStorage.removeItem(SESSION);
    } catch {
      /* ignore */
    }
    listeners.forEach((cb) => cb(u));
  };
  const need = () => {
    if (!me) throw new Error("Please sign in again.");
    return me;
  };
  const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));

  const store: Store = {
    mode: "local",
    async currentUser() {
      return me;
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signIn(email, password) {
      const users = read<LocalUser[]>(USERS, []);
      const u = users.find((x) => x.email === email.trim().toLowerCase());
      if (!u || u.hash !== (await sha256(password))) throw new Error("Invalid login credentials");
      const { hash: _h, ...user } = u;
      setMe(user);
      return user;
    },
    async signUp(email, password, workspace) {
      const users = read<LocalUser[]>(USERS, []);
      const e = email.trim().toLowerCase();
      if (users.some((x) => x.email === e)) throw new Error("User already registered");
      const user: User = { id: uid(), email: e, workspace: workspace || "My workspace", demo: false };
      write(USERS, [...users, { ...user, hash: await sha256(password) }]);
      setMe(user);
      return user;
    },
    async resendConfirmation() {
      throw new Error("This workspace runs in your browser only, so there is no email to confirm.");
    },
    async demoSignIn() {
      setMe(DEMO);
      return DEMO;
    },
    async signOut() {
      setMe(null);
    },

    async listAccounts() {
      return delay(ws().accounts);
    },
    async createAccount(a) {
      const w = ws();
      const acc: Account = { ...a, id: uid(), created_at: new Date().toISOString() };
      w.accounts.push(acc);
      save(w);
      await store.log("Added bank account", `${a.bank} ${a.name} ••${a.last4}`);
      return acc;
    },
    async deleteAccount(id) {
      const w = ws();
      w.accounts = w.accounts.filter((a) => a.id !== id);
      w.runs = w.runs.map((r) => (r.account_id === id ? { ...r, account_id: null } : r));
      save(w);
    },

    async listRuns() {
      return delay([...ws().runs].sort((x, y) => y.period.localeCompare(x.period) || y.created_at.localeCompare(x.created_at)));
    },
    async getRun(id) {
      return delay(ws().runs.find((r) => r.id === id) ?? null);
    },
    async listItems(runId) {
      return delay(ws().items[runId] ?? []);
    },
    async listOpenItems() {
      return delay(Object.values(ws().items).flat().filter((i) => i.resolution === "open"));
    },
    async createRun(input) {
      need();
      const w = ws();
      const id = uid();
      const items = toItems(input, id, uid);
      const run: Run = { id, ...runRow(input, items) };
      w.runs.push(run);
      w.items[id] = items;
      save(w);
      if (!input.created_at) await store.log("Ran reconciliation", input.name, id);
      return run;
    },
    async setResolution(item: Item, resolution: Resolution, note: string | null) {
      const w = ws();
      const run = w.runs.find((r) => r.id === item.run_id);
      if (!run || run.status === "closed") throw new Error("This period is closed, so its lines can no longer be changed.");
      const list = w.items[item.run_id] ?? [];
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx < 0) throw new Error("Line not found");
      const next: Item = { ...list[idx], resolution, note: note?.slice(0, 1000) || null, resolved_at: resolution === "open" ? null : new Date().toISOString() };
      list[idx] = next;
      run.resolved = list.filter((i) => i.resolution === "resolved" || i.resolution === "ignored").length;
      save(w);
      const verb = resolution === "resolved" ? "Resolved" : resolution === "ignored" ? "Ignored" : "Reopened";
      await store.log(`${verb} exception`, item.ref + (next.note ? ` — ${next.note}` : ""), item.run_id);
      return next;
    },
    async closeRun(run) {
      const w = ws();
      const r = w.runs.find((x) => x.id === run.id);
      if (!r || r.status === "closed") throw new Error("This period is already closed.");
      r.status = "closed";
      r.closed_at = new Date().toISOString();
      save(w);
      await store.log("Closed period", run.name, run.id);
      return { ...r };
    },
    async deleteRun(id) {
      const w = ws();
      w.runs = w.runs.filter((r) => r.id !== id);
      delete w.items[id];
      save(w);
    },

    async listActivity(limit = 50) {
      return delay([...ws().activity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit));
    },
    async log(action, target, runId = null, at) {
      const w = ws();
      w.activity.push({ id: uid(), at: at ?? new Date().toISOString(), actor: me?.email ?? "unknown", action, target: target.slice(0, 300), run_id: runId });
      save(w);
    },
    async resetWorkspace() {
      if (!me?.demo) throw new Error("Only the demo workspace can be reset.");
      const w = ws();
      save({ accounts: [], runs: [], items: {}, activity: w.activity });
    },
  };
  return store;
}
