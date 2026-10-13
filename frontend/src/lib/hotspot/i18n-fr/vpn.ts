// Fragment FR du domaine « vpn » — WireGuard vendable (N°291).
// Clés préfixées "vpn." ; miroir exact de i18n-en/vpn.ts.

export const frVpn: Record<string, string> = {
  "vpn.title": "VPN WireGuard",
  "vpn.description":
    "Vendez des accès VPN WireGuard à vos clients — confs générées sur votre serveur, livrées par QR, e-mail ou Telegram, révocables d'un clic.",

  // — Activation du module (opt-in, même doctrine D6 que le Cybercafé) —
  "vpn.activate.title": "Module VPN désactivé",
  "vpn.activate.desc":
    "Activez le module pour créer des accès VPN WireGuard pour vos clients. Chaque accès sort par votre serveur MikCloud (IP fixe), la vente peut être enregistrée à la caisse, et la révocation coupe le client à chaud — sans toucher aux autres accès.",
  "vpn.activate.cta": "Activer le module",
  "vpn.activate.toast": "Module VPN activé",
  "vpn.deactivate.toast": "Module VPN désactivé (les accès actifs restent en service)",
  "vpn.settingsHint":
    "Module actif — le bouton ci-dessous le désactive. Aucun accès actif n'est coupé : la révocation reste un geste par peer.",
  "vpn.deactivate.cta": "Désactiver le module",

  // — KPIs + santé VM —
  "vpn.kpi.peers": "Accès actifs",
  "vpn.kpi.peersSub": "peers VPN en service",
  "vpn.kpi.slots": "Slots wg0",
  "vpn.kpi.slotsSub": "{used} / {pool} adresses réservées (routeurs inclus)",
  "vpn.kpi.vm": "Serveur VPN",
  "vpn.kpi.vmUp": "VM joignable",
  "vpn.kpi.vmUpSub": "wg-mini répond sur la VM",
  "vpn.kpi.vmDown": "VM injoignable",
  "vpn.kpi.vmDownSub": "vérifiez le service wg-mini (systemctl status wg-mini)",
  "vpn.kpi.caisse": "Caisse du jour",
  "vpn.kpi.caisseSub": "ventes encaissées (tous canaux)",

  // — Table —
  "vpn.search": "Rechercher un accès…",
  "vpn.access": "Accès",
  "vpn.name": "Nom VM",
  "vpn.address": "Adresse tunnel",
  "vpn.state": "Statut",
  "vpn.created": "Créé le",
  "vpn.actions": "Actions",
  "vpn.state.active": "Actif",
  "vpn.state.pending": "Création…",
  "vpn.state.error": "Erreur",
  "vpn.kind.fulltunnel": "Client final",
  "vpn.kind.remote": "Accès distant",
  "vpn.kind.fulltunnel.title": "Client final — tout le trafic de l'appareil sort par la VM (IP fixe)",
  "vpn.kind.remote.title": "Accès distant du gérant — supervision de vos routeurs via le tunnel chiffré (aucune sortie Internet)",
  "vpn.conf": "Configuration",
  "vpn.deliver": "Livrer",
  "vpn.revoke": "Révoquer",
  "vpn.more": "Plus d'actions",
  "vpn.noAddress": "—",

  // — Quota mensuel de trafic (N°311 : garde-fou egress, balayage 15 min) —
  "vpn.quota": "Quota du mois",
  "vpn.quota.title":
    "Consommation du mois courant (reçu + envoyé) — le compteur repart à zéro à chaque mois calendaire ; au-delà du quota, l'accès est révoqué automatiquement et le compte est notifié",
  "vpn.quota.unlimited": "illimité",

  // — États vides —
  "vpn.empty.title": "Aucun accès VPN vendu",
  "vpn.empty.desc":
    "Créez un accès pour un client : la configuration est générée sur votre serveur et livrée en QR, e-mail ou Telegram.",
  "vpn.noMatch": "Aucun accès ne correspond",
  "vpn.noMatchDesc": "Essayez un autre nom ou libellé.",

  // — Création —
  "vpn.add": "Vendre un accès",
  "vpn.addTitle": "Vendre un accès VPN",
  "vpn.addDesc":
    "Les clés et la configuration sont générées sur votre serveur (la clé privée du client n'existe nulle part ailleurs). La génération prend quelques secondes.",
  "vpn.addLabel": "Libellé (nom du client, appareil…)",
  "vpn.addLabelPlaceholder": "Téléphone client Ali, PC boutique…",
  "vpn.addKind": "Forme d'accès",
  "vpn.addKind.fulltunnel": "Client final — tout le trafic sort par la VM (IP fixe)",
  "vpn.addKind.remote": "Accès distant du gérant — supervision de vos routeurs",
  "vpn.addKind.fulltunnelHint": "La navigation de votre CLIENT transite par votre serveur : tout l'egress compte sur le quota de la plateforme.",
  "vpn.addKind.remoteHint": "Pour VOUS : Winbox, l'API RouterOS, SSH et l'interface web de chaque routeur restent joignables à leur adresse tunnel 10.8.0.x, où que vous soyez. Le tunnel ne route rien d'autre — requiert au moins un routeur au tunnel actif (l'accès s'élargit automatiquement, ≤ 45 s par routeur).",
  "vpn.addPrice": "Prix de vente enregistré (0 = ne rien encaisser)",
  "vpn.addPricePlaceholder": "Ex. 2000",
  "vpn.addPriceHint": "Saisi > 0 : la vente part à la caisse (canal direct) et dans les rapports.",
  "vpn.addWarning":
    "Le trafic du client sort par VOTRE serveur : gardez un œil sur la consommation (sortie ~10 To/mois sur l'offre Always Free) et révoquez les accès dormants.",
  "vpn.addWarning.remote":
    "La supervision n'ouvre AUCUNE porte vers Internet : le tunnel ne route que le réseau MikCloud (10.8.0.0/24). Caméras et NAS du LAN restent hors périmètre — accès complet au LAN : prochaine étape.",
  "vpn.addCta": "Générer et vendre",
  "vpn.addToast": "Accès VPN créé",
  "vpn.addToast.remote": "Accès distant créé — vos routeurs actifs l'acceptent sous ≤ 45 s",
  "vpn.addPending": "Génération en cours sur la VM…",

  // — Conf / livraison (D5-a) —
  "vpn.confTitle": "Configuration VPN",
  "vpn.confDesc":
    "Le client installe l'application WireGuard, puis « + » → importer. Gardez cette configuration secrète : elle donne un accès complet.",
  "vpn.confDesc.remote":
    "Importez-la dans WireGuard (menu « + ») : vos routeurs deviennent joignables à leur adresse tunnel 10.8.0.x (Winbox, API, SSH, web).",
  "vpn.confCopy": "Copier la configuration",
  "vpn.confCopied": "Configuration copiée",
  "vpn.confQr": "QR (scan direct)",
  "vpn.confEmail": "Envoyer par e-mail",
  "vpn.confTelegram": "Envoyer sur Telegram",
  "vpn.emailTitle": "Envoyer la configuration par e-mail",
  "vpn.emailDesc": "La configuration complète est envoyée au client (fournisseur e-mail de votre compte).",
  "vpn.emailTo": "Adresse e-mail du client",
  "vpn.emailCta": "Envoyer",
  "vpn.emailToast": "Envoi e-mail en cours",
  "vpn.telegramToast": "Conf envoyée sur Telegram",
  "vpn.revokeConfirmTitle": "Révoquer cet accès ?",
  "vpn.revokeConfirmDesc":
    "Le client perd immédiatement l'accès (serveur mis à jour à chaud). Les autres accès ne sont pas touchés. Cette action est définitive.",
  "vpn.revokeToast": "Accès révoqué",

  // — Réconciliation (check D4) —
  "vpn.reconcile": "Vérifier la VM",
  "vpn.reconcileOk": "VM vérifiée : {mine} accès(s) présent(s) sur le serveur",
  "vpn.reconcileMissing": "{n} accès(s) introuvable(s) sur la VM : {names}",
  "vpn.reconcileDown": "VM injoignable — réconciliation impossible",

  // — Divers —
  "vpn.errorToast": "Opération impossible",
  "vpn.error.miniUnconfigured":
    "Mini-service wg-mini non installé sur la VM — cf. deploy/oracle/wg-mini/README.md (l'exploitant l'installe en 10 minutes).",
  "vpn.disableHint":
    "La désactivation ne coupe PAS les accès actifs : le serveur continue de router les peers existants.",
};
