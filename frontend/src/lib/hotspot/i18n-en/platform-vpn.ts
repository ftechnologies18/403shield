// Fragment EN du domaine « platformVpn » — N°301 — platform console
// "VPN & Direct sales" (the wholesaler). Keys prefixed "platformVpn." ;
// exact mirror of i18n-fr/platform-vpn.ts.

export const enPlatformVpn: Record<string, string> = {
  "platformVpn.title": "VPN & Direct sales",
  "platformVpn.description":
    "The wholesaler cockpit: the VM's global WireGuard pool, reseller module grants per account, direct B2C orders from the public shop and cloud ↔ server reconciliation.",
  "platformVpn.subtitle":
    "You supply the capacity, managers sell locally — direct sales (public shop) serves customers outside hotspot areas.",

  // — KPIs —
  "platformVpn.kpi.pool": "wg0 pool",
  "platformVpn.kpi.poolSub": "{used} / {pool} addresses reserved",
  "platformVpn.kpi.resellers": "Reseller accounts",
  "platformVpn.kpi.resellersSub": "VPN module active",
  "platformVpn.kpi.b2c": "Active direct sales",
  "platformVpn.kpi.b2cSub": "orders in service",
  "platformVpn.kpi.revenue": "Collected 30 d",
  "platformVpn.kpi.revenueSub": "direct sales (B2C)",
  "platformVpn.kpi.vmUp": "VM reachable",
  "platformVpn.kpi.vmDown": "VM unreachable",
  "platformVpn.kpi.vmDownSub": "wg-mini not responding (systemctl status wg-mini)",

  // — Tabs —
  "platformVpn.tab.overview": "Overview & accounts",
  "platformVpn.tab.peers": "Peers ({n})",
  "platformVpn.tab.orders": "B2C orders ({n})",
  "platformVpn.reconcile": "Reconcile",
  "platformVpn.refresh": "Refresh",

  // — Accounts table (module grants) —
  "platformVpn.accounts.title": "Reseller module grants",
  "platformVpn.accounts.desc":
    "Grant = the manager can sell VPN access. Withdraw = module off AND locked — the manager cannot re-enable it alone (granting becomes your call). Active accesses are never cut by a withdrawal.",
  "platformVpn.accounts.account": "Account",
  "platformVpn.accounts.peers": "Peers",
  "platformVpn.accounts.module": "Module",
  "platformVpn.accounts.moduleOn": "Active",
  "platformVpn.accounts.moduleLocked": "Withdrawn (locked)",
  "platformVpn.accounts.moduleOff": "Inactive",
  "platformVpn.accounts.grant": "Grant",
  "platformVpn.accounts.withdraw": "Withdraw & lock",
  "platformVpn.accounts.empty": "No account uses the VPN module",
  "platformVpn.accounts.main": "403Shield (direct B2C sales)",
  "platformVpn.accounts.grantToast": "VPN module granted — the manager can sell",
  "platformVpn.accounts.withdrawToast":
    "VPN module withdrawn and locked — active accesses stay in service",
  "platformVpn.accounts.confirmWithdrawTitle": "Withdraw the VPN module?",
  "platformVpn.accounts.confirmWithdrawDesc":
    "\"{account}\" will no longer be able to create VPN access or re-enable the module alone. Its customers' active accesses stay in service (revocation remains a per-peer action).",
  "platformVpn.accounts.confirmGrantTitle": "Grant the VPN module?",
  "platformVpn.accounts.confirmGrantDesc":
    "\"{account}\" will be able to enable the module and sell WireGuard VPN access to its customers.",

  // — Peers table (global registry) —
  "platformVpn.peers.title": "Global wg0 peer registry",
  "platformVpn.peers.desc":
    "Every peer on the VM, all accounts combined, enriched with server telemetry (last handshake, transfer). The configuration never leaves here — reveal stays a manager action, B2C delivery goes by email.",
  "platformVpn.peers.search": "Search (peer, account, email)…",
  "platformVpn.peers.name": "Peer",
  "platformVpn.peers.account": "Account",
  "platformVpn.peers.address": "Tunnel IP",
  "platformVpn.peers.state": "Status",
  "platformVpn.peers.handshake": "Handshake",
  "platformVpn.peers.transfer": "Transfer",
  "platformVpn.peers.term": "Term",
  "platformVpn.peers.actions": "Actions",
  "platformVpn.peers.b2c": "B2C",
  "platformVpn.peers.noHandshake": "—",
  "platformVpn.peers.empty": "No peer on wg0",
  "platformVpn.peers.noMatch": "No matching peer",
  "platformVpn.peers.revoke": "Revoke",
  "platformVpn.peers.confirmTitle": "Revoke this peer?",
  "platformVpn.peers.confirmDesc":
    "\"{name}\" ({account}) immediately loses access — wg0 is hot-updated, other peers stay intact. A linked B2C order would be cancelled.",
  "platformVpn.peers.revokeToast": "Peer revoked — the customer no longer has access",
  "platformVpn.peers.vmDown": "Telemetry unavailable (wg-mini unreachable)",

  // — B2C orders table —
  "platformVpn.orders.title": "Direct sales orders (public shop)",
  "platformVpn.orders.desc":
    "The B2C channel: the 403Shield shop (tunnel.ftci.fr/shop) sells to customers outside hotspot areas, provisioning is automatic on payment. \"Confirm payment\" serves the manual channel (offline); \"Cancel\" revokes a provisioned order's access.",
  "platformVpn.orders.search": "Search (ref, email)…",
  "platformVpn.orders.ref": "Ref",
  "platformVpn.orders.email": "Customer",
  "platformVpn.orders.plan": "Plan",
  "platformVpn.orders.amount": "Amount",
  "platformVpn.orders.payMethod": "Payment",
  "platformVpn.orders.status": "Status",
  "platformVpn.orders.term": "Term",
  "platformVpn.orders.actions": "Actions",
  "platformVpn.orders.status.pending": "Pending",
  "platformVpn.orders.status.paid": "Paid",
  "platformVpn.orders.status.provisioned": "In service",
  "platformVpn.orders.status.cancelled": "Cancelled",
  "platformVpn.orders.status.expired": "Expired",
  "platformVpn.orders.confirmPaid": "Confirm payment",
  "platformVpn.orders.cancel": "Cancel",
  "platformVpn.orders.confirmPaidTitle": "Confirm payment?",
  "platformVpn.orders.confirmPaidDesc":
    "Order {ref} ({amount} FCFA). The peer is automatically added to wg0 and the configuration is emailed to {email}.",
  "platformVpn.orders.confirmPaidToast": "Order confirmed and VPN provisioned",
  "platformVpn.orders.cancelTitle": "Cancel this order?",
  "platformVpn.orders.cancelDesc":
    "Order {ref}. An in-service order loses its access (peer revoked); a pending order is simply closed.",
  "platformVpn.orders.cancelToast": "Order cancelled",
  "platformVpn.orders.empty": "No B2C orders",
  "platformVpn.orders.noMatch": "No matching order",
  "platformVpn.orders.errorHint": "Deferred provisioning: {error}",
  "platformVpn.orders.pay.wave": "Wave",
  "platformVpn.orders.pay.card": "Card",
  "platformVpn.orders.pay.manual": "Manual",

  // — B2C shop block —
  "platformVpn.shop.title": "Public 403Shield shop (direct sales)",
  "platformVpn.shop.desc":
    "Direct sales live on the public 403Shield shop — tunnel.ftci.fr/shop, on the console domain (outside managers' areas — never competing with your resellers; the former /vpn page 301-redirects there). Closed: the catalogue refuses orders; open: online payment (Wave/card), automatic provisioning and self-service recovery by email.",
  "platformVpn.shop.open": "Shop open",
  "platformVpn.shop.closed": "Shop closed",
  "platformVpn.shop.toggle": "Open direct sales",
  "platformVpn.shop.toggleOff": "Close direct sales",
  "platformVpn.shop.openToast": "B2C shop open — 403Shield is selling",
  "platformVpn.shop.closedToast": "B2C shop closed (in-service orders stay active)",
  "platformVpn.shop.link": "View the 403Shield shop",
  "platformVpn.shop.onlinePayment": "Online payment active",
  "platformVpn.shop.manualOnly": "Online payment not configured — manual channel",
  "platformVpn.shop.pendingHint": "{n} pending order(s)",
  "platformVpn.shop.paidHint": "{n} paid to provision",

  // — Reconciliation —
  "platformVpn.reconcile.title": "Cloud ↔ server reconciliation",
  "platformVpn.reconcile.desc":
    "Compares the cloud registry with the peers actually present on the VM's wg0: MISSING (active in cloud, absent on VM — restore or accidental purge) and GHOSTS (present on VM, unknown to cloud — created by hand). It's \"wg-peer.sh list over SSH\" in one button.",
  "platformVpn.reconcile.run": "Run the check",
  "platformVpn.reconcile.running": "Checking…",
  "platformVpn.reconcile.ok": "Registries aligned: {vm} peers on the VM, {cloud} active in the cloud.",
  "platformVpn.reconcile.missing": "Missing ({n})",
  "platformVpn.reconcile.ghosts": "Ghosts ({n})",
  "platformVpn.reconcile.none": "None",
};
