# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-27T13:59:23Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/46011671468
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10836 · total: 7.99 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10828 objets · 8095 Mo
upload le plus ancien: 2026-11-20T00:00:24.637000+00:00 · plus récent: 2026-11-27T13:55:27.888000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.23 Mo/min ≈ 22.8 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=70857 échecs=0 dernier_ok=2026-11-27 13:59:05.454999+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
2022026 | 2016481 | 156 | devices | 504 kB
1032745 | 1032110 | 36 | routers | 1392 kB
1015009 | 1014323 | 189 | line_quality | 1016 kB
968101 | 946382 | 962 | hotspot_users | 4104 kB
865189 | 823070 | 66 | sessions | 224 kB
797665 | 797665 | 25 | health_checkpoint | 64 kB
344826 | 405 | 152 | commands | 7824 kB
140106 | 133919 | 28 | traffic | 304 kB
92291 | 92282 | 45 | settings | 704 kB
62609 | 62580 | 35 | volume_days | 240 kB
3625 | 3623 | 15 | vpn_peers | 96 kB
143 | 143 | 12 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2870 fichiers
last_run=2026-11-27T13:55:28Z
new=5 skip=2866 fail=0 disk=31%
Fri 2026-11-27 14:00:00 UTC           38s Fri 2026-11-27 13:55:09 UTC 4min 12s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   33G  31% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
