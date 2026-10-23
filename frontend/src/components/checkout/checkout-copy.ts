// checkout-copy.ts — N°323 — copie bilingue AUTO-CONTENUE de la caisse de la
// vitrine (/checkout). Portée depuis tunnel-console/src/components/shop/
// shop-copy.ts (N°316) lors du retour de la boutique au site marketing
// (modèle OVH : commander sur www, gérer dans le manager). La partie
// transactionnelle (dialog d'achat, suivi, récupération, FAQ) est portée à
// l'identique — seuls l'en-tête et le catalogue passent au gabarit clay de la
// vitrine. Promesses RÉELLES uniquement (fulltunnel wg0 VM, livraison e-mail,
// récupération self-service, terme réglé à l'avance, espace 403Shield pour
// gérer et renouveler). Langue pilotée par le store global de la vitrine.
//
// N°347 — la caisse devient BIPRODUIT : le VPN B2C (réfs MCV-) et le bouclier
// DNS TOURACO (réfs MCD-) partagent le MÊME composant de page — la copie est
// donc structurée PAR PRODUIT (checkoutCopy[lang][product]) : chaque produit
// garde son hero, son catalogue, son dialog d'achat, ses écrans de suivi et
// sa FAQ. « switch » porte les libellés du sélecteur d'onglets. Promesses
// DNS : le bouclier est UTILISABLE GRATUITEMENT, TOURACO étend les capacités
// — c'est un DROIT porté par l'e-mail (pas une conf livrée), l'activation
// part par e-mail dès confirmation, le gratuit n'est jamais coupé.

export type CheckoutLang = "fr" | "en";

/* N°347 — produit affiché par la caisse (onglets VPN / DNS). */
export type CheckoutProduct = "vpn" | "dns";

/* N°347 — libellés du sélecteur de produit (visibles dans les DEUX états). */
export interface CheckoutSwitchCopy {
  /** aria-label du groupe d'onglets. */
  label: string;
  vpn: string;
  dns: string;
}

/* N°347 — copie d'une langue : sélecteur + un bloc par produit. */
export interface CheckoutLangCopy {
  switch: CheckoutSwitchCopy;
  vpn: CheckoutCopy;
  dns: CheckoutCopy;
}

export interface CheckoutCopy {
  topbar: { space: string };
  hero: {
    badge: string;
    title1: string;
    titleAccent: string;
    title2: string;
    lead: string;
    cta: string;
    ctaSecondary: string;
    hint: string;
  };
  catalog: {
    kicker: string;
    title: string;
    lead: string;
    monthly: { name: string; tagline: string; per: string };
    yearly: { name: string; tagline: string; per: string };
    pop: string;
    bullets: string[];
    cta: string;
    closedTitle: string;
    closedDesc: string;
    onlineNote: string;
    manualNote: string;
    waveAmount: string;
    cardAmount: string;
  };
  buy: {
    title: string;
    desc: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    phoneHint: string;
    method: string;
    methodWave: string;
    methodCard: string;
    submit: string;
    submitting: string;
    waveAmount: string;
    cardAmount: string;
    redirected: string;
    manualTitle: string;
    manualDesc: string;
    ref: string;
    errPending: string;
    close: string;
  };
  status: {
    title: string;
    desc: string;
    pending: string;
    pendingDesc: string;
    paid: string;
    paidDesc: string;
    provisioned: string;
    provisionedDesc: string;
    cancelled: string;
    cancelledDesc: string;
    expired: string;
    expiredDesc: string;
    term: string;
    /** VPN uniquement (IP tunnel) — le statut DNS ne porte jamais d'IP. */
    ip?: string;
    /** N°347 — DNS : libellé du CTA console de l'écran « provisioned ». */
    consoleCta?: string;
  };
  recover: {
    kicker: string;
    title: string;
    desc: string;
    email: string;
    ref: string;
    submit: string;
    submitting: string;
    done: string;
    note: string;
  };
  faq: { title: string; items: { q: string; a: string }[] };
}

/* Copie VPN (N°323 — inchangée, produit historique de la caisse). */
const frVpn: CheckoutCopy = {
  topbar: {
    space: "Mon espace VPN",
  },
  hero: {
    badge: "403Shield — caisse sécurisée · powered by FTech CI",
    title1: "Votre trafic, chiffré de bout en bout,",
    titleAccent: "avec une IP fixe France.",
    title2: "",
    lead:
      "403Shield bâtit un tunnel WireGuard vers notre serveur de Marseille : Wi-Fi public blindé, opérateur aveugle, et une IP française où que vous soyez. Sans compte à créer — la configuration EST le produit.",
    cta: "Choisir ma formule",
    ctaSecondary: "Récupérer une configuration",
    hint: "Activation en 30 secondes dans l'application WireGuard gratuite — paiement Wave ou carte.",
  },
  catalog: {
    kicker: "Tarifs simples",
    title: "Deux formules, un seul produit",
    lead:
      "Paiement Wave ou carte bancaire (FCFA). Le provisioning est automatique : la configuration part par e-mail dès l'encaissement confirmé.",
    monthly: { name: "Mensuel", tagline: "Sans engagement, mois par mois", per: "1 mois" },
    yearly: { name: "Annuel", tagline: "Payez 10 mois, 2 offerts", per: "12 mois" },
    pop: "2 mois offerts",
    bullets: [
      "Tunnel WireGuard fulltunnel (IP France)",
      "Configuration livrée par e-mail, importable en 30 secondes",
      "Re-livraison self-service avec votre référence",
      "Espace 403Shield : portefeuille et renouvellement 1-clic",
      "Support par e-mail",
    ],
    cta: "Souscrire",
    closedTitle: "La vente directe arrive bientôt",
    closedDesc:
      "403Shield VPN est en cours d'ouverture. Revenez bientôt — ou demandez l'accès à votre gérant 403Shield local (il vend le même produit au quartier).",
    onlineNote: "Paiement en ligne sécurisé (Wave / carte).",
    manualNote:
      "Règlement par virement : votre accès est activé dès confirmation de l'équipe 403Shield.",
    waveAmount: "Prix Wave (remise mobile money incluse)",
    cardAmount: "Prix carte (frais inclus)",
  },
  buy: {
    title: "Souscrire 403Shield VPN",
    desc:
      "Votre configuration WireGuard part par e-mail dès le paiement confirmé — l'activation prend une trentaine de secondes.",
    email: "Adresse e-mail (livraison de la configuration)",
    emailPlaceholder: "vous@exemple.com",
    phone: "Téléphone Wave (requis pour payer par Wave)",
    phonePlaceholder: "225 07 00 00 00 00",
    phoneHint: "Format international, sans espaces ni +.",
    method: "Moyen de paiement",
    methodWave: "Wave",
    methodCard: "Carte bancaire",
    submit: "Payer et activer",
    submitting: "Création de la commande…",
    waveAmount: "Prix Wave (remise mobile money incluse)",
    cardAmount: "Prix carte (frais inclus)",
    redirected: "Redirection vers la page de paiement…",
    manualTitle: "Commande enregistrée",
    manualDesc:
      "Réglez par virement en indiquant la référence ci-dessous : votre VPN est provisionné automatiquement dès confirmation par l'équipe 403Shield.",
    ref: "Référence de commande",
    errPending: "Une commande est déjà en attente pour cet e-mail",
    close: "Fermer",
  },
  status: {
    title: "Suivi de commande",
    desc:
      "Statut actualisé en continu — le tunnel s'active automatiquement dès l'encaissement confirmé.",
    pending: "En attente de paiement",
    pendingDesc:
      "Réglez la commande sur la page de paiement ouverte dans un autre onglet, puis revenez ici.",
    paid: "Paiement confirmé",
    paidDesc: "Provisionnement en cours sur le serveur — quelques secondes…",
    provisioned: "Votre VPN est actif",
    provisionedDesc:
      "La configuration a été envoyée à votre adresse e-mail. Importez-la dans l'application WireGuard (menu « + » → importer), activez le tunnel : c'est fait.",
    cancelled: "Commande annulée",
    cancelledDesc:
      "Le paiement n'a pas abouti ou la commande a été annulée. Vous pouvez en créer une nouvelle.",
    expired: "Accès arrivé à terme",
    expiredDesc:
      "L'accès a atteint sa date de fin. Souscrivez à nouveau pour repartir — la configuration partira comme la première fois.",
    term: "Valide jusqu'au",
    ip: "IP tunnel",
  },
  recover: {
    kicker: "Self-service",
    title: "Récupérer ma configuration",
    desc:
      "Égaré l'e-mail de livraison ? Indiquez votre adresse et la référence de la commande (MCV-…) : la configuration vous est renvoyée immédiatement.",
    email: "Adresse e-mail de la commande",
    ref: "Référence (MCV-…)",
    submit: "Renvoyer ma configuration",
    submitting: "Envoi…",
    done: "Si cette commande existe, la configuration a été envoyée à votre adresse e-mail.",
    note:
      "La configuration n'est JAMAIS affichée sur cette page : elle part uniquement par e-mail, à l'adresse de la commande.",
  },
  faq: {
    title: "Questions fréquentes",
    items: [
      {
        q: "Comment j'active mon VPN ?",
        a:
          "Installez l'application WireGuard (gratuite — App Store, Google Play, wireguard.com/install). Ouvrez l'e-mail de livraison, enregistrez la configuration en fichier 403shield.conf, puis dans WireGuard : « + » → « Importer depuis un fichier ». Activez le tunnel : votre trafic sort par Marseille.",
      },
      {
        q: "Où gérer mon abonnement ?",
        a:
          "Dans votre espace 403Shield (console.403shield.ftci.fr) : connectez-vous avec votre e-mail (un code à 6 chiffres suffit, sans mot de passe) — vos accès, leur échéance et un renouvellement en un clic y vivent, aux côtés de l'Accès Pro pour superviser vos routeurs.",
      },
      {
        q: "Que reçois-je exactement ?",
        a:
          "Un e-mail contenant votre configuration WireGuard complète, votre référence de commande (MCV-…) et la date de fin de validité. Cette même page peut vous la renvoyer à tout moment pendant la durée de votre formule.",
      },
      {
        q: "Combien d'appareils ?",
        a:
          "La formule couvre UNE configuration WireGuard (une paire de clés). Importez-la sur l'appareil de votre choix — pour plusieurs appareils simultanés, souscrivez une commande par appareil.",
      },
      {
        q: "Que se passe-t-il à la fin de la période ?",
        a:
          "L'accès est simplement révoqué à la date de terme (récupérable via cette page jusqu'au dernier jour). Renouvelez depuis votre espace ou souscrivez à nouveau — aucune reconduction tacite, aucun prélèvement caché.",
      },
      {
        q: "Puis-je être remboursé ?",
        a:
          "Le tunnel est testable immédiatement après activation. En cas de problème technique non résolu par le support dans les 7 jours, l'équipe annule la commande et révoque l'accès — contactez le support avec votre référence.",
      },
    ],
  },
};

/* Copie VPN (N°323 — inchangée, produit historique de la caisse). */
const enVpn: CheckoutCopy = {
  topbar: {
    space: "My VPN space",
  },
  hero: {
    badge: "403Shield — secure checkout · powered by FTech CI",
    title1: "Your traffic, end-to-end encrypted,",
    titleAccent: "with a fixed French IP.",
    title2: "",
    lead:
      "403Shield builds a WireGuard tunnel to our Marseille server: public Wi-Fi hardened, carrier blinded, and a French IP wherever you roam. No account to create — the configuration IS the product.",
    cta: "Choose my plan",
    ctaSecondary: "Recover a configuration",
    hint:
      "Live in 30 seconds inside the free WireGuard app — pay with Wave or card.",
  },
  catalog: {
    kicker: "Simple pricing",
    title: "Two plans, one product",
    lead:
      "Pay with Wave or bank card (XOF). Provisioning is automatic: the configuration is emailed as soon as payment is confirmed.",
    monthly: { name: "Monthly", tagline: "No commitment, month by month", per: "1 month" },
    yearly: { name: "Yearly", tagline: "Pay 10 months, 2 offered", per: "12 months" },
    pop: "2 months free",
    bullets: [
      "WireGuard fulltunnel (French IP)",
      "Configuration delivered by email, importable in 30 seconds",
      "Self-service re-delivery with your reference",
      "403Shield space: device wallet and 1-click renewal",
      "Email support",
    ],
    cta: "Subscribe",
    closedTitle: "Direct sales coming soon",
    closedDesc:
      "403Shield VPN is opening up. Come back soon — or ask your local 403Shield manager for access (they sell the same product in your area).",
    onlineNote: "Secure online payment (Wave / card).",
    manualNote:
      "Pay by transfer: your access is activated as soon as the 403Shield team confirms.",
    waveAmount: "Wave price (mobile money discount included)",
    cardAmount: "Card price (fees included)",
  },
  buy: {
    title: "Subscribe to 403Shield VPN",
    desc:
      "Your WireGuard configuration is emailed as soon as payment is confirmed — activation takes about thirty seconds.",
    email: "Email address (configuration delivery)",
    emailPlaceholder: "you@example.com",
    phone: "Wave phone (required to pay with Wave)",
    phonePlaceholder: "225 07 00 00 00 00",
    phoneHint: "International format, no spaces or +.",
    method: "Payment method",
    methodWave: "Wave",
    methodCard: "Bank card",
    submit: "Pay and activate",
    submitting: "Creating the order…",
    waveAmount: "Wave price (mobile money discount included)",
    cardAmount: "Card price (fees included)",
    redirected: "Redirecting to the payment page…",
    manualTitle: "Order recorded",
    manualDesc:
      "Pay by transfer quoting the reference below: your VPN is provisioned automatically as soon as the 403Shield team confirms.",
    ref: "Order reference",
    errPending: "An order is already pending for this email",
    close: "Close",
  },
  status: {
    title: "Order tracking",
    desc:
      "Status refreshed continuously — the tunnel activates automatically once payment is confirmed.",
    pending: "Awaiting payment",
    pendingDesc:
      "Complete the payment on the page opened in the other tab, then come back here.",
    paid: "Payment confirmed",
    paidDesc: "Provisioning on the server — a few seconds…",
    provisioned: "Your VPN is live",
    provisionedDesc:
      "The configuration was sent to your email address. Import it into the WireGuard app (\"+\" → import), toggle the tunnel on: done.",
    cancelled: "Order cancelled",
    cancelledDesc:
      "Payment did not complete or the order was cancelled. You can create a new one.",
    expired: "Access reached its term",
    expiredDesc:
      "The access reached its end date. Subscribe again to restart — the configuration ships just like the first time.",
    term: "Valid until",
    ip: "Tunnel IP",
  },
  recover: {
    kicker: "Self-service",
    title: "Recover my configuration",
    desc:
      "Lost the delivery email? Enter your address and the order reference (MCV-…): the configuration is resent to you immediately.",
    email: "Order email address",
    ref: "Reference (MCV-…)",
    submit: "Resend my configuration",
    submitting: "Sending…",
    done: "If this order exists, the configuration was sent to your email address.",
    note:
      "The configuration is NEVER displayed on this page: it only leaves by email, to the order's address.",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "How do I activate my VPN?",
        a:
          "Install the WireGuard app (free — App Store, Google Play, wireguard.com/install). Open the delivery email, save the configuration as 403shield.conf, then in WireGuard: \"+\" → \"Import from file\". Toggle the tunnel on: your traffic exits through Marseille.",
      },
      {
        q: "Where do I manage my subscription?",
        a:
          "In your 403Shield space (console.403shield.ftci.fr): sign in with your email (a 6-digit code suffices — no password) — your accesses, their expiry and one-click renewal live there, alongside Pro Access for supervising your routers.",
      },
      {
        q: "What exactly do I receive?",
        a:
          "An email containing your complete WireGuard configuration, your order reference (MCV-…) and the end date of validity. This same page can resend it at any time during your plan.",
      },
      {
        q: "How many devices?",
        a:
          "The plan covers ONE WireGuard configuration (one key pair). Import it on the device of your choice — for several simultaneous devices, subscribe one order per device.",
      },
      {
        q: "What happens at the end of the period?",
        a:
          "The access is simply revoked at the term date (recoverable via this page until the last day). Renew from your space or subscribe again — no automatic renewal, no hidden charge.",
      },
      {
        q: "Can I get a refund?",
        a:
          "The tunnel is testable right after activation. For an unresolved technical issue within 7 days, the team cancels the order and revokes the access — contact support with your reference.",
      },
    ],
  },
};

/* ============================================================
   N°347 — COPIE DNS : LE BOUCLIER DNS TOURACO (réfs MCD-)
   ------------------------------------------------------------
   Même gabarit que le VPN, promesses adaptées au produit : ce
   n'est pas une configuration qui est livrée, c'est un DROIT
   (capacités étendues) porté par l'e-mail — l'activation part
   par e-mail dès confirmation, la gestion vit dans la console
   DNS (console.403shield.ftci.fr/dns). Le gratuit n'est jamais
   coupé : à l'expiration, les quotas retombent, les profils
   restent.
   ============================================================ */

const frDns: CheckoutCopy = {
  topbar: {
    space: "Ma console DNS",
  },
  hero: {
    badge: "403Shield Bouclier DNS — caisse sécurisée · powered by FTech CI",
    title1: "Votre internet, nettoyé",
    titleAccent: "à la source.",
    title2: "",
    lead:
      "TOURACO étend votre bouclier DNS 403Shield : 25 profils, 600 règles par liste, 15 logements et 90 jours de journal — publicité, traçage, pornographie et malware bloqués avant même d'arriver, la box comprise. Sans compte à créer : le droit est porté par votre e-mail.",
    cta: "Choisir ma formule",
    ctaSecondary: "Renvoyer mon activation",
    hint:
      "Le bouclier DNS reste utilisable gratuitement — TOURACO étend les capacités. Paiement Wave ou carte.",
  },
  catalog: {
    kicker: "Tarifs simples",
    title: "Deux formules, un seul bouclier",
    lead:
      "Paiement Wave ou carte bancaire (FCFA). L'activation est automatique : vos capacités TOURACO s'appliquent à votre e-mail dès l'encaissement confirmé.",
    monthly: { name: "TOURACO Mensuel", tagline: "Sans engagement, mois par mois", per: "1 mois" },
    yearly: { name: "TOURACO Annuel", tagline: "Payez 10 mois, 2 offerts", per: "12 mois" },
    pop: "2 mois offerts",
    bullets: [
      "25 profils de filtrage (publicité, traçage, pornographie, malware)",
      "600 règles par liste bloquer / autoriser",
      "15 logements — domicile, bureau, maison de famille",
      "Journal des requêtes 90 jours",
      "Le droit suit votre e-mail — le gratuit n'est jamais coupé",
    ],
    cta: "Souscrire",
    closedTitle: "La vente directe arrive bientôt",
    closedDesc:
      "L'abonnement TOURACO est en cours d'ouverture. Le bouclier DNS reste utilisable gratuitement dans la console — revenez bientôt pour étendre vos capacités.",
    onlineNote: "Paiement en ligne sécurisé (Wave / carte).",
    manualNote:
      "Règlement par virement : votre droit TOURACO est activé dès confirmation de l'équipe 403Shield.",
    waveAmount: "Prix Wave (remise mobile money incluse)",
    cardAmount: "Prix carte (frais inclus)",
  },
  buy: {
    title: "Souscrire TOURACO",
    desc:
      "Vos capacités étendues s'appliquent à votre e-mail dès le paiement confirmé — l'e-mail d'activation résume tout et pointe vers votre console DNS.",
    email: "Adresse e-mail (elle porte le droit TOURACO)",
    emailPlaceholder: "vous@exemple.com",
    phone: "Téléphone Wave (requis pour payer par Wave)",
    phonePlaceholder: "225 07 00 00 00 00",
    phoneHint: "Format international, sans espaces ni +.",
    method: "Moyen de paiement",
    methodWave: "Wave",
    methodCard: "Carte bancaire",
    submit: "Payer et activer",
    submitting: "Création de la commande…",
    waveAmount: "Prix Wave (remise mobile money incluse)",
    cardAmount: "Prix carte (frais inclus)",
    redirected: "Redirection vers la page de paiement…",
    manualTitle: "Commande enregistrée",
    manualDesc:
      "Réglez par virement en indiquant la référence ci-dessous : dès confirmation par l'équipe 403Shield, l'activation TOURACO part par e-mail — vos profils et réglages restent inchangés.",
    ref: "Référence de commande",
    errPending: "Une commande est déjà en attente pour cet e-mail",
    close: "Fermer",
  },
  status: {
    title: "Suivi de commande",
    desc:
      "Statut actualisé en continu — vos capacités TOURACO s'appliquent automatiquement dès l'encaissement confirmé.",
    pending: "En attente de paiement",
    pendingDesc:
      "Réglez la commande sur la page de paiement ouverte dans un autre onglet, puis revenez ici.",
    paid: "Paiement confirmé",
    paidDesc: "Activation de vos capacités — quelques secondes…",
    provisioned: "TOURACO est actif",
    provisionedDesc:
      "L'e-mail d'activation a été envoyé à votre adresse. Vos capacités étendues (25 profils, 600 règles, 15 logements, journal 90 jours) sont actives jusqu'au terme — profils, listes et couvre-feux se gèrent dans la console DNS.",
    cancelled: "Commande annulée",
    cancelledDesc:
      "Le paiement n'a pas abouti ou la commande a été annulée. Vous pouvez en créer une nouvelle.",
    expired: "Droit arrivé à terme",
    expiredDesc:
      "Le droit TOURACO a atteint sa date de fin : les capacités retombent aux quotas gratuits, rien n'est coupé. Souscrivez à nouveau quand vous voulez.",
    term: "Capacités étendues jusqu'au",
    consoleCta: "Ouvrir la console DNS",
  },
  recover: {
    kicker: "Self-service",
    title: "Renvoyer mon activation",
    desc:
      "Égaré l'e-mail d'activation ? Indiquez votre adresse et la référence de la commande (MCD-…) : l'e-mail d'activation vous est renvoyé immédiatement.",
    email: "Adresse e-mail de la commande",
    ref: "Référence (MCD-…)",
    submit: "Renvoyer mon activation",
    submitting: "Envoi…",
    done: "Si cette commande existe, l'e-mail d'activation a été envoyé à votre adresse.",
    note:
      "L'activation n'est JAMAIS affichée sur cette page : elle part uniquement par e-mail, à l'adresse de la commande.",
  },
  faq: {
    title: "Questions fréquentes",
    items: [
      {
        q: "Comment j'active TOURACO ?",
        a:
          "Il n'y a rien à installer de plus : le droit TOURACO s'applique à votre e-mail dès le paiement confirmé. L'e-mail d'activation résume vos nouvelles capacités et vous ouvre la console DNS, où vivent vos profils.",
      },
      {
        q: "Où gérer mes profils et mes règles ?",
        a:
          "Dans la console DNS (console.403shield.ftci.fr/dns) : connectez-vous avec votre e-mail (un code à 6 chiffres suffit, sans mot de passe) — profils, listes bloquer / autoriser, couvre-feux, logements et journal y vivent.",
      },
      {
        q: "Que reçois-je exactement ?",
        a:
          "Un e-mail d'activation contenant vos capacités TOURACO, votre référence de commande (MCD-…) et la date de fin de validité. Cette même page peut vous le renvoyer à tout moment pendant la durée de votre formule.",
      },
      {
        q: "Et si je perds l'e-mail d'activation ?",
        a:
          "La récupération est self-service : indiquez votre adresse et la référence de la commande, l'e-mail d'activation est renvoyé immédiatement.",
      },
      {
        q: "Que se passe-t-il à la fin de la période ?",
        a:
          "Aucune coupure : vos profils, vos listes et vos couvre-feux restent en place, seules les capacités retombent aux quotas gratuits (10 profils, 200 règles, 5 logements, journal 30 jours). Aucune reconduction tacite, aucun prélèvement caché.",
      },
      {
        q: "Le bouclier DNS gratuit reste-t-il gratuit ?",
        a:
          "Oui, pour toujours. TOURACO étend les capacités de ce que vous utilisez déjà — souscrire ou non ne change rien au filtrage de base.",
      },
      {
        q: "Puis-je être remboursé ?",
        a:
          "Le bouclier est testable gratuitement avant tout achat. En cas de problème technique non résolu par le support dans les 7 jours, l'équipe annule la commande — contactez le support avec votre référence.",
      },
    ],
  },
};

const enDns: CheckoutCopy = {
  topbar: {
    space: "My DNS console",
  },
  hero: {
    badge: "403Shield DNS Shield — secure checkout · powered by FTech CI",
    title1: "Your internet, cleaned",
    titleAccent: "at the source.",
    title2: "",
    lead:
      "TOURACO extends your 403Shield DNS shield: 25 profiles, 600 rules per list, 15 homes and a 90-day log — ads, trackers, porn and malware blocked before they even arrive, box included. No account to create: the right is carried by your email.",
    cta: "Choose my plan",
    ctaSecondary: "Resend my activation",
    hint:
      "The DNS shield stays free to use — TOURACO extends the capacities. Pay with Wave or card.",
  },
  catalog: {
    kicker: "Simple pricing",
    title: "Two plans, one shield",
    lead:
      "Pay with Wave or bank card (XOF). Activation is automatic: your TOURACO capacities apply to your email as soon as payment is confirmed.",
    monthly: { name: "TOURACO Monthly", tagline: "No commitment, month by month", per: "1 month" },
    yearly: { name: "TOURACO Yearly", tagline: "Pay 10 months, 2 offered", per: "12 months" },
    pop: "2 months free",
    bullets: [
      "25 filtering profiles (ads, trackers, porn, malware)",
      "600 rules per block / allow list",
      "15 homes — house, office, family house",
      "90-day query log",
      "The right follows your email — the free tier is never cut off",
    ],
    cta: "Subscribe",
    closedTitle: "Direct sales coming soon",
    closedDesc:
      "The TOURACO subscription is opening up. The DNS shield remains free to use in the console — come back soon to extend your capacities.",
    onlineNote: "Secure online payment (Wave / card).",
    manualNote:
      "Pay by transfer: your TOURACO right is activated as soon as the 403Shield team confirms.",
    waveAmount: "Wave price (mobile money discount included)",
    cardAmount: "Card price (fees included)",
  },
  buy: {
    title: "Subscribe to TOURACO",
    desc:
      "Your extended capacities apply to your email as soon as payment is confirmed — the activation email sums it up and opens your DNS console.",
    email: "Email address (it carries the TOURACO right)",
    emailPlaceholder: "you@example.com",
    phone: "Wave phone (required to pay with Wave)",
    phonePlaceholder: "225 07 00 00 00 00",
    phoneHint: "International format, no spaces or +.",
    method: "Payment method",
    methodWave: "Wave",
    methodCard: "Bank card",
    submit: "Pay and activate",
    submitting: "Creating the order…",
    waveAmount: "Wave price (mobile money discount included)",
    cardAmount: "Card price (fees included)",
    redirected: "Redirecting to the payment page…",
    manualTitle: "Order recorded",
    manualDesc:
      "Pay by transfer quoting the reference below: as soon as the 403Shield team confirms, the TOURACO activation email is sent — your profiles and settings stay unchanged.",
    ref: "Order reference",
    errPending: "An order is already pending for this email",
    close: "Close",
  },
  status: {
    title: "Order tracking",
    desc:
      "Status refreshed continuously — your TOURACO capacities apply automatically once payment is confirmed.",
    pending: "Awaiting payment",
    pendingDesc:
      "Complete the payment on the page opened in the other tab, then come back here.",
    paid: "Payment confirmed",
    paidDesc: "Activating your capacities — a few seconds…",
    provisioned: "TOURACO is live",
    provisionedDesc:
      "The activation email was sent to your address. Your extended capacities (25 profiles, 600 rules, 15 homes, 90-day log) are live until the term — profiles, lists and curfews are managed in the DNS console.",
    cancelled: "Order cancelled",
    cancelledDesc:
      "Payment did not complete or the order was cancelled. You can create a new one.",
    expired: "Right reached its term",
    expiredDesc:
      "The TOURACO right reached its end date: capacities fall back to the free quotas, nothing is cut off. Subscribe again whenever you want.",
    term: "Extended capacities until",
    consoleCta: "Open the DNS console",
  },
  recover: {
    kicker: "Self-service",
    title: "Resend my activation",
    desc:
      "Lost the activation email? Enter your address and the order reference (MCD-…): the activation email is resent to you immediately.",
    email: "Order email address",
    ref: "Reference (MCD-…)",
    submit: "Resend my activation",
    submitting: "Sending…",
    done: "If this order exists, the activation email was sent to your address.",
    note:
      "The activation is NEVER displayed on this page: it only leaves by email, to the order's address.",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "How do I activate TOURACO?",
        a:
          "There is nothing more to install: the TOURACO right applies to your email as soon as payment is confirmed. The activation email sums up your new capacities and opens the DNS console, where your profiles live.",
      },
      {
        q: "Where do I manage my profiles and rules?",
        a:
          "In the DNS console (console.403shield.ftci.fr/dns): sign in with your email (a 6-digit code suffices — no password) — profiles, block/allow lists, curfews, homes and the log live there.",
      },
      {
        q: "What exactly do I receive?",
        a:
          "An activation email containing your TOURACO capacities, your order reference (MCD-…) and the end date of validity. This same page can resend it at any time during your plan.",
      },
      {
        q: "What if I lose the activation email?",
        a:
          "Recovery is self-service: enter your address and the order reference, the activation email is resent immediately.",
      },
      {
        q: "What happens at the end of the period?",
        a:
          "No cut-off: your profiles, lists and curfews stay in place — only the capacities fall back to the free quotas (10 profiles, 200 rules, 5 homes, 30-day log). No automatic renewal, no hidden charge.",
      },
      {
        q: "Does the free DNS shield stay free?",
        a:
          "Yes, forever. TOURACO extends the capacities of what you already use — subscribing or not changes nothing to the base filtering.",
      },
      {
        q: "Can I get a refund?",
        a:
          "The shield is testable for free before any purchase. For an unresolved technical issue within 7 days, the team cancels the order — contact support with your reference.",
      },
    ],
  },
};

/* N°347 — accès par langue PUIS par produit : le composant de caisse pioche
   checkoutCopy[lang][product] (le sélecteur vit à checkoutCopy[lang].switch). */
export const checkoutCopy: Record<CheckoutLang, CheckoutLangCopy> = {
  fr: {
    switch: { label: "Produit à commander", vpn: "VPN B2C", dns: "Bouclier DNS TOURACO" },
    vpn: frVpn,
    dns: frDns,
  },
  en: {
    switch: { label: "Product to order", vpn: "B2C VPN", dns: "DNS Shield TOURACO" },
    vpn: enVpn,
    dns: enDns,
  },
};
