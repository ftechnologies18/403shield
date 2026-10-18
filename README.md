# 403Shield — Monorepo

**Connectivité payante et supervision MikroTik, powered by FTech CI** :
hotspot Wi-Fi professionnel (SaaS multi-sites), tunnels WireGuard
« Accès Pro » et VPN B2C — cloud multi-routeurs, revendeurs avec
portefeuille de crédits, vouchers imprimables et supervision temps réel.

> **État : en production.** Vitrine & guides : `403shield.ftci.fr` ·
> console tunnels & VPN : `console.403shield.ftci.fr` · API :
> `api.403shield.ftci.fr`. L'historique des évolutions fait foi dans le
> [`CHANGELOG.md`](CHANGELOG.md) (une entrée par livraison) — ce README
> décrit l'état courant de l'architecture.

Historique : le projet est né sous les marques MikCloud (hotspot) et
MikTunnel (VPN), unifiées sous la marque **403Shield** (N°317). Le
backend, d'abord sur Render avec Neon, a migré vers une VM Oracle Cloud
(N°266) ; le service Render est suspendu volontairement (N°303) et son
rollback reste documenté.

```
403shield/
├── .github/workflows/ → CI (5 jobs) + workflows d'exploitation
│                        (deploy-oracle, backup, standby-restore, ops-*, hunt-*)
├── backend/        → API Go + PostgreSQL (pgx) — production : VM Oracle Cloud (E5)
│   └── internal/       → api (handlers), auth (JWT), model, store (PostgreSQL/JSON),
│                        routeros (protocole binaire), agent, notify
├── frontend/       → 403shield.ftci.fr — vitrine, centre de guides,
│                    console SaaS hotspot (Vercel, root `frontend/`)
├── tunnel-console/ → console.403shield.ftci.fr — achat, gestion et
│                    exploitation des tunnels & VPN (Vercel, app dédiée)
├── deploy/         → outillage de déploiement Oracle (wg-peer, wg-mini…)
├── docs/           → runbooks (DB-HYBRIDE, MIGRATION-ORACLE, SECRETS…) + analyses
└── ops/            → scripts & artefacts d'exploitation (portail, media…)
```

| | Stack | Production |
|---|---|---|
| **Backend** | Go 1.27 (net/http), JWT HS256, **PostgreSQL via pgx**, client natif RouterOS | VM Oracle Cloud (E5) — `api.403shield.ftci.fr` (Caddy, Let's Encrypt), déployée par `deploy-oracle.yml` |
| **Frontend vitrine & console SaaS** | Next.js 16 App Router, React 19, TypeScript strict, TanStack Query, Recharts | Vercel — `403shield.ftci.fr` (root `frontend/`) |
| **Console tunnels & VPN** | Next.js 16 App Router (app dédiée) | Vercel — `console.403shield.ftci.fr` (root `tunnel-console/`) |
| **Base de données** | PostgreSQL 18 **local à la VM** (primaire) · WAL chiffré → OCI Object Storage (PITR ≤ 6 min) · répliques nocturnes chiffrées Supabase & Neon · artefact hebdo chiffré | Voir [`docs/DB-HYBRIDE.md`](docs/DB-HYBRIDE.md) |

## Les trois piliers produit

| Pilier | Où | En bref |
|---|---|---|
| **Hotspot SaaS** | `403shield.ftci.fr` (console `/login`) | 1 compte = N sites : vouchers, revendeurs à crédit, PPPoE, Wi-Fi jetable, supervision multi-routeurs |
| **Tunnels & Accès Pro** | `console.403shield.ftci.fr/pro` | LAN chiffré sortant (routeurs, caméras, NAS), sans port ouvert — renouvellement 1 clic |
| **VPN B2C** | `403shield.ftci.fr/vpn` + caisse `/checkout` | WireGuard livré par e-mail, espace client sans mot de passe (code e-mail 6 chiffres) |

Guides d'exploitation illustrés : **`403shield.ftci.fr/docs/guides`**
(32 guides publics, 9 sections, recherche ⌘K plein texte).

### Console SaaS Hotspot — modules

| Module | Détail |
| --- | --- |
| Tableau de bord | KPIs live, **vue d'ensemble multi-sites** (1 compte = N hotspots : sessions, ventes, revenus par site), sessions 24 h, revenus 14 j, top profils, activité |
| Sessions actives | Table temps réel (poll 5 s), déconnexion (kick) instantanée |
| Utilisateurs | CRUD, filtres, pagination, activation/désactivation, copie identifiants |
| Vouchers | Génération en lot (1–500), préfixe/longueur de code, débit auto du portefeuille revendeur, impression tickets prédécoupés, **traçabilité des lots** (onglet Lots : site émetteur, canal, revendeur, statuts voucher par voucher) |
| Profils | Forfaits : débit (format RouterOS), durée session, validité, quota, prix |
| Revendeurs | Portefeuille de crédits, rechargements, journal des transactions |
| Routeurs | Statut/CPU/uptime, test de connexion, mode simulé ou réel |
| Rapports | **Comptabilité multi-sites** : ventes par jour/semaine/mois et par routeur (part de CA, panier moyen) + activité (revenus, ventes par profil, connexions réelles, statut vouchers) |
| Paramètres | Organisation, devise (FCFA, EUR, USD…), fuseau, purge des données par catégories |

## Démarrage local (nouveau développeur)

Prérequis : **Go 1.27+** et **Bun** (ou Node 20+). Aucune autre dépendance.

```bash
# 1. Backend (port 4000)
cd backend
go run .            # ou : bun run dev
# → http://localhost:4000  (1er démarrage : mot de passe admin aléatoire affiché dans les logs)

# 2. Frontend vitrine + console SaaS (port 3000)
cd frontend
bun install
bun run dev         # → http://localhost:3000

# 3. Console tunnels & VPN (port 3100, app dédiée)
cd tunnel-console
bun install
bun run dev         # → http://localhost:3100
```

- **Base vide = état de mise en service** : le système démarre sans aucune
  donnée (le seed de démonstration a été supprimé du code). Au premier
  démarrage, l'administrateur est créé avec un **mot de passe aléatoire,
  affiché une seule fois dans les logs** — plus aucun identifiant par défaut
  n'existe dans le repo (sécurité P0).
- Sans `DATABASE_URL`, le backend persiste dans le fichier JSON
  `backend/data/db.json` (développement) ; avec PostgreSQL, la synchro est
  différentielle à chaque sauvegarde.
- En local, renseigner `NEXT_PUBLIC_API_BASE=http://localhost:4000` côté
  frontend (CORS ouvert par défaut quand `ALLOWED_ORIGIN` est vide).

Le frontend appelle le backend via `NEXT_PUBLIC_API_BASE` si défini
(`frontend/.env.example`), sinon en relatif `/api` (passerelle).

## Qualité & CI

`.github/workflows/ci.yml` s'exécute sur chaque push `main` et chaque pull
request :

| Job | Vérifications |
|---|---|
| **Backend Go** | `gofmt` (formatage canonique) · `go vet` · `go test -race` · `go build` |
| **Frontend Next.js** | `bun install --frozen-lockfile` · ESLint · type-check **tsgo** (compilateur TypeScript natif) · `next build` |
| **Vulnérabilités Go** | `govulncheck` — vulnérabilités atteignables (base https://vuln.go.dev) |
| **E2E Playwright** | bootstrap + Mode Vente + revendeurs contre la stack réelle (backend Go + build Next de production) |
| **Déploiement backend Render** | **gelé** par le sentinel `RENDER-DEPLOY-FROZEN` — voir « Render (suspendu) » ci-dessous |

`deploy-oracle.yml` déploie le backend sur la VM Oracle Cloud après une CI
verte, pour chaque push `main` touchant `backend/` (ou `deploy/oracle/**`,
ou le workflow lui-même) : build statique + scp + `systemctl enable+restart`
+ healthcheck. Les frontends se déploient via le webhook Vercel.

Conventions d'édition partagée : [`.editorconfig`](.editorconfig).
Identité des commits : `ftechnologies18 <freelancetechnologies.ci@gmail.com>`.

Avant de pousser :

```bash
cd backend   && gofmt -l . && go vet ./... && go test ./...
cd frontend  && bun run lint && bun run typecheck && bun run build
```

> Chaque push `main` = mise en production (Vercel pour les frontends ;
> backend redéployé sur la VM Oracle si `backend/` est touché). Vérifier
> localement AVANT de pousser ; toute correction passe par un commit de suivi.

## Déploiement (production)

### 1. Base de données — PostgreSQL local à la VM (primaire)

Le primaire est un **PostgreSQL 18 local à la VM** (`127.0.0.1:5432`,
flush ≤ 3 s). La durabilité est organisée en 4 étages : WAL chiffré →
OCI Object Storage (PITR ≤ 6 min), **répliques nocturnes chiffrées
Supabase & Neon** (03:00 UTC), artefact hebdo chiffré GitHub.
Runbook complet : [`docs/DB-HYBRIDE.md`](docs/DB-HYBRIDE.md) · secours
quotidien : workflow `standby-restore.yml` (Supabase → Neon).

### 2. Backend — VM Oracle Cloud (`api.403shield.ftci.fr`)

`deploy-oracle.yml` (push main touchant `backend/`) : build statique
amd64, scp, restart systemd, healthcheck — secrets `ORACLE_HOST` /
`ORACLE_USER` / `ORACLE_SSH_KEY`. Le domaine est servi par Caddy derrière
lequel l'API écoute (certificat Let's Encrypt). En local sans
`DATABASE_URL`, le backend persiste dans `backend/data/db.json`.

### 3. Frontends — Vercel (`403shield.ftci.fr`, `console.403shield.ftci.fr`)

Deux projets Vercel : *Root Directory* `frontend` (vitrine + console SaaS)
et `tunnel-console` (console tunnels & VPN). Variable
`NEXT_PUBLIC_API_BASE=https://api.403shield.ftci.fr` (Production +
Preview) ; le backend liste les origines autorisées dans `ALLOWED_ORIGIN`
(CORS).

### Render — suspendu volontairement (N°303)

Le service Render historique (`srv-da974o142hec73euul60`) est **suspendu**
(fin du double-écrivain Supabase, facture §4bis) et le job CI
`deploy-render` est gelé par le sentinel `RENDER-DEPLOY-FROZEN` (posé
N°244, jamais levé depuis). **Rollback documenté** :
[`docs/MIGRATION-ORACLE.md`](docs/MIGRATION-ORACLE.md) §9.2 — au `resume`,
désactiver l'autoDeploy AVANT (la voie native redéployait en miroir à
chaque push, N°303).

## Administration des données

- **PostgreSQL local (VM) = source de vérité en production** ; les
  répliques Supabase et Neon suivent par la reverse-sync nocturne.
- **Aucun endpoint ne régénère de données de démonstration** — le seed a
  été supprimé du code ; toute base vide démarre en état de mise en service.
- **Purge** : Paramètres → *Purge des données* par catégories (`POST
  /api/admin/purge`, compteurs live `GET /api/admin/purge/stats`) ;
  `POST /api/admin/purge-demo` retire chirurgicalement les artefacts hérités
  de l'ancien seed en préservant les données réelles.

## Connecter un vrai routeur MikroTik

1. Winbox → **IP → Services** → activer **api** (port 8728).
2. **System → Users** → créer un utilisateur API (groupe *full*).
3. Console 403Shield → **Routeurs → Ajouter** : IP, port 8728, identifiants,
   mode **Réel**.

Le client RouterOS parle le **protocole binaire natif** (login v6.43+ et
fallback challenge MD5) — aucun agent à installer sur le routeur. Un **mode
Simulé** intégré permet de démontrer toute la plateforme sans matériel.

## Documentation

| Fichier | Contenu |
|---|---|
| [`CHANGELOG.md`](CHANGELOG.md) | **FAIT FOI** — historique des évolutions (une entrée par livraison, portes incluses) |
| [`docs/CONTRACT-V2.md`](docs/CONTRACT-V2.md) | Contrats d'API des fonctionnalités (champs, routes, sémantique) |
| [`docs/DB-HYBRIDE.md`](docs/DB-HYBRIDE.md) | Architecture DB 4 étages (primaire local, WAL chiffré, répliques nocturnes) + 11 modes ops |
| [`docs/MIGRATION-ORACLE.md`](docs/MIGRATION-ORACLE.md) | Migration Render → Oracle Cloud · rollback §9.2 |
| [`docs/RUNBOOK-HEBERGEMENT.md`](docs/RUNBOOK-HEBERGEMENT.md) | Comptes & hébergement (Render, Vercel, Supabase, Neon, Cloudflare) |
| [`docs/RUNBOOK-SECRETS.md`](docs/RUNBOOK-SECRETS.md) | Rotation des secrets (JWT, DSN, clés de chiffrement) |
| [`docs/MARQUE-403SHIELD.md`](docs/MARQUE-403SHIELD.md) | La marque 403Shield (couleurs, voix, écosystème) |
| [`backend/README.md`](backend/README.md) | API : persistance double, agent HTTP-poll, protocole RouterOS |
| [`frontend/README.md`](frontend/README.md) | Configuration Vercel, modes d'appel API (direct / passerelle) |
| [`tunnel-console/README.md`](tunnel-console/README.md) | La 403Shield Console (tunnels & VPN) — app dédiée |
| [`GUIDE-GESTIONNAIRE.md`](GUIDE-GESTIONNAIRE.md) | Guide utilisateur du gestionnaire |
| [`AUDIT-MIKHMON-V3.md`](AUDIT-MIKHMON-V3.md) | Audit de référence par rapport à Mikhmon |
| [`docs/COMPARATIF-PHENIXSPOT.md`](docs/COMPARATIF-PHENIXSPOT.md) · [`docs/CARTE-CONCURRENCE.md`](docs/CARTE-CONCURRENCE.md) | Concurrence (PhenixSPOT, 5 cercles, modèles de prix) |
| [`docs/ANALYSE-P1-PPP-WG-CYBER.md`](docs/ANALYSE-P1-PPP-WG-CYBER.md) | Analyse P1 : PPPoE, WireGuard, cybercafé |
| [`docs/HANDOFF-INSTALL-BACKEND.md`](docs/HANDOFF-INSTALL-BACKEND.md) | Kit d'installation autonome d'un back-end |
| [`deploy/oracle/wg-mini/README.md`](deploy/oracle/wg-mini/README.md) | wg-mini — passerelle VPN WireGuard vendable |

La feuille de route vit dans le [`CHANGELOG.md`](CHANGELOG.md) : chaque
livraison y consigne son périmètre et ses portes de qualité.

## Licence

© 2026 FTCI — Freelance Technologies Côte d'Ivoire
