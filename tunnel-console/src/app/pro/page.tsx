"use client";

// pro/page.tsx — N°315 — offre ACCÈS PRO + LAN ÉTENDU (caméras/NAS) de la
// console MikTunnel (design D-B1, décision D-T4 : le LAN étendu est livré
// comme offre « Pro » de CETTE console).
//
// Contrat backend (handlers_tunnel_pro.go, N°315) :
//   GET  /api/tunnel/pro                    → éligibilité + routeurs + LAN + portefeuille
//   POST /api/tunnel/pro/detect             → enfile la détection (lecture pure)
//   GET  /api/tunnel/pro/lan/{routerId}     → poll de la détection (≤ 45 s)
//   POST /api/tunnel/pro/lan/{routerId}     → APPLICATION (set-lan VM + règles routeur)
//   POST /api/tunnel/pro/order              → commande Pro (Wave/carte/manual)
//
// Honnêteté produit : l'Accès Pro relie VOS routeurs supervisés par MikCloud
// (compte gérant apparié par e-mail) — sans compte, la page le DIT au lieu
// de vendre un accès qui ne servirait à rien.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Copy,
  CreditCard,
  KeyRound,
  Lightbulb,
  Loader2,
  LogOut,
  Network,
  RefreshCw,
  Router as RouterIcon,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import {
  clearToken,
  getToken,
  tunnelProDetect,
  tunnelProLanApply,
  tunnelProLanPoll,
  tunnelProOrder,
  tunnelProStatus,
  tunnelReveal,
  type ProRouter,
  type ProStatusResponse,
  type RevealResponse,
} from "@/lib/api";

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

export default function ProPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ProStatusResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [returnOrder, setReturnOrder] = useState("");
  const [notice, setNotice] = useState("");

  // LAN : application + poll par routeur.
  const [busyRouter, setBusyRouter] = useState("");
  const [polling, setPolling] = useState<string>("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Achat.
  const [buyPlan, setBuyPlan] = useState("vpn-pro-month");
  const [buyMethod, setBuyMethod] = useState("wave");
  const [buyPhone, setBuyPhone] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState("");

  // Reveal de la conf d'un appareil Pro.
  const [revealRef, setRevealRef] = useState("");
  const [reveal, setReveal] = useState<RevealResponse | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState("");
  const [copied, setCopied] = useState(false);
  const confRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setStatus(await tunnelProStatus(token));
    } catch (err) {
      const code = (err as { status?: number }).status;
      if (code === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Offre indisponible — réessayez");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("order");
    if (ref) {
      setReturnOrder(ref);
      window.history.replaceState({}, "", window.location.pathname);
    }
    void load();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [load]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  // Poll de la détection LAN : boucle jusqu'à convergence (done|error), puis
  // recharge le statut — l'APPLICATION reste un geste explicite (POST).
  function startPolling(routerId: string) {
    if (pollTimer.current) clearInterval(pollTimer.current);
    setPolling(routerId);
    pollTimer.current = setInterval(async () => {
      const token = getToken();
      if (!token) return;
      try {
        const out = await tunnelProLanPoll(routerId, token);
        if (out.state === "done" || out.state === "error" || out.lanApplied) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setPolling("");
          void load();
        }
      } catch {
        /* réseau passager : le prochain tick retentera */
      }
    }, 4000);
  }

  async function askDetect(r: ProRouter) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setBusyRouter(r.id);
    setError("");
    try {
      await tunnelProDetect(r.id, token);
      startPolling(r.id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Détection impossible — réessayez");
    } finally {
      setBusyRouter("");
    }
  }

  async function applyLan(r: ProRouter) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setBusyRouter(r.id);
    setError("");
    setNotice("");
    try {
      const out = await tunnelProLanApply(r.id, token);
      if (out.queued) {
        startPolling(r.id);
        setNotice("Détection LAN enfilée — convergence de l'agent en cours (≤ 45 s), la page se rafraîchira.");
      } else if (out.needPro) {
        setNotice(
          "Sous-réseau détecté : " + (out.lan ?? "?") + ". Souscrivez l'Accès Pro ci-dessous pour l'étendre au tunnel.",
        );
      } else if (out.applied) {
        setNotice(
          "LAN " + (out.lan ?? "") + " étendu vers vos appareils Pro (" +
            (out.peers ?? []).join(", ") +
            "). Récupérez la configuration mise à jour (bouton « Voir la configuration ») et réimportez-la dans WireGuard.",
        );
      }
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extension impossible — réessayez");
    } finally {
      setBusyRouter("");
    }
  }

  async function submitBuy() {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (buyMethod === "wave" && buyPhone.replace(/\D/g, "").length < 8) {
      setBuyError("Un numéro de téléphone valide est requis pour payer par Wave.");
      return;
    }
    setBuyLoading(true);
    setBuyError("");
    setNotice("");
    try {
      const out = await tunnelProOrder(token, {
        planId: buyPlan,
        payMethod: buyMethod,
        phone: buyPhone || undefined,
      });
      if (out.paymentUrl) {
        window.location.href = out.paymentUrl;
        return;
      }
      setNotice(
        "Commande " + out.ref + " enregistrée (" + formatFcfa(out.amountFcfa) +
          ", canal manuel). La plateforme confirmera votre paiement — votre accès Pro sera provisionné automatiquement.",
      );
      void load();
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Souscription impossible — réessayez");
    } finally {
      setBuyLoading(false);
    }
  }

  async function openReveal(ref: string) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setRevealRef(ref);
    setReveal(null);
    setRevealError("");
    setCopied(false);
    setRevealLoading(true);
    try {
      setReveal(await tunnelReveal(ref, token));
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
      const range = document.createRange();
      if (confRef.current) {
        range.selectNodeContents(confRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  function lanLine(r: ProRouter): { label: string; tone: string } {
    if (r.lanApplied) {
      return { label: "LAN étendu : " + (r.wgLan ?? ""), tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
    }
    const d = r.lanDetect;
    if (d?.state === "done" && d.valid) {
      return { label: "Réseau détecté : " + (d.lan ?? "") + " — prêt à étendre", tone: "border-sky-500/30 bg-sky-500/10 text-sky-300" };
    }
    if (d?.state === "done" && !d.valid) {
      return { label: "Réseau détecté hors périmètre (" + (d.lan ?? "?") + ") — renumérotez le LAN (ex. 10.10.x)", tone: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
    }
    if (d?.state === "queued" || d?.state === "sent" || polling === r.id) {
      return { label: "Détection en cours (≤ 45 s)…", tone: "border-slate-600/40 bg-slate-700/20 text-slate-400" };
    }
    if (d?.state === "error") {
      return { label: "Détection impossible sur ce routeur", tone: "border-red-500/30 bg-red-500/10 text-red-300" };
    }
    return { label: "Réseau local non détecté", tone: "border-slate-600/40 bg-slate-700/20 text-slate-400" };
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
              <p className="text-sm font-semibold tracking-tight text-slate-100">MikTunnel · Accès Pro</p>
              <p className="text-[11px] text-slate-500">powered by FTech CI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/me"
              className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-50"
            >
              Mon espace
            </a>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Déconnexion
            </button>
          </div>
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
                Si votre paiement est confirmé, votre Accès Pro apparaît ci-dessous — sinon
                dans quelques instants. En cas de doute, rafraîchissez.
              </p>
              <button onClick={() => void load()} className="mt-2 font-medium underline underline-offset-2">
                Rafraîchir maintenant
              </button>
            </div>
          )}

          {notice && (
            <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
              {error}
              <button onClick={() => void load()} className="ml-3 font-medium underline underline-offset-2">
                Réessayer
              </button>
            </div>
          )}

          {loading && !status && (
            <div className="space-y-4" aria-busy="true" aria-label="Chargement de l'offre">
              <div className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
              <div className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
            </div>
          )}

          {status && (
            <>
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">Accès Pro</p>
                <h1 className="mt-1 text-xl font-semibold text-slate-100">
                  Vos routeurs, vos caméras, vos NAS — dans un seul tunnel chiffré
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  L&apos;Accès Pro pose un tunnel WireGuard depuis votre téléphone ou votre
                  ordinateur vers votre réseau : supervision de vos routeurs MikroTik (Winbox,
                  API, SSH, web) <strong className="text-slate-200">et extension vers votre réseau local</strong> —
                  caméras, NAS, imprimantes — où que vous soyez, même derrière le CGNAT.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Périmètre honnête : le tunnel ne route NI votre navigation Internet, NI votre
                  DNS — uniquement vos équipements, rien de plus.
                </p>
              </section>

              {!status.eligible ? (
                <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200">
                  <p className="flex items-center gap-2 font-medium">
                    <Lightbulb className="h-4 w-4 shrink-0" aria-hidden />
                    L&apos;Accès Pro relie VOS routeurs supervisés par MikCloud
                  </p>
                  <p className="mt-2 text-amber-200/80">
                    Connectez-vous avec l&apos;<strong>e-mail de votre compte gérant MikCloud</strong>{" "}
                    (celui utilisé à l&apos;inscription, avec au moins un routeur en mode agent).
                    Pas encore de compte ?{" "}
                    <a
                      href="https://mikcloud.ftci.fr"
                      className="font-medium underline underline-offset-2"
                    >
                      Découvrez MikCloud
                    </a>{" "}
                    — puis revenez ici : vos routeurs apparaîtront automatiquement.
                  </p>
                  <p className="mt-2 text-amber-200/60">
                    Vous cherchez un VPN pour votre téléphone ?{" "}
                    <a href="https://mikcloud.ftci.fr/vpn" className="underline underline-offset-2">
                      MikCloud VPN
                    </a>{" "}
                    reste la vitrine dédiée.
                  </p>
                </section>
              ) : (
                <>
                  {/* ---- Routeurs + LAN étendu ---- */}
                  <section className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
                        <RouterIcon className="h-4 w-4 text-emerald-400" aria-hidden />
                        Vos routeurs ({status.routers.length})
                        {status.account && (
                          <span className="text-xs font-normal text-slate-500">· {status.account.name}</span>
                        )}
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
                    <ul className="space-y-3">
                      {status.routers.map((r) => {
                        const lan = lanLine(r);
                        const detectBusy = busyRouter === r.id || polling === r.id;
                        const isAgent = r.mode === "agent";
                        return (
                          <li key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                                  <span
                                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${r.online ? "bg-emerald-400" : "bg-slate-600"}`}
                                    aria-hidden
                                  />
                                  {r.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  mode {r.mode}
                                  {r.wgState ? ` · tunnel ${r.wgState}` : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isAgent && !r.lanApplied && (
                                  <button
                                    onClick={() => void askDetect(r)}
                                    disabled={detectBusy}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-50 disabled:opacity-50"
                                  >
                                    {detectBusy ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                    ) : (
                                      <Network className="h-3.5 w-3.5" aria-hidden />
                                    )}
                                    Détecter mon réseau
                                  </button>
                                )}
                                {isAgent && !r.lanApplied && r.lanDetect?.state === "done" && r.lanDetect.valid && (
                                  <button
                                    onClick={() => void applyLan(r)}
                                    disabled={detectBusy}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                                  >
                                    <Camera className="h-3.5 w-3.5" aria-hidden />
                                    Étendre au LAN
                                  </button>
                                )}
                                {isAgent && r.lanApplied && (
                                  <button
                                    onClick={() => void applyLan(r)}
                                    disabled={detectBusy}
                                    title="Re-apply l'extension (idempotent — rafraîchit les règles)"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-400 disabled:opacity-50"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                                    Re-apply
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${lan.tone}`}>
                                {lan.label}
                              </span>
                              {r.lanApplied && r.lanRuleState && r.lanRuleState !== "none" && r.lanRuleState !== "done" && (
                                <span className="text-xs text-slate-500">
                                  règles routeur : {r.lanRuleState} (≤ 45 s)
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  {/* ---- Portefeuille Pro / achat ---- */}
                  <section className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
                        {status.anyActive ? "Vos accès Pro" : "Souscrire l'Accès Pro"}
                      </h2>
                    </div>

                    {status.anyActive ? (
                      <ul className="space-y-3">
                        {status.proOrders.map((o) => {
                          const left = daysLeft(o.expiresAt);
                          return (
                            <li key={o.ref} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-slate-100">{o.plan}</p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    réf. {o.ref} · adresse tunnel {o.peerIpv4}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    couvert jusqu&apos;au {formatDate(o.expiresAt)}
                                    {left !== null ? ` (${left} j)` : ""}
                                  </p>
                                </div>
                                <button
                                  onClick={() => void openReveal(o.ref)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-50"
                                >
                                  Voir la configuration
                                </button>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                Le renouvellement se fait depuis{" "}
                                <a href="/me" className="underline underline-offset-2 hover:text-slate-300">
                                  votre espace
                                </a>{" "}
                                (bouton « Renouveler » sur la commande {o.ref}).
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {status.plans.map((p) => (
                            <label
                              key={p.id}
                              className={`cursor-pointer rounded-xl border p-4 transition ${
                                buyPlan === p.id
                                  ? "border-emerald-500/60 bg-emerald-500/10"
                                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                              }`}
                            >
                              <input
                                type="radio"
                                name="pro-plan"
                                value={p.id}
                                checked={buyPlan === p.id}
                                onChange={() => setBuyPlan(p.id)}
                                className="sr-only"
                              />
                              <p className="text-sm font-semibold text-slate-100">{p.periodLabel}</p>
                              <p className="mt-1 text-lg font-bold text-emerald-400">{formatFcfa(p.baseFcfa)}</p>
                              <p className="mt-1 text-xs text-slate-500">{p.label}</p>
                            </label>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                            <input
                              type="radio"
                              name="pro-method"
                              checked={buyMethod === "wave"}
                              onChange={() => setBuyMethod("wave")}
                              className="accent-emerald-500"
                            />
                            <Smartphone className="h-4 w-4 text-emerald-400" aria-hidden />
                            Wave
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                            <input
                              type="radio"
                              name="pro-method"
                              checked={buyMethod === "card"}
                              onChange={() => setBuyMethod("card")}
                              className="accent-emerald-500"
                            />
                            <CreditCard className="h-4 w-4 text-emerald-400" aria-hidden />
                            Carte bancaire
                          </label>
                        </div>
                        {buyMethod === "wave" && (
                          <div className="mt-3">
                            <label htmlFor="pro-phone" className="text-xs font-medium text-slate-400">
                              Numéro Wave à débiter
                            </label>
                            <input
                              id="pro-phone"
                              type="tel"
                              inputMode="tel"
                              value={buyPhone}
                              onChange={(e) => setBuyPhone(e.target.value)}
                              placeholder="07 00 00 00 00"
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
                            />
                          </div>
                        )}

                        {buyError && <p className="mt-3 text-sm text-red-300">{buyError}</p>}

                        <button
                          onClick={() => void submitBuy()}
                          disabled={buyLoading}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 sm:w-auto"
                        >
                          {buyLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                          Souscrire l&apos;Accès Pro
                        </button>
                        <p className="mt-3 text-xs leading-relaxed text-slate-500">
                          Sans clés de paiement en ligne, la commande passera en canal manuel
                          (confirmation par la plateforme — traçable). Le provisioning est
                          automatique dès confirmation : configuration livrée par e-mail et
                          récupérable ici à tout moment.
                        </p>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-800/60">
        <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <p>MikTunnel — powered by FTech CI · Accès Pro : tunnels WireGuard hébergés à Marseille</p>
          <div className="flex gap-4">
            <a href="https://mikcloud.ftci.fr/vpn" className="hover:text-slate-300">
              MikCloud VPN
            </a>
            <a href="https://mikcloud.ftci.fr" className="hover:text-slate-300">
              MikCloud
            </a>
          </div>
        </div>
      </footer>

      {/* ---- Modal reveal (conf WireGuard d'un appareil Pro) ---- */}
      {revealRef && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Configuration WireGuard"
          onClick={() => setRevealRef("")}
        >
          <div
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Configuration WireGuard — {revealRef}
              </h3>
              <button
                onClick={() => setRevealRef("")}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 transition hover:text-slate-200"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {revealLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Ouverture du coffre…
              </div>
            )}
            {revealError && <p className="mt-4 text-sm text-red-300">{revealError}</p>}
            {reveal && (
              <>
                <p className="mt-3 text-xs text-slate-500">
                  Adresse tunnel : <span className="text-slate-300">{reveal.ipv4 ?? "—"}</span> —
                  copiez la configuration puis importez-la dans WireGuard (« + » → « Importer
                  depuis un fichier » ou presse-papiers). Les entrées AllowedIPs portent le
                  périmètre Pro : vos routeurs + votre LAN étendu le cas échéant.
                </p>
                <div
                  ref={confRef}
                  className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed text-slate-300"
                >
                  <pre className="whitespace-pre-wrap break-all">{reveal.conf}</pre>
                </div>
                <button
                  onClick={() => void copyConf()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied ? "Copiée" : "Copier la configuration"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
