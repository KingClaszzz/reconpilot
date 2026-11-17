import React, { lazy, Suspense, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import { AppShell } from "./components/AppShell";
import { Assistant } from "./components/Assistant";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import "./styles/base.css";
import "./styles/landing.css";
import "./styles/app.css";
import "./styles/assistant.css";

const Overview = lazy(() => import("./pages/Overview"));
const Runs = lazy(() => import("./pages/Runs"));
const NewRun = lazy(() => import("./pages/NewRun"));
const RunDetail = lazy(() => import("./pages/RunDetail"));
const Exceptions = lazy(() => import("./pages/Exceptions"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Audit = lazy(() => import("./pages/Audit"));
const Settings = lazy(() => import("./pages/Settings"));

const TITLES: [RegExp, string][] = [
  [/^\/app\/runs\/new/, "New reconciliation"],
  [/^\/app\/runs\/./, "Reconciliation"],
  [/^\/app\/runs/, "Reconciliations"],
  [/^\/app\/exceptions/, "Exceptions"],
  [/^\/app\/accounts/, "Bank accounts"],
  [/^\/app\/audit/, "Audit log"],
  [/^\/app\/settings/, "Settings"],
  [/^\/app/, "Overview"],
  [/^\/login/, "Sign in"],
  [/^\/signup/, "Create workspace"],
];

function TitleAndScroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(pathname))?.[1];
    document.title = t ? `${t} · ReconPilot` : "ReconPilot — bank ↔ ERP reconciliation";
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const page = (el: React.ReactNode) => <Suspense fallback={<div className="page"><div className="skeleton-grid" aria-busy="true"><span /><span /><span /><span /></div></div>}>{el}</Suspense>;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <TitleAndScroll />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={page(<Overview />)} />
              <Route path="runs" element={page(<Runs />)} />
              <Route path="runs/new" element={page(<NewRun />)} />
              <Route path="runs/:id" element={page(<RunDetail />)} />
              <Route path="exceptions" element={page(<Exceptions />)} />
              <Route path="accounts" element={page(<Accounts />)} />
              <Route path="audit" element={page(<Audit />)} />
              <Route path="settings" element={page(<Settings />)} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Assistant />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
