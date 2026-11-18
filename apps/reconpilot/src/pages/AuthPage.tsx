import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { store } from "../lib/store";
import { errMsg } from "../lib/toast";
import { Logo, Mascot } from "../components/ui";
import { Decode } from "../lib/motion";
import { DemoButton } from "./Landing";

// Supabase sends people back with "#error=...&error_code=otp_expired" when a link is stale.
// Read it before anything else touches the URL.
const startHash = typeof window !== "undefined" ? window.location.hash : "";

function linkError(hash: string): string | null {
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  const code = h.get("error_code") ?? h.get("error");
  if (!code) return null;
  if (code === "otp_expired") return "That confirmation link has expired or was already used. Enter your email below and we'll send you a fresh one.";
  return "That sign-in link didn't work. Enter your email below and we'll send you a new one.";
}

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
  const [needsConfirm, setNeedsConfirm] = useState(false);

  useEffect(() => {
    const msg = linkError(startHash);
    if (!msg) return;
    setError(msg);
    setNeedsConfirm(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function resend() {
    if (!email.trim()) return setError("Enter the email you signed up with, then press Resend.");
    setBusy(true);
    try {
      await store.resendConfirmation(email.trim());
      setError(null);
      setInfo(`A new confirmation link is on its way to ${email.trim()}. It works once and expires after a while, so open it soon.`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }
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
      const msg = errMsg(err);
      if (/not confirmed/i.test(msg)) {
        setNeedsConfirm(true);
        setError("You haven't confirmed this email yet. Open the link we sent, or get a new one below.");
      } else setError(msg);
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
          {needsConfirm && !signup && (
            <button type="button" className="btn ghost block" disabled={busy} onClick={resend}>
              Resend confirmation email
            </button>
          )}
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
          {["INV-1001   1,625.00 CR  ✓", "INV-1007     925.00 CR  ≠", "inv-1012·  7,750.00 CR  ✓", "TRF-2001       6.50 DB  ?", "INV-1019   8,250.00 CR  ≠", "INV-1021   3,100.00 CR  ✓", "INV-1025   7,625.00 CR  ×2", "INV-1030   2,400.00 CR  ✓"].map((l, i) => (
            <p key={i} style={{ animationDelay: `${i * 120}ms` }}>{l}</p>
          ))}
        </div>
        <Mascot className="auth-mascot" size={150} />
        <div className="auth-note">
          <p>Month-end shouldn’t be two days of VLOOKUP.</p>
          <span>ReconPilot turns two exports into a short list of lines that need a person, each closed with a note.</span>
        </div>
      </aside>
    </div>
  );
}
