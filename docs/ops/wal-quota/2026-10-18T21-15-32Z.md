# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-18T21:15:32Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/39166932704
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 11359 · total: 9.64 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 74 Mo
WAL: 11351 objets · 9793 Mo
upload le plus ancien: 2026-10-11T00:00:11.653000+00:00 · plus récent: 2026-10-18T21:10:16.887000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.82 Mo/min ≈ 23.7 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=13885 échecs=0 dernier_ok=2026-10-18 21:15:12.65262+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
357328 | 354237 | 129 | devices | 304 kB
238564 | 237965 | 46 | routers | 2496 kB
228128 | 227973 | 131 | line_quality | 480 kB
215715 | 209103 | 1211 | hotspot_users | 3984 kB
189761 | 178292 | 9 | sessions | 232 kB
176863 | 176863 | 19 | health_checkpoint | 64 kB
77526 | 113 | 717 | commands | 7536 kB
32096 | 30875 | 31 | traffic | 328 kB
14115 | 14107 | 30 | settings | 704 kB
13445 | 13439 | 14 | volume_days | 136 kB
163 | 163 | 4 | vpn_peers | 64 kB
101 | 101 | 11 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2879 fichiers
last_run=2026-10-18T21:15:25Z
new=5 skip=2878 fail=0 disk=24%
Sun 2026-10-18 21:20:00 UTC 4min 29s Sun 2026-10-18 21:15:08 UTC     22s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
