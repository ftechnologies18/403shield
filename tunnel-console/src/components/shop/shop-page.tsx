"use client";

// shop-page.tsx — N°316 — vitrine d'achat (/shop), portée depuis
// frontend/src/components/vpn-shop/vpn-shop-page.tsx (N°301) lors du
// déménagement du canal B2C vers CE foyer (la vitrine fut « MikTunnel VPN »,
// arbitrage N°316 option C). N°317 — rebrand « 403Shield » : la boutique
// « 403Shield VPN » vit dans la console 403Shield. Charte émeraude nuit
// (zéro clay, zéro dépendance radix : dialog et radios MAISON — l'app
// tunnel-console reste légère), hooks locaux (pas de react-query), langue
// FR/EN locale (pas de store global).
//
// PARCOURS (inchangé — l'acheteur n'a PAS de compte, apiFetch public) :
//   1. Catalogue : GET /api/public/vpn/offers — fermé → état « bientôt » ;
//   2. Achat : dialog (e-mail + téléphone Wave + moyen) → POST
//      /api/public/vpn/order → redirection GeniusPay (paymentUrl) ou canal
//      « manual » (référence MCV- à régler) ;
//   3. Statut : /shop?order=MCV-… — poll 5 s du GET /api/public/vpn/order/{ref}
//      (le retour de paiement finalise côté serveur, provisioning auto,
//      l'e-mail de livraison part seul) ;
//   4. Self-service : POST /api/public/vpn/recover (e-mail + réf) — la conf
//      part UNIQUEMENT par e-mail, jamais affichée ici (anti-énumération).
//
// Honeypot « website » invisible sur les deux POST — et cette fois la valeur
// est RÉELLEMENT transmise (rempli = robot : le backend part en silence).

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Mail,
  ShieldCheck,
  ShieldOff,
  Timer,
  X,
} from "lucide-react";
import {
  ApiError,
  createPublicVpnOrder,
  fetchPublicVpnOffers,
  fetchPublicVpnOrderStatus,
  recoverPublicVpnConf,
  type PublicVpnOfferPlan,
  type PublicVpnOffers,
  type PublicVpnOrderStatus,
} from "@/lib/api";
import { shopCopy, type ShopLang } from "./shop-copy";

// N°317 — clé historique conservée à l'identique : la renommer réinitialiserait
// la préférence de langue des visiteurs existants.
const LANG_KEY = "miktunnel_shop_lang";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fmtFcfa(n?: number): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

export interface ShopPageProps {
  /** Référence MCV-… issue de l'URL (?order=, préservée par le 301) — lance
   * le suivi de commande. */
  initialOrderRef?: string;
}

export default function ShopPage({ initialOrderRef = "" }: ShopPageProps) {
  const [lang, setLang] = useState<ShopLang>("fr");
  const copy = shopCopy[lang];

  /* Langue persistée localement (après mount : jamais de mismatch SSR). */
  useEffect(() => {
    const v = window.localStorage.getItem(LANG_KEY);
    if (v === "en" || v === "fr") setLang(v);
  }, []);
  const toggleLang = () => {
    const next: ShopLang = lang === "fr" ? "en" : "fr";
    setLang(next);
    window.localStorage.setItem(LANG_KEY, next);
  };

  /* ─── Catalogue public (quasi statique : rafraîchi 60 s) ─── */
  const [offers, setOffers] = useState<PublicVpnOffers | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetchPublicVpnOffers();
        if (alive) setOffers(res);
      } catch {
        /* réseau : on garde l'état précédent (null → fermé, message honnête) */
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const shopOpen = offers?.enabled === true;
  const plans = offers?.plans ?? [];

  /* ─── Tunnel d'achat ─── */
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyPlan, setBuyPlan] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState<"wave" | "card">("wave");
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [manualRef, setManualRef] = useState("");
  const buyHoneypot = useRef<HTMLInputElement>(null);

  /* ─── Suivi de commande (poll 5 s tant que non résolu) ─── */
  const [trackingRef, setTrackingRef] = useState(initialOrderRef);
  const [orderStatus, setOrderStatus] = useState<PublicVpnOrderStatus | null>(null);
  useEffect(() => {
    if (!trackingRef) return;
    let alive = true;
    const resolved = (s?: string) =>
      s === "provisioned" || s === "cancelled" || s === "expired";
    const poll = async () => {
      try {
        const res = await fetchPublicVpnOrderStatus(trackingRef);
        if (!alive) return;
        setOrderStatus(res);
        if (resolved(res.status)) window.clearInterval(timer);
      } catch {
        /* 404/réseau : on retente au passage suivant */
      }
    };
    const timer = window.setInterval(poll, 5_000);
    void poll();
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [trackingRef]);

  /* ─── Récupération self-service ─── */
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverRef, setRecoverRef] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverDone, setRecoverDone] = useState(false);
  const [recoverError, setRecoverError] = useState("");
  const recoverHoneypot = useRef<HTMLInputElement>(null);

  /* ─── Dialog : fermeture clavier (Escape) ─── */
  useEffect(() => {
    if (!buyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuyOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buyOpen]);

  const openBuy = (planId: string) => {
    setBuyPlan(planId);
    setBuyError("");
    setManualRef("");
    setBuyOpen(true);
  };

  const submitOrder = async () => {
    setBuyBusy(true);
    setBuyError("");
    try {
      const res = await createPublicVpnOrder({
        email: email.trim(),
        phone: payMethod === "wave" ? phone.trim() : undefined,
        planId: buyPlan,
        payMethod,
        website: buyHoneypot.current?.value ?? "",
      });
      if (res.paymentUrl) {
        // Laisse le statut suivre la commande au retour (success_url porte la ref).
        setTrackingRef(res.ref);
        window.location.href = res.paymentUrl;
        return;
      }
      // Canal manuel : la référence est le lien entre l'acheteur et la commande.
      setManualRef(res.ref);
      setTrackingRef(res.ref);
    } catch (err) {
      const e = err as ApiError;
      setBuyError(e.code === "order_pending_exists" ? copy.buy.errPending : e.message);
    } finally {
      setBuyBusy(false);
    }
  };

  const submitRecover = async () => {
    setRecoverBusy(true);
    setRecoverError("");
    setRecoverDone(false);
    try {
      await recoverPublicVpnConf(recoverEmail.trim(), recoverRef.trim());
      setRecoverDone(true);
    } catch (err) {
      setRecoverError((err as Error).message);
    } finally {
      setRecoverBusy(false);
    }
  };

  const selectedPlan: PublicVpnOfferPlan | undefined = plans.find((p) => p.id === buyPlan);

  const statusView = (() => {
    const s = orderStatus?.status ?? "pending";
    if (s === "provisioned")
      return { icon: <CheckCircle2 size={20} aria-hidden />, title: copy.status.provisioned, desc: copy.status.provisionedDesc };
    if (s === "paid")
      return { icon: <Loader2 size={20} className="animate-spin" aria-hidden />, title: copy.status.paid, desc: copy.status.paidDesc };
    if (s === "cancelled")
      return { icon: <X size={20} aria-hidden />, title: copy.status.cancelled, desc: copy.status.cancelledDesc };
    if (s === "expired")
      return { icon: <Timer size={20} aria-hidden />, title: copy.status.expired, desc: copy.status.expiredDesc };
    return { icon: <Timer size={20} aria-hidden />, title: copy.status.pending, desc: copy.status.pendingDesc };
  })();

  return (
    <div className="flex min-h-screen flex-col">
      {/* ─── Topbar ─── */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link href="/shop" className="flex items-center gap-2.5" aria-label={copy.brand}>
            <Image src="/logo.png" alt="403Shield" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="flex flex-wrap items-center gap-2 leading-tight">
              <span className="text-sm font-semibold tracking-tight text-slate-100">{copy.brand}</span>
              <span className="rounded-full border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                {copy.endorsed}
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-slate-300 md:flex" aria-label="primary">
            <button className="transition hover:text-slate-100" onClick={() => scrollTo("produit")}>
              {copy.nav.product}
            </button>
            <button className="transition hover:text-slate-100" onClick={() => scrollTo("tarifs")}>
              {copy.nav.pricing}
            </button>
            <button className="transition hover:text-slate-100" onClick={() => scrollTo("faq")}>
              {copy.nav.faq}
            </button>
            <Link className="transition hover:text-slate-100" href="/pro">
              {copy.nav.pro}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              aria-label="Switch language"
            >
              {lang === "fr" ? "EN" : "FR"}
            </button>
            <Link
              href="/login"
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              {copy.nav.login}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── Hero ─── */}
        <section className="hero-glow">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {copy.hero.eyebrow}
            </p>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">
              {copy.hero.title}{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                {copy.hero.titleEm}
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              {copy.hero.lead}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => scrollTo("tarifs")}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                {copy.hero.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                onClick={() => scrollTo("recuperation")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-50"
              >
                {copy.hero.ctaSecondary}
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">{copy.hero.hint}</p>
          </div>
        </section>

        {/* ─── Bandeau stats ─── */}
        <section className="border-y border-slate-800/60 bg-slate-900/40">
          <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-8 sm:grid-cols-3 sm:px-6">
            {copy.stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
                <b className="text-2xl font-bold text-emerald-400">{s.value}</b>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Produit ─── */}
        <section id="produit" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              {copy.nav.product}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              {copy.features[0].title}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {copy.features.map((f, i) => (
              <article
                key={f.title}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-emerald-500/40"
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400" aria-hidden>
                  {i === 0 ? <ShieldCheck size={20} /> : i === 1 ? <ShieldOff size={20} /> : <Mail size={20} />}
                </span>
                <h3 className="text-base font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                <span className="mt-4 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  {f.tag}
                </span>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Tarifs / achat ─── */}
        <section id="tarifs" className="border-t border-slate-800/60 bg-slate-900/30">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                {copy.pricing.kicker}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
                {copy.pricing.title}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
                {shopOpen ? copy.pricing.lead : copy.pricing.closedDesc}
              </p>
            </div>

            {!shopOpen ? (
              <div className="mx-auto max-w-xl rounded-xl border border-slate-800 bg-slate-900/60 p-6">
                <h3 className="text-lg font-semibold text-slate-100">{copy.pricing.closedTitle}</h3>
                <ul className="mt-4 space-y-2.5">
                  {copy.pricing.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm">
                  <Link href="/" className="text-emerald-400 underline underline-offset-4 transition hover:text-emerald-300">
                    {copy.brand} →
                  </Link>
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {plans.map((plan) => {
                    const yearly = plan.months > 1;
                    return (
                      <article
                        key={plan.id}
                        className={`relative flex flex-col rounded-xl border bg-slate-900/60 p-6 ${
                          yearly ? "border-emerald-500/50" : "border-slate-800"
                        }`}
                      >
                        {yearly && (
                          <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950">
                            {copy.pricing.pop}
                          </span>
                        )}
                        <h3 className="text-lg font-semibold text-slate-100">
                          {yearly ? copy.pricing.yearly.name : copy.pricing.monthly.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {yearly ? copy.pricing.yearly.tagline : copy.pricing.monthly.tagline}
                        </p>
                        <p className="mt-5 text-3xl font-bold text-slate-50">
                          {fmtFcfa(plan.baseFcfa)}{" "}
                          <small className="text-sm font-normal text-slate-400">
                            / {yearly ? copy.pricing.yearly.per : copy.pricing.monthly.per}
                          </small>
                        </p>
                        <p className="mt-3 space-y-1 text-xs text-slate-400">
                          <span className="block">
                            {copy.buy.waveAmount} : <b className="text-slate-200">{fmtFcfa(plan.waveFcfa)}</b>
                          </span>
                          <span className="block">
                            {copy.buy.cardAmount} : <b className="text-slate-200">{fmtFcfa(plan.cardFcfa)}</b>
                          </span>
                        </p>
                        <ul className="mt-5 flex-1 space-y-2.5">
                          {copy.pricing.bullets.map((b) => (
                            <li key={b} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                              {b}
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => openBuy(plan.id)}
                          className={`mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                            yearly
                              ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                          }`}
                        >
                          {copy.pricing.cta()}
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </button>
                      </article>
                    );
                  })}
                </div>
                <p className="mt-6 text-center text-xs text-slate-500">
                  {offers?.onlinePayment ? copy.pricing.onlineNote : copy.pricing.manualNote}
                </p>
              </>
            )}
          </div>
        </section>

        {/* ─── Suivi de commande (visible si ref active) ─── */}
        {trackingRef !== "" && (
          <section id="suivi" className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">MCV</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-50">{copy.status.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{copy.status.desc}</p>
              <div className="mt-5 flex flex-wrap items-stretch gap-3">
                <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3">
                  <p className="font-mono text-sm font-bold tracking-wide text-slate-100">{trackingRef}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{copy.buy.ref}</p>
                </div>
                <div className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    {statusView.icon}
                    {statusView.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{statusView.desc}</p>
                </div>
              </div>
              {orderStatus?.status === "provisioned" && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2.5">
                    <p className="font-mono text-sm font-semibold text-emerald-300">{orderStatus.ipv4 ?? "—"}</p>
                    <p className="text-[11px] text-slate-500">{copy.status.ip}</p>
                  </div>
                  {orderStatus.expiresAt && (
                    <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2.5">
                      <p className="text-sm font-semibold text-slate-100">{orderStatus.expiresAt.slice(0, 10)}</p>
                      <p className="text-[11px] text-slate-500">{copy.status.term}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── Récupération self-service ─── */}
        <section id="recuperation" className="border-t border-slate-800/60 bg-slate-900/30">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                {copy.recover.kicker}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-50">{copy.recover.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{copy.recover.desc}</p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitRecover();
                }}
              >
                <div>
                  <label htmlFor="recover-email" className="mb-1.5 block text-sm font-medium text-slate-200">
                    {copy.recover.email}
                  </label>
                  <input
                    id="recover-email"
                    type="email"
                    required
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    placeholder={copy.buy.emailPlaceholder}
                    disabled={recoverBusy}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="recover-ref" className="mb-1.5 block text-sm font-medium text-slate-200">
                    {copy.recover.ref}
                  </label>
                  <input
                    id="recover-ref"
                    required
                    value={recoverRef}
                    onChange={(e) => setRecoverRef(e.target.value)}
                    placeholder="MCV-…"
                    disabled={recoverBusy}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                {/* Honeypot — invisible, rempli = robot : la requête part en silence. */}
                <input
                  ref={recoverHoneypot}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
                />
                <button
                  type="submit"
                  disabled={recoverBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {recoverBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                  {recoverBusy ? copy.recover.submitting : copy.recover.submit}
                </button>
                {recoverDone && (
                  <p className="text-sm font-medium text-emerald-400">{copy.recover.done}</p>
                )}
                {recoverError && <p className="text-sm font-medium text-rose-400">{recoverError}</p>}
                <p className="text-xs leading-relaxed text-slate-500">{copy.recover.note}</p>
              </form>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">FAQ</p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">{copy.faq.title}</h2>
          </div>
          <div className="grid gap-3">
            {copy.faq.items.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 transition hover:border-slate-700"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center justify-between gap-3">
                    {item.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="mt-auto border-t border-slate-800/60 bg-slate-950">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="403Shield" width={32} height={32} className="h-8 w-8 rounded-lg" />
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tracking-tight text-slate-100">{copy.brand}</span>
                  <span className="rounded-full border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                    {copy.endorsed}
                  </span>
                </span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">{copy.footer.tagline}</p>
            </div>
            <nav className="flex flex-col gap-2.5" aria-label="footer">
              {copy.footer.links.map((l) =>
                l.external ? (
                  <a
                    key={l.href + l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-100"
                  >
                    {l.label}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : (
                  <Link
                    key={l.href + l.label}
                    href={l.href}
                    className="text-sm text-slate-400 transition hover:text-slate-100"
                  >
                    {l.label}
                  </Link>
                ),
              )}
            </nav>
          </div>
          <div className="mt-8 border-t border-slate-800/60 pt-5">
            <p className="text-[11px] text-slate-500">{copy.footer.house}</p>
            <p className="mt-1.5 text-[11px] text-slate-600">{copy.footer.legal}</p>
          </div>
        </div>
      </footer>

      {/* ─── Dialog d'achat (maison — pas de dépendance radix) ─── */}
      {buyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={copy.buy.title}
          onClick={(e) => {
            if (e.target === e.currentTarget && !buyBusy) setBuyOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-50">{copy.buy.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{copy.buy.desc}</p>
              </div>
              <button
                onClick={() => setBuyOpen(false)}
                disabled={buyBusy}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-400 transition hover:text-slate-100 disabled:opacity-40"
                aria-label={copy.buy.close}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {manualRef ? (
              /* Canal manuel : la référence fait foi. */
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                  <p className="text-xs text-slate-400">{copy.buy.ref}</p>
                  <p className="mt-1 font-mono text-lg font-bold tracking-wider text-emerald-300">{manualRef}</p>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">{copy.buy.manualDesc}</p>
                <button
                  onClick={() => setBuyOpen(false)}
                  className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  OK
                </button>
              </div>
            ) : (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitOrder();
                }}
              >
                <div>
                  <label htmlFor="buy-email" className="mb-1.5 block text-sm font-medium text-slate-200">
                    {copy.buy.email}
                  </label>
                  <input
                    id="buy-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={copy.buy.emailPlaceholder}
                    disabled={buyBusy}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  />
                </div>

                <fieldset>
                  <legend className="mb-2 block text-sm font-medium text-slate-200">{copy.buy.method}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      htmlFor="pay-wave"
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-950/60 p-3 transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10"
                    >
                      <input
                        id="pay-wave"
                        type="radio"
                        name="paymethod"
                        value="wave"
                        checked={payMethod === "wave"}
                        onChange={() => setPayMethod("wave")}
                        disabled={buyBusy}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-200">{copy.buy.methodWave}</span>
                    </label>
                    <label
                      htmlFor="pay-card"
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-950/60 p-3 transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10"
                    >
                      <input
                        id="pay-card"
                        type="radio"
                        name="paymethod"
                        value="card"
                        checked={payMethod === "card"}
                        onChange={() => setPayMethod("card")}
                        disabled={buyBusy}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-200">{copy.buy.methodCard}</span>
                    </label>
                  </div>
                  {selectedPlan && (
                    <p className="mt-2 text-xs text-slate-500">
                      {payMethod === "wave" ? fmtFcfa(selectedPlan.waveFcfa) : fmtFcfa(selectedPlan.cardFcfa)} —{" "}
                      {payMethod === "wave" ? copy.buy.waveAmount : copy.buy.cardAmount}
                    </p>
                  )}
                </fieldset>

                {payMethod === "wave" && (
                  <div>
                    <label htmlFor="buy-phone" className="mb-1.5 block text-sm font-medium text-slate-200">
                      {copy.buy.phone}
                    </label>
                    <input
                      id="buy-phone"
                      inputMode="numeric"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder={copy.buy.phonePlaceholder}
                      disabled={buyBusy}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">{copy.buy.phoneHint}</p>
                  </div>
                )}

                {/* Honeypot — invisible : rempli = robot, la commande part en silence. */}
                <input
                  ref={buyHoneypot}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
                />

                {buyError && <p className="text-sm font-medium text-rose-400">{buyError}</p>}

                <button
                  type="submit"
                  disabled={buyBusy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {buyBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                  {buyBusy ? copy.buy.submitting : copy.buy.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
