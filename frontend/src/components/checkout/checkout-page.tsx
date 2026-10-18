"use client";

// checkout-page.tsx — N°323 — caisse publique de la vitrine (/checkout) :
// le canal B2C (N°316, porté depuis tunnel-console shop-page.tsx) RETOURNE
// au site marketing — modèle OVH « commander sur www, gérer dans le
// manager » : la console devient une PURE application (racine → /login),
// la vitrine est l'unique landing, la caisse est la page transactionnelle
// du site. Gabarit clay de la vitrine (topbar + hero compact + mkl-panels),
// formulaires shadcn (Dialog/Input/Button — mêmes briques que la modale
// d'inscription), dialogs radios maison (charte du porté N°316).
//
// PARCOURS (inchangé — l'acheteur n'a PAS de compte, pubFetch public) :
//   1. Catalogue : GET /api/public/vpn/offers — fermé → état « bientôt » ;
//   2. Achat : dialog (e-mail + téléphone Wave + moyen) → POST
//      /api/public/vpn/order → redirection GeniusPay (paymentUrl) ou canal
//      « manual » (référence MCV- à régler) ;
//   3. Statut : /checkout?order=MCV-… — poll 5 s du GET /api/public/vpn/
//      order/{ref} (le retour de paiement finalise côté serveur,
//      provisioning auto, l'e-mail de livraison part seul) ;
//   4. Self-service : POST /api/public/vpn/recover (e-mail + réf) — la conf
//      part UNIQUEMENT par e-mail, jamais affichée ici (anti-énumération).
//
// N°323 — entonnoir direct : ?plan= préselectionne la formule et OUVRIT la
// caisse (les cartes tarifs de la vitrine pointent ici) ; ?order= (retour
// GeniusPay, préservé par les 308) prime et scrolle vers le suivi.
//
// Honeypot « website » invisible sur les deux POST — rempli = robot : le
// backend part en silence.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Timer,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHotspotStore } from "@/lib/hotspot/store";
import {
  createPublicVpnOrder,
  fetchPublicVpnOffers,
  fetchPublicVpnOrderStatus,
  PublicVpnApiError,
  recoverPublicVpnConf,
  type PublicVpnOfferPlan,
  type PublicVpnOffers,
  type PublicVpnOrderStatus,
} from "@/lib/public-vpn";
import { landingCopy, type Lang } from "../landing/landing-copy";
import { EnterpriseHeader } from "../landing/enterprise-header";
import { LandingFooter } from "../landing/landing-footer";
import { Reveal } from "../landing/reveal";
import { fraunces, manrope } from "../landing/landing-fonts";
import { checkoutCopy, type CheckoutLang } from "./checkout-copy";
import "../landing/landing-clay.css";

/** Console 403Shield — entrée unique de l'application (N°323 : la racine
 * redirige vers /login, pattern dash.cloudflare.com). */
const CONSOLE_LOGIN_URL = "https://console.403shield.ftci.fr/login";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fmtFcfa(n?: number): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

export interface CheckoutPageProps {
  /** Référence MCV-… issue de l'URL (?order=, préservée par les 308 GeniusPay)
   * — lance le suivi de commande. */
  initialOrderRef?: string;
  /** Formule préselectionnée (?plan=, liens des cartes tarifs de la vitrine)
   * — ouvre la caisse dès que le catalogue la confirme. */
  initialPlanId?: string;
}

export default function CheckoutPage({
  initialOrderRef = "",
  initialPlanId = "",
}: CheckoutPageProps) {
  const lang = useHotspotStore((s) => s.lang) as Lang;
  const setLang = useHotspotStore((s) => s.setLang);
  const copy = landingCopy[lang];
  const c = checkoutCopy[lang as CheckoutLang];
  const router = useRouter();

  const toggleLang = () => setLang(lang === "fr" ? "en" : "fr");

  /* N°332-C — la caisse adopte l'EnterpriseHeader (méga menus au
     moment le plus chaud du funnel : l'acheteur qui « remonte » ne
     perd plus les repères du site). Câblage prudent : AUCUNE modale
     d'inscription en pleine transaction — « Se connecter » ouvre la
     console dans un nouvel onglet, « Essai gratuit » mène à la
     formule Découverte 0 F/60 j de /hotspot#tarifs (promesse exacte).
     L'ancienne sous-nav mobile mkl-subnav disparaît : le drawer du
     header la remplace (même mécanique que les pages produit). */
  const onSignInConsole = () => {
    window.open(CONSOLE_LOGIN_URL, "_blank", "noopener,noreferrer");
  };
  const onSignUpTrial = () => {
    router.push("/hotspot#tarifs");
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

  /* ─── Retour de paiement (?order=) : scroll doux vers le suivi ─── */
  useEffect(() => {
    if (initialOrderRef) {
      window.setTimeout(() => scrollTo("suivi"), 250);
    }
  }, [initialOrderRef]);

  /* ─── Entonnoir direct (?plan=) : préselection + caisse ouverte ─── */
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !initialPlanId || !shopOpen) return;
    if (plans.some((p) => p.id === initialPlanId)) {
      autoOpened.current = true;
      setBuyPlan(initialPlanId);
      setBuyError("");
      setBuyOpen(true);
    }
  }, [initialPlanId, shopOpen, plans]);

  /* ─── Récupération self-service ─── */
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverRef, setRecoverRef] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverDone, setRecoverDone] = useState(false);
  const [recoverError, setRecoverError] = useState("");
  const recoverHoneypot = useRef<HTMLInputElement>(null);

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
      const e = err as PublicVpnApiError;
      setBuyError(e.code === "order_pending_exists" ? c.buy.errPending : e.message);
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
      return { icon: <CheckCircle2 size={20} aria-hidden />, title: c.status.provisioned, desc: c.status.provisionedDesc };
    if (s === "paid")
      return { icon: <Loader2 size={20} className="animate-spin" aria-hidden />, title: c.status.paid, desc: c.status.paidDesc };
    if (s === "cancelled")
      return { icon: <X size={20} aria-hidden />, title: c.status.cancelled, desc: c.status.cancelledDesc };
    if (s === "expired")
      return { icon: <Timer size={20} aria-hidden />, title: c.status.expired, desc: c.status.expiredDesc };
    return { icon: <Timer size={20} aria-hidden />, title: c.status.pending, desc: c.status.pendingDesc };
  })();

  return (
    <div className={`mkl-page ${fraunces.variable} ${manrope.variable}`}>
      {/* Grain + halos FreeTech (même décor que les pages produit) */}
      <div className="mkl-grain" aria-hidden="true" />
      <div className="mkl-blob mkl-blob-1" aria-hidden="true" />
      <div className="mkl-blob mkl-blob-2" aria-hidden="true" />

      <div className="mkl-main">
        {/* ═══ N°332-C — EnterpriseHeader (méga menus + drawer) : même
            header que toute la vitrine — l'ancienne topbar 3 liens et la
            sous-nav mobile mkl-subnav sont retirées ═══ */}
        <EnterpriseHeader
          lang={lang}
          toggleLang={toggleLang}
          onSignIn={onSignInConsole}
          onSignUp={onSignUpTrial}
        />

        {/* ═══ HERO COMPACT (la caisse va droit au but — pas de 92vh) ═══ */}
        <section id="top" style={{ paddingBottom: 0 }}>
          <div className="mkl-wrap">
            <Reveal>
              <span className="mkl-eyebrow">
                <span className="mkl-pulse" aria-hidden="true" />
                {c.hero.badge}
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1>
                {c.hero.title1} <em>{c.hero.titleAccent}</em> {c.hero.title2}
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mkl-lead">{c.hero.lead}</p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mkl-hero-actions">
                <button className="mkl-btn mkl-btn-teal" onClick={() => scrollTo("catalogue")}>
                  {c.hero.cta}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
                <button className="mkl-btn mkl-btn-cream" onClick={() => scrollTo("recuperation")}>
                  {c.hero.ctaSecondary}
                </button>
              </div>
            </Reveal>
            <Reveal delay={0.22}>
              <p className="mkl-mode-hint">{c.hero.hint}</p>
            </Reveal>
          </div>
        </section>

        {/* ═══ SUIVI DE COMMANDE (retour GeniusPay ?order=MCV-…) ═══ */}
        {trackingRef !== "" && (
          <section id="suivi" style={{ paddingTop: 32 }}>
            <div className="mkl-wrap">
              <Reveal>
                <div className="mkl-panel">
                  <div className="mkl-panel-top" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                  <h2 style={{ fontSize: "1.5rem", margin: "0 0 6px" }}>{c.status.title}</h2>
                  <p style={{ color: "rgba(18, 59, 58, 0.72)", margin: "0 0 20px" }}>
                    {c.status.desc}
                  </p>
                  <div className="flex flex-wrap items-stretch gap-3">
                    <div className="rounded-2xl border border-[rgba(18,59,58,0.15)] bg-white/70 px-4 py-3 shadow-sm">
                      <p className="font-mono text-sm font-bold tracking-wide text-[var(--mkl-ink)]">
                        {trackingRef}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[rgba(18,59,58,0.55)]">{c.buy.ref}</p>
                    </div>
                    <div className="min-w-[220px] flex-1 rounded-2xl border border-[rgba(18,59,58,0.15)] bg-white/70 px-4 py-3 shadow-sm">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--mkl-ink)]">
                        {statusView.icon}
                        {statusView.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[rgba(18,59,58,0.55)]">
                        {statusView.desc}
                      </p>
                    </div>
                  </div>
                  {orderStatus?.status === "provisioned" && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      <div className="rounded-2xl border border-[rgba(18,59,58,0.15)] bg-white/70 px-4 py-2.5 shadow-sm">
                        <p className="font-mono text-sm font-semibold text-[var(--mkl-teal-dark)]">
                          {orderStatus.ipv4 ?? "—"}
                        </p>
                        <p className="text-[11px] text-[rgba(18,59,58,0.55)]">{c.status.ip}</p>
                      </div>
                      {orderStatus.expiresAt && (
                        <div className="rounded-2xl border border-[rgba(18,59,58,0.15)] bg-white/70 px-4 py-2.5 shadow-sm">
                          <p className="text-sm font-semibold text-[var(--mkl-ink)]">
                            {orderStatus.expiresAt.slice(0, 10)}
                          </p>
                          <p className="text-[11px] text-[rgba(18,59,58,0.55)]">{c.status.term}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        )}

        {/* ═══ CATALOGUE / ACHAT (formules live de l'API publique) ═══ */}
        <section id="catalogue">
          <div className="mkl-wrap">
            <Reveal className="mkl-sec-head mkl-center">
              <span className="mkl-kicker">{c.catalog.kicker}</span>
              <h2>{c.catalog.title}</h2>
              <p>{shopOpen ? c.catalog.lead : c.catalog.closedDesc}</p>
            </Reveal>

            {!shopOpen ? (
              <Reveal delay={0.08}>
                <div className="mx-auto max-w-xl">
                  <div className="mkl-panel">
                    <div className="mkl-panel-top" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <h3 style={{ fontSize: "1.25rem", margin: "0 0 12px" }}>
                      {c.catalog.closedTitle}
                    </h3>
                    <ul className="space-y-2.5">
                      {c.catalog.bullets.map((b) => (
                        <li key={b} className="flex gap-2.5 text-sm leading-relaxed text-[rgba(18,59,58,0.8)]">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--mkl-teal)]" aria-hidden />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-5 text-sm">
                      <Link
                        href="/vpn"
                        className="font-semibold text-[var(--mkl-teal-dark)] underline underline-offset-4"
                      >
                        {copy.header.nav.tunnels} →
                      </Link>
                    </p>
                  </div>
                </div>
              </Reveal>
            ) : (
              <>
                <div className="mkl-pricing mkl-pricing-duo" key={shopOpen ? "open" : "closed"}>
                  {plans.map((plan, i) => {
                    const yearly = plan.months > 1;
                    return (
                      <Reveal key={plan.id} delay={i * 0.08} className="h-full">
                        <article className={`mkl-price-card mkl-pc${i + 1} h-full`}>
                          {yearly && <span className="mkl-pop">{c.catalog.pop}</span>}
                          <h3>{yearly ? c.catalog.yearly.name : c.catalog.monthly.name}</h3>
                          <p className="mkl-tagline">
                            {yearly ? c.catalog.yearly.tagline : c.catalog.monthly.tagline}
                          </p>
                          <div className="mkl-amount">
                            {fmtFcfa(plan.baseFcfa)}{" "}
                            <small>/ {yearly ? c.catalog.yearly.per : c.catalog.monthly.per}</small>
                          </div>
                          <p className="mt-3 space-y-1 text-xs text-[rgba(18,59,58,0.6)]">
                            <span className="block">
                              {c.catalog.waveAmount} :{" "}
                              <b className="text-[var(--mkl-ink)]">{fmtFcfa(plan.waveFcfa)}</b>
                            </span>
                            <span className="block">
                              {c.catalog.cardAmount} :{" "}
                              <b className="text-[var(--mkl-ink)]">{fmtFcfa(plan.cardFcfa)}</b>
                            </span>
                          </p>
                          <ul>
                            {c.catalog.bullets.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                          <button
                            onClick={() => openBuy(plan.id)}
                            className={`mkl-btn ${yearly ? "mkl-btn-cream" : "mkl-btn-teal"}`}
                            style={{ justifyContent: "center", marginTop: "auto" }}
                          >
                            {c.catalog.cta}
                            <ArrowRight className="size-4" aria-hidden />
                          </button>
                        </article>
                      </Reveal>
                    );
                  })}
                </div>
                <Reveal delay={0.15}>
                  <p className="mkl-currency-note">
                    {offers?.onlinePayment ? c.catalog.onlineNote : c.catalog.manualNote}
                  </p>
                </Reveal>
              </>
            )}
          </div>
        </section>

        {/* ═══ RÉCUPÉRATION SELF-SERVICE ═══ */}
        <section id="recuperation">
          <div className="mkl-wrap">
            <Reveal className="mkl-sec-head mkl-center">
              <span className="mkl-kicker">{c.recover.kicker}</span>
              <h2>{c.recover.title}</h2>
              <p>{c.recover.desc}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="mx-auto max-w-xl">
                <div className="mkl-panel">
                  <div className="mkl-panel-top" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitRecover();
                    }}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="recover-email">{c.recover.email}</Label>
                      <Input
                        id="recover-email"
                        type="email"
                        required
                        value={recoverEmail}
                        onChange={(e) => setRecoverEmail(e.target.value)}
                        placeholder={c.buy.emailPlaceholder}
                        disabled={recoverBusy}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="recover-ref">{c.recover.ref}</Label>
                      <Input
                        id="recover-ref"
                        required
                        value={recoverRef}
                        onChange={(e) => setRecoverRef(e.target.value)}
                        placeholder="MCV-…"
                        disabled={recoverBusy}
                        className="font-mono"
                      />
                    </div>
                    {/* Honeypot — invisible : rempli = robot, la requête part en silence. */}
                    <input
                      ref={recoverHoneypot}
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
                    />
                    <Button type="submit" disabled={recoverBusy} className="w-full">
                      {recoverBusy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : null}
                      {recoverBusy ? c.recover.submitting : c.recover.submit}
                    </Button>
                    {recoverDone && (
                      <p className="text-sm font-medium text-[var(--mkl-teal-dark)]">
                        {c.recover.done}
                      </p>
                    )}
                    {recoverError && (
                      <p role="alert" className="text-sm font-medium text-red-600">
                        {recoverError}
                      </p>
                    )}
                    <p className="text-xs leading-relaxed text-[rgba(18,59,58,0.55)]">
                      {c.recover.note}
                    </p>
                  </form>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section id="faq" style={{ paddingBottom: 0 }}>
          <div className="mkl-wrap">
            <Reveal className="mkl-sec-head mkl-center">
              <span className="mkl-kicker">FAQ</span>
              <h2>{c.faq.title}</h2>
            </Reveal>
            <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
              {c.faq.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-[rgba(18,59,58,0.12)] bg-[var(--mkl-ivory)] px-5 py-4 shadow-sm transition hover:border-[rgba(18,59,58,0.25)]"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--mkl-ink)] marker:hidden [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.q}
                      <ChevronDown
                        className="size-4 shrink-0 text-[rgba(18,59,58,0.45)] transition group-open:rotate-180"
                        aria-hidden
                      />
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-[rgba(18,59,58,0.72)]">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FOOTER (composant partagé — variante page produit) ═══ */}
        <LandingFooter copy={copy} variant="product" />
      </div>

      {/* ═══ DIALOG D'ACHAT (shadcn — mêmes briques que la modale
          d'inscription ; radios maison charte N°316) ═══ */}
      <Dialog
        open={buyOpen}
        onOpenChange={(o) => {
          if (!buyBusy) setBuyOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{c.buy.title}</DialogTitle>
            <DialogDescription>{c.buy.desc}</DialogDescription>
          </DialogHeader>

          {manualRef ? (
            /* Canal manuel : la référence fait foi. */
            <div className="space-y-4">
              <div className="rounded-2xl border border-[rgba(18,59,58,0.15)] bg-[var(--mkl-mint-soft)] p-4 text-center">
                <p className="text-xs text-[rgba(18,59,58,0.6)]">{c.buy.ref}</p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wider text-[var(--mkl-teal-dark)]">
                  {manualRef}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{c.buy.manualDesc}</p>
              <Button className="w-full" onClick={() => setBuyOpen(false)}>
                OK
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitOrder();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="buy-email">{c.buy.email}</Label>
                <Input
                  id="buy-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={c.buy.emailPlaceholder}
                  disabled={buyBusy}
                />
              </div>

              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-foreground">
                  {c.buy.method}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    htmlFor="pay-wave"
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-input bg-background p-3 transition has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input
                      id="pay-wave"
                      type="radio"
                      name="paymethod"
                      value="wave"
                      checked={payMethod === "wave"}
                      onChange={() => setPayMethod("wave")}
                      disabled={buyBusy}
                      className="size-4 accent-[var(--mkl-teal)]"
                    />
                    <span className="text-sm font-medium">{c.buy.methodWave}</span>
                  </label>
                  <label
                    htmlFor="pay-card"
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-input bg-background p-3 transition has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input
                      id="pay-card"
                      type="radio"
                      name="paymethod"
                      value="card"
                      checked={payMethod === "card"}
                      onChange={() => setPayMethod("card")}
                      disabled={buyBusy}
                      className="size-4 accent-[var(--mkl-teal)]"
                    />
                    <span className="text-sm font-medium">{c.buy.methodCard}</span>
                  </label>
                </div>
                {selectedPlan && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {payMethod === "wave" ? fmtFcfa(selectedPlan.waveFcfa) : fmtFcfa(selectedPlan.cardFcfa)}{" "}
                    — {payMethod === "wave" ? c.buy.waveAmount : c.buy.cardAmount}
                  </p>
                )}
              </fieldset>

              {payMethod === "wave" && (
                <div className="space-y-1.5">
                  <Label htmlFor="buy-phone">{c.buy.phone}</Label>
                  <Input
                    id="buy-phone"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={c.buy.phonePlaceholder}
                    disabled={buyBusy}
                  />
                  <p className="text-xs text-muted-foreground">{c.buy.phoneHint}</p>
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

              {buyError && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {buyError}
                </p>
              )}

              <Button type="submit" disabled={buyBusy} className="w-full">
                {buyBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {buyBusy ? c.buy.submitting : c.buy.submit}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
