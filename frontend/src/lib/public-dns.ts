// public-dns.ts — N°347 — caisse publique du bouclier DNS TOURACO
// (/checkout?product=dns) : contrat /api/public/dns/* (backend
// handlers_public_dns.go — SANS auth, CORS whitelist incluant
// 403shield.ftci.fr). Miroir EXACT de public-vpn.ts (N°323) : mêmes
// conventions (API_BASE depuis NEXT_PUBLIC_API_BASE, classe d'erreur
// dédiée, pubFetch no-store), seul le canal change.
//
// Doctrine produit (N°347) : le bouclier DNS 403Shield est UTILISABLE
// GRATUITEMENT (10 profils, 200 règles/liste, 5 logements, journal 30 j).
// L'abonnement TOURACO (réfs MCD-) étend les capacités — c'est un DROIT
// porté par l'e-mail, pas une conf livrée :
//   1. Catalogue : GET /api/public/dns/offers — fermé → état « bientôt » ;
//   2. Achat : POST /api/public/dns/order → redirection GeniusPay
//      (paymentUrl) ou canal « manual » (référence MCD- à régler) ;
//   3. Statut : /checkout?order=MCD-… — poll 5 s du GET
//      /api/public/dns/order/{ref} (le retour de paiement finalise côté
//      serveur, le droit s'applique, l'e-mail d'activation part seul) ;
//   4. Self-service : POST /api/public/dns/recover (e-mail + réf) —
//      l'activation part UNIQUEMENT par e-mail, jamais affichée
//      (anti-énumération).
//
// Honeypot « website » invisible sur les deux POST — rempli = robot : le
// backend part en silence.

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");

export class PublicDnsApiError extends Error {
  status: number;
  /** Code métier éventuel porté par le corps JSON (writeErrCode). */
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function readError(res: Response): Promise<PublicDnsApiError> {
  try {
    const data = await res.json();
    const msg =
      typeof data?.error === "string" && data.error ? data.error : `Erreur ${res.status}`;
    const code = typeof data?.code === "string" && data.code ? data.code : undefined;
    return new PublicDnsApiError(res.status, msg, code);
  } catch {
    /* corps non JSON : message générique ci-dessous */
  }
  return new PublicDnsApiError(res.status, `Erreur ${res.status}`);
}

async function pubFetch<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Types du contrat public (miroir de handlers_public_dns.go — statut
// MINIMAL : jamais d'e-mail, jamais d'état interne)
// ---------------------------------------------------------------------------

export interface PublicDnsOfferPlan {
  id: string;
  label: string;
  periodLabel: string;
  months: number;
  baseFcfa: number;
  waveFcfa?: number;
  cardFcfa?: number;
}

export interface PublicDnsOffers {
  enabled: boolean;
  onlinePayment?: boolean;
  plans: PublicDnsOfferPlan[];
}

export interface PublicDnsOrderCreated {
  ref: string;
  status: string;
  amountFcfa: number;
  payMethod: string;
  paymentUrl: string;
  online: boolean;
}

export interface PublicDnsOrderStatus {
  ref: string;
  status: string;
  months: number;
  planLabel?: string;
  periodLabel?: string;
  expiresAt?: string;
}

/** Catalogue public de la caisse DNS (formules TOURACO + montants par moyen). */
export async function fetchPublicDnsOffers(): Promise<PublicDnsOffers> {
  return pubFetch<PublicDnsOffers>("/api/public/dns/offers");
}

/** Crée la commande pending (droit TOURACO porté par l'e-mail) et
 * (paiement configuré) renvoie l'URL GeniusPay ; sinon canal manuel
 * (référence MCD- à régler). Honeypot website. */
export async function createPublicDnsOrder(body: {
  email: string;
  phone?: string;
  planId: string;
  payMethod: string;
  website?: string;
}): Promise<PublicDnsOrderCreated> {
  return pubFetch<PublicDnsOrderCreated>("/api/public/dns/order", {
    method: "POST",
    body,
  });
}

/** Statut public minimal par référence (poll de retour de paiement ; le GET
 * finalise côté serveur si le webhook a déjà convergé). */
export async function fetchPublicDnsOrderStatus(ref: string): Promise<PublicDnsOrderStatus> {
  return pubFetch<PublicDnsOrderStatus>(
    `/api/public/dns/order/${encodeURIComponent(ref)}`
  );
}

/** Re-envoi SELF-SERVICE de l'e-mail d'activation (appariement strict
 * e-mail + référence — réponse générique, anti-énumération). */
export async function recoverPublicDnsActivation(
  email: string,
  ref: string,
  website?: string
): Promise<{ ok: boolean; message: string }> {
  return pubFetch<{ ok: boolean; message: string }>("/api/public/dns/recover", {
    method: "POST",
    body: { email, ref, website },
  });
}
