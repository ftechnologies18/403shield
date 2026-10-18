# MARQUE 403SHIELD — Enregistrement de décision & plan de migration

> **N°317 — pivot de marque acté par le propriétaire** (à la suite de l'étude N°316).
> Statut : **Phases 1, 2 et 3 LIVRÉES** (N°317 puis N°318 — le tuteur a posé
> lui-même le DNS et le 301 avec le token de compte Cloudflare fourni).

## 1. La décision

Le propriétaire a tranché après l'étude N°316 (architecture de marque, 3 scénarios
A/B/C) et sa livraison (Option C : maison MikCloud, sous-marque MikTunnel endossée
— commits 792ea68, 38d3b19, e656885) :

1. **Nouveau nom** : `403Shield` remplace MikCloud ET MikTunnel.
   Le « 403 » (HTTP Forbidden) porte la promesse : l'accès refusé aux
   indésirables ; « Shield » la dit dans la langue du marché.
2. **Retour à l'Option A** : marque unifiée (l'étude la notait 42/50 — friction
   nulle entre produits, un seul nom à marketer).
3. **Voie Cloudflare/OVH** : UN site marketing multipage à menu complet +
   UNE console transactionnelle — comme `cloudflare.com` / `dash.cloudflare.com`.

## 2. L'architecture cible

```
FTech CI (ftci.fr) — la maison-mère, « powered by FTech CI »
└── 403Shield — la marque unifiée (ex MikCloud + ex MikTunnel)
    ├── Site unifié : 403shield.ftci.fr (CANONIQUE N°318 — ex mikcloud.ftci.fr,
    │   301 permanent ; CNAME → cname.vercel-dns.com, DNS only)
    │     /            vitrine de la suite (Hotspot · VPN · Tunnels)
    │     /hotspot    page produit 403Shield Hotspot
    │     /vpn        page produit 403Shield VPN (CTA → boutique console)
    │     /tunnels    page produit 403Shield Tunnels (CTA → console)
    │     /app, /sell, /docs…  console SaaS d'exploitation (inchangée)
    ├── Console : tunnel.ftci.fr (« 403Shield Console »)
    │     /shop boutique VPN · /me espace client · /pro Accès Pro
    │     /login /verify (code e-mail, JWT rôle tunnel)
    └── (à venir) Firewall cloud FAI — 4e porte de la suite
```

## 3. Ce que devient le travail N°316 (rien n'est défait)

Le geste N°316 — déménagement de la vente B2C sur `tunnel.ftci.fr/shop`, 301 sur
`/vpn`, whitelist CORS réparée — est **exactement le découpage Cloudflare**
(vitrine ≠ console). Il est conservé intégralement ; seul l'habillage change :

| N°316 (Option C)                        | N°317 (Option A)                              |
| --------------------------------------- | --------------------------------------------- |
| `mikcloud.ftci.fr` — marque MikCloud     | site unifié **403Shield** + pages produit     |
| `tunnel.ftci.fr` — « MikTunnel by MikCloud » | **403Shield Console** (badge « Console ») |
| 301 `/vpn` → `tunnel.ftci.fr/shop`       | 301 **conditionnelle** `?order=` préservée ; `/vpn` propre = page produit |
| e-mails « MikTunnel (by MikCloud · …) »  | ✅ N°318 — 403Shield (powered by FTech CI) |

## 4. Phase 1 — livrée dans ce commit

- **Vitrine unifiée** (`frontend/`) : rebrand complet de la copie FR/EN
  (hero « Votre réseau, sous bouclier. », marquee suite, footer Écosystème),
  **menu complet** Accueil · Hotspot · VPN · Tunnels · Tarifs (topbar desktop,
  sous-nav mobile), **3 pages produit** `/hotspot`, `/vpn`, `/tunnels`
  (composant `ProductPage` Clay réutilisable, layouts serveur avec metadata,
  pages publiques indexables), redirection `/vpn` limitée à la query `?order=`
  (liens de retour GeniusPay historiques préservés).
- **Console** (`tunnel-console/`) : rebrand « 403Shield Console » de toutes les
  surfaces (barre écosystème, en-têtes, `/shop`, `/me`, `/pro`, `/login`,
  `/verify`), métadonnées + noindex conservés, **références MCV- intactes**
  (contrat GeniusPay), clés localStorage `miktunnel_*` intactes (sinon
  déconnexion de tous les clients existants).
- **Identité** : bouclier 403Shield (`docs/brand/` — version clay ivoire pour la
  vitrine, version émeraude nuit pour la console), favicons + manifest PWA.
- **Pass léger console SaaS** : écran de connexion, topbar, nom PWA, toasts
  d'inscription (le dictionnaire i18n profond reste en phase 2).

Occurrences « MikCloud »/« MikTunnel » volontairement conservées (honnêteté) :
URLs fonctionnelles (`api.mikcloud.ftci.fr`, `mikcloud.ftci.fr` tant que le DNS
n'a pas bougé), clés localStorage, `mikcloud.conf` (nom de fichier réellement
instruit par les e-mails backend), références `MCV-`, commentaires historiques.

## 5. Phase 2 — LIVRÉE (N°318)

1. **E-mails transactionnels backend** ✅ : 319 remplacements (84 fichiers) —
   titres/corps/signatures « 403Shield (powered by FTech CI) », chatbot FR/EN,
   TOTP issuer, PlatformConfig défaut, émetteurs Resend/SMTP, descriptions
   GeniusPay, exports CSV `403shield-*`, `:log` RouterOS du script d'installation,
   consigne fichier `403shield.conf` (alignée FAQ boutique). Portes :
   gofmt/vet/build verts, `go test` 11/11.
2. **Dictionnaire i18n profond** ✅ : ~320 remplacements (112 fichiers) —
   FR/EN miroir, guides, page légale (« édité par FTech CI »), portail offert,
   exports, monogrammes. lint 0 · tsc 0.
3. **Renommage des projets Vercel** ✅ : `mikcloud` → `403shield`,
   `miktunnel` → `403shield-console` (alias `403shield.vercel.app` → 301
   `403shield.ftci.fr`).

## 6. Phase 3 — EXÉCUTÉE par le tuteur (N°318)

Le token Cloudflare fourni s'est révélé être un **token de COMPTE** (portée
zone `ftci.fr`, `dns_records:edit`) : l'endpoint `/user/tokens/verify` répond
« Invalid » pour tout token non-user — la preuve de validité se fait sur
`GET /zones` (réussi). Gestes posés :

1. ✅ `403shield.ftci.fr` CNAME → `cname.vercel-dns.com` (DNS only, miroir du
   schéma `tunnel.ftci.fr`) + TXT `_vercel.ftci.fr` de vérification ;
2. ✅ domaine attaché au projet Vercel frontend, VÉRIFIÉ, HTTP 200 +
   certificat émis ; whitelist CORS étendue AVANT le 301 (workflow
   `ops-cors-whitelist.yml` devenu paramétrable — input `origins`) ;
3. ✅ **301 `mikcloud.ftci.fr` → `403shield.ftci.fr`** posé chez Vercel
   (redirect domain, chemins + query préservés — la chaîne GeniusPay
   `/vpn?order=…` suit jusqu'à `tunnel.ftci.fr/shop?order=…`).

Reste à la main du propriétaire (décision future explicite, aucune urgence) :
`api.mikcloud.ftci.fr` (hôte API — renommer = geste VM + env + CORS),
`tunnel.ftci.fr` → `console.403shield.ftci.fr` le jour voulu, nom du dépôt
GitHub, libellés stockés en base (renommables depuis la console).

## 6-bis. N°319 — LES GESTES AUTOMATISABLES, EXÉCUTÉS DEPUIS LE COFFRE GITHUB

Les tokens Cloudflare DNS et Vercel de la session N°318 ne vivent que dans
le canal conversation — mais le coffre GitHub (N°269) porte `VERCEL_TOKEN`
et les secrets SSH/DB de la VM : trois workflows ops ont été créés
(`ops-vercel-domains.yml`, `ops-rebrand-db.yml`, `ops-vm-rebrand.yml`) et
dispatchés avec preuves. Gestes posés :

1. ✅ **Vitrine B2C OUVERTE** (rappel N°316) : `publicVpnShop: true` par le
   geste console automatisé (`PUT /api/admin/platform/settings`) —
   `{"enabled":true,"onlinePayment":true}` servi sur l'URL publique,
   catalogue 403Shield (Mensuel 1500 F / Annuel 15000 F + frais Wave/carte).
2. ✅ **Libellés DB** : tenant acc-main et plan « Hotspot Mensuel » du
   compte Benie renommés MikCloud → 403Shield (SQL chirurgical + backup
   `ops_rebrand_backup` + `/api/admin/reload` + geste console API) ; nom de
   plateforme → 403Shield.
3. ✅ **Dépôt GitHub renommé** : `ftechnologies18/mikcloud` →
   **`ftechnologies18/403shield`** (redirections 301 GitHub — web/git/API ;
   Vercel suit le repo par ID).
4. ✅ **console.403shield.ftci.fr — gestes Vercel + CORS de la recette** :
   domaine attaché au projet `403shield-console` (workflow
   `ops-vercel-domains`, token du coffre) + origine
   `https://console.403shield.ftci.fr` whitelistée AVANT toute 301
   (`ops-cors-whitelist` paramétrable — 11 origines, preuve par origine).
5. ✅ **api.403shield.ftci.fr ARMÉ sur Caddy** : bloc site
   `api.mikcloud.ftci.fr, api.403shield.ftci.fr` (backup + validate +
   reload) — l'ACME émettra SEUL dès le DNS.

### Recettes propriétaire — EXÉCUTÉES le 17/10/2026 (N°320), preuves mesurées

**console.403shield.ftci.fr (2 records, puis 1 dispatch) — FAIT** :
1. ✅ TXT `_vercel.ftci.fr` =
   `vc-domain-verify=console.403shield.ftci.fr,559ecca8236acf29de36`
   (posé à côté des 6 TXT existants — plusieurs valeurs licites) ;
2. ✅ CNAME `console.403shield` → `cname.vercel-dns.com`, DNS only ;
3. ✅ vérification Vercel (`POST …/verify` → `verified:true`), HTTP 200,
   puis 301 tunnel.ftci.fr → `https://console.403shield.ftci.fr` posée
   puis re-dispatchée sur le workflow CORRIGÉ (run #39058805829
   SUCCESS). **LEÇON N°320 : le PATCH Vercel exige le domaine NU dans
   `redirect`** — une URL `https://…` rend 400 « domain not added to
   the project » (l'API compare la cible aux noms de domaines du
   projet) ; fix commit d92e726 (normalisation TO → TO_DOMAIN).

**api.403shield.ftci.fr (1 record) — FAIT** :
1. ✅ A `api.403shield.ftci.fr` → `84.235.228.160`, DNS only ;
2. ✅ certificat Let's Encrypt émis (subject `CN=api.403shield.ftci.fr`,
   17/10/2026 → 15/01/2027) — le backoff certmagic ne se réveille pas
   seul quand le DNS atterrit (cause racine du T2 N°245-b) : dispatch
   `t2-caddy-rescue.yml` (restart) → émission immédiate ;
   `curl -sI https://api.403shield.ftci.fr/` → 200, `{"ok":true}` ;
3. ✅ bascule `NEXT_PUBLIC_API_BASE` → `https://api.403shield.ftci.fr`
   (production + preview, PATCH puis redeploy dpl_GrtumFJ…) — le bundle
   de la console ne référence PLUS QUE api.403shield.ftci.fr (preuve :
   grep des chunks /login /verify /me : 1 chunk nouveau, 0 ancien).

**Smoke test terrain** (l'étalon physique, 15 min sur place) : achat 1 F →
retour boutique → conf livrée → tunnel → espace client → renouvellement —
**SEUL geste restant** au propriétaire.

## 6-ter. N°321 — la vitrine marketing rattrape l'unification (commit a8a68eb)

Le propriétaire relève que la vitrine « semble figée sur les services
hotspot d'avant » et que « VPN WireGuard et tunnel apparaissent comme des
services différents alors qu'ils sont liés ». Corrigé à la racine
(5 fichiers, +568/−118, vérifié au navigateur en production) :

- **Tunnels WireGuard = 4e pilier** de la vitrine : 4e carte super-pouvoir
  (« Une suite, quatre piliers », grille 2×2), section `#tunnels` dédiée
  (rail + mobile, icône Waypoints), 4e stat (« 2 usages du tunnel — VPN &
  Accès Pro »), hero/marquee/CTA final réécrits FR+EN.
- **« Un tunnel, deux usages »** partout : le nav porte UNE entrée
  « Tunnels WireGuard » (hub `/tunnels`, active aussi sur `/vpn`) ; `/vpn`
  re-badge « Tunnels WireGuard · VPN » avec la note « Un seul tunnel, deux
  usages » ; `/tunnels` devient le hub famille (hero « Un seul tunnel.
  Deux usages. », carte pivot « VPN personnel — le même tunnel »).
- **Segment tarifs « Tunnels »** (3e du sélecteur) aux prix catalogue
  RÉELS du backend (`publicvpnorder.go`) : VPN Mensuel 1 500 / VPN Annuel
  15 000 (badge « 2 mois offerts ») / Accès Pro 3 500 · 35 000 FCFA —
  CTA liens externes boutique/console (pas la modale SaaS).
- **URLs canoniques** : les liens vitrine visent `console.403shield.ftci.fr`
  direct (tunnel.ftci.fr → 301 depuis N°320) ; la redirection GeniusPay
  `vercel.json` `/vpn?order=` → boutique canonique (un saut de moins).

Portes : lint 0 · tsc 0 · parité FR/EN 442=442 chemins + 15 assertions.

## 6-quater. N°322 — HomeNet cesse d'être un service indépendant (commit f573179)

Troisième grief de fragmentation après N°321 : « Supprimer HomeNet comme
service indépendant avec ses tarifs, il est déjà lié à l'offre Hotspot. »
Le backend (`tenant.go` N°122) le confirme — HomeNet est un SEGMENT
D'USAGE du même abonnement (même compte, même console, mêmes 4 protections,
même facturation), pas un produit. Avis rendu avec une nuance conservée :
les tarifs foyer sont réels (1 250 F/mois/routeur · 12 000 F/an · essai
30 j — la maison paie deux fois moins cher) ; les effacer cacherait
l'argument « moitié prix ». Livré (2 fichiers, +126/−135, vérifié au
navigateur en production) :

- **Segment « homenet » RETIRÉ** du sélecteur tarifs (FR+EN) : la grille
  de 3 cartes parallèles disparaît ; le sélecteur passe de 3 à 2 segments
  (« Hotspot · HomeNet » / « Tunnels · boutique », aria-label « Console ou
  boutique ? »), le type `priceMode` devient `"hotspot" | "tunnels"`.
- **Tarif foyer LIÉ à l'offre Hotspot** : les cartes de la grille console
  portent le mode en option (Découverte « Mode foyer (HomeNet) : essai
  30 jours », Annuel « 12 000 F/an », Mensuel « 1 250 F/mois/routeur » —
  constantes catalogue recopiées telles quelles), chips clientèle
  + « Foyers », hint « Un foyer ? C'est le même abonnement en mode
  HomeNet ».
- **Récit « Un abonnement, un tunnel »** : titre tarifs « Trois univers,
  un nuage » → « Un abonnement, un tunnel. », sous-titre fusionné (réseau
  public OU foyer = le MÊME abonnement), marquee « Mode HomeNet · le foyer
  sur le même abonnement », note devises « Un abonnement console, deux
  modes » — dans la lignée du « un tunnel, deux usages ».
- **Intacts** : catalogue backend et facturation (la vitrine n'affiche
  pas, ne vend pas), modale d'inscription et sélecteur d'usage (parcours
  réel N°101), chatbot (répond déjà « Deux modes, deux grilles »), pages
  produit, prix 0/25 000/2 500 et 1 500/15 000/3 500 inchangés.

Portes : lint 0 · tsc 0 · parité FR/EN 411=411 chemins (442 − 31 retirés)
+ 25 assertions métier. Déploiement Vercel vérifié au navigateur
(sélecteur 2 segments cliqué des deux côtés, cartes foyer FR+EN, mobile
390 px sans débordement, 0 erreur console, chaîne GeniusPay 308→200).

## 6-quinquies. N°323 — fin de la cacophonie des landing pages (commits 1ced53a + fed0d32)

Quatrième grief de fragmentation, le plus architectural : « La console et
sa boutique se présentent comme des landing pages distinctes — cacophonie
inexplicable. Normalement le clic doit rediriger vers /login. Je souhaite
une analyse d'expert digne de Cloudflare et OVH. » Diagnostic : TROIS
landing pages racontaient le même produit (vitrine légitime N°321-322 +
racine console doublon N°313/317 + /shop doublon N°316) — la topologie
403Shield (site / console / api) était déjà cloudflarienne, la SÉPARATION
DES RÔLES ne l'était pas. Livré (2 commits, 18 fichiers, +1 572/−1 492,
vérifié au navigateur en production) :

- **Console = PURE application** (pattern dash.cloudflare.com / manager
  OVH) : la racine `/` est SUPPRIMÉE comme landing → 308 permanent vers
  `/login` (« Vos tunnels, simplement » disparaît) ; `/login` renvoie le
  visiteur porteur d'un token vers `/me` (le clic « Console » atterrit
  dans l'espace du client connecté — un rebond sans boucle si le token a
  expiré, /me purge sur 401).
- **Boutique RETOURNE au site marketing** (modèle OVH « commander sur
  www, gérer dans le manager ») : `/shop` → 308 permanent vers
  `403shield.ftci.fr/checkout` avec `?order=` préservée (retours
  GeniusPay en vol et e-mails historiques atterrissent sur la caisse,
  référence intacte — doctrine N°301 : UN canal B2C, déménagé
  mikcloud.ftci.fr/vpn → console N°316 → site N°323, jamais dédoublé) ;
  composants `tunnel-console/src/components/shop/` supprimés.
- **NOUVELLE caisse `/checkout` sur le site** : parcours N°316 porté
  tel quel (catalogue live, dialog Wave/carte + honeypot, suivi ?order=
  poll 5 s, récupération self-service, FAQ) dans le gabarit clay de la
  vitrine + shadcn ; SEO hérité de l'ancienne /shop (robots index,follow
  — le 308 transfère l'équité) ; entonnoir direct `?plan=vpn-b2c-month|`
  `year` (les cartes tarifs du site mènent à la caisse OUVERTE, formule
  présélectionnée — un seul clic du marketing au paiement).
- **Vitrine** : cartes tarifs tunnels + CTA /vpn + /tunnels (8, FR+EN) +
  footer → liens internes `/checkout` ; vercel.json GeniusPay
  `/vpn?order=` → `/checkout` (interne) ; liens « Console »/« Mon
  espace » → racine console (qui 308 vers /login).
- **Phase 2 documentée** (décision propriétaire, chemin de paiement) :
  backend success_url toujours `{TUNNEL_PUBLIC_URL}/shop?order=` — tout
  fonctionne via le 308 (un rebond) ; la canonicalisation complète
  (SuccessURL + e-mails → /checkout direct) se stage après validation.

Preuves au navigateur (production, 18/10/2026) : console.403shield.ftci.fr
→ atterrit sur /login (« Connexion sans mot de passe ») ·
console/shop?order=MCV-SMOKE323 → atterrit sur
403shield.ftci.fr/checkout?order=… avec le panneau de suivi · carte tarifs
« Buy on the shop » (lien interne) → /checkout?plan=vpn-b2c-month avec
caisse OUVERTE · catalogue live (1 500/1 675/1 725 · 15 000/15 600/
16 075 FCFA, Fetch offers 200 + preflight 204, access-control-allow-origin
403shield.ftci.fr) · tunnel.ftci.fr → 301 → console → 308 → /login ·
mobile 390 sans débordement · FR/EN · 0 erreur console partout.
Portes : lint 0 · tsc 0 (les DEUX apps) · parité FR/EN 410+87 chemins +
26 assertions métier (script /home/z/scratch323/parity323.ts).

## 6-sexies. N°324 — le mode HomeNet est supprimé du système (mono-mode Hotspot)

Décision propriétaire, suite et fin de §6-quater (N°322 : « HomeNet cesse
d'être un service indépendant ») : le MODE foyer lui-même est retiré —
produit, catalogue, console, inscription, chatbot, e-mails. La plateforme
SaaS devient mono-mode Hotspot ; le particulier a les tunnels WireGuard
(boutique /checkout, N°323) et les protections famille restent disponibles
sur tout routeur géré (FamilyGuard, couvre-feu, filtrage — ce sont des
modules du compte, pas du mode).

Ce que la suppression a gardé (jugement d'architecte, pas un coup de
règle) :
- **La machinerie « appareils »** (read_dhcp, bails, device_pause) reste
  pour le module Cybercafé N°290 — seule la famille d'APIs/console foyer
  tombe. Le registre appareils et la pause de poste continuent de vivre.
- **La compat facturation** : les identifiants homenet-* historiques restent
  résolus (renouvellements GeniusPay en vol au montant souscrit), la
  migration de retraite convertit l'état au boot (comptes, PlanID,
  audiences, pauses levées + convergence des box), zéro DDL.
- **L'honnêteté du chatbot** : les questions « foyer/maison » reçoivent la
  réponse vraie (offre retirée, alternatives réelles) — jamais un silence.

Miroir du CHANGELOG N°324 ; relevé de vérification production consigné par
le tuteur après déploiement.

## 6-septies. N°325 — intégration du PR #70 « Enterprise Multi-Page Landing Page Redesign » (Jules)

Le site marketing gagne un header digne des références du §6-quinquies :
MegaMenu « Produits » (2 catégories : Accès & Rentabilité / Sécurité &
Infra Cloud) et « Solutions » (4 secteurs), drawer mobile, section
« Extension Opérateurs & FAI » (PPPoE, multi-sites, 2FA/comptabilité).
La vitrine cesse de vendre seulement Hotspot+Tunnels : elle montre TOUTE
la plateforme réelle — Cybercafé (N°290), PPPoE ISP, comptabilité gelée,
2FA TOTP — sans inventer une seule capacité (les items du MegaMenu
renvoient vers des routes réelles : /hotspot, /tunnels, /vpn, ancres de
sections, /docs/guides).

Jugement d'intégration (le PR datait d'avant N°324 — conflits résolus à la
doctrine) :
- **Zéro résurrection HomeNet** : le PR reposait sur l'état N°322 (tarifs
  foyer sur les cartes, « Foyers » ciblés) — tout est neutralisé au merge :
  l'item Solutions devient « Travailleurs Nomades & Télétravail » (le VPN
  personnel reste la réponse honnête au particulier), segment tarifs
  « Hotspot · Cybercafé », essai « 60 jours » seuls.
- **Le point mort 768-860 px** (nav desktop visible mais liens masqués par
  la règle CSS héritée, hamburger absent) est éliminé : nav à `lg:`
  (≥1024), drawer partout ailleurs — pattern Cloudflare.
- **Panneaux clampés au viewport** (aucun débordement horizontal, le rail
  et la caisse restent intacts), fermeture Escape/route, aria-expanded,
  CTA d'inscription dans le drawer.
- Le segment console s'étiquette « Hotspot · Cybercafé » : le module
  cybercafé est INCLUS dans l'abonnement (N°290) — à ne pas confondre avec
  un mode (le foyer, lui, n'existe plus — N°324).

Miroir du CHANGELOG N°325 ; le merge --no-ff marque le PR #70 MERGED.

## 6-octies. N°326 — la porte d'entrée de la console s'habille Clay (gabarit dash.cloudflare.com/login)

Décision propriétaire : « je voudrais que console.403shield.ftci.fr/login
soit comme dash.cloudflare.com/login, garder les couleurs du landing page en
mieux avec effet wahou ». Depuis N°323 la racine de la console 308 → /login
(pattern CF) — mais la page portait encore l'ardoise de l'intérieur
(N°313) : la porte d'entrée contredisait la vitrine Clay (N°317, §6-septies).

Ce que la refonte établit (jugement de marque) :
- **La marque a UNE peau de porte** : split « panneau de marque sarcelle
  (dégradé 165°, blobs menthe/crème, chips flottantes VPN/IP fixe/Mobile
  Money, titre Fraunces au trait crème qui se dessine) + colonne formulaire
  ivoire (carte claymorphe, CTA teal à reflet crème) » — palette FreeTech
  de la vitrine reprise à l'identique (ivoire/crème/sarcelle/menthe/encre),
  polices Manrope + Fraunces partagées. N°329 : le split s'inverse au
  modèle demandé par le propriétaire — formulaire ivoire à GAUCHE, panneau
  de marque ANIMÉ à DROITE (anneaux radar derrière le logo, constellation
  scintillante, lignes de données WireGuard qui circulent, dérive lente du
  dégradé), boutons Google/Apple/Facebook à notice honnête (aucun OAuth
  branché à ce jour), favicon partagé avec la vitrine. L'« effet wahou »
  reste mesuré :
  parallaxe au pointeur, dérive des blobs, entrées décalées — et TOUT se
  coupe sur `prefers-reduced-motion` (le calme est un signe de confiance,
  le mouvement un condiment, jamais un plat).
- **L'intérieur reste nuit** : /me et /pro conservent le thème sombre
  console (dash.cloudflare.com fait pareil — login clair, manager clair,
  mais notre identité intérieure est émeraude/slate depuis N°313 et elle
  reste) ; le canvas html bascule en ivoire PENDANT l'auth puis rend
  l'ardoise (`html:has(.mka-page)`), jamais de flash.
- **Le parcours ne bouge pas** : passwordless (code 6 chiffres/10 min),
  honeypot, JWT 24 h, rebond session N°323 — la refonte est
  présentationnelle de bout en bout, zéro fichier backend.
- **L'équivalent CF « Sign up »** est le bouton crème « Commander un VPN »
  → caisse du site (modèle OVH N°323 : commander sur www, gérer ici).

Miroir du CHANGELOG N°326 ; relevé de vérification production consigné par
le tuteur après déploiement.

## 7. Actifs de marque

`docs/brand/` : `403shield-clay.png` (1024², bouclier clay menthe + étoile dorée
sur ivoire — vitrine), `403shield-console.png` (1024², bouclier émeraude + glow
sur slate nuit — console), déclinaisons 128/180/256/512, `logo.svg` (bouclier
vectoriel teal/menthe/étoile ambre — source `frontend/public/logo.svg`).
