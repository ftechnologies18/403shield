# MARQUE 403SHIELD — Enregistrement de décision & plan de migration

> **N°317 — pivot de marque acté par le propriétaire** (à la suite de l'étude N°316).
> Statut : **Phase 1 livrée** (ce commit). Phases 2-3 planifiées plus bas.

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
    ├── Site unifié : mikcloud.ftci.fr (403shield.ftci.fr demain — action DNS)
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
| e-mails « MikTunnel (by MikCloud · …) »  | ⚠ phase 2 — encore à rebrander (backend)      |

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

## 5. Phase 2 — prochaine session (tuteur)

1. **E-mails transactionnels backend** (`transactional_emails.go` et voisins) :
   « MikTunnel (by MikCloud · powered by FTech CI) » → « 403Shield — powered by
   FTech CI ». Redéploiement VM Oracle conscient du transport (miroir
   `deploy-oracle.yml`), sans toucher au binaire tant que possible.
2. **Dictionnaire i18n profond** de la console SaaS (settings, sub, tools,
   routers, paywall, guides docs — ~300 occurrences) + pages `/wifi` et
   `/legal/confidentialite` (corps contractuel : revoir la mention responsable).
3. **Renommage des projets Vercel** : `mikcloud` → `403shield`,
   `miktunnel` → `403shield-console` (et leurs URLs `*.vercel.app` de repli).

## 6. Phase 3 — action propriétaire (DNS)

Le token Cloudflare fourni au tutorat est invalide : le DNS de `ftci.fr` reste à
la main du propriétaire. Gestes demandés pour fermer le pivot :

1. Créer `403shield.ftci.fr` (CNAME → Vercel, projet frontend).
2. Ensuite seulement : 301 `mikcloud.ftci.fr` → `403shield.ftci.fr`
   (et plus tard `tunnel.ftci.fr` → `console.403shield.ftci.fr`).
3. D'ici là, la marque est déjà 403Shield partout — seule l'adresse est
   transitoire (situation normale de rebrand : cf. queue.ac.uk → ac.uk).

## 7. Actifs de marque

`docs/brand/` : `403shield-clay.png` (1024², bouclier clay menthe + étoile dorée
sur ivoire — vitrine), `403shield-console.png` (1024², bouclier émeraude + glow
sur slate nuit — console), déclinaisons 128/180/256/512, `logo.svg` (bouclier
vectoriel teal/menthe/étoile ambre — source `frontend/public/logo.svg`).
