import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { store } from "../lib/store";
import { seedDemo } from "../lib/seed";
import { errMsg, useToast } from "../lib/toast";
import { PageHead } from "../components/ui";

export default function Settings() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    if (!armed) return setArmed(true);
    setBusy(true);
    try {
      await store.resetWorkspace();
      await seedDemo(store);
      await store.log("Reset demo workspace", "");
      toast("Demo workspace restored");
      nav("/app");
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <div className="page narrow">
      <PageHead eyebrow="Settings" title="Workspace" />
      <section className="card settings">
        <dl className="kv">
          <div><dt>Workspace</dt><dd>{user?.workspace}</dd></div>
          <div><dt>Signed in as</dt><dd>{user?.email}</dd></div>
          <div>
            <dt>Storage</dt>
            <dd>{store.mode === "supabase" ? "Supabase Postgres. Row-level security limits every query to your own workspace; closed periods are locked by the database." : "This browser only (Supabase is not configured for this deployment)."}</dd>
          </div>
          <div><dt>Matching rule</dt><dd>Reference after trimming spaces and ignoring case; amounts must agree to the cent.</dd></div>
        </dl>
        <div className="settings-actions">
          <button type="button" className="btn ghost" onClick={async () => { await signOut(); nav("/"); }}>Sign out</button>
          {user?.demo && (
            <button type="button" className={`btn ${armed ? "danger" : "ghost"}`} disabled={busy} onClick={reset}>
              {busy ? "Restoring…" : armed ? "Click again to wipe and restore" : "Reset demo data"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
