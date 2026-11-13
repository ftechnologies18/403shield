# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-13T12:21:07Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/43424233433
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10824 · total: 7.61 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 81 Mo
WAL: 10816 objets · 7709 Mo
upload le plus ancien: 2026-11-06T00:00:24.545000+00:00 · plus récent: 2026-11-13T12:15:28.328000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.02 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=50737 échecs=0 dernier_ok=2026-11-13 12:20:48.57006+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1391616 | 1386843 | 175 | devices | 408 kB
734050 | 733421 | 34 | routers | 1168 kB
732886 | 732382 | 275 | line_quality | 808 kB
665537 | 649052 | 969 | hotspot_users | 4024 kB
592379 | 561806 | 1 | sessions | 208 kB
566459 | 566459 | 12 | health_checkpoint | 64 kB
249780 | 277 | 1221 | commands | 7600 kB
101683 | 97309 | 32 | traffic | 344 kB
64338 | 64330 | 49 | settings | 704 kB
45137 | 45112 | 35 | volume_days | 216 kB
3128 | 3126 | 11 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2880 fichiers
last_run=2026-11-13T12:20:18Z
new=5 skip=2879 fail=0 disk=30%
Fri 2026-11-13 12:25:00 UTC  3min 55s Fri 2026-11-13 12:20:00 UTC  1min 4s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
