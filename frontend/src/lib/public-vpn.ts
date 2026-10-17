// public-vpn.ts — N°323 — caisse publique de la vitrine (/checkout) :
// contrat /api/public/vpn/* (backend handlers_public_vpn.go — SANS auth,
// CORS whitelist incluant 403shield.ftci.fr). Porté depuis
// tunnel-console/src/lib/api.ts (N°316) lors du RETOUR de la boutique au
// site marketing — modèle OVH : on commande sur le site, on gère dans le
// manager (console.403shield.ftci.fr). Doctrine N°301 : UN seul canal B2C —
// il déménage, il ne se dédouble pas.
//
// L'acheteur n'a PAS de compte (parcours N°316 inchangé) :
//   1. Catalogue : GET /api/public/vpn/offers — fermé → état « bientôt » ;
//   2. Achat : POST /api/public/vpn/order → redirection GeniusPay
//      (paymentUrl) ou canal « manual » (référence MCV- à régler) ;
//   3. Statut : /checkout?order=MCV-… — poll 5 s du GET
//      /api/public/vpn/order/{ref} (le retour de paiement finalise côté
//      serveur, provisioning auto, l'e-mail de livraison part seul) ;
//   4. Self-service : POST /api/public/vpn/recover (e-mail + réf) — la conf
//      part UNIQUEMENT par e-mail, jamais affichée (anti-énumération).
//
// Honeypot « website » invisible sur les deux POST — rempli = robot : le
// backend part en silence.

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");

export class PublicVpnApiError extends Error {
  status: number;
  /** Code métier éventuel porté par le corps JSON (writeErrCode). */
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function readError(res: Response): Promise<PublicVpnApiError> {
  try {
    const data = await res.json();
    const msg =
      typeof data?.error === "string" && data.error ? data.error : `Erreur ${res.status}`;
    const code = typeof data?.code === "string" && data.code ? data.code : undefined;
    return new PublicVpnApiError(res.status, msg, code);
  } catch {
    /* corps non JSON : message générique ci-dessous */
  }
  return new PublicVpnApiError(res.status, `Erreur ${res.status}`);
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
// Types du contrat public (miroir de handlers_public_vpn.go / tunnel-console)
// ---------------------------------------------------------------------------

export interface PublicVpnOfferPlan {
  id: string;
  label: string;
  periodLabel: string;
  months: number;
  baseFcfa: number;
  waveFcfa?: number;
  cardFcfa?: number;
}

export interface PublicVpnOffers {
  enabled: boolean;
  onlinePayment?: boolean;
  plans: PublicVpnOfferPlan[];
}

export interface PublicVpnOrderCreated {
  ref: string;
  status: string;
  amountFcfa: number;
  payMethod: string;
  paymentUrl: string;
  online: boolean;
}

export interface PublicVpnOrderStatus {
  ref: string;
  status: string;
  months: number;
  planLabel?: string;
  periodLabel?: string;
  expiresAt?: string;
  email?: string;
  ipv4?: string;
}

/** Catalogue public de la caisse (formules + montants par moyen). */
export async function fetchPublicVpnOffers(): Promise<PublicVpnOffers> {
  return pubFetch<PublicVpnOffers>("/api/public/vpn/offers");
}

/** Crée la commande pending et (paiement configuré) renvoie l'URL GeniusPay ;
 * sinon canal manuel (référence MCV- à régler). Honeypot website. */
export async function createPublicVpnOrder(body: {
  email: string;
  phone?: string;
  planId: string;
  payMethod: string;
  website?: string;
}): Promise<PublicVpnOrderCreated> {
  return pubFetch<PublicVpnOrderCreated>("/api/public/vpn/order", {
    method: "POST",
    body,
  });
}

/** Statut public minimal par référence (poll de retour de paiement ; le GET
 * finalise côté serveur si le webhook a déjà convergé). */
export async function fetchPublicVpnOrderStatus(ref: string): Promise<PublicVpnOrderStatus> {
  return pubFetch<PublicVpnOrderStatus>(
    `/api/public/vpn/order/${encodeURIComponent(ref)}`
  );
}

/** Re-livraison SELF-SERVICE de la conf par e-mail (appariement strict
 * e-mail + référence — réponse générique, anti-énumération). */
export async function recoverPublicVpnConf(
  email: string,
  ref: string
): Promise<{ ok: boolean; message: string }> {
  return pubFetch<{ ok: boolean; message: string }>("/api/public/vpn/recover", {
    method: "POST",
    body: { email, ref },
  });
}
