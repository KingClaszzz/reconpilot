import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { store } from "./store";
import { seedDemo } from "./seed";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean;
  startDemo(): Promise<User>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    store.currentUser().then((u) => {
      if (!live) return;
      setUser(u);
      setReady(true);
    });
    const off = store.onAuthChange((u) => setUser(u));
    return () => {
      live = false;
      off();
    };
  }, []);

  const value: AuthState = {
    user,
    ready,
    async startDemo() {
      const u = await store.demoSignIn();
      await seedDemo(store);
      setUser(u);
      return u;
    },
    async signOut() {
      await store.signOut();
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="boot" aria-busy="true" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
