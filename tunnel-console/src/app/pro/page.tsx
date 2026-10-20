"use client";

// pro/page.tsx — N°337 — REFONTE DE L'ACCÈS PRO AU STYLE CONSOLE /app/vpn
// (miroir de la refonte /me N°334-B — consigne propriétaire « la refonte
// de /pro »). L'offre ACCÈS PRO + LAN ÉTENDU (caméras/NAS) de la console
// garde son contrat N°315 intégral — seul l'habillage change :
//
//   - THÈME CLAIR « console » (fond neutre #F5F6F8, cartes blanches,
//     accents émeraude, wordmark aurora) — /pro peint son propre monde
//     (doctrine N°326), le html bascule en clair pendant la visite ;
//   - KPI STAT CARDS (miroir /me + /app/vpn) : routeurs supervisés (dont
//     en ligne) · LAN étendus · accès Pro actifs · prochaine échéance —
//     données RÉELLES du contrat /api/tunnel/pro uniquement (doctrine :
//     aucun faux chiffre) ;
//   - LA MÊME RÉPARATION UX QUE N°334-B : la modale « Voir la
//     configuration » livrait la conf en TEXTE SEUL — elle livre
//     désormais un QR SCANNABLE (qrcode.react, même lib/même version que
//     la console opérateur et que /me, marge de silence incluse) + copie
//     + TÉLÉCHARGEMENT .conf (RouterOS 7 : « import ») + instructions
//     adaptées à l'usage Pro (routeur/NAS — le QR se scanne depuis
//     l'app WireGuard d'un téléphone de secours) ;
//   - modale bottom-sheet mobile + Escape + focus au titre (même confort
//     que /me et la console opérateur) ;
//   - le poll de détection LAN (≤ 45 s), l'APPLICATION explicite (set-lan
//     VM + règles routeur), le portefeuille, la commande Wave/carte
//     GeniusPay (canal manuel en repli) et le bandeau de retour de
//     paiement sont conservés à l'identique.
//
// N°341 — LES DEUX ARGUMENTS EN VITRINE (consigne propriétaire) : le hero
//   dit désormais que la conf s'installe sur TOUT appareil WireGuard (le
//   MikroTik reste la passerelle du site rejoint) ; une grille « Comment ça
//   marche » pose les deux arguments — installation partout (PC, NAS,
//   routeurs tiers) · pair-à-pair privé via Marseille (PC ↔ NAS, PC ↔ PC,
//   sans routeur dans le chemin — hairpin du segment remote, adresses
//   préservées, aucun MASQUERADE) ; le portefeuille rappelle le pair-à-pair
//   dès 2 appareils couverts ; les instructions du reveal couvrent
//   PC/NAS/routeurs tiers avec lien vers les 2 guides publics N°341.
//   Contrat backend N°315 TOUJOURS inchangé — zéro appel nouveau, zéro
//   champ nouveau : de la copie sur des données déjà servies.
//
// N°342 — ACCÈS INVITÉ : nouvelle section « Invités » (contrat
//   /api/tunnel/pro/guests — handlers_tunnel_guests.go) : confs invité
//   EXPIRABLES à périmètre minimal (AllowedIPs = hôte/32 + pin-holes sur
//   les ports déclarés — jamais Internet, jamais un autre appareil), TTL
//   1-72 h choisi à la création, plafond 10 actifs, révocation immédiate,
//   expiration automatique par le balayage backend (5 min). La conf invité
//   se livre par une MODALE DÉDIÉE (QR + copie + .conf — miroir du reveal
//   Pro) et le formulaire ne propose que les appareils Pro ACTIFS du
//   portefeuille comme hôte (source : la liste des hôtes du backend).
//
// Contrat backend (handlers_tunnel_pro.go, N°315 — INCHANGÉ) :
//   GET  /api/tunnel/pro                    → éligibilité + routeurs + LAN + portefeuille
//   POST /api/tunnel/pro/detect             → enfile la détection (lecture pure)
//   GET  /api/tunnel/pro/lan/{routerId}     → poll de la détection (≤ 45 s)
//   POST /api/tunnel/pro/lan/{routerId}     → APPLICATION (set-lan VM + règles routeur)
//   POST /api/tunnel/pro/order              → commande Pro (Wave/carte/manual)
//   POST /api/tunnel/orders/{ref}/reveal    → {ref, conf, ipv4, plan, expiresAt…}
//
// Honnêteté produit : l'Accès Pro relie VOS routeurs supervisés par la
// plateforme 403Shield (compte gérant apparié par e-mail) — sans compte, la
// page le DIT au lieu de vendre un accès qui ne servirait à rien.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  CalendarClock,
  Camera,
  Check,
  Copy,
  CreditCard,
  Download,
  Hourglass,
  Laptop,
  Lightbulb,
  Loader2,
  LogOut,
  Network,
  QrCode,
  RefreshCw,
  Router as RouterIcon,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  clearToken,
  getToken,
  tunnelGuestCreate,
  tunnelGuestReveal,
  tunnelGuestRevoke,
  tunnelGuests,
  tunnelProDetect,
  tunnelProLanApply,
  tunnelProLanPoll,
  tunnelProOrder,
  tunnelProStatus,
  tunnelReveal,
  type ProOrderRef,
  type ProRouter,
  type ProStatusResponse,
  type RevealResponse,
  type TunnelGuest,
  type TunnelGuestRevealResponse,
  type TunnelGuestsResponse,
} from "@/lib/api";

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function daysLeft(iso: string): number | null {
  if (!iso) return null;
  try {
    const ms = new Date(iso).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    return Math.ceil(ms / 86_400_000);
  } catch {
    return null;
  }
}

// N°342 — compte à rebours HORAIRE d'un invité (TTL 1-72 h : le « jours
// restants » du portefeuille serait illisible — l'invité vit en heures).
function hoursLeft(iso: string): number | null {
  if (!iso) return null;
  try {
    const ms = new Date(iso).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    return Math.round(ms / 3_600_000);
  } catch {
    return null;
  }
}

function formatFcfa(n: number): string {
  return n.toLocaleString("fr-FR") + " FCFA";
}

// N°337 — statut LAN d'un routeur, palette CLAIRE (miroir des badges de la
// vue /app/vpn — plus de texte-slate-300 du thème sombre).
function lanLine(r: ProRouter, pollingId: string): { label: string; tone: string } {
  if (r.lanApplied) {
    return {
      label: "LAN étendu : " + (r.wgLan ?? ""),
      tone: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700",
    };
  }
  const d = r.lanDetect;
  if (d?.state === "done" && d.valid) {
    return {
      label: "Réseau détecté : " + (d.lan ?? "") + " — prêt à étendre",
      tone: "border-sky-500/40 bg-sky-500/10 text-sky-700",
    };
  }
  if (d?.state === "done" && !d.valid) {
    return {
      label: "Réseau détecté hors périmètre (" + (d.lan ?? "?") + ") — renumérotez le LAN (ex. 10.10.x)",
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-700",
    };
  }
  if (d?.state === "queued" || d?.state === "sent" || pollingId === r.id) {
    return {
      label: "Détection en cours (≤ 45 s)…",
      tone: "border-slate-300 bg-slate-400/10 text-slate-500",
    };
  }
  if (d?.state === "error") {
    return {
      label: "Détection impossible sur ce routeur",
      tone: "border-red-500/40 bg-red-500/10 text-red-700",
    };
  }
  return {
    label: "Réseau local non détecté",
    tone: "border-slate-300 bg-slate-400/10 text-slate-500",
  };
}

export default function ProPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ProStatusResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [returnOrder, setReturnOrder] = useState("");
  const [notice, setNotice] = useState("");

  // LAN : application + poll par routeur.
  const [busyRouter, setBusyRouter] = useState("");
  const [polling, setPolling] = useState<string>("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Achat.
  const [buyPlan, setBuyPlan] = useState("vpn-pro-month");
  const [buyMethod, setBuyMethod] = useState("wave");
  const [buyPhone, setBuyPhone] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState("");

  // Reveal de la conf d'un appareil Pro.
  const [revealFor, setRevealFor] = useState<ProOrderRef | null>(null);
  const [reveal, setReveal] = useState<RevealResponse | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const confRef = useRef<HTMLDivElement | null>(null);
  const revealHeadRef = useRef<HTMLHeadingElement | null>(null);

  // N°342 — ACCÈS INVITÉ : liste + jauge + hôtes (contrat /guests), création,
  // révocation et reveal dédié (jamais mélangé au reveal d'un appareil Pro —
  // un invité n'est pas un appareil du compte).
  const [guestsData, setGuestsData] = useState<TunnelGuestsResponse | null>(null);
  const [guestsError, setGuestsError] = useState("");
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestBusy, setGuestBusy] = useState("");
  const [guestFormOpen, setGuestFormOpen] = useState(false);
  const [gLabel, setGLabel] = useState("");
  const [gHost, setGHost] = useState("");
  const [gPorts, setGPorts] = useState("");
  const [gTtl, setGTtl] = useState(4);
  const [gLoading, setGLoading] = useState(false);
  const [gError, setGError] = useState("");
  const [guestRevealFor, setGuestRevealFor] = useState<TunnelGuest | null>(null);
  const [guestReveal, setGuestReveal] = useState<TunnelGuestRevealResponse | null>(null);
  const [guestRevealLoading, setGuestRevealLoading] = useState(false);
  const [guestRevealError, setGuestRevealError] = useState("");
  const [gCopied, setGCopied] = useState(false);
  const [gDownloaded, setGDownloaded] = useState(false);
  const gConfRef = useRef<HTMLDivElement | null>(null);
  const guestRevealHeadRef = useRef<HTMLHeadingElement | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setStatus(await tunnelProStatus(token));
    } catch (err) {
      const code = (err as { status?: number }).status;
      if (code === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Offre indisponible — réessayez");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("order");
    if (ref) {
      setReturnOrder(ref);
      window.history.replaceState({}, "", window.location.pathname);
    }
    void load();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [load]);

  // N°337 — Escape ferme la modale reveal (clavier, même confort que /me
  // N°334-B et la console opérateur) ; le focus part sur le titre.
  useEffect(() => {
    if (!revealFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRevealFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealFor]);

  useEffect(() => {
    if (revealFor) {
      // Le rendu suivant existe : donner le focus au titre (lecteur d'écran).
      requestAnimationFrame(() => revealHeadRef.current?.focus());
    }
  }, [revealFor]);

  // N°342 — Invités : chargement quand un Accès Pro est actif (la section
  // ne s'affiche que dans ce cas — l'hôte d'un invité EST un appareil Pro).
  const loadGuests = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setGuestsLoading(true);
    try {
      setGuestsData(await tunnelGuests(token));
      setGuestsError("");
    } catch (err) {
      const code = (err as { status?: number }).status;
      if (code === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setGuestsError(err instanceof Error ? err.message : "Invités indisponibles — réessayez");
    } finally {
      setGuestsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status?.anyActive) void loadGuests();
  }, [status, loadGuests]);

  // N°342 — Escape + focus de la modale invité (même confort que le reveal Pro).
  useEffect(() => {
    if (!guestRevealFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGuestRevealFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guestRevealFor]);

  useEffect(() => {
    if (guestRevealFor) {
      requestAnimationFrame(() => guestRevealHeadRef.current?.focus());
    }
  }, [guestRevealFor]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  // Poll de la détection LAN : boucle jusqu'à convergence (done|error), puis
  // recharge le statut — l'APPLICATION reste un geste explicite (POST).
  function startPolling(routerId: string) {
    if (pollTimer.current) clearInterval(pollTimer.current);
    setPolling(routerId);
    pollTimer.current = setInterval(async () => {
      const token = getToken();
      if (!token) return;
      try {
        const out = await tunnelProLanPoll(routerId, token);
        if (out.state === "done" || out.state === "error" || out.lanApplied) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setPolling("");
          void load();
        }
      } catch {
        /* réseau passager : le prochain tick retentera */
      }
    }, 4000);
  }

  async function askDetect(r: ProRouter) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setBusyRouter(r.id);
    setError("");
    try {
      await tunnelProDetect(r.id, token);
      startPolling(r.id);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Détection impossible — réessayez");
    } finally {
      setBusyRouter("");
    }
  }

  async function applyLan(r: ProRouter) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setBusyRouter(r.id);
    setError("");
    setNotice("");
    try {
      const out = await tunnelProLanApply(r.id, token);
      if (out.queued) {
        setNotice("Détection LAN enfilée — convergence de l'agent en cours (≤ 45 s), la page se rafraîchira.");
      } else if (out.needPro) {
        setNotice(
          "Sous-réseau détecté : " + (out.lan ?? "?") + ". Souscrivez l'Accès Pro ci-dessous pour l'étendre au tunnel.",
        );
      } else if (out.applied) {
        setNotice(
          "LAN " + (out.lan ?? "") + " étendu vers vos appareils Pro (" +
            (out.peers ?? []).join(", ") +
            "). Récupérez la configuration mise à jour (bouton « Voir la configuration ») et réimportez-la dans WireGuard.",
        );
      }
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extension impossible — réessayez");
    } finally {
      setBusyRouter("");
    }
  }

  async function submitBuy() {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (buyMethod === "wave" && buyPhone.replace(/\D/g, "").length < 8) {
      setBuyError("Un numéro de téléphone valide est requis pour payer par Wave.");
      return;
    }
    setBuyLoading(true);
    setBuyError("");
    setNotice("");
    try {
      const out = await tunnelProOrder(token, {
        planId: buyPlan,
        payMethod: buyMethod,
        phone: buyPhone || undefined,
      });
      if (out.paymentUrl) {
        window.location.href = out.paymentUrl;
        return;
      }
      setNotice(
        "Commande " + out.ref + " enregistrée (" + formatFcfa(out.amountFcfa) +
          ", canal manuel). La plateforme confirmera votre paiement — votre accès Pro sera provisionné automatiquement.",
      );
      void load();
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Souscription impossible — réessayez");
    } finally {
      setBuyLoading(false);
    }
  }

  async function openReveal(o: ProOrderRef) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setRevealFor(o);
    setReveal(null);
    setRevealError("");
    setCopied(false);
    setDownloaded(false);
    setRevealLoading(true);
    try {
      setReveal(await tunnelReveal(o.ref, token));
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : "Configuration indisponible — réessayez");
    } finally {
      setRevealLoading(false);
    }
  }

  async function copyConf() {
    if (!reveal?.conf) return;
    try {
      await navigator.clipboard.writeText(reveal.conf);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Repli : sélection manuelle du bloc affiché.
      const range = document.createRange();
      if (confRef.current) {
        range.selectNodeContents(confRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  // N°337 — téléchargement .conf : la voie d'import officielle de RouterOS 7
  // (l'import de tunnel WireGuard se fait par fichier — un routeur n'a pas
  // de caméra ; le QR reste pour le téléphone de secours, miroir N°334-B).
  function downloadConf() {
    if (!reveal?.conf) return;
    const name = `403shield-pro-${reveal.ref || revealFor?.ref || "acces"}.conf`;
    const blob = new Blob([reveal.conf], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  // ---- N°342 — Accès Invité : création, reveal, révocation ----

  // TTL proposés (tous dans les bornes backend 1-72 h) : du partage d'une
  // soirée au long week-end LAN.
  const guestTtlChoices = [1, 2, 4, 8, 12, 24, 48, 72];

  async function submitGuest() {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const host = gHost || guestsData?.hosts[0]?.peerId || "";
    if (!host) {
      setGError("Choisissez l'appareil Pro qui accueillera l'invité.");
      return;
    }
    const ports = gPorts.replace(/\s/g, "");
    if (!/^\d{1,5}(,\d{1,5}){0,5}$/.test(ports)) {
      setGError("Ports invalides : 1 à 6 ports séparés par des virgules (ex. 25565 ou 3000,80,443).");
      return;
    }
    setGLoading(true);
    setGError("");
    try {
      const out = await tunnelGuestCreate(token, {
        label: gLabel || undefined,
        hostPeerId: host,
        ports,
        ttlHours: gTtl,
      });
      if (!out.guest) {
        // Honeypot backend : succès factice — rien à afficher.
        setGuestFormOpen(false);
        return;
      }
      setGuestFormOpen(false);
      setGLabel("");
      setGPorts("");
      setGTtl(4);
      setNotice(
        "Invité « " + out.guest.label + " » créé — remettez-lui la configuration " +
          "(bouton « Voir la conf ») : elle joint uniquement " + out.guest.hostIp +
          " sur les ports " + out.guest.ports + ", jusqu'à expiration.",
      );
      void loadGuests();
    } catch (err) {
      setGError(err instanceof Error ? err.message : "Création impossible — réessayez");
    } finally {
      setGLoading(false);
    }
  }

  async function openGuestReveal(g: TunnelGuest) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setGuestRevealFor(g);
    setGuestReveal(null);
    setGuestRevealError("");
    setGCopied(false);
    setGDownloaded(false);
    setGuestRevealLoading(true);
    try {
      setGuestReveal(await tunnelGuestReveal(g.id, token));
    } catch (err) {
      setGuestRevealError(err instanceof Error ? err.message : "Configuration indisponible — réessayez");
    } finally {
      setGuestRevealLoading(false);
    }
  }

  async function revokeGuest(g: TunnelGuest) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!window.confirm("Révoquer l'invité « " + g.label + " » ? Sa configuration cessera de fonctionner immédiatement.")) {
      return;
    }
    setGuestBusy(g.id);
    setGError("");
    try {
      await tunnelGuestRevoke(g.id, token);
      setNotice("Invité « " + g.label + " » révoqué — sa conf est morte.");
      void loadGuests();
    } catch (err) {
      setGError(err instanceof Error ? err.message : "Révocation impossible — réessayez");
    } finally {
      setGuestBusy("");
    }
  }

  async function copyGuestConf() {
    if (!guestReveal?.conf) return;
    try {
      await navigator.clipboard.writeText(guestReveal.conf);
      setGCopied(true);
      setTimeout(() => setGCopied(false), 2000);
    } catch {
      const range = document.createRange();
      if (gConfRef.current) {
        range.selectNodeContents(gConfRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  function downloadGuestConf() {
    if (!guestReveal?.conf) return;
    const name = `403shield-invite-${guestReveal.ipv4 || "acces"}.conf`;
    const blob = new Blob([guestReveal.conf], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setGDownloaded(true);
    setTimeout(() => setGDownloaded(false), 2000);
  }

  // — KPI dérivés du SEUL contrat /api/tunnel/pro (doctrine : aucun faux
  // chiffre — rien n'est inventé, tout se relit sur le statut) —
  const routersTotal = status?.routers.length ?? 0;
  const routersOnline = status?.routers.filter((r) => r.online).length ?? 0;
  const lanExtended = status?.routers.filter((r) => r.lanApplied).length ?? 0;
  const activePro =
    status?.proOrders.filter((o) => {
      const left = daysLeft(o.expiresAt);
      return left !== null && left >= 0;
    }) ?? [];
  const nextExpiry = activePro.map((o) => o.expiresAt).sort()[0];

  return (
    <div className="mkpro-page flex min-h-screen flex-col bg-[#f5f6f8] text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="403Shield" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <div className="flex flex-wrap items-center gap-2 leading-tight">
              <p className="mkpro-aurora text-base font-bold tracking-tight">403Shield</p>
              <span className="rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Accès Pro
              </span>
              <p className="hidden text-[11px] text-slate-500 sm:block">powered by FTech CI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status?.email && (
              <p className="hidden max-w-48 truncate text-xs text-slate-500 md:block" title={status.email}>
                {status.email}
              </p>
            )}
            <a
              href="/me"
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Mon espace
            </a>
            <button
              onClick={logout}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          {returnOrder && (
            <div
              role="status"
              className="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-800"
            >
              <p className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                Paiement de la commande {returnOrder}
              </p>
              <p className="mt-1 text-sky-700/80">
                Si votre paiement est confirmé, votre Accès Pro apparaît ci-dessous — sinon
                dans quelques instants. En cas de doute, rafraîchissez.
              </p>
              <button
                onClick={() => void load()}
                className="mt-2 font-semibold underline underline-offset-2"
              >
                Rafraîchir maintenant
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-6 rounded-2xl border border-emerald-600/40 bg-emerald-500/10 p-4 text-sm text-emerald-800"
            >
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700">
              {error}
              <button onClick={() => void load()} className="ml-3 font-semibold underline underline-offset-2">
                Réessayer
              </button>
            </div>
          )}

          {loading && !status && (
            <div className="space-y-4" aria-busy="true" aria-label="Chargement de l'offre">
              <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                ))}
              </div>
              <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            </div>
          )}

          {status && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Accès Pro</p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  Vos routeurs, vos caméras, vos NAS — dans un seul tunnel chiffré
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  L&apos;Accès Pro pose un tunnel WireGuard depuis votre téléphone ou votre
                  ordinateur vers votre réseau : supervision de vos routeurs MikroTik (Winbox,
                  API, SSH, web){" "}
                  <strong className="font-semibold text-slate-800">et extension vers votre réseau local</strong>{" "}
                  — caméras, NAS, imprimantes — où que vous soyez, même derrière le CGNAT.
                  La configuration est du WireGuard standard : elle s&apos;installe sur tout
                  appareil — PC, téléphone, NAS, autre routeur — le MikroTik restant la
                  passerelle du site rejoint.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Périmètre honnête : le tunnel ne route NI votre navigation Internet, NI votre
                  DNS — uniquement vos équipements, rien de plus.
                </p>
              </section>

              {/* N°341 — LES DEUX ARGUMENTS en vitrine : la conf s'installe sur
                  tout appareil WireGuard (le MikroTik = passerelle du site
                  rejoint), et le pair-à-pair privé relie vos appareils Pro via
                  Marseille (hairpin du segment remote — PC ↔ NAS, PC ↔ PC,
                  sans routeur dans le chemin). N°342 — TROISIÈME argument :
                  l'Accès Invité partage un accès expirable à périmètre minimal
                  (un hôte, des ports, un terme). Données réelles du contrat
                  N°315/N°342, aucun chiffre inventé — liens vers les guides
                  publics. */}
              <section aria-label="Comment ça marche" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Laptop className="h-4 w-4 text-emerald-600" aria-hidden />
                    S&apos;installe sur tout appareil WireGuard
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    PC, téléphone (QR), NAS, autre routeur — un seul fichier de configuration.
                    Le MikroTik reste la passerelle du site rejoint : détection LAN,
                    supervision, règles du LAN étendu.
                  </p>
                  <a
                    href="https://403shield.ftci.fr/docs/guides/acces-pro-multi-appareils"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                  >
                    Le guide d&apos;installation
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ArrowLeftRight className="h-4 w-4 text-emerald-600" aria-hidden />
                    Pair-à-pair privé via Marseille
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Vos appareils Pro se rejoignent en privé — PC ↔ NAS, PC ↔ PC — sans
                    routeur dans le chemin et sans port publié : chacun joint l&apos;autre à son
                    adresse tunnel.
                  </p>
                  <a
                    href="https://403shield.ftci.fr/docs/guides/acces-pro-pair-a-pair"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                  >
                    Le guide pair-à-pair
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>
                {/* N°342 — le partage sans exposer : invités expirables. */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Users className="h-4 w-4 text-emerald-600" aria-hidden />
                    Invités expirables — partagez sans exposer
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Un serveur de jeu avec des amis, une démo web à un client : l&apos;invité
                    reçoit sa propre conf — un seul appareil, des ports déclarés, un terme
                    qui arrive seul. Jamais la vôtre, jamais Internet.
                  </p>
                  <a
                    href="https://403shield.ftci.fr/docs/guides/acces-invite"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                  >
                    Le guide Accès Invité
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>
              </section>

              {!status.eligible ? (
                <section className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-800">
                  <p className="flex items-center gap-2 font-semibold">
                    <Lightbulb className="h-4 w-4 shrink-0" aria-hidden />
                    L&apos;Accès Pro relie VOS routeurs supervisés par 403Shield
                  </p>
                  <p className="mt-2 text-amber-800/80">
                    Connectez-vous avec l&apos;<strong>e-mail de votre compte gérant 403Shield</strong>{" "}
                    (celui utilisé à l&apos;inscription, avec au moins un routeur en mode agent).
                    Pas encore de compte ?{" "}
                    <a
                      href="https://403shield.ftci.fr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline underline-offset-2 hover:text-amber-900"
                    >
                      Découvrez 403Shield
                    </a>{" "}
                    — puis revenez ici : vos routeurs apparaîtront automatiquement.
                  </p>
                  <p className="mt-2 text-amber-800/60">
                    Vous cherchez un VPN pour votre téléphone ?{" "}
                    <a
                      href="https://403shield.ftci.fr/checkout"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-amber-900"
                    >
                      La boutique 403Shield
                    </a>{" "}
                    est faite pour ça.
                  </p>
                </section>
              ) : (
                <>
                  {/* KPI — miroir de la vue /app/vpn et de /me N°334-B : que du
                      réel, dérivé du statut (aucun faux chiffre). */}
                  <section aria-label="Aperçu de l'Accès Pro" className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <RouterIcon className="h-4 w-4 text-emerald-600" aria-hidden />
                        Routeurs supervisés
                      </div>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {routersTotal}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        dont {routersOnline} en ligne
                        {status.account ? ` · ${status.account.name}` : ""}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Network
                          className={`h-4 w-4 ${lanExtended > 0 ? "text-emerald-600" : "text-slate-400"}`}
                          aria-hidden
                        />
                        LAN étendus
                      </div>
                      <p
                        className={`mt-1 text-2xl font-bold tabular-nums ${
                          lanExtended > 0 ? "text-emerald-700" : "text-slate-900"
                        }`}
                      >
                        {lanExtended}
                        <span className="ml-1 text-sm font-normal text-slate-500">/ {routersTotal}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">sous-réseaux routés dans le tunnel</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                        Accès Pro actifs
                      </div>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {activePro.length}
                        <span className="ml-1 text-sm font-normal text-slate-500">
                          / {status.proOrders.length} cmd
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">appareils couverts par l&apos;offre</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <CalendarClock
                          className={`h-4 w-4 ${activePro.length > 0 ? "text-amber-500" : "text-slate-400"}`}
                          aria-hidden
                        />
                        Prochaine échéance
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {nextExpiry ? formatDate(nextExpiry) : "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {nextExpiry
                          ? `${daysLeft(nextExpiry) ?? "—"} jour(s) restant(s)`
                          : "aucun accès actif à échéance"}
                      </p>
                    </div>
                  </section>

                  {/* ---- Routeurs + LAN étendu ---- */}
                  <section className="mt-8" aria-label="Vos routeurs">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                        <RouterIcon className="h-4 w-4 text-emerald-600" aria-hidden />
                        Vos routeurs ({status.routers.length})
                        {status.account && (
                          <span className="text-xs font-normal text-slate-500">· {status.account.name}</span>
                        )}
                      </h2>
                      <button
                        onClick={() => void load()}
                        disabled={loading}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
                        Rafraîchir
                      </button>
                    </div>
                    <ul className="space-y-3">
                      {status.routers.map((r) => {
                        const lan = lanLine(r, polling);
                        const detectBusy = busyRouter === r.id || polling === r.id;
                        const isAgent = r.mode === "agent";
                        return (
                          <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                  <span
                                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                                      r.online ? "bg-emerald-500" : "bg-slate-300"
                                    }`}
                                    aria-hidden
                                  />
                                  {r.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  mode {r.mode}
                                  {r.wgState ? ` · tunnel ${r.wgState}` : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {isAgent && !r.lanApplied && (
                                  <button
                                    onClick={() => void askDetect(r)}
                                    disabled={detectBusy}
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                  >
                                    {detectBusy ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                    ) : (
                                      <Network className="h-3.5 w-3.5" aria-hidden />
                                    )}
                                    Détecter mon réseau
                                  </button>
                                )}
                                {isAgent && !r.lanApplied && r.lanDetect?.state === "done" && r.lanDetect.valid && (
                                  <button
                                    onClick={() => void applyLan(r)}
                                    disabled={detectBusy}
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                  >
                                    <Camera className="h-3.5 w-3.5" aria-hidden />
                                    Étendre au LAN
                                  </button>
                                )}
                                {isAgent && r.lanApplied && (
                                  <button
                                    onClick={() => void applyLan(r)}
                                    disabled={detectBusy}
                                    title="Re-apply l'extension (idempotent — rafraîchit les règles)"
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                                    Re-apply
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${lan.tone}`}>
                                {lan.label}
                              </span>
                              {r.lanApplied && r.lanRuleState && r.lanRuleState !== "none" && r.lanRuleState !== "done" && (
                                <span className="text-xs text-slate-500">
                                  règles routeur : {r.lanRuleState} (≤ 45 s)
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  {/* ---- Portefeuille Pro / achat ---- */}
                  <section className="mt-8" aria-label="Vos accès Pro">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                        {status.anyActive ? "Vos accès Pro" : "Souscrire l'Accès Pro"}
                      </h2>
                    </div>

                    {status.anyActive ? (
                      <ul className="space-y-3">
                        {status.proOrders.map((o) => {
                          const left = daysLeft(o.expiresAt);
                          return (
                            <li key={o.ref} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-mono text-sm font-semibold text-slate-900">{o.ref}</p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {o.plan} · adresse tunnel {o.peerIpv4}
                                  </p>
                                  {o.expiresAt && (
                                    <p
                                      className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${
                                        left !== null && left <= 7 && left >= 0
                                          ? "text-amber-600"
                                          : left !== null && left < 0
                                            ? "text-slate-400"
                                            : "text-slate-500"
                                      }`}
                                    >
                                      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      {left !== null && left >= 0
                                        ? `Couvert jusqu'au ${formatDate(o.expiresAt)} — ${left} jour${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}`
                                        : `Terme atteint le ${formatDate(o.expiresAt)}`}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => void openReveal(o)}
                                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                >
                                  <QrCode className="h-3.5 w-3.5" aria-hidden />
                                  Voir la configuration
                                </button>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                Le renouvellement se fait depuis{" "}
                                <a href="/me" className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
                                  votre espace
                                </a>{" "}
                                (bouton « Renouveler » sur la commande {o.ref}).
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <fieldset>
                          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Formule
                          </legend>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            {status.plans.map((p) => (
                              <label
                                key={p.id}
                                className={`min-h-11 cursor-pointer rounded-xl border p-4 transition ${
                                  buyPlan === p.id
                                    ? "border-emerald-600 bg-emerald-500/10"
                                    : "border-slate-300 bg-white hover:border-slate-400"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="pro-plan"
                                  value={p.id}
                                  checked={buyPlan === p.id}
                                  onChange={() => setBuyPlan(p.id)}
                                  className="sr-only"
                                />
                                <p className="text-sm font-semibold text-slate-900">{p.periodLabel}</p>
                                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700">
                                  {formatFcfa(p.baseFcfa)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{p.label}</p>
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <fieldset className="mt-4">
                          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Moyen de paiement
                          </legend>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setBuyMethod("wave")}
                              aria-pressed={buyMethod === "wave"}
                              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                                buyMethod === "wave"
                                  ? "border-emerald-600 bg-emerald-500/10 text-slate-900"
                                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                              }`}
                            >
                              <Smartphone className="h-4 w-4" aria-hidden />
                              Wave
                            </button>
                            <button
                              type="button"
                              onClick={() => setBuyMethod("card")}
                              aria-pressed={buyMethod === "card"}
                              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                                buyMethod === "card"
                                  ? "border-emerald-600 bg-emerald-500/10 text-slate-900"
                                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                              }`}
                            >
                              <CreditCard className="h-4 w-4" aria-hidden />
                              Carte bancaire
                            </button>
                          </div>
                          {buyMethod === "wave" && (
                            <div className="mt-3">
                              <label htmlFor="pro-phone" className="text-xs font-medium text-slate-600">
                                Numéro Wave à débiter
                              </label>
                              <input
                                id="pro-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={buyPhone}
                                onChange={(e) => setBuyPhone(e.target.value)}
                                placeholder="07 00 00 00 00"
                                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600/40"
                              />
                            </div>
                          )}
                        </fieldset>

                        {buyError && (
                          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                            {buyError}
                          </div>
                        )}

                        <button
                          onClick={() => void submitBuy()}
                          disabled={buyLoading}
                          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                        >
                          {buyLoading ? "Création du paiement…" : "Souscrire l'Accès Pro"}
                        </button>
                        <p className="mt-3 text-xs leading-relaxed text-slate-500">
                          Sans clés de paiement en ligne, la commande passera en canal manuel
                          (confirmation par la plateforme — traçable). Le provisioning est
                          automatique dès confirmation : configuration livrée par e-mail et
                          récupérable ici à tout moment.
                        </p>
                      </div>
                    )}

                    {/* N°341 — rappel pair-à-pair dès 2 appareils couverts :
                        chacun joint les autres à son adresse tunnel (hairpin
                        Marseille, adresses préservées) — données du contrat
                        N°315, aucun chiffre inventé. */}
                    {status.anyActive && status.proOrders.length > 1 && (
                      <p className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-600/30 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-800">
                        <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        Pair-à-pair privé : ces {status.proOrders.length} appareils se joignent
                        entre eux par leurs adresses tunnel — fichiers, prise de main, serveur
                        entre vos machines (guide dans «&nbsp;Comment ça marche&nbsp;» ci-dessus).
                      </p>
                    )}
                  </section>

                  {/* ---- N°342 — INVITÉS (Accès Invité) : confs expirables à
                      périmètre minimal pour UN tiers — serveur de jeu avec
                      des amis, démo web à un client. Données réelles du
                      contrat /api/tunnel/pro/guests uniquement. ---- */}
                  {status.anyActive && (
                    <section className="mt-8" aria-label="Invités">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="flex flex-wrap items-center gap-2 text-base font-bold tracking-tight text-slate-900">
                          <Users className="h-4 w-4 text-emerald-600" aria-hidden />
                          Invités
                          {guestsData && (
                            <span className="text-xs font-normal text-slate-500">
                              {guestsData.activeCount}/{guestsData.maxPerAccount} actif{guestsData.activeCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </h2>
                        <button
                          onClick={() => setGuestFormOpen((v) => !v)}
                          aria-expanded={guestFormOpen}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                        >
                          <UserPlus className="h-3.5 w-3.5" aria-hidden />
                          {guestFormOpen ? "Fermer le formulaire" : "Inviter quelqu'un"}
                        </button>
                      </div>

                      <p className="mb-4 text-sm leading-relaxed text-slate-600">
                        Offrez à un tiers un accès <strong className="font-semibold text-slate-800">expirable</strong>{" "}
                        à <strong className="font-semibold text-slate-800">un seul</strong> de vos appareils Pro : un
                        serveur de jeu avec des amis, une démo web à un client. L&apos;invité ne voit
                        NI Internet, NI vos autres appareils — uniquement l&apos;hôte choisi, sur les
                        ports déclarés — et l&apos;accès meurt seul au terme (1 à 72 h).
                      </p>

                      {guestsError && (
                        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
                          {guestsError}{" "}
                          <button onClick={() => void loadGuests()} className="font-semibold underline underline-offset-2">
                            Réessayer
                          </button>
                        </div>
                      )}
                      {guestsLoading && !guestsData && (
                        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-busy="true" />
                      )}

                      {guestsData && (
                        <>
                          {guestFormOpen && (
                            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <fieldset>
                                <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                  Nouvel invité
                                </legend>
                                <div className="mt-2">
                                  <label htmlFor="guest-label" className="text-xs font-medium text-slate-600">
                                    Nom de l&apos;invité (optionnel — pour vous repérer)
                                  </label>
                                  <input
                                    id="guest-label"
                                    type="text"
                                    value={gLabel}
                                    onChange={(e) => setGLabel(e.target.value)}
                                    placeholder="Ami du samedi, client Alpha…"
                                    maxLength={48}
                                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600/40"
                                  />
                                </div>
                                <div className="mt-3">
                                  <label htmlFor="guest-host" className="text-xs font-medium text-slate-600">
                                    Appareil hôte (ce que l&apos;invité pourra joindre)
                                  </label>
                                  <select
                                    id="guest-host"
                                    value={gHost || guestsData.hosts[0]?.peerId || ""}
                                    onChange={(e) => setGHost(e.target.value)}
                                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600/40"
                                  >
                                    {guestsData.hosts.length === 0 && (
                                      <option value="">Aucun appareil Pro actif</option>
                                    )}
                                    {guestsData.hosts.map((h) => (
                                      <option key={h.peerId} value={h.peerId}>
                                        {h.label} · {h.ipv4}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="mt-3">
                                  <label htmlFor="guest-ports" className="text-xs font-medium text-slate-600">
                                    Ports ouverts vers l&apos;hôte (TCP + UDP, 1 à 6)
                                  </label>
                                  <input
                                    id="guest-ports"
                                    type="text"
                                    inputMode="numeric"
                                    value={gPorts}
                                    onChange={(e) => setGPorts(e.target.value)}
                                    placeholder="25565 (Minecraft) · 3000,80,443 (démo web)"
                                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-600 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600/40"
                                  />
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    Séparez par des virgules — ex. 25565 ou 3000,80,443.
                                  </p>
                                </div>
                                <div className="mt-3">
                                  <label htmlFor="guest-ttl" className="text-xs font-medium text-slate-600">
                                    Durée de vie de l&apos;accès
                                  </label>
                                  <select
                                    id="guest-ttl"
                                    value={gTtl}
                                    onChange={(e) => setGTtl(Number(e.target.value))}
                                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-600/40"
                                  >
                                    {guestTtlChoices.map((h) => (
                                      <option key={h} value={h}>
                                        {h} heure{h > 1 ? "s" : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    À l&apos;échéance, la conf de l&apos;invité cesse de fonctionner — sans geste de personne.
                                  </p>
                                </div>
                              </fieldset>

                              {gError && (
                                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                                  {gError}
                                </div>
                              )}

                              <button
                                onClick={() => void submitGuest()}
                                disabled={gLoading || guestsData.hosts.length === 0}
                                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                              >
                                {gLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
                                {gLoading ? "Création de l'invité…" : "Créer l'invité"}
                              </button>
                            </div>
                          )}

                          {guestsData.guests.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm text-slate-500">
                              Aucun invité pour l&apos;instant — « Inviter quelqu&apos;un » crée un accès
                              temporaire à périmètre minimal (jamais votre propre conf : un invité
                              a la sienne, qui meurt au terme).
                            </p>
                          ) : (
                            <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                              {guestsData.guests.map((g) => {
                                const left = hoursLeft(g.expiresAt);
                                const alive = g.state === "active";
                                return (
                                  <li key={g.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                                          {g.label}
                                          <span
                                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                              g.state === "active"
                                                ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-700"
                                                : g.state === "expired"
                                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                                                  : g.state === "error"
                                                    ? "border-red-500/40 bg-red-500/10 text-red-700"
                                                    : "border-slate-300 bg-slate-400/10 text-slate-500"
                                            }`}
                                          >
                                            {g.state === "active"
                                              ? "actif"
                                              : g.state === "expired"
                                                ? "échu"
                                                : g.state === "error"
                                                  ? "erreur"
                                                  : "révoqué"}
                                          </span>
                                        </p>
                                        <p className="mt-0.5 text-xs text-slate-500">
                                          hôte {g.hostLabel || g.hostIp} · ports {g.ports}
                                        </p>
                                        {g.expiresAt && (
                                          <p
                                            className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${
                                              alive && left !== null && left <= 1
                                                ? "text-amber-600"
                                                : alive
                                                  ? "text-slate-500"
                                                  : "text-slate-400"
                                            }`}
                                          >
                                            <Hourglass className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                            {alive
                                              ? left !== null && left >= 0
                                                ? `expire dans ${left} h (${formatDate(g.expiresAt)})`
                                                : "à terme — fermeture automatique en cours"
                                              : "accès clos"}
                                          </p>
                                        )}
                                        {g.errorMsg && (
                                          <p className="mt-1 text-xs text-red-600">{g.errorMsg}</p>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {alive && (
                                          <button
                                            onClick={() => void openGuestReveal(g)}
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                          >
                                            <QrCode className="h-3.5 w-3.5" aria-hidden />
                                            Voir la conf
                                          </button>
                                        )}
                                        {(alive || g.state === "error") && (
                                          <button
                                            onClick={() => void revokeGuest(g)}
                                            disabled={guestBusy === g.id}
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-700 transition hover:border-red-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                                          >
                                            {guestBusy === g.id ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                            ) : (
                                              <Ban className="h-3.5 w-3.5" aria-hidden />
                                            )}
                                            Révoquer
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}

                          <p className="mt-3 text-xs leading-relaxed text-slate-500">
                            Doctrine 1 conf = 1 appareil : ne partagez JAMAIS votre propre conf
                            Pro — créez un invité (clés dédiées, périmètre minimal, expiration).
                           {" "}
                            <a
                              href="https://403shield.ftci.fr/docs/guides/acces-invite"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                            >
                              Le guide « Accès Invité »
                            </a>{" "}
                            détaille le fonctionnement.
                          </p>
                        </>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200/80 bg-white/60">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <p>403Shield Console · powered by FTech CI · Accès Pro : tunnels WireGuard hébergés à Marseille</p>
          <div className="flex gap-4">
            <a
              href="https://403shield.ftci.fr/checkout"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-700"
            >
              Boutique VPN
            </a>
            <a
              href="https://403shield.ftci.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-700"
            >
              Site 403Shield
            </a>
          </div>
        </div>
      </footer>

      {/* ---- Modal reveal (conf WireGuard d'un appareil Pro) ---- */}
      {revealFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Configuration WireGuard"
          onClick={() => setRevealFor(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  ref={revealHeadRef}
                  tabIndex={-1}
                  className="text-base font-bold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Configuration WireGuard — {revealFor.ref}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {reveal?.plan ?? revealFor.plan}
                  {reveal?.ipv4 ? ` · tunnel ${reveal.ipv4}` : ""}
                  {reveal?.expiresAt ? ` · jusqu'au ${formatDate(reveal.expiresAt)}` : ""}
                </p>
              </div>
              <button
                onClick={() => setRevealFor(null)}
                aria-label="Fermer"
                className="rounded-xl border border-slate-300 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {revealLoading && (
              <div className="mt-4 h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100/70" aria-busy="true" />
            )}
            {revealError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
                {revealError}
              </div>
            )}
            {reveal && (
              <>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                  {/* QR SCANNABLE — miroir de la réparation /me N°334-B :
                      marge de silence incluse (marginSize 2) + fond blanc
                      encadré — un routeur n'a pas de caméra, mais le QR se
                      scanne depuis l'app WireGuard d'un téléphone de secours. */}
                  <div className="mx-auto shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mx-0">
                    <div
                      role="img"
                      aria-label="QR code de la configuration WireGuard — scannez-le depuis l'application WireGuard"
                      className="rounded-lg bg-white"
                    >
                      <QRCodeSVG
                        value={reveal.conf}
                        size={204}
                        level="L"
                        marginSize={2}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                        className="h-[204px] w-[204px]"
                      />
                    </div>
                    <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
                      Scan depuis l&apos;app WireGuard
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      ref={confRef}
                      className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-slate-700"
                    >
                      {reveal.conf}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void copyConf()}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Copiée
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            Copier
                          </>
                        )}
                      </button>
                      <button
                        onClick={downloadConf}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {downloaded ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Téléchargé
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            Fichier .conf
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instructions PRO (cette page ne révèle que des appareils
                    Accès Pro) — les voies d'import officielles RouterOS 7 et
                    WireGuard couvertes. */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                  <p className="font-semibold text-slate-800">Accès Pro — routeurs, caméras, NAS</p>
                  <p className="mt-1">
                    Sur RouterOS 7 : <span className="font-mono">WireGuard</span> →{" "}
                    <span className="font-mono">Peers</span> → importez le fichier{" "}
                    <span className="font-mono">.conf</span> téléchargé, ou collez la configuration
                    copiée dans un tunnel existant (un renouvellement ne change jamais la conf).
                    Sur téléphone de secours : app WireGuard → «&nbsp;+&nbsp;» →
                    «&nbsp;Créer à partir d&apos;un QR code&nbsp;». Sur PC : app WireGuard →
                    «&nbsp;Importer un tunnel depuis un fichier&nbsp;». Sur NAS (Synology, QNAP)
                    ou routeur tiers (OpenWRT, pfSense, GL.iNet) : adaptation manuelle — le
                    guide d&apos;installation détaille chaque voie. Les entrées{" "}
                    <span className="font-mono">AllowedIPs</span> portent le périmètre Pro : vos
                    routeurs, vos autres appareils Pro + votre LAN étendu le cas échéant — la
                    configuration ne quitte jamais le coffre sans votre action.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- Modal reveal INVITÉ (N°342) — la conf d'un tiers : périmètre
          minimal + expiration annoncés DANS la modale (l'hôte sait ce qu'il
          remet). Même confort que le reveal Pro : bottom-sheet mobile,
          Escape, focus au titre, QR + copie + .conf. ---- */}
      {guestRevealFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Configuration invité"
          onClick={() => setGuestRevealFor(null)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  ref={guestRevealHeadRef}
                  tabIndex={-1}
                  className="text-base font-bold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Configuration invité — {guestRevealFor.label}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  hôte {guestRevealFor.hostLabel || guestRevealFor.hostIp} · ports {guestRevealFor.ports}
                  {guestReveal?.expiresAt ? ` · jusqu'au ${formatDate(guestReveal.expiresAt)}` : ""}
                </p>
              </div>
              <button
                onClick={() => setGuestRevealFor(null)}
                aria-label="Fermer"
                className="rounded-xl border border-slate-300 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {guestRevealLoading && (
              <div className="mt-4 h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100/70" aria-busy="true" />
            )}
            {guestRevealError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
                {guestRevealError}
              </div>
            )}
            {guestReveal && (
              <>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="mx-auto shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mx-0">
                    <div
                      role="img"
                      aria-label="QR code de la configuration invité — scannez-le depuis l'application WireGuard"
                      className="rounded-lg bg-white"
                    >
                      <QRCodeSVG
                        value={guestReveal.conf}
                        size={204}
                        level="L"
                        marginSize={2}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                        className="h-[204px] w-[204px]"
                      />
                    </div>
                    <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
                      Scan depuis l&apos;app WireGuard
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      ref={gConfRef}
                      className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-slate-700"
                    >
                      {guestReveal.conf}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void copyGuestConf()}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {gCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Copiée
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            Copier
                          </>
                        )}
                      </button>
                      <button
                        onClick={downloadGuestConf}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {gDownloaded ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Téléchargé
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            Fichier .conf
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instructions INVITÉ — le périmètre minimal et l'expiration
                    sont annoncés À L'HÔTE au moment de remettre la conf. */}
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-relaxed text-slate-600">
                  <p className="font-semibold text-slate-800">À remettre à l&apos;invité (QR ou fichier)</p>
                  <p className="mt-1">
                    Sur son appareil : app WireGuard → «&nbsp;+&nbsp;» → «&nbsp;Créer à partir
                    d&apos;un QR code&nbsp;» (ou importer le fichier{" "}
                    <span className="font-mono">.conf</span> sur PC). Son accès joint{" "}
                    <strong className="font-semibold text-slate-800">uniquement</strong>{" "}
                    <span className="font-mono">{guestRevealFor.hostIp}</span> sur les ports{" "}
                    <span className="font-mono">{guestRevealFor.ports}</span> — pas d&apos;Internet,
                    pas d&apos;autres appareils — et il cessera de fonctionner au terme
                    (ou dès que vous le révoquez). Doctrine 1 conf = 1 appareil : cette conf
                    est la SIENNE, ne lui donnez jamais la vôtre.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
