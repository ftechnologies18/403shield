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

## 7. Actifs de marque

`docs/brand/` : `403shield-clay.png` (1024², bouclier clay menthe + étoile dorée
sur ivoire — vitrine), `403shield-console.png` (1024², bouclier émeraude + glow
sur slate nuit — console), déclinaisons 128/180/256/512, `logo.svg` (bouclier
vectoriel teal/menthe/étoile ambre — source `frontend/public/logo.svg`).
