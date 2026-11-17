const LINKS = {
  repo: "https://github.com/KingClaszzz/reconpilot",
  demo: "#proof",
};
document.querySelectorAll("[data-link]").forEach((a) => {
  const href = LINKS[a.dataset.link];
  if (href && href !== "#") {
    a.href = href;
    if (/^https?:/.test(href)) {
      a.target = "_blank";
      a.rel = "noopener";
    }
  }
});

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const toast = $("#toast");
let toastTimer;
function say(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 1800);
}
document.querySelectorAll(".copy").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied";
      btn.classList.add("done");
      say(`Copied: ${btn.dataset.copy}`);
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("done");
      }, 1600);
    } catch {
      const code = btn.previousElementSibling;
      const range = document.createRange();
      range.selectNodeContents(code);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      say("Selected. Press Ctrl+C to copy.");
    }
  });
});

const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
function selectTab(tab) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => selectTab(t));
  t.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

// Kane's lines and numbers are from a real run with the demo bugs planted. Agent text is shortened.
const WRONG = { Matched: [0, 39], "Only in Bank": [10, 2], "Amount mismatch": [34, 3], "Only in ERP": [11, 3], Duplicate: [2, 2] };
const RIGHT = { Matched: [39], "Only in Bank": [2], "Amount mismatch": [3], "Only in ERP": [3], Duplicate: [2] };

const STEPS = [
  {
    label: "Claude says done",
    gate: "idle",
    status: "Stop hook fired · gate is checking the turn",
    agent: [
      { who: "you", cls: "user", text: "Make ReconPilot handle the sample bank export." },
      { who: "claude", text: "Done. The parser now reads the bank CSV and the unit tests pass (3/3)." },
    ],
    kane: [{ t: "kane-gate ▸ verifying 2 spec(s) against http://localhost:5173", c: "k-head" }],
    browser: { cards: null },
  },
  {
    label: "Kane drives the app",
    gate: "checking",
    status: "Gate down · Kane is testing in Chrome",
    kane: [
      { t: "reconcile-summary · navigate: Navigate to http://localhost:5173/", c: "k-dim" },
      { t: "reconcile-summary · click: Clicking the Load sample data button", c: "k-dim" },
      { t: "reconcile-summary · click: Clicking the Reconcile button", c: "k-dim" },
      { t: "reconcile-summary · analyze: the Only in ERP summary card shows exactly 3", c: "k-dim" },
    ],
    browser: { cards: WRONG, clicked: "reconcile" },
  },
  {
    label: "The check fails",
    gate: "closed",
    status: "Gate closed · 2 of 2 specs failed",
    kane: [
      { t: "✗ FAIL  Reconcile sample files — summary counts (91.8s)", c: "k-fail" },
      { t: '        Matched: expected "39", observed "0"', c: "k-fail" },
      { t: "✗ FAIL  Amount mismatch row shows correct dates and difference (139.6s)", c: "k-fail" },
      { t: '        Bank date: expected "22 Nov 2026", observed "—"', c: "k-fail" },
      { t: "gate closed ✗ — sending Kane's findings back to Claude (round 1/3)", c: "k-dim" },
    ],
    agent: [{ who: "stop hook · blocked", cls: "hook", text: 'kane-gate: 2 of 2 spec(s) FAILED. Matched: expected "39", observed "0". Fix the application code, not the spec.' }],
    browser: { cards: WRONG, flag: true },
  },
  {
    label: "Claude fixes the cause",
    gate: "closed",
    status: "Gate closed · agent is working on Kane's findings",
    agent: [
      {
        who: "claude",
        text: "Kane saw 0 matches out of 39. The bank writes 1.625.000,00 and parseAmount read it as 1.625. References kept trailing spaces, and 22/11/2026 was read month-first. Fixing all three in parse.ts and adding tests for the bank format.",
      },
    ],
    kane: [{ t: "waiting for the agent to finish its turn…", c: "k-dim" }],
    browser: { cards: WRONG, flag: true },
  },
  {
    label: "Kane passes",
    gate: "open",
    status: "Gate open · 2/2 specs verified after 1 fix round",
    kane: [
      { t: "kane-gate ▸ verifying 2 spec(s) (attempt 2)", c: "k-head" },
      { t: "✓ PASS  Amount mismatch row shows correct dates and difference (112.7s)", c: "k-pass" },
      { t: "✓ PASS  Reconcile sample files — summary counts (72.5s)", c: "k-pass" },
      { t: "gate open ✓ — Claude may stop", c: "k-pass" },
    ],
    agent: [{ who: "stop hook · passed", cls: "hook ok", text: "kane-gate ✓ 2/2 specs verified by Kane CLI in a real browser after 1 fix round." }],
    browser: { cards: RIGHT, good: true },
  },
];

const player = $("#player");
const paneAgent = $("#pane-agent");
const paneKane = $("#pane-kane");
const paneBrowser = $("#pane-browser");
const gateStatus = $("#gate-status");
const stepsEl = $("#steps");
const playBtn = $("#play");
const DURATION = [4200, 5200, 5600, 5600, 6000];

stepsEl.innerHTML = STEPS.map(
  (s, i) => `<li><button type="button" role="tab" id="step-${i}" aria-selected="false" aria-controls="player" style="--dur:${DURATION[i]}ms"><span class="n">${i + 1}</span><span class="l">${esc(s.label)}</span><span class="bar"></span></button></li>`,
).join("");
const stepBtns = [...stepsEl.querySelectorAll("button")];

function renderBrowser(b) {
  const top = `<div class="mini-top"><span>ReconPilot</span><span class="mini-btns"><span class="mini-btn">Load sample data</span><span class="mini-btn primary ${b.clicked === "reconcile" && !reduced ? "clicked" : ""}">Reconcile</span></span></div>`;
  if (!b.cards) return `<div class="mini">${top}<div class="mini-empty">bank.csv and erp.csv not loaded yet</div></div>`;
  const cards = Object.entries(b.cards)
    .map(([name, [shown, expected]]) => {
      const wrong = expected !== undefined && shown !== expected;
      const cls = wrong && b.flag ? "bad" : b.good ? "good" : "";
      return `<div class="mini-card ${cls}"><span>${name}</span><b>${shown}</b>${wrong && b.flag ? `<em>expected ${expected}</em>` : ""}</div>`;
    })
    .join("");
  return `<div class="mini">${top}<div class="mini-cards">${cards}</div></div>`;
}

function render(i, animateFrom = i) {
  const s = STEPS[i];
  player.dataset.step = i;
  player.dataset.gate = s.gate;
  gateStatus.textContent = s.status;

  const agent = STEPS.slice(0, i + 1).flatMap((st, k) => (st.agent ?? []).map((m) => ({ ...m, fresh: k >= animateFrom })));
  paneAgent.innerHTML = agent
    .map((m, n) => `<div class="msg ${m.cls ?? ""} ${m.fresh && !reduced ? "line-in" : ""}" style="animation-delay:${m.fresh ? n * 120 : 0}ms"><span class="who">${esc(m.who)}</span><p>${esc(m.text)}</p></div>`)
    .join("");

  const kane = STEPS.slice(0, i + 1).flatMap((st, k) => st.kane.map((l) => ({ ...l, fresh: k >= animateFrom })));
  let d = 0;
  paneKane.innerHTML = kane
    .map((l) => {
      const delay = l.fresh ? (d += 380) : 0;
      return `<div class="${l.c} ${l.fresh && !reduced ? "line-in" : ""}" style="animation-delay:${delay}ms">${esc(l.t)}</div>`;
    })
    .join("");

  paneBrowser.innerHTML = renderBrowser(s.browser);
  for (const el of [paneAgent, paneKane]) el.scrollTop = el.scrollHeight;

  stepBtns.forEach((b, k) => {
    b.setAttribute("aria-selected", k === i);
    const bar = b.querySelector(".bar");
    bar.style.animation = "none";
    void bar.offsetWidth;
    bar.style.animation = "";
  });
}

let current = 0;
let timer = null;
let playing = !reduced;

function schedule() {
  clearTimeout(timer);
  if (!playing) return;
  timer = setTimeout(() => go((current + 1) % STEPS.length, true), DURATION[current] + (current === STEPS.length - 1 ? 1600 : 0));
}
function go(i, auto = false) {
  const from = i > current || i === 0 ? (auto && i === 0 ? 0 : current + 1) : i;
  current = i;
  render(i, i === 0 ? 0 : Math.min(from, i));
  schedule();
}
function setPlaying(p) {
  playing = p;
  player.classList.toggle("paused", !p);
  playBtn.setAttribute("aria-label", p ? "Pause replay" : "Play replay");
  schedule();
}

stepBtns.forEach((b, i) =>
  b.addEventListener("click", () => {
    setPlaying(false);
    current = i;
    render(i, i);
  }),
);
playBtn.addEventListener("click", () => setPlaying(!playing));

// pause while off screen
new IntersectionObserver(([e]) => {
  if (!e.isIntersecting) clearTimeout(timer);
  else schedule();
}).observe(player);

render(0, 0);
setPlaying(playing);
