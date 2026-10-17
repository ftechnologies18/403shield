// Section « Démarrer » — 3 guides (N°304). Captures production lerobuste/ProMax WIFI.
import type { Guide } from "../types";
import { cap } from "../cap";

export const DEMARRER_GUIDES: Guide[] = [
  {
    id: "premiers-pas",
    title: "Créer votre compte et inviter votre équipe",
    summary:
      "Inscription, connexion, rôles (gérant / propriétaire), menu profil, recherche ⌘K et installation mobile (PWA) — tout ce qu'il faut avant de brancher le premier routeur.",
    roles: "Propriétaire · Gérant",
    minutes: 5,
    updated: "2026-10-12",
    sectionId: "demarrer",
    vague: "V1",
    quoi:
      "403Shield se prend en main depuis un simple navigateur : une vitrine publique (403shield.ftci.fr), un écran de connexion, puis une console unique pour toute votre activité WiFi. Votre compte porte un identifiant (ex. « lerobuste »), un rôle (propriétaire = rang 3, gérant = rang 2) et un usage (hotspot ou foyer). Le même compte fonctionne sur ordinateur et sur téléphone — la console est installable comme application (PWA), sans passer par un store.\n\nChaque compte est cloisonné : un gérant nommé par un propriétaire ne voit que le compte de son employeur, jamais les autres établissements de la plateforme.",
    difference: [
      {
        with: "Le compte revendeur (Mode Vente)",
        body:
          "Le revendeur ne se connecte pas à la console : il ouvre /sell sur son téléphone avec un code PIN à 4-6 chiffres, uniquement pour vendre des tickets. Voir le guide « Mode Vente du revendeur ».",
      },
      {
        with: "Le compte client final",
        body:
          "Le client ne se connecte nulle part : il saisit son code sur le portail captif du hotspot. Aucun compte à créer pour lui.",
      },
      {
        with: "L'invitation d'équipe",
        body:
          "Le propriétaire peut inviter des gérants (Paramètres → Équipe) : mêmes écrans, mais certaines actions sensibles (supprimer un routeur, gérer l'abonnement) restent réservées au propriétaire.",
      },
    ],
    recoit: [
      "Un identifiant + mot de passe personnels (le mot de passe est haché côté serveur ; en cas d'oubli, un lien de réinitialisation part par e-mail, valable une fois).",
      "L'option 2FA (TOTP, application type Google Authenticator) dans Paramètres → Sécurité — recommandée dès que le compte gère de l'argent.",
      "Une console bilingue français / anglais (bascule dans le menu profil), thème jour / nuit, et une recherche universelle (⌘K / Ctrl+K).",
      "Une PWA : « Installer » depuis Chrome mobile ajoute 403Shield à votre écran d'accueil, avec fonctionnement hors-ligne dégradé pour les vues déjà consultées.",
    ],
    etapes: [
      {
        title: "Créer le compte depuis la vitrine",
        body:
          "Ouvrez 403shield.ftci.fr puis « Créer mon compte ». Renseignez le nom de votre établissement (c'est lui qui s'affichera sur le portail captif par défaut), votre pays et votre devise (FCFA pour la Côte d'Ivoire). L'inscription est protégée contre les abus (limiteur anti-spam côté serveur).\n\nUn compte d'essai démarre immédiatement : vous pouvez brancher un routeur et vendre avant même de souscrire.",
        capture: cap(
          "demarrer/landing.png",
          1440,
          900,
          "Vitrine publique 403Shield avec bouton « Se connecter » et « Créer mon compte »",
          "La vitrine publique — point d'entrée du compte.",
        ),
      },
      {
        title: "Se connecter",
        body:
          "Sur la page de connexion, saisissez votre identifiant et mot de passe. Si la 2FA est activée, un code à 6 chiffres vous est demandé ensuite. Le bouton « Mot de passe oublié ? » envoie un e-mail de réinitialisation.",
        capture: cap(
          "demarrer/login.png",
          1440,
          900,
          "Écran de connexion 403Shield : identifiant, mot de passe, mot de passe oublié, créer mon compte",
          "L'écran de connexion — onglets Gérant / Revendeur (PIN).",
        ),
      },
      {
        title: "Repérez le menu profil (bas de la barre latérale)",
        body:
          "Votre carte profil vit en bas de la sidebar : cliquez dessus pour ouvrir le menu — Profil (nom, e-mail, mot de passe), Paramètres, langue, thème et déconnexion. C'est aussi ici que les administrateurs de la plateforme trouvent l'entrée « Guides plateforme ».\n\nLa barre latérale se replie (Ctrl+B) pour gagner de la place ; les sections se déplient par clic.",
        capture: cap(
          "demarrer/profile-menu.png",
          1440,
          900,
          "Console 403Shield avec le menu profil ouvert en bas de la barre latérale : Profil, Paramètres, langue, déconnexion",
          "Le menu profil — actions de compte de la console.",
        ),
      },
      {
        title: "Apprivoisez la recherche universelle (⌘K)",
        body:
          "Le bouton « Rechercher » de la barre supérieure (raccourci Ctrl+K ou ⌘K) ouvre une palette qui trouve TOUT : vues (« sessions », « vouchers »), actions (« générer », « déconnecter ») et clients. Tapez quelques lettres, naviguez aux flèches, Entrée pour ouvrir.",
        capture: cap(
          "demarrer/search-palette.png",
          1440,
          900,
          "Palette de recherche ouverte par Ctrl+K : groupes Navigation et Actions",
          "La palette ⌘K — navigation clavier complète.",
        ),
        tip: "La palette propose aussi des actions directes (ex. « Générer des vouchers ») : vous économisez deux clics par tâche fréquente.",
      },
      {
        title: "Installez la console sur votre téléphone (PWA)",
        body:
          "Depuis Chrome mobile sur 403shield.ftci.fr, acceptez la bannière « Installer » (ou menu ⋮ → « Installer l'application »). 403Shield s'ouvre alors plein écran depuis l'écran d'accueil, avec les vues récemment consultées disponibles hors-ligne — précieux quand la 4G vacille.",
        capture: cap(
          "annexes/mobile-login.png",
          390,
          844,
          "Écran de connexion 403Shield sur téléphone mobile",
          "La console sur mobile — même compte, même données.",
        ),
      },
    ],
    usages: [
      {
        title: "L'exploitant multi-casquettes",
        body:
          "Un seul compte suffit pour piloter routeurs, ventes et rapports ; le jour où vous engagez un caissier, invitez-le comme gérant et gardez le rôle propriétaire pour vous.",
      },
      {
        title: "Le suivi depuis le comptoir",
        body:
          "Installez la PWA sur le téléphone du comptoir : les sessions actives et les alertes tombent dans la poche, sans ordinateur allumé.",
      },
    ],
    pieges: [
      {
        title: "Identifiant ≠ e-mail",
        body:
          "L'identifiant de connexion (« lerobuste ») est distinct de l'e-mail de contact. Le premier sert à se connecter, le second à recevoir les notifications et liens de réinitialisation.",
        severity: "info",
      },
      {
        title: "2FA et changement de téléphone",
        body:
          "Activez la 2FA seulement si vous gardez accès à votre e-mail : en cas de perte du téléphone TOTP, c'est la seule voie de secours. Les codes de secours permanents ne sont pas stockés côté 403Shield.",
        severity: "warn",
      },
      {
        title: "Session révoquée à la déconnexion",
        body:
          "« Se déconnecter » révoque le jeton côté serveur (pas seulement en local) : un mot de passe changé + une déconnexion = ancien appareil bloqué immédiatement.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Puis-je avoir deux comptes (boutique et maison) ?",
        a: "Chaque établissement a son compte. Pour un même compte, l'usage (hotspot / foyer) se choisit à l'inscription et module les menus — le propriétaire d'un réseau familial voit la console « foyer », plus courte.",
      },
      {
        q: "Combien de gérants puis-je inviter ?",
        a: "Selon votre formule d'abonnement (Paramètres → Abonnement). Les invitations se gèrent dans Paramètres → Équipe, avec révocation immédiate.",
      },
      {
        q: "La console fonctionne-t-elle sans Internet ?",
        a: "Les vues déjà consultées restent consultables en cache PWA, mais toute action (déconnecter une session, générer un lot) requiert le réseau — le routeur, lui, continue de faire payer le hotspot même coupé du cloud.",
      },
    ],
    related: ["connecter-routeur-agent", "equipe", "securite-2fa"],
  },

  {
    id: "connecter-routeur-agent",
    title: "Connecter votre premier routeur MikroTik (mode Agent)",
    summary:
      "Aucune adresse IP publique, aucun port à ouvrir : le routeur appelle 403Shield tout seul, toutes les 45 secondes. Derrière l'Internet Orange CI, en CGNAT ou en Starlink, l'installation tient en 30 secondes.",
    roles: "Propriétaire · Gérant",
    minutes: 6,
    updated: "2026-10-12",
    sectionId: "demarrer",
    vague: "V1",
    quoi:
      "Le « mode Agent » est la façon standard de raccorder un routeur MikroTik à 403Shield : un petit script installé sur le routeur établit la connexion VERS le cloud, uniquement en sortant (HTTPS sortant, TLS vérifié). Le cloud ne se connecte jamais à votre routeur.\n\nLe script survit aux redémarrages (scheduler RouterOS) : débranchez le routeur, il revient « En ligne » tout seul dès que le réseau revient. À chaque check-in (45 s en activité, 240 s en veille — le pas est décidé par le cloud), le routeur remonte son état et reçoit jusqu'à 10 commandes en attente (file FIFO priorisée : actions d'abord, lectures d'état ensuite).",
    difference: [
      {
        with: "Le mode Réel (LAN)",
        body:
          "Le mode Réel connecte le cloud AU routeur via l'API RouterOS (IP + port ouverts). Réservé aux tests sur votre réseau local — inutile en production derrière un FAI domestique.",
      },
      {
        with: "Le mode Simulé",
        body:
          "Routeur virtuel pour découvrir la console sans matériel. Aucun client réel ne s'y connecte.",
      },
      {
        with: "L'import",
        body:
          "« Importer les données du routeur » reprend profils et utilisateurs d'un routeur DÉJÀ raccordé — ce n'est pas une façon de connecter, c'est une migration (menu ⋯ de la fiche routeur).",
      },
      {
        with: "Le renfort WireGuard (routeur)",
        body:
          "Le renfort WG est un tunnel optionnel entre le routeur et le cloud (deuxième chemin, clé privée qui ne quitte jamais le routeur). Il se pose APRÈS le mode Agent, jamais à la place.",
      },
    ],
    recoit: [
      "Le routeur reçoit : un script d'installation (.rsc) + un token d'agent (affiché une seule fois, jamais stocké en clair côté serveur, haché).",
      "Le cloud reçoit : l'identité du routeur (modèle, version RouterOS, uptime, interfaces, débits) à chaque check-in.",
      "La console reçoit : le statut temps réel — « En ligne · vu il y a X s », le trafic par interface, la liste des sessions, et les commandes passent dans l'autre sens (kick, profils, walled-garden, protections…).",
      "Le routeur télécharge aussi sa page de portail captif personnalisée (votre marque) depuis le cloud.",
    ],
    etapes: [
      {
        title: "Routeurs → Ajouter un routeur",
        body:
          "Dans la console, ouvrez Infrastructure → Routeurs puis « Ajouter un routeur ». Choisissez « Agent 403Shield (recommandé) » : seul le nom est requis. Renseignez éventuellement l'URL de connexion hotspot (page de login MikroTik, ex. http://192.168.88.1/login) pour que les QR des vouchers ouvrent la page avec le code pré-rempli.",
        capture: cap(
          "infrastructure/router-add.png",
          1440,
          900,
          "Dialogue « Ajouter un routeur » : nom, mode Agent 403Shield recommandé, URL de connexion hotspot pour les QR codes",
          "Le dialogue de création — mode Agent sélectionné.",
        ),
        tip: "L'URL de connexion peut rester vide : le QR contiendra alors le code en texte clair. Vous pourrez la renseigner plus tard via « Modifier ».",
      },
      {
        title: "Générer puis copier le script",
        body:
          "Cliquez « Créer et générer le script » : le script d'installation .rsc s'affiche avec son bouton Copier. Si vous perdez ce script, le menu ⋯ de la fiche routeur → « Script d'installation » le régénère — mais un NOUVEAU token est créé et l'ancien agent cesse de fonctionner (un routeur = un agent actif).",
        capture: cap(
          "infrastructure/router-script.png",
          1440,
          1445,
          "Dialogue « Script d'installation — ProMax WIFI » : script .rsc prêt à copier, avec la note de sécurité du token agent",
          "Le script d'installation — note : le token agent n'est jamais stocké en clair.",
        ),
      },
      {
        title: "Winbox → New Terminal → coller",
        body:
          "Sur le routeur : ouvrez Winbox, menu New Terminal. Collez le script (clic droit → Paste) et appuyez sur Entrée. L'exécution est silencieuse : le scheduler d'agent est posé, le routeur effectue son premier check-in dans la seconde.\n\nCette étape se fait sur le routeur (Winbox), pas dans 403Shield — comptez 30 secondes en tout.",
      },
      {
        title: "Vérifiez « En ligne » dans la console",
        body:
          "Revenez sur Routeurs : au premier check-in (≤ 45 s), la carte du routeur passe au vert « En ligne · vu il y a X s ». La fiche complète (bouton sur la carte) montre le mode Agent, le modèle RouterOS et l'uptime.",
        capture: cap(
          "infrastructure/routers.png",
          1440,
          900,
          "Liste des routeurs MikroTik : carte du routeur ProMax WIFI avec statut en ligne",
          "Le parc routeurs — le premier check-in confirme le raccordement.",
        ),
      },
      {
        title: "Explorez la fiche routeur",
        body:
          "Cliquez sur la carte pour ouvrir la fiche : débits en temps réel par interface, onglets Trafic / QoS / IP Bindings / Outils / Système, bouton « Tester la connexion », et le menu ⋯ (import de données, réparation du walled-garden, script, modification, suppression).",
        capture: cap(
          "infrastructure/router-fiche.png",
          1440,
          1445,
          "Fiche routeur ProMax WIFI : graphique de débits temps réel, tableau des interfaces, onglets Trafic, QoS, IP Bindings, Outils, Système",
          "La fiche routeur — supervision et outils au même endroit.",
        ),
        tip: "« Tester la connexion » force un check-in immédiat au lieu d'attendre le prochain cycle de 45 s.",
      },
      {
        title: "Test de bout en bout",
        body:
          "Générez 3 vouchers « 1 Heure » (guide Vouchers) : ils apparaissent sur le routeur au check-in suivant. Un client se connecte au hotspot et saisit son code → sa session remonte dans Supervision → Sessions. Le circuit est fermé : console → routeur → client → console.",
      },
    ],
    usages: [
      {
        title: "Cybercafé derrière Orange CI",
        body:
          "Pas d'IP publique, CGNAT : l'agent passe, car tout est sortant. C'est LE cas d'usage d'Abidjan.",
      },
      {
        title: "Starlink / zones rurales",
        body:
          "Même principe : le routeur appelle, personne n'a besoin de le joindre.",
      },
      {
        title: "Multi-sites",
        body:
          "Répétez l'opération par site — chaque routeur porte son site, la comptabilité ventile toute seule (voir le guide Sites).",
      },
    ],
    pieges: [
      {
        title: "RouterOS antérieur à 7.19",
        body:
          "La validation TLS stricte échoue (certificats racine absents). Mettez à jour RouterOS (possible depuis la console, fiche routeur ou flotte) — le cloud refuse l'inscription sinon.",
        severity: "warn",
      },
      {
        title: "« Hors ligne » ≠ panne 403Shield",
        body:
          "Routeur débranché, coupure Internet ou veille prolongée : il revient « En ligne » tout seul. Vérifiez l'horodatage « vu il y a X s » avant de conclure.",
        severity: "info",
      },
      {
        title: "Ré générer le script coupe l'ancien agent",
        body:
          "Chaque régénération crée un token neuf. Si le routeur tourne avec l'ancien script, il sera rejeté : recollez le NOUVEAU script sur le routeur.",
        severity: "warn",
      },
      {
        title: "check-in échoue (reseau ?) dans le log RouterOS",
        body:
          "Blocage HTTPS sortant (port 443 fermé, proxy, firmware ancien). Testez depuis un navigateur sur le routeur (fetch url=…) pour isoler.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Mon FAI me donne une IP dynamique, ça marche ?",
        a: "Oui — c'est même le cas standard : l'agent n'a besoin d'aucune IP fixe, ni entrante, ni sortante.",
      },
      {
        q: "Puis-je piloter plusieurs routeurs depuis un seul compte ?",
        a: "Oui, selon votre formule (le nombre de routeurs est plafonné par l'abonnement — la console vous l'indique à la création d'un routeur supplémentaire).",
      },
      {
        q: "Que se passe-t-il si le cloud est injoignable ?",
        a: "Le hotspot continue de fonctionner sur le routeur (les vouchers déjà installés restent valables) ; seules les commandes distantes et la remontée d'état sont suspendues jusqu'au retour du réseau.",
      },
    ],
    related: ["premiere-vente", "parc-routeurs", "portail-captif"],
  },

  {
    id: "premiere-vente",
    title: "Vendre votre premier accès Wi-Fi (de A à Z)",
    summary:
      "Le circuit commercial complet en une lecture : fixer un tarif (profil), générer un lot de tickets, les imprimer, puis regarder la session du client apparaître — et encaisser.",
    roles: "Propriétaire · Gérant",
    minutes: 7,
    updated: "2026-10-12",
    sectionId: "demarrer",
    vague: "V1",
    quoi:
      "Vendre une connexion 403Shield, c'est un circuit en 4 temps : un PROFIL (le tarif : durée, vitesse, prix), un LOT de VOUCHERS (les codes-temps imprimables), la CONNEXION du client (il saisit son code sur le portail captif), et la SESSION (sa consommation, visible et contrôlable depuis la console).\n\nL'argent peut être encaissé en espèces au comptoir, par le revendeur en Mode Vente, ou en ligne via la page publique — la comptabilité suit tout.",
    difference: [
      {
        with: "Le WiFi jetable",
        body:
          "Le voucher se VEND (code payant, durée fixée par le profil). Le WiFi jetable s'OFFRE (code gratuit à quota, pour l'accueil / la terrasse). Deux mécaniques distinctes — voir le guide dédié.",
      },
      {
        with: "Le compte utilisateur",
        body:
          "Un utilisateur possède un identifiant permanent avec du solde (abonné) ; un voucher est JETABLE : code unique, durée fixe, sans compte.",
      },
      {
        with: "L'abonné PPPoE",
        body:
          "Le client PPPoE paie un abonnement mensuel et se connecte sur la même box avec identifiant/mot de passe fixes — segment FAI/WISP, guide dédié.",
      },
    ],
    recoit: [
      "Vous recevez : un lot numéroté de tickets imprimables (avec QR), un débit de votre crédit vendeur proportionnel à la valeur du lot, et chaque vente trace une entrée en comptabilité.",
      "Le client reçoit : un ticket avec code + QR ; en scannant, la page de connexion s'ouvre avec le code pré-rempli.",
      "La console reçoit : chaque connexion en session active (code, forfait, IP, MAC, débits), jusqu'à expiration ou déconnexion.",
    ],
    etapes: [
      {
        title: "Fixez le tarif dans Profils",
        body:
          "Hotspot → Profils : c'est votre grille tarifaire. Par défaut ProMax WIFI vend par exemple 1-HEURE à 100 FCFA, 24-HEURES à 300 FCFA, 7-JOURES à 1 000 FCFA, 30-JOURES à 3 000 FCFA. Chaque profil porte durée, prix, vitesse (limite de débit) et options de partage.\n\nCréez ou ajustez vos profils AVANT de générer : un lot adopte le tarif du profil au moment de sa création.",
        capture: cap(
          "hotspot/profiles.png",
          1440,
          1142,
          "Vue Profils : liste des forfaits avec prix en FCFA, durée, vitesse et quotas",
          "La grille tarifaire — chaque profil est un forfait vendable.",
        ),
      },
      {
        title: "Générez le lot (assistant 3 étapes)",
        body:
          "Hotspot → Vouchers → « Générer des vouchers ». Étape 1 : choisissez le forfait, la quantité (raccourcis 10/25/50/100/200) et le routeur cible. Étape 2 : l'échantillon de codes s'affiche — regénérez-le si la forme ne vous plaît pas, ou dépliez « Limites avancées » (parité Mikhmon : partage d'utilisation, etc.). Étape 3 : le récapitulatif résume forfait × quantité = valeur du lot.",
        capture: cap(
          "hotspot/vouchers-wizard-1.png",
          1440,
          900,
          "Assistant de génération, étape 1 : choix du forfait, quantité et routeur cible",
          "Étape 1/3 — forfait, quantité, routeur.",
        ),
        tip: "Les mots de passe des vouchers sont masqués à l'écran (points) : ils n'apparaissent en clair qu'à l'impression — personne ne peut les lire par-dessus votre épaule.",
      },
      {
        title: "Vérifiez les codes (étape 2)",
        body:
          "L'échantillon propose des codes du style « 8VNNU3 ». « Autre échantillon » relance le tirage jusqu'à satisfaction. Les limites avancées couvrent les cas Mikhmon (nombre d'utilisateurs simultanés du même code, etc.).",
        capture: cap(
          "hotspot/vouchers-wizard-2.png",
          1440,
          900,
          "Assistant de génération, étape 2 : échantillon de codes, limites avancées, retour et continuer",
          "Étape 2/3 — l'échantillon de codes.",
        ),
      },
      {
        title: "Validez le récapitulatif (étape 3)",
        body:
          "Le récap indique la valeur totale du lot : la génération débite votre crédit vendeur (selon la formule). « Générer 10 tickets » exécute : le lot est créé, numéroté, prêt à imprimer — et part vers le routeur au check-in suivant (≤ 45 s).",
        capture: cap(
          "hotspot/vouchers-wizard-3.png",
          1440,
          900,
          "Assistant de génération, étape 3 : récapitulatif et bouton Générer 10 tickets",
          "Étape 3/3 — le récapitulatif avant exécution.",
        ),
      },
      {
        title: "Imprimez les tickets",
        body:
          "Dans Vouchers, chaque lot propose l'impression (dialogue d'impression par lot, avec choix du modèle de ticket — voir Paramètres → Modèles). Le QR du ticket ouvre la page de connexion avec le code pré-rempli si l'URL hotspot a été renseignée sur le routeur. « Réimpression rapide » ressort un lot déjà vendu.",
        capture: cap(
          "hotspot/vouchers.png",
          1440,
          1260,
          "Vue Vouchers : tableau des codes avec statuts, recherche et filtres par statut et détenteur",
          "Le stock de vouchers — statuts et filtres par détenteur.",
        ),
      },
      {
        title: "Le client se connecte → sa session apparaît",
        body:
          "Le client capte le WiFi, la page du portail s'ouvre (ou il scanne le QR), il saisit son code : la session démarre. Dans Supervision → Sessions, elle apparaît avec code, forfait, IP, MAC et débits cumulés. Cliquez sur une session pour le détail (durée, volumes, routeur) et « Déconnecter » si besoin.",
        capture: cap(
          "supervision/session-detail.png",
          1440,
          900,
          "Détail d'une session active : code, forfait, adresse IP, MAC, volumes reçus et émis, bouton déconnecter",
          "Le détail de session — le client est en ligne, vous avez la main.",
        ),
      },
      {
        title: "Encaissez et suivez la marge",
        body:
          "L'argent en espèces au comptoir se note simplement ; le rapport de marge (Analyse → Rapports → Marge) confronte automatiquement la valeur des tickets VENDUS à vos coûts. Les tickets non vendus expirent avec le lot — aucune fausse richesse en comptabilité.",
        tip: "Pour vendre sans ordinateur (kiosque, terrain), remettez un lot à un revendeur et laissez-le vendre en Mode Vente — voir le guide Revendeurs.",
      },
    ],
    usages: [
      {
        title: "Le kiosque de quartier",
        body:
          "Lot de 100 tickets « 1 Heure » le matin, vente à 100 FCFA pièce : la barre de vie du lot dans l'onglet Vouchers montre ce qui reste sans compter les stocks papier.",
      },
      {
        title: "L'hôtel",
        body:
          "Lot « 24-HEURES » remis à la réception, chaque client reçoit un ticket à l'arrivée — le QR rend la connexion quasi automatique.",
      },
      {
        title: "Le cybercafé",
        body:
          "Vendez par tranche horaire, couplé au module Cybercafé pour les postes câblés (guide dédié).",
      },
    ],
    pieges: [
      {
        title: "Le lot adopte le tarif AU MOMENT de la génération",
        body:
          "Modifier le profil ensuite ne change PAS les lots déjà générés. Pour changer un tarif, modifiez le profil puis générez un nouveau lot.",
        severity: "info",
      },
      {
        title: "Crédit vendeur insuffisant",
        body:
          "La génération est refusée si le crédit ne couvre pas la valeur du lot (selon formule). Rechargez via Paramètres → Abonnement ou confiez la vente à un revendeur crédité.",
        severity: "warn",
      },
      {
        title: "Ticket imprimé ≠ ticket vendu",
        body:
          "La comptabilité compte la VENTE (première utilisation), pas l'impression. Un lot imprimé mais invendu n'empaume pas la marge.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Un client perd son ticket, que faire ?",
        a: "Retrouvez son code dans Vouchers (recherche par statut « non utilisé » et détenteur), réimprimez-le via « Réimpression rapide ». Le code reste valable.",
      },
      {
        q: "Puis-je limiter la vitesse des tickets 1 heure ?",
        a: "Oui : la limite de débit se règle sur le PROFIL, pas sur le voucher — tous les tickets du profil en héritent.",
      },
      {
        q: "Le client peut-il partager son code ?",
        a: "Par défaut, un code = une session à la fois ; les « limites avancées » de l'étape 2 permettent d'autoriser (ou non) le partage simultané.",
      },
    ],
    related: ["vouchers-lots", "profils-forfaits", "revendeurs", "sessions-actives"],
  },
];
