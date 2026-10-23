# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-23T09:25:47Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/39931639536
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10620 · total: 7.94 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 77 Mo
WAL: 10612 objets · 8056 Mo
upload le plus ancien: 2026-10-16T00:00:13.625000+00:00 · plus récent: 2026-10-23T09:20:25.861000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.95 Mo/min ≈ 22.4 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=20344 échecs=0 dernier_ok=2026-10-23 09:25:42.405426+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
554656 | 551066 | 117 | devices | 320 kB
338830 | 338222 | 25 | routers | 1168 kB
332834 | 332633 | 166 | line_quality | 536 kB
312439 | 303686 | 1336 | hotspot_users | 3984 kB
277003 | 261375 | 19 | sessions | 224 kB
250448 | 250448 | 25 | health_checkpoint | 64 kB
112052 | 137 | 1005 | commands | 7272 kB
46239 | 44400 | 5 | traffic | 312 kB
22310 | 22302 | 7 | settings | 704 kB
19975 | 19965 | 16 | volume_days | 152 kB
1226 | 1225 | 8 | vpn_peers | 96 kB
131 | 131 | 20 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2849 fichiers
last_run=2026-10-23T09:25:25Z
new=5 skip=2848 fail=0 disk=24%
Fri 2026-10-23 09:30:00 UTC  4min 14s Fri 2026-10-23 09:25:08 UTC      37s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
273M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
