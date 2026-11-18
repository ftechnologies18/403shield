# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-18T13:11:52Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/44311047061
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10839 · total: 7.29 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10831 objets · 7378 Mo
upload le plus ancien: 2026-11-11T00:00:24.803000+00:00 · plus récent: 2026-11-18T13:10:28.593000+00:00
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
archivés=57944 échecs=0 dernier_ok=2026-11-18 13:11:05.731675+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1646877 | 1641939 | 127 | devices | 424 kB
843461 | 842827 | 28 | routers | 1168 kB
836535 | 835990 | 407 | line_quality | 888 kB
774313 | 756083 | 679 | hotspot_users | 4088 kB
691069 | 656700 | 38 | sessions | 200 kB
647815 | 647815 | 13 | health_checkpoint | 64 kB
284775 | 302 | 684 | commands | 7760 kB
115956 | 110851 | 15 | traffic | 256 kB
74371 | 74362 | 22 | settings | 704 kB
52033 | 52008 | 36 | volume_days | 224 kB
3140 | 3138 | 11 | vpn_peers | 96 kB
142 | 142 | 11 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2880 fichiers
last_run=2026-11-18T13:10:28Z
new=5 skip=2879 fail=0 disk=30%
Wed 2026-11-18 13:15:00 UTC     3min 10s Wed 2026-11-18 13:10:09 UTC 1min 40s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
