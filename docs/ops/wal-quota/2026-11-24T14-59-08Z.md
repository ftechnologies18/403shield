# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-24T14:59:08Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/45419968970
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10909 · total: 7.93 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10901 objets · 8034 Mo
upload le plus ancien: 2026-11-17T00:00:24.733000+00:00 · plus récent: 2026-11-24T14:55:27.494000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.00 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=66612 échecs=0 dernier_ok=2026-11-24 14:59:03.255332+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1865853 | 1860573 | 191 | devices | 472 kB
963250 | 962615 | 36 | routers | 1608 kB
946165 | 945595 | 489 | line_quality | 976 kB
880276 | 859820 | 424 | hotspot_users | 4104 kB
785081 | 747586 | 32 | sessions | 200 kB
745365 | 745365 | 10 | health_checkpoint | 64 kB
322216 | 373 | 455 | commands | 7800 kB
130803 | 125041 | 39 | traffic | 280 kB
86390 | 86381 | 29 | settings | 704 kB
58114 | 58087 | 34 | volume_days | 232 kB
3363 | 3361 | 17 | vpn_peers | 96 kB
143 | 143 | 12 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2807 fichiers
last_run=2026-11-24T14:55:27Z
new=5 skip=2803 fail=0 disk=30%
Tue 2026-11-24 15:00:00 UTC      53s Tue 2026-11-24 14:55:09 UTC  3min 56s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
