import { createClient, type SupabaseClient, type User as SbUser } from "@supabase/supabase-js";
import type { Account, Activity, Item, NewRunInput, Resolution, Run, Store, User } from "./types";
import { runRow, toItems } from "./types";

const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL || "demo@reconpilot.app";
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || "";

function toUser(u: SbUser): User {
  const email = u.email ?? "";
  return { id: u.id, email, workspace: (u.user_metadata?.workspace as string) || "My workspace", demo: email === DEMO_EMAIL };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// Where the confirmation email sends people back to (must be allowed in Supabase's Redirect URLs).
const confirmUrl = () => `${window.location.origin}/login`;

const ITEM_COLUMNS = "id,run_id,position,status,ref,a,b,diff,source,resolution,note,resolved_at";

export function supabaseStore(url: string, anonKey: string): Store {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  let me: User | null = null;

  async function actor() {
    if (!me) me = await store.currentUser();
    return me?.email ?? "unknown";
  }

  // PostgREST returns at most 1000 rows per request.
  async function allItems(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
    const out: Item[] = [];
    for (let from = 0; ; from += 1000) {
      const page = check(await build(from, from + 999)) as Item[];
      out.push(...page.map(normalizeItem));
      if (page.length < 1000) return out;
    }
  }

  const store: Store = {
    mode: "supabase",

    async currentUser() {
      const { data } = await sb.auth.getSession();
      me = data.session ? toUser(data.session.user) : null;
      return me;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => {
        me = session ? toUser(session.user) : null;
        cb(me);
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const res = await sb.auth.signInWithPassword({ email, password });
      if (res.error || !res.data.user) throw new Error(res.error?.message ?? "Sign-in failed");
      me = toUser(res.data.user);
      return me;
    },
    async signUp(email, password, workspace) {
      const res = await sb.auth.signUp({ email, password, options: { data: { workspace }, emailRedirectTo: confirmUrl() } });
      if (res.error) throw new Error(res.error.message);
      if (!res.data.session || !res.data.user) return "confirm";
      me = toUser(res.data.user);
      return me;
    },
    async resendConfirmation(email) {
      const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: confirmUrl() } });
      if (error) throw new Error(error.message);
    },
    async demoSignIn() {
      if (!DEMO_PASSWORD) throw new Error("Demo account is not configured (VITE_DEMO_PASSWORD).");
      const tried = await sb.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      if (!tried.error && tried.data.user) return (me = toUser(tried.data.user));
      // Fresh project: create the demo user. Only works with email confirmation turned off.
      const created = await sb.auth.signUp({ email: DEMO_EMAIL, password: DEMO_PASSWORD, options: { data: { workspace: "PT Nusantara Niaga (demo)" } } });
      if (created.error || !created.data.session) throw new Error(tried.error?.message || created.error?.message || "Demo sign-in failed");
      return (me = toUser(created.data.user!));
    },
    async signOut() {
      await sb.auth.signOut();
      me = null;
    },

    async listAccounts() {
      return check(await sb.from("accounts").select("id,name,bank,last4,currency,created_at").order("created_at")) as Account[];
    },
    async createAccount(a) {
      const row = check(await sb.from("accounts").insert(a).select("id,name,bank,last4,currency,created_at").single()) as Account;
      await store.log("Added bank account", `${a.bank} ${a.name} ••${a.last4}`);
      return row;
    },
    async deleteAccount(id) {
      check(await sb.from("accounts").delete().eq("id", id));
    },

    async listRuns() {
      return (check(await sb.from("runs").select("*").order("period", { ascending: false }).order("created_at", { ascending: false })) as Run[]).map(normalizeRun);
    },
    async getRun(id) {
      const data = check(await sb.from("runs").select("*").eq("id", id).maybeSingle()) as Run | null;
      return data ? normalizeRun(data) : null;
    },
    async listItems(runId) {
      return allItems((from, to) => sb.from("run_items").select(ITEM_COLUMNS).eq("run_id", runId).order("position").range(from, to));
    },
    async listOpenItems() {
      return allItems((from, to) => sb.from("run_items").select(ITEM_COLUMNS).eq("resolution", "open").order("run_id").order("position").range(from, to));
    },
    async createRun(input: NewRunInput) {
      const items = toItems(input, "", () => "");
      const run = check(await sb.from("runs").insert(runRow(input, items)).select("*").single()) as Run;
      const rows = items.map(({ id: _id, run_id: _r, ...rest }) => ({ ...rest, run_id: run.id }));
      try {
        for (let i = 0; i < rows.length; i += 500) check(await sb.from("run_items").insert(rows.slice(i, i + 500)));
      } catch (e) {
        await sb.from("runs").delete().eq("id", run.id);
        throw e;
      }
      if (!input.created_at) await store.log("Ran reconciliation", input.name, run.id);
      return normalizeRun(run);
    },
    async setResolution(item: Item, resolution: Resolution, note: string | null) {
      const patch = { resolution, note: note?.slice(0, 1000) || null, resolved_at: resolution === "open" ? null : new Date().toISOString() };
      const data = check(await sb.from("run_items").update(patch).eq("id", item.id).select(ITEM_COLUMNS).maybeSingle()) as Item | null;
      if (!data) throw new Error("This period is closed, so its lines can no longer be changed.");
      const verb = resolution === "resolved" ? "Resolved" : resolution === "ignored" ? "Ignored" : "Reopened";
      await store.log(`${verb} exception`, item.ref + (patch.note ? ` — ${patch.note}` : ""), item.run_id);
      return normalizeItem(data);
    },
    async closeRun(run: Run) {
      const data = check(await sb.from("runs").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", run.id).select("*").maybeSingle()) as Run | null;
      if (!data) throw new Error("This period is already closed.");
      await store.log("Closed period", run.name, run.id);
      return normalizeRun(data);
    },
    async deleteRun(id) {
      check(await sb.from("runs").delete().eq("id", id));
    },

    async listActivity(limit = 50) {
      return check(await sb.from("activity").select("id,at,actor,action,target,run_id").order("at", { ascending: false }).limit(limit)) as Activity[];
    },
    async log(action, target, runId = null, at) {
      const row: Record<string, unknown> = { actor: await actor(), action, target: target.slice(0, 300), run_id: runId };
      if (at) row.at = at;
      await sb.from("activity").insert(row); // best effort, don't fail the action over it
    },
    async resetWorkspace() {
      const u = await store.currentUser();
      if (!u?.demo) throw new Error("Only the demo workspace can be reset.");
      check(await sb.from("runs").delete().not("id", "is", null));
      check(await sb.from("accounts").delete().not("id", "is", null));
    },
  };
  return store;
}

function normalizeRun(r: Run): Run {
  return { ...r, totals: { a: Number(r.totals.a), b: Number(r.totals.b), net: Number(r.totals.net) } };
}
function normalizeItem(i: Item): Item {
  return { ...i, diff: i.diff === null ? null : Number(i.diff) };
}
