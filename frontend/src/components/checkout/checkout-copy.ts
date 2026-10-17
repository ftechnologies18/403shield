// checkout-copy.ts — N°323 — copie bilingue AUTO-CONTENUE de la caisse de la
// vitrine (/checkout). Portée depuis tunnel-console/src/components/shop/
// shop-copy.ts (N°316) lors du retour de la boutique au site marketing
// (modèle OVH : commander sur www, gérer dans le manager). La partie
// transactionnelle (dialog d'achat, suivi, récupération, FAQ) est portée à
// l'identique — seuls l'en-tête et le catalogue passent au gabarit clay de la
// vitrine. Promesses RÉELLES uniquement (fulltunnel wg0 VM, livraison e-mail,
// récupération self-service, terme réglé à l'avance, espace 403Shield pour
// gérer et renouveler). Langue pilotée par le store global de la vitrine.

export type CheckoutLang = "fr" | "en";

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
    ip: string;
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

const fr: CheckoutCopy = {
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

const en: CheckoutCopy = {
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

export const checkoutCopy: Record<CheckoutLang, CheckoutCopy> = { fr, en };
