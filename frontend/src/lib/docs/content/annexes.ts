// Section « Annexes — surfaces client final (hors console) » — 4 guides (N°304).
import type { Guide } from "../types";
import { cap } from "../cap";

export const ANNEXES_GUIDES: Guide[] = [
  {
    id: "mode-vente",
    title: "Mode Vente du revendeur (téléphone)",
    summary:
      "L'écran de votre revendeur : /sell sur téléphone, PIN, vente en 3 touches, QR/impression — la face commerciale sans console.",
    roles: "Revendeur (pour information)",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "annexes",
    vague: "V2",
    quoi:
      "Le Mode Vente est l'interface de vente autonome du revendeur : sur SON téléphone (ou une tablette du kiosque), il ouvre mikcloud.ftci.fr/sell, choisit l'onglet Revendeur et entre son PIN. Il voit alors SON stock (les lots transférés), vend un ticket (le client reçoit code + QR), et suit son reste.\n\nAucune formation nécessaire : l'écran est pensé grand, tactile, et ne propose QUE la vente. Le mode PIN verrouille tout le reste — aucune donnée de gestion ne fuite sur son appareil.",
    difference: [
      {
        with: "La console",
        body:
          "La console gère (grille, lots, rapports) ; le Mode Vente vend. Le revendeur n'existe que ici — c'est son unique surface MikCloud.",
      },
      {
        with: "La vitrine /vpn",
        body:
          "La boutique MikTunnel (tunnel.ftci.fr/shop) vend du VPN au client final (paiement en ligne, autonome) ; /sell vend des tickets WiFi par humain interposé. Deux boutiques publiques, deux marchandises.",
      },
    ],
    recoit: [
      "Le revendeur : son stock par forfait (restant), la vente en 3 touches, le ticket affiché (QR + code) partageable ou imprimable selon le téléphone.",
      "Le client : un ticket avec QR — scanne et se connecte (le QR pré-remplit le code si l'URL hotspot est renseignée).",
      "Vous (console) : la vente trace immédiatement (détenteur, statut du code) — le stock du revendeur décrémente en direct.",
    ],
    etapes: [
      {
        title: "Le revendeur ouvre /sell",
        body:
          "Sur le téléphone : mikcloud.ftci.fr/sell — l'écran de connexion propose l'onglet Revendeur (PIN). C'est le seul « login » qu'il connaîtra jamais.",
        capture: cap(
          "annexes/mode-vente-login.png",
          1440,
          900,
          "Page de connexion du Mode Vente avec l'onglet Revendeur sélectionné pour la saisie du PIN",
          "Le login du Mode Vente — onglet Revendeur, PIN.",
        ),
      },
      {
        title: "Il entre son PIN",
        body:
          "Le PIN (4-6 chiffres, défini à sa création — guide Revendeurs) ouvre son espace de vente : stock par forfait, actions de vente, reste. Mobile d'abord — la capture mobile montre l'écran pensé téléphone.",
        capture: cap(
          "annexes/mode-vente-login-mobile.png",
          390,
          844,
          "Mode Vente sur téléphone mobile : saisie du PIN revendeur",
          "Le Mode Vente sur mobile — son format natif.",
        ),
      },
      {
        title: "Il vend en 3 touches",
        body:
          "Forfait → Confirmer → le ticket s'affiche (code + QR). Il le montre au client (scan direct), l'imprime (si imprimante mobile) ou le partage (capture/WhatsApp selon usage local). Le stock décrémente instantanément.",
        tip: "Conseil d'exploitant : une tablette dédiée au kiosque reste OUVERTE sur /sell (PWA installée) — le caissier ne fait que taper PIN puis vendre.",
      },
    ],
    usages: [
      {
        title: "Le kiosque du quartier",
        body:
          "Tablette + imprimante de reçus thermique : le kiosque vend vos tickets en continu, vous verse l'argent — l'extension de réseau sans nouvel employé.",
      },
      {
        title: "Le vendeur ambulant",
        body:
          "Son téléphone, son PIN, son stock : il vend dans la rue, remonte la caisse le soir — dépôt-vente nomade.",
      },
    ],
    pieges: [
      {
        title: "Le PIN sur un téléphone partagé",
        body:
          "Si la tablette sert à autre chose, le PIN protège l'espace de vente — mais restez maître des PINs (changés depuis la console) : un PIN circulant vend à votre insu.",
        severity: "warn",
      },
      {
        title: "Vente sans réseau",
        body:
          "Le Mode Vente requiert le réseau (les codes partent du stock cloud) — avec une ligne capricieuse, le kiosque garde des tickets PAPIER imprimés en avance en secours.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Le revendeur voit-il les prix/marges ?",
        a: "Il voit les FORFAITS vendables de son stock, pas vos coûts ni la marge — la gestion reste invisible pour lui.",
      },
      {
        q: "Puis-je utiliser le Mode Vente moi-même ?",
        a: "Oui : créez-vous comme revendeur de votre propre compte pour vendre au comptoir sur un appareil léger, sans ouvrir la console complète.",
      },
    ],
    related: ["revendeurs", "vouchers-lots", "premiere-vente"],
  },

  {
    id: "portail-client",
    title: "Portail captif — ce que voit le client",
    summary:
      "Le point de vue du client final : la page de connexion, la saisie du code, le CHAP silencieux, le statut et la déconnexion — pour répondre à leurs questions.",
    roles: "Propriétaire · Gérant (support)",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "annexes",
    vague: "V3",
    quoi:
      "Le portail captif est LA page que vos clients voient (générée par MikCloud, portant votre marque — guide Portail & marque) : le client capte le WiFi, la page s'ouvre (ou il scanne le QR du ticket), il saisit son code, il navigue. La session se déroule ensuite seule : statut consultable, déconnexion à la demande, expiration à l'échéance du forfait.\n\nLe login utilise CHAP (le code ne transite jamais en clair vers le routeur) — un standard du secteur que les clients ressentent simplement comme « ça marche ».\n\nNOTE DE CAPTURE : l'illustration exacte du portail (page de login rendue par le routeur) se prend sur place, depuis un appareil connecté au hotspot — la capture dédiée sera ajoutée lors d'une session terrain. En attendant, la vue ci-contre (l'éditeur de portail de la console) montre la personnalisation qui l'habille.",
    difference: [
      {
        with: "La page /wifi/<site>",
        body:
          "La page jetable (publique, noindex) distribue les codes OFFERTS ; le portail reçoit TOUS les logins (offerts et payants).",
      },
      {
        with: "Le Mode Vente",
        body:
          "Le Mode Vente est l'outil du VENDEUR ; le portail est la porte du CLIENT. Les deux se rencontrent sur le ticket (QR).",
      },
    ],
    recoit: [
      "Le client reçoit : votre page de marque (logo, couleurs, offres, pub), la saisie du code, et après login — la page de statut (temps restant, volumes) et la déconnexion volontaire.",
      "Le CHAP protège le code à la saisie ; le walled-garden laisse respirer certains sites avant login (selon vos réglages).",
      "Vous recevez : la session (console) dès la connexion — le circuit complet est décrit dans le guide Première vente.",
    ],
    etapes: [
      {
        title: "Le client capte le WiFi",
        body:
          "Il sélectionne votre réseau — la page de login s'ouvre seule (redirect DNS) sur son appareil. S'il scanne le QR du ticket, la page s'ouvre avec le code PRÉ-REMPLI (si l'URL hotspot est renseignée — guide Routeur).",
      },
      {
        title: "Il saisit son code",
        body:
          "Le code du ticket (ou de son compte utilisateur identifiant + mot de passe). CHAP signe l'échange : le code ne circule pas en clair. En cas d'erreur : message clair (code invalide, expiré, quota atteint).",
      },
      {
        title: "Il navigue et suit son statut",
        body:
          "La page de statut (accessible depuis le redirect ou le QR « statut ») montre le temps restant et les volumes — le client gère sa consommation, vous recevez moins d'appels « il me reste combien ? ».",
      },
      {
        title: "Déconnexion et expiration",
        body:
          "Il peut se déconnecter (page statut) — sinon la session expire à l'échéance du forfait (temps OU volume). Un nouveau code = nouvelle session, le solde d'un compte suit lui l'identifiant.",
      },
    ],
    usages: [
      {
        title: "Support client au comptoir",
        body:
          "« Ça ne marche pas » : demandez d'abord le message EXACT du portail (code invalide ? expiré ? quota ?) — il désigne la cause en 5 secondes et vous oriente (voucher, profil, routeur).",
      },
    ],
    pieges: [
      {
        title: "Le portail ne s'ouvre pas",
        body:
          "Certains téléphones n'auto-ouvrent pas la page (HTTPS strict, captive portal désactivé) : le client tape manuellement l'URL de connexion (celle du routeur) ou scanne le QR du ticket. Gardez l'URL affichée au comptoir.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Le client voit-il MikCloud ?",
        a: "Il voit VOTRE marque (le portail est personnalisé) — MikCloud reste l'infrastructure invisible. C'est votre WiFi, pas le nôtre.",
      },
    ],
    related: ["portail-captif", "premiere-vente", "wifi-jetable-client"],
  },

  {
    id: "vitrine-vpn",
    title: "Vitrine VPN B2C (/vpn)",
    summary:
      "La boutique publique du VPN : achats en ligne autonomes (choix de formule, paiement, livraison des clés WireGuard) — le canal e-commerce du module VPN.",
    roles: "Propriétaire (activation) · public",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "annexes",
    vague: "V3",
    quoi:
      "La boutique publique qui vend vos accès VPN B2C vit désormais chez la sous-marque MikTunnel — tunnel.ftci.fr/shop (N°316) : le visiteur compare les formules (durée, quota), paie en ligne (Wave, GeniusPay, Stripe selon réglages), et reçoit ses clés WireGuard immédiatement — provision automatique, zéro intervention de votre côté. L'ancienne page mikcloud.ftci.fr/vpn répond 301 vers cette boutique.\n\nElle n'existe que si l'offre est activée (réglage plateforme PublicVpnShop — voir le volet privé) : la boutique est SEO-indexée (contrairement aux pages /wifi) et vend 24/7.\n\nNOTE DE CAPTURE : l'illustration montre l'ancienne vitrine MikCloud (mikcloud.ftci.fr/vpn) — le parcours vit aujourd'hui sur tunnel.ftci.fr/shop (MikTunnel).",
    difference: [
      {
        with: "Le module VPN (console)",
        body:
          "Le module administre (peers, quotas, revente manuelle) ; la vitrine VEND (paiement autonome). Guide : VPN WireGuard vendable.",
      },
      {
        with: "Le portail captif",
        body:
          "Le portail connecte au WiFi ; la vitrine vend du VPN (un tunnel personnel, utilisable partout, pas seulement chez vous).",
      },
    ],
    recoit: [
      "Le visiteur : les formules comparées (prix, durée, quota), le paiement en ligne, la livraison immédiate des clés (QR WireGuard) et le suivi de commande.",
      "Vous : les commandes B2C remontent dans la console (module VPN — onglet commandes), la caisse en ligne se rapproche dans la comptabilité.",
      "La provision est automatique : paiement → création du peer → livraison — vous n'intervenez qu'en support.",
    ],
    etapes: [
      {
        title: "Le visiteur découvre la vitrine",
        body:
          "La boutique MikTunnel (tunnel.ftci.fr/shop) présente l'offre (comparatif des formules, prix, promesses) — page publique, indexée SEO (elle vend pendant que vous dormez).",
        capture: cap(
          "annexes/vpn-shop.png",
          1440,
          5236,
          "Vitrine VPN B2C : comparatif des formules VPN avec prix et caractéristiques",
          "La vitrine VPN — la boutique e-commerce du tunnel.",
        ),
      },
      {
        title: "Il choisit et paie",
        body:
          "Formule → paiement (Wave / GeniusPay / Stripe selon disponibilité) → confirmation. Le paiement validé déclenche la provision automatique.",
      },
      {
        title: "Il reçoit ses clés",
        body:
          "QR + config WireGuard remis à l'écran (et par canal de contact selon réglages) — il scanne dans son appli et le tunnel est actif. Le suivi de commande reste consultable.",
        tip: "La vitrine tourne seule : votre rôle se réduit au support (client perdu ? guide VPN module — régénération des clés).",
      },
    ],
    usages: [
      {
        title: "Revenu passif",
        body:
          "Le VPN vendu en ligne 24/7 : zéro comptoir, provision automatique — la marge s'accumule dans les rapports.",
      },
    ],
    pieges: [
      {
        title: "Une vitrine qui vend ce que vous ne supportez pas",
        body:
          "Le support des clients B2C vous revient (perte de clés, quotas) : n'activez que les formules que vous savez accompagner.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Puis-je désactiver la vitrine sans casser les clients existants ?",
        a: "Oui — la désactivation ferme la BOUTIQUE (plus de nouvelles commandes) ; les peers actifs continuent de fonctionner jusqu'à leur échéance.",
      },
    ],
    related: ["vpn-wireguard", "abonnement-facturation"],
  },

  {
    id: "wifi-jetable-client",
    title: "WiFi jetable côté client & inscription QR",
    summary:
      "Le parcours du client sur l'accès offert : QR de table, page du site, téléphone (option), code reçu, navigation bornée — la face marketing du jetable.",
    roles: "Propriétaire · Gérant (support)",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "annexes",
    vague: "V3",
    quoi:
      "Côté client, le WiFi jetable est un parcours marketing : il scanne le QR posé sur la table, la page publique du site s'ouvre (noindex — le QR est le seul canal), il saisit son numéro de téléphone (optionnel, selon le site), reçoit son code offert et navigue dans le quota.\n\nLe claim (attribution du code) passe par l'API publique, le login par le portail — le client ne voit que « QR → page → code → Internet », 30 secondes.\n\nNOTE DE CAPTURE : l'illustration de la page publique /wifi/<site> sera ajoutée à la création du premier site jetable réel (la vue console du guide WiFi jetable montre déjà l'amont).",
    difference: [
      {
        with: "Le portail captif",
        body:
          "La page jetable DISTRIBUE les codes offerts ; le portail les VALIDE (login). Deux pages successives, un seul parcours client.",
      },
      {
        with: "L'inscription publique",
        body:
          "L'inscription crée un COMPTE durable (approbation) ; le jetable donne un accès immédiat à quota — recrutement lourd vs accueil léger.",
      },
    ],
    recoit: [
      "Le client : la page du site (votre marque, conditions d'accueil), son code offert, la navigation bornée au quota.",
      "Vous : les téléphones captés (si option active — matière marketing), les claims par site (statistiques de la vue WiFi Jetable).",
      "Le balayage anti-abus limite les claims industriels (cooldown, purge horaire des commandes mortes).",
    ],
    etapes: [
      {
        title: "Le client scanne le QR de table",
        body:
          "Le QR ouvre la page publique du site (/wifi/votre-site) — pas de réseau à chercher, pas de mot de demande. La page porte votre marque et les conditions de l'accueil.",
      },
      {
        title: "Il saisit son téléphone (option) puis reçoit son code",
        body:
          "Selon la configuration du site : numéro direct (marketing), ou code immédiat. Le claim part à l'API publique (anti-abus en amont) — le code s'affiche inline.",
      },
      {
        title: "Il se connecte au portail",
        body:
          "Le code reçu se saisit sur le portail (ou via le QR pré-rempli) — la session démarre dans le quota (durée/volume). À l'échéance, le quota s'arrête : nouvelle demande = nouveau claim (selon cooldown).",
        tip: "Affichez les DEUX usages sur le QR : « WiFi offert 15 min — journée complète à 300 F au comptoir » — l'accueil devient la pub du payant.",
      },
    ],
    usages: [
      {
        title: "L'entonnoir marketing",
        body:
          "Jetable offert → téléphones captés → offre SMS → conversion au payant : la terrasse devient un canal d'acquisition chiffré (les claims et conversions se suivent dans les rapports d'activité).",
      },
    ],
    pieges: [
      {
        title: "RGPD/loi ivoirienne : le téléphone est une donnée personnelle",
        body:
          "Si vous captez les numéros, affichez la finalité sur la page (consentement au QR) et tenez le registre de traitement — voir le document REGISTRE-TRAITEMENT du repo.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Le même téléphone peut-il claim plusieurs fois ?",
        a: "Selon le cooldown du site (anti-abus) : un client peut reprendre un accès après expiration, un script industriel est freiné.",
      },
    ],
    related: ["wifi-jetable", "inscriptions-publiques", "portail-client"],
  },
];
