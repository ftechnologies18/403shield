// Section « Tunnels & Accès Pro » — le pont privé WireGuard (N°333-B).
//
// 3 guides : la vitrine /vpn (déplacée des annexes — le guide documente
// désormais le socle unifié N°332-B), l'Accès Pro (routeurs, caméras, NAS)
// et la console tunnels (espace client sans mot de passe). Contenu calé
// sur les capacités réelles : pricing.segments (1 500 / 15 000 / 3 500 /
// 35 000 FCFA — constantes backend publicvpnorder.go), copy produit
// N°321/332 (IP fixe France sortie Marseille, code e-mail 6 chiffres,
// portefeuille d'appareils, renouvellement 1 clic, frais carte +6 % /
// Wave −3 %). Aucune capture tant que la session terrain n'a pas eu lieu
// (doctrine : jamais de faux écran).
import type { Guide } from "../types";
import { cap } from "../cap";

export const TUNNELS_GUIDES: Guide[] = [
  {
    id: "vitrine-vpn",
    title: "Vitrine VPN B2C (/vpn)",
    summary:
      "La vitrine publique du VPN personnel 403Shield : formules comparées, caisse du site (Wave/carte), configuration livrée par e-mail — et la console sans mot de passe pour la suite.",
    roles: "Public · Propriétaire (conseil)",
    minutes: 4,
    updated: "2026-10-18",
    sectionId: "tunnels",
    vague: "V3",
    quoi:
      "La vitrine /vpn (403shield.ftci.fr/vpn) présente le VPN personnel 403Shield : le même tunnel WireGuard qu'en Accès Pro, avec une IP fixe France dédiée qui sort par Marseille. Le visiteur y compare les deux formules — mensuelle (1 500 FCFA/mois, sans engagement) et annuelle (15 000 FCFA/an, 12 mois au prix de 10) — puis passe à la caisse du site (/checkout, formule présélectionnée) payable Wave ou carte.\n\nDepuis la refonte du site unifié, vitrine et caisse vivent sur 403shield.ftci.fr : les anciens liens de commande (tunnel.ftci.fr/shop, /vpn?order=…) sont redirigés. La configuration arrive par e-mail et s'importe dans l'appli WireGuard en quelques gestes — aucun fichier à éditer.",
    difference: [
      {
        with: "Le module VPN (console hotspot)",
        body:
          "Le module administre les peers que VOUS revendez à vos clients (quotas, revente manuelle) ; la vitrine vend le VPN personnel 403Shield en direct — deux offres, deux circuits. Guide : VPN WireGuard vendable.",
      },
      {
        with: "Le portail captif",
        body:
          "Le portail connecte au WiFi de l'établissement ; le VPN personnel protège le trafic du visiteur PARTOUT (téléphone, ordinateur, tablette) derrière une IP fixe France.",
      },
    ],
    recoit: [
      "Le visiteur : les deux formules comparées (prix, promesses, FAQ), la caisse du site payable Wave ou carte (frais répercutés : carte +6 %, Wave −3 % — remise mobile money).",
      "Après paiement : la configuration WireGuard livrée par e-mail, l'import immédiat dans l'appli, et l'accès à l'espace client (console sans mot de passe — code e-mail à 6 chiffres).",
      "L'espace client : portefeuille d'appareils, statuts en direct, renouvellement en 1 clic — VPN et Accès Pro vivent au même endroit.",
    ],
    etapes: [
      {
        title: "Le visiteur découvre la vitrine",
        body:
          "La page /vpn présente l'offre : IP fixe France dédiée, WireGuard, appareils couverts, captures et FAQ — puis le comparatif des formules (mensuelle / annuelle). Page publique, indexée : elle vend pendant que vous dormez.",
        capture: cap(
          "tunnels/vitrine-vpn.png",
          1440,
          7930,
          "Vitrine VPN 403Shield : hero IP fixe France, section WireGuard, grille des formules et FAQ de la page /vpn",
          "La vitrine /vpn — hero, tarifs et FAQ du VPN personnel.",
        ),
      },
      {
        title: "Il choisit sa formule et paie",
        body:
          "Mensuel ou annuel → la caisse du site s'ouvre avec la formule présélectionnée (/checkout?plan=…). Paiement Wave ou carte ; les frais de paiement s'affichent avant confirmation (carte +6 %, Wave −3 %).",
      },
      {
        title: "Il reçoit sa configuration",
        body:
          "Le paiement validé déclenche la livraison : configuration WireGuard par e-mail, import dans l'appli (téléphone, ordinateur, tablette) — le tunnel est actif. Aucun compte à créer au comptoir, aucun fichier à éditer.",
        tip: "Le suivi se fait depuis l'espace client (console sans mot de passe — code e-mail à 6 chiffres) : appareils, statuts, renouvellement en 1 clic.",
      },
    ],
    usages: [
      {
        title: "Le conseil au comptoir",
        body:
          "Vos clients demandent souvent comment protéger leur téléphone au-delà de votre WiFi : la vitrine /vpn est la réponse à leur donner — le tunnel personnel, indépendant de votre établissement.",
      },
    ],
    pieges: [
      {
        title: "Un VPN ne remplace pas l'abonnement internet",
        body:
          "Le tunnel chiffre et fait sortir le trafic par une IP fixe France — il ne fournit pas d'accès à internet en tant que tel. Le visiteur garde son forfait Orange/Starlink.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "VPN ou Accès Pro : que conseiller ?",
        a: "Les deux vivent sur le même tunnel. Le VPN protège l'usage personnel (téléphone, ordinateur) ; l'Accès Pro y branche routeurs, caméras et NAS avec supervision console — pour un client qui gère un établissement, c'est l'extension naturelle.",
      },
      {
        q: "Faut-il un routeur particulier ?",
        a: "Pour le VPN seul, aucun routeur : le téléphone ou l'ordinateur suffit. L'Accès Pro demande un MikroTik sous RouterOS 7 (l'agent 403Shield y tourne).",
      },
      {
        q: "Comment se renouvelle l'abonnement ?",
        a: "Depuis la boutique, avec un rappel par e-mail avant l'échéance — le renouvellement tient en 1 clic depuis l'espace client.",
      },
    ],
    related: ["acces-pro", "console-tunnels", "vpn-wireguard"],
  },

  {
    id: "acces-pro",
    title: "Accès Pro — routeurs, caméras et NAS dans le tunnel",
    summary:
      "L'abonnement qui étend le tunnel WireGuard à vos équipements : routeurs MikroTik supervisés en continu, admin/API/SSH à distance, LAN derrière CGNAT — sans un seul port ouvert.",
    roles: "Propriétaire · Équipe technique",
    minutes: 6,
    updated: "2026-10-18",
    sectionId: "tunnels",
    vague: "V1",
    quoi:
      "L'Accès Pro (3 500 FCFA/mois · 35 000 FCFA/an) branche vos équipements dans le même tunnel WireGuard que le VPN personnel : les routeurs MikroTik s'y raccordent par l'agent 403Shield, et le LAN derrière eux devient joignable en privé — caméras, enregistreurs, NAS, imprimantes. Tout le trafic sort chiffré par Marseille, derrière une IP fixe France.\n\nAucun port à ouvrir, aucune interface exposée sur Internet : le routeur APPELLE le tunnel en sortant — ça marche derrière CGNAT (Orange CI) comme en Starlink, sans IP publique. La souscription se fait depuis la console (console.403shield.ftci.fr/pro).\n\nNOTE DE CAPTURE : les vues de la console tunnels (portefeuille d'appareils, statuts Accès Pro) s'illustreront lors d'une session terrain — aucune capture de substitution.",
    difference: [
      {
        with: "Le VPN personnel",
        body:
          "Le VPN protège le trafic d'UN appareil (téléphone, ordinateur, tablette) ; l'Accès Pro y raccorde un PARC et son LAN. Même tunnel, même console — on commence souvent par le VPN, on étend ensuite.",
      },
      {
        with: "Le module VPN de la console hotspot",
        body:
          "Le module VPN revend des accès à VOS clients (quotas, revente — guide VPN WireGuard vendable) ; l'Accès Pro est VOTRE accès distant à VOS réseaux. Deux produits, deux consoles.",
      },
      {
        with: "Le port forwarding classique",
        body:
          "Ouvrir un port publie une interface sur Internet (scans, brute-force, failles) ; l'Accès Pro ne publie RIEN — personne n'entre, c'est le routeur qui appelle.",
      },
    ],
    recoit: [
      "La supervision continue des routeurs raccordés : état en ligne/hors ligne, alertes hors-ligne, échéances d'abonnement.",
      "Admin, API et SSH des routeurs via le tunnel privé — depuis n'importe où, sans exposer une seule interface.",
      "Le LAN étendu : caméras, enregistreurs, NAS et imprimantes joignables en privé, comme si vous étiez sur place.",
      "La même console que le VPN personnel (code e-mail, sans mot de passe) — un seul endroit pour tout le tunnel.",
    ],
    etapes: [
      {
        title: "Vérifiez le prérequis routeur",
        body:
          "L'Accès Pro se raccorde par l'agent 403Shield : il tourne sur les MikroTik sous RouterOS 7 (guide Connecter votre routeur). Pas encore de routeur agenté ? Le VPN personnel couvre déjà vos appareils nomades en attendant.",
      },
      {
        title: "Souscrivez l'Accès Pro",
        body:
          "Depuis la console (console.403shield.ftci.fr/pro) : 3 500 FCFA/mois ou 35 000 FCFA/an. Le tunnel est le même que celui du VPN — la souscription étend les droits au parc et au LAN.",
      },
      {
        title: "Raccordez le routeur au tunnel",
        body:
          "L'agent du routeur porte la configuration : le routeur appelle le tunnel en SORTANT. Aucun port à ouvrir sur la box, aucune IP publique requise — CGNAT Orange et Starlink sont des terrains normaux.",
      },
      {
        title: "Rejoignez vos interfaces",
        body:
          "Admin Web, API et SSH du routeur passent par le tunnel privé : vous pilotez le parc depuis la boutique, la maison ou la route — les interfaces restent invisibles d'Internet.",
      },
      {
        title: "Étendez au LAN",
        body:
          "Ce qui est derrière le routeur devient joignable en privé : caméras et enregistreurs (applications de vidéosurveillance), NAS et fichiers, imprimantes. Les adresses restent celles du réseau local — l'accès, lui, voyage chiffré.",
        tip: "Caméras derrière CGNAT : c'est LE cas d'usage central — le tunnel sort du routeur vers Marseille, aucun port ni IP publique n'est requis de votre côté.",
      },
      {
        title: "Surveillez les alertes",
        body:
          "La console surveille les routeurs en continu : alertes hors-ligne (un routeur qui tombe se sait), échéances d'abonnement configurables. Guide Notifications pour les canaux (Telegram, e-mail).",
      },
    ],
    usages: [
      {
        title: "L'établissement derrière CGNAT",
        body:
          "Les caméras du maquis visibles depuis la maison, le NAS joignable en déplacement — sans ouvrir un seul port sur la box Orange.",
      },
      {
        title: "Le parc multi-sites",
        body:
          "Chaque site qui doit être joignable raccorde son routeur au tunnel : les réseaux se rejoignent en privé, la supervision reste dans une console (guide Sites & multi-sites).",
      },
      {
        title: "L'administrateur itinérant",
        body:
          "Piloter un routeur à distance sans Winbox publiée : admin, API et SSH via le tunnel, depuis le téléphone comme depuis l'atelier.",
      },
    ],
    pieges: [
      {
        title: "L'Accès Pro ne fournit pas internet",
        body:
          "Le tunnel interconnecte des réseaux existants — il ne remplace ni Orange, ni Starlink, ni votre abonnement. Chaque site garde sa propre connexion.",
        severity: "info",
      },
      {
        title: "Routeur éteint = LAN injoignable",
        body:
          "Le tunnel part DU routeur : si le routeur tombe, les caméras restent accessibles localement (elles continuent d'enregistrer) mais plus à distance — l'alerte hors-ligne vous prévient.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Mes caméras sont derrière CGNAT : ça marche ?",
        a: "Oui — c'est le cas d'usage central de l'Accès Pro. Le tunnel sort de votre routeur vers Marseille ; aucun port ni IP publique n'est requis de votre côté.",
      },
      {
        q: "Faut-il un routeur par site ?",
        a: "Chaque site qui doit être joignable à distance raccorde son routeur au tunnel (MikroTik sous RouterOS 7). Les sites sans équipement à rejoindre n'en ont pas besoin.",
      },
      {
        q: "Comment se renouvelle l'Accès Pro ?",
        a: "Depuis la console, avec des alertes d'échéance configurables — à la différence du VPN personnel qui se renouvelle depuis la boutique (rappel e-mail).",
      },
    ],
    related: ["console-tunnels", "vitrine-vpn", "sites-multi-sites", "connecter-routeur-agent"],
  },

  {
    id: "console-tunnels",
    title: "Console tunnels & espace client (sans mot de passe)",
    summary:
      "L'espace client des tunnels : connexion par code e-mail à 6 chiffres, portefeuille d'appareils, statuts en direct, renouvellement 1 clic — VPN et Accès Pro au même endroit.",
    roles: "Client VPN · Accès Pro",
    minutes: 4,
    updated: "2026-10-18",
    sectionId: "tunnels",
    vague: "V1",
    quoi:
      "La console des tunnels (console.403shield.ftci.fr) se connecte SANS mot de passe : votre e-mail reçoit un code à 6 chiffres, la session s'ouvre. Rien à créer, rien à retenir — le code prouve l'accès à votre boîte e-mail.\n\nL'espace réunit le portefeuille d'appareils (configurations WireGuard, statuts en direct), les échéances et le renouvellement en 1 clic. Les abonnements VPN et Accès Pro vivent au même endroit, entre cette console et la boutique du site.\n\nNOTE DE CAPTURE : les vues de l'espace client (portefeuille, échéances) s'illustreront lors d'une session terrain — aucune capture de substitution.",
    difference: [
      {
        with: "La console d'exploitation hotspot",
        body:
          "La console hotspot gère votre activité WiFi (vouchers, sessions, rapports — connexion identifiant/mot de passe, guide Premiers pas) ; la console tunnels gère VOS accès personnels (code e-mail). Deux espaces, deux usages.",
      },
      {
        with: "La boutique (/checkout)",
        body:
          "La boutique VEND (achat et renouvellement d'un abonnement VPN — Wave, carte) ; la console PILOTE (appareils, statuts, échéances). Le renouvellement 1 clic traverse les deux.",
      },
      {
        with: "L'appli WireGuard",
        body:
          "L'appli importe UNE configuration sur UN appareil ; la console montre le portefeuille entier et son état — téléphone, ordinateur, routeurs.",
      },
    ],
    recoit: [
      "La connexion par code e-mail (6 chiffres, sans mot de passe) — rien à mémoriser, rien à réinitialiser.",
      "Le portefeuille d'appareils : chaque configuration WireGuard et son statut en direct.",
      "Les échéances et le renouvellement en 1 clic — rappel e-mail avant échéance pour le VPN, alertes configurables pour l'Accès Pro.",
      "Les alertes hors-ligne des routeurs raccordés en Accès Pro.",
    ],
    etapes: [
      {
        title: "Demandez votre code",
        body:
          "E-mail → code à 6 chiffres → session ouverte. Le code est à usage unique et courte durée : un nouveau départ à chaque connexion, sans mot de passe à gérer.",
      },
      {
        title: "Repérez le portefeuille d'appareils",
        body:
          "Chaque appareil — téléphone, ordinateur, routeur en Accès Pro — avec sa configuration WireGuard et son statut en direct. C'est la vue de tête de l'espace client.",
      },
      {
        title: "Installez une configuration",
        body:
          "L'e-mail de livraison contient la configuration : import direct dans l'appli WireGuard (téléphone, ordinateur, tablette). Pour un routeur, c'est l'agent 403Shield qui porte la configuration (guide Accès Pro).",
      },
      {
        title: "Suivez les échéances",
        body:
          "Chaque abonnement affiche sa date : le VPN se renouvelle depuis la boutique (rappel e-mail avant l'échéance), l'Accès Pro depuis la console (alertes configurables) — le renouvellement tient en 1 clic.",
      },
      {
        title: "Restez à l'écoute des alertes",
        body:
          "Un routeur Accès Pro hors ligne se signale ; une échéance qui approche se rappelle à vous. La console est l'endroit où le tunnel « parle » — consultez-la avant d'appeler le support.",
      },
    ],
    usages: [
      {
        title: "Le nomade",
        body:
          "Téléphone et ordinateur dans le portefeuille, renouvellement en 1 clic depuis la route : le VPN personnel se pilote entre deux escales.",
      },
      {
        title: "Le gestionnaire multi-établissements",
        body:
          "Les routeurs du parc en Accès Pro, les alertes hors-ligne en veille : la console devient le tableau de bord des réseaux distants.",
      },
    ],
    pieges: [
      {
        title: "Le code e-mail expire vite",
        body:
          "À usage unique et courte durée : si le temps file, redemandez un code frais plutôt que de chercher l'ancien dans la boîte.",
        severity: "info",
      },
      {
        title: "Une configuration = un appareil",
        body:
          "Une configuration WireGuard correspond à UN appareil du portefeuille : partagez-la et les usages se mélangent. Générez plutôt une configuration par appareil — c'est fait pour.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "J'ai perdu mon code ?",
        a: "Il est à usage unique : redemandez-en un depuis l'écran de connexion — il arrive dans votre boîte en quelques instants.",
      },
      {
        q: "VPN et Accès Pro dans le même espace ?",
        a: "Oui — même tunnel, même console : le VPN protège vos appareils nomades, l'Accès Pro y raccorde routeurs et LAN. Les échéances de chacun s'y suivent côte à côte.",
      },
      {
        q: "Je change de téléphone ?",
        a: "Installez la configuration sur le nouvel appareil (l'e-mail de livraison la contient) ; si l'ancien reste entre de mauvaises mains, le support 403Shield coupe l'accès depuis la console.",
      },
    ],
    related: ["acces-pro", "vitrine-vpn", "vpn-wireguard"],
  },
];
