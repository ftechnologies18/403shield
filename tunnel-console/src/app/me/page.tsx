"use client";

// me/page.tsx — N°334-B — REFONTE DE L'ESPACE CLIENT, STYLE CONSOLE /app/vpn
// (consigne propriétaire : « https://console.403shield.ftci.fr/me est laid,
// expérience utilisateur brisée, impossible de scanner le QR code de
// configuration WireGuard »). Le volet reprend le langage de la vue
// « VPN WireGuard » de la console opérateur (403shield.ftci.fr/app/vpn) et
// l'adapte au client B2C (VPN personnel) comme B2B (Accès Pro) :
//
//   - THÈME CLAIR « console » (fond neutre #F5F6F8, cartes blanches,
//     accents émeraude, wordmark aurora) — /me peint son propre monde
//     (doctrine N°326), le html bascule en clair pendant la visite,
//     retour au sombre pour /pro à la sortie ;
//   - KPI STAT CARDS (miroir /app/vpn) : accès actifs · appareils ·
//     échéances ≤ 7 j · prochaine échéance — données RÉELLES du contrat
//     /api/tunnel/me uniquement (doctrine : aucun faux chiffre) ;
//   - LA RÉPARATION UX n°1 : la modale « Voir la configuration » livrait
//     la conf en TEXTE SEUL — l'aide invitait à « importer depuis un QR
//     code » qui n'existait pas. La conf est désormais livrée en QR
//     SCANNABLE (qrcode.react, même lib/même version que la console
//     opérateur, marge de silence incluse) + copie + TÉLÉCHARGEMENT
//     .conf (WireGuard : « importer depuis un fichier ») + instructions
//     adaptées à la FAMILLE (b2c : scan caméra ; pro : fichier sur
//     routeur/NAS) — les trois voies d'import de l'app WireGuard couvertes ;
//   - le portefeuille, le reveal (la conf ne quitte jamais le coffre sans
//     action explicite), le renouvellement 1-clic (Wave/carte GeniusPay,
//     canal manuel en repli) et le bandeau de retour de paiement sont
//     conservés à l'identique (contrat N°314 inchangé) : seul l'habillage
//     change.
//
// Contrat backend (handlers_tunnel.go / handlers_tunnel_orders.go, N°314/315) :
//   GET  /api/tunnel/me                       → profil + orders[] enrichies
//   POST /api/tunnel/orders/{ref}/reveal      → {ref, conf, ipv4, plan, expiresAt…}
//   POST /api/tunnel/orders/{ref}/renew       → {ref, paymentUrl, online…}

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CalendarClock,
  Check,
  Copy,
  CreditCard,
  Download,
  HardDrive,
  LogOut,
  QrCode,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import {
  apiFetch,
  clearToken,
  getToken,
  tunnelRenew,
  tunnelReveal,
  type MeResponse,
  type RevealResponse,
  type TunnelOrder,
} from "@/lib/api";

// Thème clair : statuts en émeraude/ambre/ciel sur fond blanc (miroir des
// badges de la vue /app/vpn — plus de palette sombre slate-950).
const statusLabels: Record<string, { label: string; classes: string }> = {
  pending: { label: "En attente de paiement", classes: "border-amber-500/40 bg-amber-500/10 text-amber-700" },
  paid: { label: "Paiement reçu", classes: "border-sky-500/40 bg-sky-500/10 text-sky-700" },
  provisioned: { label: "Actif", classes: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700" },
  cancelled: { label: "Annulée", classes: "border-slate-400/60 bg-slate-400/20 text-slate-600" },
  expired: { label: "Expirée", classes: "border-slate-400/60 bg-slate-400/20 text-slate-600" },
};

const plans = [
  { id: "vpn-b2c-month", label: "1 mois", amount: 1500 },
  { id: "vpn-b2c-year", label: "12 mois (≈ 2 mois offerts)", amount: 15000 },
] as const;

// N°315 — formules famille « pro » (renouvellement d'un Accès Pro : prix ET
// produit — le backend refuse le croisement des familles, la console propose
// la BONNE liste d'emblée).
const proPlans = [
  { id: "vpn-pro-month", label: "1 mois", amount: 3500 },
  { id: "vpn-pro-year", label: "12 mois (≈ 2 mois offerts)", amount: 35000 },
] as const;

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function daysLeft(iso: string): number | null {
  if (!iso) return null;
  try {
    const ms = new Date(iso).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    return Math.ceil(ms / 86_400_000);
  } catch {
    return null;
  }
}

function formatFcfa(n: number): string {
  return n.toLocaleString("fr-FR") + " FCFA";
}

export default function MePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [returnOrder, setReturnOrder] = useState("");

  // Reveal (re-livraison de la conf).
  const [revealFor, setRevealFor] = useState<TunnelOrder | null>(null);
  const [reveal, setReveal] = useState<RevealResponse | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const confRef = useRef<HTMLDivElement | null>(null);
  const revealHeadRef = useRef<HTMLHeadingElement | null>(null);

  // Renouvellement.
  const [renewFor, setRenewFor] = useState<TunnelOrder | null>(null);
  const [renewPlan, setRenewPlan] = useState<string>("vpn-b2c-month");
  const [renewMethod, setRenewMethod] = useState<string>("wave");
  const [renewPhone, setRenewPhone] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewError, setRenewError] = useState("");
  const [renewNotice, setRenewNotice] = useState("");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setMe(await apiFetch<MeResponse>("/api/tunnel/me", { token }));
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Espace indisponible — réessayez");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Retour de paiement GeniusPay : ?order=REF → bandeau + rafraîchissement
    // (le statut réel peut mettre quelques secondes à converger — webhook).
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("order");
    if (ref) {
      setReturnOrder(ref);
      window.history.replaceState({}, "", window.location.pathname);
    }
    void load();
  }, [load]);

  // N°334-B — Escape ferme les modales ouvertes (clavier, même confort que la
  // console opérateur) ; le focus part sur le titre de la modale reveal.
  useEffect(() => {
    if (!revealFor && !renewFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRevealFor(null);
        setRenewFor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealFor, renewFor]);

  useEffect(() => {
    if (revealFor) {
      // Le rendu suivant existe : donner le focus au titre (lecteur d'écran).
      requestAnimationFrame(() => revealHeadRef.current?.focus());
    }
  }, [revealFor]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  async function openReveal(order: TunnelOrder) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setRevealFor(order);
    setReveal(null);
    setRevealError("");
    setCopied(false);
    setDownloaded(false);
    setRevealLoading(true);
    try {
      setReveal(await tunnelReveal(order.ref, token));
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : "Configuration indisponible — réessayez");
    } finally {
      setRevealLoading(false);
    }
  }

  async function copyConf() {
    if (!reveal?.conf) return;
    try {
      await navigator.clipboard.writeText(reveal.conf);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Repli : sélection manuelle du bloc affiché.
      const range = document.createRange();
      if (confRef.current) {
        range.selectNodeContents(confRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  // N°334-B — téléchargement .conf : la 2e voie d'import officielle de
  // l'app WireGuard (« + » → « Importer depuis un fichier ») — surtout
  // utile côté B2B (routeur/NAS sous RouterOS 7 n'a pas de caméra).
  function downloadConf() {
    if (!reveal?.conf) return;
    const name = `403shield-${reveal.ref || revealFor?.ref || "acces"}.conf`;
    const blob = new Blob([reveal.conf], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  async function submitRenew() {
    const token = getToken();
    if (!renewFor) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (renewMethod === "wave" && renewPhone.replace(/\D/g, "").length < 8) {
      setRenewError("Un numéro de téléphone valide est requis pour payer par Wave.");
      return;
    }
    setRenewLoading(true);
    setRenewError("");
    setRenewNotice("");
    try {
      const out = await tunnelRenew(renewFor.ref, token, {
        planId: renewPlan,
        payMethod: renewMethod,
        phone: renewPhone || undefined,
      });
      if (out.paymentUrl) {
        // GeniusPay : le paiement se règle sur la page du prestataire — le
        // retour ramènera ici (?order=REF) et l'échéance étendue suivra.
        window.location.href = out.paymentUrl;
        return;
      }
      // Canal manuel : la plateforme confirme le paiement — honnête et traçable.
      setRenewNotice(
        "Commande " +
          out.ref +
          " enregistrée (" +
          formatFcfa(out.amountFcfa) +
          ", canal manuel). La plateforme confirmera votre paiement — votre échéance s'étendra automatiquement.",
      );
      setRenewFor(null);
      void load();
    } catch (err) {
      setRenewError(err instanceof Error ? err.message : "Renouvellement impossible — réessayez");
    } finally {
      setRenewLoading(false);
    }
  }

  // — KPI dérivés du SEUL contrat /api/tunnel/me (doctrine : aucun faux
  // chiffre — rien n'est inventé, tout se relit sur les commandes) —
  const activeOrders = me?.orders.filter((o) => o.status === "provisioned") ?? [];
  const soonOrders = activeOrders.filter((o) => {
    const left = daysLeft(o.expiresAt);
    return left !== null && left >= 0 && left <= 7;
  });
  const nextExpiry = activeOrders
    .map((o) => o.expiresAt)
    .filter((d) => d && daysLeft(d) !== null && (daysLeft(d) as number) >= 0)
    .sort()[0];

  return (
    <div className="mkme-page flex min-h-screen flex-col bg-[#f5f6f8] text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="403Shield" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <div className="flex flex-wrap items-center gap-2 leading-tight">
              <p className="mkme-aurora text-base font-bold tracking-tight">403Shield</p>
              <span className="rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Console
              </span>
              <p className="hidden text-[11px] text-slate-500 sm:block">powered by FTech CI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {me && (
              <p className="hidden max-w-48 truncate text-xs text-slate-500 md:block" title={me.client.email}>
                {me.client.email}
              </p>
            )}
            <button
              onClick={logout}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          {returnOrder && (
            <div
              role="status"
              className="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-800"
            >
              <p className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                Paiement de la commande {returnOrder}
              </p>
              <p className="mt-1 text-sky-700/80">
                Si votre paiement est confirmé, l&apos;échéance s&apos;est étendue ci-dessous —
                sinon elle apparaîtra dans quelques instants. En cas de doute, rafraîchissez.
              </p>
              <button
                onClick={() => void load()}
                className="mt-2 font-semibold underline underline-offset-2"
              >
                Rafraîchir maintenant
              </button>
            </div>
          )}

          {loading && !me && (
            <div className="space-y-4" aria-busy="true" aria-label="Chargement de l'espace">
              <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                ))}
              </div>
              <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700">
              {error}
              <button onClick={() => void load()} className="ml-3 font-semibold underline underline-offset-2">
                Réessayer
              </button>
            </div>
          )}

          {me && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Mon espace
                </p>
                <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900" title={me.client.email}>
                  {me.client.email}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Client 403Shield depuis le {formatDate(me.client.createdAt)}
                  {typeof me.devices === "number"
                    ? ` · ${me.devices} appareil${me.devices > 1 ? "s" : ""} actif${me.devices > 1 ? "s" : ""}`
                    : ""}
                </p>
              </section>

              {/* KPI — miroir de la vue /app/vpn : que du réel, dérivé du contrat. */}
              <section aria-label="Aperçu de l'espace" className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                    Accès actifs
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {activeOrders.length}
                    <span className="ml-1 text-sm font-normal text-slate-500">/ {me.orders.length} cmd</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">commandes actives sur le portefeuille</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <HardDrive className="h-4 w-4 text-emerald-600" aria-hidden />
                    Appareils
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{me.devices ?? 0}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">peers WireGuard provisionnés</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <CalendarClock
                      className={`h-4 w-4 ${soonOrders.length > 0 ? "text-amber-500" : "text-emerald-600"}`}
                      aria-hidden
                    />
                    Expire bientôt
                  </div>
                  <p
                    className={`mt-1 text-2xl font-bold tabular-nums ${
                      soonOrders.length > 0 ? "text-amber-600" : "text-slate-900"
                    }`}
                  >
                    {soonOrders.length}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">échéances dans ≤ 7 jours</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Receipt className="h-4 w-4 text-emerald-600" aria-hidden />
                    Prochaine échéance
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {nextExpiry ? formatDate(nextExpiry) : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {nextExpiry
                      ? `${daysLeft(nextExpiry) ?? "—"} jour(s) restant(s)`
                      : "aucun accès actif à échéance"}
                  </p>
                </div>
              </section>

              <section className="mt-8" aria-label="Mes appareils et commandes">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                    <HardDrive className="h-4 w-4 text-emerald-600" aria-hidden />
                    Mes appareils et commandes
                  </h2>
                  <button
                    onClick={() => void load()}
                    disabled={loading}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
                    Rafraîchir
                  </button>
                </div>

                {me.orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                    <p className="text-sm text-slate-600">
                      Aucune commande pour cet e-mail. Les achats faits sur la{" "}
                      <a
                        href="https://403shield.ftci.fr/checkout"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                      >
                        boutique 403Shield
                      </a>{" "}
                      avec cette adresse apparaîtront ici.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {me.orders.map((o) => {
                      const s = statusLabels[o.status] ?? {
                        label: o.status,
                        classes: "border-slate-400/60 bg-slate-400/20 text-slate-600",
                      };
                      const left = daysLeft(o.expiresAt);
                      const isRenewal = o.kind === "renewal";
                      // N°315 — famille de formule : badge + orientation vers
                      // la page dédiée (LAN étendu, re-apply, appareils).
                      const isPro = o.family === "pro";
                      return (
                        <li
                          key={o.ref}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 font-mono text-sm font-semibold text-slate-900">
                                {o.ref}
                                {isPro ? (
                                  <span className="rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                                    Accès Pro · B2B
                                  </span>
                                ) : (
                                  o.status === "provisioned" && (
                                    <span className="rounded-full border border-slate-400/50 bg-slate-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                      VPN personnel · B2C
                                    </span>
                                  )
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {isRenewal ? "Renouvellement" : o.plan}
                                {o.renewTargetRef ? ` de ${o.renewTargetRef}` : ""}
                                {" · "}
                                {formatDate(o.createdAt)}
                                {typeof o.amountFcfa === "number" && o.amountFcfa > 0
                                  ? ` · ${formatFcfa(o.amountFcfa)}`
                                  : ""}
                              </p>
                              {isPro && (
                                <p className="mt-1 text-xs text-emerald-700/90">
                                  Routeurs + caméras/NAS — gestion sur la{" "}
                                  <a href="/pro" className="font-semibold underline underline-offset-2 hover:text-emerald-800">
                                    page Accès Pro
                                  </a>
                                </p>
                              )}
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${s.classes}`}
                            >
                              {s.label}
                            </span>
                          </div>

                          {o.expiresAt && (
                            <p
                              className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                                left !== null && left <= 7 && left >= 0
                                  ? "text-amber-600"
                                  : left !== null && left < 0
                                    ? "text-slate-400"
                                    : "text-slate-500"
                              }`}
                            >
                              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {left !== null && left >= 0
                                ? `Couvert jusqu'au ${formatDate(o.expiresAt)} — ${left} jour${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}`
                                : `Terme atteint le ${formatDate(o.expiresAt)}`}
                            </p>
                          )}

                          {(o.revealable || o.renewable) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {o.revealable && (
                                <button
                                  onClick={() => void openReveal(o)}
                                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                >
                                  <QrCode className="h-3.5 w-3.5" aria-hidden />
                                  Voir la configuration
                                </button>
                              )}
                              {o.renewable && (
                                <button
                                  onClick={() => {
                                    setRenewFor(o);
                                    // N°315 — la formule par défaut suit la FAMILLE de
                                    // l'accès (un Pro se renouvelle en Pro).
                                    setRenewPlan(isPro ? "vpn-pro-month" : "vpn-b2c-month");
                                    setRenewError("");
                                    setRenewNotice("");
                                  }}
                                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                >
                                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                                  Renouveler
                                </button>
                              )}
                            </div>
                          )}

                          {o.status === "pending" && (
                            <p className="mt-2 text-xs text-slate-500">
                              En attente de règlement — le lien de paiement GeniusPay expire sous 24 h ;
                              la plateforme confirme les canaux manuels.
                            </p>
                          )}
                          {o.status === "expired" && !isRenewal && (
                            <p className="mt-2 text-xs text-slate-500">
                              L&apos;appareil a été révoqué au terme. Pour repartir,{" "}
                              <a
                                href="https://403shield.ftci.fr/checkout"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                              >
                                souscrivez un nouvel accès
                              </a>{" "}
                              (une nouvelle configuration vous sera livrée).
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {revealFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Configuration WireGuard"
          onClick={() => setRevealFor(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  ref={revealHeadRef}
                  tabIndex={-1}
                  className="text-base font-bold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Configuration WireGuard — {revealFor.ref}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {reveal?.plan ?? revealFor.plan}
                  {reveal?.ipv4 ? ` · tunnel ${reveal.ipv4}` : ""}
                  {reveal?.expiresAt ? ` · jusqu'au ${formatDate(reveal.expiresAt)}` : ""}
                </p>
              </div>
              <button
                onClick={() => setRevealFor(null)}
                aria-label="Fermer"
                className="rounded-xl border border-slate-300 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {revealLoading && (
              <div className="mt-4 h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100/70" aria-busy="true" />
            )}
            {revealError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
                {revealError}
              </div>
            )}
            {reveal && (
              <>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                  {/* QR SCANNABLE — la réparation UX n°1 : marge de silence
                      incluse (marginSize 2) + fond blanc encadré, l'app
                      WireGuard le lit à bout de bras. */}
                  <div className="mx-auto shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mx-0">
                    <div
                      role="img"
                      aria-label="QR code de la configuration WireGuard — scannez-le depuis l'application WireGuard"
                      className="rounded-lg bg-white"
                    >
                      <QRCodeSVG
                        value={reveal.conf}
                        size={204}
                        level="L"
                        marginSize={2}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                        className="h-[204px] w-[204px]"
                      />
                    </div>
                    <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
                      Scan depuis l&apos;app WireGuard
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      ref={confRef}
                      className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-slate-700"
                    >
                      {reveal.conf}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void copyConf()}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Copiée
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            Copier
                          </>
                        )}
                      </button>
                      <button
                        onClick={downloadConf}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {downloaded ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Téléchargé
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            Fichier .conf
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instructions adaptées à la FAMILLE (b2c vs pro) — les trois
                    voies d'import officielles de WireGuard sont couvertes. */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                  {revealFor.family === "pro" ? (
                    <>
                      <p className="font-semibold text-slate-800">Accès Pro — routeurs, caméras, NAS</p>
                      <p className="mt-1">
                        Sur RouterOS 7 : <span className="font-mono">WireGuard</span> →{" "}
                        <span className="font-mono">Peers</span> → importez le fichier{" "}
                        <span className="font-mono">.conf</span> téléchargé (ou collez la configuration copiée
                        dans un tunnel existant — un renouvellement ne change jamais la conf, c&apos;est
                        l&apos;argument). Le QR se scanne aussi depuis l&apos;app WireGuard d&apos;un
                        téléphone de secours. La gestion complète (LAN étendu, re-apply) vit sur la{" "}
                        <a href="/pro" className="font-semibold text-emerald-700 underline underline-offset-2">
                          page Accès Pro
                        </a>
                        .
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-800">VPN personnel — IP fixe France</p>
                      <p className="mt-1">
                        Ouvrez l&apos;application WireGuard → «&nbsp;+&nbsp;» → «&nbsp;Créer à partir d&apos;un
                        QR code&nbsp;» et pointez l&apos;appareil photo vers le code (Android / iOS), ou
                        «&nbsp;Importer depuis un fichier&nbsp;» avec le{" "}
                        <span className="font-mono">.conf</span> téléchargé (Windows / macOS / Linux). La
                        configuration ne quitte jamais le coffre sans votre action — vous pouvez la
                        re-visualiser ici à tout moment.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {renewFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Renouveler l'accès"
          onClick={() => setRenewFor(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">Renouveler {renewFor.ref}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Votre appareil et votre configuration sont conservés — seule l&apos;échéance s&apos;étend.
                  {renewFor.expiresAt
                    ? ` Actuellement couvert jusqu'au ${formatDate(renewFor.expiresAt)}.`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => setRenewFor(null)}
                aria-label="Fermer"
                className="rounded-xl border border-slate-300 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <fieldset className="mt-5">
              <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Formule
              </legend>
              <div className="mt-2 space-y-2">
                {(renewFor?.family === "pro" ? proPlans : plans).map((p) => (
                  <label
                    key={p.id}
                    className={`flex min-h-11 cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                      renewPlan === p.id
                        ? "border-emerald-600 bg-emerald-500/10 text-slate-900"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="renew-plan"
                        value={p.id}
                        checked={renewPlan === p.id}
                        onChange={() => setRenewPlan(p.id)}
                        className="accent-emerald-600"
                      />
                      {renewFor?.family === "pro" ? "403Shield Pro — " : "403Shield VPN — "}
                      {p.label}
                    </span>
                    <span className="font-semibold tabular-nums">{formatFcfa(p.amount)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Moyen de paiement
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRenewMethod("wave")}
                  aria-pressed={renewMethod === "wave"}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                    renewMethod === "wave"
                      ? "border-emerald-600 bg-emerald-500/10 text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <Smartphone className="h-4 w-4" aria-hidden />
                  Wave
                </button>
                <button
                  type="button"
                  onClick={() => setRenewMethod("card")}
                  aria-pressed={renewMethod === "card"}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                    renewMethod === "card"
                      ? "border-emerald-600 bg-emerald-500/10 text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <CreditCard className="h-4 w-4" aria-hidden />
                  Carte
                </button>
              </div>
              {renewMethod === "wave" && (
                <div className="mt-3">
                  <label htmlFor="renew-phone" className="text-xs font-medium text-slate-600">
                    Numéro Wave à débiter
                  </label>
                  <input
                    id="renew-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="07 00 00 00 00"
                    value={renewPhone}
                    onChange={(e) => setRenewPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600/40"
                  />
                </div>
              )}
            </fieldset>

            {renewError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                {renewError}
              </div>
            )}

            <button
              onClick={() => void submitRenew()}
              disabled={renewLoading}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {renewLoading ? "Création du paiement…" : "Renouveler maintenant"}
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Paiement sécurisé par GeniusPay (Wave / carte). Sans moyen en ligne, la commande
              passe en canal manuel — la plateforme confirmera.
            </p>
          </div>
        </div>
      )}

      {renewNotice && (
        <div
          className="fixed inset-x-0 bottom-4 z-40 mx-auto w-fit max-w-[92vw] rounded-xl border border-emerald-600/40 bg-white/95 px-5 py-3 text-sm text-emerald-800 shadow-lg"
          role="status"
        >
          {renewNotice}
          <button
            onClick={() => setRenewNotice("")}
            aria-label="Fermer"
            className="ml-3 text-emerald-700 hover:text-emerald-900"
          >
            <X className="inline h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <footer className="mt-auto border-t border-slate-200/80 bg-white/60">
        <div className="mx-auto max-w-5xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          403Shield Console · powered by FTech CI · Tunnels WireGuard hébergés à Marseille
        </div>
      </footer>
    </div>
  );
}
