"use client";

// me/page.tsx — N°314 — espace client COMPLET : portefeuille de commandes et
// d'appareils (migration douce : tout ce qui a été acheté sur la vitrine
// MikCloud avec CET e-mail apparaît ici), re-livraison de la configuration
// (reveal — la conf ne quitte jamais le coffre sans action explicite) et
// renouvellement 1-clic (Wave/carte via GeniusPay, canal manuel en repli).
//
// Contrat backend (handlers_tunnel_orders.go, N°314) :
//   GET  /api/tunnel/me                       → profil + orders[] enrichies
//   POST /api/tunnel/orders/{ref}/reveal      → {conf, ipv4, expiresAt…}
//   POST /api/tunnel/orders/{ref}/renew       → {ref, paymentUrl, online…}

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  Copy,
  CreditCard,
  HardDrive,
  KeyRound,
  LogOut,
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

const statusLabels: Record<string, { label: string; classes: string }> = {
  pending: { label: "En attente de paiement", classes: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  paid: { label: "Paiement reçu", classes: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  provisioned: { label: "Actif", classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  cancelled: { label: "Annulée", classes: "border-slate-600/40 bg-slate-700/20 text-slate-400" },
  expired: { label: "Expirée", classes: "border-slate-600/40 bg-slate-700/20 text-slate-400" },
};

const plans = [
  { id: "vpn-b2c-month", label: "1 mois", amount: 1500 },
  { id: "vpn-b2c-year", label: "12 mois (≈ 2 mois offerts)", amount: 15000 },
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
  const confRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-800/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <KeyRound className="h-4 w-4" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-100">MikTunnel</p>
              <p className="text-[11px] text-slate-500">powered by FTech CI</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="hero-glow flex-1">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          {returnOrder && (
            <div className="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-200">
              <p className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                Paiement de la commande {returnOrder}
              </p>
              <p className="mt-1 text-sky-300/80">
                Si votre paiement est confirmé, l&apos;échéance s&apos;est étendue ci-dessous —
                sinon elle apparaîtra dans quelques instants. En cas de doute, rafraîchissez.
              </p>
              <button
                onClick={() => void load()}
                className="mt-2 font-medium underline underline-offset-2"
              >
                Rafraîchir maintenant
              </button>
            </div>
          )}

          {loading && !me && (
            <div className="space-y-4" aria-busy="true" aria-label="Chargement de l'espace">
              <div className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
              <div className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
              {error}
              <button onClick={() => void load()} className="ml-3 font-medium underline underline-offset-2">
                Réessayer
              </button>
            </div>
          )}

          {me && (
            <>
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">
                  Mon espace
                </p>
                <h1 className="mt-1 text-xl font-semibold text-slate-100">{me.client.email}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Client MikTunnel depuis le {formatDate(me.client.createdAt)}
                  {typeof me.devices === "number"
                    ? ` · ${me.devices} appareil${me.devices > 1 ? "s" : ""} actif${me.devices > 1 ? "s" : ""}`
                    : ""}
                </p>
              </section>

              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
                    <HardDrive className="h-4 w-4 text-emerald-400" aria-hidden />
                    Mes appareils et commandes
                  </h2>
                  <button
                    onClick={() => void load()}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
                    Rafraîchir
                  </button>
                </div>

                {me.orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
                    <p className="text-sm text-slate-400">
                      Aucune commande pour cet e-mail. Les achats faits sur la{" "}
                      <a
                        href="https://mikcloud.ftci.fr/vpn"
                        className="font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        vitrine MikCloud VPN
                      </a>{" "}
                      avec cette adresse apparaîtront ici.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {me.orders.map((o) => {
                      const s = statusLabels[o.status] ?? {
                        label: o.status,
                        classes: "border-slate-600/40 bg-slate-700/20 text-slate-300",
                      };
                      const left = daysLeft(o.expiresAt);
                      const isRenewal = o.kind === "renewal";
                      return (
                        <li
                          key={o.ref}
                          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-medium text-slate-100">{o.ref}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {isRenewal ? "Renouvellement" : o.plan}
                                {o.renewTargetRef ? ` de ${o.renewTargetRef}` : ""}
                                {" · "}
                                {formatDate(o.createdAt)}
                                {typeof o.amountFcfa === "number" && o.amountFcfa > 0
                                  ? ` · ${formatFcfa(o.amountFcfa)}`
                                  : ""}
                              </p>
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${s.classes}`}
                            >
                              {s.label}
                            </span>
                          </div>

                          {o.expiresAt && (
                            <p
                              className={`mt-2 flex items-center gap-1.5 text-xs ${
                                left !== null && left <= 7 && left >= 0
                                  ? "text-amber-300"
                                  : left !== null && left < 0
                                    ? "text-slate-500"
                                    : "text-slate-400"
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
                                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                                >
                                  <Receipt className="h-3.5 w-3.5" aria-hidden />
                                  Voir la configuration
                                </button>
                              )}
                              {o.renewable && (
                                <button
                                  onClick={() => {
                                    setRenewFor(o);
                                    setRenewError("");
                                    setRenewNotice("");
                                  }}
                                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-600 px-4 text-xs font-medium text-slate-200 transition hover:border-slate-400"
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
                                href="https://mikcloud.ftci.fr/vpn"
                                className="font-medium text-emerald-400 hover:text-emerald-300"
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Configuration WireGuard"
          onClick={() => setRevealFor(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
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
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:text-slate-200"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {revealLoading && (
              <div className="mt-4 h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-800/60" aria-busy="true" />
            )}
            {revealError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {revealError}
              </div>
            )}
            {reveal && (
              <>
                <div
                  ref={confRef}
                  className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-200/90 whitespace-pre-wrap break-all"
                >
                  {reveal.conf}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void copyConf()}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        Copiée
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        Copier la configuration
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-500">
                    WireGuard → « + » → « Importer depuis un fichier ou un QR code ».
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {renewFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Renouveler l'accès"
          onClick={() => setRenewFor(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Renouveler {renewFor.ref}</h2>
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
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:text-slate-200"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <fieldset className="mt-5">
              <legend className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Formule
              </legend>
              <div className="mt-2 space-y-2">
                {plans.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                      renewPlan === p.id
                        ? "border-emerald-500/50 bg-emerald-500/10 text-slate-100"
                        : "border-slate-700 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="renew-plan"
                        value={p.id}
                        checked={renewPlan === p.id}
                        onChange={() => setRenewPlan(p.id)}
                        className="accent-emerald-500"
                      />
                      MikCloud VPN — {p.label}
                    </span>
                    <span className="font-medium tabular-nums">{formatFcfa(p.amount)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Moyen de paiement
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRenewMethod("wave")}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm transition ${
                    renewMethod === "wave"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-slate-100"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <Smartphone className="h-4 w-4" aria-hidden />
                  Wave
                </button>
                <button
                  type="button"
                  onClick={() => setRenewMethod("card")}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm transition ${
                    renewMethod === "card"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-slate-100"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <CreditCard className="h-4 w-4" aria-hidden />
                  Carte
                </button>
              </div>
              {renewMethod === "wave" && (
                <div className="mt-3">
                  <label htmlFor="renew-phone" className="text-xs text-slate-400">
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
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
                  />
                </div>
              )}
            </fieldset>

            {renewError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {renewError}
              </div>
            )}

            <button
              onClick={() => void submitRenew()}
              disabled={renewLoading}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
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
          className="fixed inset-x-0 bottom-4 z-40 mx-auto w-fit max-w-[92vw] rounded-xl border border-emerald-500/40 bg-slate-900/95 px-5 py-3 text-sm text-emerald-200 shadow-lg"
          role="status"
        >
          {renewNotice}
          <button
            onClick={() => setRenewNotice("")}
            aria-label="Fermer"
            className="ml-3 text-emerald-400 hover:text-emerald-300"
          >
            <X className="inline h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <footer className="mt-auto border-t border-slate-800/60">
        <div className="mx-auto max-w-4xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          MikTunnel — powered by FTech CI · Tunnels WireGuard hébergés à Marseille
        </div>
      </footer>
    </div>
  );
}
