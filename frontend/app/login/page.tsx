"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-parchment -mt-6 -mx-4 sm:-mx-6 px-4">
      <form onSubmit={handleSubmit} className="ledger-card w-full max-w-sm p-6">
        <h1 className="font-display text-xl font-bold mb-1">Khata</h1>
        <p className="text-sm text-inkSoft mb-5">{mode === "login" ? "Welcome back." : "Create your ledger."}</p>

        {mode === "register" && (
          <Field label="Name">
            <input className="ledger-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        )}
        <Field label="Email">
          <input type="email" className="ledger-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input type="password" className="ledger-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </Field>

        {error && <p className="text-sm text-rust mb-3">{error}</p>}

        <button disabled={submitting} className="w-full bg-cover text-goldBg rounded py-2 font-semibold text-sm disabled:opacity-50">
          {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <p className="text-sm text-inkSoft mt-4 text-center">
          {mode === "login" ? (
            <>No account yet? <button type="button" className="underline" onClick={() => setMode("register")}>Create one</button></>
          ) : (
            <>Already have an account? <button type="button" className="underline" onClick={() => setMode("login")}>Log in</button></>
          )}
        </p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-xs font-semibold text-inkSoft">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
