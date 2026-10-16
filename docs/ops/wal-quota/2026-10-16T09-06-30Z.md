# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-16T09:06:30Z
- Run : https://github.com/ftechnologies18/mikcloud/actions/runs/38878038910
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10288 · total: 9 Go (plafond gratuit: 10 Go)
basebackup: 12 objets · 99 Mo
WAL: 10276 objets · 9113 Mo
upload le plus ancien: 2026-10-09T04:50:06.670000+00:00 · plus récent: 2026-10-16T09:05:17.563000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.21 Mo/min ≈ 22.8 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=10278 échecs=0 dernier_ok=2026-10-16 09:06:02.195045+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
222083 | 219273 | 100 | devices | 296 kB
177947 | 177443 | 17 | routers | 1344 kB
167668 | 167575 | 220 | line_quality | 456 kB
156090 | 151036 | 1544 | hotspot_users | 3976 kB
137073 | 128930 | 4 | sessions | 216 kB
131787 | 131787 | 31 | health_checkpoint | 64 kB
56645 | 89 | 737 | commands | 7592 kB
23957 | 23069 | 27 | traffic | 344 kB
10267 | 10260 | 32 | settings | 696 kB
9778 | 9772 | 13 | volume_days | 136 kB
79 | 79 | 10 | admin_users | 80 kB
35 | 35 | 5 | vpn_peers | 64 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2879 fichiers
last_run=2026-10-16T09:05:17Z
new=5 skip=2877 fail=0 disk=24%
Fri 2026-10-16 09:10:00 UTC  3min 32s Fri 2026-10-16 09:05:00 UTC 1min 27s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
