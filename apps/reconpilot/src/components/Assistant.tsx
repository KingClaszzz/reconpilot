import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "react-router";
import { getPageContext } from "../lib/assistant-context";
import { Icon } from "./ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

function suggestionsFor(path: string): string[] {
  if (path.startsWith("/app/runs/") && path !== "/app/runs/new") return ["Which exception should I look at first?", "Explain the largest difference", "What does Amount mismatch mean?"];
  if (path.startsWith("/app/exceptions")) return ["How do I clear this queue fastest?", "What usually causes Only in Bank?", "What does Amount mismatch mean?"];
  if (path.startsWith("/app/runs/new")) return ["What columns does the bank file need?", "Why are dates read as day-first?", "What does Amount mismatch mean?"];
  if (path.startsWith("/app")) return ["How do I close a period?", "What does the match rate measure?", "What does Amount mismatch mean?"];
  return ["What does Amount mismatch mean?", "Is my bank data safe?", "How does matching work?"];
}

// Tiny, safe markdown: paragraphs, bullets, **bold** and `code`. No HTML is ever injected.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part,
  );
}
function Rich({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l)))
          return (
            <ul key={i}>
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>)}
            </ul>
          );
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l)}</span>)}</p>;
      })}
    </>
  );
}

export function Assistant() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [msgs]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history = [...msgs.filter((m) => !m.error), { role: "user" as const, content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const context = [`Current page: ${pathname}`, getPageContext()].filter(Boolean).join("\n");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), context }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "The assistant is unavailable right now." }));
        throw new Error(err.error || "The assistant is unavailable right now.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: text }]);
      }
      if (!text.trim()) throw new Error("No answer came back. Try asking again.");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMsgs((m) => (m.at(-1)?.content ? m : m.slice(0, -1)));
      } else {
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: (e as Error).message, error: true }]);
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  const suggestions = suggestionsFor(pathname);

  return (
    <div className={`assistant ${open ? "open" : ""}`}>
      {open && (
        <section className="as-panel" role="dialog" aria-label="ReconPilot assistant">
          <header className="as-head">
            <img src="/brand/mascot.webp" alt="" width={36} height={42} />
            <div>
              <h2>ReconPilot assistant</h2>
              <p>Answers about your reconciliation. Double-check anything you book.</p>
            </div>
            {msgs.length > 0 && (
              <button type="button" className="text-btn" onClick={() => !busy && setMsgs([])} disabled={busy}>New chat</button>
            )}
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
              <Icon name="close" />
            </button>
          </header>

          <div className="as-log" ref={log} aria-live="polite">
            {msgs.length === 0 ? (
              <div className="as-empty">
                <p>Hi! Ask me about matching, exceptions or closing a period. On a reconciliation page I can see its numbers too.</p>
                <div className="as-suggest">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`as-msg ${m.role === "user" ? "from-user" : "from-bot"} ${m.error ? "error" : ""}`}>
                  {m.role === "assistant" && !m.content && busy ? (
                    <span className="as-typing" aria-label="Thinking"><i /><i /><i /></span>
                  ) : m.role === "assistant" ? (
                    <Rich text={m.content} />
                  ) : (
                    <p>{m.content}</p>
                  )}
                </div>
              ))
            )}
          </div>

          <form className="as-form" onSubmit={submit}>
            <textarea
              ref={box}
              rows={1}
              maxLength={2000}
              value={input}
              placeholder="Ask about this page…"
              aria-label="Message ReconPilot"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
            />
            {busy ? (
              <button type="button" className="as-send" onClick={() => abort.current?.abort()} aria-label="Stop answer">
                <span className="as-stop" />
              </button>
            ) : (
              <button type="submit" className="as-send" disabled={!input.trim()} aria-label="Send">
                <Icon name="arrow" size={18} />
              </button>
            )}
          </form>
        </section>
      )}

      {!open && (
        <button type="button" className="as-pill" onClick={() => setOpen(true)} aria-label="Ask ReconPilot">
          <img src="/brand/mascot.webp" alt="" width={30} height={35} />
          <span>Ask ReconPilot</span>
          <kbd>AI</kbd>
        </button>
      )}
    </div>
  );
}
