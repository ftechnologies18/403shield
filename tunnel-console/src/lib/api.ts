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
}

export interface MeResponse {
  client: { id: string; email: string; createdAt: string; updatedAt: string };
  orders: TunnelOrder[];
  scope: string;
}
