import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Tone = "ok" | "err";
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; tone: Tone; id: number } | null>(null);
  const timer = useRef<number>();
  const show = useCallback((msg: string, tone: Tone = "ok") => {
    window.clearTimeout(timer.current);
    setT({ msg, tone, id: Date.now() });
    timer.current = window.setTimeout(() => setT(null), tone === "err" ? 6000 : 3200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {t && (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span className="toast-mark" aria-hidden>{t.tone === "ok" ? "✓" : "!"}</span>
            {t.msg}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
