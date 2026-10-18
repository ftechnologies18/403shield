// Section « Analyse & audit » — 2 guides (N°304).
import type { Guide } from "../types";
import { cap } from "../cap";

export const ANALYSE_GUIDES: Guide[] = [
  {
    id: "rapports-comptabilite",
    title: "Rapports & comptabilité",
    summary:
      "Cinq onglets pour piloter l'exploitation : Aperçu, Comptabilité (journaux), Activité, Marge et Archives — avec les périodes Aujourd'hui / Semaine / Mois / Année.",
    roles: "Propriétaire · Gérant",
    minutes: 5,
    updated: "2026-10-12",
    sectionId: "analyse",
    vague: "V1",
    quoi:
      "Analyse → Rapports est le poste de pilotage chiffré : l'onglet APERÇU donne les indicateurs de période (ventes, sessions, comptes), COMPTABILITÉ tient les journaux (journaux mensuels, lignes de caisse — exportables), ACTIVITÉ retrace le trafic et la vie du réseau, MARGE confronte revenus et coûts (rentabilité réelle par forfait/site), et ARCHIVES conserve l'historique.\n\nLes périodes se coupent par tabs : Aujourd'hui, Semaine, Mois, Année — chaque onglet reprend la période sélectionnée.",
    difference: [
      {
        with: "Le tableau de bord",
        body:
          "Le tableau de bord vit au PRÉSENT (live) ; les rapports consolident l'HISTORIQUE (périodes, archives). Réflexe : le soir, les rapports ; dans la journée, le tableau de bord.",
      },
      {
        with: "Le journal d'activité",
        body:
          "Le journal (vue Journal) trace les actions/événements bruts ; les rapports les AGRÈGENT en indicateurs. Le journal pour l'investigation, les rapports pour la décision.",
      },
      {
        with: "La facturation 403Shield",
        body:
          "Les rapports mesurent VOTRE chiffre (clients) ; l'abonnement/facturation 403Shield (Paramètres → Abonnement) mesure VOTRE coût d'outil. La marge confronte les deux.",
      },
    ],
    recoit: [
      "L'onglet Aperçu : les grandeurs de période — ventes, valeur, sessions, nouveaux comptes, avec les courbes.",
      "L'onglet Comptabilité : journaux de caisse (mensuels et détaillés), lignes rapprochables (Wave/espèces/revendeurs) — base de votre comptabilité externe.",
      "L'onglet Activité : usage du réseau — sessions, volumes, heures chaudes (heatmap horaire), top clients.",
      "L'onglet Marge : revenus (tickets vendus, comptes, VPN) confrontés aux coûts (abonnement, crédit) — rentabilité par forfait et par site.",
      "L'onglet Archives : les périodes passées, consultables à froid (audit, contrôle).",
    ],
    etapes: [
      {
        title: "Ouvrez Analyse → Rapports (Aperçu)",
        body:
          "L'Aperçu répond aux questions du jour : combien de ventes, quelles sessions, quels nouveaux comptes — pour la période choisie (Aujourd'hui par défaut).",
        capture: cap(
          "analyse/reports.png",
          1440,
          1033,
          "Vue Rapports, onglet Aperçu : indicateurs de période avec les tabs Aujourd'hui, Semaine, Mois, Année",
          "L'Aperçu — les chiffres de la période.",
        ),
      },
      {
        title: "Choisissez la période",
        body:
          "Les tabs Aujourd'hui / Semaine / Mois / Année recoupent tout l'onglet actif. Le rythme conseillé : Aujourd'hui au comptoir, Semaine pour les commandes de stock (lots), Mois pour la marge, Année pour la stratégie.",
      },
      {
        title: "Tenez la Comptabilité",
        body:
          "L'onglet Comptabilité présente le journal mensuel : ventes détaillées, encaissements par canal (espèces, Wave, revendeurs), totaux par jour — à exporter pour votre comptable. Le journal mensuel verrouille le mois écoulé (cohérence audit).",
        capture: cap(
          "analyse/reports-compta.png",
          1440,
          900,
          "Onglet Comptabilité : journal des ventes et encaissements par canal",
          "La Comptabilité — le journal de caisse consolidé.",
        ),
      },
      {
        title: "Lisez l'Activité",
        body:
          "L'onglet Activité montre le réseau vivant : heures chaudes (la heatmap horaire révèle les pointes), volumes, top consommateurs — la matière première de vos décisions QoS et profils.",
        capture: cap(
          "analyse/reports-activite.png",
          1440,
          900,
          "Onglet Activité : usage du réseau, volumes et heures de pointe",
          "L'Activité — quand et comment le réseau est utilisé.",
        ),
      },
      {
        title: "Surveillez la Marge",
        body:
          "L'onglet Marge confronte vos revenus à vos coûts : rentabilité par forfait (le « 1 Heure » à 100 F est-il rentable bridé ?), par site, et globale. C'est l'onglet des décisions de grille tarifaire.",
        capture: cap(
          "analyse/reports-marge.png",
          1440,
          900,
          "Onglet Marge : revenus confrontés aux coûts, rentabilité par forfait et par site",
          "La Marge — la rentabilité réelle.",
        ),
      },
      {
        title: "Consultez les Archives",
        body:
          "L'onglet Archives garde les périodes closes : comparaisons mois par mois, justificatifs pour un contrôle — rien ne se perd, tout se retrouve.",
        tip: "Le journal mensuel + l'export comptabilité remplacent le cahier de caisse : rapprochez chaque fin de mois (5 minutes) et la compta externe n'est plus qu'une formalité.",
      },
    ],
    usages: [
      {
        title: "La gestion hebdomadaire",
        body:
          "Dimanche soir : Marge de la semaine + stock restant → les lots de la semaine (quantités, profils) se décident sur chiffres, pas au feeling.",
      },
      {
        title: "Le dialogue banque",
        body:
          "L'onglet Comptabilité mensuel exporté : votre dossier bancaire (crédit, compte pro) parle de revenus tracés, pas de recettes déclaratives.",
      },
      {
        title: "L'arbitrage tarifaire",
        body:
          "La Marge par forfait révèle les cow-boys (profil trop généreux) et les champions : ajustez la grille, mesurez le mois suivant — itération continue.",
      },
    ],
    pieges: [
      {
        title: "Ventes ≠ encaissements",
        body:
          "L'onglet Comptabilité rapproche les deux : un ticket vendu par revendeur n'est encaissé qu'au versement. Lisez les colonnes VENTES et ENCAISSÉS côte à côte.",
        severity: "info",
      },
      {
        title: "Le mois courant bouge",
        body:
          "Les chiffres du mois en cours sont vivants (journaux ouverts) ; les décisions sérieuses se prennent sur mois clos (Archives) pour éviter les faux sourires.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Puis-je exporter vers Excel ?",
        a: "Les tableaux comptables s'exportent (format tabulaire) — la structure est pensée pour le rapprochement comptable externe.",
      },
      {
        q: "Les rapports comptent-ils le WiFi jetable ?",
        a: "Le jetable est un coût marketing (pas un revenu) : il apparaît dans l'activité (sessions offertes) mais pas dans la marge comme revenu.",
      },
    ],
    related: ["tableau-de-bord", "revendeurs", "journal-activite"],
  },

  {
    id: "journal-activite",
    title: "Journal d'activité",
    summary:
      "La trace horodatée de tout ce qui se passe : connexions, commandes, alertes, actions d'équipe — l'outil d'investigation et d'audit.",
    roles: "Propriétaire · Gérant",
    minutes: 3,
    updated: "2026-10-18",
    sectionId: "analyse",
    vague: "V3",
    quoi:
      "Analyse → Journal liste chronologiquement les ÉVÉNEMENTS du compte : connexions clients, génération de lots, kicks, alertes protection, actions d'équipe (qui a fait quoi, quand), webhooks et paiements. Chaque entrée est horodatée et attribuée.\n\nC'est l'outil d'INVESTIGATION (« qui a déconnecté cette session ? pourquoi ce lot a-t-il été généré ? ») et la base d'AUDIT — le journal d'activité complète les rapports (agrégats) par le détail brut.",
    difference: [
      {
        with: "Les rapports",
        body:
          "Le journal = les FAITS bruts (une ligne par événement) ; les rapports = les agrégats (indicateurs de période). L'un répond « que s'est-il passé exactement », l'autre « où en est-on ».",
      },
      {
        with: "La cloche de notifications",
        body:
          "La cloche est le PASSÉ RÉCENT à lire (non lus) ; le journal est l'HISTORIQUE COMPLET à chercher. Le filtrage du journal reprend les types de la cloche.",
      },
      {
        with: "Les logs de routeur",
        body:
          "Les logs RouterOS (System → Logging, vus dans Winbox) sont la mémoire MATERIELLE ; le journal 403Shield est la mémoire MÉTIER (compte, équipe, commerce). Complémentaires.",
      },
    ],
    recoit: [
      "La chronologie complète : événements de vente (lots, ventes de tickets), réseau (sessions, kicks), sécurité (alertes protection, tentatives bloquées), équipe (connexions console, actions), système (webhooks, paiements, synchronisations).",
      "Les filtres par type/période + la recherche — retrouver UN événement précis prend des secondes.",
      "L'attribution : chaque action d'équipe porte son auteur (gérant/propriétaire) — la responsabilité est traçable.",
      "La rétention long terme alimente les archives (le détail fin suit une rétention plus courte que les agrégats des rapports).",
    ],
    etapes: [
      {
        title: "Ouvrez Analyse → Journal",
        body:
          "La liste chronologique démarre aux événements récents. Faites défiler ou filtrez par type — la densité est réelle (chaque connexion génère une ligne) : filtrez pour voir clair.",
        capture: cap(
          "analyse/logs.png",
          1440,
          1028,
          "Vue Journal : chronologie des événements du compte avec filtres",
          "Le Journal — la trace de tout.",
        ),
      },
      {
        title: "Filtrez pour investiguer",
        body:
          "Cas typique « qui a kické le client de 14 h ? » : filtrez sur les actions d'équipe autour de 14 h — l'auteur et l'heure exacte apparaissent. Idem pour retracer la génération d'un lot (valeur, opérateur).",
        tip: "Croisez avec la session concernée (vue Sessions / détail) : le journal donne le QUI/QUAND, le détail de session donne le QUOI (volumes, durée).",
      },
      {
        title: "Auditez les accès",
        body:
          "Les connexions console figurent dans le journal : un accès à une heure inhabituelle se repère immédiatement — combinez avec la 2FA (Paramètres → Sécurité) pour verrouiller.",
      },
    ],
    usages: [
      {
        title: "Litige client",
        body:
          "« J'ai payé, on m'a coupé » : le journal montre la vente, la session, le kick (s'il y en a un) et son auteur — les faits avant les mots.",
      },
      {
        title: "Contrôle de l'équipe",
        body:
          "Revue hebdomadaire des actions sensibles (générations, suppressions) : les anomalies de comportement se voient avant les anomalies de caisse.",
      },
    ],
    pieges: [
      {
        title: "Le journal n'est pas un rapport",
        body:
          "Compter les ventes ligne par ligne est un travail de rapports — le journal répond au DÉTAIL, pas au bilan.",
        severity: "info",
      },
      {
        title: "Rétention du détail",
        body:
          "Le détail événementiel suit une rétention de compte (les agrégats vivent dans les rapports/archives) : pour un litige ancien, commencez par les Archives.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Le journal peut-il prouver un litige ?",
        a: "Il fournit la trace interne horodatée (faite pour ça) — pour un cadre officiel, combinez avec le journal mensuel (Comptabilité) et les reçus de paiement.",
      },
    ],
    related: ["rapports-comptabilite", "securite-2fa", "sessions-actives"],
  },
];
