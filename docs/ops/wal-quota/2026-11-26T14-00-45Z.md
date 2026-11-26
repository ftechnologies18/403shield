# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-26T14:00:45Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/45834503586
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10847 · total: 7.95 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10839 objets · 8055 Mo
upload le plus ancien: 2026-11-19T00:00:24.409000+00:00 · plus récent: 2026-11-26T13:55:27.803000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.28 Mo/min ≈ 21.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=69431 échecs=0 dernier_ok=2026-11-26 13:59:47.717929+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1966865 | 1961421 | 157 | devices | 496 kB
1008267 | 1007632 | 40 | routers | 2040 kB
991427 | 990830 | 50 | line_quality | 1016 kB
934565 | 913303 | 972 | hotspot_users | 4104 kB
834271 | 793995 | 52 | sessions | 232 kB
778936 | 778936 | 16 | health_checkpoint | 64 kB
336884 | 403 | 823 | commands | 7624 kB
136899 | 130881 | 51 | traffic | 336 kB
90296 | 90287 | 22 | settings | 704 kB
61041 | 61012 | 48 | volume_days | 240 kB
3541 | 3539 | 11 | vpn_peers | 96 kB
143 | 143 | 12 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2878 fichiers
last_run=2026-11-26T14:00:28Z
new=5 skip=2878 fail=0 disk=31%
Thu 2026-11-26 14:05:00 UTC 4min 17s Thu 2026-11-26 14:00:09 UTC          33s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  31% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
