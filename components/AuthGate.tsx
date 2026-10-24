"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";

type GateState = "checking" | "authenticated" | "login" | "setup" | "error";

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<GateState>("checking");
  const [authRequired, setAuthRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const checkSession = useCallback(async () => {
    setState("checking");
    setMessage("");
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json()) as {
        configured?: boolean;
        authRequired?: boolean;
        authenticated?: boolean;
      };

      if (response.status === 503 && data.configured === false) {
        setState("setup");
        return;
      }
      if (!response.ok) throw new Error("The session could not be checked.");

      setAuthRequired(Boolean(data.authRequired));
      setState(data.authenticated ? "authenticated" : "login");
    } catch {
      setMessage("The J.A.R.V.I.S. server could not be reached. Check your connection and try again.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Sign-in failed. Try again.");
      setPassword("");
      await checkSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      setPassword("");
      setBusy(false);
      setState("login");
      setMessage("");
    }
  };

  if (state === "authenticated") {
    return (
      <>
        {children}
        {authRequired && (
          <button
            type="button"
            className="jarvis-session-lock"
            onClick={() => void logout()}
            disabled={busy}
            aria-label="Lock J.A.R.V.I.S. and sign out"
            title="Lock J.A.R.V.I.S."
          >
            LOCK
          </button>
        )}
      </>
    );
  }

  if (state === "checking") {
    return (
      <main className="jarvis-auth-screen" aria-live="polite">
        <div className="jarvis-auth-card"><span className="jarvis-auth-kicker">SECURE LINK</span><p>Checking J.A.R.V.I.S. access…</p></div>
      </main>
    );
  }

  if (state === "setup") {
    return (
      <main className="jarvis-auth-screen">
        <section className="jarvis-auth-card" role="alert">
          <span className="jarvis-auth-kicker">SERVER SETUP REQUIRED</span>
          <h1>Secure this J.A.R.V.I.S. server</h1>
          <p>Before production access, configure <code>JARVIS_ACCESS_PASSWORD</code> and <code>JARVIS_AUTH_SECRET</code> on the server, then restart it.</p>
          <button type="button" onClick={() => void checkSession()}>CHECK AGAIN</button>
        </section>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="jarvis-auth-screen">
        <section className="jarvis-auth-card" role="alert">
          <span className="jarvis-auth-kicker">CONNECTION UNAVAILABLE</span>
          <h1>J.A.R.V.I.S. is offline</h1>
          <p>{message}</p>
          <button type="button" onClick={() => void checkSession()}>RETRY CONNECTION</button>
        </section>
      </main>
    );
  }

  return (
    <main className="jarvis-auth-screen">
      <section className="jarvis-auth-card" aria-labelledby="jarvis-auth-title">
        <span className="jarvis-auth-kicker">PERSONAL AI SYSTEM</span>
        <h1 id="jarvis-auth-title">J.A.R.V.I.S. access</h1>
        <p>Enter the access password configured by the server owner.</p>
        <form onSubmit={login}>
          <label htmlFor="jarvis-access-password">Access password</label>
          <input
            id="jarvis-access-password"
            type="password"
            autoComplete="current-password"
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
          {message && <p className="jarvis-auth-error" role="alert">{message}</p>}
          <button type="submit" disabled={busy || !password}>
            {busy ? "VERIFYING…" : "UNLOCK J.A.R.V.I.S."}
          </button>
        </form>
      </section>
    </main>
  );
}
