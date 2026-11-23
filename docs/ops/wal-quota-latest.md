# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-23T14:53:42Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/45198883847
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10981 · total: 7.93 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10973 objets · 8035 Mo
upload le plus ancien: 2026-11-16T00:00:24.656000+00:00 · plus récent: 2026-11-23T14:50:28.219000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.94 Mo/min ≈ 22.4 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=65244 échecs=0 dernier_ok=2026-11-23 14:53:33.504964+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1820704 | 1815463 | 127 | devices | 472 kB
941772 | 941137 | 36 | routers | 1168 kB
925915 | 925352 | 471 | line_quality | 960 kB
860470 | 840466 | 801 | hotspot_users | 4088 kB
767560 | 730746 | 34 | sessions | 192 kB
728850 | 728850 | 18 | health_checkpoint | 64 kB
315282 | 317 | 408 | commands | 7400 kB
128125 | 122488 | 27 | traffic | 376 kB
84479 | 84470 | 13 | settings | 704 kB
57036 | 57009 | 35 | volume_days | 232 kB
3292 | 3290 | 17 | vpn_peers | 96 kB
143 | 143 | 12 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2884 fichiers
last_run=2026-11-23T14:50:28Z
new=5 skip=2880 fail=0 disk=30%
Mon 2026-11-23 14:55:00 UTC 1min 20s Mon 2026-11-23 14:50:09 UTC  3min 30s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
