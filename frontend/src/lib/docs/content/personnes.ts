// Section « Personnes » — 3 guides (N°304).
import type { Guide } from "../types";
import { cap } from "../cap";

export const PERSONNES_GUIDES: Guide[] = [
  {
    id: "utilisateurs",
    title: "Utilisateurs (comptes hotspot)",
    summary:
      "Les clients à compte : identifiants permanents, solde rechargeable, blocage/déblocage, et la frontière avec les inscriptions publiques.",
    roles: "Propriétaire · Gérant",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "personnes",
    vague: "V2",
    quoi:
      "Personnes → Utilisateurs gère les clients qui ont un COMPTE (identifiant + mot de passe), par opposition au voucher jetable : le compte se RECHARGE (du temps ou de l'argent s'accumule), garde son historique et se prête au fidèlement.\n\nLe hub est en deux onglets : Comptes (les clients) et Inscriptions (les demandes créées par le formulaire public — voir le guide Inscriptions publiques pour ce volet).",
    difference: [
      {
        with: "Le voucher",
        body:
          "Jetable, prépayé, anonyme — pour le passage. Le compte est personnel, rechargeable, suivi — pour la fidélité.",
      },
      {
        with: "L'abonné PPPoE",
        body:
          "L'utilisateur hotspot se connecte par le PORTAIL (browser) ; l'abonné PPPoE configure une connexion réseau. Même philosophie de compte, monde technique différent.",
      },
      {
        with: "Les membres d'équipe",
        body:
          "L'équipe (Paramètres → Équipe) gère VOTRE personnel console ; les utilisateurs gèrent VOS clients. Les rôles ne se mélangent pas.",
      },
    ],
    recoit: [
      "L'onglet Comptes : identifiant, solde (temps/crédit), statut (actif/bloqué), sessions cumulées, dépenses.",
      "Le dialogue de détail : fiche complète du client, recharges, historique, actions (bloquer, réinitialiser mot de passe, recharger).",
      "L'onglet Inscriptions : les demandes issues du formulaire public, à approuver/refuser.",
      "Le provisionnement passe par l'agent : un compte créé (ou bloqué) se matérialise sur le routeur au check-in (≤ 45 s).",
    ],
    etapes: [
      {
        title: "Ouvrez Personnes → Utilisateurs",
        body:
          "Le hub arrive sur l'onglet Comptes : la table liste vos clients avec solde et statut. Recherchez par identifiant, filtrez par statut.",
        capture: cap(
          "personnes/users.png",
          1440,
          1286,
          "Hub Utilisateurs : onglet Comptes avec identifiants, soldes et statuts des clients",
          "Le hub Utilisateurs — Comptes / Inscriptions.",
        ),
      },
      {
        title: "Créez un compte client",
        body:
          "Nouvel utilisateur : identifiant, mot de passe (ou génération), profil d'accès, solde initial. Le compte part au routeur au check-in — le client se connecte au portail avec ses identifiants, son solde s'épuise à l'usage.",
        tip: "Le compte client se prête au dépôt : le client laisse 5 000 F, vous rechargez son solde à chaque passage — plus rapide qu'un ticket, et fidélisant.",
      },
      {
        title: "Ouvrez le détail d'un client",
        body:
          "Cliquez un compte : le dialogue montre la fiche complète — sessions cumulées, volumes, recharges, dépenses. Vous pouvez recharger, réinitialiser le mot de passe (le client reçoit un nouveau), bloquer/débloquer.",
        capture: cap(
          "personnes/users-comptes.png",
          1440,
          900,
          "Onglet Comptes des utilisateurs hotspot avec recherche et statuts",
          "Comptes — soldes et statuts en direct.",
        ),
      },
      {
        title: "Bloquez en cas d'abus",
        body:
          "Le blocage suspend le compte côté routeur (au check-in) : sessions coupées, connexions refusées — le solde est préservé. Le déblocage suit le même chemin.",
      },
      {
        title: "Traitez les inscriptions",
        body:
          "L'onglet Inscriptions liste les demandes du formulaire public (QR, lien) : approuvez (le compte est créé, le client est notifié) ou refusez (motif). Le guide Inscriptions publiques détaille le circuit.",
        capture: cap(
          "personnes/users-inscriptions.png",
          1440,
          900,
          "Onglet Inscriptions : demandes de création de compte en attente d'approbation",
          "Inscriptions — le recrutement de comptes clients.",
        ),
      },
    ],
    usages: [
      {
        title: "Le « compte maison »",
        body:
          "Habitué du quartier : compte rechargeable, identifiant simple (prénom), plus besoin de ticket — il tape ses identifiants et navigue.",
      },
      {
        title: "Le dépôt de confiance",
        body:
          "Recharge du solde aux passages, état à l'appui (détail du compte) — une relation comptoir transparente.",
      },
    ],
    pieges: [
      {
        title: "Solde = temps, pas d'argent rendable",
        body:
          "Le solde est du temps de connexion (ou du crédit selon formule) : ce n'est pas une épargne remboursable. Cadrez les règles du dépôt avec votre clientèle.",
        severity: "warn",
      },
      {
        title: "Compte bloqué ≠ solde perdu",
        body:
          "Le blocage préserve le solde : c'est une suspension, pas une confiscation. La suppression seule efface (et demande confirmation).",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Un client oublie son mot de passe ?",
        a: "Réinitialisez depuis le détail : un nouveau mot de passe part par le canal de contact du compte (ou vous le lui remettez au comptoir).",
      },
      {
        q: "Puis-je convertir un utilisateur en abonné PPPoE ?",
        a: "Ce sont deux provisioning distincts : créez l'abonné PPPoE et laissez le compte hotspot expirer (ou bloquez-le) — le client change juste sa façon de se connecter.",
      },
    ],
    related: ["inscriptions-publiques", "premiere-vente", "revendeurs"],
  },

  {
    id: "inscriptions-publiques",
    title: "Inscriptions publiques (QR + approbation)",
    summary:
      "Recrutez des clients par QR code : le formulaire public crée des demandes, vous approuvez d'un clic, le compte est prêt — liens, QR et modération.",
    roles: "Propriétaire · Gérant",
    minutes: 4,
    updated: "2026-10-12",
    sectionId: "personnes",
    vague: "V3",
    quoi:
      "Personnes → Inscriptions (et l'onglet du hub Utilisateurs) gère le recrutement de comptes clients par formulaire PUBLIC : vous générez un LIEN ou un QR (affichable à l'entrée, sur les tickets, dans le quartier), les clients s'inscrivent seuls (identifiant + téléphone), et vous APPROUVEZ chaque demande avant création du compte.\n\nLa vue est en deux volets : Demandes (la file à modérer) et Liens & QR (les canaux de recrutement, avec réutilisation et révoquation).",
    difference: [
      {
        with: "Le WiFi jetable",
        body:
          "Le jetable donne un accès OFFERT immédiat (code à quota) ; l'inscription crée un COMPTE durable approuvé. Recrutement marketing vs recrutement client.",
      },
      {
        with: "L'inscription à MIKLOUD (vitrine)",
        body:
          "La vitrine crée des comptes D'EXPLOITANT (un nouveau gérant de hotspot) ; ici on inscrit VOS clients finaux. Deux publics, deux formulaires.",
      },
      {
        with: "La création manuelle",
        body:
          "Manuel = vous tapez la fiche ; public = le client la remplit et vous validez. L'un pour le comptoir, l'autre pour la quartier.",
      },
    ],
    recoit: [
      "Le volet Demandes : chaque inscription avec identifiant, téléphone, date — à approuver/refuser avec motif.",
      "Le volet Liens & QR : des liens d'inscription révocables, avec QR imprimables ; un lien révoqué cesse immédiatement de fonctionner.",
      "L'approbation crée le compte utilisateur (provisionné au routeur au check-in) — le client peut se connecter aussitôt selon votre politique d'accueil (solde initial éventuel).",
      "Le limiteur anti-abus protège le formulaire public (IP, cadence).",
    ],
    etapes: [
      {
        title: "Ouvrez Personnes → Inscriptions",
        body:
          "La vue arrive sur la file de demandes. Si vous démarrez : basculez sur l'onglet « Liens & QR » pour créer votre premier canal de recrutement.",
        capture: cap(
          "personnes/registrations.png",
          1440,
          900,
          "Vue Inscriptions : file des demandes publiques et gestion des liens et QR d'inscription",
          "Inscriptions — demandes et canaux.",
        ),
      },
      {
        title: "Créez un lien / QR d'inscription",
        body:
          "Nouveau lien : le QR s'affiche, prêt à imprimer (entrée du local, flyers, dos des tickets). Chaque lien est révocable — un QR devenu public se retire sans casser les autres.",
      },
      {
        title: "Modérez la file",
        body:
          "Chaque demande montre identifiant et téléphone : approuvez (compte créé, client notifié) ou refusez (motif conservé). L'approbation en série traite une pile en secondes.",
        tip: "Exigez un solde initial payant à l'approbation (politique maison) : l'inscription reste gratuite à soumettre, le premier accès se monnaie au comptoir.",
      },
      {
        title: "Suivez la conversion",
        body:
          "Les rapports d'activité croisent inscriptions et premières connexions : vous voyez si votre QR convertit (inscrits → clients actifs) ou juste curieux.",
      },
    ],
    usages: [
      {
        title: "Fidélisation de quartier",
        body:
          "QR à l'entrée : « créez votre compte, rechargez et naviguez sans ticket » — la file d'approbation filtre les farceurs.",
      },
      {
        title: "École / résidence",
        body:
          "Inscription en début d'année, approbation par liste (contrôle des téléphones connus), blocage en fin de session.",
      },
    ],
    pieges: [
      {
        title: "Un lien public vit longtemps",
        body:
          "Révoquez les liens imprimés devenus publics (fin de promo, changement de politique) : un QR d'entrée collé partout continue sinon d'inscrire des gens des années plus tard.",
        severity: "warn",
      },
      {
        title: "La modération reste humaine",
        body:
          "Aucune approbation automatique : une file non traitée retient vos clients (inscrits sans compte). Consacrez-y 2 minutes par jour.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Le client peut-il choisir son mot de passe ?",
        a: "Le formulaire public fixe identifiant et contact ; le mot de passe suit la politique du compte (généré/remis à l'activation selon configuration).",
      },
      {
        q: "Combien de liens puis-je avoir ?",
        a: "Plusieurs, tous révocables individuellement — pratique pour tracer la provenance (QR vitrine vs QR flyer).",
      },
    ],
    related: ["utilisateurs", "wifi-jetable", "equipe"],
  },

  {
    id: "revendeurs",
    title: "Revendeurs, crédits et Mode Vente",
    summary:
      "Externalisez la vente : créez des revendeurs avec PIN, créditez-les en tickets, laissez-les vendre depuis leur téléphone (Mode Vente), encaissez les versements.",
    roles: "Propriétaire",
    minutes: 5,
    updated: "2026-10-12",
    sectionId: "personnes",
    vague: "V1",
    quoi:
      "Personnes → Revendeurs transforme vos kiosqueurs/ vendeurs de rue en points de vente : chaque revendeur reçoit un code PIN et un CRÉDIT de tickets (des lots que vous lui transférez). Il vend ensuite en autonomie depuis son téléphone via le Mode Vente (/sell) — sans accès à votre console.\n\nLa relation financière passe par les TRANSACTIONS : versements encaissés (« Encaisser »), créances en dépôt-vente, régularisation au settle. La vue liste vos revendeurs, leurs soldes/stocks et les transactions récentes.",
    difference: [
      {
        with: "Un gérant (équipe)",
        body:
          "Le gérant accède à la CONSOLE (gestion complète) ; le revendeur n'accède qu'au MODE VENTE (vendre, consulter son stock) avec un simple PIN. Délégation commerciale ≠ délégation de gestion.",
      },
      {
        with: "Le dépôt-vente papier",
        body:
          "Même mécanique, sans les carnets : le lot transféré est le dépôt, le versement est l'encaissement, la reprise est le retour d'invendus — tout tracé, zéro litige de comptes.",
      },
      {
        with: "La vitrine VPN",
        body:
          "La vitrine vend au CLIENT FINAL en ligne (paiement direct) ; le revendeur vend de la main à la main. Deux canaux, un seul stock d'origine.",
      },
    ],
    recoit: [
      "Chaque revendeur : nom, PIN (changé/désactivable), stock de tickets (lots transférés), solde/ créance, historique de transactions.",
      "Le Mode Vente (téléphone du revendeur) : vente en 3 touches, impression/QR du ticket, consultation du stock restant — lien /sell, onglet Revendeur.",
      "Vous : bouton « Encaisser » (versement du revendeur), actions par revendeur (modifier, désactiver, supprimer), transactions récentes.",
      "La chaîne de traçabilité : lot → transfert → vente (session client) → versement — entièrement dans les rapports.",
    ],
    etapes: [
      {
        title: "Créez le revendeur",
        body:
          "Personnes → Revendeurs → « Nouveau revendeur » : nom (ex. « Dialo ») et PIN. Le PIN est son seul « mot de passe » — 4 à 6 chiffres faciles à retenir, durcissable ensuite.",
        capture: cap(
          "personnes/reseller-create.png",
          1440,
          900,
          "Dialogue de création d'un revendeur : nom et code PIN",
          "Créer un revendeur — un nom, un PIN.",
        ),
      },
      {
        title: "Transférez un lot (son crédit)",
        body:
          "Générez un lot de vouchers (guide Vouchers) puis transférez-le : les codes deviennent son stock — il les voit en Mode Vente, vous suivez le détenteur dans l'onglet Vouchers. La créance associée (valeur du lot) se régularisera au versement.",
        capture: cap(
          "personnes/resellers.png",
          1440,
          900,
          "Vue Revendeurs : liste des revendeurs avec stock et solde, boutons Encaisser et actions",
          "Les revendeurs — stock, créance et transactions.",
        ),
      },
      {
        title: "Il vend en Mode Vente",
        body:
          "Sur SON téléphone : 403shield.ftci.fr/sell → onglet Revendeur → PIN. Il voit son stock par forfait, vend (le ticket s'affiche avec QR, partageable/imprimable), et suit son reste. Aucune formation nécessaire — 3 touches.",
        capture: cap(
          "annexes/mode-vente-login.png",
          1440,
          900,
          "Page de connexion Mode Vente avec l'onglet Revendeur et la saisie du PIN",
          "Le Mode Vente — l'onglet Revendeur du login.",
        ),
      },
      {
        title: "Encaissez les versements",
        body:
          "Quand le revendeur vous remporte l'argent : « Encaisser » enregistre le versement (montant, note) — sa créance baisse d'autant. Les transactions récentes de la vue (et les rapports) retracent chaque mouvement.",
        capture: cap(
          "personnes/reseller-actions.png",
          1440,
          900,
          "Menu d'actions d'un revendeur : Encaisser un versement, Modifier, Désactiver, Supprimer",
          "Actions revendeur — encaissement, modification, désactivation.",
        ),
      },
      {
        title: "Désactivez / retirez le stock",
        body:
          "Un départ : désactivez (PIN inopérant, stock gelé) puis reprenez les invendus (guide Vouchers — reprise) avant suppression. Rien ne se perd, rien ne se vend sans comptabilité.",
        tip: "Le versement partiel est possible (acompte) : la créance résiduelle reste visible jusqu'au versement complet.",
      },
    ],
    usages: [
      {
        title: "Le kiosque relais",
        body:
          "Le kiosque à côté vend vos tickets à la commission : lot transféré, versement hebdomadaire, la créance suit — un réseau de distribution sans salariés.",
      },
      {
        title: "Le vendeur de quartier",
        body:
          "Vendeur ambulant avec son téléphone : stock « 1 Heure », il encaisse 100 F par ticket, vous verse 80 F (selon votre marge) — le dépôt-vente digitalisé.",
      },
      {
        title: "Un membre de la famille",
        body:
          "Un proche tient la vente quand vous n'êtes pas là : PIN dédié, versements à votre retour — plus simple qu'un compte gérant complet.",
      },
    ],
    pieges: [
      {
        title: "Le PIN est LE secret du revendeur",
        body:
          "Il ouvre le Mode Vente (vente, stock) — pas la console. Faites-le changer à la première connexion si vous l'avez choisi vous-même, et désactivez-le immédiatement en cas de départ.",
        severity: "warn",
      },
      {
        title: "Créance et stock ne sont pas l'argent",
        body:
          "La créance mesure le POTENTIEL encaissable (tickets vendables) — l'argent arrive avec les versements. Suivez les deux colonnes séparément pour éviter les malentendus de fin de mois.",
        severity: "info",
      },
      {
        title: "Vendeur multi-établissements ?",
        body:
          "Un revendeur vit dans VOTRE compte. Pour vendre pour plusieurs exploitants, il faut un revendeur par compte (PIN distincts) — le cloisonnement est la règle 403Shield.",
        severity: "info",
      },
    ],
    faq: [
      {
        q: "Le revendeur peut-il générer des tickets lui-même ?",
        a: "Non — il ne vend que le stock transféré. La génération (et la consommation de crédit) reste à la console : vous maîtrisez l'émission.",
      },
      {
        q: "Comment calculer sa commission ?",
        a: "Au versement : convenez d'un pourcentage (ex. 20 %) et enregistrez le montant net remis — la note de transaction garde la trace. La marge consolidée reste dans Rapports → Marge.",
      },
      {
        q: "Puis-je limiter le stock d'un revendeur ?",
        a: "Oui : c'est vous qui transférez les lots — la quantité transférée EST la limite (complétez par reprise si besoin).",
      },
    ],
    related: ["vouchers-lots", "mode-vente", "rapports-comptabilite"],
  },
];
