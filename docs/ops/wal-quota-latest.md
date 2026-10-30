# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-30T10:55:57Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/41044205499
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10698 · total: 7.49 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10690 objets · 7592 Mo
upload le plus ancien: 2026-10-23T00:00:14.275000+00:00 · plus récent: 2026-10-30T10:50:26.368000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 17.32 Mo/min ≈ 24.4 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=30498 échecs=0 dernier_ok=2026-10-30 10:55:00.590479+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
818219 | 814134 | 132 | devices | 344 kB
453923 | 453664 | 317 | line_quality | 648 kB
452810 | 452191 | 32 | routers | 2264 kB
409459 | 398458 | 1267 | hotspot_users | 4000 kB
362648 | 342575 | 89 | sessions | 216 kB
343346 | 343346 | 13 | health_checkpoint | 64 kB
153566 | 190 | 390 | commands | 7864 kB
63154 | 60535 | 39 | traffic | 312 kB
36310 | 36302 | 7 | settings | 704 kB
28138 | 28126 | 27 | volume_days | 176 kB
2242 | 2241 | 13 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2867 fichiers
last_run=2026-10-30T10:55:26Z
new=5 skip=2867 fail=0 disk=29%
Fri 2026-10-30 11:00:00 UTC   4min 3s Fri 2026-10-30 10:55:08 UTC      47s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  29% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
