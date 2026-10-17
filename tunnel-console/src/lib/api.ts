// lib/api.ts — N°313 — client API de la console tunnel (module backend
// /api/tunnel/*, hotspot-api). Appel DIRECT via NEXT_PUBLIC_API_BASE (le CORS
// du backend est ouvert à toute origine — corsMiddleware, routes.go) ; en
// développement, TUNNEL_DEV_API_PROXY=1 route /api vers localhost:4000.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://api.mikcloud.ftci.fr";

const TOKEN_KEY = "miktunnel_token";

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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    /* corps non JSON : message générique ci-dessous */
  }
  return `Erreur ${res.status}`;
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
  if (!res.ok) throw new ApiError(res.status, await readError(res));
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
