# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-03T12:02:48Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/41632252744
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10798 · total: 7.38 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10790 objets · 7475 Mo
upload le plus ancien: 2026-10-27T00:00:22.780000+00:00 · plus récent: 2026-11-03T12:00:27.788000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.77 Mo/min ≈ 22.2 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=36324 échecs=0 dernier_ok=2026-11-03 12:02:41.384859+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
946671 | 942370 | 198 | devices | 368 kB
526002 | 525712 | 362 | line_quality | 712 kB
520308 | 519684 | 21 | routers | 1608 kB
462993 | 450700 | 595 | hotspot_users | 4024 kB
410476 | 388332 | 47 | sessions | 200 kB
400766 | 400766 | 16 | health_checkpoint | 64 kB
177369 | 217 | 743 | commands | 6464 kB
73213 | 70144 | 36 | traffic | 288 kB
44360 | 44352 | 7 | settings | 704 kB
33025 | 33011 | 29 | volume_days | 192 kB
2614 | 2612 | 11 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2882 fichiers
last_run=2026-11-03T12:00:28Z
new=5 skip=2879 fail=0 disk=29%
Tue 2026-11-03 12:05:00 UTC 2min 13s Tue 2026-11-03 12:00:08 UTC     2min 38s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  29% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
