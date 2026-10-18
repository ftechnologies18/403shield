# tunnel-console — la « 403Shield Console » (tunnel.ftci.fr)

> N°313 — Programme Tunnel, phase 1 (« Fondations », décisions D-T1…D-T5 du
> cadrage validé le 13/10/2026). App Next.js **séparée de la console Hotspot**
> (décision D-T3) : le monorepo porte désormais DEUX frontends —
> `frontend/` (console SaaS + vitrines, projet Vercel « mikcloud », root
> `frontend/`, INTACT) et `tunnel-console/` (cette app, projet Vercel dédié,
> root `tunnel-console/`).
>
> N°317 — rebrand : MikCloud et MikTunnel disparaissent au profit de la
> marque unifiée **403Shield** (architecture Option A, modèle Cloudflare/OVH).
> Cette app devient **« 403Shield Console »** — l'équivalent de
> dash.cloudflare.com pour la marque : on y achète (`/shop`), gère (`/me`) et
> opère (`/pro`) les tunnels et VPN WireGuard. Maison-mère : **FTech CI**
> (ftci.fr), endossement « powered by FTech CI » ; le site marketing unifié
> vit sur 403shield.ftci.fr (ex mikcloud.ftci.fr — 301 permanent posé en
> N°318 ; le DNS et la vérification Vercel ont été créés par le tuteur la
> même journée).

## Ce que c'est

**403Shield Console** (powered by FTech CI) : LE foyer transactionnel de la
marque 403Shield — l'équivalent de dash.cloudflare.com. Historique : créée en
N°313 sous la marque « MikTunnel — by MikCloud » (arbitrage N°316 option C,
la cascade ftci.fr → mikcloud.ftci.fr → tunnel.ftci.fr fut racontée par le
DNS), rebrandée « 403Shield Console » en N°317. Phase 3 livrée (N°315),
rebrand + boutique (N°316), rebrand 403Shield (N°317) :

- **Racine = application pure** (`/`, N°323) — 308 permanent vers `/login`
  (pattern dash.cloudflare.com / manager OVH) : la console ne porte PLUS de
  vitrine marketing — le site 403shield.ftci.fr (refondé N°321-322) est
  l'unique landing. Un visiteur déjà connecté (token en localStorage) est
  renvoyé de `/login` vers `/me` — le clic « Console » atterrit dans
  l'espace ;
- **Boutique d'achat B2C** (`/shop`, N°316 — « 403Shield VPN » depuis N°317,
  **308 permanent vers `403shield.ftci.fr/checkout` depuis N°323**) — le
  canal de vente directe a RETOURNÉ au site marketing (modèle OVH :
  commander sur www, gérer dans le manager) : catalogue, achat Wave/carte,
  suivi `?order=MCV-…` et récupération self-service vivent dans
  `frontend/src/components/checkout/` (porté de `src/components/shop/`,
  supprimé). La redirection préserve `?order=` : les retours GeniusPay en
  vol (success_url `{TUNNEL_PUBLIC_URL}/shop?order=`) et les liens/e-mails
  historiques atterrissent sur la caisse du site. Doctrine N°301
  préservée : UN seul canal B2C — il a déménagé (mikcloud.ftci.fr/vpn
  N°301 → ici N°316 → site N°323), il ne s'est pas dédoublé ;
- **Connexion sans mot de passe** (`/login` → `/verify`) — code à 6 chiffres
  par e-mail (10 min, un seul usage) contre le module backend
  `POST /api/tunnel/auth/request-code` + `POST /api/tunnel/auth/verify`
  (N°313, `backend/internal/api/handlers_tunnel.go`). N°326 : ces deux pages
  portent le gabarit **dash.cloudflare.com/login** habillé dans le design
  system **Clay de la vitrine** (palette FreeTech — ivoire/crème/sarcelle/
  menthe/encre, polices Manrope + Fraunces, `AuthShell` partagé). N°329 :
  split-screen inversé — **formulaire ivoire à gauche + panneau de marque
  animé à droite** (anneaux radar derrière le logo, constellation
  scintillante, lignes de données WireGuard, dérive du dégradé) · boutons
  « Continuer avec Google / Apple / Facebook » (notice honnête « bientôt
  disponible », aucun OAuth branché — inscriptions prestataires = geste
  propriétaire) · **favicon** partagé avec la vitrine
  (`src/app/icon.png`) — `src/components/auth/` + `mka-*` dans
  globals.css ;
  parcours et contrats backend strictement inchangés ;
- **Espace client complet** (`/me`, N°314) — portefeuille de commandes et
  d'appareils (migration douce : tout achat vitrine avec cet e-mail apparaît
  ici), re-livraison de la configuration dans l'espace (reveal + copie),
  renouvellement 1-clic (Wave/carte GeniusPay, canal manuel en repli —
  `POST /api/tunnel/orders/{ref}/reveal` et `/renew`, JWT rôle tunnel) ;
- **Accès Pro + LAN étendu** (`/pro`, N°315 — design D-B1) : l'offre « Pro »
  de CETTE console (D-T4) — peer remote de supervision posé sous le COMPTE
  GÉRANT apparié par e-mail + extension du tunnel vers le LAN du routeur
  (caméras/NAS) : détection agent (`wg_lan_detect`), application en un clic
  (`set-lan` VM + règles `mikcloud-wg-lan` routeur + conf étendue —
  `GET/POST /api/tunnel/pro/*`, `backend/internal/api/handlers_tunnel_pro.go`).

## Développement

```bash
bun install
bun run dev            # http://localhost:3100
bun run lint && bun run typecheck && bun run build
```

Variables d'environnement :

| Variable | Défaut | Rôle |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | `https://api.403shield.ftci.fr` | Base de l'API — **basculée N°320** (l'ancienne `https://api.mikcloud.ftci.fr` reste vivante, rollback = re-PATCH + redeploy). CORS WHITELIST côté backend (`corsMiddleware`, `main.go` — fail-closed P1 #16) : `tunnel.ftci.fr`, `miktunnel.vercel.app` (N°316) puis `403shield.ftci.fr`, `403shield.vercel.app`, `403shield-console.vercel.app` (N°318) puis `console.403shield.ftci.fr` (N°319, AVANT toute 301) figurent dans `ALLOWED_ORIGIN` de la VM (geste `ops-cors-whitelist.yml` — PARAMÉTRABLE depuis N°318 : les origines se passent en input du dispatch, non-régression prouvée par le workflow) |
| `TUNNEL_DEV_API_PROXY` | — | `=1` en dev local : proxy `/api/*` → `http://localhost:4000` (backend local) |

Côté BACKEND (N°316) : `TUNNEL_PUBLIC_URL` (défaut `https://tunnel.ftci.fr`)
porte l'origine canonique de la console — retours de paiement GeniusPay
de la boutique (`/shop?order=…`), replis renouvellement/Pro (`/me`) et liens
des e-mails MCV-. N°318 : les e-mails transactionnels backend SONT rebrandés
« 403Shield (powered by FTech CI) » — la consigne de fichier passa de
`mikcloud.conf` à `403shield.conf`, la FAQ ci-dessus et l'e-mail de livraison
sont alignés. `APP_PUBLIC_URL` reste l'origine du SaaS (reçus,
resets).

## Déploiement (Vercel) — FAIT le 13/10/2026 (N°314, session de pilotage)

1. **Projet Vercel `miktunnel`** CRÉÉ : Import Git Repository →
   `ftechnologies18/403shield` → **Root Directory : `tunnel-console/`**
   (Framework Next.js, aucun build override). Le projet existant « mikcloud »
   (root `frontend/`) n'est pas touché. Les déploiements suivent les pushes
   `main` automatiquement (webhook Vercel).
2. **Variable de production** POSÉE : `NEXT_PUBLIC_API_BASE=https://api.mikcloud.ftci.fr`.
3. **URL live** : https://miktunnel.vercel.app puis, après le RENOMMAGE N°318
   du projet (miktunnel → **403shield-console**) :
   **https://403shield-console.vercel.app** (l'ancienne URL miktunnel.vercel.app
   est libérée par le renommage — elle reste dans la whitelist CORS, inoffensive).
4. **Domaine dédié `tunnel.ftci.fr`** : VÉRIFIÉ ET EN LIGNE depuis le
   17/10/2026 — CNAME `tunnel` → `cname.vercel-dns.com` posé dans Cloudflare
   (DNS only) + TXT `_vercel` de vérification ; certificat émis, HTTP 200
   servi (vitrine + `/pro` + `/me`).

## Périmètre et limites (phase 3, boutique N°316, rebrand N°317)

- Vente NEUVE B2C (fulltunnel) : elle vit DÉSORMAIS ICI (`/shop`, N°316 —
  déménagement du canal unique, doctrine N°301 « jamais en concurrence avec
  ses revendeurs » préservée : l'ancienne vitrine `/vpn` répond 301) ;
  familles de formules VERROUILLÉES (la boutique ne montre/jamais ne
  vend que la famille b2c, le canal Pro reste séparé) ;
- L'Accès Pro exige un COMPTE GÉRANT de la plateforme 403Shield (403shield.ftci.fr)
  apparié par e-mail (au moins un routeur en mode agent) — la page `/pro` le
  DIT au lieu de vendre un accès qui ne servirait à rien ;
- Les tokens « tunnel » vivent 24 h et ne sortent JAMAIS de `/api/tunnel/*`
  (whitelist middleware, miroir du rôle reseller).

## N°319 — vitrine OUVERTE + domaine console.403shield.ftci.fr (recette)

- La vitrine B2C est **OUVERTE en production** depuis le 17/10/2026 (geste
  console automatisé `ops-rebrand-db.yml`) : `GET /api/public/vpn/offers` →
  `{"enabled":true,"onlinePayment":true,"plans":[403Shield VPN Mensuel,
  403Shield VPN Annuel]}` — doctrine D6 : l'ouverture fut le geste délibéré
  de l'exploitant, ordonné par le propriétaire.
- `console.403shield.ftci.fr` est ATTACHÉ à ce projet Vercel
  (403shield-console) et l'origine est déjà whitelistée côté API. Recette
  Cloudflare restante (2 records) + 301 finale par workflow : cf.
  `docs/MARQUE-403SHIELD.md` §6-bis (valeurs exactes).

## N°320 — le domaine console est VIVANT, la 301 posée, l'API basculée

- **console.403shield.ftci.fr : VÉRIFIÉ et HTTP 200** (certificat Vercel) —
  les 2 records Cloudflare (TXT `_vercel` + CNAME `console.403shield`, DNS
  only) sont posés sur la zone ftci.fr.
- **301 tunnel.ftci.fr → console.403shield.ftci.fr** (301, chemins + query
  préservés) — posée via `ops-vercel-domains.yml` action=redirect APRES
  correction d'un bug du toolbox (leçon N°320 : le PATCH Vercel exige le
  domaine NU dans `redirect`, pas une URL `https://…` — commit d92e726,
  run #39058805829 SUCCESS). La boutique `/shop` vit désormais sur
  `console.403shield.ftci.fr`.
- **`NEXT_PUBLIC_API_BASE` = `https://api.403shield.ftci.fr`** (production
  + preview, bascule N°320 APRÈS certificat vivant — preuve dans le
  bundle : les chunks ne référencent plus que l'hôte 403shield).
  L'API porte un certificat Let's Encrypt (relance `t2-caddy-rescue.yml` :
  le backoff certmagic ne se réveille pas seul quand le DNS atterrit).
- Reste propriétaire : le **smoke test terrain** seul (cf. MARQUE §6-bis).
