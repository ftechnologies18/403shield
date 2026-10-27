# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-27T09:54:06Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/40484150953
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10650 · total: 7.72 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 77 Mo
WAL: 10642 objets · 7833 Mo
upload le plus ancien: 2026-10-20T00:00:14.193000+00:00 · plus récent: 2026-10-27T09:50:25.583000+00:00
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
archivés=26130 échecs=0 dernier_ok=2026-10-27 09:53:30.783141+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
691188 | 687339 | 120 | devices | 336 kB
404861 | 404246 | 28 | routers | 1168 kB
400634 | 400400 | 233 | line_quality | 592 kB
363254 | 353279 | 1367 | hotspot_users | 4000 kB
321803 | 303938 | 24 | sessions | 216 kB
303870 | 303870 | 18 | health_checkpoint | 64 kB
134939 | 165 | 1090 | commands | 7680 kB
55663 | 53386 | 30 | traffic | 360 kB
30283 | 30275 | 14 | settings | 704 kB
24541 | 24531 | 17 | volume_days | 152 kB
1958 | 1957 | 9 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2882 fichiers
last_run=2026-10-27T09:50:25Z
new=5 skip=2878 fail=0 disk=27%
Tue 2026-10-27 09:55:00 UTC           57s Tue 2026-10-27 09:50:08 UTC 3min 54s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   13G   35G  27% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
