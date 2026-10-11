"use client";

// Garde d'accès du volet PLATEFORME (N°304) — décision exploitant :
// PAS d'accessibilité publique. Accès UNIQUEMENT via le menu profil de la
// sidebar (admins plateforme). Cette garde vérifie la session locale
// (store zustand persisté) + le rôle admin plateforme AVANT tout rendu de
// contenu ; les pages gated sont en plus noindex.

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogIn, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { useHotspotStore } from "@/lib/hotspot/store";

export function isPlatformRole(role?: string): boolean {
  return role === "admin" || role === "platform_admin";
}

export function PlatformGate({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const token = useHotspotStore((s) => s.token);
  const user = useHotspotStore((s) => s.user);
  const allowed = isPlatformRole(user?.role);

  if (!mounted) {
    return (
      <div className="docs-gate flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden />
          <p className="text-sm">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="docs-gate flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-border/60 bg-card/80 p-6 sm:p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LogIn className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Connexion requise</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Cette section de la documentation est <strong>privée</strong> : elle documente la console
            plateforme (super-admin) et n'est accessible qu'aux administrateurs connectés,
            depuis le menu profil de la barre latérale de la console.
          </p>
          <Button asChild className="mt-5">
            <Link href="/login">Se connecter</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="docs-gate flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-border/60 bg-card/80 p-6 sm:p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Accès réservé</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Les guides de la console plateforme sont réservés aux comptes
            <strong> administrateur de la plateforme</strong>. Votre session actuelle
            ({user?.username ? `@${user.username}` : "courante"}) ne dispose pas de ce rôle.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Les guides d'exploitation (console gérant/propriétaire), eux, restent publics :{" "}
            <Link href="/docs/guides" className="underline-offset-2 hover:underline">
              /docs/guides
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="docs-gate-ok mb-6 flex items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/8 px-4 py-2.5 text-[13px] text-foreground/90">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
        <span>
          Section plateforme (privée) — visible uniquement des administrateurs connectés.
          Point d'entrée unique : menu profil de la sidebar de la console.
        </span>
      </div>
      {children}
    </>
  );
}
