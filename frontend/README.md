# 403Shield — Frontend

Application Next.js 16 (App Router, React 19, TypeScript strict) — site unifié
403Shield (rebrand N°317 : Hotspot · VPN · Tunnels, powered by FTech CI) et
console de gestion hotspot MikroTik : dashboard temps réel, vouchers imprimables,
revendeurs, routeurs, rapports.

## Démarrage

```bash
bun install          # ou npm install
bun run dev          # http://localhost:3000
bun run lint
```

## Configuration

Le frontend appelle l'API **en absolu** (mode direct actif en production —
backend Oracle E5 depuis le T2 N°266, Render suspendu N°303). Deux modes :

| Mode | Réglage | Quand l'utiliser |
| --- | --- | --- |
| **Direct (actif)** | Vercel : `NEXT_PUBLIC_API_BASE=https://api.mikcloud.ftci.fr` + `ALLOWED_ORIGIN` côté backend (whitelist CORS VM) | Production `403shield.ftci.fr` |
| **Proxy (alternative)** | rien — rétablir le `rewrites` dans `vercel.json` (transfère `/api/*` vers Render) | Si vous préférez zéro CORS / zéro variable |

En local sans variable, l'app appelle `/api/...` en relatif (mode passerelle).

## Déploiement Vercel

Root Directory : `frontend` · Domaine canonique : `403shield.ftci.fr`
(N°318 — ex `mikcloud.ftci.fr`, qui répond 301 ; projet Vercel renommé
« 403shield ») · Variable :
`NEXT_PUBLIC_API_BASE=https://api.mikcloud.ftci.fr` (Production + Preview) —
paire avec `ALLOWED_ORIGIN` sur la whitelist CORS de la VM (geste
`ops-cors-whitelist.yml`, paramétrable depuis N°318). Détails dans le
[README racine](../README.md).

## Architecture

```
src/
├── app/                      # route unique "/" (SPA) + layout + thème
├── components/hotspot/       # login, shell, 9 vues, composants partagés
│   └── views/                # dashboard, sessions, users, vouchers, profils,
│                             # revendeurs, routeurs, rapports, paramètres
├── lib/hotspot/              # api (fetch + passerelle), store (zustand),
│                             # types (contrat API), format, query provider
└── components/ui/            # shadcn/ui (New York)
```
