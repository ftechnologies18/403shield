"use client";

// verify/page.tsx — N°313 — vérification du code à 6 chiffres :
// POST /api/tunnel/auth/verify {email, code} → {token, client} → le token
// (JWT rôle « tunnel », 24 h) part en localStorage → /me.
// N°317 — rebrand « 403Shield Console » (ex MikTunnel N°313-316).
// N°326 — même refonte Clay que /login (AuthShell partagé) : le parcours
// login → verify → me garde UNE seule peau, celle de la vitrine — la
// logique (Suspense, verify, setToken, /me) est inchangée.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { apiFetch, setToken, type VerifyResponse } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";

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
    <div className="mka-card mka-in mka-in-2">
      <span className="mka-tile">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="mka-title">Votre code de connexion</h1>
      <p className="mka-lede">
        Code envoyé à <strong>{email || "votre adresse"}</strong> — saisissez
        les 6 chiffres reçus (valables 10 minutes, un seul usage).
      </p>

      <form onSubmit={submit} className="mka-form">
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
            className="mka-code"
          />
        </div>

        {error && (
          <p role="alert" className="mka-alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || code.length !== 6} className="mka-btn mka-btn-teal">
          {busy ? "Vérification…" : "Me connecter"}
        </button>
      </form>

      <p className="mka-note">
        Code non reçu&nbsp;?{" "}
        <a href="/login" className="mka-link">
          Renvoyer un code
        </a>
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={<p className="mka-note">Chargement du formulaire…</p>}
      >
        <VerifyForm />
      </Suspense>
    </AuthShell>
  );
}
