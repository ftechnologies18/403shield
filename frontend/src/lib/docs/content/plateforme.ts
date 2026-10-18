// ─────────────────────────────────────────────────────────────────────────────
// Volet PLATEFORME (6 guides) — PRIVÉ, N°304.
//
// ACCÈS : uniquement via le menu profil de la sidebar (admins plateforme) —
// décision exploitant : PAS d'accessibilité publique pour ce volet.
// Ce fichier est importé DYNAMIQUEMENT par la route gated
// /docs/guides/plateforme/[slug] UNIQUEMENT après vérification session +
// rôle. Il ne doit JAMAIS être référencé par une page publique.
//
// Captures : session production 2026-10-12 sur le compte super-admin dédié
// (admin, rôle platform_admin) — 17 écrans de la console plateforme dans
// /public/docs/plateforme/. Vérification VLM anti-secret : aucune donnée
// d'authentification, IP, token ou e-mail personnel visible. L'impersonation
// (guide cockpit) a été OUVERTE puis quittée immédiatement — geste support
// prévu, tracé au journal, aucun effet de bord.
// ─────────────────────────────────────────────────────────────────────────────
import type { Guide } from "../types";
import { cap } from "../cap";

export const PLATEFORME_GUIDES: Guide[] = [
  {
    id: "plateforme-cockpit",
    title: "Cockpit & comptes SaaS",
    summary:
      "La vue de commandement plateforme : santé du service, comptes clients (création, impersonation, suspensions) et les gestes de support du quotidien.",
    roles: "Admin plateforme",
    minutes: 5,
    updated: "2026-10-18",
    sectionId: "plateforme",
    vague: "V3",
    quoi:
      "Le cockpit plateforme (mode plateforme de la sidebar — l'admin bascule via son compte principal) ouvre sur la vue d'ensemble : état du service, comptes SaaS actifs, derniers événements. La vue « Comptes SaaS » est le centre des opérations support : chaque compte client (établissement) y vit avec son usage, son abonnement, ses routeurs.\n\nL'outil support clé est l'IMPERSONATION : « Ouvrir la console » d'un compte bascule l'admin dans la console client (bannière d'impersonation visible, exit en un clic) — débugger « comme si on était le client » sans échanger ses identifiants.",
    difference: [
      {
        with: "La console d'un compte client",
        body:
          "La console client gère UN établissement (vouchers, sessions…) ; le cockpit gère TOUS les comptes. L'impersonation est le pont entre les deux.",
      },
      {
        with: "Les demandes de renouvellement",
        body:
          "Les demandes (vue dédiée) sont le flux ADMINISTRATIF de facturation ; le cockpit est l'état des lieux permanent.",
      },
    ],
    recoit: [
      "L'état global : comptes actifs/suspendus, usage (routeurs, modules), santé du service.",
      "Par compte : identité, formule, échéance, usage — et les actions : ouvrir la console (impersonation), ajuster, suspendre/réactiver.",
      "L'impersonation : console client avec bannière permanente + retour immédiat (session secondaire, jeton propre — jamais d'échange d'identifiants).",
    ],
    etapes: [
      {
        title: "Basculez en mode plateforme",
        body:
          "Depuis votre compte admin plateforme, la sidebar s'ouvre sur la section PLATEFORME (11 vues, de la vue d'ensemble aux paramètres) — la capture montre le décor complet : sidebar repliée sur la section et cockpit en zone principale.",
        capture: cap(
          "plateforme/cockpit.png",
          1440,
          900,
          "Console plateforme : la section PLATEFORME de la sidebar et la vue d'ensemble",
          "Le cockpit — comptes actifs, routeurs en ligne, utilisateurs hotspot, sessions, ventes et revenus 30 j, abonnements SaaS et croissance des comptes (6 mois).",
        ),
      },
      {
        title: "Lisez le cockpit",
        body:
          "Comptes, suspensions, événements récents : la santé d'ensemble se lit en 30 secondes — statut des inscriptions publiques, classement des comptes par revenus, abonnements actifs/expirés/essai. « Gérer les comptes » mène à la vue Comptes SaaS.",
      },
      {
        title: "Ouvrez la vue Comptes SaaS",
        body:
          "Le centre des opérations support : chaque compte y vit avec son identifiant, son statut, son usage et ses actions — « Console de … » (impersonation) et « Désactiver ».",
        capture: cap(
          "plateforme/comptes.png",
          1440,
          900,
          "Vue Comptes SaaS : table des comptes clients avec statut, usage, revenus et actions",
          "Chaque ligne : identifiant du compte, statut, échéance, routeurs, utilisateurs hotspot, revenus — et les boutons d'action par compte.",
        ),
      },
      {
        title: "Ouvrez la console d'un compte (impersonation)",
        body:
          "« Console de … » sur la ligne du compte — la bannière d'impersonation (session support) rappelle QUI vous impersonnifiez ; le bouton « Retour à la console plateforme » ramène en un clic. Toute action reste tracée nominativement au journal.",
        capture: cap(
          "plateforme/impersonation.png",
          1440,
          900,
          "Impersonation : console du compte client avec la bannière « Console de APAH SERVICE — SESSION SUPPORT »",
          "La bannière reste affichée tant que la session support est ouverte ; la sidebar du client garde le lien de retour vers la console plateforme.",
        ),
        tip: "Réflexe support : avant toute impersonation, notez le motif (ticket/appel) — le journal gardera le geste, pas le pourquoi.",
      },
      {
        title: "Gestes de support",
        body:
          "Suspension (dossier de paiement en attente : le compte passe en lecture de paiement), réactivation, ajustements d'usage — chaque geste est daté et documenté au journal plateforme. Les boutons vivent sur la ligne du compte (vue Comptes).",
      },
      {
        title: "Gardez les guides sous la main",
        body:
          "Ce volet « Guides plateforme » (ces 6 guides) vit dans le menu profil de la sidebar — il n'est référencé nulle part ailleurs : le hub public /docs/guides liste les 30 guides d'exploitation clients, le volet plateforme reste réservé aux admins.",
        capture: cap(
          "plateforme/menu-guides.png",
          1440,
          900,
          "Menu profil de la sidebar avec l'entrée « Guides plateforme »",
          "Le menu profil (bas de sidebar) : Profil, Guides plateforme, Paramètres, changement de langue, déconnexion.",
        ),
      },
    ],
    usages: [
      {
        title: "Support de premier niveau",
        body:
          "« Mon WiFi ne marche pas » : cockpit → compte → impersonation → tableau de bord du client — le diagnostic traverse les trois niveaux en deux minutes.",
      },
    ],
    pieges: [
      {
        title: "Impersonation ≠ invisibilité",
        body:
          "L'admin impersonnifié agit SOUS son identité de plateforme (traces nominatives) : n'utilisez l'impersonation que pour le support, jamais pour « tester » des actions destructrices sans trace.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Le client voit-il l'impersonation ?",
        a: "Les actions restent dans SON journal d'activité (attribuées à l'admin) — l'ouverture du support est transparente par conception.",
      },
    ],
    related: ["plateforme-facturation", "plateforme-reglages"],
  },

  {
    id: "plateforme-flotte",
    title: "Flotte routeurs & MAJ RouterOS",
    summary:
      "Le parc matériel de TOUS les comptes : état des agents, mises à jour RouterOS coordonnées en flotte, incidents matériels.",
    roles: "Admin plateforme",
    minutes: 4,
    updated: "2026-10-18",
    sectionId: "plateforme",
    vague: "V3",
    quoi:
      "La vue Flotte consolide les routeurs raccordés par tous les comptes : modèle, version RouterOS, état agent (en ligne/hors ligne), dernier check-in. Son outil majeur est la MAJ RouterOS EN FLOTTE : déployer une montée de version par vagues (santé, groupes, calendrier) sans intervenir compte par compte.\n\nLa contrainte d'agent (TLS ≥ 7.19) se pilote ici : les routeurs trop anciens se repèrent à la version et se planifient en montée prioritaire.",
    difference: [
      {
        with: "Le parc d'un compte client",
        body:
          "Le parc client couvre SES routeurs (vue Routeurs de sa console) ; la flotte couvre le parc GLOBAL — mêmes informations, échelle différente.",
      },
      {
        with: "La MAJ depuis la fiche client",
        body:
          "La fiche routeur (console client) met à jour UN routeur ; la flotte orchestre les vagues — l'un pour l'exploitant, l'autre pour la plateforme.",
      },
    ],
    recoit: [
      "La liste globale : compte, routeur, modèle, version, état, fraîcheur du check-in.",
      "Les vagues de MAJ RouterOS : sélection, planification, suivi de progression, retours d'erreur par routeur.",
      "Les signaux : versions obsolètes (agent TLS), routeurs muets, flottes à traiter.",
    ],
    etapes: [
      {
        title: "Ouvrez la vue Flotte",
        body:
          "La liste consolidée par compte : chaque routeur avec son compte, son nom, son mode (Agent), sa version RouterOS et l'état de la vérification de mise à jour — « Vérifier tout le parc » détecte les montées disponibles AVANT toute vague (le bouton de mise à jour reste inactif sans détection).",
        capture: cap(
          "plateforme/flotte.png",
          1440,
          900,
          "Vue Parc routeurs (flotte) : KPIs et liste des routeurs de tous les comptes",
          "5 routeurs en ligne (mode Agent), version RouterOS 7.24.5 stable partout, aucune mise à jour détectée — boutons « Vérifier » par routeur et « Vérifier tout le parc » en tête de liste.",
        ),
      },
      {
        title: "Préparez une vague de MAJ",
        body:
          "Filtrez la cible (version, compte, santé), planifiez la vague — la montée coupe chaque routeur quelques minutes : évitez les heures chaudes des commerces.",
      },
      {
        title: "Suivez la progression",
        body:
          "La vague rapporte par routeur (succès, échec, motif) — les échecs se rejouent individuellement après diagnostic (routeur éteint ? coupure pendant la MAJ ?).",
        tip: "Commencez toujours par une vague pilote (1-2 routeurs tests) : la flotte suit le pilote, jamais l'inverse.",
      },
    ],
    usages: [
      {
        title: "Campagne de sécurité",
        body:
          "Une faille RouterOS publiée : la flotte identifie les versions exposées et planifie le correctif par vagues, sans intervention compte par compte.",
      },
    ],
    pieges: [
      {
        title: "MAJ en heure d'ouverture",
        body:
          "Chaque routeur coupé = un commerce muet : la planification par créneaux (nuits, dimanches) est de la responsabilité de la flotte.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Un routeur refuse la MAJ ?",
        a: "Vérifiez l'état agent (en ligne ?), l'espace disque routeur et la version intermédiaire (certaines montées exigent un palier) — le détail remonte à la vague.",
      },
    ],
    related: ["plateforme-cockpit", "parc-routeurs"],
  },

  {
    id: "plateforme-vpn-grossiste",
    title: "VPN & vente directe (grossiste)",
    summary:
      "Le pool VPN global, l'octroi aux comptes (mode grossiste), et la vitrine B2C (commandes publiques, paiement en ligne) — la chaîne commerciale complète.",
    roles: "Admin plateforme",
    minutes: 5,
    updated: "2026-10-12",
    sectionId: "plateforme",
    vague: "V3",
    quoi:
      "La vue VPN & Vente directe gère l'offre VPN à l'échelle plateforme : le POOL global (comptes VPN provisionnables), l'OCTROI aux comptes clients (mode grossiste : un compte ne peut vendre que ce que la plateforme lui alloue — verrou Module), et la VITRINE B2C (PublicVpnShop : la boutique publique et ses commandes).\n\nLes onglets : Aperçu & comptes (pool, octrois, verrous), Peers (vue globale), Commandes B2C (les achats autonomes de la vitrine — paiement, provision, litiges).",
    difference: [
      {
        with: "Le module VPN d'un compte",
        body:
          "Le module client vend SES peers dans SON quota octroyé ; la plateforme tient le pool, les verrous et la vitrine — le grossiste et ses détaillants.",
      },
      {
        with: "La vitrine /vpn (publique)",
        body:
          "La vitrine est la FACE publique ; cette vue est la COULISSE (commandes, provision, supports). Guide public : Vitrine VPN B2C.",
      },
    ],
    recoit: [
      "Le pool global et sa santé (capacité, peers actifs, charge).",
      "Les octrois par compte : quota alloué, verrou module (actif/passif), consommation.",
      "Les commandes B2C : paiement (webhooks Wave/GeniusPay/Stripe validés), provision automatique, incidents.",
    ],
    etapes: [
      {
        title: "Ouvrez la vue VPN plateforme",
        body:
          "L'onglet « Aperçu & comptes » : santé du pool wg0 (adresses réservées), comptes revendeurs avec module VPN actif, vente directe et encaissé 30 j — puis l'état de la vitrine publique et la section « Octroi du module de revente ».",
        capture: cap(
          "plateforme/vpn-apercu.png",
          1440,
          900,
          "Onglet Aperçu & comptes de la vue VPN plateforme : pool wg0, octroi du module, vitrine publique",
          "Le cockpit du grossiste — pool WireGuard global, octroi du module de revente par compte, commandes B2C et réconciliation cloud ↔ serveur.",
        ),
      },
      {
        title: "Octroyez un quota à un compte",
        body:
          "Le compte client demande à vendre du VPN (module) : la plateforme alloue le quota et pose le verrou module (PUT admin vpn accounts) — le compte vend ensuite dans son quota, la vue suit la consommation.",
      },
      {
        title: "Suivez les peers",
        body:
          "L'onglet « Peers » : la vue globale des accès VPN du pool — chaque peer avec son compte et son état. C'est la loupe de diagnostic quand un accès B2C ou revendeur pose question.",
        capture: cap(
          "plateforme/vpn-peers.png",
          1440,
          900,
          "Onglet Peers : vue globale des accès VPN du pool",
          "La liste des peers du pool global (vide ici — aucun accès provisionné) avec ses filtres.",
        ),
      },
      {
        title: "Pilotez la vitrine B2C",
        body:
          "PublicVpnShop s'active/règle côté plateforme : formules affichées, prix, canaux de paiement. Les commandes arrivent dans l'onglet dédié (paiement → provision auto → livraison des clés).",
        capture: cap(
          "plateforme/vpn-commandes.png",
          1440,
          900,
          "Onglet Commandes B2C : les achats autonomes de la vitrine publique",
          "Les commandes de la vente directe — paiement en ligne (webhooks validés), provision automatique, incidents et reprises.",
        ),
        tip: "Le verrou grossiste protège la qualité : n'octroyez que ce que le compte saura supporter (support client inclus).",
      },
    ],
    usages: [
      {
        title: "Réseau de revendeurs VPN",
        body:
          "Octroi par compte selon sa taille, vitrine centralisée, commandes consolidées : la plateforme devient grossiste VPN pour son réseau d'exploitants.",
      },
    ],
    pieges: [
      {
        title: "Octroi sans support",
        body:
          "Un compte qui vend du VPN sans savoir le supporter renvoie les clients vers VOUS (plateforme) : l'octroi se mérite.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Un litige de paiement B2C ?",
        a: "La commande garde l'état du webhook (validé/échoué) — la reprise se fait dans l'onglet Commandes (re-provision ou remboursement selon le canal).",
      },
    ],
    related: ["vpn-wireguard", "vitrine-vpn", "plateforme-cockpit"],
  },

  {
    id: "plateforme-support",
    title: "Conversations & annonces",
    summary:
      "Le canal support plateforme (chat comptes) et la diffusion d'annonces à tous les clients — communication à double sens.",
    roles: "Admin plateforme",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "plateforme",
    vague: "V3",
    quoi:
      "Deux vues jumelles : Conversations (chat support entre la plateforme et les comptes — messages entrants/sortants, historique par compte, balayage de rétention) et Annonces (messages diffusés à TOUS les clients, bandeau en console + relais selon canaux).\n\nLes annonces servent la vie du service : maintenance annoncée, nouvelle fonctionnalité, consigne de sécurité. Le chat sert le support individuel — les deux vivent dans le mode plateforme.",
    difference: [
      {
        with: "Les notifications d'un compte",
        body:
          "Les notifications client (cloche) reçoivent SES événements ; les annonces viennent de la plateforme et s'affichent en BANDEAU console (vue dédiée côté client pour l'historique).",
      },
      {
        with: "Le bot Telegram",
        body:
          "Le Telegram (paramètres client) relaie les alertes vers l'exploitant ; les annonces/chat passent par la console. Canaux complémentaires.",
      },
    ],
    recoit: [
      "Le chat support : files par compte, historique, réponse directe — la conversation reste attachée au compte (support traçable).",
      "Les annonces : rédaction, cible (tous / segment), période d'affichage — le bandeau apparaît en console cliente, l'historique dans leur vue Annonces.",
      "La rétention : sweep de nettoyage (chat ancien purgé selon rétention) — la charge de support reste maîtrisée.",
    ],
    etapes: [
      {
        title: "Répondez aux conversations",
        body:
          "Les messages entrants se traitent depuis la vue Conversations (par compte, ordre chronologique) : filtres Toutes / Humain / Bot / Fermées, clôture automatique après 15 minutes de silence — la réponse d'un conseiller rouvre à tout moment, la rétention purge l'ancien.",
        capture: cap(
          "plateforme/conversations.png",
          1440,
          900,
          "Vue Conversations : inbox support avec filtres et règles de rétention",
          "L'inbox plateforme — les conversations par compte, les filtres (humain/bot/fermées) et les règles de clôture et de rétention affichées en tête.",
        ),
      },
      {
        title: "Rédigez une annonce",
        body:
          "Nouvelle annonce : message, cible, durée — le bandeau s'affiche chez les clients concernés (annonces récentes visibles dans leur vue dédiée).",
        capture: cap(
          "plateforme/annonces.png",
          1440,
          900,
          "Vue Annonces aux clients : liste et bouton « Nouvelle annonce »",
          "L'historique des annonces diffusées et le bouton de rédaction — une annonce à la fois en bandeau, l'historique reste consultable.",
        ),
        tip: "Une annonce de maintenance doit préciser QUAND (fenêtre) et QUOI (impact) : « samedi 03 h–04 h UTC, console lue seule 10 min » vaut mieux que « maintenance ce week-end ».",
      },
      {
        title: "Le formulaire de diffusion",
        body:
          "« Diffuser une annonce » ouvre un formulaire court : titre (requis) et message (optionnel) — la diffusion reste inactive tant que le titre est vide, aucun accident d'envoi.",
        capture: cap(
          "plateforme/annonces-dialog.png",
          1440,
          900,
          "Dialogue « Diffuser une annonce » : champs titre et message",
          "Le dialogue de rédaction — le bouton de diffusion reste désactivé tant que le titre n'est pas saisi.",
        ),
      },
    ],
    usages: [
      {
        title: "Communication de crise",
        body:
          "Incident global : l'annonce prévient tout le monde en un geste (bandeau immédiat) — le chat traite ensuite les cas individuels.",
      },
    ],
    pieges: [
      {
        title: "Trop d'annonces = bandeau invisible",
        body:
          "Le bandeau permanent devient un meuble : réservez l'annonce au VRAIMENT important (une à deux par mois).",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Les clients peuvent-ils répondre aux annonces ?",
        a: "Les annonces sont à sens unique (affichage) ; la réponse passe par le chat support ou les canaux classiques (appel, e-mail).",
      },
    ],
    related: ["plateforme-cockpit", "notifications"],
  },

  {
    id: "plateforme-facturation",
    title: "Demandes de renouvellement",
    summary:
      "Le flux administratif de la facturation SaaS : demandes de renouvellement/ajustement déposées par les comptes, validation, reprise de paiement.",
    roles: "Admin plateforme",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "plateforme",
    vague: "V3",
    quoi:
      "La vue Demandes de renouvellement centralise les demandes de facturation des comptes : montée/descente de formule, renouvellement accompagné, régularisation. Chaque demande arrive avec son contexte (compte, formule actuelle, cible, motif éventuel) et se VALIDE manuellement — la facturation ajustée suit.\n\nC'est le complément humain du paiement autonome (les comptes peuvent payer seuls en ligne ; la demande sert les cas d'accompagnement : montée négociée, échéance décalée, paiement hors-ligne).",
    difference: [
      {
        with: "Le paiement autonome (client)",
        body:
          "Le paiement en ligne (Wave/GeniusPay/Stripe, guide Abonnement client) se règle sans humain ; la demande de renouvellement passe par VOUS — deux circuits, une même caisse.",
      },
      {
        with: "Les demandes d'inscription (client)",
        body:
          "Inscriptions = nouveaux COMPTES finaux clients des exploitants ; renouvellements = vie COMMERCIALE des comptes SaaS eux-mêmes.",
      },
    ],
    recoit: [
      "La file de demandes : compte, type (montée/descente/renouvellement), détail, date.",
      "La validation (ou le refus motivé) — le compte est notifié du traitement.",
      "Le suivi : demandes traitées, en attente, historique (le badge de la sidebar cliente signale la réponse à l'exploitant).",
    ],
    etapes: [
      {
        title: "Traitez la file",
        body:
          "Chaque demande se lit avec son contexte (compte, formule actuelle, cible, motif) : Validez (l'ajustement s'applique, le compte est notifié) ou refusez (motif conservé — le compte peut déposer une nouvelle demande ajustée). La file vide sur la capture — une demande en attente s'y affiche avec ses actions.",
        capture: cap(
          "plateforme/demandes.png",
          1440,
          900,
          "Vue Demandes de renouvellement : la file des demandes de facturation",
          "La file des demandes déposées par les comptes (montée/descente/renouvellement) — vide quand tout est traité.",
        ),
        tip: "La montée au prorata se vérifie d'un clic d'œil (l'échéance reste, le delta se calcule) — la descente en milieu de période se refuse poliment avec date de prise d'effet.",
      },
    ],
    usages: [
      {
        title: "Facturation accompagnée",
        body:
          "Petits comptes sans carte bancaire : renouvellement par demande + paiement Wave direct à la plateforme — l'humain reste dans la boucle là où le marché le demande.",
      },
    ],
    pieges: [
      {
        title: "File non traitée = comptes bloqués",
        body:
          "Une demande de renouvellement en attente pendant l'expiration met le compte en lecture seule : traitez la file AVANT les échéances (un passage quotidien suffit).",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Puis-je initier une demande pour un compte ?",
        a: "La demande vient du compte (sa console) ; la plateforme traite. Pour ajuster d'office (geste commercial), utilisez les actions du cockpit.",
      },
    ],
    related: ["plateforme-cockpit", "abonnement-facturation"],
  },

  {
    id: "plateforme-reglages",
    title: "Journal, équipe & paramètres plateforme",
    summary:
      "Les trois vues de fondation : journal global (tous comptes), équipe plateforme (super-admins) et paramètres du service (général, sécurité, maintenance).",
    roles: "Admin plateforme",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "plateforme",
    vague: "V3",
    quoi:
      "Le volet de fondation du mode plateforme : Journal (activité GLOBALE — tous comptes, webhooks, paiements, incidents — l'audit de service), Équipe (les super-admins, leurs rôles, la double garde /api/admin/*) et Paramètres du service (Général / Sécurité / Maintenance : identité, inscriptions, mot de passe admin, 2FA, base de données et santé de la persistance).\n\nC'est ici que se règlent les politiques transverses (identité du SaaS, inscriptions publiques, sécurité du compte admin, rechargement de la base) — les réglages du « moteur », pas ceux d'un compte.",
    difference: [
      {
        with: "Le journal d'un compte",
        body:
          "Le journal client trace SON périmètre ; le journal plateforme trace le SERVICE (tous comptes + événements infrastructure) — l'un pour l'exploitant, l'autre pour l'opérateur.",
      },
      {
        with: "Les paramètres d'un compte",
        body:
          "Paramètres client = identité/moyens d'un établissement ; paramètres plateforme = politique du service (maintenance, sécurité, quotas d'inscription).",
      },
    ],
    recoit: [
      "Journal global : chronologie multi-comptes avec filtres (types, comptes, période) — l'outil d'audit de service.",
      "Équipe plateforme : les super-admins, l'ajout/la révocation (double garde sur les routes admin — deux niveaux de vérification du rôle).",
      "Paramètres plateforme : Général (identité du service, réglages d'inscription, vitrine VPN), Sécurité (mot de passe admin, 2FA), Maintenance (rechargement base, santé de la persistance, purge des données).",
    ],
    etapes: [
      {
        title: "Auditez via le journal global",
        body:
          "Recherche croisée (compte + période + type) : « tout ce qu'a fait tel compte cette semaine » se répond en secondes — la chronologie multi-comptes défile avec l'âge exact de chaque événement (cadences agents, sessions, gestes support…).",
        capture: cap(
          "plateforme/journal.png",
          1440,
          900,
          "Journal plateforme : activité de tous les comptes avec filtres",
          "La chronologie multi-comptes (routeurs, sessions, support…) et les filtres par compte et par type.",
        ),
      },
      {
        title: "Gérez l'équipe plateforme",
        body:
          "Ajout d'un super-admin (invitation, rôle) et révocation — la double garde des routes admin reste vérifiée côté serveur à CHAQUE appel (pas seulement au login). Le compte connecté est marqué « Vous ».",
        capture: cap(
          "plateforme/equipe.png",
          1440,
          900,
          "Vue Équipe plateforme : la table des super-administrateurs",
          "Chaque super-admin avec son identifiant de connexion, son rôle et sa date de création — le compte connecté est marqué « Vous ».",
        ),
      },
      {
        title: "Réglez le service (Général)",
        body:
          "Paramètres plateforme, onglet Général : identité du SaaS (nom affiché à la connexion et au pied de page), ouverture/fermeture des inscriptions publiques (clé d'invitation quand fermées) et vitrine VPN (vente directe /vpn — opt-in strict).",
        capture: cap(
          "plateforme/parametres-general.png",
          1440,
          900,
          "Onglet Général des paramètres plateforme : identité, inscriptions, vitrine VPN",
          "Le nom affiché du SaaS, l'ouverture des inscriptions publiques et le réglage de la vitrine VPN (vente directe).",
        ),
      },
      {
        title: "Sécurisez le compte admin (Sécurité)",
        body:
          "L'onglet Sécurité : changement du mot de passe admin plateforme (actuel, nouveau, confirmation — 10 caractères minimum) et double authentification (code à 6 chiffres via application authenticator : Google Authenticator, Aegis, Authy…).",
        capture: cap(
          "plateforme/parametres-securite.png",
          1440,
          900,
          "Onglet Sécurité : mot de passe admin et double authentification",
          "Le changement de mot de passe du compte administrateur plateforme et l'activation de la 2FA (TOTP).",
        ),
      },
      {
        title: "Base & santé du service (Maintenance)",
        body:
          "L'onglet Maintenance : rechargement des données depuis la base persistée (sans redémarrer — utile après une modification SQL directe), santé de la persistance (dernière synchro, delta appliqué, agents en ligne, stockage d'images R2) et purge des données par catégorie et portée.",
        capture: cap(
          "plateforme/parametres-maintenance.png",
          1440,
          900,
          "Onglet Maintenance : base de données et santé de la persistance",
          "Le rechargement depuis la base et le diagnostic temps réel de la synchronisation (dernière synchro, delta, démarrages cumulés, canal Cloudflare R2 opérationnel).",
        ),
        tip: "La maintenance se PRÉPARE : annonce (vue Annonces) → fenêtre hors heures → intervention → vérification → annonce de fin. Jamais l'inverse.",
      },
    ],
    usages: [
      {
        title: "Audit de sécurité périodique",
        body:
          "Revue mensuelle : accès admin (journal), tentatives bloquées, webhooks de paiement en échec — le journal global est la mémoire du service.",
      },
    ],
    pieges: [
      {
        title: "Une vraie maintenance se prépare, pas une page",
        body:
          "L'interrupteur « page de maintenance » n'existe pas : la procédure réelle passe par une annonce de niveau Maintenance (vue Annonces) — fenêtre, impact, annonce de fin. L'onglet Maintenance des paramètres sert à la BASE et à la SANTÉ du service (rechargement, purge, diagnostics), jamais à couper l'accès des clients.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Qui peut voir ces vues ?",
        a: "Les super-admins (double garde rôle /api/admin/*) — les propriétaires de comptes clients n'ont ni le mode plateforme ni ces entrées (le volet docs lui-même n'est listé que dans leur menu profil s'ils sont admins plateforme).",
      },
    ],
    related: ["plateforme-cockpit", "plateforme-support"],
  },
];
