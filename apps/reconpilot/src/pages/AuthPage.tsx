import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { store } from "../lib/store";
import { errMsg } from "../lib/toast";
import { Logo } from "../components/ui";
import { Decode } from "../lib/motion";
import { DemoButton } from "./Landing";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const from = (loc.state as { from?: string } | null)?.from ?? "/app";

  if (ready && user) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await store.signIn(email.trim(), password);
        nav(from, { replace: true });
      } else {
        const r = await store.signUp(email.trim(), password, workspace.trim() || "My workspace");
        if (r === "confirm") setInfo(`We sent a confirmation link to ${email.trim()}. Open it, then sign in.`);
        else nav("/app", { replace: true });
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === "signup";
  return (
    <div className="auth">
      <section className="auth-form-side">
        <Link to="/" className="auth-logo"><Logo /></Link>
        <form className="auth-form" onSubmit={submit} noValidate={false}>
          <p className="eyebrow"><Decode text={signup ? "NEW WORKSPACE" : "WELCOME BACK"} /></p>
          <h1>{signup ? "Create your workspace" : "Sign in to ReconPilot"}</h1>
          {signup && (
            <label className="field">
              <span>Company</span>
              <input required maxLength={80} autoComplete="organization" placeholder="PT Contoh Sejahtera" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Work email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            {signup && <small className="muted">At least 8 characters.</small>}
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {info && <p className="form-info" role="status">{info}</p>}
          <button type="submit" className="btn primary lg block" disabled={busy}>
            {busy ? "One moment…" : signup ? "Create workspace" : "Sign in"}
          </button>
          <div className="or"><span>or</span></div>
          <DemoButton className="btn ghost lg block" />
          <p className="switch">
            {signup ? <>Already have a workspace? <Link to="/login">Sign in</Link></> : <>New to ReconPilot? <Link to="/signup">Create a workspace</Link></>}
          </p>
        </form>
      </section>
      <aside className="auth-art" aria-hidden>
        <div className="feed-paper">
          {["INV-1001  1.625.000,00  ✓", "INV-1007    925.000,00  ≠", "inv-1012·  7.750.000,00  ✓", "TRF-2001        6.500,00  ?", "INV-1019  8.250.000,00  ≠", "INV-1021  3.100.000,00  ✓", "INV-1025  7.625.000,00  ×2", "INV-1030  2.400.000,00  ✓"].map((l, i) => (
            <p key={i} style={{ animationDelay: `${i * 120}ms` }}>{l}</p>
          ))}
        </div>
        <div className="auth-note">
          <p>Month-end shouldn’t be two days of VLOOKUP.</p>
          <span>ReconPilot turns two exports into a short list of lines that need a person, each closed with a note.</span>
        </div>
      </aside>
    </div>
  );
}
