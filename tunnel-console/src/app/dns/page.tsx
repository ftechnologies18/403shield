"use client";

// dns/page.tsx — N°345 — LA CONSOLE DU BOUCLIER DNS : profils + ONBOARDING
// PAR APPAREIL (la face client du produit N°339/343 — jusqu'ici l'API
// existait sans écran).
//
// CE QUE LA PAGE FAIT (contrat /api/dnsshield/* N°339, ÉTENDU N°345) :
//   - PROFILS : créer / modifier / supprimer (nom, niveau off|threats|family,
//     règles bloquer/autoriser, couvre-feu 7 jours) ;
//   - JOURNAL : les 100 derniers blocages d'un profil (rapport d'activité
//     du parent — journalisation MINIMALE : les autorisées n'y sont jamais) ;
//   - INSTALLER SUR UN APPAREIL — LE CŒUR DE N°345 : une modale par profil
//     avec UN ONGLET PAR SYSTÈME et les VALEURS RÉELLES du backend :
//       · Android      → hôte « DNS privé » <publicId>.dns.403shield.ftci.fr
//                        (DoT :853 — l'état réel du serveur est AFFICHÉ,
//                        doctrine « aucun faux chiffre ») ;
//       · iPhone/iPad  → profil .mobileconfig DoH en 1 téléchargement
//                        (généré par le backend, /dns-cfg/{publicId}) ;
//       · Mac          → le même profil + étapes macOS ;
//       · Navigateurs  → URL DoH à coller (Chrome/Edge/Firefox — LIVE) ;
//       · Windows      → méthode navigateur d'abord (honnêteté : le DoH
//                        natif Windows exigera le jalon routeurs) ;
//       · Box/routeurs → le PROCHAIN jalon (UDP/53) annoncé tel quel —
//                        jamais de promesse en avance sur la réalité.
//
// N°347 — ABONNEMENT « TOURACO » : la carte d'état de l'abonnement DNS en
// tête de page (actif : badge + échéance + commandes renouvelables 1-clic ;
// inactif : tier gratuit + encart de découverte TOURACO), la modale de
// renouvellement (formules du catalogue public /api/public/dns/offers,
// Wave/carte GeniusPay, honeypot website — miroir du flux /me N°334-B) et
// le bandeau de retour de paiement (?order=MCD-… pollé via le statut
// public jusqu'à « provisioned », puis rafraîchissement du /me). Les
// compteurs de la page suivent les bornes EFFECTIVES du /me (25/600 pour
// un abonné TOURACO — plus aucune capacité codée en dur).
//
// THEME : clair « console » (miroir /pro N°337 — mkdns-page), accents
// émeraude, wordmark aurora. Modales : bottom-sheet mobile + Escape +
// focus au titre (même confort que /me et /pro).

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban,
  Bird,
  CalendarClock,
  Check,
  Compass,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  Loader2,
  LogOut,
  MapPin,
  MonitorSmartphone,
  Pencil,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import {
  clearToken,
  dnsHomeClaim,
  dnsHomeDelete,
  dnsHomeList,
  dnsHomeProbeCreate,
  dnsHomeProbeStatus,
  dnsMe,
  dnsProfileCreate,
  dnsProfileDelete,
  dnsProfileEvents,
  dnsProfileUpdate,
  fetchPublicDnsOffers,
  fetchPublicDnsOrderStatus,
  getToken,
  tunnelDnsRenew,
  type DnsEventsResponse,
  type DnsHomeResponse,
  type DnsMeResponse,
  type DnsProfile,
  type DnsProfilePayload,
  type DnsProbeResponse,
  type DnsProbeStatusResponse,
  type DnsSubscriptionOrder,
  type PublicDnsOfferPlan,
  type PublicDnsOffers,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Petits helpers
// ---------------------------------------------------------------------------

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
const JOURS_LONGS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** N°346 — « il y a X » pour la santé d'une liaison maison (agrégat
 * différé ≤ 60 s — l'honnêteté va jusqu'au libellé). */
function timeAgo(iso: string): string {
  if (!iso) return "jamais";
  try {
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    return `il y a ${Math.floor(s / 86400)} j`;
  } catch {
    return "—";
  }
}

function levelInfo(level: string): { label: string; tone: string; desc: string } {
  switch (level) {
    case "family":
      return {
        label: "Famille",
        tone: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700",
        desc: "Menaces + contenu adulte + jeux d'argent",
      };
    case "threats":
      return {
        label: "Menaces",
        tone: "border-amber-500/40 bg-amber-500/10 text-amber-700",
        desc: "Malwares et hameçonnage (listes vivantes)",
      };
    default:
      return {
        label: "Personnel",
        tone: "border-slate-300 bg-slate-100 text-slate-600",
        desc: "Aucune catégorie — vos règles seules",
      };
  }
}

function rulesCount(rules: string): number {
  if (!rules) return 0;
  return rules.split("\n").filter((l) => l.trim() !== "").length;
}

/** N°347 — jours restants avant une échéance (null si illisible). */
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

function formatFcfa(n: number): string {
  return n.toLocaleString("fr-FR") + " FCFA";
}

// N°347 — capacités PRODUIT : l'encart de découverte TOURACO et les replis
// d'affichage pendant les chargements. Les valeurs EFFECTIVES du compte
// viennent toujours du serveur (/me → limits, /home → maxBindings) — la
// rétention du journal n'est pas servie, elle se déduit de l'état
// d'abonnement (90 j abonné, 30 j gratuit, miroir de la résolution backend).
const TOURACO_CAPACITES = { profils: 25, regles: 600, logements: 15, journalJours: 90 };
const GRATUIT_CAPACITES = { profils: 10, regles: 200, logements: 5, journalJours: 30 };

// N°347 — vitrine publique du bouclier DNS : LE canal d'achat d'une
// souscription NEUVE (la console ne renouvelle que l'existant — doctrine
// « un seul canal B2C », miroir /shop → 403shield.ftci.fr/checkout).
const VITRINE_DNS_URL = "https://403shield.ftci.fr/dns";

/** N°347 — montant effectif d'une formule selon le moyen choisi (frais
 * répercutés côté backend ; repli sur le tarif de base si absent). */
function planAmount(plan: PublicDnsOfferPlan, method: string): number {
  if (method === "wave" && typeof plan.waveFcfa === "number") return plan.waveFcfa;
  if (method === "card" && typeof plan.cardFcfa === "number") return plan.cardFcfa;
  return plan.baseFcfa;
}

function curfewLabel(p: DnsProfile): string | null {
  const c = p.curfew;
  if (!c?.enabled || !c.start || !c.end) return null;
  const days = c.days ?? "1111111";
  const tous = days.split("").every((d) => d === "1");
  const liste = JOURS_LONGS.filter((_, i) => days[i] === "1").join(", ");
  return `${c.start} → ${c.end} (${tous ? "tous les jours" : liste})`;
}

// ---------------------------------------------------------------------------
// Composants UI réutilisables (page-scopés, miroir des patterns /pro)
// ---------------------------------------------------------------------------

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <code className="mt-1.5 block break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono text-slate-800">
        {value}
      </code>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-xs font-bold text-emerald-700">
        {n}
      </span>
      <span className="text-sm leading-relaxed text-slate-700">{children}</span>
    </li>
  );
}

// Systèmes de l'onboarding — l'icône est le repère visuel, l'onglet reste
// textuel pour le lecteur d'écran.
type SystemeKey = "android" | "iphone" | "mac" | "navigateurs" | "windows" | "box";

const SYSTEMES: { key: SystemeKey; label: string; icon: React.ReactNode }[] = [
  { key: "android", label: "Android", icon: <Smartphone className="h-4 w-4" /> },
  { key: "iphone", label: "iPhone / iPad", icon: <Smartphone className="h-4 w-4" /> },
  { key: "mac", label: "Mac", icon: <Laptop className="h-4 w-4" /> },
  { key: "navigateurs", label: "Navigateurs", icon: <Compass className="h-4 w-4" /> },
  { key: "windows", label: "Windows", icon: <MonitorSmartphone className="h-4 w-4" /> },
  { key: "box", label: "Box / Routeur", icon: <RouterIcon className="h-4 w-4" /> },
];

// ---------------------------------------------------------------------------
// La page
// ---------------------------------------------------------------------------

export default function DnsPage() {
  const router = useRouter();
  const [me, setMe] = useState<DnsMeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  // Modale d'installation (le cœur de N°345).
  const [installFor, setInstallFor] = useState<DnsProfile | null>(null);
  const [systeme, setSysteme] = useState<SystemeKey>("android");
  const installHeadRef = useRef<HTMLHeadingElement | null>(null);

  // Modale journal.
  const [eventsFor, setEventsFor] = useState<DnsProfile | null>(null);
  const [events, setEvents] = useState<DnsEventsResponse | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const eventsHeadRef = useRef<HTMLHeadingElement | null>(null);

  // N°346 — TOUTE LA MAISON : liaisons IP→profil + sonde de ligne.
  const [home, setHome] = useState<DnsHomeResponse | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);
  // Formulaire de liaison (IP pré-remplie avec celle de la requête).
  const [hProfileId, setHProfileId] = useState("");
  const [hLabel, setHLabel] = useState("Maison");
  const [hIP, setHIP] = useState("");
  const [hError, setHError] = useState("");
  const [hBusy, setHBusy] = useState(false);
  // Sonde : jeton vivant + dernier statut ("expired" local quand 404).
  const [probe, setProbe] = useState<DnsProbeResponse | null>(null);
  const [probeStatus, setProbeStatus] = useState<DnsProbeStatusResponse | { status: "expired" } | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);

  // Formulaire création/édition.
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fLevel, setFLevel] = useState<"off" | "threats" | "family">("family");
  const [fBlock, setFBlock] = useState("");
  const [fAllow, setFAllow] = useState("");
  const [fCurfewOn, setFCurfewOn] = useState(false);
  const [fStart, setFStart] = useState("22:00");
  const [fEnd, setFEnd] = useState("06:00");
  const [fDays, setFDays] = useState<string>("1111111");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // N°347 — ABONNEMENT « TOURACO » : renouvellement 1-clic (miroir du flux
  // /me N°334-B) + retour de paiement GeniusPay (?order=MCD-…) + catalogue
  // public des formules (SANS auth).
  const [renewFor, setRenewFor] = useState<DnsSubscriptionOrder | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [renewPlan, setRenewPlan] = useState<string>("dns-month");
  const [renewMethod, setRenewMethod] = useState<string>("wave");
  const [renewPhone, setRenewPhone] = useState("");
  // Honeypot « website » : champ invisible, jamais rempli par un humain —
  // un bot qui le remplit reçoit un succès factice côté backend.
  const [renewWebsite, setRenewWebsite] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewError, setRenewError] = useState("");
  const [renewNotice, setRenewNotice] = useState("");
  const renewHeadRef = useRef<HTMLHeadingElement | null>(null);
  // Catalogue public des formules (chargé UNE fois au montage).
  const [offers, setOffers] = useState<PublicDnsOffers | null>(null);
  // Retour GeniusPay : référence + statut pollé (pending → provisioned).
  const [returnOrder, setReturnOrder] = useState("");
  const [returnStatus, setReturnStatus] = useState("");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    setHomeLoading(true);
    try {
      // N°346 — profils et maison d'un seul mouvement (Promise.allSettled :
      // un périmètre en échec n'efface pas l'autre — la page reste utile).
      const [meRes, homeRes] = await Promise.allSettled([dnsMe(token), dnsHomeList(token)]);
      if (meRes.status === "rejected") {
        const status = (meRes.reason as { status?: number }).status;
        if (status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(meRes.reason instanceof Error ? meRes.reason.message : "Chargement impossible");
      } else {
        setMe(meRes.value);
      }
      if (homeRes.status === "fulfilled") {
        setHome(homeRes.value);
        setHIP((cur) => cur || homeRes.value.myIp || "");
      }
    } finally {
      setLoading(false);
      setHomeLoading(false);
    }
  }, [router]);

  // N°346 — le profil proposé par défaut dans le formulaire maison : le
  // premier du compte (l'utilisateur change s'il veut).
  useEffect(() => {
    if (!hProfileId && me && me.profiles.length > 0) setHProfileId(me.profiles[0].id);
  }, [me, hProfileId]);

  useEffect(() => {
    // N°347 — retour de paiement GeniusPay : ?order=MCD-… → bandeau de
    // suivi (poll du statut public ci-dessous) ; l'URL est nettoyée pour
    // qu'un rafraîchissement manuel ne re-déclenche pas le bandeau.
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get("order") ?? "").trim();
    if (ref) {
      setReturnOrder(ref);
      setReturnStatus("pending");
      window.history.replaceState({}, "", window.location.pathname);
    }
    void load();
  }, [load]);

  // N°347 — catalogue public (une fois au montage : endpoint cacheable,
  // indépendant du /me — un échec réseau est silencieux, la modale le
  // signalera à l'ouverture avec ses replis produit).
  useEffect(() => {
    let live = true;
    fetchPublicDnsOffers()
      .then((o) => {
        if (live) setOffers(o);
      })
      .catch(() => {
        /* silencieux : la modale retombe sur un message honnête */
      });
    return () => {
      live = false;
    };
  }, []);

  // N°347 — poll léger du statut de la commande de retour : toutes les 4 s
  // pendant ≤ 2 min (le GET public finalise AUSSI côté serveur si le webhook
  // GeniusPay a déjà convergé — même source unique). « provisioned » →
  // message de succès + rafraîchissement du /me (capacités étendues).
  useEffect(() => {
    if (!returnOrder) return;
    let live = true;
    const poll = async () => {
      try {
        const st = await fetchPublicDnsOrderStatus(returnOrder);
        if (!live) return;
        setReturnStatus(st.status);
        if (st.status === "provisioned") {
          live = false;
          void load();
        } else if (st.status === "cancelled" || st.status === "expired") {
          live = false;
        }
      } catch {
        /* réseau/404 : le bandeau reste (bouton Rafraîchir maintenant) */
      }
    };
    void poll();
    const iv = setInterval(() => void poll(), 4000);
    const stop = setTimeout(() => {
      live = false;
      clearInterval(iv);
    }, 2 * 60 * 1000);
    return () => {
      live = false;
      clearInterval(iv);
      clearTimeout(stop);
    };
  }, [returnOrder, load]);

  // Escape ferme les modales (même confort que /me et /pro).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInstallFor(null);
        setEventsFor(null);
        setRenewFor(null);
        setSubscribeOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus au titre quand une modale s'ouvre.
  useEffect(() => {
    if (installFor) installHeadRef.current?.focus();
  }, [installFor]);
  useEffect(() => {
    if (eventsFor) eventsHeadRef.current?.focus();
  }, [eventsFor]);
  // N°347 — focus au titre de la modale abonnement (renouvellement ou
  // découverte TOURACO).
  useEffect(() => {
    if (renewFor || subscribeOpen) renewHeadRef.current?.focus();
  }, [renewFor, subscribeOpen]);

  const openCreate = () => {
    setEditId(null);
    setFName("");
    setFLevel("family");
    setFBlock("");
    setFAllow("");
    setFCurfewOn(false);
    setFStart("22:00");
    setFEnd("06:00");
    setFDays("1111111");
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (p: DnsProfile) => {
    setEditId(p.id);
    setFName(p.name);
    setFLevel(p.level);
    setFBlock(p.blockRules ?? "");
    setFAllow(p.allowRules ?? "");
    setFCurfewOn(Boolean(p.curfew?.enabled));
    setFStart(p.curfew?.start || "22:00");
    setFEnd(p.curfew?.end || "06:00");
    setFDays(p.curfew?.days || "1111111");
    setFormError("");
    setFormOpen(true);
  };

  const submitForm = async () => {
    const token = getToken();
    if (!token) return;
    setFormError("");
    if (!fName.trim()) {
      setFormError("Donnez un nom au profil (ex. « Tablette de Yao »)");
      return;
    }
    const payload: DnsProfilePayload = {
      name: fName.trim(),
      level: fLevel,
      blockRules: fBlock,
      allowRules: fAllow,
      curfew: fCurfewOn ? { enabled: true, start: fStart, end: fEnd, days: fDays } : null,
    };
    setFormLoading(true);
    try {
      if (editId) {
        await dnsProfileUpdate(token, editId, payload);
      } else {
        await dnsProfileCreate(token, payload);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setFormLoading(false);
    }
  };

  const removeProfile = async (p: DnsProfile) => {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Supprimer « ${p.name} » ? Les appareils configurés avec ce profil perdront le filtrage (ils retomberont sur leur DNS habituel).`)) return;
    setBusy(p.id);
    try {
      await dnsProfileDelete(token, p.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setBusy("");
    }
  };

  const openEvents = async (p: DnsProfile) => {
    const token = getToken();
    if (!token) return;
    setEventsFor(p);
    setEvents(null);
    setEventsLoading(true);
    try {
      setEvents(await dnsProfileEvents(token, p.id));
    } catch {
      setEvents({ events: [] });
    } finally {
      setEventsLoading(false);
    }
  };

  // ── N°347 — Abonnement TOURACO : renouvellement 1-clic ──────────────

  const openRenew = (o: DnsSubscriptionOrder) => {
    setSubscribeOpen(false);
    setRenewFor(o);
    // La formule par défaut suit celle de la commande ciblée quand elle est
    // encore au catalogue (un abonné annuel renouvelle en annuel d'emblée).
    const connues = offers?.plans ?? [];
    setRenewPlan(o.planId && connues.some((p) => p.id === o.planId) ? o.planId : "dns-month");
    setRenewMethod("wave");
    setRenewError("");
    setRenewNotice("");
  };

  // Mode souscription (compte non abonné) : même modale, le geste part vers
  // la vitrine publique — le renew n'existe pas sans commande active.
  const openSubscribe = () => {
    setRenewFor(null);
    setSubscribeOpen(true);
    setRenewError("");
    setRenewNotice("");
  };

  const closeSubModal = () => {
    setRenewFor(null);
    setSubscribeOpen(false);
  };

  const submitRenew = async () => {
    const token = getToken();
    if (!renewFor || !token) return;
    if (renewMethod === "wave" && renewPhone.replace(/\D/g, "").length < 8) {
      setRenewError("Un numéro de téléphone valide est requis pour payer par Wave.");
      return;
    }
    setRenewLoading(true);
    setRenewError("");
    setRenewNotice("");
    try {
      const out = await tunnelDnsRenew(renewFor.ref, token, {
        planId: renewPlan,
        payMethod: renewMethod,
        phone: renewPhone || undefined,
        website: renewWebsite || undefined, // honeypot — rempli = robot
      });
      if (out.online && out.paymentUrl) {
        // GeniusPay : le paiement se règle chez le prestataire — le retour
        // ramène ici (?order=MCD-…) et le bandeau de suivi prend le relais.
        window.location.href = out.paymentUrl;
        return;
      }
      // Canal manuel : la référence est à régler, la plateforme confirme
      // l'encaissement (miroir du flux VPN /me — honnête et traçable).
      setRenewNotice(
        "Commande " +
          out.ref +
          " enregistrée (" +
          formatFcfa(out.amountFcfa) +
          ", canal manuel). Réglez la commande — la plateforme confirmera l'encaissement, votre échéance s'étendra automatiquement.",
      );
      closeSubModal();
      void load();
    } catch (err) {
      setRenewError(err instanceof Error ? err.message : "Renouvellement impossible — réessayez");
    } finally {
      setRenewLoading(false);
    }
  };

  // ── N°346 — Toute la maison : liaison, détachement, sonde ──────────────

  const claimHome = async (profileIdArg?: string, ipArg?: string) => {
    const token = getToken();
    if (!token) return;
    const profileId = profileIdArg || hProfileId;
    if (!profileId) {
      setHError("Créez d'abord un profil de filtrage — c'est lui que la maison suivra.");
      return;
    }
    setHError("");
    setHBusy(true);
    try {
      await dnsHomeClaim(token, profileId, hLabel.trim() || "Maison", ipArg || hIP.trim() || undefined);
      await load();
    } catch (err) {
      setHError(err instanceof Error ? err.message : "Liaison impossible");
    } finally {
      setHBusy(false);
    }
  };

  const removeHome = async (id: string, label: string) => {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Détacher « ${label} » ? La box retrouvera le DNS de votre FAI (rien à désinstaller sur les appareils).`)) return;
    setHBusy(true);
    try {
      await dnsHomeDelete(token, id);
      await load();
    } catch (err) {
      setHError(err instanceof Error ? err.message : "Détachement impossible");
    } finally {
      setHBusy(false);
    }
  };

  const startProbe = async () => {
    const token = getToken();
    if (!token) return;
    setProbeBusy(true);
    setProbeStatus(null);
    setHError("");
    try {
      setProbe(await dnsHomeProbeCreate(token));
    } catch (err) {
      setHError(err instanceof Error ? err.message : "Sonde indisponible — réessayez");
    } finally {
      setProbeBusy(false);
    }
  };

  // Poll de la sonde : toutes les 3 s, jusqu'à « received » ou expiration
  // (le 404 du backend devient l'état local « expired » — honnête).
  useEffect(() => {
    if (!probe) return;
    let live = true;
    const poll = async () => {
      const token = getToken();
      if (!token || !live) return;
      try {
        const st = await dnsHomeProbeStatus(token, probe.token);
        if (!live) return;
        setProbeStatus(st);
        if (st.status === "received") live = false;
      } catch {
        if (live) {
          setProbeStatus({ status: "expired" });
          live = false;
        }
      }
    };
    void poll();
    const iv = setInterval(() => void poll(), 3000);
    const stop = setTimeout(() => {
      live = false;
      clearInterval(iv);
    }, 15 * 60 * 1000);
    return () => {
      live = false;
      clearInterval(iv);
      clearTimeout(stop);
    };
  }, [probe]);

  const dotEnabled = me?.setup?.dotEnabled ?? false;
  const udp53Enabled = me?.setup?.udp53Enabled ?? home?.udp53Enabled ?? false;
  const resolverIp = me?.setup?.resolverIp || home?.resolverIp || "";
  const profiles = me?.profiles ?? [];

  // N°347 — l'abonnement « TOURACO » de CE compte (défensif : un backend non
  // encore redéployé ne renvoie pas le bloc — la carte retombe alors sur le
  // tier gratuit, la page ne casse pas).
  const sub = me?.subscription;
  const subActive = Boolean(sub?.active);
  const subOrders = sub?.orders ?? [];
  // Bornes EFFECTIVES du compte (serveur : 25/600/15 pour un abonné TOURACO)
  // avec replis produit uniquement pendant les chargements.
  const maxProfiles =
    me?.limits.maxProfiles ?? (subActive ? TOURACO_CAPACITES.profils : GRATUIT_CAPACITES.profils);
  const maxRules =
    me?.limits.maxRules ?? (subActive ? TOURACO_CAPACITES.regles : GRATUIT_CAPACITES.regles);
  const maxBindings =
    home?.limits.maxBindings ?? (subActive ? TOURACO_CAPACITES.logements : GRATUIT_CAPACITES.logements);
  // La rétention du journal n'est pas servie : elle se déduit de l'état
  // d'abonnement (miroir exact de la résolution backend par e-mail).
  const journalJours = subActive ? TOURACO_CAPACITES.journalJours : GRATUIT_CAPACITES.journalJours;
  // Les formules au catalogue (repli vide : la modale affiche un message
  // honnête au lieu de prix inventés).
  const plans = offers?.enabled ? (offers?.plans ?? []) : [];
  // N°347 — habillage du bandeau de retour de paiement : provisioned =
  // succès, cancelled/expired = échec, tout le reste (pending, paid, réseau)
  // reste en « vérification en cours ».
  const retourSucces = returnStatus === "provisioned";
  const retourEchec = returnStatus === "cancelled" || returnStatus === "expired";
  // N°347 — jours restants sur l'échéance de l'abonnement (null si illisible).
  const subJours = sub?.expiresAt ? daysLeft(sub.expiresAt) : null;

  return (
    <div className="mkdns-page flex min-h-screen flex-col bg-[#f5f6f8] text-slate-800">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
            <div className="leading-tight">
              <p className="mkpro-aurora text-base font-bold tracking-tight">403Shield</p>
              <p className="text-[11px] font-medium text-slate-500">Bouclier DNS</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Rafraîchir"
            >
              <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
            </button>
            <button
              type="button"
              onClick={() => {
                clearToken();
                router.replace("/login");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* ── N°347 — Bandeau de retour de paiement GeniusPay ───── */}
        {returnOrder ? (
          <div
            role="status"
            className={
              "mb-6 rounded-2xl border p-4 text-sm " +
              (retourSucces
                ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-800"
                : retourEchec
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-800")
            }
          >
            <p className="flex items-center gap-2 font-semibold">
              {retourSucces ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden />
              ) : retourEchec ? (
                <Ban className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              )}
              {retourSucces
                ? `Commande ${returnOrder} activée — abonnement TOURACO à jour`
                : retourEchec
                  ? `Paiement non abouti pour la commande ${returnOrder}`
                  : `Paiement de la commande ${returnOrder}`}
            </p>
            <p
              className={
                "mt-1 leading-relaxed " +
                (retourSucces ? "text-emerald-700/80" : retourEchec ? "text-amber-700/80" : "text-sky-700/80")
              }
            >
              {retourSucces
                ? "Votre échéance est étendue et vos capacités aussi — la carte « Abonnement TOURACO » ci-dessous reflète l'état réel."
                : retourEchec
                  ? "Aucun montant n'a été débité. Vous pouvez relancer le renouvellement depuis la carte « Abonnement TOURACO » ci-dessous."
                  : "Vérification en cours… Si votre paiement est confirmé, vos capacités s'étendent ci-dessous — sinon dans quelques instants (le retour de la banque peut prendre une minute)."}
            </p>
            {!retourSucces && !retourEchec ? (
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 font-semibold underline underline-offset-2"
              >
                Rafraîchir maintenant
              </button>
            ) : null}
          </div>
        ) : null}

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Le bouclier DNS de votre foyer
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Un profil = un appareil (ou un groupe d&apos;appareils). Choisissez un niveau, posez vos
            règles, puis installez le profil sur chaque appareil — Android en un nom d&apos;hôte,
            iPhone et Mac en un profil téléchargé, navigateurs en une URL. Les appareils protégés
            filtreront malwares, hameçonnage et — si vous le choisissez — les contenus adultes et
            les jeux d&apos;argent.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Listes de menaces vivantes
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {me ? me.threats.domains.toLocaleString("fr-FR") : "…"}
              </p>
              <p className="text-xs text-slate-500">
                {me ? `agrégat URLhaus + OpenPhish · ${formatTime(me.threats.updatedAt)}` : "chargement…"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vie privée
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Journal minimal</p>
              <p className="text-xs text-slate-500">
                seuls les blocages sont consignés — jamais les sites autorisés
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Serveur Android (DoT :853)
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {me ? (dotEnabled ? "Opérationnel" : "Activation en cours") : "…"}
              </p>
              <p className="text-xs text-slate-500">
                {dotEnabled
                  ? "« DNS privé » Android prêt (hôte par profil)"
                  : "l'installation Android arrive — les navigateurs et Apple fonctionnent dès maintenant"}
              </p>
            </div>
          </div>
          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </section>

        {/* ── N°347 — Abonnement TOURACO ───────────────────────── */}
        {me ? (
          <section
            id="abonnement"
            className="mt-6 scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            {subActive ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
                      <Bird className="h-5 w-5 text-emerald-600" aria-hidden />
                      Abonnement TOURACO
                      <span className="rounded-full border border-emerald-600/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        actif
                      </span>
                    </h2>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                      {sub?.expiresAt ? (
                        <>
                          Couvert jusqu&apos;au {formatDate(sub.expiresAt)}
                          {subJours !== null
                            ? ` — ${subJours} jour${subJours > 1 ? "s" : ""} restant${subJours > 1 ? "s" : ""}`
                            : ""}
                          . Les mois d&apos;un renouvellement s&apos;ajoutent à votre échéance restante — rien ne se perd.
                        </>
                      ) : (
                        "Droit actif sans terme connu — le renouvellement pose une échéance."
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Profils</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                      {profiles.length}/{maxProfiles}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Règles par liste</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">{maxRules}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Logements</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                      {home ? `${home.bindings.length}/` : ""}
                      {maxBindings}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Journal</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">{journalJours} jours</p>
                  </div>
                </div>
                <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Vos commandes actives
                </h3>
                {subOrders.length > 0 ? (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {subOrders.map((o) => {
                      const echeanceJours = daysLeft(o.expiresAt);
                      return (
                        <li key={o.ref} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">
                              {o.planLabel ?? "Abonnement TOURACO"}{" "}
                              <span className="font-mono font-normal text-slate-500">· {o.ref}</span>
                            </p>
                            <p
                              className={
                                "text-xs " +
                                (echeanceJours !== null && echeanceJours <= 7 && echeanceJours >= 0
                                  ? "font-semibold text-amber-600"
                                  : "text-slate-500")
                              }
                            >
                              {o.periodLabel ?? (o.months ? `${o.months} mois` : "—")}
                              {o.kind === "renewal" ? " · renouvellement" : ""}
                              {o.expiresAt
                                ? ` · jusqu'au ${formatDate(o.expiresAt)}` +
                                  (echeanceJours !== null && echeanceJours >= 0
                                    ? ` (${echeanceJours} j)`
                                    : "")
                                : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openRenew(o)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
                          >
                            <CalendarClock className="h-4 w-4" aria-hidden />
                            Renouveler
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
                    Aucune commande active listée pour le moment — votre droit reste actif tel
                    que décrit ci-dessus.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
                      <Bird className="h-5 w-5 text-slate-400" aria-hidden />
                      Bouclier DNS — tier gratuit
                      <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        sans abonnement
                      </span>
                    </h2>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                      Votre foyer est déjà filtré contre les menaces vivantes. Vos capacités
                      actuelles, telles que servies par le bouclier :
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Profils</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                      {profiles.length}/{maxProfiles}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Règles par liste</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">{maxRules}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Logements</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                      {home ? `${home.bindings.length}/` : ""}
                      {maxBindings}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Journal</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">{journalJours} jours</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 max-w-2xl">
                      <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Bird className="h-4 w-4 text-emerald-600" aria-hidden />
                        TOURACO — la vigie du foyer
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        Du nom de l&apos;oiseau guetteur africain : {TOURACO_CAPACITES.profils} profils,
                        {" "}
                        {TOURACO_CAPACITES.regles} règles par liste, {TOURACO_CAPACITES.logements} logements
                        (domicile, bureau, maison de famille) et un journal conservé{" "}
                        {TOURACO_CAPACITES.journalJours} jours. À l&apos;expiration rien n&apos;est supprimé
                        — seules les créations au-delà des bornes gratuites redeviennent refusées.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openSubscribe}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      <Bird className="h-4 w-4" aria-hidden />
                      Découvrir TOURACO
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}

        {/* ── Barre profils ────────────────────────────────────── */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Vos profils{" "}
            <span className="ml-1 text-sm font-medium text-slate-500">
              ({profiles.length}
              {me ? `/${maxProfiles}` : ""})
            </span>
          </h2>
          <button
            type="button"
            onClick={openCreate}
            disabled={Boolean(me && profiles.length >= maxProfiles)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
            Nouveau profil
          </button>
        </section>

        {/* ── Liste profils ────────────────────────────────────── */}
        {loading && !me ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement de vos profils…
          </div>
        ) : profiles.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-700">Aucun profil pour l&apos;instant</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
              Créez votre premier profil — par exemple « Téléphone de Yao » en niveau Famille —
              puis installez-le sur l&apos;appareil en un geste.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Créer mon premier profil
            </button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {profiles.map((p) => {
              const lvl = levelInfo(p.level);
              const curfew = curfewLabel(p);
              return (
                <li key={p.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900">{p.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Créé le {formatDate(p.createdAt)} · identifiant {p.publicId}
                      </p>
                    </div>
                    <span className={"shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold " + lvl.tone}>
                      {lvl.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{lvl.desc}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                      {rulesCount(p.blockRules)} bloquée{rulesCount(p.blockRules) > 1 ? "s" : ""}
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                      {rulesCount(p.allowRules)} autorisée{rulesCount(p.allowRules) > 1 ? "s" : ""}
                    </span>
                    {curfew ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                        <CalendarClock className="h-3 w-3" /> {curfew}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSysteme("android");
                        setInstallFor(p);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <Smartphone className="h-4 w-4" />
                      Installer sur un appareil
                    </button>
                    <button
                      type="button"
                      onClick={() => void openEvents(p)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
                    >
                      <Ban className="h-4 w-4" />
                      Journal
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      aria-label={"Modifier " + p.name}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeProfile(p)}
                      disabled={busy === p.id}
                      aria-label={"Supprimer " + p.name}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                    >
                      {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* ── Formulaire création/édition ──────────────────────── */}
        {formOpen ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {editId ? "Modifier le profil" : "Nouveau profil"}
            </h2>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nom de l&apos;appareil ou du groupe
                </span>
                <input
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="ex. Tablette de Yao"
                  maxLength={80}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau</span>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                  {(["family", "threats", "off"] as const).map((lv) => {
                    const info = levelInfo(lv);
                    const on = fLevel === lv;
                    return (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => setFLevel(lv)}
                        className={"rounded-xl border p-3 text-left transition " + (on ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-slate-300")}
                        aria-pressed={on}
                      >
                        <span className={"inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold " + info.tone}>
                          {info.label}
                        </span>
                        <span className="mt-1.5 block text-xs leading-snug text-slate-600">{info.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Bloquer (un domaine par ligne)
                  </span>
                  <textarea
                    value={fBlock}
                    onChange={(e) => setFBlock(e.target.value)}
                    rows={4}
                    placeholder={"example.com\njeux.example"}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Bloquer « example.com » couvre aussi ses sous-domaines. {maxRules} max.
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Autoriser (exceptions)
                  </span>
                  <textarea
                    value={fAllow}
                    onChange={(e) => setFAllow(e.target.value)}
                    rows={4}
                    placeholder={"devoirs.example"}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Surpassent le niveau ET le couvre-feu (l&apos;exception « devoirs »).
                  </span>
                </label>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={fCurfewOn}
                    onChange={(e) => setFCurfewOn(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span className="text-sm font-semibold text-slate-800">
                    Couvre-feu (couper Internet la nuit)
                  </span>
                </label>
                {fCurfewOn ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600">De</label>
                      <input
                        type="time"
                        value={fStart}
                        onChange={(e) => setFStart(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
                      />
                      <label className="text-xs font-semibold text-slate-600">à</label>
                      <input
                        type="time"
                        value={fEnd}
                        onChange={(e) => setFEnd(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {JOURS.map((j, i) => {
                        const on = fDays[i] === "1";
                        return (
                          <button
                            key={i}
                            type="button"
                            aria-label={JOURS_LONGS[i] + (on ? " (actif)" : " (inactif)")}
                            aria-pressed={on}
                            onClick={() =>
                              setFDays(fDays.substring(0, i) + (on ? "0" : "1") + fDays.substring(i + 1))
                            }
                            className={"h-8 w-8 rounded-lg border text-xs font-bold transition " + (on ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300")}
                          >
                            {j}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              {formError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{formError}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void submitForm()}
                  disabled={formLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editId ? "Enregistrer" : "Créer le profil"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
                >
                  Annuler
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── N°346 — Toute la maison (box, routeurs, TV, consoles) ── */}
        <section id="maison" className="mt-8 scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Toute la maison
              <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Box · Starlink · routeurs
              </span>
            </h2>
            {home ? (
              <p className="text-xs font-medium text-slate-500">
                {home.bindings.length}/{home.limits.maxBindings} logements liés
              </p>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Pointez les serveurs DNS de votre box vers le résolveur 403Shield : chaque appareil du
            logement — TV, consoles, objets connectés, invités — est filtré <strong>sans rien
            installer</strong>. La liaison se fait par l&apos;IP publique de votre ligne : liez-la
            ci-dessous <em>depuis chez vous</em>, ou laissez la sonde la révéler.
          </p>

          {!udp53Enabled ? (
            <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-800">
              Le résolveur maison (UDP/53) est en cours d&apos;activation côté infrastructure. En
              attendant, les téléphones et ordinateurs du foyer sont déjà couvrables via les onglets
              Android, iPhone/iPad, Mac et Navigateurs.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* La carte résolveur : les valeurs à poser sur la box */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  DNS 1 — le résolveur du bouclier
                </p>
                {resolverIp ? (
                  <CopyField label="" value={resolverIp} hint="" />
                ) : (
                  <p className="mt-1 text-sm text-slate-500">détection de l&apos;adresse en cours — actualisez dans un instant</p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  <strong>DNS 2 : laissez celui de votre FAI.</strong> C&apos;est le filet de
                  secours — un bouclier injoignable ne coupe jamais Internet, il se laisse dépasser.
                </p>
              </div>

              {/* La carte sonde : tester la ligne */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tester ma ligne (2 minutes)
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Vérifie que votre FAI ne détourne pas le port 53 — et révèle l&apos;IP réelle de
                  votre box (utile si vous consultez cette page en 4G).
                </p>
                {!probe ? (
                  <button
                    type="button"
                    onClick={() => void startProbe()}
                    disabled={probeBusy}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {probeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                    Lancer le test
                  </button>
                ) : (
                  <div className="mt-2 grid gap-2">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Sur un appareil du logement — Windows (Invite de commandes)
                      </p>
                      <code className="mt-1 block break-all font-mono text-xs text-slate-800">
                        nslookup {probe.name} {resolverIp || home?.resolverIp || "<résolveur>"}
                      </code>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        macOS / Linux (Terminal)
                      </p>
                      <code className="mt-1 block break-all font-mono text-xs text-slate-800">
                        dig @{resolverIp || home?.resolverIp || "<résolveur>"} {probe.name}
                      </code>
                    </div>
                    {probeStatus?.status === "pending" ? (
                      <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600" />
                        En attente d&apos;une requête depuis chez vous… Si rien n&apos;arrive après
                        une minute, votre FAI détourne peut-être le port 53 : les onglets Android et
                        Apple (DNS chiffré) restent alors la voie.
                      </p>
                    ) : null}
                    {probeStatus?.status === "received" ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800">
                        <p className="font-semibold">
                          ✓ Ligne propre — requête reçue de {probeStatus.ip}
                        </p>
                        {probeStatus.bound ? (
                          <p className="mt-1">
                            {probeStatus.mine
                              ? "Cette IP est déjà liée à votre compte — votre maison est protégée."
                              : "Cette IP est déjà liée à un autre compte."}
                          </p>
                        ) : (
                          <div className="mt-1.5">
                            <p>C&apos;est l&apos;IP de votre box. Liez-la à un profil :</p>
                            <button
                              type="button"
                              onClick={() => {
                                setHIP(probeStatus.ip ?? "");
                                void claimHome(undefined, probeStatus.ip);
                              }}
                              disabled={hBusy}
                              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {hBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Lier {probeStatus.ip}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                    {probeStatus?.status === "expired" ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Sonde expirée (15 min) — relancez le test.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setProbe(null);
                        setProbeStatus(null);
                      }}
                      className="justify-self-start text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700"
                    >
                      Fermer le test
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Les liaisons du compte */}
          <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">
            Vos logements liés
          </h3>
          {homeLoading && !home ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Lecture…
            </p>
          ) : home && home.bindings.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {home.bindings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {b.label} <span className="font-mono font-normal text-slate-500">· {b.ip}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Profil « {b.profileName} » · dernière requête vue {timeAgo(b.lastQueryAt)} ·{" "}
                      {b.queryCount.toLocaleString("fr-FR")} requêtes servies
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.lastQueryAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <ShieldCheck className="h-3 w-3" /> protégée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        en attente de la box
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeHome(b.id, b.label)}
                      disabled={hBusy}
                      aria-label={`Détacher ${b.label}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
              Aucun logement lié pour l&apos;instant — remplissez le formulaire ci-dessous{" "}
              <em>depuis chez vous</em> (l&apos;IP de votre ligne se remplit seule).
            </p>
          )}

          {/* Le formulaire de liaison */}
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor="maison-profil" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Profil appliqué à la maison
              </label>
              <select
                id="maison-profil"
                value={hProfileId}
                onChange={(e) => setHProfileId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
              >
                {profiles.length === 0 ? <option value="">— aucun profil —</option> : null}
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({levelInfo(p.level).label})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="maison-label" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nom
                </label>
                <input
                  id="maison-label"
                  value={hLabel}
                  onChange={(e) => setHLabel(e.target.value)}
                  maxLength={60}
                  placeholder="Maison"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="maison-ip" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  IP publique
                </label>
                <input
                  id="maison-ip"
                  value={hIP}
                  onChange={(e) => setHIP(e.target.value)}
                  placeholder={home?.myIp || "détection…"}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void claimHome()}
                disabled={hBusy || profiles.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {hBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RouterIcon className="h-4 w-4" />}
                Lier mon logement
              </button>
            </div>
          </div>
          {home?.myIp ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Vous consultez cette page depuis <span className="font-mono">{home.myIp}</span> — si
              c&apos;est votre réseau domestique, c&apos;est la bonne IP. Sinon, lancez la sonde
              depuis chez vous.
            </p>
          ) : null}
          {hError ? (
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{hError}</p>
          ) : null}
          <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
            Honnêteté produit : certains FAI partagent une même IP publique entre foyers (CGNAT) —
            la liaison reste fonctionnelle mais le filtrage est alors celui du profil lié, partagé
            par tous les logements derrière cette IP. Si votre IP change (rébox, redémarrage FAI),
            re-liez simplement la nouvelle : la maison suit en un clic.
          </p>
        </section>
      </main>

      {/* ── Footer sticky ─────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:px-6">
          <p>
            403Shield Bouclier DNS — filtre par résolveur (DoH RFC 8484 + DoT RFC 7858). Un filtre en
            panne ne coupe jamais Internet : l&apos;appareil retombe sur son DNS habituel.
          </p>
          <p className="font-medium text-slate-400">FTech CI</p>
        </div>
      </footer>

      {/* ── Modale : installer sur un appareil (cœur N°345) ─────── */}
      {installFor ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Installation du profil"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInstallFor(null);
          }}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 pt-4 pb-3 backdrop-blur sm:px-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    ref={installHeadRef}
                    tabIndex={-1}
                    className="text-lg font-bold tracking-tight text-slate-900 outline-none"
                  >
                    Installer « {installFor.name} »
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Choisissez le système de l&apos;appareil — chaque méthode utilise les valeurs de
                    CE profil.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInstallFor(null)}
                  aria-label="Fermer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Systèmes">
                {SYSTEMES.map((s) => (
                  <button
                    key={s.key}
                    role="tab"
                    aria-selected={systeme === s.key}
                    onClick={() => setSysteme(s.key)}
                    className={
                      "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition " +
                      (systeme === s.key
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")
                    }
                  >
                    {s.icon}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-5 sm:px-7">
              {systeme === "android" ? (
                <div className="grid gap-4">
                  {dotEnabled ? (
                    <CopyField
                      label="Nom d'hôte du DNS privé Android"
                      value={installFor.dotHostname ?? ""}
                      hint="Android protège TOUT le téléphone (4G, 5G et WiFi, toutes les applications) avec ce seul réglage."
                    />
                  ) : (
                    <p className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-800">
                      Le serveur Android (DoT :853) est en cours d&apos;activation côté
                      infrastructure — l&apos;hôte ci-dessous est déjà le vôtre, il fonctionnera dès
                      l&apos;ouverture. En attendant, protégez ce téléphone via l&apos;onglet{" "}
                      <strong>Navigateurs</strong>.
                    </p>
                  )}
                  <CopyField
                    label="Votre hôte (à coller dans « DNS privé »)"
                    value={installFor.dotHostname ?? ""}
                    hint="Réglages → Réseau et Internet → DNS privé → « Nom d'hôte du fournisseur DNS privé »."
                  />
                  <ol className="grid gap-2.5">
                    <Step n={1}>
                      Ouvrez <strong>Réglages</strong> → <strong>Réseau et Internet</strong> (ou
                      « Connexions » selon la marque).
                    </Step>
                    <Step n={2}>
                      Appuyez sur <strong>DNS privé</strong> (parfois sous « Avancé » ou « DNS
                      chiffré »).
                    </Step>
                    <Step n={3}>
                      Choisissez <strong>Nom d&apos;hôte du fournisseur DNS privé</strong> et collez
                      l&apos;hôte ci-dessus, puis <strong>Enregistrer</strong>.
                    </Step>
                    <Step n={4}>
                      Vérifiez : le statut passe à « Connecté » et un site que vous avez bloqué
                      affiche une page vide ou une erreur — c&apos;est le bouclier.
                    </Step>
                  </ol>
                  <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
                    Compatible Android 9 et plus. Le filtrage suit la carte SIM et le WiFi — même en
                    4G chez un ami. Pour retirer : même écran, « Automatique ».
                  </p>
                </div>
              ) : null}

              {systeme === "iphone" || systeme === "mac" ? (
                <div className="grid gap-4">
                  <a
                    href={installFor.appleDohUrl ?? "#"}
                    download
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger le profil ({installFor.name})
                  </a>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Profil de configuration Apple généré pour CE profil (DNS chiffré DoH). Non
                    signé : iOS/macOS l&apos;indique à l&apos;installation — c&apos;est normal, il
                    vient de votre propre console.
                  </p>
                  {systeme === "iphone" ? (
                    <ol className="grid gap-2.5">
                      <Step n={1}>
                        Ouvrez ce lien dans <strong>Safari</strong> (pas dans une appli tierce) et
                        laissez le profil se télécharger.
                      </Step>
                      <Step n={2}>
                        Allez dans <strong>Réglages</strong> : la ligne{" "}
                        <strong>Profil téléchargé</strong> apparaît en haut — appuyez dessus.
                      </Step>
                      <Step n={3}>
                        <strong>Réglages</strong> → <strong>Général</strong> →{" "}
                        <strong>VPN et gestion d&apos;appareil</strong> → installez le profil
                        « 403Shield DNS — {installFor.name} ».
                      </Step>
                      <Step n={4}>
                        Vérifiez : un domaine de votre liste « bloquer » ne charge plus — c&apos;est
                        le bouclier. Pour retirer : même écran, « Supprimer le profil ».
                      </Step>
                    </ol>
                  ) : (
                    <ol className="grid gap-2.5">
                      <Step n={1}>
                        Téléchargez le profil ci-dessus puis ouvrez-le (double-clic sur le fichier{" "}
                        <code className="rounded bg-slate-100 px-1">.mobileconfig</code>).
                      </Step>
                      <Step n={2}>
                        <strong>Réglages Système</strong> → <strong>Confidentialité et sécurité</strong>{" "}
                        → <strong>Profils</strong> → installez « 403Shield DNS — {installFor.name} ».
                      </Step>
                      <Step n={3}>
                        Le DNS chiffré s&apos;applique à tout le Mac (toutes les applications). Pour
                        retirer : même écran, « − ».
                      </Step>
                    </ol>
                  )}
                  <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
                    Variante DoT (DNS privé TLS) :{" "}
                    <a
                      href={installFor.appleDotUrl ?? "#"}
                      download
                      className="font-semibold text-emerald-700 underline underline-offset-2"
                    >
                      profil TLS
                    </a>{" "}
                    — à partir d&apos;Android il utilise le même serveur :853.
                  </p>
                </div>
              ) : null}

              {systeme === "navigateurs" ? (
                <div className="grid gap-4">
                  <CopyField
                    label="URL DoH de ce profil"
                    value={installFor.setupUrl ?? ""}
                    hint="Fonctionne dans Chrome, Edge et Firefox — seul le navigateur est protégé."
                  />
                  <ol className="grid gap-2.5">
                    <Step n={1}>
                      <strong>Chrome / Edge</strong> : Réglages → Confidentialité et sécurité →
                      « Utiliser un DNS sécurisé » → <strong>Saisir un fournisseur personnalisé</strong>{" "}
                      → collez l&apos;URL.
                    </Step>
                    <Step n={2}>
                      <strong>Firefox</strong> : Réglages → Vie privée et sécurité → tout en bas,
                      « DNS via HTTPS » → <strong>Protection maximale</strong> →{" "}
                      <strong>Fournisseur personnalisé</strong> → collez l&apos;URL.
                    </Step>
                    <Step n={3}>
                      Redémarrez le navigateur, puis testez un domaine de votre liste « bloquer ».
                    </Step>
                  </ol>
                  <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
                    C&apos;est la méthode la plus rapide pour un PC sans installation — mais elle ne
                    couvre QUE le navigateur. Pour tout l&apos;appareil : onglet Windows (à venir)
                    ou profil Apple sur Mac.
                  </p>
                </div>
              ) : null}

              {systeme === "windows" ? (
                <div className="grid gap-4">
                  <CopyField
                    label="URL DoH de ce profil"
                    value={installFor.setupUrl ?? ""}
                    hint="Méthode immédiate : le navigateur (voir onglet Navigateurs)."
                  />
                  <ol className="grid gap-2.5">
                    <Step n={1}>
                      Protégez d&apos;abord le <strong>navigateur</strong> (onglet{" "}
                      <strong>Navigateurs</strong>) — deux minutes, aucun outil.
                    </Step>
                    <Step n={2}>
                      Windows 11 gère aussi le DNS chiffré <strong>au niveau système</strong>
                      (Réglages → Réseau → DNS) — l&apos;inscription d&apos;un résolveur personnalisé
                      se fait par PowerShell avec l&apos;adresse IP du serveur : le pas-à-pas arrive
                      avec le jalon routeurs.
                    </Step>
                  </ol>
                  <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
                    Honnêteté produit : nous ne livrons pas encore le guide natif Windows complet —
                    le navigateur couvre l&apos;essentiel de l&apos;usage familial aujourd&apos;hui.
                  </p>
                </div>
              ) : null}

              {systeme === "box" ? (
                <div className="grid gap-4">
                  {!udp53Enabled ? (
                    <p className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-800">
                      Le résolveur maison (UDP/53) est en cours d&apos;activation côté
                      infrastructure — le guide ci-dessous est déjà le bon. En attendant, les
                      onglets Android et Apple couvrent les téléphones et ordinateurs.
                    </p>
                  ) : null}
                  <ol className="grid gap-2.5">
                    <Step n={1}>
                      <strong>Liez d&apos;abord votre logement</strong> — la liaison identifie votre
                      ligne (IP publique) et lui applique CE profil. Depuis chez vous, un clic&nbsp;:
                      <div className="mt-1.5">
                        {home?.bindings?.some((b) => b.profileId === installFor.id && b.lastQueryAt) ? (
                          <p className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <Check className="h-3.5 w-3.5" /> Maison liée et déjà en train de filtrer
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void claimHome(installFor.id)}
                            disabled={hBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {hBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RouterIcon className="h-3.5 w-3.5" />}
                            Lier ce profil à mon logement
                          </button>
                        )}
                      </div>
                    </Step>
                    <Step n={2}>
                      Ouvrez les réglages de votre box : interface web (<code className="rounded bg-slate-100 px-1">192.168.1.1</code>{" "}
                      ou <code className="rounded bg-slate-100 px-1">192.168.0.1</code> selon le modèle), application de votre FAI, ou
                      application Starlink (Settings) pour une parabole.
                    </Step>
                    <Step n={3}>
                      Trouvez la section <strong>DNS</strong> (parfois « serveurs DNS », « DNS
                      personnalisés ») et posez <strong>DNS 1</strong> ={" "}
                      <span className="font-mono font-semibold text-slate-900">{resolverIp || "voir section Toute la maison"}</span>.
                      <strong> DNS 2 : laissez celui de votre FAI</strong> — filet de secours (un
                      bouclier injoignable ne coupe jamais Internet, il se laisse dépasser).
                    </Step>
                    <Step n={4}>
                      Enregistrez (redémarrez la box si elle le demande). Toute la maison passe par
                      le bouclier : TV, consoles, objets connectés et invités — sans rien installer.
                    </Step>
                  </ol>
                  <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
                    La santé de la maison (dernière requête vue, test de ligne contre le
                    détournement du port 53 par certains FAI) vit dans la section{" "}
                    <a href="#maison" className="font-semibold text-emerald-700 underline underline-offset-2">
                      Toute la maison
                    </a>{" "}
                    de cette page. Box du FAI, Starlink et routeurs persos : même méthode.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modale : journal des blocages ────────────────────────── */}
      {eventsFor ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Journal des blocages"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEventsFor(null);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
              <div>
                <h2
                  ref={eventsHeadRef}
                  tabIndex={-1}
                  className="text-lg font-bold tracking-tight text-slate-900 outline-none"
                >
                  Blocages — {eventsFor.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Les 100 plus récents. Les sites autorisés ne sont JAMAIS consignés (journal
                  minimal) ; purge à {journalJours} jours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEventsFor(null)}
                aria-label="Fermer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 sm:px-7">
              {eventsLoading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lecture du journal…
                </div>
              ) : !events || events.events.length === 0 ? (
                <div className="p-8 text-center text-sm leading-relaxed text-slate-500">
                  Aucun blocage consigné pour l&apos;instant. Soit l&apos;appareil n&apos;est pas
                  encore installé, soit tout ce qu&apos;il visite passe le filtre.
                </div>
              ) : (
                <ul className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto">
                  {events.events.map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-slate-800">{e.domain}</p>
                        <p className="text-xs text-slate-400">{formatTime(e.at)}</p>
                      </div>
                      <span
                        className={
                          "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                          (e.action === "curfew"
                            ? "border-slate-300 bg-slate-100 text-slate-600"
                            : "border-red-200 bg-red-50 text-red-600")
                        }
                      >
                        {e.action === "curfew" ? "Couvre-feu" : "Bloqué"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modale N°347 : renouvellement / découverte TOURACO ──── */}
      {renewFor || subscribeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={renewFor ? "Renouveler l'abonnement TOURACO" : "Découvrir l'abonnement TOURACO"}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSubModal();
          }}
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
              <div className="min-w-0">
                <h2
                  ref={renewHeadRef}
                  tabIndex={-1}
                  className="text-lg font-bold tracking-tight text-slate-900 outline-none"
                >
                  {renewFor ? `Renouveler ${renewFor.ref}` : "L'abonnement TOURACO"}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {renewFor
                    ? "Vos profils, règles et logements sont conservés — seule l'échéance s'étend." +
                      (renewFor.expiresAt ? ` Actuellement couvert jusqu'au ${formatDate(renewFor.expiresAt)}.` : "")
                    : "La vigie du foyer : le bouclier DNS aux capacités étendues, du nom de l'oiseau guetteur africain."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSubModal}
                aria-label="Fermer"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-5 sm:px-7">
              {renewFor ? (
                <>
                  {/* Formules — montants PAR MOYEN (frais répercutés côté
                      backend ; l'annuelle fait environ 2 mois offerts). */}
                  <fieldset>
                    <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Formule
                    </legend>
                    <div className="mt-2 grid gap-2">
                      {plans.length === 0 ? (
                        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-800">
                          Catalogue momentanément indisponible
                          {offers && !offers.enabled
                            ? " (la vente de l'abonnement DNS n'est pas ouverte pour le moment)"
                            : ""}{" "}
                          — réessayez dans un instant.
                        </p>
                      ) : (
                        plans.map((p) => {
                          const on = renewPlan === p.id;
                          return (
                            <label
                              key={p.id}
                              className={
                                "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition " +
                                (on
                                  ? "border-emerald-600 bg-emerald-500/10 text-slate-900"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300")
                              }
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <input
                                  type="radio"
                                  name="renew-plan"
                                  value={p.id}
                                  checked={on}
                                  onChange={() => setRenewPlan(p.id)}
                                  className="accent-emerald-600"
                                />
                                <span className="truncate">
                                  {p.label}
                                  <span className="ml-1 text-xs font-normal text-slate-500">({p.periodLabel})</span>
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block font-semibold tabular-nums">
                                  {formatFcfa(planAmount(p, renewMethod))}
                                </span>
                                <span className="block text-[11px] font-normal text-slate-500">
                                  Wave {formatFcfa(p.waveFcfa ?? p.baseFcfa)} · carte{" "}
                                  {formatFcfa(p.cardFcfa ?? p.baseFcfa)}
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </fieldset>

                  <fieldset className="mt-5">
                    <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Moyen de paiement
                    </legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRenewMethod("wave")}
                        aria-pressed={renewMethod === "wave"}
                        className={
                          "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition " +
                          (renewMethod === "wave"
                            ? "border-emerald-600 bg-emerald-500/10 text-slate-900"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300")
                        }
                      >
                        <Smartphone className="h-4 w-4" aria-hidden />
                        Wave
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenewMethod("card")}
                        aria-pressed={renewMethod === "card"}
                        className={
                          "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition " +
                          (renewMethod === "card"
                            ? "border-emerald-600 bg-emerald-500/10 text-slate-900"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300")
                        }
                      >
                        <CreditCard className="h-4 w-4" aria-hidden />
                        Carte
                      </button>
                    </div>
                    {renewMethod === "wave" ? (
                      <div className="mt-3">
                        <label htmlFor="renew-phone" className="text-xs font-medium text-slate-600">
                          Numéro Wave à débiter
                        </label>
                        <input
                          id="renew-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="07 00 00 00 00"
                          value={renewPhone}
                          onChange={(e) => setRenewPhone(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none"
                        />
                      </div>
                    ) : null}
                  </fieldset>

                  {/* Honeypot « website » : champ hors écran, non tabulable et
                      ignoré par les lecteurs d'écran — rempli = robot, le
                      backend répond un succès factice (pattern join N°27). */}
                  <input
                    type="text"
                    name="website"
                    value={renewWebsite}
                    onChange={(e) => setRenewWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  />

                  {renewError ? (
                    <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                      {renewError}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void submitRenew()}
                    disabled={renewLoading || plans.length === 0}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {renewLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    {renewLoading ? "Création du paiement…" : "Renouveler maintenant"}
                  </button>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
                    Paiement sécurisé par GeniusPay (Wave / carte). Sans moyen en ligne, la commande
                    passe en canal manuel — la plateforme confirmera l&apos;encaissement.
                  </p>
                </>
              ) : (
                <>
                  {/* Mode souscription : le renew n'existe pas sans commande
                      active — le canal d'achat d'un droit NEUF est la vitrine
                      publique (doctrine « un seul canal B2C »). */}
                  <div className="grid gap-2">
                    {plans.length > 0 ? (
                      plans.map((p) => (
                        <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {p.label}
                              <span className="font-normal text-slate-500"> · {p.periodLabel}</span>
                            </p>
                            <p className="text-sm font-bold tabular-nums text-emerald-700">
                              {formatFcfa(p.baseFcfa)}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Wave {formatFcfa(p.waveFcfa ?? p.baseFcfa)} · carte{" "}
                            {formatFcfa(p.cardFcfa ?? p.baseFcfa)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-600">
                        Les formules et montants exacts sont affichés sur la boutique au moment du
                        paiement.
                      </p>
                    )}
                  </div>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    <li className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-slate-700">
                      <strong className="tabular-nums">{TOURACO_CAPACITES.profils} profils</strong>{" "}
                      (contre {maxProfiles} aujourd&apos;hui)
                    </li>
                    <li className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-slate-700">
                      <strong className="tabular-nums">{TOURACO_CAPACITES.regles} règles</strong> par
                      liste (contre {maxRules})
                    </li>
                    <li className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-slate-700">
                      <strong className="tabular-nums">{TOURACO_CAPACITES.logements} logements</strong>{" "}
                      (domicile, bureau, maison de famille)
                    </li>
                    <li className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 px-3.5 py-2.5 text-sm text-slate-700">
                      Journal de blocage conservé{" "}
                      <strong className="tabular-nums">{TOURACO_CAPACITES.journalJours} jours</strong>
                    </li>
                  </ul>
                  <a
                    href={VITRINE_DNS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Souscrire sur la boutique 403Shield
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
                    La souscription se fait sur la vitrine publique 403Shield. Une fois le droit
                    actif, cet écran gère votre abonnement : échéance, capacités étendues et
                    renouvellement en un clic.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── N°347 — Notification canal manuel (miroir /me) ───────── */}
      {renewNotice ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto w-fit max-w-[92vw] rounded-xl border border-emerald-600/40 bg-white/95 px-5 py-3 text-sm text-emerald-800 shadow-lg"
        >
          {renewNotice}
          <button
            type="button"
            onClick={() => setRenewNotice("")}
            aria-label="Fermer"
            className="ml-3 text-emerald-700 hover:text-emerald-900"
          >
            <X className="inline h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
