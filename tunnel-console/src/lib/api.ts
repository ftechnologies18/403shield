// lib/api.ts — N°313 — client API de la console (N°317 : 403Shield Console,
// ex MikTunnel — module backend /api/tunnel/*, hotspot-api). Appel DIRECT
// via NEXT_PUBLIC_API_BASE — le CORS du backend est contrôlé par la whitelist
// ALLOWED_ORIGIN (corsMiddleware, main.go — fail-closed P1 #16) :
// tunnel.ftci.fr y figure depuis N°316 (geste ops-cors-whitelist.yml) ; en
// développement, TUNNEL_DEV_API_PROXY=1 route /api vers localhost:4000.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://api.mikcloud.ftci.fr";

const TOKEN_KEY = "miktunnel_token"; // N°317 — clé historique conservée à
// l'identique : la renommer déconnecterait tous les clients existants.

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  /** N°316 — code machine du backend (ex. "order_pending_exists") quand
   * la réponse en transporte un (writeErrCode) — sinon vide. */
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function readError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json();
    const msg = typeof data?.error === "string" && data.error ? data.error : `Erreur ${res.status}`;
    const code = typeof data?.code === "string" && data.code ? data.code : undefined;
    return new ApiError(res.status, msg, code);
  } catch {
    /* corps non JSON : message générique ci-dessous */
  }
  return new ApiError(res.status, `Erreur ${res.status}`);
}

/** apiFetch — POST JSON public (auth par code) ou GET authentifié (Bearer). */
export async function apiFetch<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Types du module tunnel (contrat handlers_tunnel.go — N°313)
// ---------------------------------------------------------------------------

export interface TunnelClientRef {
  id: string;
  email: string;
  createdAt?: string;
}

export interface VerifyResponse {
  token: string;
  client: TunnelClientRef;
}

export interface TunnelOrder {
  ref: string;
  plan: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  /** N°314 — portfolio complet */
  months?: number;
  amountFcfa?: number;
  payMethod?: string;
  kind?: string;
  renewTargetRef?: string;
  renewable?: boolean;
  revealable?: boolean;
  /** N°315 — famille de formule ("b2c" | "pro") : la console propose les
   * BONNES formules de renouvellement et oriente les Pro vers /pro. */
  family?: string;
}

export interface MeResponse {
  client: { id: string; email: string; createdAt: string; updatedAt: string };
  orders: TunnelOrder[];
  devices?: number;
  scope: string;
}

export interface RevealResponse {
  ref: string;
  conf: string;
  ipv4?: string;
  plan?: string;
  months?: number;
  expiresAt?: string;
}

export interface RenewResponse {
  ref: string;
  targetRef: string;
  status: string;
  amountFcfa: number;
  payMethod: string;
  paymentUrl: string;
  online: boolean;
}

/** N°314 — re-livraison de la conf dans l'espace (POST authentifié). */
export async function tunnelReveal(
  ref: string,
  token: string,
): Promise<RevealResponse> {
  return apiFetch<RevealResponse>(`/api/tunnel/orders/${encodeURIComponent(ref)}/reveal`, {
    method: "POST",
    token,
  });
}

/** N°314 — renouvellement 1-clic (POST authentifié). */
export async function tunnelRenew(
  ref: string,
  token: string,
  body: { planId: string; payMethod: string; phone?: string },
): Promise<RenewResponse> {
  return apiFetch<RenewResponse>(`/api/tunnel/orders/${encodeURIComponent(ref)}/renew`, {
    method: "POST",
    token,
    body,
  });
}

// ---------------------------------------------------------------------------
// N°315 — ACCÈS PRO + LAN ÉTENDU (contrat handlers_tunnel_pro.go — design D-B1)
// ---------------------------------------------------------------------------

export interface ProPlan {
  id: string;
  label: string;
  periodLabel: string;
  months: number;
  baseFcfa: number;
}

export interface ProRouter {
  id: string;
  name: string;
  mode: string;
  online: boolean;
  wgState?: string;
  wgLan?: string;
  lanApplied?: boolean;
  lanDetect?: {
    state: string;
    lan?: string;
    iface?: string;
    valid?: boolean;
  };
  lanRuleState?: string;
}

export interface ProOrderRef {
  ref: string;
  plan: string;
  months: number;
  expiresAt: string;
  peerIpv4: string;
}

export interface ProStatusResponse {
  email: string;
  eligible: boolean;
  scope: string;
  account?: { id: string; name: string };
  routers: ProRouter[];
  proOrders: ProOrderRef[];
  anyActive: boolean;
  plans: ProPlan[];
}

export interface ProLanPollResponse {
  state: string;
  wgLan?: string;
  lanApplied?: boolean;
  agentOnline?: boolean;
  lan?: string;
  iface?: string;
  valid?: boolean;
  message?: string;
}

export interface ProLanApplyResponse {
  applied?: boolean;
  needPro?: boolean;
  queued?: boolean;
  lan?: string;
  peers?: string[];
  message?: string;
}

export interface ProOrderResponse {
  ref: string;
  status: string;
  amountFcfa: number;
  payMethod: string;
  paymentUrl: string;
  online: boolean;
  planId: string;
}

/** N°315 — statut Pro complet (éligibilité, routeurs, LAN, portefeuille). */
export async function tunnelProStatus(token: string): Promise<ProStatusResponse> {
  return apiFetch<ProStatusResponse>("/api/tunnel/pro", { token });
}

/** N°315 — enfile la détection LAN d'un routeur (lecture pure côté routeur). */
export async function tunnelProDetect(
  routerId: string,
  token: string,
): Promise<{ queued?: boolean; already?: boolean; lan?: string; message?: string }> {
  return apiFetch(`/api/tunnel/pro/detect`, { method: "POST", token, body: { routerId } });
}

/** N°315 — poll pur de la détection LAN (la console boucle pendant ≤ 45 s). */
export async function tunnelProLanPoll(
  routerId: string,
  token: string,
): Promise<ProLanPollResponse> {
  return apiFetch<ProLanPollResponse>(
    `/api/tunnel/pro/lan/${encodeURIComponent(routerId)}`,
    { token },
  );
}

/** N°315 — APPLICATION du LAN étendu (briques D-B1 : set-lan VM + règles
 * routeur + extension de la conf des peers Pro). */
export async function tunnelProLanApply(
  routerId: string,
  token: string,
): Promise<ProLanApplyResponse> {
  return apiFetch<ProLanApplyResponse>(
    `/api/tunnel/pro/lan/${encodeURIComponent(routerId)}`,
    { method: "POST", token },
  );
}

/** N°315 — commande Accès Pro (famille pro verrouillée, GeniusPay/manual). */
export async function tunnelProOrder(
  token: string,
  body: { planId: string; payMethod: string; phone?: string },
): Promise<ProOrderResponse> {
  return apiFetch<ProOrderResponse>("/api/tunnel/pro/order", {
    method: "POST",
    token,
    body,
  });
}

// ---------------------------------------------------------------------------
// N°342 — ACCÈS INVITÉ (contrat handlers_tunnel_guests.go) : confs invité
// expirables à périmètre minimal (AllowedIPs = hôte/32 + pin-holes ports),
// TTL 1-72 h, révocation immédiate, balayage 5 min côté backend.
// ---------------------------------------------------------------------------

export interface TunnelGuest {
  id: string;
  label: string;
  hostPeerId: string;
  hostLabel: string;
  hostIp: string;
  ports: string;
  ipv4: string;
  /** État DÉRIVÉ côté backend : "active" | "expired" | "revoked" | "error". */
  state: string;
  expiresAt: string;
  createdAt: string;
  errorMsg?: string;
}

export interface TunnelGuestHost {
  peerId: string;
  label: string;
  ipv4: string;
}

export interface TunnelGuestsResponse {
  guests: TunnelGuest[];
  activeCount: number;
  maxPerAccount: number;
  hosts: TunnelGuestHost[];
  ttlMinHours: number;
  ttlMaxHours: number;
}

export interface TunnelGuestCreateResponse {
  guest?: TunnelGuest;
}

export interface TunnelGuestRevealResponse {
  id: string;
  label: string;
  conf: string;
  ipv4: string;
  hostIp: string;
  ports: string;
  expiresAt: string;
}

/** N°342 — liste des invités + jauge du plafond + hôtes possibles. */
export async function tunnelGuests(token: string): Promise<TunnelGuestsResponse> {
  return apiFetch<TunnelGuestsResponse>("/api/tunnel/pro/guests", { token });
}

/** N°342 — création d'un invité (hôte = appareil Pro actif, ports, TTL). */
export async function tunnelGuestCreate(
  token: string,
  body: { label?: string; hostPeerId: string; ports: string; ttlHours: number },
): Promise<TunnelGuestCreateResponse> {
  return apiFetch<TunnelGuestCreateResponse>("/api/tunnel/pro/guests", {
    method: "POST",
    token,
    body,
  });
}

/** N°342 — re-livraison de la conf invité (QR/copie côté console). */
export async function tunnelGuestReveal(
  id: string,
  token: string,
): Promise<TunnelGuestRevealResponse> {
  return apiFetch<TunnelGuestRevealResponse>(
    `/api/tunnel/pro/guests/${encodeURIComponent(id)}/reveal`,
    { method: "POST", token },
  );
}

/** N°342 — révocation immédiate (le retrait VM suit, balayage en repli). */
export async function tunnelGuestRevoke(
  id: string,
  token: string,
): Promise<{ ok: boolean; state: string }> {
  return apiFetch<{ ok: boolean; state: string }>(
    `/api/tunnel/pro/guests/${encodeURIComponent(id)}/revoke`,
    { method: "POST", token },
  );
}

// ---------------------------------------------------------------------------
// N°316 — VENTE DIRECTE B2C déménagée dans CE foyer (ex mikcloud.ftci.fr/vpn,
// 301 permanent) : contrat /api/public/vpn/* (handlers_public_vpn.go — SANS
// auth, CORS ouvert). Doctrine N°301 préservée : UN seul canal B2C — il
// déménage, il ne se dédouble pas.
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

/** N°316 — catalogue public de la vitrine (formules + montants par moyen). */
export async function fetchPublicVpnOffers(): Promise<PublicVpnOffers> {
  return apiFetch<PublicVpnOffers>("/api/public/vpn/offers");
}

/** N°316 — crée la commande pending et (paiement configuré) renvoie l'URL
 * GeniusPay ; sinon canal manuel (référence MCV- à régler). Honeypot website. */
export async function createPublicVpnOrder(body: {
  email: string;
  phone?: string;
  planId: string;
  payMethod: string;
  website?: string;
}): Promise<PublicVpnOrderCreated> {
  return apiFetch<PublicVpnOrderCreated>("/api/public/vpn/order", {
    method: "POST",
    body,
  });
}

/** N°316 — statut public minimal par référence (poll de retour de paiement ;
 * le GET finalise côté serveur si le webhook a déjà convergé). */
export async function fetchPublicVpnOrderStatus(ref: string): Promise<PublicVpnOrderStatus> {
  return apiFetch<PublicVpnOrderStatus>(
    `/api/public/vpn/order/${encodeURIComponent(ref)}`,
  );
}

/** N°316 — re-livraison SELF-SERVICE de la conf par e-mail (appariement
 * strict e-mail + référence — réponse générique, anti-énumération). */
export async function recoverPublicVpnConf(
  email: string,
  ref: string,
): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>("/api/public/vpn/recover", {
    method: "POST",
    body: { email, ref },
  });
}

