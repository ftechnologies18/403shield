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
//
// N°347 — la caisse devient BIPRODUIT : le VPN B2C (réfs MCV-) et le
// bouclier DNS TOURACO (réfs MCD-) partagent ce MÊME composant (extension
// propre, pas un fork). Le produit vient de ?product=dns (liens de la page
// /dns) OU du préfixe de la référence ?order=MCD-… (retour GeniusPay DNS) ;
// un sélecteur d'onglets permet de basculer — catalogue, dialog d'achat et
// FAQ suivent l'onglet actif, le suivi de commande suit le PRÉFIXE de la
// référence (une commande MCD- s'affiche avec les libellés DNS même si
// l'onglet actif est VPN).

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
  type PublicVpnOffers,
  type PublicVpnOrderStatus,
} from "@/lib/public-vpn";
/* N°347 — canal public du bouclier DNS TOURACO (miroir du canal VPN). */
import {
  createPublicDnsOrder,
  fetchPublicDnsOffers,
  fetchPublicDnsOrderStatus,
  PublicDnsApiError,
  recoverPublicDnsActivation,
  type PublicDnsOffers,
  type PublicDnsOrderStatus,
} from "@/lib/public-dns";
import { landingCopy, type Lang } from "../landing/landing-copy";
import { EnterpriseHeader } from "../landing/enterprise-header";
import { LandingFooter } from "../landing/landing-footer";
import { Reveal } from "../landing/reveal";
import { fraunces, manrope } from "../landing/landing-fonts";
import {
  checkoutCopy,
  type CheckoutLang,
  type CheckoutProduct,
} from "./checkout-copy";
import "../landing/landing-clay.css";

/** Console 403Shield — entrée unique de l'application (N°323 : la racine
 * redirige vers /login, pattern dash.cloudflare.com). */
const CONSOLE_LOGIN_URL = "https://console.403shield.ftci.fr/login";

/** N°347 — console DNS (profils, listes, couvre-feux, logements, journal) :
 * la même console tunnel, section /dns — modèle OVH « on commande sur www,
 * on gère dans le manager » (miroir de tunnelPublicBaseURL()+"/dns" côté
 * backend ; constante au même titre que CONSOLE_LOGIN_URL). */
const CONSOLE_DNS_URL = "https://console.403shield.ftci.fr/dns";

/** N°347 — produit d'une référence de commande : MCD- → bouclier DNS
 * TOURACO, tout le reste (MCV-) → VPN. Le suivi de commande route vers la
 * bonne API publique par ce seul préfixe. */
function refProduct(ref: string): CheckoutProduct {
  return ref.startsWith("MCD-") ? "dns" : "vpn";
}

/** N°347 — code métier d'une erreur pubFetch (writeErrCode) sans cast
 * gratuit : les deux canaux publics exposent le même champ. */
function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof PublicVpnApiError || err instanceof PublicDnsApiError) {
    return err.code;
  }
  return undefined;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fmtFcfa(n?: number): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

export interface CheckoutPageProps {
  /** Référence MCV-/MCD-… issue de l'URL (?order=, préservée par les 308
   * GeniusPay) — lance le suivi de commande. */
  initialOrderRef?: string;
  /** Formule préselectionnée (?plan=, liens des cartes tarifs de la vitrine)
   * — ouvre la caisse dès que le catalogue la confirme (vpn-b2c-month ou
   * dns-month/dns-year selon l'onglet). */
  initialPlanId?: string;
  /** N°347 — produit initial (?product=dns, liens de la page /dns) ; le
   * préfixe de ?order=MCD-… prime tout autant (retour GeniusPay DNS). */
  initialProduct?: string;
}

export default function CheckoutPage({
  initialOrderRef = "",
  initialPlanId = "",
  initialProduct = "",
}: CheckoutPageProps) {
  const lang = useHotspotStore((s) => s.lang) as Lang;
  const setLang = useHotspotStore((s) => s.setLang);
  const copy = landingCopy[lang];
  const cl = checkoutCopy[lang as CheckoutLang];
  const router = useRouter();

  /* N°347 — produit affiché : ?product= PUIS préfixe de ?order= (une commande
     DNS ouverte par son lien de retour affiche l'onglet DNS d'office). */
  const [product, setProduct] = useState<CheckoutProduct>(
    initialProduct === "dns" || refProduct(initialOrderRef) === "dns" ? "dns" : "vpn"
  );
  const c = cl[product];

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
  /* N°347 — un catalogue PAR produit, mis en cache par onglet : la bascule
     n'affiche JAMAIS les formules VPN sous l'onglet DNS (et réciproquement). */
  const [offersByProduct, setOffersByProduct] = useState<
    Record<CheckoutProduct, PublicVpnOffers | PublicDnsOffers | null>
  >({ vpn: null, dns: null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res =
          product === "dns" ? await fetchPublicDnsOffers() : await fetchPublicVpnOffers();
        if (alive) setOffersByProduct((prev) => ({ ...prev, [product]: res }));
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
  }, [product]);

  const offers = offersByProduct[product];

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
  const [orderStatus, setOrderStatus] = useState<
    PublicVpnOrderStatus | PublicDnsOrderStatus | null
  >(null);
  useEffect(() => {
    if (!trackingRef) return;
    let alive = true;
    const resolved = (s?: string) =>
      s === "provisioned" || s === "cancelled" || s === "expired";
    /* N°347 — l'API de suivi suit le PRÉFIXE de la référence : MCD- → canal
       DNS, MCV- → canal VPN (l'onglet actif n'y change rien). */
    const isDns = trackingRef.startsWith("MCD-");
    const poll = async () => {
      try {
        const res = isDns
          ? await fetchPublicDnsOrderStatus(trackingRef)
          : await fetchPublicVpnOrderStatus(trackingRef);
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

  /* N°347 — libellés du suivi = produit de la RÉFÉRENCE suivie (pas de
     l'onglet actif) : un retour GeniusPay MCD- s'affiche en mots DNS. */
  const trackProduct: CheckoutProduct = trackingRef ? refProduct(trackingRef) : product;
  const cTrack = cl[trackProduct];
  /* L'IP tunnel n'existe que dans le statut VPN (le statut DNS ne transporte
     jamais d'IP) : le garde « in » rétrécit l'union proprement. */
  const trackedIpv4 = orderStatus && "ipv4" in orderStatus ? orderStatus.ipv4 : undefined;

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

  /* N°347 — bascule d'onglet produit : on repart d'un tunnel d'achat propre
     (formule, canal manuel, erreurs) — l'e-mail et le téléphone restent (même
     acheteur), le suivi de commande n'est pas touché (il suit sa référence). */
  const switchProduct = (p: CheckoutProduct) => {
    if (p === product) return;
    setProduct(p);
    setBuyOpen(false);
    setBuyPlan("");
    setManualRef("");
    setBuyError("");
  };

  const submitOrder = async () => {
    setBuyBusy(true);
    setBuyError("");
    try {
      /* N°347 — mêmes champs, deux canaux : la commande VPN livre une
         configuration WireGuard (MCV-), la commande DNS porte un droit
         TOURACO (MCD-) ; le honeypot voyage dans les deux. */
      const res =
        product === "dns"
          ? await createPublicDnsOrder({
              email: email.trim(),
              phone: payMethod === "wave" ? phone.trim() : undefined,
              planId: buyPlan,
              payMethod,
              website: buyHoneypot.current?.value ?? "",
            })
          : await createPublicVpnOrder({
              email: email.trim(),
              phone: payMethod === "wave" ? phone.trim() : undefined,
              planId: buyPlan,
              payMethod,
              website: buyHoneypot.current?.value ?? "",
            });
      if (res.online && res.paymentUrl) {
        // Laisse le statut suivre la commande au retour (success_url porte la ref).
        setTrackingRef(res.ref);
        window.location.href = res.paymentUrl;
        return;
      }
      // Canal manuel : la référence est le lien entre l'acheteur et la commande.
      setManualRef(res.ref);
      setTrackingRef(res.ref);
    } catch (err) {
      setBuyError(
        apiErrorCode(err) === "order_pending_exists" ? c.buy.errPending : (err as Error).message
      );
    } finally {
      setBuyBusy(false);
    }
  };

  const submitRecover = async () => {
    setRecoverBusy(true);
    setRecoverError("");
    setRecoverDone(false);
    try {
      /* N°347 — l'API de récupération suit le PRÉFIXE de la référence saisie
         (MCD- → activation DNS, MCV- → configuration VPN), honeypot compris
         pour le canal DNS (le backend le lit sur les deux POST). */
      if (recoverRef.trim().startsWith("MCD-")) {
        await recoverPublicDnsActivation(
          recoverEmail.trim(),
          recoverRef.trim(),
          recoverHoneypot.current?.value ?? ""
        );
      } else {
        await recoverPublicVpnConf(recoverEmail.trim(), recoverRef.trim());
      }
      setRecoverDone(true);
    } catch (err) {
      setRecoverError((err as Error).message);
    } finally {
      setRecoverBusy(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === buyPlan);

  const statusView = (() => {
    const s = orderStatus?.status ?? "pending";
    if (s === "provisioned")
      return { icon: <CheckCircle2 size={20} aria-hidden />, title: cTrack.status.provisioned, desc: cTrack.status.provisionedDesc };
    if (s === "paid")
      return { icon: <Loader2 size={20} className="animate-spin" aria-hidden />, title: cTrack.status.paid, desc: cTrack.status.paidDesc };
    if (s === "cancelled")
      return { icon: <X size={20} aria-hidden />, title: cTrack.status.cancelled, desc: cTrack.status.cancelledDesc };
    if (s === "expired")
      return { icon: <Timer size={20} aria-hidden />, title: cTrack.status.expired, desc: cTrack.status.expiredDesc };
    return { icon: <Timer size={20} aria-hidden />, title: cTrack.status.pending, desc: cTrack.status.pendingDesc };
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

        {/* ═══ N°347 — SÉLECTEUR DE PRODUIT : une caisse, deux produits (VPN
            B2C / bouclier DNS TOURACO). La bascule recharge le bon catalogue
            et rouvre un tunnel d'achat propre ; le suivi de commande suit
            toujours le préfixe de SA référence. Pilule clay du sélecteur de
            la home (mkl-mode-toggle). ═══ */}
        <Reveal delay={0.05}>
          <div className="mkl-mode-toggle" role="group" aria-label={cl.switch.label}>
            {(["vpn", "dns"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={product === p}
                className={`mkl-mode-btn ${product === p ? "is-active" : ""}`}
                onClick={() => switchProduct(p)}
              >
                <span className="mkl-mode-lbl">{cl.switch[p]}</span>
              </button>
            ))}
          </div>
        </Reveal>

        {/* ═══ SUIVI DE COMMANDE (retour GeniusPay ?order=MCV-/MCD-…) ═══ */}
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
                  <h2 style={{ fontSize: "1.5rem", margin: "0 0 6px" }}>{cTrack.status.title}</h2>
                  <p style={{ color: "rgba(18, 59, 58, 0.72)", margin: "0 0 20px" }}>
                    {cTrack.status.desc}
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
                    <div className="mt-3 flex flex-wrap items-stretch gap-3">
                      {/* N°347 — l'IP tunnel n'existe que pour le VPN ; le droit
                          DNS s'ouvre dans la console /dns (CTA dédié). */}
                      {trackProduct === "vpn" && (
                        <div className="rounded-2xl border border-[rgba(18,59,58,0.15)] bg-white/70 px-4 py-2.5 shadow-sm">
                          <p className="font-mono text-sm font-semibold text-[var(--mkl-teal-dark)]">
                            {trackedIpv4 ?? "—"}
                          </p>
                          <p className="text-[11px] text-[rgba(18,59,58,0.55)]">{cTrack.status.ip}</p>
                        </div>
                      )}
                      {orderStatus.expiresAt && (
                        <div className="rounded-2xl border border-[rgba(18,59,58,0.15)] bg-white/70 px-4 py-2.5 shadow-sm">
                          <p className="text-sm font-semibold text-[var(--mkl-ink)]">
                            {orderStatus.expiresAt.slice(0, 10)}
                          </p>
                          <p className="text-[11px] text-[rgba(18,59,58,0.55)]">{cTrack.status.term}</p>
                        </div>
                      )}
                      {trackProduct === "dns" && cTrack.status.consoleCta && (
                        <a
                          href={CONSOLE_DNS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mkl-btn mkl-btn-teal self-center"
                        >
                          {cTrack.status.consoleCta}
                          <ArrowRight className="size-4" aria-hidden />
                          <span className="sr-only"> — nouvel onglet</span>
                        </a>
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
                        href={product === "dns" ? "/dns" : "/vpn"}
                        className="font-semibold text-[var(--mkl-teal-dark)] underline underline-offset-4"
                      >
                        {product === "dns" ? cl.switch.dns : copy.header.nav.tunnels} →
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
                        placeholder={product === "dns" ? "MCD-…" : "MCV-…"}
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
