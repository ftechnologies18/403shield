"use client";

// verify/page.tsx — N°313 — vérification du code à 6 chiffres :
// POST /api/tunnel/auth/verify {email, code} → {token, client} → le token
// (JWT rôle « tunnel », 24 h) part en localStorage → /me.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { apiFetch, setToken, type VerifyResponse } from "@/lib/api";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = (params.get("email") ?? "").toLowerCase();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || code.length !== 6) return;
    setError("");
    setBusy(true);
    try {
      const out = await apiFetch<VerifyResponse>("/api/tunnel/auth/verify", {
        method: "POST",
        body: { email, code },
      });
      setToken(out.token);
      router.replace("/me");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vérification impossible — réessayez");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <KeyRound className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="flex flex-wrap items-center gap-2 leading-tight">
          <p className="font-semibold tracking-tight text-slate-100">MikTunnel</p>
          <span className="rounded-full border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">by MikCloud</span>
          <p className="text-[11px] text-slate-500">powered by FTech CI</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-slate-100">Votre code de connexion</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Code envoyé à{" "}
          <span className="font-medium text-slate-200">{email || "votre adresse"}</span> —
          saisissez les 6 chiffres reçus (valables 10 minutes, un seul usage).
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="code" className="sr-only">
              Code à 6 chiffres
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="code-input w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-3 text-center text-xl font-semibold text-slate-100 placeholder:text-slate-700 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Vérification…" : "Me connecter"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Code non reçu ?{" "}
          <a href="/login" className="text-emerald-400 hover:text-emerald-300">
            Renvoyer un code
          </a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="hero-glow flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Suspense
        fallback={<p className="text-sm text-slate-500">Chargement du formulaire…</p>}
      >
        <VerifyForm />
      </Suspense>
    </main>
  );
}
