"use client";

// me/page.tsx — N°313 — espace client (phase 1 : fondation honnête) :
// GET /api/tunnel/me (Bearer JWT tunnel) → profil + rappel des commandes
// B2C appariées par e-mail. La gestion des appareils et le renouvellement
// arrivent avec la phase 2 (N°314) — l'espace le DIT, aucun trompe-l'œil.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, LogOut, RefreshCw, Receipt, HardDrive } from "lucide-react";
import { apiFetch, clearToken, getToken, type MeResponse } from "@/lib/api";

const statusLabels: Record<string, { label: string; classes: string }> = {
  pending: { label: "En attente de paiement", classes: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  paid: { label: "Paiement reçu", classes: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  provisioned: { label: "Actif", classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  cancelled: { label: "Annulée", classes: "border-slate-600/40 bg-slate-700/20 text-slate-400" },
  expired: { label: "Expirée", classes: "border-slate-600/40 bg-slate-700/20 text-slate-400" },
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function MePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setMe(await apiFetch<MeResponse>("/api/tunnel/me", { token }));
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Espace indisponible — réessayez");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function logout() {
    clearToken();
    router.replace("/login");
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
              <p className="text-sm font-semibold tracking-tight text-slate-100">MikTunnel</p>
              <p className="text-[11px] text-slate-500">powered by FTech CI</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="hero-glow flex-1">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          {loading && !me && (
            <div className="space-y-4" aria-busy="true" aria-label="Chargement de l'espace">
              <div className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
              <div className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
              {error}
              <button onClick={() => void load()} className="ml-3 font-medium underline underline-offset-2">
                Réessayer
              </button>
            </div>
          )}

          {me && (
            <>
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">
                  Mon espace
                </p>
                <h1 className="mt-1 text-xl font-semibold text-slate-100">{me.client.email}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Client MikTunnel depuis le {formatDate(me.client.createdAt)}
                </p>
              </section>

              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
                    <Receipt className="h-4 w-4 text-emerald-400" aria-hidden />
                    Mes commandes VPN
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

                {me.orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
                    <p className="text-sm text-slate-400">
                      Aucune commande pour cet e-mail. Les achats faits sur la{" "}
                      <a
                        href="https://mikcloud.ftci.fr/vpn"
                        className="font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        vitrine MikCloud VPN
                      </a>{" "}
                      avec cette adresse apparaîtront ici.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {me.orders.map((o) => {
                      const s = statusLabels[o.status] ?? {
                        label: o.status,
                        classes: "border-slate-600/40 bg-slate-700/20 text-slate-300",
                      };
                      return (
                        <li
                          key={o.ref}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
                        >
                          <div>
                            <p className="font-mono text-sm font-medium text-slate-100">{o.ref}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {o.plan} · achetée le {formatDate(o.createdAt)}
                              {o.expiresAt ? ` · jusqu'au ${formatDate(o.expiresAt)}` : ""}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${s.classes}`}
                          >
                            {s.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <HardDrive className="h-4 w-4 text-emerald-400" aria-hidden />
                  Mes appareils — bientôt
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  La gestion de vos configurations (téléphone, ordinateur,
                  routeur), la re-livraison et le renouvellement en un clic
                  arrivent avec la prochaine évolution de cet espace. Vos
                  achets actuels restent utilisables et récupérables sur la
                  vitrine, comme toujours.
                </p>
              </section>
            </>
          )}
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-800/60">
        <div className="mx-auto max-w-4xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          MikTunnel — powered by FTech CI · Tunnels WireGuard hébergés à Marseille
        </div>
      </footer>
    </div>
  );
}
