// Section « Tunnels & Accès Pro » — le pont privé WireGuard (N°333-B).
//
// 7 guides : la vitrine /vpn (déplacée des annexes — le guide documente
// désormais le socle unifié N°332-B), l'Accès Pro (routeurs, caméras, NAS),
// son installation multi-appareils (N°341 : la conf est du WireGuard
// standard — PC, NAS Synology/QNAP, OpenWRT, pfSense/OPNsense, GL.iNet —
// le MikroTik requis côté site rejoint uniquement), le pair-à-pair privé
// (N°341 : vos appareils Pro se rejoignent via Marseille, PC ↔ NAS,
// PC ↔ PC, sans routeur dans le chemin), l'Accès Invité (N°342 : confs
// expirables pour un tiers — périmètre minimal hôte/32 + pin-holes, TTL
// 1-72 h, révocation immédiate, expiration automatique), la console
// tunnels (espace client sans mot de passe) et le guide transparence IP
// (N°338 : IP localisable = comportement attendu, vérification
// zéro-fuite, kill switch, doctrine 1 conf = 1 appareil). Contenu calé
// sur les capacités réelles : pricing.segments (1 500 / 15 000 / 3 500 /
// 35 000 FCFA — constantes backend publicvpnorder.go), copy produit
// N°321/332 (IP fixe France sortie Marseille, code e-mail 6 chiffres,
// portefeuille d'appareils, renouvellement 1 clic, frais carte +6 % /
// Wave −3 %). Aucune capture tant que la session terrain n'a pas eu lieu
// (doctrine : jamais de faux écran) — le guide IP n'en aura JAMAIS : la
// vérification vit sur des sites tiers, une capture n'apprendrait rien.
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
        a: "Pour le VPN seul, aucun routeur : le téléphone ou l'ordinateur suffit. L'Accès Pro s'appuie sur un MikroTik sous RouterOS 7 comme passerelle de site — les appareils qui se connectent, eux, peuvent être n'importe quels appareils WireGuard.",
      },
      {
        q: "Comment se renouvelle l'abonnement ?",
        a: "Depuis la boutique, avec un rappel par e-mail avant l'échéance — le renouvellement tient en 1 clic depuis l'espace client.",
      },
    ],
    related: ["acces-pro", "console-tunnels", "ip-vpn-localisable", "vpn-wireguard"],
  },

  {
    id: "acces-pro",
    title: "Accès Pro — routeurs, caméras et NAS dans le tunnel",
    summary:
      "L'abonnement qui étend le tunnel WireGuard à vos équipements : routeurs MikroTik supervisés en continu, admin/API/SSH à distance, LAN derrière CGNAT, pair-à-pair privé entre vos appareils — sans un seul port ouvert.",
    roles: "Propriétaire · Équipe technique",
    minutes: 6,
    updated: "2026-10-19",
    sectionId: "tunnels",
    vague: "V1",
    quoi:
      "L'Accès Pro (3 500 FCFA/mois · 35 000 FCFA/an) branche vos équipements dans le même tunnel WireGuard que le VPN personnel : les routeurs MikroTik s'y raccordent par l'agent 403Shield, et le LAN derrière eux devient joignable en privé — caméras, enregistreurs, NAS, imprimantes. Tout le trafic sort chiffré par Marseille, derrière une IP fixe France.\n\nLa configuration est du WireGuard standard : elle s'installe sur tout appareil capable de WireGuard — PC, téléphone, NAS, autre routeur (guide Installer l'Accès Pro sur PC, NAS et routeurs tiers). Le MikroTik n'est requis que d'un côté : celui du site rejoint, comme passerelle agentée. Et vos appareils Pro se rejoignent en privé via Marseille — PC ↔ NAS, PC ↔ PC — sans routeur dans le chemin (guide Le pair-à-pair privé).\n\nAucun port à ouvrir, aucune interface exposée sur Internet : le routeur APPELLE le tunnel en sortant — ça marche derrière CGNAT (Orange CI) comme en Starlink, sans IP publique. La souscription se fait depuis la console (console.403shield.ftci.fr/pro).\n\nNOTE DE CAPTURE : les vues de la console tunnels (portefeuille d'appareils, statuts Accès Pro) s'illustreront lors d'une session terrain — aucune capture de substitution.",
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
          "L'Accès Pro se raccorde par l'agent 403Shield : il tourne sur les MikroTik sous RouterOS 7 (guide Connecter votre routeur). Pas encore de routeur agenté ? Le VPN personnel couvre déjà vos appareils nomades en attendant. Précision utile : le MikroTik est la passerelle du SITE rejoint — l'appareil qui se connecte, lui, peut être n'importe quel appareil WireGuard (PC, NAS, routeur tiers — guide dédié).",
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
      {
        title: "Le pair-à-pair privé",
        body:
          "PC ↔ NAS, PC ↔ PC : vos appareils Pro se rejoignent en privé via Marseille, sans routeur dans le chemin — le guide Pair-à-pair privé donne les recettes (fichiers, prise de main, serveur entre vos machines).",
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
      {
        q: "Faut-il un MikroTik de chaque côté ?",
        a: "Non. Le MikroTik est requis côté SITE rejoint — la passerelle agentée qui porte le LAN étendu et la supervision. L'appareil qui se connecte est n'importe quel appareil WireGuard : PC, téléphone, NAS, routeur tiers (guide dédié).",
      },
    ],
    related: ["acces-pro-multi-appareils", "acces-pro-pair-a-pair", "acces-invite", "console-tunnels"],
  },

  {
    id: "acces-pro-multi-appareils",
    title: "Installer l'Accès Pro sur PC, NAS et routeurs tiers",
    summary:
      "La configuration Pro est du WireGuard standard : PC Windows/macOS/Linux, NAS Synology/QNAP, routeurs OpenWRT, pfSense, OPNsense, GL.iNet — le MikroTik n'est requis que côté site rejoint, comme passerelle.",
    roles: "Accès Pro · Équipe technique",
    minutes: 7,
    updated: "2026-10-19",
    sectionId: "tunnels",
    vague: "V1",
    quoi:
      "La configuration révélée par la console (« Voir la configuration ») est un fichier WireGuard standard : une clé privée, l'adresse tunnel de l'appareil, et le peer 403Shield de Marseille avec son périmètre (AllowedIPs = les segments de supervision, plus votre LAN étendu le cas échéant). Tout appareil capable de WireGuard peut la porter — le MikroTik n'a jamais été requis de ce côté-là.\n\nDeux voies sont OFFICIELLES et documentées : l'application WireGuard (téléphone, ordinateur — QR ou fichier .conf) et l'import RouterOS 7 sur MikroTik. Tout le reste — OpenWRT, pfSense, OPNsense, GL.iNet, NAS Synology ou QNAP — est PRATICABLE : le même fichier s'y adapte à la main, hors périmètre support. Le MikroTik reste la passerelle du SITE rejoint : c'est lui qui porte l'agent 403Shield, la détection LAN et les règles du LAN étendu.\n\nNOTE DE CAPTURE : les interfaces de ces firmwares et paquets tiers ne seront pas capturées — chaque écran d'import appartient à son éditeur, une capture de substitution n'apprendrait rien.",
    difference: [
      {
        with: "Les voies officielles (appli WireGuard, RouterOS 7)",
        body:
          "Appli WireGuard et import RouterOS 7 sont documentés pas à pas : le support 403Shield peut dépanner l'import. Les firmwares tiers et NAS sont praticables — mêmes champs à recopier, mais l'adaptation est à vous.",
      },
      {
        with: "Le VPN personnel (tunnel complet)",
        body:
          "La conf VPN route TOUT (AllowedIPs 0.0.0.0/0 — navigation et DNS par Marseille) ; la conf Pro route un périmètre ciblé : vos routeurs, vos pairs, votre LAN étendu. Votre navigation Internet reste directe — c'est voulu.",
      },
      {
        with: "La passerelle MikroTik du site",
        body:
          "Deux rôles, deux exigences : côté APPAREIL, n'importe quel WireGuard (PC, NAS, routeur tiers) ; côté SITE rejoint, la passerelle reste un MikroTik sous RouterOS 7 — l'agent y pose la détection LAN et les règles d'extension.",
      },
    ],
    recoit: [
      "La même configuration (QR + fichier .conf + copie) utilisable sur tout appareil WireGuard — un seul livrable, plusieurs destinations.",
      "Les voies d'import praticables par famille d'appareil : PC, OpenWRT, pfSense/OPNsense, GL.iNet, NAS.",
      "La frontière honnête du support : conf et voies officielles dépannées ; firmwares tiers et paquets NAS adaptés par vous.",
      "Le rappel de la règle du portefeuille : une configuration = un appareil (guide L'IP du VPN est localisable).",
    ],
    etapes: [
      {
        title: "Récupérez la configuration",
        body:
          "Console → Accès Pro → « Voir la configuration » : le QR (téléphone), le fichier .conf (import partout) et la copie brute. L'adresse tunnel de l'appareil (10.8.2.x) s'affiche au portefeuille — notez-la : c'est elle que les autres appareils joindront. Un renouvellement ne change jamais la conf.",
      },
      {
        title: "Sur PC (Windows, macOS, Linux)",
        body:
          "Application WireGuard officielle → « Importer un tunnel depuis un fichier » → le .conf téléchargé. Activez le tunnel : le périmètre Pro est routé (segments 10.8.x, LAN étendu éventuel), le reste du trafic reste direct. C'est la voie la plus simple — et elle est officielle.",
      },
      {
        title: "Sur routeur tiers (OpenWRT, pfSense, OPNsense, GL.iNet)",
        body:
          "Le même fichier se recopie champ par champ : clé privée et adresse (Interface), clé publique du serveur, endpoint Marseille, AllowedIPs, PersistentKeepalive (Peer). OpenWRT : protocole WireGuard dans LuCI (ou uci) ; pfSense/OPNsense : le paquet WireGuard, interface + peer ; GL.iNet : le client WireGuard natif, qui importe souvent le .conf tel quel. Voies praticables — le support fournit la conf, pas la main-d'œuvre du firmware.",
        tip: "Le champ à ne jamais tronquer : AllowedIPs. C'est le périmètre — le copier partiellement rétrécit l'accès au lieu de l'élargir.",
      },
      {
        title: "Sur NAS (Synology, QNAP)",
        body:
          "Ni Synology ni QNAP ne livrent de client WireGuard officiel dans leur système. La voie praticable passe par un conteneur Docker (images communautaires éprouvées, pile réseau en mode hôte ou NET_ADMIN) — ou un paquet tiers selon les modèles. Le NAS devient alors un pair comme un autre, joignable à son adresse tunnel (guide Le pair-à-pair privé).",
      },
      {
        title: "Vérifiez, et gardez la règle d'or",
        body:
          "Tunnel actif : joignez un routeur supervisé (Winbox sur son adresse 10.8.0.x) ou un autre appareil Pro (son adresse 10.8.2.x) — si l'un répond, l'import est bon. Et n'installez JAMAIS la même conf deux fois : un nouvel appareil = une nouvelle commande Pro, une nouvelle conf, sa propre clé (le partage se punit tout seul — sessions volées par roaming).",
      },
    ],
    usages: [
      {
        title: "Le poste d'administration",
        body:
          "Le PC de l'atelier porte la conf Pro : Winbox, API et SSH des routeurs passent par le tunnel — et le LAN étendu devient joignable depuis le même poste, sans interface publiée.",
      },
      {
        title: "Le NAS dans le tunnel",
        body:
          "Un NAS avec sa propre conf devient un pair : vos autres appareils Pro le joignent à son adresse tunnel — fichiers et sauvegardes en privé (guide Pair-à-pair privé).",
      },
      {
        title: "Le routeur tiers comme appareil",
        body:
          "Un OpenWRT ou un GL.iNet peut porter la conf là où un PC serait démesuré. Attention : il rejoint le tunnel comme APPAREIL — l'extension de SON LAN reste du ressort d'une passerelle MikroTik agentée.",
      },
    ],
    pieges: [
      {
        title: "Hors périmètre support",
        body:
          "Le support 403Shield dépanne la conf et les deux voies officielles (appli WireGuard, RouterOS 7). Sur un firmware tiers ou un paquet NAS, il fournit le fichier — l'adaptation et la maintenance sont à vous.",
        severity: "info",
      },
      {
        title: "S'attendre à ce que la navigation change",
        body:
          "La conf Pro ne route ni votre navigation ni votre DNS : un test de géolocalisation affichera votre IP FAI — normal, ce n'est pas le VPN personnel. Seul le périmètre Pro voyage dans le tunnel.",
        severity: "info",
      },
      {
        title: "Copier la conf sur un deuxième appareil",
        body:
          "Même clé sur deux machines = sessions volées par roaming, connexion qui tombe. Une configuration = un appareil — c'est la règle du portefeuille (guide L'IP du VPN est localisable).",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Le support dépanne-t-il OpenWRT ou mon NAS ?",
        a: "La configuration, oui — et les deux voies officielles (appli WireGuard, import RouterOS 7) pas à pas. Le firmware tiers et le paquet NAS restent à votre main : mêmes champs à recopier, adaptation manuelle.",
      },
      {
        q: "Pourquoi mon IP ne change-t-elle pas avec la conf Pro ?",
        a: "Parce que le périmètre est ciblé : le tunnel Pro route vos équipements (segments 10.8.x, LAN étendu), pas votre navigation. L'IP de sortie change avec le VPN personnel, lui en tunnel complet.",
      },
      {
        q: "Mon routeur non-MikroTik peut-il servir de passerelle de site ?",
        a: "Pas aujourd'hui : la détection LAN et les règles d'extension sont posées par l'agent 403Shield, qui vit sur RouterOS 7. Un routeur tiers se raccorde comme appareil — la passerelle reste MikroTik.",
      },
      {
        q: "Combien d'appareils puis-je raccorder ?",
        a: "Chaque commande Pro couvre UN appareil (sa conf, sa clé) — un appareil de plus, une commande de plus. Le portefeuille de la console suit chaque appareil et son échéance.",
      },
    ],
    related: ["acces-pro", "acces-pro-pair-a-pair", "acces-invite", "console-tunnels"],
  },

  {
    id: "acces-pro-pair-a-pair",
    title: "Le pair-à-pair privé : vos appareils Pro se rejoignent via Marseille",
    summary:
      "PC ↔ NAS, PC ↔ PC : deux appareils Pro du même compte se joignent en privé à travers le tunnel — le routeur n'est pas dans le chemin, aucun port n'est publié.",
    roles: "Client VPN · Accès Pro",
    minutes: 5,
    updated: "2026-10-19",
    sectionId: "tunnels",
    vague: "V1",
    quoi:
      "Chaque appareil raccordé en Accès Pro reçoit sa propre adresse tunnel (10.8.2.x pour les confs actuelles) — et la conf porte l'ensemble du périmètre Pro. Résultat peu connu : vos appareils Pro se joignent ENTRE EUX à travers le tunnel. Votre portable joint le NAS du bureau, votre PC fixe répond à votre portable — le serveur de Marseille relaie d'un pair vers l'autre, et personne d'autre n'est invité.\n\nLe mécanisme est simple : votre conf sait que tout le périmètre Pro vit dans le tunnel (AllowedIPs 10.8.0.0/24 et 10.8.2.0/24), la VM relaie les paquets d'un pair vers l'autre sans les réécrire — les vraies adresses tunnel sont préservées. Le trajet est chiffré sur chaque bras (votre appareil ↔ Marseille, puis Marseille ↔ l'autre appareil) : c'est le modèle de tout relais VPN, le serveur voit transiter le trafic comme n'importe quel serveur de tunnel.\n\nLe MikroTik n'est PAS dans ce chemin : il reste la passerelle des sites à rejoindre (LAN étendu, supervision). Le pair-à-pair, ce sont vos appareils qui portent la conf — et rien d'autre.\n\nNOTE DE CAPTURE : aucune capture dans ce guide — il décrit un mécanisme réseau, pas un écran de la console.",
    difference: [
      {
        with: "Le LAN étendu (via routeur)",
        body:
          "Le LAN étendu joint les équipements DERRIÈRE une passerelle MikroTik (caméras, imprimantes — les machines qui ne portent pas WireGuard) ; le pair-à-pair relie les appareils qui PORTENT la conf, sans aucun routeur dans le chemin. Les deux se complètent.",
      },
      {
        with: "Le cloud de partage de fichiers",
        body:
          "Le cloud relit vos fichiers chez un tiers, avec son abonnement ; le pair-à-pair relie vos machines entre elles — les données voyagent dans le tunnel, sans intermédiaire de stockage.",
      },
      {
        with: "Le port forwarding classique",
        body:
          "Publier RDP ou SMB sur Internet, c'est offrir un service aux scanners du monde entier ; le pair-à-pair ne publie rien — vos services n'écoutent que dans le tunnel, joignables uniquement par vos appareils.",
      },
    ],
    recoit: [
      "Le mécanisme en une phrase : adresses tunnel dédiées (10.8.2.x), relais par Marseille, adresses préservées, aucun port publié.",
      "Les recettes concrètes : joindre un NAS (fichiers, sauvegardes), prendre la main sur un poste (RDP, VNC), héberger un service pour vos propres appareils.",
      "Les limites honnêtes : l'appareil distant doit être allumé, le trajet passe par Marseille, et les invités tiers vivent de l'Accès Invité (guide dédié).",
    ],
    etapes: [
      {
        title: "Donnez à chaque appareil sa configuration",
        body:
          "Deux appareils = deux commandes Pro = deux confs (règle d'or : une configuration = un appareil). Chaque conf se révèle depuis la console (« Voir la configuration ») et s'installe sur son appareil — l'adresse tunnel de chacun s'affiche au portefeuille : c'est votre annuaire.",
      },
      {
        title: "Joignez l'autre appareil par son adresse tunnel",
        body:
          "Tout ce qui écoute sur l'appareil distant est joignable à son adresse : ping 10.8.2.y pour vérifier, puis http://10.8.2.y (interface web), smb:// ou rsync vers le NAS, RDP/VNC vers le poste. Rien à ouvrir, rien à publier — le tunnel est déjà la route.",
        tip: "L'adresse tunnel de chaque appareil est visible au portefeuille de la console — notez les vôtres une fois pour toutes.",
      },
      {
        title: "Hébergez un service pour vos propres appareils",
        body:
          "Un serveur de jeu sur le PC fixe, une démo web sur le portable de développement : le service écoute sur l'adresse tunnel de sa machine, et vos AUTRES appareils Pro le joignent en privé — même derrière CGNAT. Faire entrer un tiers extérieur au compte, c'est précisément l'Accès Invité (guide dédié) : une conf expirable qui ne joint QUE cet appareil, sur les ports déclarés.",
      },
      {
        title: "Comptez le trajet, honnêtement",
        body:
          "Deux appareils à Abidjan qui se parlent via Marseille : les paquets font l'aller-retour vers la France. Parfait pour des fichiers, une prise de main, une démo — moins pour du jeu compétitif entre deux machines du même bureau : sur place, le réseau local direct reste la bonne réponse. Le tunnel est fait pour la distance.",
      },
    ],
    usages: [
      {
        title: "Le NAS joignable en déplacement",
        body:
          "Fichiers, sauvegardes rsync, partages SMB : le NAS du bureau porte sa conf, le portable le joint à son adresse tunnel — sans cloud, sans port ouvert.",
      },
      {
        title: "Le poste à distance",
        body:
          "RDP ou VNC sur votre PC fixe depuis l'extérieur : l'un des usages les plus demandés — et la réponse n'est JAMAIS de publier RDP sur Internet, mais de le faire écouter dans le tunnel.",
      },
      {
        title: "Le serveur entre vos machines",
        body:
          "Un serveur de jeu ou une démo web écoutant sur l'adresse tunnel du PC qui l'héberge : vos autres appareils Pro le rejoignent en privé — même derrière CGNAT.",
      },
    ],
    pieges: [
      {
        title: "L'appareil distant éteint est injoignable",
        body:
          "Pas de pair, pas de relais : un PC en veille ne répond pas. Prévoyez le réveil local (Wake-on-LAN sur le réseau du site) ou laissez la machine allumée quand vous comptez vous y connecter.",
        severity: "warn",
      },
      {
        title: "Le débit transite par Marseille",
        body:
          "L'aller-retour par la France entre deux appareils du même pays : très bien pour des fichiers et une prise de main, moins pour du trafic local à latence serrée. Sur place, préférez le réseau local.",
        severity: "info",
      },
      {
        title: "Les invités ont leur propre voie",
        body:
          "Le pair-à-pair relie les appareils de VOTRE compte. Faire entrer un ami ou un client passe par l'Accès Invité : une conf expirable à périmètre minimal (un hôte, des ports, un terme). Ne « solutionnez » JAMAIS ça en partageant une conf : la règle une conf = un appareil la rendrait inutilisable de toute façon.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Pourquoi passer par Marseille plutôt qu'en direct ?",
        a: "Le direct exige une IP publique joignable des deux côtés — rare derrière le CGNAT d'Orange. Le relais fixe de Marseille marche partout, tout le temps, et reste chiffré sur chaque bras du trajet.",
      },
      {
        q: "Mes deux appareils peuvent-ils partager une même conf ?",
        a: "Non — deux appareils avec la même clé se volent leur session (roaming) : connexion instable, zéro gain. Deux appareils = deux commandes Pro, chacune au portefeuille avec son adresse.",
      },
      {
        q: "Mon ami peut-il rejoindre mon serveur de jeu ?",
        a: "Oui — par l'Accès Invité : une conf expirable qui ne joint QUE l'appareil qui héberge le serveur, sur le port déclaré (guide dédié). Ne partagez jamais votre propre conf.",
      },
      {
        q: "Le pair-à-pair remplace-t-il le LAN étendu ?",
        a: "Non, ils se complètent : le LAN étendu joint les équipements derrière votre routeur (les caméras qui ne portent pas WireGuard), le pair-à-pair relie les appareils qui portent la conf.",
      },
    ],
    related: ["acces-pro", "acces-invite", "acces-pro-multi-appareils", "console-tunnels"],
  },

  {
    id: "acces-invite",
    title: "L'Accès Invité : un tiers dans votre tunnel, pour quelques heures",
    summary:
      "Un ami sur votre serveur Minecraft, une démo web à un client : une conf expirable qui joint UN appareil Pro et rien d'autre — pas d'Internet, pas d'autres machines, un terme qui arrive seul.",
    roles: "Accès Pro",
    minutes: 5,
    updated: "2026-10-20",
    sectionId: "tunnels",
    vague: "V1",
    quoi:
      "L'Accès Invité est une faculté de l'Accès Pro : depuis votre espace (console.403shield.ftci.fr/pro), vous créez pour un tiers une configuration WireGuard dédiée, expirable, au périmètre volontairement minuscule. L'invité rejoint UNIQUEMENT l'appareil Pro que vous désignez comme hôte — le PC qui porte le serveur de jeu, la machine de la démo — et seulement sur les ports que vous déclarez (1 à 6, ouverts en TCP et UDP). Pas d'Internet, pas de DNS, pas d'accès à vos autres appareils, à vos routeurs ou à votre LAN.\n\nTechniquement, l'invité vit sur un segment dédié du tunnel (10.8.3.x), sa configuration ne route que l'adresse de l'hôte (/32), et le serveur n'ouvre que les « pin-holes » des ports déclarés — tout le reste du segment est fermé par défaut (fail-closed) : même une conf trafiquée ne sortirait pas de ce périmètre. La durée de vie se choisit à la création (1 à 72 heures) ; à l'échéance, l'accès cesse de fonctionner seul — ou avant, si vous le révoquez d'un clic.\n\nLa doctrine du produit tient toujours : une conf = un appareil. L'invité a SA configuration, avec ses clés — jamais la vôtre.\n\nNOTE DE CAPTURE : la section Invités de l'espace /pro s'illustrera lors d'une session terrain (doctrine : jamais de faux écran).",
    difference: [
      {
        with: "Partager votre propre conf Pro",
        body:
          "Jamais : deux appareils avec la même clé se volent leur session (roaming) — et votre conf porte TOUT votre périmètre (routeurs, LAN, autres appareils). L'invité reçoit la sienne : clés dédiées, un hôte, des ports, un terme.",
      },
      {
        with: "Le VPN personnel 403Shield",
        body:
          "Le VPN personnel sort sur Internet (tunnel complet, IP fixe France) ; l'invité n'a AUCUNE sortie Internet — il joint un appareil de votre compte et rien d'autre. Deux produits opposés par conception.",
      },
      {
        with: "Le pair-à-pair privé",
        body:
          "Le pair-à-pair relie VOS appareils (conf Pro complète du compte) ; l'invité est un tiers au périmètre réduit à un hôte et des ports. Le serveur de jeu entre amis combine les deux : l'hôte est un appareil Pro, les amis sont des invités.",
      },
    ],
    recoit: [
      "Le périmètre minimal en une phrase : AllowedIPs = l'adresse de l'hôte seule, pin-holes sur les ports déclarés (1-6, TCP+UDP) — tout le reste fermé par défaut.",
      "Le cycle de vie : durée choisie de 1 à 72 h, expiration automatique, révocation immédiate, plafond de 10 invités actifs par compte.",
      "Ce que l'invité installe : l'appli WireGuard ordinaire et la conf que vous lui remettez (QR ou fichier) — rien d'autre, aucun compte à créer.",
    ],
    etapes: [
      {
        title: "Ouvrez la section Invités de votre espace",
        body:
          "Connectez-vous à la console (code e-mail) et ouvrez l'espace Accès Pro : la section Invités y vit dès qu'un Accès Pro est actif — l'hôte d'un invité EST un appareil Pro de votre portefeuille (celui qui porte le service à partager).",
      },
      {
        title: "Créez l'invité : hôte, ports, durée",
        body:
          "Choisissez l'appareil hôte (celui qui écoute), les ports à ouvrir vers lui — 25565 pour un serveur Minecraft, 3000,80,443 pour une démo web — et la durée de vie (1 à 72 h). Un nom optionnel vous aide à vous y retrouver (« Ami du samedi », « Client Alpha »).",
        tip: "Les ports sont ouverts en TCP ET UDP vers l'hôte uniquement — déclarez le strict nécessaire, la révocation reste votre filet.",
      },
      {
        title: "Remettez la conf à l'invité",
        body:
          "Le bouton « Voir la conf » ouvre le QR (à envoyer par WhatsApp/e-mail) et le fichier .conf. L'invité scanne depuis l'appli WireGuard (« Créer à partir d'un QR code ») ou importe le fichier sur PC — et joint l'hôte à son adresse tunnel, pour les ports déclarés.",
      },
      {
        title: "Laissez mourir — ou révoquez",
        body:
          "Au terme, la conf cesse de fonctionner sans geste de personne (le retrait est automatique, dans les minutes qui suivent l'échéance). Besoin de couper avant ? « Révoquer » ferme l'accès immédiatement. Renouveler un invité = en recréer un — quelques secondes.",
      },
    ],
    usages: [
      {
        title: "Le serveur de jeu entre amis",
        body:
          "Minecraft (ou autre) sur le PC fixe de la maison, port 25565 ouvert aux invités du soir : vos amis entrent par le tunnel, le monde reste chez vous — aucun port publié sur Internet.",
      },
      {
        title: "La démo web à un client",
        body:
          "Le site en cours de développement écoute sur le portable (ports 3000/80/443) : le client-consulté rejoint la démo par le tunnel, le temps du rendez-vous — sans hébergement public ni compte à créer pour lui.",
      },
      {
        title: "Le collaborateur ponctuel",
        body:
          "Un technicien qui doit intervenir sur UN poste pour quelques heures : invité au périmètre minimal, durée courte, révocation à la fin de l'intervention.",
      },
    ],
    pieges: [
      {
        title: "Jamais votre propre conf",
        body:
          "Partager votre conf Pro expose TOUT votre périmètre (routeurs, LAN, appareils) et fait se voler leur session aux deux appareils. Un tiers = toujours un invité : clés dédiées, périmètre minimal, terme.",
        severity: "warn",
      },
      {
        title: "L'hôte doit être allumé et à l'écoute",
        body:
          "L'invité joint l'hôte — si le PC qui porte le serveur dort, rien ne répond. Prévoyez la machine allumée et le service lancé avant d'envoyer le QR.",
        severity: "info",
      },
      {
        title: "Le débit passe par Marseille",
        body:
          "Invité et hôte se parlent à travers la France : parfait pour une partie entre amis ou une démo, pas pour du jeu compétitif — sur place, le réseau local direct reste la bonne réponse.",
        severity: "info",
      },
      {
        title: "Un invité = un appareil aussi",
        body:
          "La conf invité suit la même doctrine que tout le produit : elle ne se partage pas entre deux appareils de l'invité (même clé = sessions volées). Deux appareils chez l'invité = deux invités.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Que voit exactement mon invité ?",
        a: "L'adresse de l'hôte, sur les ports déclarés, en TCP et UDP. Pas d'Internet, pas de DNS dans le tunnel, aucun autre appareil, aucun routeur, pas votre LAN — et les seules réponses qu'il reçoit viennent de l'hôte.",
      },
      {
        q: "Que se passe-t-il à l'échéance ?",
        a: "L'accès cesse de fonctionner : le peer est retiré du tunnel automatiquement (dans les minutes qui suivent le terme) et la conf de l'invité ne route plus. Côté console, l'invité apparaît « échu ». Pour renouveler, recréez un invité — quelques secondes.",
      },
      {
        q: "Puis-je donner à un invité accès à mes routeurs ou à mon LAN ?",
        a: "Non : l'hôte doit être un appareil Pro (le PC ou le NAS qui porte le service) — jamais un routeur, jamais un LAN étendu. La supervision des routeurs reste votre affaire de gérant, et un invité n'y a rien à faire.",
      },
      {
        q: "Combien d'invités, et à quel prix ?",
        a: "Jusqu'à 10 invités actifs en même temps par compte (les échus et révoqués ne comptent pas). L'Accès Invité est inclus dans l'Accès Pro actif de l'hôte — aucune facturation séparée en v1.",
      },
    ],
    related: ["acces-pro", "acces-pro-pair-a-pair", "acces-pro-multi-appareils", "console-tunnels"],
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
          "L'e-mail de livraison contient la configuration : import direct dans l'appli WireGuard (téléphone, ordinateur, tablette). Pour un routeur, c'est l'agent 403Shield qui porte la configuration (guide Accès Pro). Et la conf Pro vit sur tout appareil WireGuard — PC, NAS, routeur tiers (guide Installer l'Accès Pro sur PC, NAS et routeurs tiers).",
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
    related: ["acces-pro", "acces-invite", "acces-pro-multi-appareils", "ip-vpn-localisable"],
  },

  {
    id: "ip-vpn-localisable",
    title: "L'IP du VPN est localisable : fuite ou normal ?",
    summary:
      "Pourquoi les sites de géolocalisation affichent l'IP du serveur (et jamais la vôtre), la vérification zéro-fuite en cinq minutes, le kill switch mobile — et la règle d'or : une configuration = un appareil.",
    roles: "Client VPN · Gérant (conseil)",
    minutes: 5,
    updated: "2026-10-19",
    sectionId: "tunnels",
    vague: "V1",
    quoi:
      "Tunnel monté, un site de géolocalisation (ipleak.net, browserleaks.com) affiche une IP française qui sort de Marseille pendant que vous êtes à Abidjan : c'est le comportement ATTENDU, pas une fuite. En tunnel complet, tout votre trafic sort par le serveur 403Shield — les sites voient l'IP de ce serveur, qui est précisément l'adresse de retour de vos paquets. Votre IP réelle, votre pays et votre FAI restent invisibles.\n\nLes adresses en 10.8.x.x qui figurent dans votre configuration WireGuard sont privées : elles servent au routage DANS le tunnel et n'apparaissent jamais sur Internet. Et l'IP de sortie est partagée par les clients du même serveur : un observateur ne peut pas attribuer une activité à un appareil précis.\n\nUne IP de sortie « invisible » n'existe pas — un site doit savoir à qui répondre. Ce guide fait le tri : ce qui est normal, ce qui serait une vraie fuite, comment le vérifier en cinq minutes — et la règle du portefeuille : une configuration = un appareil.\n\nNOTE DE CAPTURE : aucune capture dans ce guide — la vérification vit sur des sites tiers (ipleak.net), une capture de substitution n'apprendrait rien.",
    difference: [
      {
        with: "Une vraie fuite (DNS, IPv6 ou WebRTC)",
        body:
          "Normal : les sites voient l'IP du serveur 403Shield, la même pour tous vos usages. Fuite : votre IP Orange/Starlink apparaît quelque part, ou vos requêtes DNS sortent du tunnel. La configuration livrée couvre IPv4 ET IPv6 (AllowedIPs 0.0.0.0/0 et ::/0) et pousse les DNS dans le tunnel : les fuites classiques sont fermées par conception — la vérification ci-dessous le prouve en cinq minutes.",
      },
      {
        with: "Tor (l'anonymat réseau)",
        body:
          "Tor enchaîne trois relais et fait quand même SORTIR le trafic par une IP visible : son anonymat vient de l'impossibilité de relier la sortie à une personne, pas de l'invisibilité. Même logique ici — l'IP de sortie est visible, vous ne l'êtes pas : la sortie partagée complique encore le lien.",
      },
      {
        with: "Les VPN qui changent d'IP à chaque connexion",
        body:
          "L'IP 403Shield est FIXE : la même hier, aujourd'hui, demain. C'est un choix — sessions cohérentes, aucune alerte « nouvelle localisation » à chaque connexion — et la contrepartie est assumée : une seule IP pour tous vos usages.",
      },
    ],
    recoit: [
      "La lecture claire de ce que les sites voient (l'IP du serveur) et de ce qu'ils ne verront jamais : votre IP réelle, votre pays, votre FAI.",
      "La vérification zéro-fuite en cinq minutes : IPv4, IPv6, WebRTC et DNS contrôlés depuis un seul site de test.",
      "Le réglage kill switch de l'appli WireGuard mobile — le seul vrai point de vigilance côté client.",
      "La règle d'or du portefeuille : une configuration = un appareil, et pourquoi le partage d'une même conf se punit tout seul.",
    ],
    etapes: [
      {
        title: "Comprenez ce que les sites voient",
        body:
          "Tunnel monté, ipleak.net affiche l'IP du serveur 403Shield — France, Marseille — avec un type « hosting » ou « datacenter » : normal, c'est un serveur. C'est l'IP de sortie, l'adresse de retour de vos paquets ; votre IP FAI n'apparaît nulle part.\n\nL'adresse en 10.8.x.x de votre configuration est privée : elle vit dans le tunnel et ne sort jamais sur Internet — personne ne peut la « localiser ».",
        tip: "« Hosting » comme type d'IP sur un site de test n'est pas une fuite : c'est la nature d'une IP de serveur. Aucun VPN n'affiche « résidentiel ».",
      },
      {
        title: "Contrôlez l'absence de fuite (cinq minutes)",
        body:
          "Tunnel monté, ouvrez ipleak.net : l'IPv4 affichée est celle du serveur — comparez avec le même site SANS tunnel, il montrait alors votre IP FAI. L'IPv6 est absente ou celle du serveur ; le test DNS ne montre que des résolveurs joints VIA le serveur ; sur browserleaks.com/webrtc, l'IP WebRTC est celle du serveur, sans autre adresse à côté.\n\nLe seul signal d'alerte : une IP différente de celle du serveur apparaît — en pratique, celle que le test montrait sans tunnel. Le tunnel est alors tombé ou la configuration mal importée : rebranchez, retestez.",
      },
      {
        title: "Activez le kill switch mobile",
        body:
          "WireGuard n'a pas de kill switch intégré : si le tunnel tombe (changement de réseau, veille de l'appareil), le trafic repart en clair jusqu'à la reconnexion. Sur Android, l'appli WireGuard propose « Bloquer les connexions sans VPN » (menu ⋮) ; sur iOS, le réglage « On-Demand » de la configuration bloque le hors-tunnel. Dans les deux cas, l'IP réelle ne fuit plus — même pendant une coupure.",
        tip: "C'est LE réglage à faire dès l'installation : la seule « fuite » possible chez un client 403Shield bien configuré, c'est le trafic hors tunnel.",
      },
      {
        title: "Si le pays affiché semble faux",
        body:
          "Les bases de géolocalisation (MaxMind, IPinfo et consœurs) étiquettent parfois les plages de datacenter au pays d'enregistrement plutôt qu'à la région réelle — un site peut afficher un pays approximatif pour l'IP du serveur. Le support 403Shield peut déposer les demandes de correction (gratuites, effet en une à quatre semaines selon la base).\n\nLe fait qui fait foi : la sortie vit en France (Marseille). Si un site affiche autre chose, c'est la base de données qui a tort, pas le tunnel.",
      },
      {
        title: "Respectez la règle : une configuration = un appareil",
        body:
          "Chaque configuration WireGuard porte SA clé : elle désigne UN appareil du portefeuille. La copier sur un deuxième appareil est techniquement possible mais pratiquement inutilisable — deux appareils avec la même clé se volent mutuellement leur session (chaque handshake déloge l'autre) : la connexion alterne et tombe.\n\nUn nouvel appareil = une nouvelle configuration (achat sur le site pour le VPN personnel, création par le gérant pour le module revendu) — l'espace client suit le portefeuille appareil par appareil (guide Console tunnels).",
      },
    ],
    usages: [
      {
        title: "L'objection du prospect",
        body:
          "« Votre VPN est localisable » au comptoir : la réponse tient en deux phrases — l'IP visible est celle du serveur, l'IP du client est invisible — et ce guide approfondit pour qui veut vérifier. Guide Vitrine VPN B2C pour la vente elle-même.",
      },
      {
        title: "Le contrôle de routine",
        body:
          "Un passage de cinq minutes sur ipleak.net, tunnel monté : IPv4, IPv6, WebRTC et DNS au vert — l'hygiène mensuelle du client VPN qui veut dormir tranquille.",
      },
      {
        title: "Le changement d'appareil",
        body:
          "Nouveau téléphone : nouvelle configuration depuis l'espace client, l'ancienne restée sur l'appareil ancien coupée au besoin — jamais de copie de fichier entre les deux.",
      },
    ],
    pieges: [
      {
        title: "Le kill switch laissé désactivé",
        body:
          "Tunnel coupé = trafic en clair sous l'IP réelle jusqu'à la reconnexion : c'est la seule fuite possible côté client. « Bloquer les connexions sans VPN » (Android) ou « On-Demand » (iOS) se règlent dès l'installation.",
        severity: "warn",
      },
      {
        title: "Le partage d'une configuration",
        body:
          "Une même configuration sur deux appareils = deux sessions qui se volent mutuellement : connexion instable, zéro gain. Une configuration = un appareil — le portefeuille de l'espace client est fait pour ça.",
        severity: "warn",
      },
      {
        title: "« IP invisible » n'existe pas",
        body:
          "Quiconque promet une IP de sortie invisible ment : un site doit connaître l'adresse à qui répondre. La garantie réelle : votre IP, votre pays et votre FAI invisibles — avec une sortie partagée qui complique tout lien.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "ipleak.net montre Marseille alors que je suis à Abidjan : normal ?",
        a: "Oui — c'est l'IP du serveur de sortie, celle que les sites doivent voir pour vous répondre. Votre IP réelle n'apparaît nulle part tant que le tunnel est monté.",
      },
      {
        q: "Mon IP de sortie change-t-elle ?",
        a: "Non — elle est fixe : la même hier, aujourd'hui, demain. C'est voulu (sessions cohérentes, pas d'alerte « nouvelle localisation ») et c'est ce que les tests affichent.",
      },
      {
        q: "Peut-on rendre l'IP de sortie invisible ?",
        a: "Non — impossible pour tout le monde, Tor compris : l'anonymat vient de l'impossibilité de relier l'IP de sortie à vous, pas de l'invisibilité. Ici, la sortie est de plus partagée entre les clients du serveur.",
      },
      {
        q: "Puis-je mettre la même configuration sur mon téléphone et mon ordinateur ?",
        a: "Non — une configuration = un appareil (clé dédiée). Deux appareils avec la même clé se volent leur session et la connexion devient instable. Prenez une configuration par appareil : chacune vit dans le portefeuille de l'espace client.",
      },
    ],
    related: ["vitrine-vpn", "console-tunnels", "acces-pro"],
  },
];
