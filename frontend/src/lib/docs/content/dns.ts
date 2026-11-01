// Section « Bouclier DNS · TOURACO » — le filtrage résolveur (N°348).
//
// 1 guide : la grande question publique « qu'est-ce que le DNS filtré ? » —
// la vitrine /dns (N°347) VEND l'abonnement, le centre de guides EXPLIQUE
// le produit : l'annuaire des noms, les trois portes d'entrée (DoH
// navigateurs N°339, DoT Android :853 N°345, UDP/53 box N°346), les menaces
// vivantes URLhaus/OpenPhish (N°343), le gratuit pour toujours (10 profils /
// 200 règles / 5 logements / journal 30 j — dnsprofile.go) et TOURACO
// (25/600/15/90 — publicdnsorder.go DnsQuotasTouraco, le droit vit sur
// l'e-mail, N°347). Contenu calé sur les capacités réelles : bornes backend
// dnsprofile.go / publicdnsorder.go, copy vitrine N°347 (pricing.segments
// dns : 0 / 1 000 / 10 000 FCFA), hôte DoT <publicId>.dns.403shield.ftci.fr
// (dot_server.go), sonde de ligne N°346. Aucune capture tant que la session
// terrain n'a pas eu lieu (doctrine : jamais de faux écran) — le guide est
// conceptuel : la console DNS s'illustrera plus tard.
import type { Guide } from "../types";

export const DNS_GUIDES: Guide[] = [
  {
    id: "dns-filtre",
    title: "Qu'est-ce que le DNS filtré ? Le Bouclier DNS expliqué à la maison",
    summary:
      "Chaque connexion commence par une question de nom : « quelle adresse se cache derrière ce site ? » Le DNS filtré fait répondre un résolveur qui refuse les noms dangereux ou non voulus — navigateurs, téléphones, box, TV et consoles : toute la maison, sans rien installer sur les objets.",
    roles: "Foyer · Client final",
    minutes: 6,
    updated: "2026-11-01",
    sectionId: "dns",
    vague: "V3",
    quoi:
      "Chaque connexion à Internet commence par une question de nom. Quand votre télévision joint une plateforme, votre navigateur ouvre un site, votre téléphone vérifie ses notifications, l'appareil demande d'abord à un résolveur DNS : « quelle adresse IP se cache derrière ce nom ? » Le DNS est l'annuaire d'Internet — plus ancien que le Web lui-même.\n\nLe DNS filtré change UNE chose : qui répond. Au lieu du résolveur de votre FAI — qui traduit tout, journalie ce qu'il veut, et réécrit parfois les réponses à son profit — vos appareils interrogent le résolveur du Bouclier DNS 403Shield. Lui ne traduit pas aveuglément : les noms portés par les listes de menaces vivantes (URLhaus, OpenPhish — phishing et diffusion de malware, agrégées et actualisées par balayage) reçoivent la réponse « ce nom n'existe pas », et vos propres listes bloquer / autoriser décident du reste, profil par profil.\n\nLe filtrage vit dans le RÉSOLVEUR, pas sur vos appareils : c'est ce qui distingue le bouclier DNS de tout logiciel à installer. La box qui pointe vers le résolveur protège la télévision, la console, les objets connectés — les machines sur lesquelles on n'installe JAMAIS rien.\n\nNOTE DE CAPTURE : la console DNS (l'espace /dns de la console client) s'illustrera lors d'une session terrain (doctrine : jamais de faux écran).",
    difference: [
      {
        with: "Le VPN personnel 403Shield",
        body:
          "Deux outils complémentaires, pas concurrents. Le VPN transporte TOUT votre trafic dans un tunnel chiffré et vous donne une IP fixe France ; le DNS filtré ne touche qu'aux questions de noms — il ne chiffre rien d'autre et ne change pas votre adresse. Le VPN protège VOTRE ordinateur ; le bouclier protège la MAISON entière, objets inclus. Beaucoup de foyers prennent les deux.",
      },
      {
        with: "SafeWiFi du hotspot (le DNS filtrant de l'exploitant)",
        body:
          "Même famille, périmètre différent. SafeWiFi protège le réseau d'UN établissement : l'exploitant le pose sur SON routeur, il couvre les clients du hotspot. Le Bouclier DNS, vous le branchez dans VOTRE foyer — box, téléphones, navigateurs — sans aucun routeur MikroTik. Les deux se pilotent depuis la même maison 403Shield.",
      },
      {
        with: "Une extension bloqueuse dans le navigateur",
        body:
          "L'extension ne filtre que le navigateur qui la porte : changez de navigateur, ouvrez une appli, allumez la TV — plus rien. Le DNS filtré agit en amont, pour chaque logiciel de chaque appareil qui pose ses questions au résolveur de la maison.",
      },
      {
        with: "Le contrôle parental du système (Android, iOS, Windows)",
        body:
          "Le contrôle parental vit sur UN appareil et UN compte — il se contourne en changeant de compte ou d'appareil. Le bouclier vit sur la box et les résolveurs : même niveau pour toute la maison, et le journal montre ce qui reste tenté.",
      },
    ],
    recoit: [
      "Un résolveur dédié PAR PROFIL : chaque profil possède ses propres coordonnées — l'URL DoH du profil pour les navigateurs, l'hôte DoT (<profil>.dns.403shield.ftci.fr) pour Android, la liaison logement pour la box. Le foyer peu filtré, la tablette des enfants davantage : à vous de doser.",
      "Des listes bloquer / autoriser lisibles : 200 règles par liste en gratuit, 600 avec l'abonnement TOURACO — une exception « ce site-là passe » se pose en une règle, sans casser le reste du filtrage.",
      "Les menaces vivantes incluses : les listes URLhaus et OpenPhish (phishing, diffusion de malware) sont agrégées et actualisées automatiquement — vous n'avez rien à entretenir pour la partie dangers.",
      "Le journal des requêtes bloquées : 30 jours en gratuit, 90 avec TOURACO — vous voyez ce qui a été TENTÉ et bloqué (pas toute la navigation), et la purge tient la promesse de rétention.",
      "Un droit qui vit sur votre e-mail : le bouclier est UTILISABLE GRATUITEMENT POUR TOUJOURS (10 profils, 5 logements) ; TOURACO (25 profils, 600 règles, 15 logements, journal 90 jours — 1 000 FCFA par mois ou 10 000 FCFA par an) s'achète SANS COMPTE depuis la vitrine /dns. À l'expiration, RIEN n'est coupé : les quotas retombent, les profils restent servis.",
    ],
    etapes: [
      {
        title: "Ouvrez la console DNS",
        body:
          "Rendez-vous sur console.403shield.ftci.fr/dns et connectez-vous avec votre e-mail : un code à 6 chiffres arrive par message, aucun mot de passe à retenir. C'est ici que vivent les profils, les listes, le journal — et les coordonnées d'installation de chaque profil.",
        tip: "Le compte est le même que celui du VPN personnel et de l'Accès Pro : une adresse e-mail, tous vos produits 403Shield.",
      },
      {
        title: "Créez votre premier profil et notez ses coordonnées",
        body:
          "Un profil porte un nom (« Maison », « Tablettes enfants ») et deux listes : bloquer et autoriser. La console affiche alors ses coordonnées propres — l'URL DoH à coller dans un navigateur, l'hôte DoT pour Android — ainsi que l'état réel des serveurs du bouclier.",
      },
      {
        title: "Protégez les navigateurs (DoH)",
        body:
          "Dans Chrome, Edge ou Firefox (réglage « DNS sécurisé » / « DNS over HTTPS »), collez l'URL DoH du profil : ce navigateur posera désormais ses questions au bouclier. iPhone et Mac absorbent le même réglage via le profil Apple que la console génère — en DoH ou DoT, au choix.",
        tip: "Le DoH voyage chiffré : ni le FAI, ni le Wi-Fi public, ni un intermédiaire curieux ne peuvent réécrire les réponses en chemin.",
      },
      {
        title: "Protégez les téléphones Android (DoT)",
        body:
          "Dans Réglages → Réseau et Internet → DNS privé, saisissez l'hôte DoT du profil (<profil>.dns.403shield.ftci.fr). Android « DNS privé » n'accepte QU'UN nom d'hôte — jamais une URL, jamais un port : c'est précisément pour cela que le bouclier écoute sur le port 853, avec un certificat couvrant l'hôte du profil.",
      },
      {
        title: "Protégez toute la maison (la box)",
        body:
          "L'onglet Box de la console propose le guide en quatre étapes, commandes prêtes à copier pour votre box (FAI, Starlink, routeur personnel), puis la sonde de ligne : une vraie requête partie de chez vous confirme que le logement est bien lié au bon profil — et détecte si votre FAI détourne le port 53.",
        tip: "La liaison logement → profil s'appuie sur l'IP publique de votre ligne : lancez la sonde DEPUIS la maison, pas en 4G — sinon vous lieriez le téléphone, pas le logement.",
      },
    ],
    usages: [
      {
        title: "La famille aux objets connectés",
        body:
          "TV, console, tablette, enceinte voix : tout ce qui ne s'installe jamais se protège par la box. Les profils dosent la dureté — les enfants d'un côté, les parents de l'autre — et le journal 30 ou 90 jours montre ce qui reste tenté.",
      },
      {
        title: "Le foyer qui veut respirer",
        body:
          "Publicités et traqueurs commencent eux aussi par des noms : les grands domaines de mesure tombent dans les listes, les pages s'allègent, le quota mobile dure plus longtemps — sans configuration par appareil.",
      },
      {
        title: "Le petit bureau sans informaticien",
        body:
          "Phishing et malware frappent d'abord par le nom : postes, imprimante réseau, caméra IP sur la box du bureau reçoivent la même réponse « ce nom n'existe pas » — sans rien installer sur des machines qu'on ne maîtrise pas.",
      },
    ],
    pieges: [
      {
        title: "Le DNS filtré n'est PAS un VPN",
        body:
          "Il ne chiffre pas votre trafic, ne masque pas votre adresse IP, ne débloque aucun catalogue étranger : il filtre la traduction des noms. Pour la confidentialité sur un réseau public, prenez le VPN ; pour la maison, le bouclier.",
        severity: "warn",
      },
      {
        title: "Un appareil têtu peut sortir du périmètre",
        body:
          "Le bouclier couvre ce qui LUI demande : navigateurs réglés, téléphones en DoT, appareils servis par la box. Un ordinateur qui force son propre résolveur chiffré tiers (DoH ailleurs) échappe au filtrage — la parade la plus saine reste de verrouiller le port 53 sortant sur la box quand elle le permet, et de lire le journal pour voir ce qui persiste.",
        severity: "warn",
      },
      {
        title: "Le filtrage juge des NOMS, pas des pages",
        body:
          "Tout ce qui vit sous un même domaine bloque ou passe ENSEMBLE : deux contenus d'un même site suivent le même destin. C'est la limite structurelle du DNS — en échange, il filtre tout, partout, sans rien installer.",
        severity: "info",
      },
      {
        title: "L'expiration TOURACO ne coupe rien",
        body:
          "Le droit cesse, les quotas retombent au gratuit (10 profils, 200 règles, 5 logements, journal 30 jours), les profils et liaisons restent servis. Seule la création au-delà des bornes gratuites redevient refusée — doctrine additive, jamais de coupure des clients.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Est-ce que ça ralentit ma connexion ?",
        a:
          "Non : le résolveur met les réponses en cache et le filtrage se joue en millisecondes, invisibles à la navigation. Un nom bloqué reçoit « ce nom n'existe pas » plus vite qu'une vraie résolution.",
      },
      {
        q: "Que se passe-t-il si j'arrête de payer TOURACO ?",
        a:
          "Rien n'est coupé : les quotas retombent au gratuit, vos profils continuent d'être servis. Vous ne remarquerez la limite qu'en créant du nouveau contenu au-delà des bornes gratuites (11e profil, 201e règle).",
      },
      {
        q: "Mon FAI peut-il détourner mes requêtes DNS ?",
        a:
          "Sur le port 53 classique, certains FAI réécrivent les réponses — la sonde de ligne de la console le détecte et vous le dit. Sur DoH et DoT, les échanges sont chiffrés : aucune réécriture en chemin n'est possible.",
      },
      {
        q: "Un invité chez moi est-il protégé ?",
        a:
          "Tant que son appareil accepte le DNS de votre box (le comportement par défaut), oui : il profite du filtrage du logement sans rien faire. S'il apporte son propre VPN, c'est son trafic à lui — le vôtre reste filtré.",
      },
      {
        q: "En quoi est-ce mieux qu'un DNS public filtrant ?",
        a:
          "Les DNS publics filtrants appliquent UN filtrage univoque à des millions d'inconnus. Ici : des profils par foyer, vos propres listes d'exceptions, le journal de ce qui a été bloqué, une console en français — et le paiement Wave ou carte, en FCFA.",
      },
      {
        q: "Où est-ce que j'achète TOURACO ?",
        a:
          "Sur la vitrine 403shield.ftci.fr/dns — sans créer de compte : votre e-mail d'activation suffit, le droit est actif dès la confirmation d'encaissement. Le renouvellement se fait ensuite en un clic depuis la console DNS.",
      },
    ],
    related: ["protection", "vitrine-vpn", "console-tunnels"],
  },
];
