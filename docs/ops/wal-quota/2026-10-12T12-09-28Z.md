# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-12T12:09:28Z
- Run : https://github.com/ftechnologies18/mikcloud/actions/runs/38247126590
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 4707 · total: 4.22 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 61 Mo
WAL: 4699 objets · 4256 Mo
upload le plus ancien: 2026-10-09T04:50:06.670000+00:00 · plus récent: 2026-10-12T12:05:16.528000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.42 Mo/min ≈ 21.7 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=4703 échecs=0 dernier_ok=2026-10-12 12:08:36.112128+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
85058 | 85020 | 19 | routers | 2160 kB
82207 | 79646 | 474 | hotspot_users | 3896 kB
73172 | 68976 | 113 | sessions | 216 kB
73162 | 73102 | 137 | line_quality | 400 kB
60321 | 60321 | 25 | health_checkpoint | 64 kB
27465 | 26170 | 116 | devices | 216 kB
25663 | 45 | 1040 | commands | 6104 kB
11055 | 10694 | 47 | traffic | 312 kB
4726 | 4719 | 24 | settings | 696 kB
4723 | 4719 | 11 | volume_days | 120 kB
70 | 70 | 1 | admin_users | 80 kB
10 | 10 | 0 | profiles | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2884 fichiers
last_run=2026-10-12T12:05:16Z
new=5 skip=2880 fail=0 disk=23%
Mon 2026-10-12 12:10:00 UTC           34s Mon 2026-10-12 12:05:00 UTC 4min 25s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   11G   37G  23% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
