# tunnel-console — la console « tunnel » de MikCloud

> N°313 — Programme Tunnel, phase 1 (« Fondations », décisions D-T1…D-T5 du
> cadrage validé le 13/10/2026). App Next.js **séparée de la console Hotspot**
> (décision D-T3) : le monorepo porte désormais DEUX frontends —
> `frontend/` (console SaaS + vitrines, projet Vercel « mikcloud », root
> `frontend/`, INTACT) et `tunnel-console/` (cette app, projet Vercel dédié,
> root `tunnel-console/`).

## Ce que c'est

La sous-marque **MikTunnel** (powered by FTech CI) : vitrine + espace client
du service de tunnels WireGuard. Phase 1 livrée :

- **Vitrine** (`/`) — promesses honnêtes, lien vers la vente MikCloud VPN
  déjà ouverte (`mikcloud.ftci.fr/vpn`) ;
- **Connexion sans mot de passe** (`/login` → `/verify`) — code à 6 chiffres
  par e-mail (10 min, un seul usage) contre le module backend
  `POST /api/tunnel/auth/request-code` + `POST /api/tunnel/auth/verify`
  (N°313, `backend/internal/api/handlers_tunnel.go`) ;
- **Espace client** (`/me`) — profil + rappel des commandes B2C appariées
  par e-mail (`GET /api/tunnel/me`, JWT rôle « tunnel » 24 h). La gestion
  des appareils et le renouvellement 1-clic sont la phase 2 (N°314).

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

## Déploiement (Vercel) — geste exploitant

1. **Nouveau projet Vercel** : Import Git Repository → `ftechnologies18/mikcloud`
   → **Root Directory : `tunnel-console/`** (Framework Next.js, aucun build
   override). Le projet existant « mikcloud » (root `frontend/`) n'est pas
   touché.
2. **Variable de production** : `NEXT_PUBLIC_API_BASE=https://api.mikcloud.ftci.fr`.
3. **Domaine dédié** (ex. `tunnel.ftci.fr`) : à brancher dans Vercel puis au
   DNS Cloudflare — **nécessite le token Cloudflare re-validé** (dette connue :
   le token actuel est invalide). Jusque-là, l'URL `*.vercel.app` du projet
   fonctionne (CORS ouverte).
4. Les déploiements suivent les pushes `main` (webhook Vercel), même discipline
   que le projet mikcloud.

## Périmètre et limites (phase 1)

- Aucune vente depuis cette console (la vitrine `/vpn` de MikCloud reste LE
  canal B2C — doctrine N°301 « jamais en concurrence avec ses revendeurs »
  inchangée) ;
- L'accès distant Pro (remote, N°312) et le LAN étendu (caméras/NAS, phase 3
  N°315) ne sont pas encore exposés ici — la vitrine le dit honnêtement ;
- Les tokens « tunnel » vivent 24 h et ne sortent JAMAIS de `/api/tunnel/*`
  (whitelist middleware, miroir du rôle reseller).
