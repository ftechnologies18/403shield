# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-14T11:36:49Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/43590763787
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10771 · total: 7.6 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 81 Mo
WAL: 10763 objets · 7705 Mo
upload le plus ancien: 2026-11-07T00:00:25.256000+00:00 · plus récent: 2026-11-14T11:35:28.188000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.73 Mo/min ≈ 23.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=52118 échecs=0 dernier_ok=2026-11-14 11:36:04.91693+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1442292 | 1437477 | 132 | devices | 416 kB
754798 | 754168 | 29 | routers | 2264 kB
753311 | 752799 | 305 | line_quality | 824 kB
688846 | 672007 | 891 | hotspot_users | 4024 kB
613459 | 582077 | 32 | sessions | 200 kB
580557 | 580557 | 15 | health_checkpoint | 64 kB
256867 | 280 | 495 | commands | 7776 kB
104521 | 100028 | 35 | traffic | 288 kB
66263 | 66255 | 28 | settings | 704 kB
46428 | 46403 | 44 | volume_days | 216 kB
3130 | 3128 | 13 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2867 fichiers
last_run=2026-11-14T11:35:28Z
new=5 skip=2866 fail=0 disk=30%
Sat 2026-11-14 11:40:00 UTC  3min 13s Sat 2026-11-14 11:35:09 UTC 1min 37s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
