"use client";

// login/page.tsx — N°313 — demande du code de connexion (passwordless) :
// POST /api/tunnel/auth/request-code {email, website (honeypot)} → le code
// part par e-mail (TTL 10 min) → redirection vers /verify?email=…
// N°317 — rebrand « 403Shield Console » (ex MikTunnel N°313-316).
// N°323 — pattern dash.cloudflare.com : la racine de la console redirige
// ici ; un visiteur DÉJÀ connecté (token en localStorage) est renvoyé
// vers /me — le clic « Console » atterrit dans l'espace, pas sur le
// formulaire. Token expiré ? /me le purge (clearToken sur 401) et ramène
// ici : un rebond, jamais une boucle.
// N°326 — refonte visuelle au gabarit dash.cloudflare.com/login, design
// system Clay de la vitrine (palette FreeTech, AuthShell partagé avec
// /verify) : le PARCOURS ne bouge pas d'une ligne de logique (honeypot,
// request-code, redirection /verify) — seul l'habillage change.
// N°329 — boutons « Continuer avec Google / Apple / Facebook » façon CF :
// AUCUN OAuth prestataire n'est branché à ce jour (inscriptions Google/
// Apple/Meta = geste propriétaire, endpoints backend = phase 2) — le clic
// pose une notice HONNÊTE (mka-info, role status), jamais un faux parcours
// ni un lien mort. L'e-mail + code reste LA voie d'entrée.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Info, Mail, MailCheck, Send, ShoppingBag } from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";

/* Marques officielles (SVG inline, aucune dépendance) — « Google » G
 * multicolore, pomme Apple, « f » Facebook. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M13.5 21v-8.2h2.76l.41-3.2H13.5V7.55c0-.93.26-1.56 1.6-1.56h1.7V3.14c-.3-.04-1.31-.13-2.49-.13-2.46 0-4.15 1.5-4.15 4.26v2.33H7.4v3.2h2.76V21h3.34z"
      />
    </svg>
  );
}

const PROVIDERS = [
  { id: "google", label: "Google", Mark: GoogleMark },
  { id: "apple", label: "Apple", Mark: AppleMark },
  { id: "facebook", label: "Facebook", Mark: FacebookMark },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — invisible, rempli = robot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [social, setSocial] = useState(""); // N°329 — notice honnête « bientôt »

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
            ou continuer avec
          </div>

          {/* N°329 — boutons sociaux : marques officielles, clic = notice
              honnête (aucun OAuth branché — voir en-tête de fichier). */}
          <div className="mka-soc">
            {PROVIDERS.map(({ id, label, Mark }) => (
              <button
                key={id}
                type="button"
                className="mka-soc-btn"
                aria-label={`Continuer avec ${label}`}
                title={`Continuer avec ${label}`}
                onClick={() => setSocial(label)}
              >
                <Mark />
                <span className="mka-soc-label">{label}</span>
              </button>
            ))}
          </div>

          {social && (
            <p role="status" className="mka-info">
              <Info className="h-4 w-4" aria-hidden="true" />
              <span>
                La connexion {social} n&apos;est pas encore active
                (inscription prestataire en préparation côté FTech&nbsp;CI).
                En attendant, votre e-mail + code à 6&nbsp;chiffres vous
                ouvre la console en 10&nbsp;minutes.
              </span>
            </p>
          )}

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
