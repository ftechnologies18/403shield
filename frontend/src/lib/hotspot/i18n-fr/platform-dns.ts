// Fragment FR du domaine « platformDns » — N°347 — onglet « Commandes DNS »
// de la console plateforme « VPN & Vente directe » : la file des commandes de
// l'abonnement DNS « TOURACO » (vitrine publique /dns). Clés préfixées
// "platformDns." ; miroir exact de i18n-en/platform-dns.ts.

export const frPlatformDns: Record<string, string> = {
  // — Onglet (dans platform-vpn-view, à côté des commandes B2C VPN) —
  "platformDns.tab.dns": "Commandes DNS · TOURACO ({n})",

  // — Table commandes de l'abonnement DNS (miroir « Commandes B2C » N°301) —
  "platformDns.orders.search": "Rechercher (réf, e-mail)…",
  "platformDns.orders.ref": "Réf",
  "platformDns.orders.email": "Acheteur",
  "platformDns.orders.plan": "Formule",
  "platformDns.orders.months": "{n} mois",
  "platformDns.orders.amount": "Montant",
  "platformDns.orders.payMethod": "Moyen",
  "platformDns.orders.kind": "Genre",
  "platformDns.orders.status": "Statut",
  "platformDns.orders.term": "Échéance",
  "platformDns.orders.created": "Créée le",
  "platformDns.orders.resolvedBy": "Résolu par",
  "platformDns.orders.status.pending": "En attente",
  "platformDns.orders.status.paid": "Payée",
  "platformDns.orders.status.provisioned": "En service",
  "platformDns.orders.status.cancelled": "Annulée",
  "platformDns.orders.status.expired": "Expirée",
  "platformDns.orders.kind.sale": "Vente",
  "platformDns.orders.kind.renewal": "Renouvellement",
  "platformDns.orders.kindTarget": "cible {ref}",
  "platformDns.orders.confirmPaid": "Confirmer l'encaissement",
  "platformDns.orders.cancel": "Annuler",
  "platformDns.orders.confirmPaidTitle": "Confirmer l'encaissement TOURACO ?",
  "platformDns.orders.confirmPaidDesc":
    "Commande {ref} ({amount}). L'abonnement TOURACO est activé automatiquement pour {months} mois — l'é-mail d'activation part à {email}.",
  "platformDns.orders.confirmPaidToast": "Commande confirmée et abonnement TOURACO activé",
  "platformDns.orders.cancelTitle": "Annuler cette commande DNS ?",
  "platformDns.orders.cancelDesc":
    "Commande {ref}. Une commande en service perd son droit TOURACO : les quotas retombent au niveau gratuit, RIEN n'est supprimé (les profils, règles et logements restent). Une commande en attente est simplement fermée.",
  "platformDns.orders.empty": "Aucune commande DNS (TOURACO)",
  "platformDns.orders.noMatch": "Aucune commande ne correspond",
  "platformDns.orders.errorHint": "Provisioning différé : {error}",
  "platformDns.orders.pay.wave": "Wave",
  "platformDns.orders.pay.card": "Carte",
  "platformDns.orders.pay.manual": "Manuel",

  // — État de la vitrine /dns (encart discret en tête d'onglet — le levier
  //    d'ouverture vit dans Paramètres plateforme, à côté du toggle VPN) —
  "platformDns.shop.title": "Vitrine /dns — abonnement TOURACO",
  "platformDns.shop.open": "Vitrine /dns ouverte",
  "platformDns.shop.closed": "Vitrine /dns fermée",
  "platformDns.shop.note":
    "La fermeture n'annule rien : les droits provisionnés courent jusqu'à leur terme (les quotas retombent au niveau gratuit à l'expiration, rien n'est jamais supprimé).",
  "platformDns.shop.pendingHint": "{n} commande(s) en attente",
  "platformDns.shop.manage": "Ouvrir/fermer la vitrine : Paramètres plateforme → Général.",
};
