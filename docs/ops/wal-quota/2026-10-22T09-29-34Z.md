# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-22T09:29:34Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/39755671310
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10655 · total: 8.1 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 78 Mo
WAL: 10647 objets · 8218 Mo
upload le plus ancien: 2026-10-15T00:00:13.665000+00:00 · plus récent: 2026-10-22T09:25:18.378000+00:00
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
archivés=18939 échecs=0 dernier_ok=2026-10-22 09:29:14.845114+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
526859 | 523347 | 140 | devices | 320 kB
319173 | 318572 | 23 | routers | 1168 kB
313127 | 312945 | 125 | line_quality | 520 kB
295281 | 286938 | 688 | hotspot_users | 3984 kB
261519 | 246481 | 49 | sessions | 224 kB
237819 | 237819 | 27 | health_checkpoint | 64 kB
105970 | 135 | 926 | commands | 7264 kB
43543 | 41817 | 21 | traffic | 328 kB
20329 | 20321 | 42 | settings | 704 kB
18569 | 18560 | 15 | volume_days | 144 kB
917 | 916 | 12 | vpn_peers | 96 kB
113 | 113 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2884 fichiers
last_run=2026-10-22T09:25:18Z
new=5 skip=2879 fail=0 disk=24%
Thu 2026-10-22 09:30:00 UTC      27s Thu 2026-10-22 09:25:00 UTC 4min 32s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
