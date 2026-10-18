// Section « Infrastructure » — 4 guides (N°304).
import type { Guide } from "../types";
import { cap } from "../cap";

export const INFRASTRUCTURE_GUIDES: Guide[] = [
  {
    id: "parc-routeurs",
    title: "Parc routeurs & fiche routeur",
    summary:
      "La vue centrale du matériel : cartes de parc, fiche complète (trafic temps réel, QoS, IP Bindings, outils, système) et actions par routeur (script, import, réparation).",
    roles: "Propriétaire · Gérant",
    minutes: 5,
    updated: "2026-10-12",
    sectionId: "infrastructure",
    vague: "V1",
    quoi:
      "Infrastructure → Routeurs liste vos routeurs MikroTik (cartes avec statut en ligne, modèle, dernier check-in) et ouvre sur chaque routeur une FICHE complète : débits temps réel par interface, tableau des interfaces, et cinq onglets (Trafic, QoS, IP Bindings, Outils, Système).\n\nLa fiche concentre aussi les actions de maintenance : « Tester la connexion » (check-in forcé), « Personnaliser le portail », « Activer le tunnel » (renfort WireGuard), et le menu ⋯ : Script d'installation, Importer les données, Réparer le walled-garden, Voir sessions/vouchers, Modifier, Supprimer.",
    difference: [
      {
        with: "Le tableau de bord",
        body:
          "Le tableau de bord survole TOUT le compte ; la fiche routeur plonge dans UN routeur. L'un répond « quoi », l'autre répond « pourquoi ».",
      },
      {
        with: "Les outils (onglet de la fiche)",
        body:
          "L'onglet Outils regroupe les actions ponctuelles (scheduler, pool doctor…) ; la fiche est le conteneur. Le guide Outils du routeur détaille l'onglet.",
      },
      {
        with: "La flotte (plateforme)",
        body:
          "La flotte (volet plateforme) pilote les routeurs de TOUS les comptes (MAJ RouterOS globales) ; votre parc ne couvre que VOTRE compte.",
      },
    ],
    recoit: [
      "Le parc : carte par routeur — statut (En ligne / vu il y a X s), mode (Agent), identité, actions rapides.",
      "La fiche : graphique de débits temps réel (toutes interfaces ou interface choisie), tableau Rx/Tx et totaux par interface, uptimes.",
      "Les onglets de gestion : QoS (files/limites), IP Bindings (bypass), Outils (scheduler, pool, maintenance), Système (identité, RouterOS).",
      "Les actions : test de connexion, personnalisation portail, tunnel WG, script/import/réparation, modification, suppression.",
    ],
    etapes: [
      {
        title: "Ouvrez Infrastructure → Routeurs",
        body:
          "Les cartes se lisent en 2 secondes : nom, mode Agent, statut coloré et fraîcheur du check-in. Un routeur « vu il y a 3 s » est sain ; « vu il y a 10 min » mérite un clic.",
        capture: cap(
          "infrastructure/routers.png",
          1440,
          900,
          "Vue Routeurs : cartes du parc avec statut en ligne et mode agent",
          "Le parc — chaque carte est un routeur raccordé.",
        ),
      },
      {
        title: "Ouvrez la fiche",
        body:
          "Cliquez la carte : la fiche démarre sur l'onglet Trafic — graphique temps réel (le curseur d'interface permet d'isoler une carte réseau) et tableau des interfaces avec débits instantanés et cumulés (ex. WAN à 101,7 Mbps en réception).",
        capture: cap(
          "infrastructure/router-fiche.png",
          1440,
          1445,
          "Fiche routeur : graphique de débits temps réel, tableau des interfaces, onglets Trafic QoS IP Bindings Outils Système",
          "La fiche routeur — le poste de pilotage.",
        ),
      },
      {
        title: "Testez la connexion",
        body:
          "« Tester la connexion » force un check-in immédiat (diagnostic instantané). Si le test échoue : routeur éteint, coupure Internet, ou script absent — l'agent réessaie de toute façon (retour auto en ligne).",
      },
      {
        title: "Personnalisez le portail (raccourci)",
        body:
          "Le bouton « Personnaliser le portail » de la fiche ouvre directement l'éditeur de marque pour CE routeur (chaîne compte → site → routeur, guide Portail captif & marque).",
      },
      {
        title: "Activez le tunnel (renfort) — automatique",
        body:
          "La carte « Tunnel WireGuard » de la fiche ne demande AUCUNE compétence réseau : cliquez « Activer le tunnel » et attendez. Le routeur génère sa clé (≤ 45 s), le serveur embarque le peer et livre les paramètres chiffrés (≤ 45 s) — puis « Tester le tunnel » confirme le chemin direct. Aucune adresse, clé ou endpoint à saisir : l'installation fait tout.",
        tip: "Le tunnel WG (renfort) est optionnel : il double le canal agent pour la robustesse (CGNAT capricieux, ligne fragile). Sans tunnel, l'agent suffit. Sur les installations sans wg-mini, la carte bascule en mode expert (4 valeurs du livret serveur) — réservé aux initiés.",
      },
      {
        title: "Le menu ⋯ (maintenance)",
        body:
          "Script d'installation (régénère le .rsc — token neuf, voir guide Agent), Importer les données (migration profils/utilisateurs d'un routeur existant), Réparer le walled-garden (cohérence du portail), Voir sessions/vouchers (raccourcis filtrés sur ce routeur), Modifier (nom, URL hotspot), Supprimer (confirmé, retire le routeur du compte).",
      },
    ],
    usages: [
      {
        title: "Diagnostic réseau quotidien",
        body:
          "Le graphique Trafic révèle les patterns : saturation du WAN à 20 h, interface morte à zéro depuis hier — la fiche est votre oscilloscope.",
      },
      {
        title: "Exploitation multi-sites",
        body:
          "Un routeur par site : les cartes du parc donnent la santé de tout l'empire d'un regard, les rapports ventilent par site.",
      },
    ],
    pieges: [
      {
        title: "Supprimer un routeur ne coupe pas l'agent",
        body:
          "La suppression retire le routeur du compte — mais le script tourne encore dessus : régénérez/réinstallez si vous re-raccordez ce matériel, et changez ses accès admin avant tout autre usage.",
        severity: "warn",
      },
      {
        title: "Les totaux Rx/Tx sont des cumuls routeur",
        body:
          "Ils comptent depuis le boot du routeur (compteurs RouterOS) — pas depuis votre abonnement. Pour l'usage client, voyez les sessions et volumes par compte.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Combien de routeurs par compte ?",
        a: "Selon la formule — la console vous dit à la création quand le plafond est atteint (limite plan_router).",
      },
      {
        q: "Puis-je renommer un routeur sans casser l'agent ?",
        a: "Oui, le nom est cosmétique (l'identifiant agent est stable) — Modifier → nom, l'affichage suit partout.",
      },
    ],
    related: ["connecter-routeur-agent", "outils-routeur", "protection"],
  },

  {
    id: "outils-routeur",
    title: "Outils du routeur (QoS, pool, scheduler, maintenance)",
    summary:
      "L'onglet atelier de la fiche : QoS (files et limites), adresse pool (DHCP), scheduler (tâches), pool doctor et mises à jour RouterOS — les réglages fins sans Winbox.",
    roles: "Propriétaire · Gérant",
    minutes: 5,
    updated: "2026-10-18",
    sectionId: "infrastructure",
    vague: "V2",
    quoi:
      "Les onglets de la fiche routeur exposent les réglages qui demandaient Winbox : QoS (files de priorité, limites parent/child par profil), IP Bindings (bypass portail pour les équipements de confiance), Outils (scheduler de tâches récurrentes, pool doctor, watchdog) et Système (identité, version RouterOS, mise à jour).\n\nChaque réglage part dans la file agent et s'applique au check-in — la console reste la seule interface nécessaire au quotidien.",
    difference: [
      {
        with: "La limite de vitesse des profils",
        body:
          "La limite de PROFIL bride chaque session CLIENT ; la QoS routeur arbitre les FLUX entre eux (priorités, réservations). Les deux se combinent : profil par client, QoS pour l'ensemble.",
      },
      {
        with: "Les protections",
        body:
          "Les protections (SafeWiFi, Shield…) sont des RÈGLES de sécurité posées automatiquement ; les outils sont des réglages D'EXPLOITATION que vous maîtrisez.",
      },
      {
        with: "La mise à jour par la flotte",
        body:
          "La MAJ RouterOS se fait depuis la fiche (un routeur) ou par la flotte plateforme (tout le parc, en vagues coordonnées).",
      },
    ],
    recoit: [
      "L'onglet QoS : files de priorité (parent/child), limites par profil, et l'arbitre de bande passante — chaque changement appliqué au check-in.",
      "L'onglet IP Bindings : listes d'adresses en bypass (caméras, caisses, équipements de confiance) — accès sans portail.",
      "L'onglet Outils : scheduler (tâches horaires : reset de session, scripts de maintenance), pool doctor (santé du pool d'adresses DHCP), contrôles ponctuels.",
      "L'onglet Système : identité, version RouterOS, ressources, et la montée de version pilotée.",
    ],
    etapes: [
      {
        title: "Ouvrez la fiche → onglet QoS",
        body:
          "La QoS s'organise en files parent (votre capacité) et enfants (profils/usages). Cas standard : parent = 80 % de votre ligne, enfants priorisés (vente > navigation > téléchargements lourds).\n\nLes limites de vitesse des PROFILS (guide Profils) restent le premier outil de protection : la QoS n'intervient que pour l'arbitrage global.",
        capture: cap(
          "infrastructure/router-fiche.png",
          1440,
          1445,
          "Fiche routeur avec la barre d'onglets Trafic, QoS, IP Bindings, Outils et Système",
          "Les onglets de la fiche — l'atelier du routeur.",
        ),
        tip: "Ne réservez JAMAIS 100 % de la ligne aux clients : gardez 10-20 % pour la gestion (agent, portail, vos équipements).",
      },
      {
        title: "IP Bindings : les équipements de confiance",
        body:
          "Déclarez en bypass les équipements qui ne doivent PAS passer par le portail : caméras IP, caisse, NAS, borne de paiement. Ils naviguent dès la mise sous tension, sans code — l'IP/MAC fixée fait foi.",
      },
      {
        title: "Scheduler : les tâches récurrentes",
        body:
          "Créez des tâches horaires (ex. redémarrage du serveur hotspot à 4 h, purge de sessions) — le scheduler routeur persiste aux reboot, la console vous montre son état (la file agent apporte les corrections).",
      },
      {
        title: "Pool doctor & maintenance",
        body:
          "Le pool doctor vérifie la santé du pool DHCP (adresses épuisées, baux orphelins) et répare les anomalies — passez-le quand des clients « ne trouvent pas d'IP ». C'est souvent le premier réflexe avant tout appel réseau.",
      },
      {
        title: "Système : version RouterOS",
        body:
          "L'onglet Système montre la version en cours et propose la montée (contrôlée — contrainte d'agent : TLS ≥ 7.19, voir le guide Connecter). Testez sur un routeur secondaire avant le routeur principal.",
      },
    ],
    usages: [
      {
        title: "Le cybercafé équilibré",
        body:
          "QoS parent à 80 %, enfant « postes » prioritaire sur « WiFi libre » : la salle payante garde la main, la terrasse s'en contente.",
      },
      {
        title: "Le commerce instrumenté",
        body:
          "IP Bindings pour caisse et caméras : la vente passe même si le portail a un souci — le périmètre critique ne dépend jamais du WiFi vendu.",
      },
      {
        title: "Le réseau de quartier",
        body:
          "Scheduler de nettoyage nocturne (reset sessions) : chaque matin démarre propre, sans accumulateurs fatigués.",
      },
    ],
    pieges: [
      {
        title: "La QoS se SURIMPOSE aux limites de profil",
        body:
          "Un client « limité à 2 M » par profil peut quand même subir l'arbitrage QoS en pointe : les deux niveaux s'appliquent en cascade (le plus strict gagne).",
        severity: "info",
      },
      {
        title: "MAJ RouterOS en heure d'ouverture",
        body:
          "La mise à jour coupe le routeur quelques minutes : planifiez tôt le matin. La reprise est automatique (scheduler agent persistant) mais le hotspot est muet pendant l'opération.",
        severity: "warn",
      },
      {
        title: "Binding IP sur DHCP dynamique",
        body:
          "Préférez l'adresse MAC au bail DHCP dynamique (bail expiré = binding cassé). La fiche propose les deux formes — MAC est plus robuste.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Mes réglages QoS survivent-ils à une réinstallation de l'agent ?",
        a: "Oui — ils vivent sur le routeur ; l'agent ne fait que les appliquer/lire. Une réinstallation d'agent ne formate pas le routeur.",
      },
      {
        q: "Puis-je tout faire sans jamais ouvrir Winbox ?",
        a: "Au quotidien, oui : raccordement, ventes, profils, QoS, bindings, scheduler, MAJ — tout passe par la console. Winbox ne reste utile que pour le diagnostic local physique (câbles, PoE).",
      },
    ],
    related: ["parc-routeurs", "profils-forfaits", "protection"],
  },

  {
    id: "sites-multi-sites",
    title: "Sites (multi-établissements)",
    summary:
      "Un site par établissement : ventilation comptable par antenne, portails distincts, routage des vouchers — la brique multi-boutiques.",
    roles: "Propriétaire",
    minutes: 3,
    updated: "2026-10-18",
    sectionId: "infrastructure",
    vague: "V3",
    quoi:
      "Les SITES découpent votre compte en établissements : chaque site porte son (ses) routeur(s), son portail personnalisable, ses profils et sa ventilation comptable. Un compte ProMax WIFI peut exploiter plusieurs boutiques sans mélanger les caisses.\n\nLa mécanique rejoint le WiFi Jetable (chaque site jetable est un site) et le routage routeurs : un routeur rattache à un site (choisi à la création), les vouchers d'un lot visent un routeur — donc un site.",
    difference: [
      {
        with: "Plusieurs comptes",
        body:
          "Trois boutiques = un compte à trois sites (une seule administration, une facture) OU trois comptes (trois administrateurs, trois abonnements). Le site pour un exploitant unique, le compte pour des exploitants distincts.",
      },
      {
        with: "Le WiFi Jetable",
        body:
          "Le jetable UTILISE des sites (un site par terrasse offerte) ; ce guide documente l'usage général multi-établissements.",
      },
    ],
    recoit: [
      "Chaque site : son nom (affiché au portail), ses routeurs, sa personnalisation, ses rapports ventilés.",
      "La comptabilité suit le site : rapports (marge, activité) filtrent par site — la santé de chaque boutique se lit séparément.",
      "Le wizard « Nouveau site WiFi » de la vue (jetable) illustre la création — le rattachement routeur se règle à l'ajout du routeur.",
    ],
    etapes: [
      {
        title: "Créez le site",
        body:
          "Depuis la vue WiFi Jetable (« Nouveau site WiFi ») ou le wizard : nom du site (celui du portail), quota si usage jetable, routeur cible. Un site « sérieux » (boutique) se créera au moment du raccordement de son routeur.",
        capture: cap(
          "hotspot/wifi-wizard.png",
          1440,
          900,
          "Assistant de création d'un site WiFi avec nom, quota et routeur cible",
          "L'assistant site — le point d'entrée des multi-établissements.",
        ),
      },
      {
        title: "Raccordez le routeur au bon site",
        body:
          "À l'ajout du routeur (guide Agent), le site cible se choisit — les vouchers générés pour ce routeur tiennent au site, les sessions et ventes ventilent dessus.",
      },
      {
        title: "Personnalisez le portail du site",
        body:
          "La marque se décline par chaîne : compte → site → routeur (le routeur hérite du site, le site du compte, avec surcharges possibles). Guide Portail captif & marque.",
      },
      {
        title: "Lisez les rapports par site",
        body:
          "Analyse → Rapports accepte le filtre site : comparez les boutiques, repérez la reine et la lanterne rouge — la gestion multi-établissements se fait par comparaison.",
        tip: "Un site sans routeur est un site vide : les sites utiles naissent avec leur routeur.",
      },
    ],
    usages: [
      {
        title: "Chaîne de boutiques",
        body:
          "Deux boutiques, deux terrasses : un compte, des sites — chaque caisse lue séparément, la marge consolidée en un coup d'œil.",
      },
      {
        title: "Boutique + domicile",
        body:
          "Le commerce en site 1, la résidence en site 2 : deux sites bien séparés — ni les tickets ni les rapports ne se mélangent.",
      },
    ],
    pieges: [
      {
        title: "Vendre avec un lot du mauvais site",
        body:
          "Les codes sont valides sur la cible du lot : un ticket « boutique A » ne marche pas sur le routeur de la boutique B — c'est une protection, informez vos caissiers.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Puis-je déplacer un routeur d'un site à l'autre ?",
        a: "Le rattachement se reprend par la modification du routeur — prévoyez la re-génération des lots (les codes restent liés à leur cible d'origine).",
      },
    ],
    related: ["parc-routeurs", "portail-captif", "rapports-comptabilite"],
  },

  {
    id: "portail-captif",
    title: "Portail captif & marque (chaîne compte → site → routeur)",
    summary:
      "La page que voit votre client : logo, couleurs, offres, pub — l'éditeur de portail et la cascade de personnalisation, plus les modèles de tickets.",
    roles: "Propriétaire · Gérant",
    minutes: 5,
    updated: "2026-10-12",
    sectionId: "infrastructure",
    vague: "V2",
    quoi:
      "Le portail captif est la page de connexion WiFi que voit le client (générée par 403Shield, servie par le routeur — login CHAP sécurisé, avec pub optionnelle et offres). Paramètres → Hotspot → Portail est l'éditeur de marque : logo, couleurs, texte, slides d'attente, publicités.\n\nLa personnalisation suit une CASCADE : compte → site → routeur. Le routeur hérite du site, qui hérite du compte — chaque niveau peut SURCHARGER (un routeur « spécial event » garde sa marque propre, le reste suit le site). Les modèles de tickets (Paramètres → Hotspot → Modèles) suivent la même logique pour l'impression.",
    difference: [
      {
        with: "Le walled-garden",
        body:
          "Le walled-garden définit ce qui est accessible AVANT login (sites autorisés sans code) ; le portail EST la page de login. Réparable d'un clic (fiche routeur ⋯ → Réparer).",
      },
      {
        with: "Le WiFi jetable",
        body:
          "Le jetable distribue des codes offerts ; le portail est la porte par TOUS : jetable comme payant. Un site jetable personnalise son portail de la même façon.",
      },
      {
        with: "La vitrine 403shield.ftci.fr",
        body:
          "La vitrine parle de 403Shield (produit) ; votre portail parle de VOUS (votre marque, vos offres) — le client final ne voit jamais la vitrine.",
      },
    ],
    recoit: [
      "L'éditeur de portail : logo, palette, nom affiché, textes, slides d'attente (carrousel), bannières pub — rendu fidèle.",
      "La cascade : réglage par compte, surcharge par site, surcharge par routeur (l'éditeur indique toujours le niveau en édition).",
      "Les modèles de tickets : gabarits d'impression (position du QR, mentions, style) partagés avec l'impression des lots.",
      "Le portail télécharge sa personnalisation depuis le cloud à chaque publication — la mise à jour est visible sans reboot.",
    ],
    etapes: [
      {
        title: "Ouvrez Paramètres → Hotspot → Portail",
        body:
          "L'éditeur présente la prévisualisation et les réglages de marque. Commencez par le logo et le nom : c'est ce que le client retient (la capture montre l'éditeur du compte ProMax WIFI).",
        capture: cap(
          "infrastructure/portal.png",
          1440,
          2658,
          "Éditeur de portail captif : personnalisation du logo, des couleurs et des textes de la page de connexion",
          "L'éditeur de portail — votre marque sur la porte du WiFi.",
        ),
      },
      {
        title: "Posez votre identité (logo, couleurs)",
        body:
          "Logo (PNG transparent conseillé), palette (fond et accent), nom d'établissement. Le rendu fidèle de l'éditeur montre exactement ce que verra le client — itérez jusqu'à satisfaction.",
        tip: "Un logo lisible en petit (le téléphone du client voit ~400 px de large) vaut mieux qu'une belle bannière de bureau.",
      },
      {
        title: "Ajoutez slides et publicités",
        body:
          "Les slides d'attente (carrousel) distrait le temps du login ; les emplacements pub affichent vos offres ou celles de vos annonceurs (revenu pub complémentaire — images fournies par le cloud).",
      },
      {
        title: "Jouez la cascade si besoin",
        body:
          "Besoin d'un portail différent pour UN routeur (event, site test) ? Éditez au niveau routeur (fiche → Personnaliser le portail) : la surcharge ne touche que lui. La remise à l'héritage est un clic.",
      },
      {
        title: "Réglez les modèles de tickets",
        body:
          "Paramètres → Hotspot → Modèles : gabarits d'impression des vouchers (QR, code, mentions légales, style). Le même gabarit sert tous les lots — modifiable à tout moment (les réimpressions suivent).",
        capture: cap(
          "infrastructure/portal-templates.png",
          1440,
          1522,
          "Éditeur de modèles de tickets : gabarit d'impression des vouchers avec QR et mentions",
          "Les modèles de tickets — l'identité papier.",
        ),
      },
    ],
    usages: [
      {
        title: "Marque établissement",
        body:
          "Logo, couleurs, message d'accueil : le WiFi devient un media de marque (chaque connexion affiche votre univers).",
      },
      {
        title: "Vente d'espaces pub",
        body:
          "Les slides pub vendues aux commerçants du quartier : le client regarde la pub en se connectant, vous encaissez l'espace.",
      },
      {
        title: "Portail event",
        body:
          "Une surcharge routeur pour un week-end (sponsoring de l'event) — retour à la marque standard le lundi, sans rien casser.",
      },
    ],
    pieges: [
      {
        title: "La surcharge s'oublie",
        body:
          "Une personnalisation routeur persiste après l'event : pensez à REMETTRE À L'HÉRITAGE — sinon le routeur garde sa marque spéciale pour toujours.",
        severity: "warn",
      },
      {
        title: "Portail « cassé » après manipulations routeur",
        body:
          "Fiche routeur ⋯ → « Réparer le walled-garden » resynchronise le portail et ses accès — c'est le réflexe avant tout ticket support.",
        severity: "info",
      },
      {
        title: "Les offres affichées ≠ profils réels",
        body:
          "Les slides d'offre montrent vos TARIFS de communication ; la mécanique suit les profils. Si vous changez les profils, mettez à jour les slides (cohérence commerciale).",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Le client voit-il le portail en HTTPS ?",
        a: "Le portail est servi par le routeur en local (HTTP local standard des hotspots) ; le login est sécurisé par CHAP (le mot de passe ne transite pas en clair) — le standard du secteur.",
      },
      {
        q: "Puis-je préremplir le code dans l'URL du QR ?",
        a: "Oui : renseignez l'URL de connexion hotspot sur le routeur — le QR des vouchers ouvre la page avec le code pré-rempli (connexion en 1 scan).",
      },
    ],
    related: ["premiere-vente", "sites-multi-sites", "parc-routeurs"],
  },
];
