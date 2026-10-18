"use client";

// login/page.tsx — N°313 — demande du code de connexion (passwordless) :
// POST /api/tunnel/auth/request-code {email, website (honeypot)} → le code
// part par e-mail (TTL 10 min) → redirection vers /verify?email=…
// N°317 — rebrand « 403Shield Console » (ex MikTunnel N°313-316).
// N°323 — pattern dash.cloudflare.com : la racine de la console redirige
// ici ; un visiteur DÉJÀ connecté (token en localStorage) est renvoyé
// vers /me — le clic « Console » atterrit dans l'espace, pas sur le
// formulaire. Token expiré ? /me le purge (clearToken sur 401) et ramène
// ici : un rebond, jamais de boucle.
// N°326 — refonte visuelle au gabarit dash.cloudflare.com/login, design
// system Clay de la vitrine (palette FreeTech, AuthShell partagé avec
// /verify) : le PARCOURS ne bouge pas d'une ligne de logique (honeypot,
// request-code, redirection /verify) — seul l'habillage change.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Mail, MailCheck, Send, ShoppingBag } from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";

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
    <AuthShell>
      <div className="mka-card mka-in mka-in-2">
        <span className="mka-tile">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mka-title">Connexion</h1>
        <p className="mka-lede">
          Entrez votre adresse e-mail&nbsp;: nous vous envoyons un code à 6
          chiffres, valable 10 minutes. Aucun mot de passe à retenir — votre
          adresse e-mail est votre identité 403Shield.
        </p>

        <form onSubmit={submit} className="mka-form">
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
            <label htmlFor="email" className="mka-label">
              Adresse e-mail
            </label>
            <div className="mka-field">
              <Mail className="mka-lead" aria-hidden="true" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="mka-input"
              />
              {/* Cochet teal dès que l'adresse est syntaxiquement valide. */}
              <Check className="mka-tick" aria-hidden="true" />
            </div>
          </div>

          {error && (
            <p role="alert" className="mka-alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="mka-btn mka-btn-teal">
            <Send className="h-4 w-4" aria-hidden="true" />
            {busy ? "Envoi en cours…" : "Recevoir mon code"}
          </button>

          <div className="mka-sep" aria-hidden="true">
            ou
          </div>

          {/* Équivalent CF « Sign up » : l'entrée B2C de la marque est la
              caisse du site (modèle OVH : commander sur www, gérer ici). */}
          <a
            className="mka-btn mka-btn-cream"
            href="https://403shield.ftci.fr/checkout"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Commander un VPN
            <span className="sr-only"> (nouvel onglet — caisse du site 403Shield)</span>
          </a>

          <p className="mka-note">
            Déjà client 403Shield VPN sans compte&nbsp;? Utilisez l&apos;e-mail
            de vos commandes&nbsp;: vos achats apparaîtront dans votre espace.
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
