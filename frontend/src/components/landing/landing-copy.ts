// Landing page 403Shield « Clay » — copie marketing bilingue FR/EN.
//
// Auto-contenue (à part du dictionnaire applicatif i18n) : la vitrine a un
// volume de copie marketing important qui n'a pas vocation à vivre dans le
// dictionnaire applicatif. La langue courante est lue via le store zustand
// (useHotspotStore.lang) — pas de rechargement au switch.
//
// N°120 — refonte complète de la vitrine : MikCloud n'est plus seulement un
// gestionnaire Hotspot, c'est aussi un pare-feu cloud (4 protections posées
// sur le routeur : SafeWiFi, Shield, FamilyGuard, AntiVPN) et un outil de
// pilotage de parc (télémétrie, mise à jour RouterOS unitaire + flotte).
// La copie ne mentionne QUE des fonctionnalités réelles du produit — les
// chiffres mis en avant (500 vouchers/lot, 4 boucliers, 54 pays, 60 jours
// d'essai Hotspot) sont des constantes produit, pas des métriques d'usage inventées.
//
// N°124 — le mode résidentiel est renommé HomeNet (sécurité internet
// résidentiel) partout où le mode est nommé ; la clientèle cible du mode
// Hotspot (hôtels, cybercafés, maquis…) est exposée via le champ
// optionnel audience (rendu en chips clay), revendeurs mis en avant.
//
// Positionnement : marché africain pan-continental (UEMOA + CEMAC + Afrique
// de l'Est + Nigeria + Ghana). Multi mobile-money (Wave, Orange Money, MTN
// MoMo, Moov, MPesa, Airtel Money), multi-devises (FCFA, NGN, GHS, KES...).
//
// N°317 — rebrand : MikCloud & MikTunnel disparaissent au profit de la marque
// unifiée 403Shield (Option A de l'étude N°316, modèle Cloudflare/OVH : UN
// site marketing multipage à menu complet + UNE console transactionnelle).
// La vitrine devient le site unifié : Hotspot · VPN · Tunnels, endossée
// « powered by FTech CI » (ftci.fr). Nouveau bloc `pages` (copie des pages
// produit /hotspot, /vpn, /tunnels) et menu complet `header.nav`.
//
// N°321 — la vitrine rattrape l'évolution 403Shield : les Tunnels
// WireGuard deviennent un PILIER de la page d'accueil (4e super-pouvoir,
// section dédiée, segment tarifs) et le VPN comme l'Accès Pro y sont
// présentés comme UNE SEULE offre « un tunnel, deux usages » (même
// WireGuard, même console, même boutique). Les prix catalogue tunnels
// (1 500 / 15 000 / 3 500 / 35 000 FCFA) recopient les constantes produit
// réelles du backend (publicvpnorder.go — familles b2c & pro) ; le prix
// final par moyen de paiement reste calculé sur la boutique.
//
// N°322 — HomeNet cesse d'être un service indépendant de la vitrine : le
// segment tarifs « homenet » (grille de 3 cartes parallèles) disparaît au
// profit du tarif foyer LIÉ à l'offre Hotspot — les cartes de la grille
// console portent le mode HomeNet en option à prix réduit (1 250 F/mois
// /routeur · 12 000 F/an · essai 30 j : constantes catalogue tenant.go
// N°122). Le sélecteur passe de 3 à 2 segments : l'abonnement console
// (Hotspot · HomeNet) et la boutique tunnels — « un abonnement, un
// tunnel », dans la lignée du « un tunnel, deux usages » de N°321.

export type Lang = "fr" | "en";

export interface ProductPageCopy {
  meta: { title: string; description: string };
  hero: {
    badge: string;
    title1: string;
    titleAccent: string;
    title2: string;
    subtitle: string;
    ctaPrimary: string;
    /** "#signup" ouvre la modale d'inscription ; "#signin" va à /login ; chemin interne ("/tunnels") ou URL https externe. */
    ctaPrimaryHref: string;
    ctaSecondary: string;
    ctaSecondaryHref: string;
  };
  features: {
    eyebrow: string;
    title: string;
    cards: { title: string; desc: string }[];
  };
  note?: { title: string; body: string };
  cta: {
    kicker: string;
    title: string;
    body: string;
    primary: string;
    primaryHref: string;
    secondary: string;
    secondaryHref: string;
  };
}

export interface LandingCopy {
  rail: {
    home: string;
    powers: string;
    protection: string;
    hotspot: string;
    /** N°321 — ancre de la nouvelle section Tunnels WireGuard. */
    tunnels: string;
    fleet: string;
    pricing: string;
  };
  header: {
    brand: string;
    signIn: string;
    signUp: string;
    langLabel: string;
    homeLink: string;
    /** N°317 — menu complet du site unifié (voie Cloudflare/OVH). */
    nav: {
      home: string;
      hotspot: string;
      vpn: string;
      tunnels: string;
      pricing: string;
    };
  };
  hero: {
    badge: string;
    title1: string;
    titleAccent: string;
    title2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    trialHint: string;
    chips: string[];
  };
  marquee: string[];
  powers: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cards: {
      tag: string;
      title: string;
      desc: string;
      items: string[];
    }[];
  };
  protection: {
    kicker: string;
    title: string;
    body: string;
    feats: { title: string; desc: string }[];
    panel: {
      title: string;
      scoreLabel: string;
      scoreVerdict: string;
      stats: { value: string; label: string }[];
      lines: { name: string; state: string }[];
      repairLine: { name: string; state: string };
    };
  };
  hotspot: {
    kicker: string;
    title: string;
    body: string;
    /** N°124 — clientèle cible du mode Hotspot + libellé du bandeau. */
    audience: string[];
    audienceLabel: string;
    feats: { title: string; desc: string }[];
    panel: {
      title: string;
      online: string;
      peak: string;
    };
  };
  /** N°321 — Tunnels WireGuard : UN service, deux usages (VPN personnel +
      Accès Pro). La section existe pour rendre visible le lien entre le VPN
      et les tunnels — même WireGuard, même console, même boutique. */
  tunnels: {
    kicker: string;
    title: string;
    body: string;
    feats: { title: string; desc: string }[];
    panel: {
      title: string;
      rows: { name: string; detail: string; state: string }[];
      console: string;
      shop: string;
    };
  };
  fleet: {
    kicker: string;
    title: string;
    body: string;
    feats: { title: string; desc: string }[];
    panel: {
      title: string;
      rows: { name: string; version: string; state: string; upToDate: boolean }[];
      checkAll: string;
      updateAll: string;
    };
  };
  stats: { value: number; label: string }[];
  pricing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    /** N°122 — aria-label du sélecteur de comptoir (console / boutique).
        N°322 — 2 segments : l'abonnement console (Hotspot · HomeNet) et la
        boutique tunnels. */
    modesLabel: string;
    /** N°122 — tarifs segmentés par mode : chaque mode a ses 3 formules.
        N°321 — 3e segment « tunnels » (boutique dédiée, CTA liens externes).
        N°322 — le segment « homenet » est RETIRÉ : le mode foyer n'est plus
        un service indépendant, son tarif réduit vit sur les cartes de la
        grille Hotspot (même abonnement, deux modes). */
    segments: {
      id: "hotspot" | "tunnels";
      label: string;
      hint: string;
      /** N°124 — clientèle cible (chips clay) — uniquement le mode Hotspot. */
      audience?: string[];
      plans: {
        name: string;
        price: string;
        period: string;
        tagline: string;
        cta: string;
        highlight: boolean;
        features: string[];
        badge?: string;
        /** N°321 — cible externe (boutique/console) : le bouton devient un
            lien nouvel onglet au lieu d'ouvrir la modale d'inscription. */
        href?: string;
      }[];
    }[];
    currencyNote: string;
  };
  chat: {
    fabLabel: string;
    openLabel: string;
    closeLabel: string;
    /** N°131 — bulle d'invitation flottant à côté du bouton chat
        (animation « wahou » de découverte). */
    tease: string;
    title: string;
    statusBot: string;
    statusHuman: string;
    statusClosed: string;
    placeholder: string;
    send: string;
    humanBtn: string;
    newConv: string;
    handoffNote: string;
    closedNote: string;
    suggestions: string[];
    agentBadge: string;
    inputLabel: string;
    sendError: string;
  };
  finalCta: {
    kicker: string;
    title: string;
    subtitle: string;
    primary: string;
    secondary: string;
  };
  footer: {
    tagline: string;
    columns: { title: string; links: { label: string; href: string; external?: boolean }[] }[];
    /** N°70 — libellé du lien vers /legal/confidentialite. */
    legal: string;
  };
  /** N°317 — pages produit du site unifié (multipage, menu complet). */
  pages: {
    hotspot: ProductPageCopy;
    vpn: ProductPageCopy;
    tunnels: ProductPageCopy;
  };
}

const fr: LandingCopy = {
  rail: {
    home: "Accueil",
    powers: "Super-pouvoirs",
    protection: "Protection",
    hotspot: "Hotspot",
    // N°321 — le tunnel unifié entre au rail : VPN & Accès Pro, un seul service.
    tunnels: "Tunnels WireGuard",
    fleet: "Parc routeurs",
    pricing: "Tarifs",
  },
  header: {
    brand: "403Shield",
    signIn: "Se connecter",
    signUp: "Essai gratuit",
    langLabel: "EN",
    homeLink: "Retour à l'accueil",
    nav: {
      home: "Accueil",
      hotspot: "Hotspot",
      vpn: "VPN",
      // N°321 — libellé famille : le nav porte UNE entrée « Tunnels WireGuard »
      // (→ /tunnels) ; la page /vpn reste liée depuis /tunnels, le footer,
      // la section tunnels et le segment tarifs.
      tunnels: "Tunnels WireGuard",
      pricing: "Tarifs",
    },
  },
  hero: {
    badge: "403Shield · Hotspot · VPN · Tunnels",
    title1: "Votre réseau, sous",
    titleAccent: "bouclier.",
    title2: "",
    subtitle:
      "L'erreur 403, c'est pour les autres. Hotspot WiFi public rentable, quatre boucliers pare-feu dans le cloud, et un seul tunnel WireGuard pour tous vos usages — VPN personnel à IP fixe France, Accès Pro pour vos routeurs, caméras et NAS : 403Shield réunit une suite complète de sécurité réseau pour les travailleurs nomades, les entreprises et les particuliers — powered by FTech CI.",
    ctaPrimary: "Protéger mon réseau",
    ctaSecondary: "Découvrir la suite",
    trialHint: "Essai gratuit · sans carte bancaire — 60 jours Hotspot · 30 jours HomeNet",
    chips: ["Erreur 403 — aux autres", "4/4 protections actives", "Tunnels WireGuard · IP fixe France"],
  },
  marquee: [
    "Vouchers & codes d'accès",
    "VPN WireGuard · IP fixe France",
    "Filtrage DNS Quad9",
    "Un seul tunnel, deux usages",
    "Anti-piratage WiFi",
    "Accès distant Pro — routeurs, caméras, NAS",
    "Couvre-feu internet",
    "Mode HomeNet · le foyer sur le même abonnement",
    "Bloque-VPN",
    "QoS & forfait FAI",
    "Mode Vente revendeurs",
    "Mise à jour RouterOS",
    "Portail captif à votre marque",
    "Paiement Wave & Mobile Money",
  ],
  powers: {
    // N°321 — quatre piliers : les Tunnels WireGuard rejoignent le panthéon
    // (la vitrine n'est plus figée sur l'ère hotspot).
    eyebrow: "Une suite, quatre piliers",
    title: "Tout ce qu'il faut pour régner sur votre réseau.",
    subtitle:
      "Hotspot rentable, protection cloud, pilotage de parc et tunnels WireGuard : 403Shield réunit en une seule suite tout ce que votre infrastructure réclame — sans Winbox, sans serveur à maintenir.",
    cards: [
      {
        tag: "Fondation",
        title: "Gestion Hotspot",
        desc: "Le pilier fondateur de la suite : portails captifs à votre marque, vouchers par lots, quotas et bridage au forfait, sessions en direct.",
        items: [
          "Portail captif 100 % à votre marque",
          "Vouchers par lots jusqu'à 500",
          "Quota, débit et durée par forfait",
          "Mode Vente & revendeurs avec PIN",
        ],
      },
      {
        tag: "4 boucliers",
        title: "Protection Cloud",
        desc: "Quatre protections pare-feu posées directement sur vos routeurs, pilotées et auto-réparées depuis le cloud toutes les six heures.",
        items: [
          "SafeWiFi — filtrage DNS Quad9 / AdGuard",
          "Shield — ports d'administration blindés",
          "FamilyGuard — couvre-feu horaire",
          "AntiVPN — tunnels coupés, WhatsApp intact",
        ],
      },
      {
        tag: "Parc",
        title: "Pilotage du parc",
        desc: "Télémétrie live, mise à jour RouterOS en un clic — routeur par routeur ou tout le parc d'un geste — et qualité de ligne mesurée en continu.",
        items: [
          "Mise à jour RouterOS sans Winbox",
          "Télémétrie CPU, mémoire, uptime",
          "QoS agrégée & forfait FAI",
          "Docteur Pool IP & auto-réparation",
        ],
      },
      {
        tag: "WireGuard",
        title: "Tunnels WireGuard",
        desc: "Un seul tunnel chiffré, deux usages : VPN personnel à IP fixe France et Accès Pro pour vos routeurs, caméras et NAS — une console, une boutique, un abonnement.",
        items: [
          "VPN personnel · IP fixe France dédiée",
          "Accès Pro — routeurs, caméras, NAS",
          "Console sans mot de passe · code e-mail",
          "Hébergé à Marseille · chiffré de bout en bout",
        ],
      },
    ],
  },
  protection: {
    kicker: "Protection cloud",
    title: "Le bouclier qui veille pendant que vous dormez.",
    body: "Chaque protection est vérifiée par signatures et réparée automatiquement toutes les six heures. Sans rien installer, sans ouvrir Winbox : vos règles existantes sont préservées, et le WiFi reste opérationnel quoi qu'il arrive.",
    feats: [
      {
        title: "SafeWiFi — sites dangereux bloqués",
        desc: "Virus, arnaques et publicités stoppés au niveau DNS (Quad9 ou AdGuard Famille) — les échappatoires DoH et IPv6 sont fermées.",
      },
      {
        title: "Shield — anti-piratage du WiFi",
        desc: "Les ports d'administration de vos routeurs et le partage Windows deviennent inaccessibles depuis le WiFi public.",
      },
      {
        title: "FamilyGuard — couvre-feu internet",
        desc: "Tout l'internet des clients est coupé pendant la fenêtre programmée, par exemple de 22 h à 6 h.",
      },
      {
        title: "AntiVPN — tunnels coupés",
        desc: "WireGuard, OpenVPN, IPsec et Tor bloqués — les appels WhatsApp restent intacts.",
      },
    ],
    panel: {
      title: "Centre de protection",
      scoreLabel: "Score de protection",
      scoreVerdict: "Bien protégé",
      stats: [
        { value: "4", label: "protections actives" },
        { value: "6 h", label: "auto-réparation" },
        { value: "45 s", label: "check-in agent" },
      ],
      lines: [
        { name: "SafeWiFi · Filtrage DNS", state: "Actif" },
        { name: "Shield · Anti-piratage", state: "Actif" },
        { name: "FamilyGuard · Couvre-feu", state: "22:00 → 06:00" },
        { name: "AntiVPN · Bloque-VPN", state: "Actif" },
      ],
      repairLine: { name: "Auto-réparation cloud", state: "Vérifié il y a 2 min" },
    },
  },
  hotspot: {
    kicker: "Gestion hotspot",
    title: "Un portail captif dont vous serez fier.",
    body: "Offrez à vos clients une connexion fluide et soignée — à votre marque, sans aucune mention 403Shield. Vouchers à durée, quota ou multi-appareils : vous gardez le contrôle total. Vos revendeurs ? Ils vendent depuis leur téléphone : PWA protégée par PIN, stock transféré, ventes hors-ligne, rapport de journée.",
    audience: ["Hôtels", "Cybercafés", "Maquis", "Boutiques", "Campus", "Restaurants"],
    audienceLabel: "Pour qui ?",
    feats: [
      {
        title: "Marque 100 % personnalisable",
        desc: "Mode commercial avec grille tarifaire et paiement Wave, ou mode hospitalité avec promos et réseaux sociaux.",
      },
      {
        title: "Vouchers & forfaits",
        desc: "Durée, quota de données, débit, 1 à 10 appareils — et à l'épuisement : couper ou brider en douceur.",
      },
      {
        title: "Statistiques en direct",
        desc: "Affluence horaire, revenus, marge par profil, canaux directs et revendeurs.",
      },
    ],
    panel: {
      title: "Affluence horaire",
      online: "Heure de pointe · 19 h",
      peak: "24 h",
    },
  },
  /* N°321 — LE service unifié : VPN personnel et Accès Pro rendus comme
     deux usages d'un MÊME tunnel WireGuard (même console, même boutique). */
  tunnels: {
    kicker: "Tunnels WireGuard",
    title: "Un seul tunnel chiffré, tous vos réseaux.",
    body: "Le VPN 403Shield et l'Accès Pro ne font qu'un : c'est le même tunnel WireGuard, hébergé à Marseille et chiffré de bout en bout. Sur votre téléphone, il protège votre trafic et vous donne une IP fixe France ; branché sur vos réseaux, il devient Accès Pro — routeurs, caméras et NAS joignables en privé, même derrière CGNAT. Une console, une boutique, un abonnement : tout vit au même endroit.",
    feats: [
      {
        title: "VPN personnel — IP fixe France",
        desc: "Votre trafic sort par Marseille avec une adresse dédiée, rien qu'à vous. Activation en 30 secondes, configuration livrée par e-mail.",
      },
      {
        title: "Accès Pro — routeurs distants",
        desc: "Le même tunnel posé sur vos routeurs MikroTik supervisés : administration, API et SSH à distance, sans exposer une seule interface sur Internet.",
      },
      {
        title: "LAN étendu — caméras & NAS",
        desc: "L'Accès Pro étend le tunnel à votre réseau local : caméras, NAS et imprimantes restent joignables en privé, où que vous soyez.",
      },
      {
        title: "Une console, une boutique",
        desc: "Un code e-mail à 6 chiffres suffit : achats, renouvellement 1-clic et portefeuille d'appareils — VPN et Accès Pro au même endroit.",
      },
    ],
    panel: {
      title: "Tunnel WireGuard · Marseille",
      rows: [
        { name: "VPN personnel", detail: "IP fixe France dédiée", state: "Actif" },
        { name: "Accès Pro · Routeurs", detail: "Supervision distante", state: "Actif" },
        { name: "LAN étendu · Caméras & NAS", detail: "Extension privée", state: "Chiffré" },
      ],
      console: "Ouvrir la console",
      shop: "Voir la boutique",
    },
  },
  fleet: {
    kicker: "Parc & flotte",
    title: "Votre parc MikroTik, sans quitter la console.",
    body: "L'agent 403Shield sort du routeur vers le cloud : il fonctionne derrière CGNAT, Orange ou Starlink, sans IP publique ni port ouvert. Puis chaque routeur se pilote à distance — jusqu'à la mise à jour RouterOS de toute la flotte.",
    feats: [
      {
        title: "Mise à jour RouterOS en 1 clic",
        desc: "Vérifiez la dernière version et installez-la routeur par routeur — ou tout le parc détecté en retard, d'un seul geste.",
      },
      {
        title: "Télémétrie en continu",
        desc: "CPU, mémoire, uptime, version RouterOS et qualité de ligne de chaque routeur, rafraîchis à chaque check-in.",
      },
      {
        title: "Alertes qui ne dorment pas",
        desc: "Routeur hors ligne, stock de vouchers bas, rapport quotidien : Telegram, WhatsApp ou e-mail.",
      },
    ],
    panel: {
      title: "Parc routeurs",
      rows: [
        { name: "Café du Plateau", version: "7.24.3", state: "À jour", upToDate: true },
        { name: "Hôtel Ébène", version: "7.16.2 → 7.24.3", state: "Mise à jour prête", upToDate: false },
        { name: "Cyber Marché", version: "7.24.3", state: "À jour", upToDate: true },
      ],
      checkAll: "Vérifier tout le parc",
      updateAll: "Mettre à jour le parc",
    },
  },
  stats: [
    { value: 500, label: "vouchers par lot" },
    { value: 4, label: "boucliers pare-feu" },
    { value: 54, label: "pays africains visés" },
    // N°321 — le 4e chiffre porte le message unifié du tunnel.
    { value: 2, label: "usages du tunnel — VPN & Accès Pro" },
  ],
  pricing: {
    eyebrow: "Tarifs",
    title: "Un abonnement, un tunnel.",
    subtitle:
      "Exploitez un réseau public ou protégez votre foyer : c'est le MÊME abonnement console — le mode HomeNet applique le tarif foyer sur la même formule. Les tunnels WireGuard se commandent sur la boutique dédiée, et l'essai reste offert.",
    modesLabel: "Console ou boutique ?",
    segments: [
      {
        id: "hotspot",
        label: "Hotspot · HomeNet",
        hint: "Hôtels, cybercafés, maquis, boutiques, campus… : vouchers, portail captif et vente d'accès avec vos revendeurs. Un foyer ? C'est le même abonnement en mode HomeNet, au tarif réduit sur la même formule.",
        audience: ["Hôtels", "Cybercafés", "Maquis", "Boutiques", "Campus", "Restaurants", "Foyers"],
        plans: [
      {
        name: "Découverte",
        price: "0",
        period: "FCFA · 60 jours",
        tagline: "Pour découvrir 403Shield sans risque",
        cta: "Commencer gratuitement",
        highlight: false,
        features: [
          "1 routeur · toutes les fonctions",
          "4 protections incluses",
          "Mode Vente & revendeurs",
          "Mode foyer (HomeNet) : essai 30 jours",
          "Sans carte bancaire",
        ],
      },
      {
        name: "Hotspot Annuel",
        price: "25 000",
        period: "FCFA / an",
        tagline: "Tous vos routeurs, un seul prix",
        cta: "Passer à l'annuel",
        highlight: true,
        badge: "Le plus choisi",
        features: [
          "Routeurs illimités",
          "4 protections sur tout le parc",
          "Mode foyer (HomeNet) : 12 000 F/an",
          "Mises à jour RouterOS de flotte",
          "Notifications Telegram & WhatsApp",
          "Support prioritaire",
        ],
      },
      {
        name: "Hotspot Mensuel",
        price: "2 500",
        period: "FCFA / mois / routeur",
        tagline: "Payez au fil de votre croissance",
        cta: "Choisir le mensuel",
        highlight: false,
        features: [
          "Par routeur actif",
          "Mode foyer (HomeNet) : 1 250 F/mois/routeur",
          "Sans engagement",
          "Résiliable à tout moment",
          "Toutes les fonctions incluses",
        ],
      },
        ],
      },
      /* N°321 — segment boutique : les Tunnels WireGuard. Prix catalogue =
         constantes produit réelles du backend (publicvpnorder.go : b2c
         1500/15000, pro 3500/35000 FCFA). Les CTA pointent sur la
         boutique/console — le tunnel s'achète là-bas, pas via la modale
         d'inscription SaaS. N°322 — 2e segment du sélecteur, l'abonnement
         console (Hotspot · HomeNet) étant le premier. */
      {
        id: "tunnels",
        label: "Tunnels · boutique",
        hint: "Un seul tunnel WireGuard, deux usages : VPN personnel à IP fixe France et Accès Pro pour vos routeurs, caméras et NAS. Achat sur la boutique dédiée, payable Wave ou carte.",
        plans: [
          {
            name: "VPN Mensuel",
            price: "1 500",
            period: "FCFA / mois",
            tagline: "Sans engagement, mois par mois",
            cta: "Acheter sur la boutique",
            highlight: false,
            href: "https://console.403shield.ftci.fr/shop",
            features: [
              "IP fixe France dédiée",
              "WireGuard — activation en 30 s",
              "Paiement Wave ou carte",
              "Configuration livrée par e-mail",
            ],
          },
          {
            name: "VPN Annuel",
            price: "15 000",
            period: "FCFA / an",
            tagline: "12 mois au prix de 10",
            badge: "2 mois offerts",
            highlight: true,
            href: "https://console.403shield.ftci.fr/shop",
            cta: "Acheter sur la boutique",
            features: [
              "IP fixe France dédiée",
              "WireGuard — activation en 30 s",
              "Renouvellement en 1 clic",
              "Console sans mot de passe",
            ],
          },
          {
            name: "Accès Pro",
            price: "3 500",
            period: "FCFA / mois · 35 000 / an",
            tagline: "Vos routeurs, caméras et NAS dans le tunnel",
            cta: "Souscrire l'Accès Pro",
            highlight: false,
            href: "https://console.403shield.ftci.fr/pro",
            features: [
              "Supervision distante des routeurs MikroTik",
              "LAN étendu — caméras & NAS",
              "Même tunnel WireGuard, même console",
              "Derrière CGNAT, sans port ouvert",
            ],
          },
        ],
      },
    ],
    currencyNote:
      "Frais de paiement répercutés sur le prix de liste : carte +6 %, Wave −3 % (remise mobile money). Un abonnement console, deux modes : essai 60 jours en Hotspot · 30 jours en HomeNet — le foyer paie le tarif réduit sur la même formule. Tunnels WireGuard (VPN & Accès Pro) : prix catalogue boutique, remise mobile money incluse.",
  },
  chat: {
    fabLabel: "Discuter avec l'assistant",
    openLabel: "Ouvrir la discussion",
    closeLabel: "Fermer la discussion",
    tease: "Une question ? Écrivez-la ici !",
    title: "Assistant 403Shield",
    statusBot: "Assistant · réponses instantanées",
    statusHuman: "Un conseiller vous répond",
    statusClosed: "Conversation clôturée",
    placeholder: "Écrivez votre message…",
    send: "Envoyer",
    humanBtn: "Parler à un humain",
    newConv: "Nouvelle conversation",
    handoffNote: "Transmis à l'équipe 403Shield — vos prochains messages partent directement au conseiller.",
    closedNote: "Cette conversation est terminée. À bientôt sur 403Shield !",
    suggestions: [
      "Hotspot ou HomeNet ?",
      "Quels sont les tarifs ?",
      "Quel routeur faut-il ?",
      "Essai gratuit ?",
    ],
    agentBadge: "Support",
    inputLabel: "Votre message",
    sendError: "Échec d'envoi — réessayez",
  },
  finalCta: {
    kicker: "Prêt·e à passer au niveau supérieur ?",
    title: "Blindez votre réseau en moins de 5 minutes.",
    subtitle:
      "Créez votre compte, collez le script agent sur votre routeur, activez vos protections. Besoin d'un VPN ? La boutique livre une configuration WireGuard en 30 secondes. Sans carte bancaire, sans serveur à maintenir.",
    primary: "Créer mon compte gratuit",
    secondary: "Se connecter",
  },
  footer: {
    tagline:
      "La suite sécurité réseau cloud : Hotspot, protection et tunnels WireGuard — VPN & Accès Pro — powered by FTech CI.",
    columns: [
      {
        title: "Produit",
        links: [
          { label: "Hotspot", href: "/hotspot" },
          // N°321 — la famille tunnels est explicite dans les libellés : le VPN
          // et l'Accès Pro sont les deux usages du MÊME tunnel WireGuard.
          { label: "VPN — Tunnels WireGuard", href: "/vpn" },
          { label: "Accès Pro — Tunnels WireGuard", href: "/tunnels" },
          { label: "Protection cloud", href: "/#protection" },
          { label: "Tarifs", href: "/#tarifs" },
        ],
      },
      {
        title: "Console",
        links: [
          { label: "Se connecter", href: "/login" },
          { label: "Mode Vente", href: "/sell" },
          { label: "Connexion WiFi jetable", href: "/wifi" },
          // N°304 — documentation publique d'exploitation.
          { label: "Guides d'exploitation", href: "/docs/guides" },
        ],
      },
      {
        title: "Légal",
        links: [{ label: "Politique de confidentialité", href: "/legal/confidentialite" }],
      },
      {
        // N°317 — écosystème : maison-mère FTech CI, console et boutique VPN.
        // N°321 — URLs canoniques console.403shield.ftci.fr (tunnel.ftci.fr
        // répond 301 depuis N°320 — on évite le saut supplémentaire).
        title: "Écosystème",
        links: [
          { label: "FTech CI", href: "https://ftci.fr", external: true },
          { label: "Console 403Shield", href: "https://console.403shield.ftci.fr", external: true },
          { label: "Boutique VPN", href: "https://console.403shield.ftci.fr/shop", external: true },
        ],
      },
    ],
    legal: "Politique de confidentialité",
  },

  /* N°317 — pages produit du site unifié (/hotspot, /vpn, /tunnels). */
  pages: {
    hotspot: {
      meta: {
        title: "403Shield Hotspot — WiFi public rentable et blindé",
        description:
          "Vouchers par lots de 500, portail captif 100 % à votre marque, Mode Vente et revendeurs, 4 boucliers pare-feu : exploitez un WiFi public rentable, piloté depuis le cloud.",
      },
      hero: {
        badge: "403Shield Hotspot",
        title1: "Votre WiFi public,",
        titleAccent: "rentable",
        title2: "et blindé.",
        subtitle:
          "Hôtels, cybercafés, maquis, boutiques, campus : vendez l'accès internet par vouchers, à votre marque, avec vos revendeurs — pendant que quatre boucliers pare-feu veillent sur le réseau. Essai gratuit 60 jours, sans carte bancaire.",
        ctaPrimary: "Démarrer l'essai gratuit",
        ctaPrimaryHref: "#signup",
        ctaSecondary: "Voir les tarifs",
        ctaSecondaryHref: "/#tarifs",
      },
      features: {
        eyebrow: "Ce que fait 403Shield Hotspot",
        title: "Le WiFi public, transformé en business.",
        cards: [
          {
            title: "Portail captif 100 % à votre marque",
            desc: "Mode commercial avec grille tarifaire et paiement Wave, ou mode hospitalité avec promos et réseaux sociaux. Vos clients ne voient que vous.",
          },
          {
            title: "Vouchers & forfaits",
            desc: "Durée, quota de données, débit, 1 à 10 appareils — et à l'épuisement : couper ou brider en douceur. Jusqu'à 500 vouchers par lot.",
          },
          {
            title: "Mode Vente & revendeurs",
            desc: "Vos revendeurs vendent depuis leur téléphone : PWA protégée par PIN, stock transféré, ventes hors-ligne, rapport de journée.",
          },
          {
            title: "Statistiques en direct",
            desc: "Affluence horaire, revenus, marge par profil, canaux directs et revendeurs — tout ce qui se mesure se pilote.",
          },
        ],
      },
      cta: {
        kicker: "Prêt à lancer votre hotspot ?",
        title: "60 jours d'essai, sans carte bancaire.",
        body: "Créez votre compte, collez le script agent sur votre routeur MikroTik, configurez votre premier forfait. Sans serveur à maintenir, sans Winbox.",
        primary: "Créer mon compte gratuit",
        primaryHref: "#signup",
        secondary: "Voir les tarifs",
        secondaryHref: "/#tarifs",
      },
    },
    vpn: {
      meta: {
        title: "403Shield VPN — IP fixe France sur WireGuard",
        description:
          "Un VPN WireGuard qui sort par notre serveur de Marseille avec une IP fixe France dédiée. Activation en 30 secondes, paiement Wave ou carte, géré depuis votre espace sans mot de passe.",
      },
      hero: {
        // N°321 — badge famille : le VPN est un usage du tunnel WireGuard 403Shield.
        badge: "Tunnels WireGuard · VPN",
        title1: "Une IP fixe France.",
        titleAccent: "À vous seul.",
        title2: "",
        subtitle:
          "Votre trafic, chiffré de bout en bout par WireGuard, sort par notre serveur de Marseille avec une adresse IP dédiée. Activation en 30 secondes — sans toucher à un fichier de configuration. Et pour joindre vos routeurs, caméras ou NAS : l'Accès Pro étend ce même tunnel.",
        ctaPrimary: "Acheter mon VPN",
        ctaPrimaryHref: "https://console.403shield.ftci.fr/shop",
        ctaSecondary: "Découvrir les tunnels",
        ctaSecondaryHref: "/tunnels",
      },
      features: {
        eyebrow: "Pourquoi 403Shield VPN",
        title: "Le VPN qui ne vous enferme pas.",
        cards: [
          {
            title: "IP fixe dédiée",
            desc: "Une adresse française rien qu'à vous : banques, services publics et plateformes qui refusent les IP partagées vous reconnaissent enfin.",
          },
          {
            title: "WireGuard, audité et léger",
            desc: "Le protocole moderne, plus rapide et plus léger que les VPN d'ancienne génération. Votre configuration reste votre propriété.",
          },
          {
            title: "Mobile Money & carte",
            desc: "Payez en Wave ou par carte bancaire, en FCFA. Le provisioning est automatique : la configuration part par e-mail dès l'encaissement confirmé.",
          },
          {
            title: "Sans mot de passe",
            desc: "Un code à 6 chiffres reçu par e-mail suffit : achats, renouvellement 1-clic et récupération de configuration depuis votre espace.",
          },
        ],
      },
      note: {
        // N°321 — la note porte le message unifié : un tunnel, deux usages.
        title: "Un seul tunnel, deux usages.",
        body: "Mensuel sans engagement, ou annuel — 10 mois payés, 2 offerts. Prix en FCFA sur la boutique, remise mobile money incluse. Et quand vos réseaux doivent passer par le même chemin : l'Accès Pro étend ce même tunnel WireGuard à vos routeurs, caméras et NAS — même console, même boutique.",
      },
      cta: {
        kicker: "Prêt à chiffrer votre trafic ?",
        title: "Votre configuration part par e-mail en 30 secondes.",
        body: "Choisissez votre formule sur la boutique, payez en Wave ou par carte : la configuration WireGuard complète arrive par e-mail, prête à importer.",
        primary: "Acheter mon VPN",
        primaryHref: "https://console.403shield.ftci.fr/shop",
        secondary: "J'ai déjà un VPN — mon espace",
        secondaryHref: "https://console.403shield.ftci.fr",
      },
    },
    tunnels: {
      meta: {
        // N°321 — hub de la famille : le meta couvre les DEUX usages du tunnel.
        title: "403Shield Tunnels WireGuard — VPN IP fixe France & Accès Pro : routeurs, caméras, NAS",
        description:
          "Un seul tunnel WireGuard chiffré, hébergé à Marseille : VPN personnel à IP fixe France et Accès Pro pour superviser routeurs MikroTik, caméras et NAS. Console sans mot de passe, payable en Mobile Money.",
      },
      hero: {
        badge: "Tunnels WireGuard",
        title1: "Un seul tunnel.",
        titleAccent: "Deux usages.",
        title2: "",
        subtitle:
          "VPN personnel à IP fixe France, Accès Pro pour vos routeurs, LAN étendu pour caméras et NAS : le même tunnel WireGuard chiffré de bout en bout, hébergé à Marseille — une console, une boutique, un abonnement. Achat, gestion et renouvellement au même endroit.",
        ctaPrimary: "Acheter mon VPN",
        ctaPrimaryHref: "https://console.403shield.ftci.fr/shop",
        // Lien croisé interne : la page VPN (usage personnel) reste à un clic
        // du hub famille — la console, elle, vit dans le CTA final ci-dessous.
        ctaSecondary: "Découvrir le VPN",
        ctaSecondaryHref: "/vpn",
      },
      features: {
        eyebrow: "Pourquoi 403Shield Tunnels",
        title: "Le pont privé entre vous et vos réseaux.",
        cards: [
          {
            // N°321 — carte pivot : le VPN présenté comme le MÊME tunnel.
            title: "VPN personnel — le même tunnel",
            desc: "Votre trafic chiffré de bout en bout sort par Marseille avec une IP fixe France dédiée. C'est le même WireGuard, la même console — que vous protégiez vos déplacements ou supervisiez un parc.",
          },
          {
            title: "Accès Pro — routeurs",
            desc: "Supervision distante de vos routeurs MikroTik à travers le tunnel — sans exposer votre interface d'administration sur Internet.",
          },
          {
            title: "LAN étendu — caméras & NAS",
            desc: "L'Accès Pro étend le tunnel à votre LAN : caméras, NAS et autres équipements restent joignables en privé, jamais exposés.",
          },
          {
            title: "Une console, une boutique",
            desc: "Un code e-mail à 6 chiffres suffit : espace client, portefeuille d'appareils, renouvellement 1-clic — VPN et Accès Pro vivent au même endroit.",
          },
        ],
      },
      cta: {
        kicker: "Vos réseaux vous attendent",
        title: "Ouvrez votre tunnel en moins de 5 minutes.",
        body: "Code e-mail, boutique Wave/carte, configuration livrée par e-mail : le tunnel s'installe sans toucher à un fichier de configuration.",
        primary: "Ouvrir la console",
        primaryHref: "https://console.403shield.ftci.fr",
        secondary: "Voir la boutique VPN",
        secondaryHref: "https://console.403shield.ftci.fr/shop",
      },
    },
  },
};

const en: LandingCopy = {
  rail: {
    home: "Home",
    powers: "Superpowers",
    protection: "Protection",
    hotspot: "Hotspot",
    // N°321 — the unified tunnel joins the rail: VPN & Pro Access, one service.
    tunnels: "WireGuard tunnels",
    fleet: "Router fleet",
    pricing: "Pricing",
  },
  header: {
    brand: "403Shield",
    signIn: "Sign in",
    signUp: "Free trial",
    langLabel: "FR",
    homeLink: "Back to home",
    nav: {
      home: "Home",
      hotspot: "Hotspot",
      vpn: "VPN",
      // N°321 — family label: the nav carries ONE "WireGuard tunnels" entry
      // (→ /tunnels); the /vpn page stays linked from /tunnels, the footer,
      // the tunnels section and the pricing segment.
      tunnels: "WireGuard tunnels",
      pricing: "Pricing",
    },
  },
  hero: {
    badge: "403Shield · Hotspot · VPN · Tunnels",
    title1: "Your network,",
    titleAccent: "shielded.",
    title2: "",
    subtitle:
      "Error 403 is for the others. A revenue-ready public Hotspot, four cloud firewall shields, and a single WireGuard tunnel for every use — a personal VPN with a fixed French IP, Pro Access for your routers, cameras and NAS: 403Shield brings together a complete network security suite for nomadic workers, businesses and households — powered by FTech CI.",
    ctaPrimary: "Protect my network",
    ctaSecondary: "Explore the suite",
    trialHint: "Free trial · no credit card — 60 days Hotspot · 30 days HomeNet",
    chips: ["Error 403 — for the others", "4/4 protections active", "WireGuard tunnels · fixed French IP"],
  },
  marquee: [
    "Vouchers & access codes",
    "WireGuard VPN · fixed French IP",
    "Quad9 DNS filtering",
    "One tunnel, two uses",
    "WiFi anti-hacking",
    "Pro remote access — routers, cameras, NAS",
    "Internet curfew",
    "HomeNet mode · your household, same subscription",
    "VPN blocker",
    "QoS & ISP plan",
    "Reseller Sell Mode",
    "RouterOS updates",
    "White-label captive portal",
    "Wave & Mobile Money payments",
  ],
  powers: {
    // N°321 — four pillars: WireGuard tunnels join the pantheon (the landing
    // is no longer frozen on the hotspot era).
    eyebrow: "One suite, four pillars",
    title: "Everything you need to rule your network.",
    subtitle:
      "A profitable Hotspot, cloud protection, fleet control and WireGuard tunnels: 403Shield gathers in a single suite everything your infrastructure demands — no Winbox, no server to maintain.",
    cards: [
      {
        tag: "Foundation",
        title: "Hotspot Management",
        desc: "The suite's founding pillar: white-label captive portals, batch vouchers, per-plan quotas and throttling, live sessions.",
        items: [
          "100% white-label captive portal",
          "Voucher batches up to 500",
          "Quota, bandwidth & duration per plan",
          "Sell Mode & PIN-protected resellers",
        ],
      },
      {
        tag: "4 shields",
        title: "Cloud Protection",
        desc: "Four firewall protections deployed right on your routers, driven and self-healed from the cloud every six hours.",
        items: [
          "SafeWiFi — Quad9 / AdGuard DNS filtering",
          "Shield — admin ports locked down",
          "FamilyGuard — scheduled internet curfew",
          "AntiVPN — tunnels cut, WhatsApp intact",
        ],
      },
      {
        tag: "Fleet",
        title: "Fleet Control",
        desc: "Live telemetry, one-click RouterOS updates — router by router or the whole fleet at once — and continuously measured line quality.",
        items: [
          "RouterOS updates without Winbox",
          "CPU, memory & uptime telemetry",
          "Aggregate QoS & ISP plan",
          "IP pool doctor & self-healing",
        ],
      },
      {
        tag: "WireGuard",
        title: "WireGuard Tunnels",
        desc: "One encrypted tunnel, two uses: a personal VPN with a fixed French IP and Pro Access for your routers, cameras and NAS — one console, one shop, one subscription.",
        items: [
          "Personal VPN · dedicated fixed French IP",
          "Pro Access — routers, cameras, NAS",
          "Passwordless console · email code",
          "Hosted in Marseille · encrypted end-to-end",
        ],
      },
    ],
  },
  protection: {
    kicker: "Cloud protection",
    title: "The shield that watches while you sleep.",
    body: "Every protection is signature-checked and automatically repaired every six hours. Nothing to install, no Winbox needed: your existing rules are preserved, and the WiFi keeps working no matter what.",
    feats: [
      {
        title: "SafeWiFi — dangerous sites blocked",
        desc: "Viruses, scams and ads stopped at the DNS level (Quad9 or AdGuard Family) — DoH and IPv6 escape hatches are closed.",
      },
      {
        title: "Shield — WiFi anti-hacking",
        desc: "Your routers' admin ports and Windows file sharing become unreachable from the public WiFi.",
      },
      {
        title: "FamilyGuard — internet curfew",
        desc: "All client internet is cut during the scheduled window, for instance 10 pm to 6 am.",
      },
      {
        title: "AntiVPN — tunnels cut",
        desc: "WireGuard, OpenVPN, IPsec and Tor blocked — WhatsApp calls stay intact.",
      },
    ],
    panel: {
      title: "Protection center",
      scoreLabel: "Protection score",
      scoreVerdict: "Well protected",
      stats: [
        { value: "4", label: "protections on" },
        { value: "6 h", label: "self-healing" },
        { value: "45 s", label: "agent check-in" },
      ],
      lines: [
        { name: "SafeWiFi · DNS filtering", state: "Active" },
        { name: "Shield · Anti-hacking", state: "Active" },
        { name: "FamilyGuard · Curfew", state: "10 pm → 6 am" },
        { name: "AntiVPN · VPN blocker", state: "Active" },
      ],
      repairLine: { name: "Cloud self-healing", state: "Checked 2 min ago" },
    },
  },
  hotspot: {
    kicker: "Hotspot management",
    title: "A captive portal you'll be proud of.",
    body: "Give your customers a smooth, polished connection — under your brand, with zero 403Shield mention. Duration, quota or multi-device vouchers: you keep total control. Your resellers? They sell straight from their phone: PIN-protected PWA, transferred stock, offline sales, end-of-day report.",
    audience: ["Hotels", "Cybercafés", "Bars", "Shops", "Campuses", "Restaurants"],
    audienceLabel: "Who is it for?",
    feats: [
      {
        title: "100% custom branding",
        desc: "Commercial mode with price grid and Wave payments, or hospitality mode with promos and social links.",
      },
      {
        title: "Vouchers & plans",
        desc: "Duration, data quota, bandwidth, 1 to 10 devices — and when exhausted: cut off or softly throttle.",
      },
      {
        title: "Live statistics",
        desc: "Hourly footfall, revenue, margin per plan, direct and reseller channels.",
      },
    ],
    panel: {
      title: "Hourly footfall",
      online: "Peak hour · 7 pm",
      peak: "24 h",
    },
  },
  /* N°321 — THE unified service: personal VPN and Pro Access rendered as
     two uses of ONE WireGuard tunnel (same console, same shop). */
  tunnels: {
    kicker: "WireGuard tunnels",
    title: "One encrypted tunnel, every network of yours.",
    body: "The 403Shield VPN and Pro Access are one and the same: a single WireGuard tunnel, hosted in Marseille and encrypted end-to-end. On your phone, it shields your traffic and hands you a fixed French IP; wired to your networks, it becomes Pro Access — routers, cameras and NAS reachable privately, even behind CGNAT. One console, one shop, one subscription: everything lives in the same place.",
    feats: [
      {
        title: "Personal VPN — fixed French IP",
        desc: "Your traffic exits through Marseille with a dedicated address, yours alone. 30-second activation, configuration delivered by email.",
      },
      {
        title: "Pro Access — remote routers",
        desc: "The same tunnel laid onto your supervised MikroTik routers: administration, API and SSH from anywhere — without exposing a single interface to the Internet.",
      },
      {
        title: "Extended LAN — cameras & NAS",
        desc: "Pro Access extends the tunnel to your local network: cameras, NAS and printers stay privately reachable, wherever you are.",
      },
      {
        title: "One console, one shop",
        desc: "A 6-digit email code is enough: purchases, 1-click renewal and device wallet — VPN and Pro Access in the same place.",
      },
    ],
    panel: {
      title: "WireGuard tunnel · Marseille",
      rows: [
        { name: "Personal VPN", detail: "Dedicated fixed French IP", state: "Active" },
        { name: "Pro Access · Routers", detail: "Remote supervision", state: "Active" },
        { name: "Extended LAN · Cameras & NAS", detail: "Private extension", state: "Encrypted" },
      ],
      console: "Open the console",
      shop: "Visit the shop",
    },
  },
  fleet: {
    kicker: "Fleet & routers",
    title: "Your MikroTik fleet, without leaving the console.",
    body: "The 403Shield agent dials out from the router to the cloud: it works behind CGNAT, Orange or Starlink, with no public IP and no open port. Then every router is remote-controlled — down to fleet-wide RouterOS updates.",
    feats: [
      {
        title: "One-click RouterOS updates",
        desc: "Check the latest version and install it router by router — or every router found behind, in a single move.",
      },
      {
        title: "Continuous telemetry",
        desc: "CPU, memory, uptime, RouterOS version and line quality for each router, refreshed on every check-in.",
      },
      {
        title: "Alerts that never sleep",
        desc: "Router offline, low voucher stock, daily report: Telegram, WhatsApp or email.",
      },
    ],
    panel: {
      title: "Router fleet",
      rows: [
        { name: "Plateau Café", version: "7.24.3", state: "Up to date", upToDate: true },
        { name: "Ebony Hotel", version: "7.16.2 → 7.24.3", state: "Update ready", upToDate: false },
        { name: "Market Cyber", version: "7.24.3", state: "Up to date", upToDate: true },
      ],
      checkAll: "Check the whole fleet",
      updateAll: "Update the fleet",
    },
  },
  stats: [
    { value: 500, label: "vouchers per batch" },
    { value: 4, label: "firewall shields" },
    { value: 54, label: "African countries" },
    // N°321 — the 4th figure carries the unified tunnel message.
    { value: 2, label: "uses of the tunnel — VPN & Pro Access" },
  ],
  pricing: {
    eyebrow: "Pricing",
    title: "One subscription, one tunnel.",
    subtitle:
      "Run a public network or shield your home: it's the SAME console subscription — HomeNet mode applies the household rate to the same plan. WireGuard tunnels are ordered on the dedicated shop, and the trial stays free.",
    modesLabel: "Console or shop?",
    segments: [
      {
        id: "hotspot",
        label: "Hotspot · HomeNet",
        hint: "Hotels, cybercafés, bars, shops, campuses…: vouchers, captive portal and access sales through your resellers. A household? It's the same subscription in HomeNet mode, at the reduced rate on the same plan.",
        audience: ["Hotels", "Cybercafés", "Bars", "Shops", "Campuses", "Restaurants", "Households"],
        plans: [
      {
        name: "Discovery",
        price: "0",
        period: "FCFA · 60 days",
        tagline: "To discover 403Shield risk-free",
        cta: "Start for free",
        highlight: false,
        features: [
          "1 router · every feature",
          "4 protections included",
          "Sell Mode & resellers",
          "HomeNet mode (household): 30-day trial",
          "No credit card",
        ],
      },
      {
        name: "Hotspot Yearly",
        price: "25,000",
        period: "FCFA / year",
        tagline: "All your routers, one single price",
        cta: "Go yearly",
        highlight: true,
        badge: "Most popular",
        features: [
          "Unlimited routers",
          "4 protections across the fleet",
          "HomeNet mode (household): 12,000 F/year",
          "Fleet RouterOS updates",
          "Telegram & WhatsApp alerts",
          "Priority support",
        ],
      },
      {
        name: "Hotspot Monthly",
        price: "2,500",
        period: "FCFA / month / router",
        tagline: "Pay as you grow",
        cta: "Choose monthly",
        highlight: false,
        features: [
          "Per active router",
          "HomeNet mode (household): 1,250 F/month/router",
          "No commitment",
          "Cancel anytime",
          "Every feature included",
        ],
      },
        ],
      },
      /* N°321 — shop segment: WireGuard tunnels. Catalogue prices = real
         backend product constants (publicvpnorder.go: b2c 1500/15000,
         pro 3500/35000 FCFA). CTAs point to the shop/console — the tunnel
         is bought there, not through the SaaS signup modal. N°322 — 2nd
         selector segment, the console subscription (Hotspot · HomeNet)
         being the first. */
      {
        id: "tunnels",
        label: "Tunnels · shop",
        hint: "One WireGuard tunnel, two uses: a personal VPN with a fixed French IP and Pro Access for your routers, cameras and NAS. Ordered on the dedicated shop, payable with Wave or card.",
        plans: [
          {
            name: "VPN Monthly",
            price: "1,500",
            period: "FCFA / month",
            tagline: "No commitment, month by month",
            cta: "Buy on the shop",
            highlight: false,
            href: "https://console.403shield.ftci.fr/shop",
            features: [
              "Dedicated fixed French IP",
              "WireGuard — 30 s activation",
              "Wave or card payment",
              "Configuration delivered by email",
            ],
          },
          {
            name: "VPN Yearly",
            price: "15,000",
            period: "FCFA / year",
            tagline: "12 months for the price of 10",
            badge: "2 months free",
            highlight: true,
            href: "https://console.403shield.ftci.fr/shop",
            cta: "Buy on the shop",
            features: [
              "Dedicated fixed French IP",
              "WireGuard — 30 s activation",
              "1-click renewal",
              "Passwordless console",
            ],
          },
          {
            name: "Pro Access",
            price: "3,500",
            period: "FCFA / month · 35,000 / year",
            tagline: "Your routers, cameras and NAS in the tunnel",
            cta: "Subscribe to Pro Access",
            highlight: false,
            href: "https://console.403shield.ftci.fr/pro",
            features: [
              "Remote supervision of MikroTik routers",
              "Extended LAN — cameras & NAS",
              "Same WireGuard tunnel, same console",
              "Behind CGNAT, no open port",
            ],
          },
        ],
      },
    ],
    currencyNote:
      "Payment fees passed through the list price: card +6%, Wave −3% (mobile money discount). One console subscription, two modes: 60-day trial in Hotspot · 30-day in HomeNet — the household pays the reduced rate on the same plan. WireGuard tunnels (VPN & Pro Access): shop catalogue prices, mobile money discount included.",
  },
  chat: {
    fabLabel: "Chat with the assistant",
    openLabel: "Open the conversation",
    closeLabel: "Close the conversation",
    tease: "Got a question? Ask away!",
    title: "403Shield Assistant",
    statusBot: "Assistant · instant answers",
    statusHuman: "An advisor is replying to you",
    statusClosed: "Conversation closed",
    placeholder: "Type your message…",
    send: "Send",
    humanBtn: "Talk to a human",
    newConv: "New conversation",
    handoffNote: "Forwarded to the 403Shield team — your next messages go straight to the advisor.",
    closedNote: "This conversation is over. See you soon on 403Shield!",
    suggestions: [
      "Hotspot or HomeNet?",
      "What are the prices?",
      "Which router do I need?",
      "Free trial?",
    ],
    agentBadge: "Support",
    inputLabel: "Your message",
    sendError: "Sending failed — try again",
  },
  finalCta: {
    kicker: "Ready to level up?",
    title: "Shield your network in under 5 minutes.",
    subtitle:
      "Create your account, paste the agent script on your router, switch on your protections. Need a VPN? The shop delivers a WireGuard configuration within 30 seconds. No credit card, no server to maintain.",
    primary: "Create my free account",
    secondary: "Sign in",
  },
  footer: {
    tagline:
      "The cloud network-security suite: Hotspot, protection and WireGuard tunnels — VPN & Pro Access — powered by FTech CI.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Hotspot", href: "/hotspot" },
          // N°321 — the tunnels family is explicit in the labels: the VPN and
          // Pro Access are the two uses of the SAME WireGuard tunnel.
          { label: "VPN — WireGuard tunnels", href: "/vpn" },
          { label: "Pro Access — WireGuard tunnels", href: "/tunnels" },
          { label: "Cloud protection", href: "/#protection" },
          { label: "Pricing", href: "/#tarifs" },
        ],
      },
      {
        title: "Console",
        links: [
          { label: "Sign in", href: "/login" },
          { label: "Sell Mode", href: "/sell" },
          { label: "Throwaway WiFi login", href: "/wifi" },
          // N°304 — public operations documentation.
          { label: "Operations guides", href: "/docs/guides" },
        ],
      },
      {
        title: "Legal",
        links: [{ label: "Privacy policy", href: "/legal/confidentialite" }],
      },
      {
        // N°317 — ecosystem: FTech CI parent company, console and VPN shop.
        // N°321 — canonical URLs console.403shield.ftci.fr (tunnel.ftci.fr
        // answers 301 since N°320 — we skip the extra hop).
        title: "Ecosystem",
        links: [
          { label: "FTech CI", href: "https://ftci.fr", external: true },
          { label: "403Shield Console", href: "https://console.403shield.ftci.fr", external: true },
          { label: "VPN shop", href: "https://console.403shield.ftci.fr/shop", external: true },
        ],
      },
    ],
    legal: "Privacy policy",
  },

  /* N°317 — product pages of the unified site (/hotspot, /vpn, /tunnels). */
  pages: {
    hotspot: {
      meta: {
        title: "403Shield Hotspot — revenue-ready, hardened public WiFi",
        description:
          "Batch vouchers up to 500, a 100% white-label captive portal, Sell Mode with resellers and four firewall shields: run a profitable public WiFi, driven from the cloud.",
      },
      hero: {
        badge: "403Shield Hotspot",
        title1: "Your public WiFi,",
        titleAccent: "profitable",
        title2: "and hardened.",
        subtitle:
          "Hotels, cybercafés, eateries, shops and campuses: sell internet access with vouchers, under your brand, through your resellers — while four firewall shields watch over the network. 60-day free trial, no credit card.",
        ctaPrimary: "Start the free trial",
        ctaPrimaryHref: "#signup",
        ctaSecondary: "See pricing",
        ctaSecondaryHref: "/#tarifs",
      },
      features: {
        eyebrow: "What 403Shield Hotspot does",
        title: "Public WiFi, turned into a business.",
        cards: [
          {
            title: "100% white-label captive portal",
            desc: "Commercial mode with rate card and Wave payments, or hospitality mode with promos and social links. Your customers only see you.",
          },
          {
            title: "Vouchers & plans",
            desc: "Duration, data quota, bandwidth, 1 to 10 devices — and on depletion: cut off or throttle gently. Up to 500 vouchers per batch.",
          },
          {
            title: "Sell Mode & resellers",
            desc: "Your resellers sell from their phone: PIN-protected PWA, transferred stock, offline sales, end-of-day report.",
          },
          {
            title: "Live statistics",
            desc: "Hourly footfall, revenue, margin per profile, direct and reseller channels — what gets measured gets managed.",
          },
        ],
      },
      cta: {
        kicker: "Ready to launch your hotspot?",
        title: "60 days free, no credit card.",
        body: "Create your account, paste the agent script onto your MikroTik router, configure your first plan. No server to maintain, no Winbox.",
        primary: "Create my free account",
        primaryHref: "#signup",
        secondary: "See pricing",
        secondaryHref: "/#tarifs",
      },
    },
    vpn: {
      meta: {
        title: "403Shield VPN — fixed French IP over WireGuard",
        description:
          "A WireGuard VPN exiting through our Marseille server with a dedicated fixed French IP. 30-second activation, Wave or card payment, managed from your passwordless account.",
      },
      hero: {
        // N°321 — family badge: the VPN is one use of the 403Shield WireGuard tunnel.
        badge: "WireGuard tunnels · VPN",
        title1: "A fixed French IP.",
        titleAccent: "Yours alone.",
        title2: "",
        subtitle:
          "Your traffic, end-to-end encrypted by WireGuard, exits through our Marseille server with a dedicated IP address. 30-second activation — without touching a single config file. And to reach your routers, cameras or NAS: Pro Access extends that very same tunnel.",
        ctaPrimary: "Buy my VPN",
        ctaPrimaryHref: "https://console.403shield.ftci.fr/shop",
        ctaSecondary: "Explore tunnels",
        ctaSecondaryHref: "/tunnels",
      },
      features: {
        eyebrow: "Why 403Shield VPN",
        title: "The VPN that doesn't lock you in.",
        cards: [
          {
            title: "Dedicated fixed IP",
            desc: "A French address just for you: banks, public services and platforms that reject shared IPs finally recognize you.",
          },
          {
            title: "WireGuard, audited & lightweight",
            desc: "The modern protocol, faster and lighter than legacy VPNs. Your configuration remains your property.",
          },
          {
            title: "Mobile Money & card",
            desc: "Pay with Wave or bank card, in FCFA. Provisioning is automatic: your configuration is emailed as soon as payment is confirmed.",
          },
          {
            title: "No password",
            desc: "A 6-digit code received by email is enough: purchases, 1-click renewal and configuration recovery from your account.",
          },
        ],
      },
      note: {
        // N°321 — the note carries the unified message: one tunnel, two uses.
        title: "One tunnel, two uses.",
        body: "Monthly with no commitment, or yearly — pay 10 months, get 2 offered. Prices in FCFA on the shop, mobile-money discount included. And when your networks need the same path: Pro Access extends this very WireGuard tunnel to your routers, cameras and NAS — same console, same shop.",
      },
      cta: {
        kicker: "Ready to encrypt your traffic?",
        title: "Your configuration is emailed within 30 seconds.",
        body: "Pick your plan on the shop, pay with Wave or card: the full WireGuard configuration arrives by email, ready to import.",
        primary: "Buy my VPN",
        primaryHref: "https://console.403shield.ftci.fr/shop",
        secondary: "I already have a VPN — my account",
        secondaryHref: "https://console.403shield.ftci.fr",
      },
    },
    tunnels: {
      meta: {
        // N°321 — family hub: the meta covers BOTH uses of the tunnel.
        title: "403Shield WireGuard Tunnels — fixed-IP VPN & Pro Access: routers, cameras, NAS",
        description:
          "One encrypted WireGuard tunnel hosted in Marseille: a personal VPN with a fixed French IP and Pro Access to supervise MikroTik routers, cameras and NAS. Passwordless console, payable with Mobile Money.",
      },
      hero: {
        badge: "WireGuard tunnels",
        title1: "One single tunnel.",
        titleAccent: "Two uses.",
        title2: "",
        subtitle:
          "A personal VPN with a fixed French IP, Pro Access for your routers, an extended LAN for cameras and NAS: the same end-to-end encrypted WireGuard tunnel, hosted in Marseille — one console, one shop, one subscription. Purchase, management and renewal in one place.",
        ctaPrimary: "Buy my VPN",
        ctaPrimaryHref: "https://console.403shield.ftci.fr/shop",
        // Internal cross-link: the VPN page (personal use) stays one click
        // from the family hub — the console lives in the final CTA below.
        ctaSecondary: "Explore the VPN",
        ctaSecondaryHref: "/vpn",
      },
      features: {
        eyebrow: "Why 403Shield Tunnels",
        title: "The private bridge between you and your networks.",
        cards: [
          {
            // N°321 — pivot card: the VPN presented as the SAME tunnel.
            title: "Personal VPN — the same tunnel",
            desc: "Your end-to-end encrypted traffic exits through Marseille with a dedicated fixed French IP. It is the same WireGuard, the same console — whether you shield your travels or supervise a fleet.",
          },
          {
            title: "Pro Access — routers",
            desc: "Remote supervision of your MikroTik routers through the tunnel — without exposing your admin interface to the Internet.",
          },
          {
            title: "Extended LAN — cameras & NAS",
            desc: "Pro Access extends the tunnel to your LAN: cameras, NAS and other equipment stay privately reachable, never exposed.",
          },
          {
            title: "One console, one shop",
            desc: "A 6-digit email code is enough: client area, device wallet, 1-click renewal — the VPN and Pro Access live in the same place.",
          },
        ],
      },
      cta: {
        kicker: "Your networks are waiting",
        title: "Open your tunnel in under 5 minutes.",
        body: "Email code, Wave/card shop, configuration delivered by email: the tunnel installs itself without touching a config file.",
        primary: "Open the console",
        primaryHref: "https://console.403shield.ftci.fr",
        secondary: "Browse the VPN shop",
        secondaryHref: "https://console.403shield.ftci.fr/shop",
      },
    },
  },
};

export const landingCopy: Record<Lang, LandingCopy> = { fr, en };
