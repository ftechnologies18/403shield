// Section « Paramètres & compte » — 5 guides (N°304).
import type { Guide } from "../types";
import { cap } from "../cap";

export const PARAMETRES_GUIDES: Guide[] = [
  {
    id: "parametres-generaux",
    title: "Paramètres généraux (organisation, devise, Wave)",
    summary:
      "Le squelette du compte : nom d'établissement, devise, fuseau, coordonnées, canaux de paiement Wave et réglages d'affichage.",
    roles: "Propriétaire",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "parametres",
    vague: "V2",
    quoi:
      "Paramètres → Général porte l'IDENTITÉ de votre compte : nom d'établissement (affiché sur le portail et les tickets), devise (FCFA), fuseau horaire, coordonnées et canaux d'encaissement — dont le lien de paiement Wave, prêt à copier-coller pour vos clients.\n\nLa zone Paramètres de la sidebar remplace la navigation habituelle (zone dédiée, retour via « Tous les paramètres ») : Général, Sécurité, Notifications, Équipe, Abonnement — plus les sections Hotspot (Portail, Modèles) vues dans les guides dédiés.",
    difference: [
      {
        with: "La personnalisation du portail",
        body:
          "Le nom du compte (Général) alimente le portail PAR DÉFAUT ; l'éditeur de portail peut surcharger (logo, couleurs) — la cascade compte → site → routeur du guide Portail.",
      },
      {
        with: "Les paramètres plateforme",
        body:
          "Vos paramètres (ce guide) règlent VOTRE compte ; les paramètres plateforme (super-admin) règlent le service MikCloud lui-même — volet privé, hors périmètre public.",
      },
    ],
    recoit: [
      "L'identité de facturation et d'affichage : nom, contact, devise, fuseau — utilisés partout (tickets, portail, rapports, e-mails).",
      "Le lien de paiement Wave (collecte mobile money CI) : activable, copiable, prêt à envoyer à un client pour un paiement à distance.",
      "Les réglages d'affichage : formats, langue par défaut de l'interface.",
    ],
    etapes: [
      {
        title: "Ouvrez Paramètres → Général",
        body:
          "La sidebar bascule en zone Paramètres. Général regroupe identité, coordonnées, devise/fuseau et paiements — la capture montre la page du compte ProMax WIFI (lien Wave visible).",
        capture: cap(
          "parametres/settings-general.png",
          1440,
          900,
          "Paramètres généraux : identité de l'établissement, devise, coordonnées et lien de paiement Wave",
          "Les Paramètres généraux — l'identité du compte.",
        ),
      },
      {
        title: "Renseignez l'identité",
        body:
          "Nom d'établissement, contact (e-mail de réception des notifications), téléphone affiché. Le nom sert au portail par défaut et aux documents comptables — soignez-le dès le départ.",
      },
      {
        title: "Posez le lien Wave",
        body:
          "Wave (mobile money CI) : activez le canal et copiez le lien de paiement pour l'envoyer à vos clients (paiement à distance d'un forfait, recharge d'un compte). Les encaissements remontent par webhook dans la comptabilité.",
        tip: "Le lien Wave + le QR du portail = deux canaux de caisse sans espèces — les versements se rapprochent dans l'onglet Comptabilité.",
      },
    ],
    usages: [
      {
        title: "Encaissement mobile",
        body:
          "Le client paie par Wave (lien), vous créditez son compte/recharge — la trace part dans la comptabilité, l'espèce n'a plus le monopole.",
      },
    ],
    pieges: [
      {
        title: "Devise et fuseau d'abord",
        body:
          "Ils conditionnent l'affichage des montants et les heures des rapports : réglez-les AVANT de générer des lots (les montants figés des tickets ne se convertissent pas).",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Puis-je changer la devise plus tard ?",
        a: "Techniquement oui, mais les prix des profils déjà générés restent dans l'ancienne unité — Refaites la grille si vous changez de monnaie d'exploitation.",
      },
    ],
    related: ["portail-captif", "abonnement-facturation", "notifications"],
  },

  {
    id: "securite-2fa",
    title: "Sécurité & 2FA",
    summary:
      "Verrouillez la caisse : 2FA (TOTP), politique de mot de passe, sessions actives et révocation — la page qui dort mal si elle est vide.",
    roles: "Propriétaire · Gérant",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "parametres",
    vague: "V3",
    quoi:
      "Paramètres → Sécurité protège l'accès à la console : double authentification TOTP (application d'authentification), politique de mot de passe (longueur/complexité appliquées aux comptes), et la vue des sessions/accès de votre compte.\n\nUn compte qui gère de l'argent (crédit vendeur, ventes, abonnements clients) sans 2FA est une caisse sans serrure : la 2FA se pose en 2 minutes et neutralise les mots de passe devinés/partagés.",
    difference: [
      {
        with: "La réinitialisation par e-mail",
        body:
          "« Mot de passe oublié » (login) contourne la 2FA par le canal e-mail — c'est pourquoi l'adresse de contact doit rester sous votre contrôle (vérifiée dans Général).",
      },
      {
        with: "Shield (protection)",
        body:
          "Shield protège le ROUTEUR (attaques réseau) ; la 2FA protège la CONSOLE (attaques sur votre compte). Les deux verrous, deux portes.",
      },
    ],
    recoit: [
      "La 2FA TOTP : QR à scanner dans une appli d'authentification (Google Authenticator, Authy…) + code de vérification à l'activation.",
      "La politique de mot de passe : règles appliquées aux comptes du compte (longueur, classes de caractères).",
      "La gestion des sessions : la déconnexion révoque le jeton côté serveur (aucune session fantôme après logout).",
    ],
    etapes: [
      {
        title: "Ouvrez Paramètres → Sécurité",
        body:
          "La page présente la 2FA (état, activation), la politique de mot de passe et les accès. TOTP désactivé = un avertissement discret — corrigez-le.",
        capture: cap(
          "parametres/settings-security.png",
          1440,
          1103,
          "Paramètres Sécurité : double authentification, politique de mot de passe et gestion des accès",
          "Sécurité — la 2FA d'abord, le reste suit.",
        ),
      },
      {
        title: "Activez la 2FA (TOTP)",
        body:
          "Scannez le QR avec votre appli, saisissez le code à 6 chiffres pour confirmer. Désormais le login demande identifiant + mot de passe + code rotatif — le mot de passe seul ne suffit plus.",
        tip: "Activez la 2FA sur le compte du PROPRIÉTAIRE d'abord (c'est lui qui tient l'argent), puis sur les gérants.",
      },
      {
        title: "Vérifiez la politique de mot de passe",
        body:
          "Longueur minimale et complexité s'appliquent aux comptes créés/modifiés après réglage — alignez-les sur vos habitudes internes (8+ recommandé).",
      },
    ],
    usages: [
      {
        title: "Compte multi-opérateurs",
        body:
          "Plusieurs caissiers gérants ? 2FA par personne + mots de passe distincts : chaque action du journal reste attribuable à UNE identité.",
      },
    ],
    pieges: [
      {
        title: "Perte du téléphone TOTP",
        body:
          "La seule voie de secours est la réinitialisation par e-mail (login → Mot de passe oublié) : gardez l'adresse de contact à jour AVANT d'activer la 2FA.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "La 2FA concerne-t-elle le Mode Vente des revendeurs ?",
        a: "Non — le revendeur s'authentifie par PIN (rôle restreint, sans accès console). La 2FA protège les comptes console (gérant/propriétaire).",
      },
    ],
    related: ["premiers-pas", "equipe", "journal-activite"],
  },

  {
    id: "notifications",
    title: "Notifications & alertes",
    summary:
      "Restez au courant sans guetter : la cloche de la console, les relais e-mail, le bot Telegram — et le réglage fin des alertes qui comptent.",
    roles: "Propriétaire · Gérant",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "parametres",
    vague: "V2",
    quoi:
      "Deux étages : la CLOCHE (barre supérieure de la console) liste les événements récents (alertes, demandes, renouvellements, annonces) avec état lu/non-lu ; Paramètres → Notifications règle les RELAIS (e-mail, bot Telegram) et les types d'alertes à recevoir.\n\nLes alertes couvrent l'exploitation : routeur hors ligne, pics de charge, abonnement bientôt échu, demandes d'inscription/renouvellement, incidents sécurité. L'e-mail et le Telegram portent l'information hors de la console — vous n'avez plus à ouvrir MikCloud pour savoir.",
    difference: [
      {
        with: "Le journal d'activité",
        body:
          "La cloche/notif = l'info poussée vers vous (l'important, filtré) ; le journal = la mémoire totale (tout, à consulter).",
      },
      {
        with: "Les annonces",
        body:
          "Les annonces (Plateforme/console) diffusent des messages AUX CLIENTS ; les notifications vous informent VOUS. Sens inverse.",
      },
    ],
    recoit: [
      "La cloche : compteur de non-lus, liste chronologique, actions rapides (marquer lu, ouvrir la vue concernée).",
      "Le relais e-mail : adresse de contact (Général) — incidents graves et échéances.",
      "Le bot Telegram : appairage par code (15 min de validité), alertes en direct sur votre téléphone — idéal exploitant mobile.",
      "Le réglage par type : choisissez ce qui mérite un push (routeur down, oui ; chaque session, non).",
    ],
    etapes: [
      {
        title: "Ouvrez la cloche",
        body:
          "La cloche de la barre supérieure liste les notifications récentes avec état lu/non-lu — cliquez une entrée pour ouvrir la vue concernée. La capture montre la cloche ouverte sur le compte ProMax WIFI.",
        capture: cap(
          "parametres/notif-bell.png",
          1440,
          900,
          "Cloche de notifications ouverte : liste des événements récents avec états de lecture",
          "La cloche — les événements à votre attention.",
        ),
      },
      {
        title: "Réglez les canaux (Paramètres → Notifications)",
        body:
          "Activez le relais e-mail (vers l'adresse de contact) et/ou appairez le bot Telegram : un code d'appairage s'affiche, à envoyer au bot dans les 15 minutes — les alertes arrivent ensuite en direct.",
        capture: cap(
          "parametres/settings-notifications.png",
          1440,
          1446,
          "Paramètres Notifications : relais e-mail, appairage Telegram et types d'alertes",
          "Notifications — e-mail et Telegram au choix.",
        ),
        tip: "Le Telegram est le canal de l'exploitant Africain mobile : routeur down à 22 h = SMS-like immédiat, sans ouvrir la console.",
      },
      {
        title: "Choisissez les types d'alertes",
        body:
          "Gardez le signal rare et utile (hors ligne, échéances, sécurité) — une cloche qui sonne tout le temps est une cloche qu'on coupe. Les événements restent de toute façon dans le journal.",
      },
    ],
    usages: [
      {
        title: "L'exploitant itinérant",
        body:
          "Telegram + PWA : le réseau se surveille depuis la rue — un down se sait en 30 secondes, pas au lendemain matin.",
      },
    ],
    pieges: [
      {
        title: "Le code d'appairage Telegram expire",
        body:
          "15 minutes de validité : finalisez l'appairage dans la fenêtre (regardez le QR/code dans Telegram, comme indiqué) sinon recommencez.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Puis-je avoir Telegram ET e-mail ?",
        a: "Oui, les deux canaux vivent en parallèle — Telegram pour le réactif, e-mail pour l'archivé.",
      },
    ],
    related: ["tableau-de-bord", "journal-activite", "parametres-generaux"],
  },

  {
    id: "abonnement-facturation",
    title: "Abonnement & facturation",
    summary:
      "Votre formule MikCloud : plan, usage (routeurs, crédits, modules), renouvellement, paiement Wave/GeniusPay/Stripe — et le mode lecture seule si ça expire.",
    roles: "Propriétaire",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "parametres",
    vague: "V2",
    quoi:
      "Paramètres → Abonnement montre votre FORMULE : usage inclus (nombre de routeurs, crédit, modules activés), échéance, historique de facturation et moyens de paiement (Wave mobile money, GeniusPay, Stripe carte). Les formules se règlent par usage × mode — l'activation des modules (Cybercafé, VPN) s'y reflète.\n\nPoint clé d'exploitation : un abonnement expiré ne PUNIT pas les clients — la console passe en LECTURE SEULE (erreur 402 côté API) : le hotspot continue de vendre, vous ne pouvez plus administrer jusqu'au renouvellement. La reprise est immédiate après paiement.",
    difference: [
      {
        with: "La facturation de VOS clients",
        body:
          "Ici on paie MIKCloud (l'outil) ; vos clients paient VOUS (vouchers, comptes — rapport Comptabilité). Deux caisses, deux logiques.",
      },
      {
        with: "Les demandes de renouvellement",
        body:
          "Le renouvellement peut passer par une DEMANDE (la plateforme vous accompagne, validation humaine) ou par le paiement direct en ligne — voir la vue et les toasts de renouvellement.",
      },
    ],
    recoit: [
      "L'état de la formule : plan, usage consommé/inclus (routeurs, crédits, modules), échéance prochaine.",
      "Les moyens de paiement : Wave (mobile money CI), GeniusPay, Stripe (carte) — le paiement se règle en ligne, la reprise est immédiate.",
      "L'historique de facturation (documents par période).",
      "Le garde 402 : expiration → lecture seule (les clients continuent de vendre) ; suspension de paiement = seules les pages de paiement restent accessibles.",
    ],
    etapes: [
      {
        title: "Ouvrez Paramètres → Abonnement",
        body:
          "La page présente la formule en cours, son usage et l'échéance — la capture montre la page du compte ProMax WIFI (formule, paiement, historique).",
        capture: cap(
          "parametres/settings-subscription.png",
          1440,
          1327,
          "Paramètres Abonnement : formule en cours, usage inclus, échéance, paiement et historique de facturation",
          "Abonnement — votre formule MikCloud.",
        ),
      },
      {
        title: "Lisez votre usage",
        body:
          "Usage inclus vs consommé (routeurs, crédit vendeur, modules) : le plafond routeurs vous l'a dit à la création d'un routeur de trop ; le crédit se recharge à la génération des lots selon la formule.",
      },
      {
        title: "Renouvelez avant l'échéance",
        body:
          "Le paiement (Wave/GeniusPay/Stripe) renouvelle en ligne et la reprise est immédiate. En cas de passage en lecture seule (402), la console vous guide vers la page de paiement — seules les fonctions de paiement restent ouvertes, le hotspot vend toujours.",
        tip: "Un renouvellement par Wave se règle en 30 secondes depuis le téléphone — caler l'échéance au 1er du mois pour la retrouver sans y penser.",
      },
    ],
    usages: [
      {
        title: "La croissance maîtrisée",
        body:
          "Un site : formule de base. Le deuxième routeur/le module Cybercafé arrive quand la marge (Rapports) le justifie — l'abonnement suit l'activité, jamais l'inverse.",
      },
    ],
    pieges: [
      {
        title: "L'expiration ne coupe pas le hotspot",
        body:
          "Les clients ne perdent RIEN à votre retard de paiement — c'est VOUS qui perdez la main administrative (lecture seule). Renouvelez vite, tout revient tel quel.",
        severity: "info",
      },
      {
        title: "Le crédit vendeur n'est pas l'abonnement",
        body:
          "Le crédit sert à GÉNÉRER les lots (marchandise) ; l'abonnement couvre l'OUTIL. Deux caisses distinctes dans deux pages distinctes.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Comment changer de formule (montée/descente) ?",
        a: "La montée s'opère en ligne (immédiate, au prorata selon les règles) ; la descente passe par une demande de renouvellement (accompagnement plateforme).",
      },
      {
        q: "Ai-je une facture officielle ?",
        a: "Chaque période génère son document (historique de facturation) — exportable pour votre comptabilité.",
      },
    ],
    related: ["premiere-vente", "parametres-generaux", "rapports-comptabilite"],
  },

  {
    id: "equipe",
    title: "Équipe & rôles",
    summary:
      "Invitez vos caissiers/gérants, distribuez les bons rôles (gérant vs propriétaire), révoquez en un clic — la page de la délégation sûre.",
    roles: "Propriétaire",
    minutes: 3,
    updated: "2026-10-12",
    sectionId: "parametres",
    vague: "V3",
    quoi:
      "Paramètres → Équipe gère les accès CONSOLE de votre personnel : chaque membre a son identifiant, son rôle (gérant = rang 2 : opère la vente et le réseau ; propriétaire = rang 3 : en plus les actions sensibles et l'abonnement), et son état (actif/révoqué).\n\nLes vues accessibles suivent le rôle (le gérant voit moins d'entrées sensibles) — et chaque action reste attribuée nominativement dans le journal d'activité.",
    difference: [
      {
        with: "Les revendeurs",
        body:
          "Le gérant OPÈRE la console (gestion) ; le revendeur VEND en Mode Vente (PIN, pas de console). Le premier est un collaborateur, le second un canal de distribution.",
      },
      {
        with: "Les utilisateurs clients",
        body:
          "L'équipe gère VOTRE activité ; les utilisateurs sont VOS clients WiFi. Les deux vivent dans des vues séparées (Paramètres → Équipe vs Personnes → Utilisateurs).",
      },
    ],
    recoit: [
      "La liste des membres : identifiant, rôle, état, dernière activité.",
      "Les invitations : le membre reçoit ses accès (identifiant + mot de passe initial à changer), immédiatement opérationnels.",
      "La révocation immédiate : un membre révoqué perd la console à sa prochaine requête (jeton révoqué côté serveur).",
      "La traçabilité nominative : le journal d'activité attribue chaque action à son auteur (voir guide Journal).",
    ],
    etapes: [
      {
        title: "Ouvrez Paramètres → Équipe",
        body:
          "La page liste vos membres et l'invitation. Un compte solo n'y verra que le propriétaire — c'est normal, la page prend sens avec l'équipe.",
        capture: cap(
          "parametres/team.png",
          1440,
          900,
          "Paramètres Équipe : liste des membres, rôles et invitation",
          "Équipe — la délégation console.",
        ),
      },
      {
        title: "Invitez un gérant",
        body:
          "Identifiant + rôle Gérant : il opère ventes, sessions, utilisateurs — les actions de propriétaire (abonnement, suppressions sensibles, équipe) lui échappent. Faites-lui changer le mot de passe initial + activer la 2FA (guide Sécurité).",
        tip: "Un identifiant par PERSONNE, jamais un compte partagé « caisse » : la traçabilité du journal n'a de valeur que si l'auteur est réel.",
      },
      {
        title: "Révoquez proprement",
        body:
          "Départ d'un membre : révocation immédiate (perte d'accès à la prochaine requête) — inutile de changer tous les mots de passe. Son historique d'actions reste au journal.",
      },
    ],
    usages: [
      {
        title: "Le comptoir à deux",
        body:
          "Vous (propriétaire) gérez grille et abonnement ; le caissier (gérant) vend et kick — chacun dans son couloir, tout est tracé.",
      },
    ],
    pieges: [
      {
        title: "Rôle gérant ≠ demi-propriétaire",
        body:
          "Le gérant n'a PAS l'abonnement ni l'équipe : prévoyez qui tient ces rênes pendant vos absences (vacances : un deuxième propriétaire de confiance, pas un gérant surchargé).",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Combien de membres ?",
        a: "Selon la formule ; l'invitation vous l'indique au plafond. La révocation libère la place.",
      },
    ],
    related: ["premiers-pas", "securite-2fa", "revendeurs"],
  },
];
