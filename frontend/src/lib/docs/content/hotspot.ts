// Section « Hotspot — vendre l'accès » — 6 guides (N°304).
import type { Guide } from "../types";
import { cap } from "../cap";

export const HOTSPOT_GUIDES: Guide[] = [
  {
    id: "vouchers-lots",
    title: "Vouchers & lots (générer, imprimer, transférer, reprendre)",
    summary:
      "Le stock de codes-temps : génération en 3 étapes, impression avec QR, suivi de vie du lot (barre d'expiration), transfert à un revendeur et reprise des invendus.",
    roles: "Propriétaire · Gérant",
    minutes: 6,
    updated: "2026-10-12",
    sectionId: "hotspot",
    vague: "V1",
    quoi:
      "Hotspot → Vouchers est le cœur commercial : l'onglet « Vouchers » liste les CODES (statut : disponible, vendu, utilisé, expiré — recherche et filtres par statut/détenteur), l'onglet « Lots » liste les LOTS générés (valeur, vie restante, actions de reprise et d'impression).\n\nUn lot est une commande de fabrication : profil tarifaire + quantité + routeur cible. La génération débite le crédit vendeur, crée les codes, et les pousse vers le routeur au check-in suivant. Le cycle de vie complet — génération → impression → vente → utilisation → expiration — est tracé et consolidé en comptabilité.",
    difference: [
      {
        with: "Les profils",
        body:
          "Le profil définit le TARIF (durée, vitesse, prix) ; le lot FABRIQUE des codes selon ce tarif. Voir le guide Profils & forfaits.",
      },
      {
        with: "Les tickets en Mode Vente",
        body:
          "En Mode Vente, le revendeur vend les codes du lot qui lui a été TRANSFÉRÉ ; le stock et la créance sont suivis côté console. Même marchandise, circuit différent.",
      },
      {
        with: "Les comptes utilisateurs",
        body:
          "Un voucher est jetable ; un compte utilisateur est rechargeable. Le premier pour la vente de passage, le second pour la fidélité.",
      },
    ],
    recoit: [
      "Chaque lot : un numéro, la valeur totale, la barre de vie (durée avant expiration du lot), le profil et le routeur cible.",
      "Chaque code : statut détaillé (disponible / vendu / utilisé / expiré), détenteur (revendeur éventuel), volumes consommés.",
      "L'impression : par lot ou reprise rapide, avec modèle de ticket personnalisable (logo, mentions) — QR + code en clair.",
      "La comptabilité : valeur générée, vendue, et marge consolidée dans Rapports (onglets Marge / Comptabilité).",
    ],
    etapes: [
      {
        title: "Générez le lot (rappel express)",
        body:
          "« Générer des vouchers » → forfait, quantité (10/25/50/100/200), routeur cible → échantillon de codes (limites avancées Mikhmon en option) → récap → Générer. Le détail pas-à-pas est dans le guide « Vendre votre premier accès Wi-Fi ».",
        capture: cap(
          "hotspot/vouchers-wizard-1.png",
          1440,
          900,
          "Assistant de génération de vouchers, étape forfait",
          "L'assistant — 3 étapes, moins d'une minute.",
        ),
      },
      {
        title: "Suivez le stock dans l'onglet Vouchers",
        body:
          "Le tableau liste les codes avec recherche (par code) et filtres (statut, détenteur). Les mots de passe sont masqués à l'écran — visibles uniquement à l'impression. Les statuts avancent seuls : disponible → vendu (première utilisation) → utilisé (temps épuisé) / expiré (lot échu).",
        capture: cap(
          "hotspot/vouchers.png",
          1440,
          1260,
          "Onglet Vouchers : tableau des codes, recherche par code, filtres statut et détenteur, mots de passe masqués",
          "Le stock de codes — statuts et filtres.",
        ),
      },
      {
        title: "Pilotez les lots dans l'onglet Lots",
        body:
          "Chaque lot affiche sa valeur, sa composition et sa BARRE DE VIE : un lot expire (les invendus deviennent inertes) — c'est voulu, pour que la comptabilité ne compte que du vendable frais. Les actions par lot : imprimer, transférer, reprendre.",
        capture: cap(
          "hotspot/vouchers-lots.png",
          1440,
          900,
          "Onglet Lots : liste des lots générés avec valeur, barre de vie et actions",
          "Les lots — la barre de vie évite les stocks fantômes.",
        ),
      },
      {
        title: "Imprimez (ou réimprimez)",
        body:
          "L'impression se déclenche par lot (dialogue complet : modèle, format, police) ; « Réimpression rapide » ressort un lot déjà imprimé — pour remplacer des tickets perdus ou abîmés. Le modèle de ticket se règle dans Paramètres → Modèles (voir le guide Portail captif & marque).",
        tip: "Imprimez par petites quantités (25-50) : un lot échu non imprimé est un lot propre, un carton de 500 tickets dont la moitié expire avant vente est de la perte sèche.",
      },
      {
        title: "Transférez à un revendeur",
        body:
          "Le transfert cède les codes du lot à un revendeur (elles deviennent sa marchandise, sa créance envers vous) — le détail est dans le guide Revendeurs & Mode Vente. La colonne « détenteur » de l'onglet Vouchers reflète la cession.",
      },
      {
        title: "Reprenez les invendus",
        body:
          "La reprise (dépôt-vente) rapatrie les codes non utilisés d'un lot transféré : ils redeviennent votre stock, la créance du revendeur est régularisée au settle. Utile en fin de collaboration ou pour réorienter un stock vers un autre point de vente.",
      },
    ],
    usages: [
      {
        title: "Rotation hebdomadaire",
        body:
          "Un lot « 1 Heure » de 100 codes par semaine : la barre de vie force le réassort régulier, la marge suit dans Rapports → Marge.",
      },
      {
        title: "Événementiel",
        body:
          "Un concert, un match : lot unique à durée courte, expiration calée sur la fin de l'événement — zéro gestion post-événement.",
      },
      {
        title: "Dépôt-vente en kiosque",
        body:
          "Générez, transférez au revendeur du quartier, encaissez les versements (guide Revendeurs) — le transfert trace tout.",
      },
    ],
    pieges: [
      {
        title: "Un lot expiré ne se « relit » pas",
        body:
          "Les codes inertes ne reviennent pas en stock : c'est le principe (comptabilité saine). Anticipez avec des quantités modestes et des lots fréquents.",
        severity: "warn",
      },
      {
        title: "Vente avant arrivée du lot sur le routeur",
        body:
          "Un ticket vendu dans la seconde qui suit la génération peut échouer si le routeur n'a pas encore checké (≤ 45 s). En pratique, l'impression prend plus de temps que la synchronisation — mais évitez de vendre pendant la génération.",
        severity: "info",
      },
      {
        title: "Ne confondez pas « vendu » et « utilisé »",
        body:
          "« Vendu » = le client a payé (code activé une première fois) ; « utilisé » = temps épuisé. L'écart entre les deux est votre stock de temps en circulation.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Puis-je générer un lot pour un routeur précis ?",
        a: "Oui — le routeur cible se choisit à l'étape 1 de l'assistant (ou « tous les serveurs »). Les codes ne sont valides que sur la cible.",
      },
      {
        q: "Comment retrouver UN code précis ?",
        a: "La recherche de l'onglet Vouchers accepte le code complet ; les filtres par statut/détenteur affinent. Depuis une session active, le détail de session pointe aussi vers le code.",
      },
      {
        q: "Le QR ne fonctionne pas sur certains téléphones ?",
        a: "Vérifiez l'URL de connexion hotspot renseignée sur le routeur (fiche → Modifier) : elle doit être joignable DEPUIS le WiFi du client (l'IP locale du routeur, pas une URL externe).",
      },
    ],
    related: ["premiere-vente", "profils-forfaits", "revendeurs"],
  },

  {
    id: "profils-forfaits",
    title: "Profils & forfaits (vos tarifs)",
    summary:
      "La grille tarifaire du hotspot : durées, prix, limites de vitesse, partage — comment la structurer pour vendre malin (heure, journée, semaine, staff).",
    roles: "Propriétaire · Gérant",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "hotspot",
    vague: "V1",
    quoi:
      "Hotspot → Profils définit les forfaits vendables : chaque profil porte un nom (1-HEURE, 24-HEURES, 7-JOURES…), un prix en FCFA, une durée, une limite de vitesse (rate-limit) et des options avancées (partage du code, quota volume). Les lots de vouchers se fabriquent TOUJOURS à partir d'un profil.\n\nLe profil est aussi la transcription du « user profile » RouterOS : l'agent MikCloud crée et maintient les profils correspondants sur le routeur — vous ne touchez jamais Winbox pour ça.",
    difference: [
      {
        with: "Un lot de vouchers",
        body:
          "Le profil est la RECETTE (tarif + règles) ; le lot est la PRODUCTION (les codes). Changer la recette ne change pas les lots déjà produits.",
      },
      {
        with: "Les formules d'abonnement SaaS",
        body:
          "Les profils concernent vos CLIENTS WiFi ; les formules (Paramètres → Abonnement) concernent VOTRE abonnement MikCloud. Deux mondes tarifaires.",
      },
      {
        with: "Le profil PPPoE",
        body:
          "Un profil PPPoE s'applique aux abonnés fixes (identifiants permanents), pas aux vouchers. Même logique de débit, public différent (guide Abonnés PPPoE).",
      },
    ],
    recoit: [
      "Votre grille : liste des profils avec prix, durée, vitesse et quota — visible d'un coup d'œil (la capture montre la grille ProMax WIFI : 100 FCFA/1 h jusqu'à 3 000 FCFA/30 j, plus le profil Staff gratuit à 90 jours).",
      "Chaque profil est poussé vers le routeur (parité RouterOS) : la limite de vitesse s'applique à chaque session du forfait.",
      "Un profil « Staff » à 0 FCFA permet l'accès gratuit de vos propres équipements (caméras, caisse, compte du personnel).",
      "Les suppressions/modifications se propagent au check-in suivant ; les sessions en cours continuent sur les anciennes règles jusqu'à reconnexion.",
    ],
    etapes: [
      {
        title: "Ouvrez Hotspot → Profils",
        body:
          "La liste montre la grille en vigueur. Repérez la logique escalier : prix et durée croissants, avec décote à l'unité (100 FCFA/1 h mais 3 000 FCFA/30 j ≈ 100 FCFA/jour) — le client long-durée est récompensé, votre caisse est lissée.",
        capture: cap(
          "hotspot/profiles.png",
          1440,
          1142,
          "Vue Profils : grille tarifaire avec prix FCFA, durées, vitesses et quotas de chaque forfait",
          "La grille tarifaire — l'escalier de prix se lit d'un coup d'œil.",
        ),
      },
      {
        title: "Créez / ajustez un profil",
        body:
          "Nom, prix, durée, limite de débit. Gardez des noms parlants (affichés sur les tickets et les rapports). La limite de vitesse protège votre ligne : vendez moins cher les forfaits bridés, plein tarif les forfaits rapides.",
        tip: "Bridez les forfaits courts (ex. 512 k à 1 h) : les clients courts restent légers, les forfaits jours/semaine prennent la vraie vitesse.",
      },
      {
        title: "Le profil Staff (interne)",
        body:
          "Un profil à 0 FCFA (le Staff de la capture dure 90 jours) sert à vos équipements : caméras IP, caisse, téléphonie. Il passe par le même portail mais ne consomme pas votre crédit vendeur à la génération.",
      },
      {
        title: "Vérifiez la propagation",
        body:
          "Après modification, la nouvelle grille part vers le routeur au check-in (≤ 45 s). Les sessions déjà ouvertes gardent les anciennes limites jusqu'à reconnexion — prévenez la clientèle en cours de forfait si le changement est défavorable.",
      },
    ],
    usages: [
      {
        title: "La grille du quartier",
        body:
          "1 h / 3 h / 24 h : les trois réflexes du client pressé. Les gros forfaits (7 j, 30 d) fidélisent les habitués.",
      },
      {
        title: "Segmentation par vitesse",
        body:
          "Deux profils « 24 h » : un bridé à petit prix pour la messagerie, un rapide pour les streamers — même durée, deux budgets.",
      },
      {
        title: "Promotions ponctuelles",
        body:
          "Créez un profil promo (ex. « 24H-WE ») le temps d'un week-end, générez le lot, laissez expirer : la promo s'arrête toute seule avec le lot.",
      },
    ],
    pieges: [
      {
        title: "Renommer un profil ne migre pas les codes",
        body:
          "Les lots déjà générés restent liés à l'ancien profil. Le renommage est cosmétique pour le futur ; les tickets imprimés portent l'ancien nom.",
        severity: "info",
      },
      {
        title: "Vitesse démesurée = ligne saturée",
        body:
          "Un profil sans limite sur une petite ligne : 5 clients suffisent à paralyser tout le monde. Toujours borner en dessous de votre capacité totale.",
        severity: "warn",
      },
      {
        title: "Suppression d'un profil actif",
        body:
          "La suppression est refusée (ou ignorée par le routeur) si des vouchers/abonnés actifs l'utilisent — archivez plutôt : retirez-le de la grille de génération.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Comment vendre « à la journée » avec reset à minuit ?",
        a: "Réglez la DURÉE du profil (temps glissant depuis connexion). Un « jour calendaire » (reset à 00 h) n'est pas un mode voucher — c'est un usage abonné/PPPoE.",
      },
      {
        q: "Puis-je vendre des forfaits à volume (Go) plutôt qu'à temps ?",
        a: "Oui : les quotas volume font partie des options du profil — le code expire au premier des deux échéants (temps OU volume).",
      },
    ],
    related: ["premiere-vente", "vouchers-lots", "pppoe"],
  },

  {
    id: "cybercafe",
    title: "Cybercafé (module) — postes, codes-temps, caisse",
    summary:
      "Le module Cybercafé ajoute la gestion des postes câblés loués à l'heure : attribution des machines, codes-temps, caisse du jour — en complément du WiFi.",
    roles: "Propriétaire",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "hotspot",
    vague: "V2",
    quoi:
      "Le module Cybercafé (Hotspot → Cybercafé) transforme MikCloud en caisse de cybercafé : chaque poste (machine câblée du local) est déclaré, les sessions se vendent par code-temps (même moteur de profils/vouchers), et la caisse suit encaissements et temps vendus par poste.\n\nC'est un module payant activable (bouton d'activation sur la vue quand il est éteint — voir la capture) : l'activation se fait depuis la console et prend effet immédiatement.",
    difference: [
      {
        with: "Le hotspot WiFi",
        body:
          "Même moteur commercial (profils, codes), supports différents : le poste cybercafé est une machine du local, identifiée et suivie individuellement ; le hotspot est l'accès radio général.",
      },
      {
        with: "Le WiFi jetable",
        body:
          "Le WiFi jetable est OFFERT ; le poste cybercafé se LOUE à l'heure. Les deux cohabitent (terrasse gratuite, salle payante).",
      },
      {
        with: "La vente par voucher WiFi",
        body:
          "Un client du cybercafé achète un code-temps valable SUR LES POSTES ; un voucher WiFi est valable sur le réseau radio. Les profils peuvent être partagés ou séparés selon votre politique.",
      },
    ],
    recoit: [
      "La liste des postes avec leur état (libre / occupé / hors service) et leur session en cours.",
      "Le moteur codes-temps : génération et impression de tickets valables poste.",
      "La caisse du jour : encaissements, temps vendus, valeur par poste — consolidée dans Rapports.",
      "Le cloisonnement par compte : chaque établissement cybercafé garde SES postes et SA caisse.",
    ],
    etapes: [
      {
        title: "Activez le module",
        body:
          "Ouvrez Hotspot → Cybercafé : si le module est éteint, la vue propose l'activation (selon formule). Après activation, la vue passe à la gestion des postes.",
        capture: cap(
          "hotspot/cyber.png",
          1440,
          900,
          "Vue Cybercafé : état du module avec bouton d'activation et présentation de la gestion des postes",
          "Le module Cybercafé — activation en un clic.",
        ),
      },
      {
        title: "Déclarez les postes",
        body:
          "Chaque machine du local se déclare avec son nom (POSTE-01…) — le suivi d'état et le démarrage de session s'y rattachent. Un poste en panne se marque « hors service » : il sort du rotateur sans polluler la caisse.",
      },
      {
        title: "Vendez des codes-temps",
        body:
          "La génération réutilise l'assistant vouchers (profils de votre grille) : le client paie, reçoit son ticket, s'installe au poste libre indiqué. La session démarre au premier login — le temps court dès ce moment, pas dès l'achat.",
      },
      {
        title: "Tenez la caisse",
        body:
          "La caisse du jour rapproche encaissements et temps consommés ; le rapport de marge consolide le cybercafé avec le WiFi dans un seul résultat d'exploitation.",
        tip: "Marquez les postes en fin de service : un poste « occupé » oublié fausse l'ouverture du lendemain.",
      },
    ],
    usages: [
      {
        title: "Cybercafé derrière Orange CI",
        body:
          "Postes câblés + WiFi vendu : le module tient la caisse salle, le hotspot tient la terrasse — une seule console, un seul rapport de marge.",
      },
      {
        title: "Salle de formation",
        body:
          "Louez la salle à la demi-journée par poste : codes-temps de durée longue, caisse facturée à l'organisme.",
      },
    ],
    pieges: [
      {
        title: "Le module se facture",
        body:
          "Activation = ajustement de votre abonnement (voir Paramètres → Abonnement). Désactivez le module si la salle ferme, la caisse historique reste consultable.",
        severity: "info",
      },
      {
        title: "Session ouverte ≠ poste occupé",
        body:
          "Un client qui part sans se déconnecter laisse la session courir (jusqu'à épuisement du temps). Coupez depuis la vue Postes — c'est fait pour ça.",
        severity: "warn",
      },
    ],
    faq: [
      {
        q: "Un même code peut-il servir sur poste puis en WiFi ?",
        a: "Selon la cible choisie à la génération (postes / hotspot / les deux) et les règles du profil — en pratique, séparez les deux marchés pour une caisse lisible.",
      },
      {
        q: "Puis-je imprimer des tickets cybercafé avec le même gabarit que le WiFi ?",
        a: "Oui, les modèles de tickets sont partagés (Paramètres → Modèles) avec des variables par contexte (poste, durée).",
      },
    ],
    related: ["premiere-vente", "profils-forfaits", "rapports-comptabilite"],
  },

  {
    id: "vpn-wireguard",
    title: "VPN WireGuard vendable (module)",
    summary:
      "Vendez des accès VPN WireGuard à vos clients (clés, quotas, péremption) et administrez les peers — le module VPN compte du hotspot.",
    roles: "Propriétaire",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "hotspot",
    vague: "V2",
    quoi:
      "Le module VPN WireGuard (Hotspot → VPN WireGuard) permet de VENDRE des tunnels VPN individuels : chaque client reçoit ses clés WireGuard (config/QR), une durée et un quota ; les peers sont administrés depuis la console et provisionnés sur le serveur VPN.\n\nC'est un module payant activable (la vue présente l'activation quand il est éteint). Selon la configuration plateforme, le serveur VPN est celui de votre compte (tenant) — la plateforme peut aussi verrouiller l'octroi en mode grossiste (voir le volet plateforme).",
    difference: [
      {
        with: "Le renfort WireGuard du routeur",
        body:
          "Le renfort routeur est un tunnel de GESTION (routeur ↔ cloud, technique) ; le module VPN vend des tunnels CLIENT (accès Internet privé). Rien à voir commercialement.",
      },
      {
        with: "La vitrine VPN B2C",
        body:
          "La vitrine (/vpn) est le site public où les clients achètent SEULS (paiement en ligne) ; le module est l'outil console pour vendre MANUELLEMENT et administrer les peers. Guide dédié : Vitrine VPN B2C.",
      },
      {
        with: "AntiVPN (protection)",
        body:
          "L'AntiVPN bloque les VPN sur votre hotspot ; le module VPN les vend. Deux faces d'une même pièce : vous maîtrisez la politique complète.",
      },
    ],
    recoit: [
      "La liste des comptes/peers VPN vendus : client, clé, statut, quota, échéance — avec actions (régénérer, révoquer).",
      "Les quotas et péremptions appliqués côté serveur VPN (volume et/ou temps par peer).",
      "La configuration client : QR + fichier .conf remis à l'achat (le client scanne dans son appli WireGuard).",
      "La facturation des ventes manuelles passe dans la même comptabilité (Rapports).",
    ],
    etapes: [
      {
        title: "Activez le module",
        body:
          "Ouvrez Hotspot → VPN WireGuard : la vue présente le module et son activation quand il est éteint (voir capture). L'activation provisionne votre espace VPN.",
        capture: cap(
          "hotspot/vpn.png",
          1440,
          900,
          "Vue VPN WireGuard : présentation du module avec bouton d'activation",
          "Le module VPN — activation depuis la console.",
        ),
      },
      {
        title: "Vendez un accès (manuel)",
        body:
          "Créez le client VPN : nom, formule (durée/quota). La console génère les clés et affiche le QR + la config à remettre. Le client scanne dans son appli WireGuard (mobile ou PC) — la connexion est immédiate.",
      },
      {
        title: "Administrez les peers",
        body:
          "La liste suit chaque peer : trafic consommé, échéance, statut. Régénérer recrée les clés (l'ancienne config devient invalide) ; révoquer coupe l'accès immédiatement.",
      },
      {
        title: "Vendez en ligne (option)",
        body:
          "Activez la vitrine B2C (volet plateforme) pour que les clients achètent seuls : paiement en ligne, provision automatique — votre console ne gère plus que le support.",
        tip: "Le quota VPN protège votre serveur : vendez des durées courtes renouvelables plutôt qu'un accès annuel illimité.",
      },
    ],
    usages: [
      {
        title: "Fidélisation hotspot",
        body:
          "Le client qui paie déjà son WiFi ajoute un VPN « nomade » (protection hors de chez vous) : deux lignes de revenu pour le même client.",
      },
      {
        title: "Prestataire IT",
        body:
          "Vendez l'accès sécurisé aux professionnels du quartier (commerçants nomades, journalistes) — facturation manuelle et suivi de quota à la clé.",
      },
    ],
    pieges: [
      {
        title: "Régénérer les clés coupe le client",
        body:
          "La régénération invalide l'ancienne config : prévenez le client (il devra rescanner le nouveau QR).",
        severity: "warn",
      },
      {
        title: "Vérrouillage grossiste",
        body:
          "Si la plateforme opère en mode grossiste, l'octroi des comptes VPN passe par elle (pool global) — la console vous l'indique. Vendez alors via la vitrine ou demandez l'octroi.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Faut-il un serveur dédié ?",
        a: "Non : le VPN tourne sur l'infrastructure MikCloud (wg-mini). Votre console administre les peers ; aucune machine à votre charge.",
      },
      {
        q: "Un client perd son QR ?",
        a: "Régénérez-lui (ancienne config invalide, nouvelle à rescaner) — c'est aussi la procédure en cas de soupçon de partage.",
      },
    ],
    related: ["vitrine-vpn", "abonnement-facturation"],
  },

  {
    id: "pppoe",
    title: "Abonnés PPPoE (console WISP)",
    summary:
      "Le segment FAI/WISP de MikCloud : abonnés fixes avec identifiants permanents, sessions, découverte des secrets — pour vendre de la connectivité au mois.",
    roles: "Propriétaire · Gérant",
    minutes: 5,
    updated: "2026-10-12",
    sectionId: "hotspot",
    vague: "V3",
    quoi:
      "Hotspot → Abonnés PPPoE gère les clients FIXES du réseau (WISP) : contrairement au voucher jetable, un abonné PPPoE possède identifiant + mot de passe PERMANENTS, se connecte sur le routeur (serveur PPPoE) et paie typiquement au mois. La console gère les trois volets : Abonnés (comptes), Sessions (connexions live), Découverte (scan des secrets existants sur un routeur raccordé).\n\nLes abonnés se provisionnent par l'agent (mode écriture agent) : création du secret RouterOS, profil de débit, journal des sessions — le tout sans toucher Winbox.",
    difference: [
      {
        with: "Les comptes utilisateurs hotspot",
        body:
          "L'utilisateur hotspot se connecte via le PORTAIL captif (browser) ; l'abonné PPPoE configure une CONNEXION réseau (identifiants dans le système). Public et mécanique différents, même console.",
      },
      {
        with: "Le voucher",
        body:
          "Prépayé jetable vs abonnement postpayé/prépayé mensuel : le PPPoE est la vente de la CONNECTIVITÉ, pas du temps de connexion.",
      },
      {
        with: "Le mode foyer (homenet)",
        body:
          "Le foyer pilote le WiFi de la MAISON (contrôle parental) ; le PPPoE vend l'accès aux clients d'un RÉSEAU de quartier. Deux produits.",
      },
    ],
    recoit: [
      "L'onglet Abonnés : identifiants, profils (débit), statut, échéance — provision automatique du secret sur le routeur.",
      "L'onglet Sessions : connexions PPPoE live (online/offline, IP, durée, volumes).",
      "L'onglet Découverte : lecture des secrets PPPoE existants sur un routeur (reprise d'un parc géré à la main jusqu'ici).",
      "Les écritures passent par la file agent (≤ 45 s) et l'agent supporte le mode écriture dédié PPPoE (opérations sûres, retries).",
    ],
    etapes: [
      {
        title: "Ouvrez Hotspot → Abonnés PPPoE",
        body:
          "La vue est tricolore (Abonnés / Sessions / Découverte). C'est un segment transverse : pas de module payant à activer, mais un usage à assumer (vendre de l'abonnement).",
        capture: cap(
          "hotspot/ppp.png",
          1440,
          945,
          "Vue Abonnés PPPoE : onglets Abonnés, Sessions et Découverte avec statistiques",
          "La console PPPoE — trois onglets, un segment FAI.",
        ),
      },
      {
        title: "Créez un abonné",
        body:
          "Nom d'utilisateur, mot de passe, profil de débit, échéance. Le secret part vers le routeur cible au check-in ; le client configure la connexion PPPoE chez lui (ou sur son routeur CPE fourni).",
        tip: "Les profils de débit PPPoE se gèrent comme la grille hotspot : créez deux-troux paliers (budget / standard / premium).",
      },
      {
        title: "Suivez les sessions",
        body:
          "L'onglet Sessions montre les connexions live : un abonné offline depuis jours = signal d'impayé ou de panne chez lui — proactivez l'appel.",
      },
      {
        title: "Reprenez un parc existant (Découverte)",
        body:
          "Si vous gériez vos secrets PPPoE à la main dans Winbox, l'onglet Découverte les RELIT depuis le routeur pour les importer dans la console — la bascule ne casse rien (les clients restent connectés).",
      },
    ],
    usages: [
      {
        title: "FAI de quartier",
        body:
          "Antenne + routeur MikroTik + abonnés PPPoE par paliers de débit : la console tient le parc, les sessions et (bientôt) la facturation récurrente.",
      },
      {
        title: "Résidence câblée",
        body:
          "Chaque appartement reçoit un abonné PPPoE avec débit selon le loyer d'accès — pas de ticket, pas de portail, juste la ligne.",
      },
    ],
    pieges: [
      {
        title: "Un abonné = un secret actif",
        body:
          "La régénération du mot de passe coupe le client jusqu'à ce qu'il reconfigure — faites-le accompagné (téléphone).",
        severity: "warn",
      },
      {
        title: "PPPoE ≠ portail captif",
        body:
          "L'abonné ne voit jamais le portail : son accès est au niveau connexion. Les annonces/branding du portail ne l'atteignent pas — passez par les notifications si besoin.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Peut-on cumuler hotspot et PPPoE sur le même routeur ?",
        a: "Oui — c'est le cas standard WISP : le hotspot vend le prépayé radio, le PPPoE abonne les fixes ; la console sépare les deux comptabilités d'usage.",
      },
      {
        q: "Le paiement mensuel est-il automatisé ?",
        a: "Les renouvellements passent par la plateforme (demandes de renouvellement) ou l'encaissement local ; l'échéance contrôle la coupure (l'agent applique la suspension).",
      },
    ],
    related: ["profils-forfaits", "sessions-actives", "inscriptions-publiques"],
  },

  {
    id: "wifi-jetable",
    title: "WiFi jetable (accès offert)",
    summary:
      "Offrez du WiFi à quota : un site avec QR sur les tables, code gratuit, capture de téléphone optionnelle pour le marketing — l'outil d'accueil/terrasse.",
    roles: "Propriétaire · Gérant",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "hotspot",
    vague: "V2",
    quoi:
      "Hotspot → WiFi Jetable crée des SITES d'accès offert : chaque site porte un QR (à imprimer sur les tables) et un code gratuit à QUOTA (durée/volume limités, renouvelable). Le client scanne, saisit son numéro de téléphone (optionnel, pour le marketing), reçoit son code et navigue.\n\nLa mécanique interne réutilise le moteur vouchers (claim d'un code de la réserve du site) et le portail captif — mais l'argent n'intervient pas : c'est un coût marketing, pas un revenu direct.",
    difference: [
      {
        with: "Le voucher vendu",
        body:
          "Vendu = payant, durée du profil ; jetable = OFFERT, quota fixe, usage marketing (téléphone capté). Deux produits, deux vues.",
      },
      {
        with: "Le walled-garden",
        body:
          "Le walled-garden liste ce qui est accessible AVANT login ; le WiFi jetable EST un login (offert). Combinables : le site jetable accessible pré-connexion pour simplifier l'onboarding.",
      },
      {
        with: "Les inscriptions publiques",
        body:
          "L'inscription publique crée des COMPTES clients approuvés (accès personnel durable) ; le jetable reste anonyme (ou semi : téléphone seul).",
      },
    ],
    recoit: [
      "Chaque site : un QR imprimable, un code d'accès offert à quota, une page publique (/wifi/votre-site) noindex.",
      "Le client : code délivré inline (claim) → login CHAP sur le portail → navigation bornée.",
      "Vous : la liste des codes claimés, les téléphones captés (si activés) — matière première marketing (SMS de rappel, offres).",
      "Le balayage horaire purge les commandes publiques mortes (anti-abus) ; les quotas protègent votre ligne.",
    ],
    etapes: [
      {
        title: "Créez le site",
        body:
          "Hotspot → WiFi Jetable → « Nouveau site WiFi » : nom du site (ex. « Terrasse ProMax »), quota offert (durée/volume), capture du téléphone oui/non, routeur cible. La vue liste vos sites et leur QR.",
        capture: cap(
          "hotspot/wifi-jetable.png",
          1440,
          900,
          "Vue WiFi Jetable : présentation et bouton Nouveau site WiFi",
          "WiFi Jetable — un site = un QR + un quota offert.",
        ),
      },
      {
        title: "Configurez l'assistant",
        body:
          "Le wizard (voir capture) reprend le nom, le quota et l'option téléphone. Gardez le quota petit (15-30 min / 100 Mo) : le jetable est un apéritif, pas un buffet.",
        capture: cap(
          "hotspot/wifi-wizard.png",
          1440,
          900,
          "Assistant de création d'un site WiFi jetable",
          "L'assistant site — quota et option téléphone.",
        ),
      },
      {
        title: "Imprimez le QR et posez-le",
        body:
          "Le QR du site s'imprime depuis la vue (format table/carte). Posé sur les tables, il ouvre la page publique du site — pas de réseau à chercher, pas de mot de passe à épeler.",
      },
      {
        title: "Suivez les usages",
        body:
          "Les codes claimés remontent dans la vue (par site) ; les téléphones captés (si l'option est active) alimentent votre base marketing. Les quotas et le balayage anti-abus protègent la ligne.",
        tip: "Le WiFi jetable augmente la fréquentation et votre fichier clients ; le voucher paie la ligne. Les deux se vendent main dans la main (« profitez du WiFi offert, la journée complète est à 300 F »).",
      },
    ],
    usages: [
      {
        title: "Restaurant / café",
        body:
          "QR sur les tables : le client attend son plat en naviguant — 15 minutes offertes, un téléphone capté pour l'offre du lendemain.",
      },
      {
        title: "Salle d'attente",
        body:
          "Quota court en boucle : chacun consulte ses messages, personne ne squatte la ligne.",
      },
      {
        title: "Événement / salon",
        body:
          "Un site par édition, quota généreux le jour J, expiration naturelle — et une base de contacts qualifiés en sortie.",
      },
    ],
    pieges: [
      {
        title: "Quota trop généreux = squat",
        body:
          "Sans quota serré, le jetable remplace le voucher payant — vous payez la ligne des autres. 15-30 min suffisent presque toujours.",
        severity: "warn",
      },
      {
        title: "La page publique est noindex",
        body:
          "Volontairement (pas de référencement des pages d'accès) : le QR est LE canal. N'attendez pas de trafic Google dessus.",
        severity: "info",
      },
      {
        title: "Téléphones captés = responsabilité",
        body:
          "Si vous activez la capture, vous entrez dans un traitement de données (registre, finalité, consentement au QR) — see Registre de traitement.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Le client peut-il reprendre un code après expiration ?",
        a: "Il reclame un nouveau code (selon la politique du site — cooldown anti-abus appliqué par le balayage).",
      },
      {
        q: "Puis-je limiter le jetable à certaines heures ?",
        a: "Les quotas gèrent volume/durée ; pour les horaires, combinez avec le scheduler du routeur (fiche routeur → Outils).",
      },
    ],
    related: ["premiere-vente", "portail-captif", "inscriptions-publiques"],
  },
];
