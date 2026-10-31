# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-31T10:28:04Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/41192780442
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10704 · total: 7.91 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10696 objets · 8019 Mo
upload le plus ancien: 2026-10-24T00:00:22.009000+00:00 · plus récent: 2026-10-31T10:25:25.636000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.52 Mo/min ≈ 23.2 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=31910 échecs=0 dernier_ok=2026-10-31 10:27:14.716639+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
858191 | 854077 | 144 | devices | 344 kB
469608 | 469346 | 298 | line_quality | 664 kB
467014 | 466394 | 35 | routers | 1824 kB
423291 | 412013 | 792 | hotspot_users | 4000 kB
374982 | 354434 | 50 | sessions | 208 kB
355765 | 355765 | 13 | health_checkpoint | 64 kB
158983 | 194 | 548 | commands | 7688 kB
65328 | 62663 | 46 | traffic | 312 kB
38256 | 38248 | 21 | settings | 704 kB
29155 | 29143 | 18 | volume_days | 176 kB
2337 | 2336 | 5 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2869 fichiers
last_run=2026-10-31T10:25:25Z
new=5 skip=2866 fail=0 disk=29%
Sat 2026-10-31 10:30:00 UTC  1min 58s Sat 2026-10-31 10:25:08 UTC 2min 53s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  29% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
