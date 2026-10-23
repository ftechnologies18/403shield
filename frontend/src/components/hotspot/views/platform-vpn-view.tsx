"use client";

// N°301 — vue « VPN & Vente directe » (console plateforme — le GROSSISTE,
// chantier ⑧ de la feuille de route N°289/N°301) : ce que « wg-peer.sh list
// en SSH » faisait à la main, en trois onglets de console.
//
//   - Aperçu & comptes : jauge du pool wg0 TOUS comptes confondus (routeurs
//     de gestion inclus — D4-a), santé wg-mini, statistiques B2C, carte de
//     la vitrine publique /vpn (ouverture/fermeture — la fermeture n'annule
//     RIEN) et la table d'OCTROI du module de revente (activer = le gérant
//     vend ; retirer = verrouillé, il ne peut plus réactiver seul) ;
//   - Peers : le registre GLOBAL enrichi de la télémétrie VM (handshake,
//     transfert — fusion registre cloud ↔ wg-mini), révocation plateforme
//     d'un peer de N'IMPORTE QUEL compte (le levier ops) ;
//   - Commandes B2C : la file du canal direct — confirmation manuelle
//     (markPaid → provisioning AUTO), annulation (révoque le peer), suivi
//     des provisioning différés (ErrorMsg, rejoués par le balayage horaire) ;
//   - Commandes DNS (N°347) : la file TOURACO de la vitrine /dns — même
//     console que les commandes B2C (markPaid → activation AUTO, annulation
//     SANS suppression : les quotas retombent au gratuit), avec l'état
//     d'ouverture de la vitrine /dns (le levier vit dans les paramètres
//     plateforme, à côté du toggle VPN).
//
// La réconciliation GLOBALE (manquants + fantômes) vit dans le header : le
// bouton remplace le « wg-peer.sh list | diff » des ops.
//
// Doctrine du repo : l'UI masque ce que le serveur refuserait de toute façon
// (canView réserve la vue aux admins plateforme ; le serveur double la garde
// par isPlatformAdmin — rang 3). La conf ne sort JAMAIS de cette vue.

import { useMemo, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ExternalLink,
  Gauge,
  Loader2,
  Radio,
  Search,
  ShieldCheck,
  Store,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchPlatformDnsOrders,
  fetchPlatformSettings,
  fetchPlatformVpnOverview,
  fetchPlatformVpnOrders,
  fetchPlatformVpnPeers,
  fetchPlatformVpnReconcile,
  resolvePlatformDnsOrder,
  resolvePlatformVpnOrder,
  revokePlatformVpnPeer,
  setPlatformVpnModule,
  updatePlatformSettings,
} from "@/lib/hotspot/api";
import { ApiError } from "@/lib/hotspot/api";
import { useI18n } from "@/lib/hotspot/i18n";
import { formatBytes, formatCurrency, formatDate } from "@/lib/hotspot/format";
import { useCurrency } from "@/components/hotspot/parts/sd-currency";
import { EmptyState } from "@/components/hotspot/empty-state";
import { LoadingRows } from "@/components/hotspot/loading";
import { PageHeader } from "@/components/hotspot/page-header";
import { StatCard } from "@/components/hotspot/stat-card";
import type { PlatformVpnAccountRow, PlatformVpnPeerRow, PublicDnsOrder, PublicVpnOrder } from "@/lib/hotspot/types";

const REFRESH_OPTIONS = [
  { value: "10000", label: "10 s" },
  { value: "30000", label: "30 s" },
  { value: "60000", label: "60 s" },
];

const OVERVIEW_KEY = ["/api/admin/vpn/overview"] as const;
const PEERS_KEY = ["/api/admin/vpn/peers"] as const;
const ORDERS_KEY = ["/api/admin/vpn/orders"] as const;
// N°347 — file des commandes DNS TOURACO + état de la vitrine /dns (même
// clé de cache que platform-settings-view, où vit le toggle publicDnsShop).
const DNS_ORDERS_KEY = ["/api/admin/dns/orders"] as const;
const PLATFORM_SETTINGS_KEY = ["/api/admin/platform/settings"] as const;

/** N°347 — libellé de formule depuis planId + months (miroir du catalogue
 * backend PublicDnsPlans : dns-month = TOURACO Mensuel, dns-year = TOURACO
 * Annuel — repli honnête sur la durée couverte si le catalogue évolue). */
function dnsPlanLabel(planId: string, months: number): string {
  if (planId === "dns-year" || months >= 12) return "TOURACO Annuel";
  if (planId === "dns-month" || months >= 1) return "TOURACO Mensuel";
  return "TOURACO";
}

/** Badge d'état d'un peer (miroir vpn-view). */
function PeerStateBadge({ state }: { state: string }) {
  const { t } = useI18n();
  if (state === "active") {
    return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{t("vpn.state.active")}</Badge>;
  }
  if (state === "pending") {
    return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">{t("vpn.state.pending")}</Badge>;
  }
  return <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">{t("vpn.state.error")}</Badge>;
}

/** N°311 — jauge du quota mensuel d'un peer (rx+tx, mois calendaire UTC) :
 * cumul formaté + limite ; ambre à l'approche (≥ 80 %), rouge au dépassement
 * (la révocation automatique suit sous 15 min), 0 = illimité (cumul seul). */
function VpnQuotaCell({ bytes, limitGb, lang }: { bytes: number; limitGb: number; lang: "fr" | "en" }) {
  const { t } = useI18n();
  const limitBytes = limitGb * (1 << 30);
  const unit = lang === "fr" ? "Go" : "GB";
  const tone =
    limitGb > 0 && bytes > limitBytes
      ? "text-sm font-medium text-destructive"
      : limitGb > 0 && bytes >= limitBytes * 0.8
        ? "text-sm font-medium text-amber-600 dark:text-amber-400"
        : "text-sm text-muted-foreground";
  return (
    <span className="flex items-baseline gap-1.5" title={t("vpn.quota.title")}>
      <span className={tone}>{formatBytes(bytes, lang)}</span>
      {limitGb > 0 ? (
        <span className="text-xs text-muted-foreground">
          / {limitGb} {unit}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">· {t("vpn.quota.unlimited")}</span>
      )}
    </span>
  );
}

/** Badge d'état d'une commande (B2C VPN N°301 et DNS TOURACO N°347 — mêmes
 * couleurs ; les libellés vivent sous le préfixe de domaine passé). */
function OrderStateBadge({ status, keyPrefix = "platformVpn.orders.status" }: { status: string; keyPrefix?: string }) {
  const { t } = useI18n();
  const key = `${keyPrefix}.${status}`;
  const label = t(key);
  const cls =
    status === "provisioned"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status === "paid"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
        : status === "pending"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-muted bg-muted text-muted-foreground";
  return <Badge variant="outline" className={cls}>{label === key ? status : label}</Badge>;
}

export default function PlatformVpnView() {
  const { t, tf, lang } = useI18n();
  const queryClient = useQueryClient();
  const currency = useCurrency();

  const [tab, setTab] = useState<string>("overview");
  const [refreshMs, setRefreshMs] = useState(30_000);
  const [peerQuery, setPeerQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  // N°347 — recherche de la file DNS (réf MCD-, e-mail, formule, cible).
  const [dnsOrderQuery, setDnsOrderQuery] = useState("");

  // Confirmation en attente (module grant/withdraw, revoke peer, order resolve).
  type ConfirmKind = "grant" | "withdraw" | "revoke" | "markPaid" | "cancel" | "dnsMarkPaid" | "dnsCancel";
  const [confirm, setConfirm] = useState<
    | { kind: ConfirmKind; account?: PlatformVpnAccountRow; peer?: PlatformVpnPeerRow; order?: PublicVpnOrder; dnsOrder?: PublicDnsOrder }
    | null
  >(null);

  const [reconcileResult, setReconcileResult] = useState<{ missing: string[]; ghosts: { name: string; ip: string }[]; vmPeerCount: number; cloudActive: number } | null>(null);

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => fetchPlatformVpnOverview(),
    refetchInterval: refreshMs,
  });

  const peersEnabled = tab === "peers";
  const { data: peersData, isLoading: peersLoading } = useQuery({
    queryKey: PEERS_KEY,
    queryFn: () => fetchPlatformVpnPeers(),
    refetchInterval: refreshMs,
    enabled: peersEnabled,
  });

  const ordersEnabled = tab === "orders";
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => fetchPlatformVpnOrders(),
    refetchInterval: refreshMs,
    enabled: ordersEnabled,
  });

  // N°347 — file des commandes de l'abonnement DNS « TOURACO » (chargée à
  // l'ouverture de l'onglet, miroir de la file B2C) + état de la vitrine
  // /dns (même cache que platform-settings-view, où vit le toggle).
  const dnsTabEnabled = tab === "dns";
  const { data: dnsOrdersData, isLoading: dnsOrdersLoading } = useQuery({
    queryKey: DNS_ORDERS_KEY,
    queryFn: () => fetchPlatformDnsOrders(),
    refetchInterval: refreshMs,
    enabled: dnsTabEnabled,
  });
  const { data: dnsSettingsData } = useQuery({
    queryKey: PLATFORM_SETTINGS_KEY,
    queryFn: () => fetchPlatformSettings(),
    refetchInterval: refreshMs,
    enabled: dnsTabEnabled,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    void queryClient.invalidateQueries({ queryKey: PEERS_KEY });
    void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    void queryClient.invalidateQueries({ queryKey: DNS_ORDERS_KEY });
  };

  const reconcileMutation = useMutation({
    mutationFn: () => fetchPlatformVpnReconcile(),
    onSuccess: (res) => {
      setReconcileResult({ missing: res.missing, ghosts: res.ghosts, vmPeerCount: res.vmPeerCount, cloudActive: res.cloudActive });
      void queryClient.invalidateQueries({ queryKey: PEERS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const moduleMutation = useMutation({
    mutationFn: ({ accountId, enabled }: { accountId: string; enabled: boolean }) => setPlatformVpnModule(accountId, enabled),
    onSuccess: (res, vars) => {
      toast.success(vars.enabled ? t("platformVpn.accounts.grantToast") : t("platformVpn.accounts.withdrawToast"));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokePlatformVpnPeer(id),
    onSuccess: (res) => {
      toast.success(res.message || t("platformVpn.peers.revokeToast"));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "markPaid" | "cancel" }) => resolvePlatformVpnOrder(id, action),
    onSuccess: (res) => {
      if (res.status === "paid") {
        // Provisioning différé (wg-mini down / pool) : informatif, pas un échec.
        toast.info(res.message);
      } else {
        toast.success(res.message || t("platformVpn.orders.confirmPaidToast"));
      }
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // N°347 — résolution d'une commande DNS TOURACO : markPaid (encaissement
  // du canal manual + activation AUTO — la réponse porte l'échéance) ou
  // cancel (si provisionnée : le droit cesse, les quotas retombent au
  // gratuit, RIEN n'est supprimé). Mêmes toasts que la file VPN.
  const dnsResolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "markPaid" | "cancel" }) => resolvePlatformDnsOrder(id, action),
    onSuccess: (res) => {
      if (res.status === "paid") {
        // Provisioning différé (rejoué par le balayage) : informatif, pas un échec.
        toast.info(res.message);
      } else {
        toast.success(res.message || t("platformDns.orders.confirmPaidToast"));
      }
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // N°301 — ouverture/fermeture de la vitrine B2C (/vpn) : passe par les
  // paramètres plateforme (PUT /api/admin/platform/settings) ; la
  // FERMETURE n'annule rien (les commandes en service restent actives).
  const shopToggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updatePlatformSettings({ publicVpnShop: enabled }),
    onSuccess: (_res, enabled) => {
      toast.success(enabled ? t("platformVpn.shop.openToast") : t("platformVpn.shop.closedToast"));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredPeers = useMemo(() => {
    const peers = peersData?.peers ?? [];
    const q = peerQuery.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter((p) =>
      [p.name, p.label, p.accountName, p.orderEmail ?? "", p.orderRef ?? ""].some((v) => v.toLowerCase().includes(q)),
    );
  }, [peersData, peerQuery]);

  const filteredOrders = useMemo(() => {
    const orders = ordersData?.orders ?? [];
    const q = orderQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => [o.ref, o.email, o.peerName, o.planId].some((v) => v.toLowerCase().includes(q)));
  }, [ordersData, orderQuery]);

  // N°347 — filtre de la file DNS (réf MCD-, e-mail, formule, cible de renouvellement).
  const filteredDnsOrders = useMemo(() => {
    const orders = dnsOrdersData?.orders ?? [];
    const q = dnsOrderQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => [o.ref, o.email, o.planId, o.renewTargetRef ?? ""].some((v) => v.toLowerCase().includes(q)));
  }, [dnsOrdersData, dnsOrderQuery]);

  // ─── État de chargement / erreur 403 (miroir platform-team-view) ───
  if (overviewLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title={t("platformVpn.title")} description={t("platformVpn.description")} />
        <Card className="gap-0 py-0">
          <LoadingRows rows={6} />
        </Card>
      </div>
    );
  }
  if (overviewError) {
    const forbidden = overviewError instanceof ApiError && overviewError.status === 403;
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title={t("platformVpn.title")} description={t("platformVpn.description")} />
        <Card className="py-10">
          <EmptyState
            icon={ShieldCheck}
            title={forbidden ? t("accounts.forbiddenTitle") : t("common.error")}
            description={overviewError.message}
          />
        </Card>
      </div>
    );
  }

  const pool = overview?.pool;
  const b2c = overview?.b2c;
  const mini = overview?.mini;
  const slotsUsed = pool?.slotsUsed ?? 0;
  const slotsPool = pool?.slotsPool ?? 253;
  // N°311 — quota mensuel EFFECTIF par peer (Go ; 0 = illimité, défaut 50).
  const quotaGb = overview?.quotaMonthlyGb ?? 50;
  const resellerAccounts = (pool?.byAccount ?? []).filter((a) => a.accountId !== "acc-main");
  const b2cActive = (b2c?.provisioned ?? 0) + (b2c?.paid ?? 0);
  const pendingTotal = (b2c?.pending ?? 0);

  // N°347 — vitrine /dns (affichage d'état dans l'onglet DNS) + compteurs
  // de file (pending en tête côté serveur, plafond 200).
  const dnsShopOpen = dnsSettingsData?.platform.publicDnsShopEnabled === true;
  const dnsPendingTotal = (dnsOrdersData?.orders ?? []).filter((o) => o.status === "pending").length;
  // La recherche du header suit l'onglet actif (file B2C VPN / file DNS / peers).
  const searchValue = tab === "dns" ? dnsOrderQuery : tab === "orders" ? orderQuery : peerQuery;
  const searchPlaceholder =
    tab === "dns" ? t("platformDns.orders.search") : tab === "orders" ? t("platformVpn.orders.search") : t("platformVpn.peers.search");
  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (tab === "dns") setDnsOrderQuery(event.target.value);
    else if (tab === "orders") setOrderQuery(event.target.value);
    else setPeerQuery(event.target.value);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("platformVpn.title")}
        description={t("platformVpn.description")}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-10 gap-1.5"
              disabled={reconcileMutation.isPending}
              onClick={() => reconcileMutation.mutate()}
            >
              {reconcileMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="size-4" aria-hidden />
              )}
              {t("platformVpn.reconcile")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-10 gap-1.5"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
                void queryClient.invalidateQueries({ queryKey: PEERS_KEY });
                void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
                // N°347 — la file DNS et l'état de la vitrine /dns suivent.
                void queryClient.invalidateQueries({ queryKey: DNS_ORDERS_KEY });
                void queryClient.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
              }}
            >
              <Radio className="size-4" aria-hidden />
              {t("platformVpn.refresh")}
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={searchValue}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                className="hidden h-10 w-40 pl-9 sm:block sm:w-56"
                aria-label={searchPlaceholder}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">{t("sessions.refresh")}</span>
              <select
                value={String(refreshMs)}
                onChange={(event) => setRefreshMs(Number(event.target.value))}
                className="h-9 rounded-md border bg-transparent px-2 text-xs"
                aria-label={t("sessions.refreshLabel")}
              >
                {REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
      />

      {/* ─── KPIs du grossiste ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gauge className="size-4 text-muted-foreground" aria-hidden />
            {t("platformVpn.kpi.pool")}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {slotsUsed}
            <span className="text-sm font-normal text-muted-foreground"> / {slotsPool}</span>
          </div>
          <Progress
            className="mt-2 h-1.5"
            value={Math.min(100, (slotsUsed / Math.max(1, slotsPool)) * 100)}
            aria-label={tf("platformVpn.kpi.poolSub", { used: String(slotsUsed), pool: String(slotsPool) })}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {tf("platformVpn.kpi.poolSub", { used: String(slotsUsed), pool: String(slotsPool) })}
          </p>
        </div>
        <StatCard
          title={t("platformVpn.kpi.resellers")}
          value={String(resellerAccounts.filter((a) => a.moduleOn).length)}
          sub={t("platformVpn.kpi.resellersSub")}
          icon={Store}
        />
        <StatCard
          title={t("platformVpn.kpi.b2c")}
          value={String(b2cActive)}
          sub={pendingTotal > 0 ? tf("platformVpn.shop.pendingHint", { n: String(pendingTotal) }) : t("platformVpn.kpi.b2cSub")}
          icon={ShieldCheck}
          live
        />
        <StatCard
          title={t("platformVpn.kpi.revenue")}
          value={formatCurrency(b2c?.revenueFcfa ?? 0, currency, lang)}
          sub={t("platformVpn.kpi.revenueSub")}
          icon={Wallet}
        />
      </div>

      {/* ─── Santé VM (bandeau si wg-mini injoignable) ─── */}
      {mini && !mini.reachable && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center gap-3">
            <TriangleAlert className="size-5 text-amber-600" aria-hidden />
            <div>
              <p className="text-sm font-medium">{t("platformVpn.kpi.vmDown")}</p>
              <p className="text-xs text-muted-foreground">{mini.error ?? t("platformVpn.kpi.vmDownSub")}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Quatre onglets : défilement horizontal sur petit écran (miroir du
          pattern TabsList de platform-settings-view). */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">{t("platformVpn.tab.overview")}</TabsTrigger>
          <TabsTrigger value="peers">{tf("platformVpn.tab.peers", { n: String(peersData?.peers.length ?? pool?.slotsUsed ?? 0) })}</TabsTrigger>
          <TabsTrigger value="orders">{tf("platformVpn.tab.orders", { n: String(ordersData?.orders.length ?? 0) })}</TabsTrigger>
          {/* N°347 — file des commandes de l'abonnement DNS « TOURACO ». */}
          <TabsTrigger value="dns">{tf("platformDns.tab.dns", { n: String(dnsOrdersData?.orders.length ?? 0) })}</TabsTrigger>
        </TabsList>

        {/* ═══ Onglet 1 : Aperçu & comptes (octroi) ═══ */}
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          {/* Carte vitrine publique (vente directe B2C) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="size-5 text-muted-foreground" aria-hidden />
                {t("platformVpn.shop.title")}
                <Badge variant="outline" className={b2c?.shopEnabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ""}>
                  {b2c?.shopEnabled ? t("platformVpn.shop.open") : t("platformVpn.shop.closed")}
                </Badge>
              </CardTitle>
              <CardDescription>{t("platformVpn.shop.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant={b2c?.shopEnabled ? "outline" : "default"}
                className="h-9 gap-1.5"
                disabled={shopToggleMutation.isPending}
                onClick={() => shopToggleMutation.mutate(!b2c?.shopEnabled)}
              >
                {shopToggleMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : b2c?.shopEnabled ? (
                  <Ban className="size-4" aria-hidden />
                ) : (
                  <Store className="size-4" aria-hidden />
                )}
                {b2c?.shopEnabled ? t("platformVpn.shop.toggleOff") : t("platformVpn.shop.toggle")}
              </Button>
              {/* N°316 — la boutique B2C vit sur la console 403Shield
                  (tunnel.ftci.fr/shop ; /vpn?order=… répond 301 vers elle). */}
              <a
                href="https://tunnel.ftci.fr/shop"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
              >
                <ExternalLink className="size-4" aria-hidden />
                {t("platformVpn.shop.link")}
              </a>
              {(b2c?.pending ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  {tf("platformVpn.shop.pendingHint", { n: String(b2c?.pending ?? 0) })}
                </span>
              )}
              {(b2c?.paid ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  {tf("platformVpn.shop.paidHint", { n: String(b2c?.paid ?? 0) })}
                </span>
              )}
            </CardContent>
          </Card>

          {/* Table d'octroi du module par compte */}
          <Card className="gap-0 py-0">
            <div className="p-6 pb-0">
              <h3 className="text-sm font-semibold">{t("platformVpn.accounts.title")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t("platformVpn.accounts.desc")}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("platformVpn.accounts.account")}</TableHead>
                  <TableHead>{t("platformVpn.accounts.peers")}</TableHead>
                  <TableHead>{t("platformVpn.accounts.module")}</TableHead>
                  <TableHead className="text-right">{t("vpn.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pool?.byAccount ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32">
                      <EmptyState icon={Store} title={t("platformVpn.accounts.empty")} />
                    </TableCell>
                  </TableRow>
                ) : (
                  (pool?.byAccount ?? []).map((row) => (
                    <TableRow key={row.accountId}>
                      <TableCell>
                        <div className="font-medium">{row.accountName || row.accountId}</div>
                        <div className="text-xs text-muted-foreground">{row.usage}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.peersActive} / {row.peersTotal}
                      </TableCell>
                      <TableCell>
                        {row.locked ? (
                          <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">{t("platformVpn.accounts.moduleLocked")}</Badge>
                        ) : row.moduleOn ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{t("platformVpn.accounts.moduleOn")}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-muted bg-muted text-muted-foreground">{t("platformVpn.accounts.moduleOff")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.accountId !== "acc-main" && (
                          <Button
                            size="sm"
                            variant={row.moduleOn && !row.locked ? "outline" : "default"}
                            className="h-8"
                            disabled={moduleMutation.isPending}
                            onClick={() => {
                              if (row.moduleOn && !row.locked) {
                                setConfirm({ kind: "withdraw", account: row });
                              } else {
                                setConfirm({ kind: "grant", account: row });
                              }
                            }}
                          >
                            {row.moduleOn && !row.locked ? t("platformVpn.accounts.withdraw") : t("platformVpn.accounts.grant")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ═══ Onglet 2 : Peers (registre global + télémétrie) ═══ */}
        <TabsContent value="peers">
          <Card className="gap-0 py-0">
            {peersLoading ? (
              <LoadingRows rows={6} />
            ) : filteredPeers.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={ShieldCheck}
                  title={(peersData?.peers.length ?? 0) === 0 ? t("platformVpn.peers.empty") : t("platformVpn.peers.noMatch")}
                />
              </div>
            ) : (
              <>
                {peersData && !peersData.vmReachable && (
                  <p className="px-6 pt-4 text-xs text-amber-600">{t("platformVpn.peers.vmDown")}</p>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("platformVpn.peers.name")}</TableHead>
                      <TableHead>{t("platformVpn.peers.account")}</TableHead>
                      <TableHead>{t("platformVpn.peers.address")}</TableHead>
                      <TableHead>{t("platformVpn.peers.state")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("platformVpn.peers.handshake")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("platformVpn.peers.transfer")}</TableHead>
                      <TableHead className="hidden xl:table-cell">{t("vpn.quota")}</TableHead>
                      <TableHead className="hidden xl:table-cell">{t("platformVpn.peers.term")}</TableHead>
                      <TableHead className="text-right">{t("vpn.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPeers.map((peer) => (
                      <TableRow key={peer.id}>
                        <TableCell>
                          <div className="font-medium">{peer.label || peer.name}</div>
                          <div className="text-xs text-muted-foreground">{peer.name}</div>
                          {/* N°312 — badge de forme : supervision (remote) vs
                              client final ; distinct du badge B2C (canal). */}
                          {peer.kind === "remote" && (
                            <Badge
                              variant="outline"
                              title={t("vpn.kind.remote.title")}
                              className="mt-1 border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            >
                              {t("vpn.kind.remote")}
                            </Badge>
                          )}
                          {peer.b2c && (
                            <Badge variant="outline" className="mt-1 border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400">
                              {t("platformVpn.peers.b2c")} {peer.orderRef}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{peer.accountName || peer.accountId}</div>
                          {peer.orderEmail && <div className="text-xs text-muted-foreground">{peer.orderEmail}</div>}
                        </TableCell>
                        <TableCell className="tabular-nums">{peer.ipv4 || t("vpn.noAddress")}</TableCell>
                        <TableCell>
                          <PeerStateBadge state={peer.state} />
                          {peer.state === "error" && peer.errorMsg && (
                            <div className="mt-1 max-w-40 text-xs text-red-600">{peer.errorMsg}</div>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          {peer.handshake || t("platformVpn.peers.noHandshake")}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                          {peer.transfer || t("platformVpn.peers.noHandshake")}
                        </TableCell>
                        {/* N°311 — jauge du quota mensuel (rx+tx, mois calendaire
                            UTC) : ambre à l'approche, rouge au dépassement (la
                            révocation automatique suit sous 15 min). */}
                        <TableCell className="hidden xl:table-cell">
                          <VpnQuotaCell bytes={peer.quotaBytes} limitGb={quotaGb} lang={lang} />
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                          {peer.expiresAt ? formatDate(peer.expiresAt, lang) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-red-600 hover:text-red-700"
                            disabled={revokeMutation.isPending || peer.state === "pending"}
                            onClick={() => setConfirm({ kind: "revoke", peer })}
                          >
                            {t("platformVpn.peers.revoke")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </Card>
        </TabsContent>

        {/* ═══ Onglet 3 : Commandes B2C (vente directe) ═══ */}
        <TabsContent value="orders">
          <Card className="gap-0 py-0">
            {ordersLoading ? (
              <LoadingRows rows={6} />
            ) : filteredOrders.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Store}
                  title={(ordersData?.orders.length ?? 0) === 0 ? t("platformVpn.orders.empty") : t("platformVpn.orders.noMatch")}
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("platformVpn.orders.ref")}</TableHead>
                    <TableHead>{t("platformVpn.orders.email")}</TableHead>
                    <TableHead>{t("platformVpn.orders.plan")}</TableHead>
                    <TableHead>{t("platformVpn.orders.amount")}</TableHead>
                    <TableHead>{t("platformVpn.orders.payMethod")}</TableHead>
                    <TableHead>{t("platformVpn.orders.status")}</TableHead>
                    <TableHead className="hidden xl:table-cell">{t("platformVpn.orders.term")}</TableHead>
                    <TableHead className="text-right">{t("vpn.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{order.ref}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(order.createdAt, lang)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{order.email}</div>
                        {order.errorMsg && (
                          <div className="max-w-48 text-xs text-amber-600">
                            {tf("platformVpn.orders.errorHint", { error: order.errorMsg })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{order.months} mois</div>
                        <div className="text-xs text-muted-foreground">{order.peerName || "—"}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(order.amountFcfa, currency, lang)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-muted bg-muted text-muted-foreground">
                          {t(`platformVpn.orders.pay.${order.payMethod}`) === `platformVpn.orders.pay.${order.payMethod}` ? order.payMethod : t(`platformVpn.orders.pay.${order.payMethod}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <OrderStateBadge status={order.status} />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                        {order.expiresAt ? formatDate(order.expiresAt, lang) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              className="h-8"
                              disabled={resolveMutation.isPending}
                              onClick={() => setConfirm({ kind: "markPaid", order })}
                            >
                              {t("platformVpn.orders.confirmPaid")}
                            </Button>
                          )}
                          {["pending", "paid", "provisioned"].includes(order.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-red-600 hover:text-red-700"
                              disabled={resolveMutation.isPending}
                              onClick={() => setConfirm({ kind: "cancel", order })}
                            >
                              {t("platformVpn.orders.cancel")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ═══ Onglet 4 : Commandes DNS — abonnement TOURACO (vitrine /dns) ═══ */}
        <TabsContent value="dns" className="space-y-4 sm:space-y-6">
          {/* État de la vitrine /dns (affichage simple — le levier d'ouverture
              vit dans Paramètres plateforme, à côté du toggle VPN N°301 ;
              la fermeture n'annule rien : les droits courent jusqu'à leur terme). */}
          {dnsSettingsData && (
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Store className="size-5 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {t("platformDns.shop.title")}
                    <Badge
                      variant="outline"
                      className={
                        dnsShopOpen ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ""
                      }
                    >
                      {dnsShopOpen ? t("platformDns.shop.open") : t("platformDns.shop.closed")}
                    </Badge>
                    {dnsPendingTotal > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {tf("platformDns.shop.pendingHint", { n: String(dnsPendingTotal) })}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("platformDns.shop.note")}</p>
                </div>
                <span className="text-xs text-muted-foreground">{t("platformDns.shop.manage")}</span>
              </div>
            </Card>
          )}

          {/* File des commandes (miroir « Commandes B2C » — pending en tête). */}
          <Card className="gap-0 py-0">
            {dnsOrdersLoading ? (
              <LoadingRows rows={6} />
            ) : filteredDnsOrders.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={ShieldCheck}
                  title={(dnsOrdersData?.orders.length ?? 0) === 0 ? t("platformDns.orders.empty") : t("platformDns.orders.noMatch")}
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("platformDns.orders.ref")}</TableHead>
                    <TableHead>{t("platformDns.orders.email")}</TableHead>
                    <TableHead>{t("platformDns.orders.plan")}</TableHead>
                    <TableHead>{t("platformDns.orders.amount")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("platformDns.orders.payMethod")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("platformDns.orders.kind")}</TableHead>
                    <TableHead>{t("platformDns.orders.status")}</TableHead>
                    <TableHead className="hidden xl:table-cell">{t("platformDns.orders.term")}</TableHead>
                    <TableHead className="hidden xl:table-cell">{t("platformDns.orders.created")}</TableHead>
                    <TableHead className="hidden xl:table-cell">{t("platformDns.orders.resolvedBy")}</TableHead>
                    <TableHead className="text-right">{t("vpn.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDnsOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{order.ref}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{order.email}</div>
                        {order.errorMsg && (
                          <div className="max-w-48 text-xs text-amber-600">
                            {tf("platformDns.orders.errorHint", { error: order.errorMsg })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{dnsPlanLabel(order.planId, order.months)}</div>
                        <div className="text-xs text-muted-foreground">
                          {tf("platformDns.orders.months", { n: String(order.months) })}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(order.amountFcfa, currency, lang)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="border-muted bg-muted text-muted-foreground">
                          {t(`platformDns.orders.pay.${order.payMethod}`) === `platformDns.orders.pay.${order.payMethod}`
                            ? order.payMethod
                            : t(`platformDns.orders.pay.${order.payMethod}`)}
                        </Badge>
                      </TableCell>
                      {/* Genre : vente classique ou renouvellement (l'échéance
                          étendue vit sur la CIBLE, la ligne reste une facturation). */}
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">
                          {order.kind === "renewal" ? t("platformDns.orders.kind.renewal") : t("platformDns.orders.kind.sale")}
                        </div>
                        {order.kind === "renewal" && order.renewTargetRef && (
                          <div className="font-mono text-xs text-muted-foreground">
                            {tf("platformDns.orders.kindTarget", { ref: order.renewTargetRef })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <OrderStateBadge status={order.status} keyPrefix="platformDns.orders.status" />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                        {order.expiresAt ? formatDate(order.expiresAt, lang) : "—"}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                        {formatDate(order.createdAt, lang)}
                      </TableCell>
                      <TableCell
                        className="hidden max-w-40 truncate text-xs text-muted-foreground xl:table-cell"
                        title={order.errorMsg ?? undefined}
                      >
                        {order.resolvedBy || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              className="h-8"
                              disabled={dnsResolveMutation.isPending}
                              onClick={() => setConfirm({ kind: "dnsMarkPaid", dnsOrder: order })}
                            >
                              {t("platformDns.orders.confirmPaid")}
                            </Button>
                          )}
                          {["pending", "paid", "provisioned"].includes(order.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-red-600 hover:text-red-700"
                              disabled={dnsResolveMutation.isPending}
                              onClick={() => setConfirm({ kind: "dnsCancel", dnsOrder: order })}
                            >
                              {t("platformDns.orders.cancel")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Dialog résultat de réconciliation ─── */}
      <Dialog open={reconcileResult !== null} onOpenChange={(open) => !open && setReconcileResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("platformVpn.reconcile.title")}</DialogTitle>
            <DialogDescription>{t("platformVpn.reconcile.desc")}</DialogDescription>
          </DialogHeader>
          {reconcileResult && (
            <div className="space-y-3">
              <p className="text-sm">
                {reconcileResult.missing.length === 0 && reconcileResult.ghosts.length === 0
                  ? tf("platformVpn.reconcile.ok", { vm: String(reconcileResult.vmPeerCount), cloud: String(reconcileResult.cloudActive) })
                  : tf("platformVpn.reconcile.ok", { vm: String(reconcileResult.vmPeerCount), cloud: String(reconcileResult.cloudActive) })}
              </p>
              <div>
                <p className="text-sm font-medium">{tf("platformVpn.reconcile.missing", { n: String(reconcileResult.missing.length) })}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {reconcileResult.missing.length > 0 ? reconcileResult.missing.join(", ") : t("platformVpn.reconcile.none")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">{tf("platformVpn.reconcile.ghosts", { n: String(reconcileResult.ghosts.length) })}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {reconcileResult.ghosts.length > 0
                    ? reconcileResult.ghosts.map((g) => `${g.name} (${g.ip})`).join(", ")
                    : t("platformVpn.reconcile.none")}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setReconcileResult(null)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Confirmations (grant / withdraw / revoke / markPaid / cancel) ─── */}
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm?.kind === "withdraw" && confirm.account && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("platformVpn.accounts.confirmWithdrawTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tf("platformVpn.accounts.confirmWithdrawDesc", { account: confirm.account.accountName || confirm.account.accountId })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    moduleMutation.mutate({ accountId: confirm.account!.accountId, enabled: false });
                    setConfirm(null);
                  }}
                >
                  {t("platformVpn.accounts.withdraw")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === "grant" && confirm.account && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("platformVpn.accounts.confirmGrantTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tf("platformVpn.accounts.confirmGrantDesc", { account: confirm.account.accountName || confirm.account.accountId })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    moduleMutation.mutate({ accountId: confirm.account!.accountId, enabled: true });
                    setConfirm(null);
                  }}
                >
                  {t("platformVpn.accounts.grant")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === "revoke" && confirm.peer && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("platformVpn.peers.confirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tf("platformVpn.peers.confirmDesc", {
                    name: confirm.peer.label || confirm.peer.name,
                    account: confirm.peer.accountName || confirm.peer.accountId,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={(event) => {
                    event.preventDefault();
                    revokeMutation.mutate(confirm.peer!.id);
                    setConfirm(null);
                  }}
                >
                  {t("platformVpn.peers.revoke")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === "markPaid" && confirm.order && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("platformVpn.orders.confirmPaidTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tf("platformVpn.orders.confirmPaidDesc", {
                    ref: confirm.order.ref,
                    amount: formatCurrency(confirm.order.amountFcfa, currency, lang),
                    email: confirm.order.email,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    resolveMutation.mutate({ id: confirm.order!.id, action: "markPaid" });
                    setConfirm(null);
                  }}
                >
                  {t("platformVpn.orders.confirmPaid")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === "cancel" && confirm.order && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("platformVpn.orders.cancelTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tf("platformVpn.orders.cancelDesc", { ref: confirm.order.ref })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={(event) => {
                    event.preventDefault();
                    resolveMutation.mutate({ id: confirm.order!.id, action: "cancel" });
                    setConfirm(null);
                  }}
                >
                  {t("platformVpn.orders.cancel")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {/* N°347 — confirmations DNS (markPaid → activation AUTO, cancel
              sans suppression). */}
          {confirm?.kind === "dnsMarkPaid" && confirm.dnsOrder && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("platformDns.orders.confirmPaidTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tf("platformDns.orders.confirmPaidDesc", {
                    ref: confirm.dnsOrder.ref,
                    amount: formatCurrency(confirm.dnsOrder.amountFcfa, currency, lang),
                    months: String(confirm.dnsOrder.months),
                    email: confirm.dnsOrder.email,
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    dnsResolveMutation.mutate({ id: confirm.dnsOrder!.id, action: "markPaid" });
                    setConfirm(null);
                  }}
                >
                  {t("platformDns.orders.confirmPaid")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === "dnsCancel" && confirm.dnsOrder && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("platformDns.orders.cancelTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {tf("platformDns.orders.cancelDesc", { ref: confirm.dnsOrder.ref })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={(event) => {
                    event.preventDefault();
                    dnsResolveMutation.mutate({ id: confirm.dnsOrder!.id, action: "cancel" });
                    setConfirm(null);
                  }}
                >
                  {t("platformDns.orders.cancel")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
