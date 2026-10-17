// Fragment FR du domaine « platformVpn » — N°301 — console plateforme
// « VPN & Vente directe » (le grossiste). Clés préfixées "platformVpn." ;
// miroir exact de i18n-en/platform-vpn.ts.

export const frPlatformVpn: Record<string, string> = {
  "platformVpn.title": "VPN & Vente directe",
  "platformVpn.description":
    "Le cockpit du grossiste : pool WireGuard global de la VM, octroi du module de revente aux comptes, commandes de la vente directe B2C et réconciliation cloud ↔ serveur.",
  "platformVpn.subtitle":
    "Vous fournissez la capacité, les gérants vendent en local — la vente directe (vitrine publique) sert les clients hors zone hotspot.",

  // — KPIs —
  "platformVpn.kpi.pool": "Pool wg0",
  "platformVpn.kpi.poolSub": "{used} / {pool} adresses réservées",
  "platformVpn.kpi.resellers": "Comptes revendeurs",
  "platformVpn.kpi.resellersSub": "module VPN actif",
  "platformVpn.kpi.b2c": "Vente directe active",
  "platformVpn.kpi.b2cSub": "commandes en service",
  "platformVpn.kpi.revenue": "Encaissé 30 j",
  "platformVpn.kpi.revenueSub": "vente directe (B2C)",
  "platformVpn.kpi.vmUp": "VM joignable",
  "platformVpn.kpi.vmDown": "VM injoignable",
  "platformVpn.kpi.vmDownSub": "wg-mini ne répond pas (systemctl status wg-mini)",

  // — Onglets —
  "platformVpn.tab.overview": "Aperçu & comptes",
  "platformVpn.tab.peers": "Peers ({n})",
  "platformVpn.tab.orders": "Commandes B2C ({n})",
  "platformVpn.reconcile": "Réconcilier",
  "platformVpn.refresh": "Rafraîchir",

  // — Table comptes (octroi du module) —
  "platformVpn.accounts.title": "Octroi du module de revente",
  "platformVpn.accounts.desc":
    "Activer = le gérant peut vendre des accès VPN. Retirer = module coupé ET verrouillé — le gérant ne peut plus le réactiver seul (l'octroi redevient votre geste). Les accès actifs ne sont jamais coupés par un retrait.",
  "platformVpn.accounts.account": "Compte",
  "platformVpn.accounts.peers": "Peers",
  "platformVpn.accounts.module": "Module",
  "platformVpn.accounts.moduleOn": "Actif",
  "platformVpn.accounts.moduleLocked": "Retiré (verrouillé)",
  "platformVpn.accounts.moduleOff": "Inactif",
  "platformVpn.accounts.grant": "Octroyer",
  "platformVpn.accounts.withdraw": "Retirer & verrouiller",
  "platformVpn.accounts.empty": "Aucun compte n'utilise le module VPN",
  "platformVpn.accounts.main": "403Shield (vente directe B2C)",
  "platformVpn.accounts.grantToast": "Module VPN octroyé — le gérant peut vendre",
  "platformVpn.accounts.withdrawToast":
    "Module VPN retiré et verrouillé — les accès actifs restent en service",
  "platformVpn.accounts.confirmWithdrawTitle": "Retirer le module VPN ?",
  "platformVpn.accounts.confirmWithdrawDesc":
    "«{account}» ne pourra plus créer d'accès VPN ni réactiver le module seul. Les accès actifs de ses clients restent en service (la révocation reste un geste par peer).",
  "platformVpn.accounts.confirmGrantTitle": "Octroyer le module VPN ?",
  "platformVpn.accounts.confirmGrantDesc":
    "«{account}» pourra activer le module et vendre des accès VPN WireGuard à ses clients.",

  // — Table peers (registre global) —
  "platformVpn.peers.title": "Registre global des peers wg0",
  "platformVpn.peers.desc":
    "Tous les peers de la VM, tous comptes confondus, enrichis de la télémétrie serveur (dernier handshake, trafic). La configuration ne sort jamais d'ici — le reveal reste un geste du gérant, la livraison B2C passe par e-mail.",
  "platformVpn.peers.search": "Rechercher (peer, compte, e-mail)…",
  "platformVpn.peers.name": "Peer",
  "platformVpn.peers.account": "Compte",
  "platformVpn.peers.address": "IP tunnel",
  "platformVpn.peers.state": "Statut",
  "platformVpn.peers.handshake": "Handshake",
  "platformVpn.peers.transfer": "Trafic",
  "platformVpn.peers.term": "Terme",
  "platformVpn.peers.actions": "Actions",
  "platformVpn.peers.b2c": "B2C",
  "platformVpn.peers.noHandshake": "—",
  "platformVpn.peers.empty": "Aucun peer sur le wg0",
  "platformVpn.peers.noMatch": "Aucun peer ne correspond",
  "platformVpn.peers.revoke": "Révoquer",
  "platformVpn.peers.confirmTitle": "Révoquer ce peer ?",
  "platformVpn.peers.confirmDesc":
    "«{name}» ({account}) perd immédiatement l'accès — wg0 est mis à jour à chaud, les autres peers restent intacts. Une commande B2C liée serait annulée.",
  "platformVpn.peers.revokeToast": "Peer révoqué — le client n'a plus d'accès",
  "platformVpn.peers.vmDown": "Télémétrie indisponible (wg-mini injoignable)",

  // — Table commandes B2C —
  "platformVpn.orders.title": "Commandes de la vente directe (vitrine publique)",
  "platformVpn.orders.desc":
    "Le canal B2C : la boutique 403Shield (tunnel.ftci.fr/shop) vend aux clients hors zone hotspot, le provisioning est automatique au paiement. « Confirmer l'encaissement » sert le canal manuel (hors ligne) ; « Annuler » révoque l'accès d'une commande provisionnée.",
  "platformVpn.orders.search": "Rechercher (réf, e-mail)…",
  "platformVpn.orders.ref": "Réf",
  "platformVpn.orders.email": "Client",
  "platformVpn.orders.plan": "Formule",
  "platformVpn.orders.amount": "Montant",
  "platformVpn.orders.payMethod": "Paiement",
  "platformVpn.orders.status": "Statut",
  "platformVpn.orders.term": "Terme",
  "platformVpn.orders.actions": "Actions",
  "platformVpn.orders.status.pending": "En attente",
  "platformVpn.orders.status.paid": "Payée",
  "platformVpn.orders.status.provisioned": "En service",
  "platformVpn.orders.status.cancelled": "Annulée",
  "platformVpn.orders.status.expired": "Expirée",
  "platformVpn.orders.confirmPaid": "Confirmer l'encaissement",
  "platformVpn.orders.cancel": "Annuler",
  "platformVpn.orders.confirmPaidTitle": "Confirmer l'encaissement ?",
  "platformVpn.orders.confirmPaidDesc":
    "Commande {ref} ({amount} FCFA). Le peer est posé automatiquement sur le wg0 et la configuration part par e-mail à {email}.",
  "platformVpn.orders.confirmPaidToast": "Commande confirmée et VPN provisionné",
  "platformVpn.orders.cancelTitle": "Annuler cette commande ?",
  "platformVpn.orders.cancelDesc":
    "Commande {ref}. Une commande en service perd son accès (peer révoqué) ; une commande en attente est simplement fermée.",
  "platformVpn.orders.cancelToast": "Commande annulée",
  "platformVpn.orders.empty": "Aucune commande B2C",
  "platformVpn.orders.noMatch": "Aucune commande ne correspond",
  "platformVpn.orders.errorHint": "Provisioning différé : {error}",
  "platformVpn.orders.pay.wave": "Wave",
  "platformVpn.orders.pay.card": "Carte",
  "platformVpn.orders.pay.manual": "Manuel",

  // — B2C bloc vitrine —
  "platformVpn.shop.title": "Boutique publique 403Shield (vente directe)",
  "platformVpn.shop.desc":
    "La vente directe vit sur la boutique publique 403Shield — tunnel.ftci.fr/shop, sur le domaine de la console (hors zone des gérants — jamais en concurrence avec vos revendeurs ; l'ancienne page /vpn redirige en 301). Fermée : le catalogue refuse toute commande ; ouverte : paiement en ligne (Wave/carte), provisioning automatique et récupération self-service par e-mail.",
  "platformVpn.shop.open": "Vitrine ouverte",
  "platformVpn.shop.closed": "Vitrine fermée",
  "platformVpn.shop.toggle": "Ouvrir la vente directe",
  "platformVpn.shop.toggleOff": "Fermer la vente directe",
  "platformVpn.shop.openToast": "Boutique B2C ouverte — 403Shield vend",
  "platformVpn.shop.closedToast": "Vitrine B2C fermée (les commandes en service restent actives)",
  "platformVpn.shop.link": "Voir la boutique 403Shield",
  "platformVpn.shop.onlinePayment": "Paiement en ligne actif",
  "platformVpn.shop.manualOnly": "Paiement en ligne non configuré — canal manuel",
  "platformVpn.shop.pendingHint": "{n} commande(s) en attente",
  "platformVpn.shop.paidHint": "{n} payée(s) à provisionner",

  // — Réconciliation —
  "platformVpn.reconcile.title": "Réconciliation cloud ↔ serveur",
  "platformVpn.reconcile.desc":
    "Compare le registre cloud aux peers réellement présents sur le wg0 de la VM : les MANQUANTS (actifs cloud, absents VM — restore ou purge accidentelle) et les FANTÔMES (présents VM, inconnus cloud — créés à la main). C'est le « wg-peer.sh list en SSH » en un bouton.",
  "platformVpn.reconcile.run": "Lancer la vérification",
  "platformVpn.reconcile.running": "Vérification en cours…",
  "platformVpn.reconcile.ok": "Registres alignés : {vm} peers sur la VM, {cloud} actifs côté cloud.",
  "platformVpn.reconcile.missing": "Manquants ({n})",
  "platformVpn.reconcile.ghosts": "Fantômes ({n})",
  "platformVpn.reconcile.none": "Aucun",
};
