# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-29T10:58:33Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/40861588976
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10715 · total: 7.76 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10707 objets · 7868 Mo
upload le plus ancien: 2026-10-22T00:00:13.962000+00:00 · plus récent: 2026-10-29T10:55:25.424000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.03 Mo/min ≈ 21.1 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=29074 échecs=0 dernier_ok=2026-10-29 10:58:11.672881+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
782962 | 778943 | 163 | devices | 344 kB
439892 | 439274 | 32 | routers | 1608 kB
438271 | 438028 | 263 | line_quality | 632 kB
396795 | 386125 | 594 | hotspot_users | 4000 kB
351604 | 332157 | 61 | sessions | 200 kB
332201 | 332201 | 29 | health_checkpoint | 64 kB
148274 | 185 | 404 | commands | 7808 kB
60951 | 58430 | 24 | traffic | 312 kB
34350 | 34342 | 35 | settings | 704 kB
27068 | 27056 | 18 | volume_days | 176 kB
2143 | 2142 | 9 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2883 fichiers
last_run=2026-10-29T10:55:25Z
new=5 skip=2879 fail=0 disk=30%
Thu 2026-10-29 11:00:00 UTC 1min 28s Thu 2026-10-29 10:55:08 UTC 3min 22s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
