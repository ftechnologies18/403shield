# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-09T13:00:52Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/42621574657
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10865 · total: 6.89 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 80 Mo
WAL: 10857 objets · 6980 Mo
upload le plus ancien: 2026-11-02T00:00:18.060000+00:00 · plus récent: 2026-11-09T12:55:27.002000+00:00
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
archivés=45019 échecs=0 dernier_ok=2026-11-09 13:00:38.731507+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1226781 | 1222100 | 188 | devices | 400 kB
654366 | 653939 | 245 | line_quality | 776 kB
651014 | 650388 | 23 | routers | 1168 kB
589364 | 574319 | 969 | hotspot_users | 4024 kB
523445 | 495459 | 2 | sessions | 216 kB
496586 | 496586 | 24 | health_checkpoint | 64 kB
222612 | 256 | 294 | commands | 7672 kB
90972 | 87106 | 49 | traffic | 368 kB
56407 | 56399 | 42 | settings | 704 kB
40714 | 40692 | 48 | volume_days | 208 kB
2863 | 2861 | 11 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2879 fichiers
last_run=2026-11-09T13:00:28Z
new=5 skip=2878 fail=0 disk=30%
Mon 2026-11-09 13:05:00 UTC 4min 9s Mon 2026-11-09 13:00:09 UTC      41s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
