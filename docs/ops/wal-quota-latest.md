# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-22T12:41:59Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/45023526183
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10851 · total: 7.56 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10843 objets · 7656 Mo
upload le plus ancien: 2026-11-15T00:00:24.123000+00:00 · plus récent: 2026-11-22T12:40:27.579000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.92 Mo/min ≈ 22.4 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=63672 échecs=0 dernier_ok=2026-11-22 12:41:31.29218+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1773787 | 1768573 | 139 | devices | 472 kB
922764 | 922129 | 34 | routers | 1168 kB
908434 | 907871 | 446 | line_quality | 944 kB
843519 | 823906 | 1105 | hotspot_users | 4088 kB
752738 | 716285 | 58 | sessions | 200 kB
713531 | 713531 | 29 | health_checkpoint | 64 kB
309048 | 315 | 136 | commands | 7320 kB
125752 | 120242 | 34 | traffic | 344 kB
82302 | 82293 | 21 | settings | 704 kB
56049 | 56022 | 35 | volume_days | 232 kB
3248 | 3246 | 9 | vpn_peers | 96 kB
142 | 142 | 11 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-11-22T12:40:27Z
new=5 skip=2879 fail=0 disk=30%
Sun 2026-11-22 12:45:00 UTC  3min 2s Sun 2026-11-22 12:40:09 UTC 1min 48s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
