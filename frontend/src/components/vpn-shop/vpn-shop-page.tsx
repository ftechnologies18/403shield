"use client";

// vpn-shop-page.tsx — N°301 — vitrine publique « MikCloud VPN » (/vpn) :
// le canal B2C « vente directe plateforme ». Même grammaire visuelle que la
// vitrine SaaS (style clay, classes mkl- auto-contenues de
// landing-clay.css — zéro collision avec le thème console).
//
// PARCOURS (l'acheteur n'a PAS de compte SaaS — apiAnon partout) :
//   1. Catalogue : GET /api/public/vpn/offers (formules + montants par
//      moyen, frais répercutés) — fermé → état « bientôt » honnête ;
//   2. Achat : dialog (e-mail + téléphone Wave + moyen) → POST
//      /api/public/vpn/order → redirection GeniusPay (paymentUrl) ou canal
//      « manual » (référence MCV- à régler, confirmation console) ;
//   3. Statut : /vpn?order=MCV-… — poll du GET /api/public/vpn/order/{ref}
//      (le retour de paiement finalise côté serveur, provisioning auto,
//      l'e-mail de livraison part seul) ;
//   4. Self-service : POST /api/public/vpn/recover (e-mail + réf) — la conf
//      part UNIQUEMENT par e-mail, jamais affichée ici (anti-énumération :
//      réponse générique).
//
// Honeypot « website » invisible sur les deux POST (pattern join N°27).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Fraunces, Manrope } from "next/font/google";
import { CheckCircle2, Loader2, Mail, ShieldCheck, ShieldOff, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ApiError,
  createPublicVpnOrder,
  fetchPublicVpnOffers,
  fetchPublicVpnOrderStatus,
  recoverPublicVpnConf,
} from "@/lib/hotspot/api";
import { useHotspotStore } from "@/lib/hotspot/store";
import { vpnShopCopy, type VpnShopLang } from "./vpn-shop-copy";
import "../landing/landing-clay.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export interface VpnShopPageProps {
  /** Référence MCV-… issue de l'URL (?order=) — lance le suivi de commande. */
  initialOrderRef?: string;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function fmtFcfa(n: number): string {
  return `${n.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

export default function VpnShopPage({ initialOrderRef = "" }: VpnShopPageProps) {
  const lang = useHotspotStore((s) => s.lang) as VpnShopLang;
  const copy = vpnShopCopy[lang];

  /* Catalogue public (poll long : quasi statique, ETag côté serveur). */
  const { data: offers } = useQuery({
    queryKey: ["/api/public/vpn/offers"],
    queryFn: () => fetchPublicVpnOffers(),
    refetchInterval: 60_000,
    retry: 1,
  });

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

  /* ─── Suivi de commande (poll tant que non résolu) ─── */
  const [trackingRef, setTrackingRef] = useState(initialOrderRef);
  const { data: orderStatus } = useQuery({
    queryKey: ["/api/public/vpn/order", trackingRef],
    queryFn: () => fetchPublicVpnOrderStatus(trackingRef),
    enabled: trackingRef !== "",
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "provisioned" || s === "cancelled" || s === "expired" ? false : 5_000;
    },
    retry: 1,
  });

  /* ─── Récupération self-service ─── */
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverRef, setRecoverRef] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverDone, setRecoverDone] = useState(false);
  const [recoverError, setRecoverError] = useState("");

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

  const selectedPlan = plans.find((p) => p.id === buyPlan);

  return (
    <div className={`mkl-page ${fraunces.variable} ${manrope.variable}`}>
      <div className="mkl-grain" aria-hidden="true" />
      <div className="mkl-blob mkl-blob-1" aria-hidden="true" />
      <div className="mkl-blob mkl-blob-2" aria-hidden="true" />

      {/* ─── Topbar ─── */}
      <header className="mkl-topbar">
        <div className="mkl-wrap flex items-center justify-between py-5">
          <a href="/" className="mkl-brand" aria-label={copy.nav.home}>
            <span className="mkl-brand-logo" aria-hidden="true" />
            {copy.brand}
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold md:flex" aria-label="primary">
            <a href="#produit" className="mkl-link-quiet" onClick={(e) => { e.preventDefault(); scrollTo("produit"); }}>
              {copy.nav.product}
            </a>
            <a href="#tarifs" className="mkl-link-quiet" onClick={(e) => { e.preventDefault(); scrollTo("tarifs"); }}>
              {copy.nav.pricing}
            </a>
            <a href="#faq" className="mkl-link-quiet" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>
              {copy.nav.faq}
            </a>
            <Button size="sm" variant="outline" className="mkl-btn-sm" onClick={() => scrollTo("recuperation")}>
              {copy.hero.ctaSecondary}
            </Button>
          </nav>
        </div>
      </header>

      <main className="mkl-main">
        {/* ─── Hero ─── */}
        <section id="top" className="mkl-hero">
          <div className="mkl-wrap mkl-hero-grid">
            <div>
              <p className="mkl-eyebrow">
                <span className="mkl-pulse" aria-hidden="true" />
                {copy.hero.eyebrow}
              </p>
              <h1>
                {copy.hero.title} <em>{copy.hero.titleEm}</em>
              </h1>
              <p className="mkl-lead">{copy.hero.lead}</p>
              <div className="mkl-hero-actions">
                <Button className="mkl-btn mkl-btn-teal" onClick={() => scrollTo("tarifs")}>
                  {copy.hero.cta}
                </Button>
                <Button variant="ghost" className="mkl-btn mkl-btn-cream" onClick={() => scrollTo("recuperation")}>
                  {copy.hero.ctaSecondary}
                </Button>
              </div>
              <p className="mkl-trial-hint">{copy.hero.hint}</p>
            </div>
            <div className="mkl-cloud-stage" aria-hidden="true">
              <div className="mkl-clay-circle mkl-c1" />
              <div className="mkl-clay-circle mkl-c2" />
              <div className="mkl-clay-circle mkl-c3" />
              <div className="mkl-cloud-body">
                <ShieldCheck size={44} strokeWidth={1.6} />
              </div>
              <span className="mkl-chip mkl-chip-a">
                <ShieldCheck size={14} aria-hidden="true" />
                {copy.features[0].tag}
              </span>
              <span className="mkl-chip mkl-chip-b">
                <Timer size={14} aria-hidden="true" />
                30 s
              </span>
              <span className="mkl-chip mkl-chip-c">
                <Mail size={14} aria-hidden="true" />
                e-mail
              </span>
            </div>
          </div>
        </section>

        {/* ─── Bandeau stats ─── */}
        <section className="mkl-band">
          <div className="mkl-wrap mkl-band-grid">
            {copy.stats.map((s) => (
              <div key={s.label}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Produit ─── */}
        <section id="produit">
          <div className="mkl-wrap">
            <div className="mkl-sec-head mkl-center">
              <p className="mkl-kicker">{copy.nav.product}</p>
              <h2>{copy.features[0].title}</h2>
            </div>
            <div className="mkl-powers">
              {copy.features.map((f, i) => (
                <article key={f.title} className={`mkl-power mkl-p${i + 1}`}>
                  <div className="mkl-icon" aria-hidden="true">
                    {i === 0 ? <ShieldCheck size={22} /> : i === 1 ? <ShieldOff size={22} /> : <Mail size={22} />}
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <span className="mkl-tag">{f.tag}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Tarifs / achat ─── */}
        <section id="tarifs">
          <div className="mkl-wrap">
            <div className="mkl-sec-head mkl-center">
              <p className="mkl-kicker">{copy.pricing.kicker}</p>
              <h2>{copy.pricing.title}</h2>
              <p>{shopOpen ? copy.pricing.lead : copy.pricing.closedDesc}</p>
            </div>

            {!shopOpen ? (
              <div className="mkl-price-card mkl-pc1" style={{ maxWidth: 640, margin: "0 auto" }}>
                <h3>{copy.pricing.closedTitle}</h3>
                <p className="mkl-tagline">{copy.pricing.closedDesc}</p>
                <ul>
                  {copy.pricing.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mkl-currency-note">
                  <a href="/" className="mkl-link-quiet">
                    {copy.nav.home} →
                  </a>
                </p>
              </div>
            ) : (
              <div className="mkl-pricing">
                {plans.map((plan) => {
                  const yearly = plan.months > 1;
                  return (
                    <article key={plan.id} className={`mkl-price-card ${yearly ? "mkl-pc2" : "mkl-pc1"}`}>
                      {yearly && <span className="mkl-pop">{copy.pricing.pop}</span>}
                      <h3>{yearly ? copy.pricing.yearly.name : copy.pricing.monthly.name}</h3>
                      <p className="mkl-tagline">
                        {yearly ? copy.pricing.yearly.tagline : copy.pricing.monthly.tagline}
                      </p>
                      <div className="mkl-amount">
                        {fmtFcfa(plan.baseFcfa)} <small>{yearly ? copy.pricing.yearly.per : copy.pricing.monthly.per}</small>
                      </div>
                      <p className="mkl-currency-note">
                        {copy.buy.waveAmount} : <b>{fmtFcfa(plan.waveFcfa)}</b>
                        <br />
                        {copy.buy.cardAmount} : <b>{fmtFcfa(plan.cardFcfa)}</b>
                      </p>
                      <ul>
                        {copy.pricing.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                      <Button className={`mkl-btn ${yearly ? "mkl-btn-cream" : "mkl-btn-teal"}`} onClick={() => openBuy(plan.id)}>
                        {copy.pricing.cta(plan.id)}
                      </Button>
                    </article>
                  );
                })}
                <p className="mkl-currency-note" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
                  {offers?.onlinePayment ? copy.pricing.onlineNote : copy.pricing.manualNote}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ─── Suivi de commande (visible si ref active) ─── */}
        {trackingRef !== "" && (
          <section id="suivi">
            <div className="mkl-wrap">
              <div className="mkl-panel mkl-dark" style={{ padding: "28px 26px" }}>
                <div className="mkl-sec-head">
                  <p className="mkl-kicker">MCV</p>
                  <h2 style={{ fontSize: "1.5rem" }}>{copy.status.title}</h2>
                  <p>{copy.status.desc}</p>
                </div>
                <div style={{ padding: "18px 6px 4px" }}>
                  <p className="mkl-stat-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <span className="mkl-stat-mini" style={{ padding: "10px 14px" }}>
                      <b style={{ fontFamily: "var(--font-manrope), sans-serif", fontSize: "0.95rem" }}>{trackingRef}</b>
                      <span>{copy.buy.ref}</span>
                    </span>
                    {(() => {
                      const s = orderStatus?.status ?? "pending";
                      const icon =
                        s === "provisioned" ? (
                          <CheckCircle2 size={20} aria-hidden="true" />
                        ) : s === "paid" ? (
                          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Timer size={20} aria-hidden="true" />
                        );
                      const title =
                        s === "provisioned"
                          ? copy.status.provisioned
                          : s === "paid"
                            ? copy.status.paid
                            : s === "cancelled"
                              ? copy.status.cancelled
                              : s === "expired"
                                ? copy.status.expired
                                : copy.status.pending;
                      const desc =
                        s === "provisioned"
                          ? copy.status.provisionedDesc
                          : s === "paid"
                            ? copy.status.paidDesc
                            : s === "cancelled"
                              ? copy.status.cancelledDesc
                              : s === "expired"
                                ? copy.status.expiredDesc
                                : copy.status.pendingDesc;
                      return (
                        <span className="mkl-stat-mini" style={{ padding: "10px 14px", flex: 1, minWidth: 220 }}>
                          <b style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem" }}>
                            {icon}
                            {title}
                          </b>
                          <span>{desc}</span>
                        </span>
                      );
                    })()}
                  </p>
                  {orderStatus?.status === "provisioned" && (
                    <p className="mkl-stat-row" style={{ marginTop: 10, justifyContent: "flex-start", gap: 12 }}>
                      <span className="mkl-stat-mini" style={{ padding: "8px 14px" }}>
                        <b>{orderStatus.ipv4 ?? "—"}</b>
                        <span>{copy.status.ip}</span>
                      </span>
                      {orderStatus.expiresAt && (
                        <span className="mkl-stat-mini" style={{ padding: "8px 14px" }}>
                          <b>{orderStatus.expiresAt.slice(0, 10)}</b>
                          <span>{copy.status.term}</span>
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Récupération self-service ─── */}
        <section id="recuperation">
          <div className="mkl-wrap">
            <div className="mkl-split">
              <div className="mkl-body">
                <p className="mkl-kicker">{copy.recover.kicker}</p>
                <h2>{copy.recover.title}</h2>
                <p className="mkl-lead">{copy.recover.desc}</p>
                <form
                  className="mkl-feat-list"
                  style={{ gap: 14, marginTop: 18 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitRecover();
                  }}
                >
                  <div className="mkl-feat">
                    <div className="mkl-fi" aria-hidden="true">
                      <Mail size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Label htmlFor="recover-email" className="mb-1.5 block text-sm font-semibold">
                        {copy.recover.email}
                      </Label>
                      <Input
                        id="recover-email"
                        type="email"
                        required
                        value={recoverEmail}
                        onChange={(e) => setRecoverEmail(e.target.value)}
                        placeholder={copy.buy.emailPlaceholder}
                        disabled={recoverBusy}
                      />
                    </div>
                  </div>
                  <div className="mkl-feat">
                    <div className="mkl-fi" aria-hidden="true">
                      <ShieldCheck size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Label htmlFor="recover-ref" className="mb-1.5 block text-sm font-semibold">
                        {copy.recover.ref}
                      </Label>
                      <Input
                        id="recover-ref"
                        required
                        value={recoverRef}
                        onChange={(e) => setRecoverRef(e.target.value)}
                        placeholder="MCV-…"
                        className="font-mono"
                        disabled={recoverBusy}
                      />
                    </div>
                  </div>
                  {/* Honeypot — invisible, rempli = robot : la commande part en silence. */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
                    onChange={() => undefined}
                  />
                  <div>
                    <Button type="submit" className="mkl-btn mkl-btn-teal" disabled={recoverBusy}>
                      {recoverBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                      {recoverBusy ? copy.recover.submitting : copy.recover.submit}
                    </Button>
                  </div>
                  {recoverDone && (
                    <p className="mkl-currency-note" style={{ color: "#0E7C7B", fontWeight: 600 }}>
                      {copy.recover.done}
                    </p>
                  )}
                  {recoverError && (
                    <p className="mkl-currency-note" style={{ color: "#B3261E", fontWeight: 600 }}>
                      {recoverError}
                    </p>
                  )}
                  <p className="mkl-currency-note">{copy.recover.note}</p>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq">
          <div className="mkl-wrap">
            <div className="mkl-sec-head mkl-center">
              <p className="mkl-kicker">FAQ</p>
              <h2>{copy.faq.title}</h2>
            </div>
            <div style={{ display: "grid", gap: 12, maxWidth: 760, margin: "0 auto" }}>
              {copy.faq.items.map((item) => (
                <details key={item.q} className="mkl-price-card mkl-pc3" style={{ padding: "18px 22px", borderRadius: "1.4rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "0.98rem" }}>{item.q}</summary>
                  <p style={{ marginTop: 10, fontSize: "0.9rem", lineHeight: 1.65, opacity: 0.85 }}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="mkl-footer">
        <div className="mkl-wrap">
          <div className="mkl-foot-grid">
            <div>
              <a href="/" className="mkl-brand">
                <span className="mkl-brand-logo" aria-hidden="true" />
                {copy.brand}
              </a>
              <p className="mkl-foot-tagline">{copy.footer.tagline}</p>
            </div>
            <div>
              <h5>{copy.nav.product}</h5>
              {copy.footer.links.map((l) => (
                <a key={l.href + l.label} href={l.href}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="mkl-foot-bottom">
            <p>{copy.footer.legal}</p>
          </div>
        </div>
      </footer>

      {/* ─── Dialog d'achat ─── */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.buy.title}</DialogTitle>
            <DialogDescription>{copy.buy.desc}</DialogDescription>
          </DialogHeader>

          {manualRef ? (
            /* Canal manuel : la référence fait foi. */
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4 text-center">
                <p className="text-xs text-muted-foreground">{copy.buy.ref}</p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wider">{manualRef}</p>
              </div>
              <p className="text-sm text-muted-foreground">{copy.buy.manualDesc}</p>
              <DialogFooter>
                <Button onClick={() => setBuyOpen(false)}>OK</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitOrder();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="buy-email">{copy.buy.email}</Label>
                <Input
                  id="buy-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.buy.emailPlaceholder}
                  disabled={buyBusy}
                />
              </div>

              <div className="space-y-2">
                <Label>{copy.buy.method}</Label>
                <RadioGroup
                  value={payMethod}
                  onValueChange={(v) => setPayMethod(v as "wave" | "card")}
                  className="grid grid-cols-2 gap-3"
                  disabled={buyBusy}
                >
                  <Label
                    htmlFor="pay-wave"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[button[data-state=checked]]:border-primary"
                  >
                    <RadioGroupItem id="pay-wave" value="wave" />
                    <span className="text-sm font-medium">{copy.buy.methodWave}</span>
                  </Label>
                  <Label
                    htmlFor="pay-card"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[button[data-state=checked]]:border-primary"
                  >
                    <RadioGroupItem id="pay-card" value="card" />
                    <span className="text-sm font-medium">{copy.buy.methodCard}</span>
                  </Label>
                </RadioGroup>
                {selectedPlan && (
                  <p className="text-xs text-muted-foreground">
                    {payMethod === "wave" ? fmtFcfa(selectedPlan.waveFcfa) : fmtFcfa(selectedPlan.cardFcfa)} —{" "}
                    {payMethod === "wave" ? copy.buy.waveAmount : copy.buy.cardAmount}
                  </p>
                )}
              </div>

              {payMethod === "wave" && (
                <div className="space-y-2">
                  <Label htmlFor="buy-phone">{copy.buy.phone}</Label>
                  <Input
                    id="buy-phone"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={copy.buy.phonePlaceholder}
                    disabled={buyBusy}
                  />
                  <p className="text-xs text-muted-foreground">{copy.buy.phoneHint}</p>
                </div>
              )}

              {/* Honeypot — invisible : rempli = robot, la commande part en silence. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
                onChange={() => undefined}
              />

              {buyError && <p className="text-sm font-medium text-red-600">{buyError}</p>}

              <DialogFooter>
                <Button type="submit" className="w-full gap-2" disabled={buyBusy}>
                  {buyBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                  {buyBusy ? copy.buy.submitting : copy.buy.submit}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
