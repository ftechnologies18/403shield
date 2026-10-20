# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-20T09:30:46Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/39401047567
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10655 · total: 8.55 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 77 Mo
WAL: 10647 objets · 8676 Mo
upload le plus ancien: 2026-10-13T00:00:13.619000+00:00 · plus récent: 2026-10-20T09:25:18.627000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.01 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=16061 échecs=0 dernier_ok=2026-10-20 09:30:28.67757+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
432266 | 428912 | 100 | devices | 320 kB
271656 | 271055 | 41 | routers | 1184 kB
264976 | 264804 | 167 | line_quality | 512 kB
247549 | 240172 | 1364 | hotspot_users | 3984 kB
218364 | 205314 | 56 | sessions | 232 kB
203408 | 203408 | 21 | health_checkpoint | 64 kB
90070 | 121 | 1140 | commands | 7280 kB
37095 | 35680 | 31 | traffic | 272 kB
16713 | 16705 | 36 | settings | 704 kB
15608 | 15599 | 21 | volume_days | 144 kB
368 | 368 | 6 | vpn_peers | 64 kB
113 | 113 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2880 fichiers
last_run=2026-10-20T09:30:18Z
new=5 skip=2879 fail=0 disk=24%
Tue 2026-10-20 09:35:00 UTC      4min 15s Tue 2026-10-20 09:30:00 UTC      44s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
