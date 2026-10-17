# tunnel-console — la console « tunnel » de MikCloud

> N°313 — Programme Tunnel, phase 1 (« Fondations », décisions D-T1…D-T5 du
> cadrage validé le 13/10/2026). App Next.js **séparée de la console Hotspot**
> (décision D-T3) : le monorepo porte désormais DEUX frontends —
> `frontend/` (console SaaS + vitrines, projet Vercel « mikcloud », root
> `frontend/`, INTACT) et `tunnel-console/` (cette app, projet Vercel dédié,
> root `tunnel-console/`).

## Ce que c'est

La sous-marque **MikTunnel** (powered by FTech CI) : vitrine + espace client
du service de tunnels WireGuard. Phase 3 livrée (N°315) :

- **Vitrine** (`/`) — promesses honnêtes, lien vers la vente MikCloud VPN
  déjà ouverte (`mikcloud.ftci.fr/vpn`) ;
- **Connexion sans mot de passe** (`/login` → `/verify`) — code à 6 chiffres
  par e-mail (10 min, un seul usage) contre le module backend
  `POST /api/tunnel/auth/request-code` + `POST /api/tunnel/auth/verify`
  (N°313, `backend/internal/api/handlers_tunnel.go`) ;
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
| `NEXT_PUBLIC_API_BASE` | `https://api.mikcloud.ftci.fr` | Base de l'API (CORS ouverte côté backend — `corsMiddleware`, `routes.go`) |
| `TUNNEL_DEV_API_PROXY` | — | `=1` en dev local : proxy `/api/*` → `http://localhost:4000` (backend local) |

## Déploiement (Vercel) — FAIT le 13/10/2026 (N°314, session de pilotage)

1. **Projet Vercel `miktunnel`** CRÉÉ : Import Git Repository →
   `ftechnologies18/mikcloud` → **Root Directory : `tunnel-console/`**
   (Framework Next.js, aucun build override). Le projet existant « mikcloud »
   (root `frontend/`) n'est pas touché. Les déploiements suivent les pushes
   `main` automatiquement (webhook Vercel).
2. **Variable de production** POSÉE : `NEXT_PUBLIC_API_BASE=https://api.mikcloud.ftci.fr`.
3. **URL live** : **https://miktunnel.vercel.app** (alias git :
   `miktunnel-ftech-ci.vercel.app`).
4. **Domaine dédié `tunnel.ftci.fr`** : VÉRIFIÉ ET EN LIGNE depuis le
   17/10/2026 — CNAME `tunnel` → `cname.vercel-dns.com` posé dans Cloudflare
   (DNS only) + TXT `_vercel` de vérification ; certificat émis, HTTP 200
   servi (vitrine + `/pro` + `/me`).

## Périmètre et limites (phase 3)

- Vente NEUVE B2C (fulltunnel) : REFUSÉE depuis cette console (la vitrine
  `/vpn` de MikCloud reste LE canal B2C — doctrine N°301 « jamais en
  concurrence avec ses revendeurs ») ; la console ne vend que le
  RENOUVELLEMENT B2C et l'ACCÈS PRO (famille « pro », canal séparé,
  verrouillé des deux bords) ;
- L'Accès Pro exige un COMPTE GÉRANT MikCloud apparié par e-mail (au moins
  un routeur en mode agent) — la page `/pro` le DIT au lieu de vendre un
  accès qui ne servirait à rien ;
- Les tokens « tunnel » vivent 24 h et ne sortent JAMAIS de `/api/tunnel/*`
  (whitelist middleware, miroir du rôle reseller).
