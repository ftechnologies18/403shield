// Section « Supervision » — 3 guides (N°304).
import type { Guide } from "../types";
import { cap } from "../cap";

export const SUPERVISION_GUIDES: Guide[] = [
  {
    id: "tableau-de-bord",
    title: "Lire le tableau de bord",
    summary:
      "Les chiffres qui comptent dès l'ouverture : sessions en cours, routeurs en ligne, ventes du jour, alertes protection — et où creuser quand un chiffre bouge.",
    roles: "Propriétaire · Gérant",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "supervision",
    vague: "V1",
    quoi:
      "Le tableau de bord (Supervision → Tableau de bord) est la page d'accueil de la console : statistiques vitales, sessions actives, revenus, activité récente et état des routeurs, condensés sur un écran. Il se rafraîchit automatiquement (données cadencées par les check-ins agent, ≤ 45 s) — le bouton « Actualiser » de la barre supérieure force une resynchronisation immédiate.\n\nChaque tuile est cliquable et mène à la vue détaillée correspondante : le tableau de bord est une table des matières chiffrée, pas une impasse.",
    difference: [
      {
        with: "Rapports (Analyse)",
        body:
          "Le tableau de bord regarde le PRÉSENT (maintenant, aujourd'hui) ; les rapports consolident l'HISTORIQUE (semaine, mois, année, archives comptables).",
      },
      {
        with: "La cloche de notifications",
        body:
          "La cloche (barre supérieure) liste les ÉVÉNEMENTS (alertes, demandes, annonces) ; le tableau de bord montre l'ÉTAT. Les deux se complètent.",
      },
      {
        with: "Le journal d'activité",
        body:
          "Le journal trace les ACTIONS humaines (qui a fait quoi) ; le tableau de bord mesure les données machine (sessions, trafic, ventes).",
      },
    ],
    recoit: [
      "Le décompte des sessions actives (badge live également visible dans la sidebar, sur le lien « Sessions actives »).",
      "La santé du parc : routeurs en ligne / hors ligne, vu il y a combien de secondes.",
      "Les indicateurs du jour : ventes, valeur, nouveaux comptes, et l'activité récente (dernières connexions, paiements).",
      "Les bandeaux d'état globaux : annonces en cours, mode dégradé éventuel (bandeau persistence), abonnement expiré (bandeau read-only).",
    ],
    etapes: [
      {
        title: "Ouvrez Supervision → Tableau de bord",
        body:
          "C'est la vue d'accueil après connexion. Les cartes du haut donnent les grandeurs clés ; les listes en dessous donnent le flux (sessions récentes, ventes, alertes). Faites défiler : tout tient sur une à deux hauteurs d'écran.",
        capture: cap(
          "supervision/tableau-de-bord.png",
          1440,
          2452,
          "Tableau de bord complet : cartes de statistiques, sessions actives, routeurs, revenus du jour et activité récente",
          "Le tableau de bord — page d'atterrissage de la console.",
        ),
      },
      {
        title: "Lisez les cartes vitales dans l'ordre",
        body:
          "Ordre de lecture conseillé en exploitation : (1) sessions actives — la charge réseau du moment ; (2) routeurs en ligne — si un routeur est rouge, tout le reste est suspect ; (3) ventes du jour — la caisse ; (4) alertes protection — les incidents. Les compteurs sont rafraîchis automatiquement.",
      },
      {
        title: "Cliquez une tuile pour creuser",
        body:
          "Chaque carte pointe vers sa vue : les sessions ouvrent Supervision → Sessions, les ventes ouvrent Rapports, un routeur ouvre sa fiche. Le tableau de bord n'est jamais un cul-de-sac.",
        tip: "Le badge « Sessions actives » dans la barre latérale (ex. « 137 ») est votre coup d'œil permanent sans quitter la vue courante.",
      },
      {
        title: "Sur mobile, même tableau dans la poche",
        body:
          "Installez la PWA (guide Premiers pas) : le tableau de bord s'ouvre en plein écran depuis l'écran d'accueil du téléphone — pratique pour vérifier la soirée sans passer au comptoir.",
        capture: cap(
          "annexes/mobile-dashboard.png",
          390,
          844,
          "Tableau de bord 403Shield sur téléphone mobile",
          "Le tableau de bord sur mobile.",
        ),
      },
    ],
    usages: [
      {
        title: "L'ouverture du comptoir",
        body:
          "30 secondes chaque matin : routeur vert, sessions résiduelles de la nuit, ventes d'hier soldées. Une anomalie se voit avant le premier café.",
      },
      {
        title: "La clôture de caisse",
        body:
          "La tuile ventes du jour confrontée à la caisse papier ; l'écart éventuel se règle par le rapport de marge (Analyse → Rapports).",
      },
    ],
    pieges: [
      {
        title: "Chiffres figés ? Vérifiez le routeur d'abord",
        body:
          "Si les sessions ne bougent plus, c'est presque toujours le routeur hors ligne (coupure courant/Internet) : les données arrivent par ses check-ins. Le statut routeur en dit plus qu'un rafraîchissement forcé.",
        severity: "info",
      },
      {
        title: "Le bandeau « mode dégradé » n'est pas une panne",
        body:
          "Il signale une écriture différée (réseau instable) : les données reprennent au retour du réseau — les commandes passent en file, rien ne se perd.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Le tableau de bord compte-t-il les sessions du mois ?",
        a: "Non — c'est la vue « maintenant / aujourd'hui ». Pour les cumuls, ouvrez Analyse → Rapports (onglets Semaine / Mois / Année).",
      },
      {
        q: "Puis-je changer l'ordre des cartes ?",
        a: "Pas encore : l'ordre est pensé par priorité d'exploitation (charge, parc, caisse, sécurité).",
      },
    ],
    related: ["sessions-actives", "rapports-comptabilite", "parc-routeurs"],
  },

  {
    id: "sessions-actives",
    title: "Surveiller et déconnecter les sessions actives",
    summary:
      "Qui est en ligne, sur quel routeur, depuis quand, avec quels volumes — et comment couper proprement une session (kick) en un clic.",
    roles: "Propriétaire · Gérant",
    minutes: 4,
    updated: "2026-10-18",
    sectionId: "supervision",
    vague: "V1",
    quoi:
      "Supervision → Sessions liste en direct les connexions WiFi en cours : code ou compte utilisé, forfait, adresse IP et MAC, routeur, durée, volumes reçus/émis. La vue est rafraîchie par les read_state de l'agent (cadence ~2 min paginé, ou immédiate après action).\n\nLa déconnexion (kick) envoie une commande prioritaire dans la file agent : le client est coupé au check-in suivant — au plus 45 s. C'est l'outil du quotidien pour gérer les abus (code partagé, poste oublié, client difficile).",
    difference: [
      {
        with: "Les utilisateurs (Personnes)",
        body:
          "Une session est un ÉPISODE (code jetable ou compte, en cours) ; un utilisateur est une IDENTITÉ permanente. Une session se coupe, un compte se suspend.",
      },
      {
        with: "La déconnexion du portail",
        body:
          "Le client peut se déconnecter lui-même depuis la page du portail ; le kick agit depuis la console, sans coopération du client.",
      },
      {
        with: "La déconnexion manuelle du routeur",
        body:
          "Un appareil peut aussi être coupé depuis la fiche du routeur (l'agent applique la règle au prochain passage) ; le kick de session agit immédiatement, depuis la console, sans toucher au routeur.",
      },
    ],
    recoit: [
      "La table temps réel : code/identifiant, forfait, IP, MAC, routeur, uptime, volumes Rx/Tx — avec recherche et filtres.",
      "Le badge compteur dans la sidebar (nombre de sessions actives, mis à jour en continu).",
      "Le détail par session (dialogue) : chronologie, volumes, routeur, bouton « Déconnecter ».",
      "Le trafic temps réel par interface depuis la fiche du routeur (vue Trafic) pour croiser charge réseau et sessions.",
    ],
    etapes: [
      {
        title: "Ouvrez Supervision → Sessions actives",
        body:
          "La table affiche toutes les sessions en cours, toutes antennes confondues. Les colonnes clés : le code (ex. « 8VNNU3 »), le forfait (ex. « 30-JOURES »), l'IP/MAC, et les volumes — repérez les gros consommateurs d'un coup d'œil (téléchargements, streaming).",
        capture: cap(
          "supervision/sessions.png",
          1440,
          1054,
          "Vue Sessions actives : tableau des sessions avec code, forfait, adresse IP, MAC, routeur, durée et volumes",
          "Les sessions en cours — recherche et tri inclus.",
        ),
      },
      {
        title: "Filtrez pour trouver un client",
        body:
          "Utilisez la recherche (code, MAC, IP) ou les filtres par routeur/forfait. Cas typique : « qui consomme la ligne ? » — triez par volume décroissant, la session incriminée saute aux yeux.",
      },
      {
        title: "Ouvrez le détail d'une session",
        body:
          "Cliquez « Voir les détails » sur une ligne : le dialogue montre la fiche complète de la connexion — identité, forfait, équipement (MAC), adresse, volumes, routeur et durée. C'est votre preuve en cas de litige (« je n'étais pas connecté » ne tient pas devant la MAC et l'IP).",
        capture: cap(
          "supervision/session-detail.png",
          1440,
          900,
          "Dialogue de détail d'une session : code 8VNNU3, forfait, IP, MAC, volumes et bouton Déconnecter",
          "Le détail de session — tout ce qu'il faut savoir avant de trancher.",
        ),
      },
      {
        title: "Déconnectez (kick) si nécessaire",
        body:
          "Le bouton « Déconnecter » coupe la session : la commande part en priorité dans la file agent, le client est déconnecté dans la seconde qui suit le check-in. Le code d'un voucher kické reste utilisable jusqu'à épuisement de son temps (sauf limites du profil) — pour bloquer un code définitivement, révoquez-le depuis Vouchers.",
        tip: "Kick ≠ bannissement. Pour exclure durablement un appareil, combinez : révoquer le code + signaler la MAC à la protection (guide Protection).",
      },
    ],
    usages: [
      {
        title: "Gérer la pointe du soir",
        body:
          "À 20 h, la table se remplit : un tri par volume révèle les 2-3 sessions qui tirent toute la bande passante — un kick négocié et tout le monde respire.",
      },
      {
        title: "Contrôle comptoir",
        body:
          "Un client affirme avoir payé mais n'arrive pas à se connecter : cherchez sa session par code — si elle n'existe pas, le problème est en amont (ticket non scanné, code expiré).",
      },
    ],
    pieges: [
      {
        title: "Kick = jusqu'à 45 s d'attente",
        body:
          "La commande part au check-in suivant. En urgence absolue, « Tester la connexion » (fiche routeur) force un check-in immédiat.",
        severity: "info",
      },
      {
        title: "Les sessions fantômes",
        body:
          "Une session peut rester affichée ~2 min après une coupure sauvage (client qui s'éloigne) : l'état du routeur fait foi au prochain read_state.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Puis-je limiter le débit d'une session en cours ?",
        a: "Le débit suit le PROFIL du voucher, modifiable pour les FUTURS lots. Pour un freinage immédiat et global, utilisez la QoS du routeur (fiche routeur → QoS).",
      },
      {
        q: "Combien de temps garde-t-on l'historique des sessions ?",
        a: "Les sessions terminées alimentent les rapports (activité, marge) ; le détail fin est purgé au bout d'une rétention fixée (les rapports conservent les agrégats).",
      },
    ],
    related: ["tableau-de-bord", "vouchers-lots", "protection"],
  },

  {
    id: "protection",
    title: "Protéger le réseau (SafeWiFi, Shield, FamilyGuard, AntiVPN)",
    summary:
      "Les 4 boucliers 403Shield posés sur le routeur : filtrage des contenus, anti-piratage, couvre-feu familial et blocage des VPN — activation, portée et limites.",
    roles: "Propriétaire · Gérant",
    minutes: 5,
    updated: "2026-10-18",
    sectionId: "supervision",
    vague: "V2",
    quoi:
      "Supervision → Protection concentre les 4 boucliers de 403Shield. Ils se posent sur le routeur via l'agent (règles pare-feu, DNS filtrant, scheduler) — donc actifs MÊME pour les clients du hotspot, et administrables à distance.\n\nSafeWiFi filtre les contenus (DNS catégorisé) ; Shield durcit le routeur contre les attaques (ports, brute-force, scans) ; FamilyGuard applique un couvre-feu et un filtrage renforcé sur des appareils désignés (typiquement la tablette des enfants ou l'écran du comptoir) ; AntiVPN empêche les clients de masquer leur trafic avec un VPN (équité de bande et conformité).",
    difference: [
      {
        with: "La QoS du routeur",
        body:
          "La QoS règle les DÉBITS (priorités, limites) ; les protections règlent l'ACCÈS et la SÉCURITÉ (contenus, attaques, horaires). Les deux vivent dans la fiche routeur / la vue Protection sans se marcher dessus.",
      },
      {
        with: "FamilyGuard et le hotspot",
        body:
          "FamilyGuard cible les APPAREILS nommés (une tablette, une console, l'écran du comptoir). Sur un hotspot public, SafeWiFi + Shield + AntiVPN suffisent la plupart du temps.",
      },
      {
        with: "Le filtrage du portail",
        body:
          "Le walled-garden du portail limite ce qui est accessible AVANT connexion ; les protections agissent APRÈS connexion.",
      },
    ],
    recoit: [
      "Chaque bouclier activé reçoit : des règles pare-feu et/ou DNS posées sur le routeur concerné, visibles comme contrôlables depuis la console, avec état (actif / inactif) par routeur.",
      "Vous recevez des alertes de blocage dans la cloche et le journal (tentatives d'attaque bloquées, VPN détecté, etc.).",
      "Shield inclut la réparation automatique du walled-garden et le durcissement des accès distants du routeur.",
      "AntiVPN couvre les protocoles courants de tunnelisation — un client qui tente de contourner est coupé.",
    ],
    etapes: [
      {
        title: "Ouvrez Supervision → Protection",
        body:
          "La vue présente une carte par bouclier avec son état global et son périmètre (routeurs couverts). Les modules optionnels s'activent ici ; les modules déjà actifs montrent leurs statistiques de blocage.",
        capture: cap(
          "supervision/protection.png",
          1440,
          1228,
          "Vue Protection : cartes des boucliers SafeWiFi, Shield, FamilyGuard et AntiVPN avec états et statistiques",
          "Les 4 boucliers — un contrôle, quatre protections.",
        ),
      },
      {
        title: "Activez SafeWiFi (filtrage des contenus)",
        body:
          "Choisissez le niveau de filtrage adapté à votre établissement. Le DNS filtrant s'applique au routeur entier : contenus adultes, jeux d'argent, malware… Les catégories bloquées alimentent les statistiques de la carte.",
        tip: "Pour un établissement scolaire, combinez SafeWiFi niveau strict + FamilyGuard sur les postes des mineurs.",
      },
      {
        title: "Activez Shield (durcissement du routeur)",
        body:
          "Shield verrouille l'admin distante du routeur, bloque le brute-force et répare le walled-garden automatiquement (le watcher agent vérifie la cohérence à chaque cycle). Activez-le sur TOUT parc en production.",
      },
      {
        title: "AntiVPN : l'équité de bande",
        body:
          "Sur un hotspot payant, l'AntiVPN empêche un acheteur de temps de le partager depuis chez lui via VPN, et évite qu'un contournement masque un usage abusif. Les tentatives remontent dans le journal — un client récidiviste se repère à la MAC.",
      },
      {
        title: "FamilyGuard (appareils désignés)",
        body:
          "Désignez les appareils à encadrer (MAC), posez le couvre-feu (heures sans Internet) et le filtrage renforcé. Les appareils hors couvre-feu continuent normalement — seuls les visés sont bridés.",
      },
    ],
    usages: [
      {
        title: "École / centre de formation",
        body:
          "SafeWiFi strict + FamilyGuard sur les salles : Internet pédagogique, pas de distraction nocturne.",
      },
      {
        title: "Hôtel / résidence",
        body:
          "Shield + AntiVPN : le WiFi reste rapide pour tous et le routeur ne devient pas une porte ouverte.",
      },
      {
        title: "Cybercafé",
        body:
          "AntiVPN évite qu'un client installe un tunnel pour bunkeriser un poste loué à l'heure.",
      },
    ],
    pieges: [
      {
        title: "Protection = périmètre routeur",
        body:
          "Les boucliers protègent le réseau DU routeur concerné. Un deuxième routeur non protégé est une porte ouverte : vérifiez l'état par routeur dans les cartes.",
        severity: "warn",
      },
      {
        title: "AntiVPN peut heurter des usages légitimes",
        body:
          "Certains clients d'affaires utilisent un VPN professionnel. Sur un établissement pro, testez l'activation et écoutez la clientèle avant de l'imposer.",
        severity: "info",
      },
      {
        title: "Un bouclier désactivé par une mise à jour RouterOS",
        body:
          "Le watcher agent répare automatiquement (walled-garden, règles clés) ; en cas de doute, rouvrez la carte du bouclier — l'état réel du routeur est toujours remonté.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Les protections coupent-elles Internet des clients payants ?",
        a: "Non : elles filtrent les contenus et les attaques, pas l'accès payant. Seuls les contenus bloqués (selon niveau SafeWiFi) et les tentatives de contournement sont affectés.",
      },
      {
        q: "Puis-je protéger un seul routeur d'un parc ?",
        a: "Oui, l'activation est par routeur — pratique pour protéger d'abord le site principal.",
      },
    ],
    related: ["parc-routeurs", "outils-routeur", "tableau-de-bord"],
  },
];
