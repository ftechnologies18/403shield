"use client";

// login/page.tsx — N°313 — demande du code de connexion (passwordless) :
// POST /api/tunnel/auth/request-code {email, website (honeypot)} → le code
// part par e-mail (TTL 10 min) → redirection vers /verify?email=…
// N°317 — rebrand « 403Shield Console » (ex MikTunnel N°313-316).
// N°323 — pattern dash.cloudflare.com : la racine de la console redirige
// ici ; un visiteur DÉJÀ connecté (token en localStorage) est renvoyé
// vers /me — le clic « Console » atterrit dans l'espace, pas sur le
// formulaire. Token expiré ? /me le purge (clearToken sur 401) et
// ramène ici : un rebond, jamais de boucle.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MailCheck, Send } from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — invisible, rempli = robot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* N°323 — déjà connecté ? Direction l'espace (voir en-tête). */
  useEffect(() => {
    if (getToken()) router.replace("/me");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await apiFetch("/api/tunnel/auth/request-code", {
        method: "POST",
        body: { email, website },
      });
      router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible — réessayez");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hero-glow flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <Image src="/logo.png" alt="403Shield" width={36} height={36} className="h-9 w-9 rounded-lg" />
          <div className="flex flex-wrap items-center gap-2 leading-tight">
            <p className="font-semibold tracking-tight text-slate-100">403Shield</p>
            <span className="rounded-full border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">Console</span>
            <p className="text-[11px] text-slate-500">powered by FTech CI</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <MailCheck className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-slate-100">Connexion sans mot de passe</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Entrez votre e-mail : nous vous envoyons un code à 6 chiffres,
            valable 10 minutes. Aucun mot de passe à retenir — votre adresse
            e-mail est votre identité 403Shield.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {/* Honeypot : invisible pour les humains, rempli par les robots. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="hidden"
            />
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden />
              {busy ? "Envoi en cours…" : "Recevoir mon code"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Déjà client 403Shield VPN sans compte ? Utilisez l'e-mail de vos
          commandes : vos achats apparaîtront dans votre espace.
        </p>
      </div>
    </main>
  );
}
