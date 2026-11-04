# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-04T12:17:07Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/41827761946
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10814 · total: 6.87 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10806 objets · 6952 Mo
upload le plus ancien: 2026-10-28T00:00:22.884000+00:00 · plus récent: 2026-11-04T12:15:25.786000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.01 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=37778 échecs=0 dernier_ok=2026-11-04 12:16:41.172071+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
988545 | 984219 | 147 | devices | 368 kB
547177 | 546876 | 405 | line_quality | 736 kB
540552 | 539928 | 19 | routers | 1168 kB
480185 | 467427 | 1364 | hotspot_users | 4024 kB
425892 | 402851 | 37 | sessions | 216 kB
416633 | 416633 | 15 | health_checkpoint | 64 kB
184359 | 222 | 1087 | commands | 6824 kB
76122 | 72920 | 11 | traffic | 336 kB
46376 | 46368 | 35 | settings | 704 kB
34272 | 34258 | 22 | volume_days | 192 kB
2638 | 2636 | 11 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-11-04T12:15:26Z
new=5 skip=2879 fail=0 disk=28%
Wed 2026-11-04 12:20:00 UTC      2min 54s Wed 2026-11-04 12:15:08 UTC 1min 56s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   35G  28% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
