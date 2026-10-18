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
// N°317 — rebrand : MikCloud & MikTunnel disparaissent au profit de la marque
// unifiée 403Shield (modèle Cloudflare/OVH : UN site marketing multipage à
// menu complet + UNE console transactionnelle). La vitrine devient le site
// unifié, endossée « powered by FTech CI » (ftci.fr).
//
// N°321 — les Tunnels WireGuard deviennent un PILIER de la page d'accueil et
// le VPN comme l'Accès Pro y sont présentés comme UNE SEULE offre « un
// tunnel, deux usages ». Prix catalogue tunnels (1 500 / 15 000 / 3 500 /
// 35 000 FCFA) = constantes produit réelles du backend (publicvpnorder.go).
//
// N°324 — le mode HomeNet est SUPPRIMÉ du système (décision propriétaire) :
// plateforme mono-mode Hotspot, la vitrine ne mentionne plus le foyer
// nulle part. Les protections famille (FamilyGuard, couvre-feu) restent
// disponibles sur tout routeur géré — seules les formules foyer disparaissent.
//
// N°325 — intégration du PR #70 « Enterprise Multi-Page Landing Page
// Redesign » (Jules, task 6313619506023410653) : header MegaMenu
// Produits/Solutions façon Cloudflare + drawer mobile, section « Extension
// ISP & Opérateurs », piliers étendus au Cybercafé/PPPoE. La refonte
// reflète les capacités RÉELLES du backend Go — Hotspot Cloud & vouchers
// 1-500 · Mode Vente revendeurs PIN · portail captif à votre marque ·
// Module Cybercafé (postes, import DHCP, temps, codes de session) ·
// Serveur PPPoE (provisionnement auto, secrets abonnés, reconnexion live) ·
// Protection Cloud (4 boucliers) · Tunnels WireGuard (VPN IP fixe Marseille,
// Accès Pro, LAN étendu) · Flotte & supervision (agent HTTP-poll, RouterOS
// unitaire + flotte, QoS, Docteur Pool IP) · Sécurité & comptabilité (2FA
// TOTP, multi-sites, bilans mensuels gelés, alertes Telegram/WhatsApp,
// paiements Wave & Stripe). Aucune mention foyer — doctrine N°324 maintenue.

export type Lang = "fr" | "en";

/* N°332-D — icône explicite du méga menu (fin du title.includes
   fragile : un rename de copy ne casse plus l'icône). */
export type MegaIconKey =
  | "wifi"
  | "monitor"
  | "server"
  | "shield"
  | "globe"
  | "cctv"
  | "router"
  | "building"
  | "users";

/* N°332-B — PAGES PRODUITS v2 : chaque feature devient une SECTION
   deep-linkable (règle d'or du plan N°332 : une ancre = une section
   vendable, kebab-case ASCII sans accent — la promesse du méga menu
   atterrit sur un écran entier qui la développe). Le gabarit v2 ajoute
   trust (badges VÉRIFIABLES sous le hero — doctrine : aucun faux
   chiffre, aucun témoignage inventé, consigne propriétaire N°332),
   steps (« comment ça marche » : montrer le parcours avant l'argent),
   pricing (titres seulement — les plans viennent de pricing.segments,
   SOURCE UNIQUE via PricingGrid), faq (objections réelles du marché)
   et guides (maillage bidirectionnel avec /docs/guides). */
export interface ProductFeatureSection {
  /** Ancre de section : kebab-case ASCII sans accent (#cybercafe, #acces-pro). */
  id: string;
  icon: "palette" | "ticket" | "store" | "chart" | "globe" | "lock" | "card" | "key" | "router" | "cctv" | "console";
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
}

export interface ProductPageCopy {
  meta: { title: string; description: string };
  hero: {
    badge: string;
    title1: string;
    titleAccent: string;
    title2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaPrimaryHref: string;
    ctaSecondary: string;
    ctaSecondaryHref: string;
    /** Badges de confiance vérifiables (faits produit, pas de métriques d'usage). */
    trust: string[];
  };
  features: {
    eyebrow: string;
    title: string;
    sections: ProductFeatureSection[];
  };
  note?: { title: string; body: string };
  steps: {
    eyebrow: string;
    title: string;
    items: { title: string; desc: string }[];
  };
  pricing: {
    eyebrow: string;
    /** Libellé court de la sous-nav (ex. « Tarifs »). */
    navLabel: string;
    title: string;
    subtitle: string;
  };
  faq: {
    eyebrow: string;
    /** Libellé court de la sous-nav (« FAQ » des deux langues). */
    navLabel: string;
    title: string;
    items: { q: string; a: string }[];
  };
  guides: {
    eyebrow: string;
    title: string;
    allLabel: string;
    items: { title: string; desc: string; href: string }[];
  };
  /** Partage WhatsApp/Web Share — libellé du bouton (canal n°1 du marché). */
  share: string;
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

export interface MegaMenuItem {
  title: string;
  desc: string;
  href: string;
  badge?: string;
  /** N°332-D — icône déclarée (table statique côté header). */
  icon?: MegaIconKey;
}

export interface MegaMenuCategory {
  title: string;
  items: MegaMenuItem[];
}

/* N°331 — carte tarifaire du mega menu « Tarifs » : chaque service affiche
   ses prix réels au survol du header (modèle Plans & Pricing cloudflare). */
export interface PricingCard {
  title: string;
  desc: string;
  /** Lignes de prix (entrée mensuelle puis annuel) — valeurs catalogue
      réelles, synchronisées sur pricing.segments et les constantes produit
      publiques de la boutique (publicvpnorder.go : b2c 1500/15000,
      pro 3500/35000 FCFA). */
  lines: string[];
  note: string;
  badge?: string;
  href: string;
  cta: string;
}

export interface LandingCopy {
  rail: {
    home: string;
    powers: string;
    protection: string;
    hotspot: string;
    tunnels: string;
    fleet: string;
    isp: string;
    pricing: string;
  };
  header: {
    brand: string;
    signIn: string;
    signUp: string;
    langLabel: string;
    homeLink: string;
    nav: {
      home: string;
      products: string;
      solutions: string;
      hotspot: string;
      tunnels: string;
      pricing: string;
      docs: string;
    };
    megaMenu: {
      products: MegaMenuCategory[];
      solutions: MegaMenuCategory[];
      /** N°331 — mega menu Tarifs : chaque service affiche ses prix. */
      pricing: {
        cards: PricingCard[];
        compare: string;
      };
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
    /** N°332-C — libellé du pied de lien des cartes (sommaire cliquable). */
    explore: string;
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
    audience: string[];
    audienceLabel: string;
    feats: { title: string; desc: string }[];
    panel: {
      title: string;
      online: string;
    };
  };
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
    };
    /** N°332-A — sortie honnête de la section : les faux boutons de la
        maquette deviennent un vrai lien vers le guide du pilotage. */
    guideCta: string;
  };
  ispExtension: {
    kicker: string;
    title: string;
    subtitle: string;
    feats: { title: string; desc: string; tag: string }[];
  };
  stats: { value: number; label: string }[];
  /* N°332-C — preuve sociale HONNÊTE (consigne propriétaire : AUCUN
     témoignage) : faits vérifiables + captures réelles de la console
     (public/docs/**). Ancrage émotionnel sans mensonge repérable. */
  trust: {
    eyebrow: string;
    title: string;
    subtitle: string;
    badges: string[];
    shots: { src: string; alt: string; caption: string }[];
  };
  /* N°332-C — FAQ de la vitrine : le visiteur hésite au moment du
     prix — les réponses sont placées AVANT le CTA final. */
  faq: {
    eyebrow: string;
    title: string;
    items: { q: string; a: string }[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    /** N°122 — aria-label du sélecteur de comptoir (console / boutique).
        N°324 — 2 segments : l'abonnement console (Hotspot) et la boutique
        tunnels. N°325 — le segment console s'étiquette « Hotspot ·
        Cybercafé » : le module cybercafé est inclus dans l'abonnement
        (N°290) — le foyer, lui, n'existe plus (N°324). */
    modesLabel: string;
    /** N°122 — tarifs segmentés par mode : chaque mode a ses 3 formules.
        N°321 — 3e segment « tunnels » (boutique dédiée, CTA liens externes).
        N°322 — le segment « homenet » est retiré (tarif foyer lié aux cartes
        Hotspot). N°324 — le mode HomeNet est SUPPRIMÉ du système : grille
        console mono-mode Hotspot, plus aucune mention foyer. */
    segments: {
      id: "hotspot" | "tunnels";
      label: string;
      hint: string;
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
        href?: string;
      }[];
    }[];
    currencyNote: string;
  };
  chat: {
    fabLabel: string;
    openLabel: string;
    closeLabel: string;
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
  };
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
    tunnels: "Tunnels WireGuard",
    fleet: "Parc routeurs",
    isp: "ISP & Opérateurs",
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
      products: "Produits",
      solutions: "Solutions",
      hotspot: "Hotspot",
      tunnels: "Tunnels WireGuard",
      pricing: "Tarifs",
      docs: "Guides & Docs",
    },
    megaMenu: {
      products: [
        {
          title: "Accès & Rentabilité",
          items: [
            {
              title: "Hotspot WiFi Cloud",
              desc: "Portail captif à votre marque, vouchers en lot, forfaits débits/durée et gestion revendeurs.",
              href: "/hotspot#portail",
              badge: "Paiement Wave",
              icon: "wifi",
            },
            {
              title: "Gestion Cybercafé",
              desc: "Attribution automatique de temps, postes de travail, import DHCP et tickets de session.",
              href: "/hotspot#cybercafe",
              icon: "monitor",
            },
            {
              title: "Gestionnaire PPPoE ISP",
              desc: "Provisionnement automatique des abonnés, secrets d'accès et reconnexion live MikroTik.",
              href: "/#isp",
              icon: "server",
            },
          ],
        },
        {
          title: "Sécurité & Infra Cloud",
          items: [
            {
              title: "Protection Cloud (4 Boucliers)",
              desc: "SafeWiFi DNS Quad9, Shield anti-piratage WiFi, FamilyGuard couvre-feu et AntiVPN.",
              href: "/#protection",
              badge: "Auto-réparation",
              icon: "shield",
            },
            {
              title: "VPN — IP fixe France",
              desc: "Tunnel WireGuard personnel, IP dédiée à Marseille, configuration livrée en 30 secondes.",
              href: "/vpn#ip-fixe",
              icon: "globe",
            },
            {
              title: "Accès Pro — Routeurs & LAN",
              desc: "Routeurs MikroTik, caméras et NAS dans le tunnel chiffré — LAN étendu supervisé depuis la console.",
              href: "/tunnels#acces-pro",
              icon: "cctv",
            },
            {
              title: "Pilotage de Flotte MikroTik",
              desc: "Supervision live, QoS Manager, Docteur Pool IP et mise à jour RouterOS en un clic.",
              href: "/#parc",
              icon: "router",
            },
          ],
        },
      ],
      solutions: [
        {
          title: "Secteurs & Usages",
          items: [
            {
              title: "Hôtellerie & Restauration",
              desc: "WiFi visiteurs élégant, promos intégrées, réseaux sociaux et portail hospitalité.",
              href: "/hotspot#portail",
              icon: "building",
            },
            {
              title: "Cybercafés & Salles de Jeu",
              desc: "Gestion automatisée des postes, tickets de temps et coupure automatique.",
              href: "/hotspot#cybercafe",
              icon: "monitor",
            },
            {
              title: "PME & Fournisseurs d'Accès",
              desc: "Interconnexion multi-sites, supervision de parc et gestion d'abonnés PPPoE.",
              href: "/#isp",
              icon: "server",
            },
            {
              title: "Travailleurs Nomades & Télétravail",
              desc: "VPN personnel à IP fixe France, DNS filtrés et accès distant à vos réseaux — où que vous travailliez.",
              href: "/vpn#ip-fixe",
              icon: "globe",
            },
          ],
        },
      ],
      /* N°331 — mega menu Tarifs : chaque service affiche ses prix réels
         (source : pricing.segments FR + constantes produit publiques de la
         boutique — la section /#tarifs reste la référence complète). */
      pricing: {
        cards: [
          {
            title: "Hotspot & Cybercafé",
            desc: "Abonnement console : vouchers, portail captif, module cybercafé et 4 protections.",
            lines: [
              "Dès 2 500 FCFA / mois / routeur",
              "25 000 FCFA / an · routeurs illimités",
            ],
            note: "Essai gratuit 60 jours, sans carte",
            badge: "Le plus choisi",
            href: "/#tarifs",
            cta: "Voir les formules",
          },
          {
            title: "VPN — IP fixe France",
            desc: "Tunnel WireGuard personnel, configuration livrée en 30 secondes.",
            lines: ["1 500 FCFA / mois", "15 000 FCFA / an"],
            note: "Boutique — payable Wave ou carte",
            badge: "2 mois offerts",
            href: "/vpn#tarifs",
            cta: "Commander le VPN",
          },
          {
            title: "Accès Pro",
            desc: "Routeurs MikroTik, caméras et NAS dans le tunnel — LAN étendu.",
            lines: ["3 500 FCFA / mois", "35 000 FCFA / an"],
            note: "Console — supervision distante",
            href: "/tunnels#tarifs",
            cta: "Voir l'Accès Pro",
          },
        ],
        compare: "Comparer toutes les formules",
      },
    },
  },
  hero: {
    badge: "403Shield · Hotspot · VPN · Tunnels · PPPoE · Cybercafé",
    title1: "Votre réseau,",
    titleAccent: "sous bouclier.",
    title2: "",
    subtitle:
      "L'erreur 403, c'est pour les autres. Hotspot WiFi public rentable, quatre boucliers pare-feu dans le cloud, gestionnaire PPPoE & Cybercafé, et un tunnel WireGuard unifié pour tous vos usages (VPN IP fixe France, Accès Pro routeurs, caméras & NAS) : 403Shield réunit la plateforme réseau cloud de référence — powered by FTech CI.",
    ctaPrimary: "Protéger mon réseau",
    ctaSecondary: "Découvrir la suite",
    trialHint: "Essai gratuit · sans carte bancaire — 60 jours",
    chips: ["Erreur 403 — aux autres", "4/4 protections actives", "Tunnels WireGuard · IP fixe France"],
  },
  marquee: [
    "Vouchers & codes d'accès",
    "VPN WireGuard · IP fixe France",
    "Filtrage DNS Quad9",
    "Gestionnaire PPPoE & Abonnés",
    "Module Cybercafé & Postes",
    "Un seul tunnel, deux usages",
    "Anti-piratage WiFi",
    "Accès distant Pro — routeurs, caméras, NAS",
    "Couvre-feu internet",
    "Bloque-VPN",
    "QoS & forfait FAI",
    "Mode Vente revendeurs",
    "Mise à jour RouterOS",
    "Portail captif à votre marque",
    "Paiement Wave & Mobile Money",
  ],
  powers: {
    eyebrow: "Une suite, quatre piliers d'excellence",
    title: "Tout ce qu'il faut pour régner sur votre réseau.",
    subtitle:
      "Hotspot rentable, protection cloud, pilotage de parc, gestion d'abonnés PPPoE/Cybercafé et tunnels WireGuard : 403Shield réunit en une seule suite tout ce que votre infrastructure réclame — sans Winbox obligatoire, sans serveur à maintenir.",
    explore: "Découvrir",
    cards: [
      {
        tag: "Fondation",
        title: "Hotspot & Cybercafé",
        desc: "Le pilier fondateur de la suite : portails captifs à votre marque, vouchers par lots (1-500), gestion des postes cybercafé, quotas et bridage au forfait, sessions en direct.",
        items: [
          "Portail captif 100 % à votre marque",
          "Vouchers par lots jusqu'à 500",
          "Module Cybercafé & import DHCP auto",
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
        tag: "Parc & ISP",
        title: "Pilotage & PPPoE ISP",
        desc: "Télémétrie live, mise à jour RouterOS en un clic, gestion des abonnés PPPoE, QoS Manager et qualité de ligne mesurée en continu.",
        items: [
          "Serveur PPPoE & secrets abonnés",
          "Mise à jour RouterOS de flotte",
          "Télémétrie CPU, mémoire, uptime",
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
    kicker: "Gestion hotspot & cybercafé",
    title: "Un portail captif et un espace de vente dont vous serez fier.",
    body: "Offrez à vos clients une connexion fluide et soignée — à votre marque, sans aucune mention 403Shield. Vouchers à durée, quota, multi-appareils ou tickets cybercafé : vous gardez le contrôle total. Vos revendeurs vendent depuis leur téléphone : PWA protégée par PIN, stock transféré, ventes hors-ligne, rapport de journée.",
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
        title: "Espace Cybercafé intégré",
        desc: "Attribution directe de temps d'écran, import automatique des bails DHCP et libération de poste en 1 clic.",
      },
      {
        title: "Statistiques & Caisse en direct",
        desc: "Affluence horaire, revenus, marge par profil, journaux de caisse exportables CSV et suivi revendeurs.",
      },
    ],
    panel: {
      title: "Affluence horaire",
      online: "Heure de pointe · 19 h",
    },
  },
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
    },
    guideCta: "Voir le guide du pilotage de parc",
  },
  ispExtension: {
    kicker: "Extension Opérateurs & Fournisseurs d'Accès",
    title: "Gestion d'abonnés PPPoE & Multi-Sites à grande échelle.",
    subtitle: "Transformez vos routeurs MikroTik en nœuds de distribution ISP professionnels sans complexité d'infrastructure.",
    feats: [
      {
        tag: "PPPoE Server Auto",
        title: "Provisionnement d'abonnés PPPoE",
        desc: "Détection automatique des pools LAN et création de profils abonnés sur les serveurs PPPoE MikroTik via agent binaire.",
      },
      {
        tag: "Reconnexion Live",
        title: "Kick & Renouvellement instantané",
        desc: "Déconnectez ou renouvelez le forfait d'un abonné PPPoE en un clic depuis le dashboard d'administration.",
      },
      {
        tag: "Comptabilité Multi-Sites",
        title: "Rapports & Clôtures mensuelles gelées",
        desc: "Agrégez les revenus de plusieurs établissements ou nœuds réseau avec archivage certifié de journal de caisse.",
      },
      {
        tag: "Sécurité Rapprochée",
        title: "Authentification 2FA TOTP & Rôles Team",
        desc: "Accès sécurisé par double facteur TOTP et gestion d'équipe fine (Propriétaire, Gérant, Opérateur).",
      },
    ],
  },
  stats: [
    { value: 500, label: "vouchers par lot" },
    { value: 4, label: "boucliers pare-feu" },
    { value: 54, label: "pays africains visés" },
    { value: 2, label: "usages du tunnel — VPN & Accès Pro" },
  ],
  trust: {
    eyebrow: "Confiance vérifiable",
    title: "Rien à croire sur parole.",
    subtitle:
      "Aucun chiffre gonflé, aucun témoignage arrangé : des faits techniques, des captures réelles de la console et 60 jours d'essai pour vous faire votre propre avis.",
    badges: [
      "Paiement Wave & carte — frais réels affichés avant confirmation",
      "Configuration VPN livrée par e-mail en 30 secondes",
      "Infrastructure hébergée dans l'Union européenne — Marseille",
      "WireGuard — protocole court et audité publiquement",
      "Essai Découverte 60 jours — sans carte bancaire",
      "powered by FTech CI — Abidjan",
    ],
    shots: [
      {
        src: "/docs/hotspot/vouchers-wizard-1.png",
        alt: "Assistant de génération de vouchers par lots de 500 dans la console 403Shield",
        caption: "Vos vouchers, par lots de 500",
      },
      {
        src: "/docs/analyse/reports-marge.png",
        alt: "Rapport de marge par profil de forfait dans la console 403Shield",
        caption: "Vos marges, calculées chaque jour",
      },
      {
        src: "/docs/infrastructure/routers.png",
        alt: "Parc de routeurs MikroTik supervisé avec versions RouterOS",
        caption: "Votre parc, supervisé en continu",
      },
    ],
  },
  faq: {
    eyebrow: "Questions fréquentes",
    title: "Les réponses avant de vous décider.",
    items: [
      {
        q: "Par quoi dois-je commencer ?",
        a: "Par l'essai Découverte : 60 jours gratuits, sans carte bancaire. Créez votre compte, suivez le guide Premiers pas — votre premier routeur est en ligne en quelques minutes.",
      },
      {
        q: "Faut-il être ingénieur réseau ?",
        a: "Non. L'agent 403Shield se colle sur votre MikroTik en un script ; la console gère le reste. Chaque geste est documenté pas à pas dans les guides, captures à l'appui.",
      },
      {
        q: "Quels paiements acceptez-vous ?",
        a: "Wave et carte bancaire, en FCFA. Les remises et frais réels sont affichés avant chaque confirmation — jamais de coût caché.",
      },
      {
        q: "Où sont hébergées mes données ?",
        a: "Sur une infrastructure hébergée dans l'Union européenne (Marseille), avec des répliques nocturnes et un chiffrement de bout en bout sur les tunnels.",
      },
      {
        q: "Puis-je gérer plusieurs établissements ?",
        a: "Oui : la console est multi-sites. La formule annuelle (25 000 FCFA) supervise autant de routeurs que nécessaire ; le mensuel (2 500 FCFA) se paie par routeur.",
      },
      {
        q: "Le VPN est-il légal ?",
        a: "Oui — c'est un usage standard du chiffrement personnel et professionnel, bâti sur WireGuard, un protocole audité publiquement et intégré aux systèmes modernes.",
      },
      {
        q: "Comment se passe le support ?",
        a: "Le chat intégré répond aussitôt et passe la main à un humain quand il faut. Les alertes partent par Telegram, WhatsApp ou e-mail — et chaque module a son guide documenté.",
      },
      {
        q: "Et si j'arrête ?",
        a: "Le mensuel est sans engagement : vous partez quand vous voulez. Vos rapports s'exportent en CSV ; votre configuration WireGuard vous appartient et reste exportable.",
      },
    ],
  },
  pricing: {
    eyebrow: "Tarifs",
    title: "Un abonnement, un tunnel.",
    subtitle:
      "Exploitez un réseau public rentable : l'abonnement console couvre vouchers, portail captif, protections et revendeurs. Les tunnels WireGuard se commandent sur la boutique dédiée, et l'essai reste offert.",
    modesLabel: "Console ou boutique ?",
    segments: [
      {
        id: "hotspot",
        label: "Hotspot · Cybercafé",
        hint: "Hôtels, cybercafés, maquis, boutiques, campus, FAI… : vouchers, portail captif, module cybercafé et vente d'accès avec vos revendeurs — tout sur la même formule.",
        audience: ["Hôtels", "Cybercafés", "Maquis", "Boutiques", "Campus", "Restaurants"],
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
              "Gestionnaire Cybercafé & PPPoE",
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
              "Sans engagement",
              "Résiliable à tout moment",
              "Toutes les fonctions incluses",
            ],
          },
        ],
      },
      /* N°321 — segment boutique : les Tunnels WireGuard. Prix catalogue =
         constantes produit réelles du backend (publicvpnorder.go : b2c
         1500/15000, pro 3500/35000 FCFA). N°323 — la caisse vit sur LE SITE
         (/checkout, modèle OVH) : les CTA VPN pointent en INTERNE avec la
         formule présélectionnée (?plan= ouvre la caisse), l'Accès Pro reste
         sur la console (/pro) — jamais via la modale SaaS. N°322 — 2e
         segment du sélecteur, l'abonnement console (Hotspot · Cybercafé
         depuis N°325) étant le premier. */
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
            href: "/checkout?plan=vpn-b2c-month",
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
            href: "/checkout?plan=vpn-b2c-year",
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
      "Frais de paiement répercutés sur le prix de liste : carte +6 %, Wave −3 % (remise mobile money). Abonnement console : essai 60 jours sans carte bancaire. Tunnels WireGuard (VPN & Accès Pro) : prix catalogue boutique, remise mobile money incluse.",
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
      "Quelles sont les protections ?",
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
      "La suite sécurité réseau cloud : Hotspot, protection, cybercafé, PPPoE et tunnels WireGuard — VPN & Accès Pro — powered by FTech CI.",
    columns: [
      {
        title: "Produit",
        links: [
          { label: "Hotspot & Cybercafé", href: "/hotspot" },
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
          { label: "Connexion WiFi jetable", href: "/docs/guides/wifi-jetable" },
          { label: "Guides d'exploitation", href: "/docs/guides" },
        ],
      },
      {
        title: "Légal",
        links: [{ label: "Politique de confidentialité", href: "/legal/confidentialite" }],
      },
    ],
  },

  pages: {
    hotspot: {
      meta: {
        title: "403Shield Hotspot & Cybercafé — WiFi public rentable et blindé",
        description:
          "Vouchers par lots de 500, module Cybercafé, portail captif 100 % à votre marque, Mode Vente et revendeurs, 4 boucliers pare-feu : exploitez un réseau rentable, piloté depuis le cloud.",
      },
      hero: {
        badge: "403Shield Hotspot & Cybercafé",
        title1: "Votre réseau public,",
        titleAccent: "rentable",
        title2: "et blindé.",
        subtitle:
          "Hôtels, cybercafés, maquis, boutiques, campus, FAI : vendez l'accès internet par vouchers ou tickets de temps, à votre marque, avec vos revendeurs — pendant que quatre boucliers pare-feu veillent sur le réseau. Essai gratuit 60 jours, sans carte bancaire.",
        ctaPrimary: "Démarrer l'essai gratuit",
        ctaPrimaryHref: "#signup",
        ctaSecondary: "Voir les tarifs",
        ctaSecondaryHref: "#tarifs",
        trust: [
          "Essai 60 jours — sans carte bancaire",
          "Paiement Wave & carte",
          "Fonctionne derrière CGNAT, Orange ou Starlink",
          "Portail 100 % à votre marque",
        ],
      },
      features: {
        eyebrow: "Ce que fait 403Shield Hotspot",
        title: "Le WiFi public et le cybercafé, transformés en business.",
        sections: [
          {
            id: "portail",
            icon: "palette",
            kicker: "Portail captif",
            title: "Votre portail, votre marque.",
            body: "Mode commercial avec grille tarifaire et paiement Wave, ou mode hospitalité avec promos et réseaux sociaux. Vos clients ne voient que vous — jamais 403Shield.",
            bullets: [
              "Logo, couleurs et promos à votre image",
              "Connexion par voucher, code ou ticket de temps",
              "Pages HTTPS légères, rapides sur mobile",
              "Mode hospitalité : réseaux sociaux et offres du jour",
            ],
          },
          {
            id: "vouchers",
            icon: "ticket",
            kicker: "Vouchers & forfaits",
            title: "Vendez l'accès, pas du temps perdu.",
            body: "Durée, quota de données, débit, 1 à 10 appareils par forfait — et à l'épuisement, vous choisissez : couper net ou brider en douceur. Jusqu'à 500 vouchers par lot.",
            bullets: [
              "Lots de 500 vouchers prêts à imprimer ou transférer",
              "Forfaits durée, quota et débit combinables",
              "Épuisement : coupure ou bridage progressif",
              "Stock surveillé, alerte avant rupture",
            ],
          },
          {
            id: "cybercafe",
            icon: "store",
            kicker: "Module Cybercafé",
            title: "Vos postes, pilotés en un clin d'œil.",
            body: "Le module Cybercafé gère les temps d'écran poste par poste : attribution directe, import automatique des bails DHCP, libération en un clic et tickets de session.",
            bullets: [
              "Temps d'écran attribué au poste ou au client",
              "Import DHCP automatique des postes",
              "Libération et arrêt à distance en 1 clic",
              "Tickets de session et journaux exportables",
            ],
          },
          {
            id: "mode-vente",
            icon: "chart",
            kicker: "Mode Vente & revendeurs",
            title: "Vos revendeurs vendent depuis leur téléphone.",
            body: "Le Mode Vente transforme vos revendeurs en caisses ambulantes : PWA protégée par PIN, stock transféré, ventes enregistrées hors-ligne puis synchronisées, rapport de journée clair.",
            bullets: [
              "PWA hors-ligne, protégée par PIN",
              "Stock de vouchers transféré aux revendeurs",
              "Ventes enregistrées sans réseau, synchronisées après",
              "Rapport de journée et statistiques par revendeur",
            ],
          },
        ],
      },
      steps: {
        eyebrow: "Comment ça marche",
        title: "Du compte aux premières ventes en trois gestes.",
        items: [
          {
            title: "Créez votre compte",
            desc: "Essai gratuit 60 jours, sans carte bancaire — la formule Découverte démarre immédiatement.",
          },
          {
            title: "Collez le script agent",
            desc: "Sur votre routeur MikroTik (un hAP suffit) : deux minutes, aucune IP publique requise.",
          },
          {
            title: "Vendez",
            desc: "Créez vos forfaits, imprimez vos vouchers, encaissez en Wave — le portail fait le reste.",
          },
        ],
      },
      pricing: {
        eyebrow: "Tarifs",
        navLabel: "Tarifs",
        title: "Un abonnement, un routeur.",
        subtitle:
          "Commencez gratuitement puis grandissez : l'annuel débloque les routeurs illimités. Prix en FCFA, payables Wave ou carte.",
      },
      faq: {
        eyebrow: "Questions fréquentes",
        navLabel: "FAQ",
        title: "Tout ce qu'on nous demande avant de signer.",
        items: [
          {
            q: "Quel routeur faut-il pour démarrer ?",
            a: "Un MikroTik suffit : le hAP lite (environ 25 000 FCFA) fait tourner l'agent 403Shield. Aucun serveur à acheter, rien à héberger chez vous.",
          },
          {
            q: "Ça marche derrière CGNAT, sans IP publique ?",
            a: "Oui. L'agent installé sur le routeur sort vers le cloud : Orange, Starlink ou 4G — aucun port ouvert, aucune IP fixe nécessaire.",
          },
          {
            q: "Que se passe-t-il à la fin des 60 jours d'essai ?",
            a: "La formule Découverte prend fin. Vous choisissez alors le mensuel (2 500 FCFA/routeur) ou l'annuel (25 000 FCFA, routeurs illimités). Aucune conversion automatique, aucun prélèvement surprise.",
          },
          {
            q: "Le Mode Vente fonctionne-t-il sans internet ?",
            a: "Oui — c'est une PWA hors-ligne protégée par PIN. Les ventes sont enregistrées localement puis synchronisées au retour du réseau.",
          },
          {
            q: "Puis-je encaisser en Wave ?",
            a: "Oui : Wave et carte bancaire sont pris en charge, avec les remises et frais réels affichés avant confirmation.",
          },
          {
            q: "Le portail peut-il porter ma marque ?",
            a: "Totalement : logo, couleurs, promos et réseaux sociaux. Vos clients ne voient que votre enseigne.",
          },
          {
            q: "Puis-je arrêter le mensuel quand je veux ?",
            a: "Oui, sans engagement. L'annuel reste la formule la plus avantageuse — routeurs illimités.",
          },
        ],
      },
      guides: {
        eyebrow: "Guides liés",
        title: "Apprenez pas à pas, captures à l'appui.",
        allLabel: "Tous les guides",
        items: [
          {
            title: "Premiers pas",
            desc: "Créer le compte, installer l'agent, connecter le premier routeur.",
            href: "/docs/guides/premiers-pas",
          },
          {
            title: "Vouchers & lots",
            desc: "Générer, imprimer et suivre vos lots de 500 vouchers.",
            href: "/docs/guides/vouchers-lots",
          },
          {
            title: "Module Cybercafé",
            desc: "Postes, temps d'écran et tickets de session.",
            href: "/docs/guides/cybercafe",
          },
        ],
      },
      share: "Partager cette page",
      cta: {
        kicker: "Prêt à lancer votre hotspot ou cybercafé ?",
        title: "60 jours d'essai, sans carte bancaire.",
        body: "Créez votre compte, collez le script agent sur votre routeur MikroTik, configurez votre premier forfait. Sans serveur à maintenir, sans Winbox.",
        primary: "Créer mon compte gratuit",
        primaryHref: "#signup",
        secondary: "Voir les tarifs",
        secondaryHref: "#tarifs",
      },
    },
    vpn: {
      meta: {
        title: "403Shield VPN — IP fixe France sur WireGuard",
        description:
          "Un VPN WireGuard qui sort par notre serveur de Marseille avec une IP fixe France dédiée. Activation en 30 secondes, paiement Wave ou carte, géré depuis votre espace sans mot de passe.",
      },
      hero: {
        badge: "Tunnels WireGuard · VPN",
        title1: "Une IP fixe France.",
        titleAccent: "À vous seul.",
        title2: "",
        subtitle:
          "Votre trafic, chiffré de bout en bout par WireGuard, sort par notre serveur de Marseille avec une adresse IP dédiée. Activation en 30 secondes — sans toucher à un fichier de configuration. Et pour joindre vos routeurs, caméras ou NAS : l'Accès Pro étend ce même tunnel.",
        ctaPrimary: "Acheter mon VPN",
        ctaPrimaryHref: "/checkout",
        ctaSecondary: "Découvrir les tunnels",
        ctaSecondaryHref: "/tunnels",
        trust: [
          "Configuration livrée par e-mail en 30 s",
          "Payable Wave ou carte — prix affichés avant paiement",
          "WireGuard : protocole audité, léger sur batterie",
          "IP dédiée — jamais partagée, jamais revendue",
        ],
      },
      features: {
        eyebrow: "Pourquoi 403Shield VPN",
        title: "Le VPN qui ne vous enferme pas.",
        sections: [
          {
            id: "ip-fixe",
            icon: "globe",
            kicker: "IP fixe France",
            title: "Une adresse française, rien qu'à vous.",
            body: "Votre trafic sort par notre serveur de Marseille avec une adresse IP dédiée. Banques, services publics et plateformes qui refusent les IP partagées vous reconnaissent enfin — et votre adresse ne change plus jamais au milieu d'une session.",
            bullets: [
              "IP dédiée — pas de liste noire partagée",
              "Sortie unique : Marseille, France",
              "Services géo-sensibles accessibles et stables",
              "La même adresse sur tous vos appareils WireGuard",
            ],
          },
          {
            id: "wireguard",
            icon: "lock",
            kicker: "Protocole WireGuard",
            title: "Audité, léger, moderne.",
            body: "WireGuard est le protocole VPN de référence : un code court et audité publiquement, plus rapide et plus sobre que les suites d'ancienne génération. Votre configuration reste votre propriété, exportable à tout moment.",
            bullets: [
              "Code court, audité publiquement",
              "Reconnexion invisible en changement de réseau",
              "Sobre sur la batterie du téléphone",
              "Configuration standard, importable partout",
            ],
          },
          {
            id: "paiement",
            icon: "card",
            kicker: "Paiement local",
            title: "Wave ou carte, en FCFA.",
            body: "Payez comme vous vivez : Wave avec remise mobile money, ou carte bancaire. Le provisioning est automatique — la configuration part par e-mail dès l'encaissement confirmé, sans intervention humaine.",
            bullets: [
              "Wave : remise appliquée d'office",
              "Carte bancaire : frais réels affichés avant paiement",
              "Prix en FCFA, reçus par e-mail",
              "Renouvellement en 1 clic depuis votre espace",
            ],
          },
          {
            id: "sans-mdp",
            icon: "key",
            kicker: "Sans mot de passe",
            title: "Un code e-mail suffit.",
            body: "Pas de mot de passe à inventer ni à perdre : un code à 6 chiffres reçu par e-mail vous ouvre l'espace client — achats, portefeuille d'appareils, renouvellement et récupération de configuration.",
            bullets: [
              "Code à 6 chiffres reçu par e-mail",
              "Espace client : achats et renouvellements",
              "Récupération de configuration self-service",
              "Aucun mot de passe stocké",
            ],
          },
        ],
      },
      note: {
        title: "Un seul tunnel, deux usages.",
        body: "Mensuel sans engagement, ou annuel — 10 mois payés, 2 offerts. Prix en FCFA sur la boutique, remise mobile money incluse. Et quand vos réseaux doivent passer par le même chemin : l'Accès Pro étend ce même tunnel WireGuard à vos routeurs, caméras et NAS — même console, même boutique.",
      },
      steps: {
        eyebrow: "Comment ça marche",
        title: "En ligne en trois gestes.",
        items: [
          {
            title: "Choisissez votre formule",
            desc: "Mensuel sans engagement ou annuel — 10 mois payés, 2 offerts.",
          },
          {
            title: "Payez Wave ou carte",
            desc: "Prix en FCFA affichés avant confirmation, remise Wave incluse.",
          },
          {
            title: "Importez la configuration",
            desc: "Elle arrive par e-mail : un scan QR dans WireGuard et vous êtes en ligne.",
          },
        ],
      },
      pricing: {
        eyebrow: "Tarifs",
        navLabel: "Tarifs",
        title: "Mensuel ou annuel — à vous de voir.",
        subtitle:
          "L'annuel offre 2 mois : 10 payés, 2 offerts. Prix en FCFA, payables Wave ou carte.",
      },
      faq: {
        eyebrow: "Questions fréquentes",
        navLabel: "FAQ",
        title: "Ce qu'on demande avant d'acheter.",
        items: [
          {
            q: "C'est quoi une IP fixe, concrètement ?",
            a: "Votre trafic sort toujours par la même adresse française (Marseille). Les plateformes qui bloquent les IP anonymes ou changeantes vous laissent tranquille, et vos accès distants restent stables.",
          },
          {
            q: "Sur quels appareils ça marche ?",
            a: "Tout ce qui exécute WireGuard : Android, iPhone, Windows, macOS, Linux — et les routeurs compatibles. Une configuration par appareil, gérée depuis votre espace.",
          },
          {
            q: "Comment je paie ?",
            a: "Wave (remise mobile money appliquée d'office) ou carte bancaire (frais réels affichés). Tout est confirmé avant paiement, en FCFA.",
          },
          {
            q: "Et si je perds ma configuration ?",
            a: "La récupération est self-service : depuis la boutique, elle est renvoyée exclusivement à votre adresse e-mail d'achat.",
          },
          {
            q: "Quelle différence avec l'Accès Pro ?",
            a: "C'est le même tunnel WireGuard. Le VPN protège votre usage personnel avec une IP fixe ; l'Accès Pro y branche vos routeurs, caméras et NAS, avec la supervision console.",
          },
          {
            q: "Combien de temps avant d'être en ligne ?",
            a: "Environ 30 secondes entre la confirmation du paiement et la réception de la configuration par e-mail.",
          },
        ],
      },
      guides: {
        eyebrow: "Guides liés",
        title: "Le VPN et son espace, pas à pas.",
        allLabel: "Tous les guides",
        items: [
          {
            title: "Guide VPN WireGuard",
            desc: "Choisir, acheter et importer sa configuration pas à pas.",
            href: "/docs/guides/vpn-wireguard",
          },
          {
            title: "Espace client VPN",
            desc: "Portefeuille d'appareils, renouvellement 1-clic, statuts.",
            href: "/docs/guides/portail-client",
          },
        ],
      },
      share: "Partager cette page",
      cta: {
        kicker: "Prêt à chiffrer votre trafic ?",
        title: "Votre configuration part par e-mail en 30 secondes.",
        body: "Choisissez votre formule sur la boutique, payez en Wave ou par carte : la configuration WireGuard complète arrive par e-mail, prête à importer.",
        primary: "Acheter mon VPN",
        primaryHref: "/checkout",
        secondary: "J'ai déjà un VPN — mon espace",
        secondaryHref: "https://console.403shield.ftci.fr",
      },
    },
    tunnels: {
      meta: {
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
        ctaPrimaryHref: "/checkout",
        ctaSecondary: "Découvrir le VPN",
        ctaSecondaryHref: "/vpn",
        trust: [
          "Chiffrement WireGuard de bout en bout",
          "Aucun port ouvert sur vos routeurs",
          "Console disponible 24/7 — hébergée UE",
          "Fonctionne derrière CGNAT, sans IP publique",
        ],
      },
      features: {
        eyebrow: "Pourquoi 403Shield Tunnels",
        title: "Le pont privé entre vous et vos réseaux.",
        sections: [
          {
            id: "vpn-perso",
            icon: "globe",
            kicker: "VPN personnel",
            title: "Le même tunnel, pour vous.",
            body: "Votre trafic chiffré de bout en bout sort par Marseille avec une IP fixe France dédiée. C'est le même WireGuard, la même console — que vous protégiez vos déplacements ou supervisiez un parc.",
            bullets: [
              "IP fixe France dédiée à votre usage",
              "Téléphone, ordinateur, tablette",
              "Configuration par e-mail, import immédiat",
              "Boutique : Wave, carte, renouvellement 1 clic",
            ],
          },
          {
            id: "acces-pro",
            icon: "router",
            kicker: "Accès Pro",
            title: "Vos routeurs, joignables partout.",
            body: "L'Accès Pro supervise vos routeurs MikroTik à travers le tunnel : administration, API et SSH à distance — sans exposer une seule interface sur Internet.",
            bullets: [
              "Routeurs MikroTik supervisés en continu",
              "Admin, API et SSH via le tunnel privé",
              "Aucune interface exposée, aucun port ouvert",
              "Alertes hors-ligne et échéances d'abonnement",
            ],
          },
          {
            id: "lan",
            icon: "cctv",
            kicker: "LAN étendu",
            title: "Caméras et NAS, en privé.",
            body: "Le tunnel s'étend à votre réseau local : caméras, NAS et imprimantes restent joignables en privé depuis partout — même derrière CGNAT, sans IP publique chez vous.",
            bullets: [
              "Accès privé aux caméras et enregistreurs",
              "NAS et fichiers à distance, chiffrés",
              "Derrière CGNAT, Orange ou Starlink",
              "Aucun port ouvert sur la box ni le routeur",
            ],
          },
          {
            id: "console",
            icon: "console",
            kicker: "Une console",
            title: "Tout vit au même endroit.",
            body: "Un code e-mail à 6 chiffres suffit : espace client, portefeuille d'appareils, renouvellement 1-clic — VPN et Accès Pro vivent au même endroit, entre la console et la boutique.",
            bullets: [
              "Connexion par code e-mail, sans mot de passe",
              "Portefeuille d'appareils et statuts en direct",
              "Renouvellement et échéances en 1 clic",
              "Boutique intégrée : VPN, Wave et carte",
            ],
          },
        ],
      },
      steps: {
        eyebrow: "Comment ça marche",
        title: "Votre tunnel ouvert en trois gestes.",
        items: [
          {
            title: "Créez votre tunnel",
            desc: "Depuis la console ou la boutique — code e-mail, sans mot de passe.",
          },
          {
            title: "Branchez vos équipements",
            desc: "Agent MikroTik pour le parc, configuration e-mail pour vos appareils personnels.",
          },
          {
            title: "Pilotez à distance",
            desc: "Console : statuts, alertes, renouvellements — le tunnel reste ouvert tant que vous le voulez.",
          },
        ],
      },
      pricing: {
        eyebrow: "Tarifs",
        navLabel: "Tarifs",
        title: "VPN personnel ou Accès Pro.",
        subtitle:
          "Le même tunnel, deux usages : commencez par le VPN, étendez au parc quand vous voulez.",
      },
      faq: {
        eyebrow: "Questions fréquentes",
        navLabel: "FAQ",
        title: "Avant d'ouvrir votre tunnel.",
        items: [
          {
            q: "Mes caméras sont derrière CGNAT : ça marche ?",
            a: "Oui — c'est le cas d'usage central de l'Accès Pro. Le tunnel sort de votre routeur vers Marseille ; aucun port ni IP publique n'est requis de votre côté.",
          },
          {
            q: "VPN ou Accès Pro : que me faut-il ?",
            a: "Les deux vivent sur le même tunnel. VPN : votre usage personnel, IP fixe France. Accès Pro : brancher routeurs, caméras et NAS, avec supervision console. On commence souvent par le VPN, on étend ensuite.",
          },
          {
            q: "Faut-il un routeur spécial ?",
            a: "Pour l'Accès Pro, un MikroTik sous RouterOS 7 (l'agent 403Shield y tourne). Pour le VPN seul, aucun routeur : votre téléphone ou ordinateur suffit.",
          },
          {
            q: "Est-ce que ça remplace mon abonnement internet ?",
            a: "Non. Le tunnel chiffre et interconnecte vos réseaux existants — il ne fournit pas d'accès à internet en tant que tel.",
          },
          {
            q: "Comment sont renouvelés les abonnements ?",
            a: "Le VPN se renouvelle depuis la boutique (rappel par e-mail avant échéance) ; l'Accès Pro depuis la console, avec alertes d'échéance configurables.",
          },
        ],
      },
      guides: {
        eyebrow: "Guides liés",
        title: "Le tunnel et le parc, pas à pas.",
        allLabel: "Tous les guides",
        items: [
          {
            title: "Accès Pro — le guide",
            desc: "Routeurs, caméras et NAS dans le tunnel, derrière CGNAT.",
            href: "/docs/guides/acces-pro",
          },
          {
            title: "Console tunnels",
            desc: "Code e-mail, portefeuille d'appareils, renouvellement 1 clic.",
            href: "/docs/guides/console-tunnels",
          },
          {
            title: "Vitrine VPN B2C",
            desc: "La boutique /vpn pas à pas : formules, caisse, configuration.",
            href: "/docs/guides/vitrine-vpn",
          },
        ],
      },
      share: "Partager cette page",
      cta: {
        kicker: "Vos réseaux vous attendent",
        title: "Ouvrez votre tunnel en moins de 5 minutes.",
        body: "Code e-mail, boutique Wave/carte, configuration livrée par e-mail : le tunnel s'installe sans toucher à un fichier de configuration.",
        primary: "Ouvrir la console",
        primaryHref: "https://console.403shield.ftci.fr",
        secondary: "Voir la boutique VPN",
        secondaryHref: "/checkout",
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
    tunnels: "WireGuard tunnels",
    fleet: "Router fleet",
    isp: "ISP & Carriers",
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
      products: "Products",
      solutions: "Solutions",
      hotspot: "Hotspot",
      tunnels: "WireGuard tunnels",
      pricing: "Pricing",
      docs: "Guides & Docs",
    },
    megaMenu: {
      products: [
        {
          title: "Access & Profitability",
          items: [
            {
              title: "Hotspot WiFi Cloud",
              desc: "White-label captive portal, batch vouchers, speed/duration plans, and reseller management.",
              href: "/hotspot#portail",
              badge: "Wave Payment",
              icon: "wifi",
            },
            {
              title: "Cybercafé Management",
              desc: "Automatic screen time allocation, workstations, DHCP import, and session tickets.",
              href: "/hotspot#cybercafe",
              icon: "monitor",
            },
            {
              title: "ISP PPPoE Manager",
              desc: "Automated subscriber provisioning, access secrets, and live MikroTik reconnection.",
              href: "/#isp",
              icon: "server",
            },
          ],
        },
        {
          title: "Security & Cloud Infra",
          items: [
            {
              title: "Cloud Protection (4 Shields)",
              desc: "SafeWiFi Quad9 DNS, Shield WiFi anti-hacking, FamilyGuard curfew, and AntiVPN.",
              href: "/#protection",
              badge: "Self-healing",
              icon: "shield",
            },
            {
              title: "VPN — Fixed French IP",
              desc: "Personal WireGuard tunnel, dedicated Marseille IP, configuration delivered in 30 seconds.",
              href: "/vpn#ip-fixe",
              icon: "globe",
            },
            {
              title: "Pro Access — Routers & LAN",
              desc: "MikroTik routers, cameras and NAS inside the encrypted tunnel — extended LAN supervised from the console.",
              href: "/tunnels#acces-pro",
              icon: "cctv",
            },
            {
              title: "MikroTik Fleet Control",
              desc: "Live telemetry, QoS Manager, IP Pool Doctor, and one-click RouterOS updates.",
              href: "/#parc",
              icon: "router",
            },
          ],
        },
      ],
      solutions: [
        {
          title: "Sectors & Use Cases",
          items: [
            {
              title: "Hospitality & Restaurants",
              desc: "Elegant visitor WiFi, integrated promos, social links, and hospitality portal.",
              href: "/hotspot#portail",
              icon: "building",
            },
            {
              title: "Cybercafés & Gaming Arenas",
              desc: "Automated workstation management, time tickets, and automatic cut-off.",
              href: "/hotspot#cybercafe",
              icon: "monitor",
            },
            {
              title: "SMEs & ISPs",
              desc: "Multi-site interconnection, fleet supervision, and PPPoE subscriber management.",
              href: "/#isp",
              icon: "server",
            },
            {
              title: "Nomads & Remote Workers",
              desc: "Personal fixed French IP VPN, filtered DNS and remote access to your networks — wherever you work.",
              href: "/vpn#ip-fixe",
              icon: "globe",
            },
          ],
        },
      ],
      /* N°331 — Tarifs mega menu: every service shows its real prices
         (source: EN pricing.segments + public shop product constants — the
         /#tarifs section stays the complete reference). */
      pricing: {
        cards: [
          {
            title: "Hotspot & Cybercafé",
            desc: "Console subscription: vouchers, captive portal, cybercafé module and 4 protections.",
            lines: [
              "From 2,500 FCFA / month / router",
              "25,000 FCFA / year · unlimited routers",
            ],
            note: "60-day free trial, no card",
            badge: "Most popular",
            href: "/#tarifs",
            cta: "See the plans",
          },
          {
            title: "VPN — Fixed French IP",
            desc: "Personal WireGuard tunnel, configuration delivered in 30 seconds.",
            lines: ["1,500 FCFA / month", "15,000 FCFA / year"],
            note: "Shop — Wave or card payment",
            badge: "2 months free",
            href: "/vpn#tarifs",
            cta: "Order the VPN",
          },
          {
            title: "Pro Access",
            desc: "MikroTik routers, cameras and NAS in the tunnel — extended LAN.",
            lines: ["3,500 FCFA / month", "35,000 FCFA / year"],
            note: "Console — remote supervision",
            href: "/tunnels#tarifs",
            cta: "See Pro Access",
          },
        ],
        compare: "Compare all plans",
      },
    },
  },
  hero: {
    badge: "403Shield · Hotspot · VPN · Tunnels · PPPoE · Cybercafé",
    title1: "Your network,",
    titleAccent: "shielded.",
    title2: "",
    subtitle:
      "Error 403 is for the others. A revenue-ready public Hotspot, four cloud firewall shields, PPPoE & Cybercafé manager, and a unified WireGuard tunnel for all your uses (fixed French IP VPN, Pro Access for routers, cameras & NAS): 403Shield brings together the reference cloud network platform — powered by FTech CI.",
    ctaPrimary: "Protect my network",
    ctaSecondary: "Explore the suite",
    trialHint: "Free trial · no credit card — 60 days",
    chips: ["Error 403 — for the others", "4/4 protections active", "WireGuard tunnels · fixed French IP"],
  },
  marquee: [
    "Vouchers & access codes",
    "WireGuard VPN · fixed French IP",
    "Quad9 DNS filtering",
    "PPPoE & Subscriber Manager",
    "Cybercafé Module & Stations",
    "One tunnel, two uses",
    "WiFi anti-hacking",
    "Pro remote access — routers, cameras, NAS",
    "Internet curfew",
    "VPN blocker",
    "QoS & ISP plan",
    "Reseller Sell Mode",
    "RouterOS updates",
    "White-label captive portal",
    "Wave & Mobile Money payments",
  ],
  powers: {
    eyebrow: "One suite, four pillars of excellence",
    title: "Everything you need to rule your network.",
    subtitle:
      "A profitable Hotspot, cloud protection, fleet control, PPPoE/Cybercafé management and WireGuard tunnels: 403Shield gathers in a single suite everything your infrastructure demands — no mandatory Winbox, no server to maintain.",
    explore: "Explore",
    cards: [
      {
        tag: "Foundation",
        title: "Hotspot & Cybercafé",
        desc: "The suite's founding pillar: white-label captive portals, batch vouchers (1-500), cybercafé station management, per-plan quotas and throttling, live sessions.",
        items: [
          "100% white-label captive portal",
          "Voucher batches up to 500",
          "Cybercafé module & auto DHCP import",
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
        tag: "Fleet & ISP",
        title: "Fleet Control & PPPoE ISP",
        desc: "Live telemetry, one-click RouterOS updates, PPPoE subscriber management, QoS Manager and continuously measured line quality.",
        items: [
          "PPPoE server & subscriber secrets",
          "Fleet RouterOS updates",
          "CPU, memory & uptime telemetry",
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
    kicker: "Hotspot & Cybercafé management",
    title: "A captive portal and point of sale you'll be proud of.",
    body: "Give your customers a smooth, polished connection — under your brand, with zero 403Shield mention. Duration, quota, multi-device vouchers or cybercafé tickets: you keep total control. Your resellers? They sell straight from their phone: PIN-protected PWA, transferred stock, offline sales, end-of-day report.",
    audience: ["Hotels", "Cybercafés", "Bars", "Shops", "Campuses", "Restaurants"],
    audienceLabel: "Who is it for?",
    feats: [
      {
        title: "100% custom branding",
        desc: "Commercial mode with rate card and Wave payments, or hospitality mode with promos and social links.",
      },
      {
        title: "Vouchers & plans",
        desc: "Duration, data quota, bandwidth, 1 to 10 devices — and when exhausted: cut off or throttle gently.",
      },
      {
        title: "Integrated Cybercafé Space",
        desc: "Direct allocation of screen time, automatic DHCP leases import and 1-click station release.",
      },
      {
        title: "Live Statistics & Cash Control",
        desc: "Hourly footfall, revenue, margin per plan, CSV exportable cash registers and reseller tracking.",
      },
    ],
    panel: {
      title: "Hourly footfall",
      online: "Peak hour · 7 pm",
    },
  },
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
    },
    guideCta: "Open the fleet control guide",
  },
  ispExtension: {
    kicker: "Carrier & ISP Extension",
    title: "Large Scale PPPoE Subscriber & Multi-Site Management.",
    subtitle: "Turn your MikroTik routers into professional ISP distribution nodes without infrastructure complexity.",
    feats: [
      {
        tag: "PPPoE Server Auto",
        title: "PPPoE Subscriber Provisioning",
        desc: "Automatic detection of LAN pools and creation of subscriber profiles on MikroTik PPPoE servers via binary agent.",
      },
      {
        tag: "Live Reconnect",
        title: "Instant Kick & Renewal",
        desc: "Disconnect or renew a PPPoE subscriber's plan in one click directly from the admin dashboard.",
      },
      {
        tag: "Multi-Site Accounting",
        title: "Reports & Frozen Monthly Closings",
        desc: "Aggregate revenue across multiple locations or network nodes with certified cash journal archiving.",
      },
      {
        tag: "Close-up Security",
        title: "2FA TOTP Auth & Team Roles",
        desc: "Secured access with two-factor TOTP authentication and fine-grained team management (Owner, Manager, Operator).",
      },
    ],
  },
  stats: [
    { value: 500, label: "vouchers per batch" },
    { value: 4, label: "firewall shields" },
    { value: 54, label: "African countries" },
    { value: 2, label: "uses of the tunnel — VPN & Pro Access" },
  ],
  trust: {
    eyebrow: "Verifiable trust",
    title: "Nothing to take on faith.",
    subtitle:
      "No inflated numbers, no staged testimonials: technical facts, real console screenshots, and a 60-day trial to make up your own mind.",
    badges: [
      "Wave & card payments — real fees shown before confirmation",
      "VPN configuration emailed within 30 seconds",
      "Infrastructure hosted in the European Union — Marseille",
      "WireGuard — short, publicly audited protocol",
      "60-day Discovery trial — no credit card",
      "powered by FTech CI — Abidjan",
    ],
    shots: [
      {
        src: "/docs/hotspot/vouchers-wizard-1.png",
        alt: "500-voucher batch generation wizard in the 403Shield console",
        caption: "Your vouchers, in batches of 500",
      },
      {
        src: "/docs/analyse/reports-marge.png",
        alt: "Per-plan margin report in the 403Shield console",
        caption: "Your margins, computed daily",
      },
      {
        src: "/docs/infrastructure/routers.png",
        alt: "Supervised MikroTik fleet with RouterOS versions",
        caption: "Your fleet, supervised around the clock",
      },
    ],
  },
  faq: {
    eyebrow: "Frequently asked questions",
    title: "The answers before you decide.",
    items: [
      {
        q: "Where should I start?",
        a: "With the Discovery trial: 60 days free, no credit card. Create your account, follow the First steps guide — your first router is online within minutes.",
      },
      {
        q: "Do I need to be a network engineer?",
        a: "No. The 403Shield agent is pasted onto your MikroTik as a single script; the console handles the rest. Every step is documented in the guides, screenshots included.",
      },
      {
        q: "Which payments do you accept?",
        a: "Wave and bank card, in FCFA. Real discounts and fees are shown before every confirmation — never a hidden cost.",
      },
      {
        q: "Where is my data hosted?",
        a: "On infrastructure hosted in the European Union (Marseille), with nightly replicas and end-to-end encryption on the tunnels.",
      },
      {
        q: "Can I manage several locations?",
        a: "Yes: the console is multi-site. The yearly plan (25,000 FCFA) supervises as many routers as needed; the monthly plan (2,500 FCFA) is paid per router.",
      },
      {
        q: "Is the VPN legal?",
        a: "Yes — it is a standard personal and professional use of encryption, built on WireGuard, a publicly audited protocol integrated into modern systems.",
      },
      {
        q: "How does support work?",
        a: "The built-in chat answers instantly and hands over to a human when needed. Alerts go out via Telegram, WhatsApp or email — and every module has a documented guide.",
      },
      {
        q: "What if I stop?",
        a: "The monthly plan has no commitment: leave whenever you want. Your reports export to CSV; your WireGuard configuration belongs to you and stays exportable.",
      },
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "One subscription, one tunnel.",
    subtitle:
      "Run a revenue-ready public network: the console subscription covers vouchers, captive portal, protections and resellers. WireGuard tunnels are ordered on the dedicated shop, and the trial stays free.",
    modesLabel: "Console or shop?",
    segments: [
      {
        id: "hotspot",
        label: "Hotspot · Cybercafé",
        hint: "Hotels, cybercafés, bars, shops, campuses, ISPs…: vouchers, captive portal, cybercafé module and access sales through your resellers — all on the same plan.",
        audience: ["Hotels", "Cybercafés", "Bars", "Shops", "Campuses", "Restaurants"],
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
              "Cybercafé & PPPoE manager",
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
         selector segment, the console subscription (Hotspot · Cybercafé
         since N°325) being the first. */
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
            href: "/checkout?plan=vpn-b2c-month",
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
            href: "/checkout?plan=vpn-b2c-year",
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
      "Payment fees passed through the list price: card +6%, Wave −3% (mobile money discount). Console subscription: 60-day free trial, no credit card. WireGuard tunnels (VPN & Pro Access): shop catalogue prices, mobile money discount included.",
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
      "What protections do I get?",
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
      "The cloud network-security suite: Hotspot, protection, cybercafé, PPPoE and WireGuard tunnels — VPN & Pro Access — powered by FTech CI.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Hotspot & Cybercafé", href: "/hotspot" },
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
          { label: "Throwaway WiFi login", href: "/docs/guides/wifi-jetable" },
          { label: "Operations guides", href: "/docs/guides" },
        ],
      },
      {
        title: "Legal",
        links: [{ label: "Privacy policy", href: "/legal/confidentialite" }],
      },
    ],
  },

  pages: {
    hotspot: {
      meta: {
        title: "403Shield Hotspot & Cybercafé — revenue-ready, hardened public WiFi",
        description:
          "Batch vouchers up to 500, Cybercafé module, 100% white-label captive portal, Sell Mode with resellers, and 4 firewall shields: run a profitable network, driven from the cloud.",
      },
      hero: {
        badge: "403Shield Hotspot & Cybercafé",
        title1: "Your public network,",
        titleAccent: "profitable",
        title2: "and hardened.",
        subtitle:
          "Hotels, cybercafés, eateries, shops, campuses, ISPs: sell internet access with vouchers or time tickets, under your brand, through your resellers — while four firewall shields watch over the network. 60-day free trial, no credit card.",
        ctaPrimary: "Start the free trial",
        ctaPrimaryHref: "#signup",
        ctaSecondary: "See pricing",
        ctaSecondaryHref: "#tarifs",
        trust: [
          "60-day trial — no credit card",
          "Wave & card payments",
          "Works behind CGNAT, Orange or Starlink",
          "100% white-label portal",
        ],
      },
      features: {
        eyebrow: "What 403Shield Hotspot does",
        title: "Public WiFi and Cybercafé, turned into a business.",
        sections: [
          {
            id: "portail",
            icon: "palette",
            kicker: "Captive portal",
            title: "Your portal, your brand.",
            body: "Commercial mode with rate card and Wave payments, or hospitality mode with promos and social links. Your customers only see you — never 403Shield.",
            bullets: [
              "Logo, colors and promos in your image",
              "Login by voucher, code or time ticket",
              "Lightweight HTTPS pages, fast on mobile",
              "Hospitality mode: social links and daily offers",
            ],
          },
          {
            id: "vouchers",
            icon: "ticket",
            kicker: "Vouchers & plans",
            title: "Sell access, not wasted time.",
            body: "Duration, data quota, bandwidth, 1 to 10 devices per plan — and on depletion, you choose: hard cut-off or gentle throttling. Up to 500 vouchers per batch.",
            bullets: [
              "Batches of 500 vouchers, print or transfer ready",
              "Combinable duration, quota and bandwidth plans",
              "Depletion: cut-off or progressive throttling",
              "Watched stock, alert before it runs out",
            ],
          },
          {
            id: "cybercafe",
            icon: "store",
            kicker: "Cybercafé module",
            title: "Your stations, steered at a glance.",
            body: "The Cybercafé module manages screen time station by station: direct allocation, automatic DHCP lease import, 1-click release and session tickets.",
            bullets: [
              "Screen time allocated per station or per client",
              "Automatic DHCP import of stations",
              "Remote release and shutdown in 1 click",
              "Session tickets and exportable logs",
            ],
          },
          {
            id: "mode-vente",
            icon: "chart",
            kicker: "Sell Mode & resellers",
            title: "Your resellers sell from their phone.",
            body: "Sell Mode turns your resellers into walking tills: PIN-protected PWA, transferred stock, offline sales synced later, and a clear end-of-day report.",
            bullets: [
              "Offline PWA, protected by PIN",
              "Voucher stock transferred to resellers",
              "Sales recorded without network, synced after",
              "End-of-day report and per-reseller stats",
            ],
          },
        ],
      },
      steps: {
        eyebrow: "How it works",
        title: "From account to first sales in three moves.",
        items: [
          {
            title: "Create your account",
            desc: "60-day free trial, no credit card — the Discovery plan starts immediately.",
          },
          {
            title: "Paste the agent script",
            desc: "On your MikroTik router (a hAP is enough): two minutes, no public IP required.",
          },
          {
            title: "Sell",
            desc: "Create your plans, print your vouchers, collect with Wave — the portal does the rest.",
          },
        ],
      },
      pricing: {
        eyebrow: "Pricing",
        navLabel: "Pricing",
        title: "One subscription, one router.",
        subtitle:
          "Start free, then grow: the yearly plan unlocks unlimited routers. Prices in FCFA, payable with Wave or card.",
      },
      faq: {
        eyebrow: "Frequently asked questions",
        navLabel: "FAQ",
        title: "Everything we're asked before signing.",
        items: [
          {
            q: "Which router do I need to start?",
            a: "A MikroTik is enough: the hAP lite (about 25,000 FCFA) runs the 403Shield agent. No server to buy, nothing to host at home.",
          },
          {
            q: "Does it work behind CGNAT, without a public IP?",
            a: "Yes. The agent installed on the router dials out to the cloud: Orange, Starlink or 4G — no open port, no fixed IP needed.",
          },
          {
            q: "What happens after the 60-day trial?",
            a: "The Discovery plan ends. You then choose monthly (2,500 FCFA/router) or yearly (25,000 FCFA, unlimited routers). No automatic conversion, no surprise charge.",
          },
          {
            q: "Does Sell Mode work offline?",
            a: "Yes — it is a PIN-protected offline PWA. Sales are recorded locally and synced when the network returns.",
          },
          {
            q: "Can I collect payments with Wave?",
            a: "Yes: Wave and bank card are supported, with real discounts and fees shown before confirmation.",
          },
          {
            q: "Can the portal carry my brand?",
            a: "Fully: logo, colors, promos and social links. Your customers only see your sign.",
          },
          {
            q: "Can I stop the monthly plan anytime?",
            a: "Yes, no commitment. The yearly plan remains the best value — unlimited routers.",
          },
        ],
      },
      guides: {
        eyebrow: "Related guides",
        title: "Learn step by step, screenshots included.",
        allLabel: "All guides",
        items: [
          {
            title: "First steps",
            desc: "Create the account, install the agent, connect the first router.",
            href: "/docs/guides/premiers-pas",
          },
          {
            title: "Vouchers & batches",
            desc: "Generate, print and track your 500-voucher batches.",
            href: "/docs/guides/vouchers-lots",
          },
          {
            title: "Cybercafé module",
            desc: "Stations, screen time and session tickets.",
            href: "/docs/guides/cybercafe",
          },
        ],
      },
      share: "Share this page",
      cta: {
        kicker: "Ready to launch your hotspot or cybercafé?",
        title: "60 days free, no credit card.",
        body: "Create your account, paste the agent script onto your MikroTik router, configure your first plan. No server to maintain, no Winbox.",
        primary: "Create my free account",
        primaryHref: "#signup",
        secondary: "See pricing",
        secondaryHref: "#tarifs",
      },
    },
    vpn: {
      meta: {
        title: "403Shield VPN — fixed French IP over WireGuard",
        description:
          "A WireGuard VPN exiting through our Marseille server with a dedicated fixed French IP. 30-second activation, Wave or card payment, managed from your passwordless account.",
      },
      hero: {
        badge: "WireGuard tunnels · VPN",
        title1: "A fixed French IP.",
        titleAccent: "Yours alone.",
        title2: "",
        subtitle:
          "Your traffic, end-to-end encrypted by WireGuard, exits through our Marseille server with a dedicated IP address. 30-second activation — without touching a single config file. And to reach your routers, cameras or NAS: Pro Access extends that very same tunnel.",
        ctaPrimary: "Buy my VPN",
        ctaPrimaryHref: "/checkout",
        ctaSecondary: "Explore tunnels",
        ctaSecondaryHref: "/tunnels",
        trust: [
          "Configuration emailed within 30 s",
          "Wave or card — prices shown before payment",
          "WireGuard: audited protocol, light on battery",
          "Dedicated IP — never shared, never resold",
        ],
      },
      features: {
        eyebrow: "Why 403Shield VPN",
        title: "The VPN that doesn't lock you in.",
        sections: [
          {
            id: "ip-fixe",
            icon: "globe",
            kicker: "Fixed French IP",
            title: "One French address, yours alone.",
            body: "Your traffic exits through our Marseille server with a dedicated IP address. Banks, public services and platforms that reject shared IPs finally recognize you — and your address never changes mid-session again.",
            bullets: [
              "Dedicated IP — no shared blocklist",
              "Single exit: Marseille, France",
              "Geo-sensitive services reachable and stable",
              "The same address across your WireGuard devices",
            ],
          },
          {
            id: "wireguard",
            icon: "lock",
            kicker: "WireGuard protocol",
            title: "Audited, lightweight, modern.",
            body: "WireGuard is the reference VPN protocol: a short, publicly audited codebase, faster and leaner than legacy suites. Your configuration remains your property, exportable anytime.",
            bullets: [
              "Short codebase, publicly audited",
              "Invisible reconnection on network change",
              "Easy on your phone's battery",
              "Standard configuration, importable anywhere",
            ],
          },
          {
            id: "paiement",
            icon: "card",
            kicker: "Local payment",
            title: "Wave or card, in FCFA.",
            body: "Pay the way you live: Wave with the mobile-money discount, or bank card. Provisioning is automatic — the configuration is emailed as soon as payment is confirmed, with no human in the loop.",
            bullets: [
              "Wave: discount applied automatically",
              "Bank card: real fees shown before payment",
              "Prices in FCFA, receipts by email",
              "1-click renewal from your account",
            ],
          },
          {
            id: "sans-mdp",
            icon: "key",
            kicker: "No password",
            title: "One email code is enough.",
            body: "No password to invent or lose: a 6-digit code received by email opens your client area — purchases, device wallet, renewal and configuration recovery.",
            bullets: [
              "6-digit code received by email",
              "Client area: purchases and renewals",
              "Self-service configuration recovery",
              "No stored password",
            ],
          },
        ],
      },
      note: {
        title: "One tunnel, two uses.",
        body: "Monthly with no commitment, or yearly — pay 10 months, get 2 offered. Prices in FCFA on the shop, mobile-money discount included. And when your networks need the same path: Pro Access extends this very WireGuard tunnel to your routers, cameras and NAS — same console, same shop.",
      },
      steps: {
        eyebrow: "How it works",
        title: "Online in three moves.",
        items: [
          {
            title: "Pick your plan",
            desc: "Monthly with no commitment, or yearly — pay 10 months, get 2 offered.",
          },
          {
            title: "Pay with Wave or card",
            desc: "Prices in FCFA shown before confirmation, Wave discount included.",
          },
          {
            title: "Import the configuration",
            desc: "It arrives by email: one QR scan in WireGuard and you're online.",
          },
        ],
      },
      pricing: {
        eyebrow: "Pricing",
        navLabel: "Pricing",
        title: "Monthly or yearly — up to you.",
        subtitle:
          "The yearly plan gives 2 months: pay 10, get 2 offered. Prices in FCFA, payable with Wave or card.",
      },
      faq: {
        eyebrow: "Frequently asked questions",
        navLabel: "FAQ",
        title: "What we're asked before buying.",
        items: [
          {
            q: "What is a fixed IP, concretely?",
            a: "Your traffic always exits through the same French address (Marseille). Platforms that block anonymous or rotating IPs leave you alone, and your remote accesses stay stable.",
          },
          {
            q: "Which devices does it work on?",
            a: "Anything that runs WireGuard: Android, iPhone, Windows, macOS, Linux — and compatible routers. One configuration per device, managed from your account.",
          },
          {
            q: "How do I pay?",
            a: "Wave (mobile-money discount applied automatically) or bank card (real fees shown). Everything is confirmed before payment, in FCFA.",
          },
          {
            q: "What if I lose my configuration?",
            a: "Recovery is self-service: from the shop, it is resent exclusively to your purchase email address.",
          },
          {
            q: "What's the difference with Pro Access?",
            a: "It's the same WireGuard tunnel. The VPN shields your personal use with a fixed IP; Pro Access connects your routers, cameras and NAS, with console supervision.",
          },
          {
            q: "How long before I'm online?",
            a: "About 30 seconds between payment confirmation and receiving the configuration by email.",
          },
        ],
      },
      guides: {
        eyebrow: "Related guides",
        title: "The VPN and its account, step by step.",
        allLabel: "All guides",
        items: [
          {
            title: "WireGuard VPN guide",
            desc: "Choose, buy and import your configuration step by step.",
            href: "/docs/guides/vpn-wireguard",
          },
          {
            title: "VPN client area",
            desc: "Device wallet, 1-click renewal, statuses.",
            href: "/docs/guides/portail-client",
          },
        ],
      },
      share: "Share this page",
      cta: {
        kicker: "Ready to encrypt your traffic?",
        title: "Your configuration is emailed within 30 seconds.",
        body: "Pick your plan on the shop, pay with Wave or card: the full WireGuard configuration arrives by email, ready to import.",
        primary: "Buy my VPN",
        primaryHref: "/checkout",
        secondary: "I already have a VPN — my account",
        secondaryHref: "https://console.403shield.ftci.fr",
      },
    },
    tunnels: {
      meta: {
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
        ctaPrimaryHref: "/checkout",
        ctaSecondary: "Explore the VPN",
        ctaSecondaryHref: "/vpn",
        trust: [
          "End-to-end WireGuard encryption",
          "No open port on your routers",
          "Console available 24/7 — EU hosted",
          "Works behind CGNAT, no public IP",
        ],
      },
      features: {
        eyebrow: "Why 403Shield Tunnels",
        title: "The private bridge between you and your networks.",
        sections: [
          {
            id: "vpn-perso",
            icon: "globe",
            kicker: "Personal VPN",
            title: "The same tunnel, for you.",
            body: "Your end-to-end encrypted traffic exits through Marseille with a dedicated fixed French IP. It is the same WireGuard, the same console — whether you shield your travels or supervise a fleet.",
            bullets: [
              "Dedicated fixed French IP for your own use",
              "Phone, computer, tablet",
              "Configuration by email, immediate import",
              "Shop: Wave, card, 1-click renewal",
            ],
          },
          {
            id: "acces-pro",
            icon: "router",
            kicker: "Pro Access",
            title: "Your routers, reachable anywhere.",
            body: "Pro Access supervises your MikroTik routers through the tunnel: administration, API and SSH remotely — without exposing a single interface to the Internet.",
            bullets: [
              "MikroTik routers supervised continuously",
              "Admin, API and SSH over the private tunnel",
              "No exposed interface, no open port",
              "Offline and subscription-due alerts",
            ],
          },
          {
            id: "lan",
            icon: "cctv",
            kicker: "Extended LAN",
            title: "Cameras and NAS, in private.",
            body: "The tunnel extends to your local network: cameras, NAS and printers stay privately reachable from anywhere — even behind CGNAT, with no public IP at your site.",
            bullets: [
              "Private access to cameras and recorders",
              "NAS and files remotely, encrypted",
              "Behind CGNAT, Orange or Starlink",
              "No open port on the box or the router",
            ],
          },
          {
            id: "console",
            icon: "console",
            kicker: "One console",
            title: "Everything lives in one place.",
            body: "A 6-digit email code is enough: client area, device wallet, 1-click renewal — the VPN and Pro Access live in the same place, between the console and the shop.",
            bullets: [
              "Login by email code, no password",
              "Device wallet and live statuses",
              "Renewal and due dates in 1 click",
              "Integrated shop: VPN, Wave and card",
            ],
          },
        ],
      },
      steps: {
        eyebrow: "How it works",
        title: "Your tunnel open in three moves.",
        items: [
          {
            title: "Create your tunnel",
            desc: "From the console or the shop — email code, no password.",
          },
          {
            title: "Connect your equipment",
            desc: "MikroTik agent for the fleet, emailed configuration for personal devices.",
          },
          {
            title: "Steer remotely",
            desc: "Console: statuses, alerts, renewals — the tunnel stays open as long as you want.",
          },
        ],
      },
      pricing: {
        eyebrow: "Pricing",
        navLabel: "Pricing",
        title: "Personal VPN or Pro Access.",
        subtitle:
          "The same tunnel, two uses: start with the VPN, extend to the fleet whenever you want.",
      },
      faq: {
        eyebrow: "Frequently asked questions",
        navLabel: "FAQ",
        title: "Before opening your tunnel.",
        items: [
          {
            q: "My cameras sit behind CGNAT: does it work?",
            a: "Yes — it is the core use case of Pro Access. The tunnel dials out from your router to Marseille; no port or public IP is required on your side.",
          },
          {
            q: "VPN or Pro Access: which do I need?",
            a: "Both live on the same tunnel. VPN: your personal use, fixed French IP. Pro Access: connecting routers, cameras and NAS, with console supervision. Most start with the VPN, then extend.",
          },
          {
            q: "Do I need a special router?",
            a: "For Pro Access, a MikroTik running RouterOS 7 (the 403Shield agent runs there). For the VPN alone, no router: your phone or computer is enough.",
          },
          {
            q: "Does it replace my internet subscription?",
            a: "No. The tunnel encrypts and interconnects your existing networks — it does not provide internet access as such.",
          },
          {
            q: "How are subscriptions renewed?",
            a: "The VPN renews from the shop (email reminder before the due date); Pro Access from the console, with configurable due-date alerts.",
          },
        ],
      },
      guides: {
        eyebrow: "Related guides",
        title: "The tunnel and the fleet, step by step.",
        allLabel: "All guides",
        items: [
          {
            title: "Pro Access — the guide",
            desc: "Routers, cameras and NAS in the tunnel, behind CGNAT.",
            href: "/docs/guides/acces-pro",
          },
          {
            title: "Tunnels console",
            desc: "Email code, device wallet, 1-click renewal.",
            href: "/docs/guides/console-tunnels",
          },
          {
            title: "B2C VPN storefront",
            desc: "The /vpn shop step by step: plans, checkout, configuration.",
            href: "/docs/guides/vitrine-vpn",
          },
        ],
      },
      share: "Share this page",
      cta: {
        kicker: "Your networks are waiting",
        title: "Open your tunnel in under 5 minutes.",
        body: "Email code, Wave/card shop, configuration delivered by email: the tunnel installs itself without touching a config file.",
        primary: "Open the console",
        primaryHref: "https://console.403shield.ftci.fr",
        secondary: "Browse the VPN shop",
        secondaryHref: "/checkout",
      },
    },
  },
};

export const landingCopy: Record<Lang, LandingCopy> = { fr, en };
