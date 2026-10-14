# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-14T09:35:56Z
- Run : https://github.com/ftechnologies18/mikcloud/actions/runs/38543366652
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 7434 · total: 6.74 Go (plafond gratuit: 10 Go)
basebackup: 10 objets · 79 Mo
WAL: 7424 objets · 6821 Mo
upload le plus ancien: 2026-10-09T04:50:06.670000+00:00 · plus récent: 2026-10-14T09:30:16.942000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.10 Mo/min ≈ 22.6 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=7429 échecs=0 dernier_ok=2026-10-14 09:34:55.257295+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
133765 | 133594 | 25 | routers | 1344 kB
124437 | 122010 | 100 | devices | 272 kB
121514 | 121440 | 163 | line_quality | 424 kB
116960 | 113122 | 1016 | hotspot_users | 3968 kB
103012 | 96771 | 95 | sessions | 224 kB
96708 | 96708 | 22 | health_checkpoint | 64 kB
41669 | 76 | 353 | commands | 7408 kB
17618 | 17028 | 36 | traffic | 312 kB
7441 | 7434 | 21 | settings | 696 kB
7054 | 7049 | 29 | volume_days | 128 kB
78 | 78 | 9 | admin_users | 80 kB
12 | 12 | 2 | profiles | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2880 fichiers
last_run=2026-10-14T09:35:19Z
new=5 skip=2880 fail=0 disk=24%
Wed 2026-10-14 09:40:00 UTC      4min 5s Wed 2026-10-14 09:35:02 UTC      51s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
