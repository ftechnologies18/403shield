# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-25T09:14:07Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/40179712390
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10612 · total: 7.71 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 77 Mo
WAL: 10604 objets · 7815 Mo
upload le plus ancien: 2026-10-18T00:00:14.646000+00:00 · plus récent: 2026-10-25T09:10:26.158000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.99 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=23212 échecs=0 dernier_ok=2026-10-25 09:13:53.610142+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
598922 | 595249 | 165 | devices | 320 kB
367298 | 366684 | 43 | routers | 1824 kB
361796 | 361582 | 201 | line_quality | 568 kB
330606 | 321299 | 1323 | hotspot_users | 3984 kB
292729 | 276385 | 15 | sessions | 208 kB
272827 | 272827 | 25 | health_checkpoint | 64 kB
121460 | 142 | 263 | commands | 6816 kB
50265 | 48272 | 39 | traffic | 312 kB
26251 | 26243 | 28 | settings | 704 kB
21978 | 21968 | 27 | volume_days | 152 kB
1573 | 1572 | 7 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2884 fichiers
last_run=2026-10-25T09:10:26Z
new=5 skip=2880 fail=0 disk=24%
Sun 2026-10-25 09:15:00 UTC      54s Sun 2026-10-25 09:10:08 UTC 3min 57s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
