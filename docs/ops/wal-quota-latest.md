# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-17T08:39:06Z
- Run : https://github.com/ftechnologies18/mikcloud/actions/runs/39018086291
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10606 · total: 9.28 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 73 Mo
WAL: 10598 objets · 9433 Mo
upload le plus ancien: 2026-10-10T00:00:05.404000+00:00 · plus récent: 2026-10-17T08:35:21.886000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.75 Mo/min ≈ 22.1 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=11690 échecs=0 dernier_ok=2026-10-17 08:38:19.107691+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
271612 | 268718 | 154 | devices | 296 kB
201886 | 201307 | 44 | routers | 1368 kB
190991 | 190884 | 255 | line_quality | 472 kB
177748 | 172142 | 1128 | hotspot_users | 3976 kB
156023 | 146725 | 11 | sessions | 216 kB
149937 | 149937 | 14 | health_checkpoint | 64 kB
64457 | 98 | 871 | commands | 7376 kB
27120 | 26114 | 25 | traffic | 304 kB
11662 | 11655 | 27 | settings | 696 kB
11272 | 11266 | 14 | volume_days | 136 kB
79 | 79 | 11 | admin_users | 80 kB
74 | 74 | 4 | vpn_peers | 64 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2882 fichiers
last_run=2026-10-17T08:35:22Z
new=5 skip=2878 fail=0 disk=24%
Sat 2026-10-17 08:40:00 UTC       56s Sat 2026-10-17 08:35:05 UTC 3min 58s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
