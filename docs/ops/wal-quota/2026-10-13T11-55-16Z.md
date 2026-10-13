# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-13T11:55:16Z
- Run : https://github.com/ftechnologies18/mikcloud/actions/runs/38393416467
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 6132 · total: 5.5 Go (plafond gratuit: 10 Go)
basebackup: 9 objets · 70 Mo
WAL: 6123 objets · 5561 Mo
upload le plus ancien: 2026-10-09T04:50:06.670000+00:00 · plus récent: 2026-10-13T11:50:16.433000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.47 Mo/min ≈ 23.2 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=6129 échecs=0 dernier_ok=2026-10-13 11:55:03.468453+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
109690 | 109524 | 37 | routers | 2424 kB
99696 | 96448 | 1555 | hotspot_users | 3936 kB
97947 | 97887 | 160 | line_quality | 416 kB
88136 | 82873 | 19 | sessions | 224 kB
79877 | 79877 | 21 | health_checkpoint | 64 kB
78337 | 76114 | 101 | devices | 264 kB
33914 | 60 | 493 | commands | 7320 kB
14392 | 13937 | 25 | traffic | 248 kB
6151 | 6144 | 32 | settings | 696 kB
5909 | 5905 | 10 | volume_days | 120 kB
78 | 78 | 9 | admin_users | 80 kB
10 | 10 | 0 | profiles | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2884 fichiers
last_run=2026-10-13T11:50:16Z
new=5 skip=2878 fail=0 disk=24%
-                                       - Tue 2026-10-13 11:55:00 UTC       13s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
