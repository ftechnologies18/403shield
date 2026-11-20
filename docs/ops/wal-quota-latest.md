# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-20T13:08:31Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/44741524896
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10834 · total: 7.32 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 83 Mo
WAL: 10826 objets · 7413 Mo
upload le plus ancien: 2026-11-13T00:00:24.720000+00:00 · plus récent: 2026-11-20T13:05:27.945000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.03 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=60819 échecs=0 dernier_ok=2026-11-20 13:07:51.472327+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1752531 | 1747475 | 134 | devices | 432 kB
889487 | 888853 | 27 | routers | 1168 kB
877185 | 876629 | 424 | line_quality | 912 kB
817895 | 798907 | 1137 | hotspot_users | 4088 kB
729914 | 693804 | 67 | sessions | 208 kB
685331 | 685331 | 29 | health_checkpoint | 64 kB
299296 | 308 | 627 | commands | 7944 kB
121516 | 116157 | 12 | traffic | 312 kB
78361 | 78352 | 36 | settings | 704 kB
54285 | 54260 | 31 | volume_days | 224 kB
3190 | 3188 | 14 | vpn_peers | 96 kB
142 | 142 | 11 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-11-20T13:05:28Z
new=5 skip=2878 fail=0 disk=30%
Fri 2026-11-20 13:10:00 UTC  1min 30s Fri 2026-11-20 13:05:09 UTC 3min 20s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
