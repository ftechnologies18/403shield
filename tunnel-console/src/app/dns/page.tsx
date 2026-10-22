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
// THEME : clair « console » (miroir /pro N°337 — mkdns-page), accents
// émeraude, wordmark aurora. Modales : bottom-sheet mobile + Escape +
// focus au titre (même confort que /me et /pro).

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban,
  CalendarClock,
  Check,
  Compass,
  Copy,
  Download,
  Globe,
  Laptop,
  Loader2,
  LogOut,
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
  dnsMe,
  dnsProfileCreate,
  dnsProfileDelete,
  dnsProfileEvents,
  dnsProfileUpdate,
  getToken,
  type DnsEventsResponse,
  type DnsMeResponse,
  type DnsProfile,
  type DnsProfilePayload,
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

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setMe(await dnsMe(token));
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Escape ferme les modales (même confort que /me et /pro).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInstallFor(null);
        setEventsFor(null);
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

  const dotEnabled = me?.setup?.dotEnabled ?? false;
  const profiles = me?.profiles ?? [];

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

        {/* ── Barre profils ────────────────────────────────────── */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Vos profils{" "}
            <span className="ml-1 text-sm font-medium text-slate-500">
              ({profiles.length}
              {me ? `/${me.limits.maxProfiles}` : ""})
            </span>
          </h2>
          <button
            type="button"
            onClick={openCreate}
            disabled={Boolean(me && profiles.length >= me.limits.maxProfiles)}
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
                    Bloquer « example.com » couvre aussi ses sous-domaines. {me?.limits.maxRules ?? 200} max.
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
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <RouterIcon className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Le jalon suivant du bouclier : la box et le routeur
                    </p>
                    <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
                      Un résolveur classique (UDP/53) protègera TOUTE la maison — box FAI, Starlink,
                      routeurs perso — sans rien installer sur les appareils : TV, consoles et
                      objets connectés compris.
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      <Globe className="h-3.5 w-3.5" /> Jalon N°346 — en préparation
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    En attendant : Android (onglet Android) et Apple (profil) couvrent déjà les
                    téléphones et ordinateurs du foyer — ce sont eux qui portent l&apos;essentiel du
                    trafic familial.
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
                  minimal) ; purge à 30 jours.
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
    </div>
  );
}
