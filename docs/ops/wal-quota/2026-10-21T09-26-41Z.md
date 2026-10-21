# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-21T09:26:41Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/39576836828
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10656 · total: 8.36 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 77 Mo
WAL: 10648 objets · 8487 Mo
upload le plus ancien: 2026-10-14T00:00:13.170000+00:00 · plus récent: 2026-10-21T09:25:17.422000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.99 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=17496 échecs=0 dernier_ok=2026-10-21 09:25:47.423817+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
477279 | 473843 | 149 | devices | 320 kB
294577 | 293976 | 22 | routers | 1168 kB
288086 | 287906 | 138 | line_quality | 512 kB
271147 | 263234 | 1104 | hotspot_users | 3984 kB
239583 | 225561 | 6 | sessions | 232 kB
220072 | 220072 | 10 | health_checkpoint | 64 kB
97850 | 132 | 6 | commands | 7368 kB
40167 | 38645 | 9 | traffic | 296 kB
18419 | 18411 | 36 | settings | 704 kB
16942 | 16933 | 20 | volume_days | 144 kB
576 | 576 | 6 | vpn_peers | 64 kB
113 | 113 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-10-21T09:25:17Z
new=5 skip=2880 fail=0 disk=24%
Wed 2026-10-21 09:30:00 UTC 3min 21s Wed 2026-10-21 09:25:00 UTC 1min 38s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
