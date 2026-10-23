// Fragment EN du domaine « platformDns » — N°347 — "DNS orders" tab of the
// platform console "VPN & Direct sales": the queue of "TOURACO" DNS
// subscription orders (public /dns shop). Keys prefixed "platformDns." ;
// exact mirror of i18n-fr/platform-dns.ts.

export const enPlatformDns: Record<string, string> = {
  // — Tab (in platform-vpn-view, next to the VPN B2C orders) —
  "platformDns.tab.dns": "DNS orders · TOURACO ({n})",

  // — DNS subscription orders table (mirror of the "B2C orders" N°301) —
  "platformDns.orders.search": "Search (ref, email)…",
  "platformDns.orders.ref": "Ref",
  "platformDns.orders.email": "Buyer",
  "platformDns.orders.plan": "Plan",
  "platformDns.orders.months": "{n} month(s)",
  "platformDns.orders.amount": "Amount",
  "platformDns.orders.payMethod": "Method",
  "platformDns.orders.kind": "Kind",
  "platformDns.orders.status": "Status",
  "platformDns.orders.term": "Expiry",
  "platformDns.orders.created": "Created",
  "platformDns.orders.resolvedBy": "Resolved by",
  "platformDns.orders.status.pending": "Pending",
  "platformDns.orders.status.paid": "Paid",
  "platformDns.orders.status.provisioned": "In service",
  "platformDns.orders.status.cancelled": "Cancelled",
  "platformDns.orders.status.expired": "Expired",
  "platformDns.orders.kind.sale": "Sale",
  "platformDns.orders.kind.renewal": "Renewal",
  "platformDns.orders.kindTarget": "target {ref}",
  "platformDns.orders.confirmPaid": "Confirm payment",
  "platformDns.orders.cancel": "Cancel",
  "platformDns.orders.confirmPaidTitle": "Confirm the TOURACO payment?",
  "platformDns.orders.confirmPaidDesc":
    "Order {ref} ({amount}). The TOURACO subscription is activated automatically for {months} months — the activation email is sent to {email}.",
  "platformDns.orders.confirmPaidToast": "Order confirmed and TOURACO subscription activated",
  "platformDns.orders.cancelTitle": "Cancel this DNS order?",
  "platformDns.orders.cancelDesc":
    "Order {ref}. An in-service order loses its TOURACO entitlement: quotas fall back to the free tier, NOTHING is deleted (profiles, rules and homes stay). A pending order is simply closed.",
  "platformDns.orders.empty": "No DNS orders (TOURACO)",
  "platformDns.orders.noMatch": "No matching order",
  "platformDns.orders.errorHint": "Deferred provisioning: {error}",
  "platformDns.orders.pay.wave": "Wave",
  "platformDns.orders.pay.card": "Card",
  "platformDns.orders.pay.manual": "Manual",

  // — /dns shop state (discreet banner atop the tab — the open/close lever
  //    lives in Platform settings, next to the VPN toggle) —
  "platformDns.shop.title": "/dns shop — TOURACO subscription",
  "platformDns.shop.open": "/dns shop open",
  "platformDns.shop.closed": "/dns shop closed",
  "platformDns.shop.note":
    "Closing cancels nothing: provisioned entitlements run until their term (quotas fall back to the free tier at expiry, nothing is ever deleted).",
  "platformDns.shop.pendingHint": "{n} pending order(s)",
  "platformDns.shop.manage": "Open/close the shop: Platform settings → General.",
};
