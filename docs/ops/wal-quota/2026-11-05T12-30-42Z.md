# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-05T12:30:42Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/42027560573
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10825 · total: 6.72 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10817 objets · 6800 Mo
upload le plus ancien: 2026-10-29T00:00:22.272000+00:00 · plus récent: 2026-11-05T12:25:27.733000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.76 Mo/min ≈ 22.2 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=39231 échecs=0 dernier_ok=2026-11-05 12:29:47.765639+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1025434 | 1021055 | 147 | devices | 368 kB
567889 | 567536 | 108 | line_quality | 744 kB
561718 | 561094 | 21 | routers | 952 kB
499424 | 486180 | 1270 | hotspot_users | 4024 kB
442832 | 418822 | 39 | sessions | 208 kB
432605 | 432605 | 27 | health_checkpoint | 64 kB
191239 | 232 | 1206 | commands | 7008 kB
78932 | 75625 | 32 | traffic | 336 kB
48385 | 48377 | 42 | settings | 704 kB
35644 | 35627 | 24 | volume_days | 200 kB
2688 | 2686 | 7 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2880 fichiers
last_run=2026-11-05T12:30:27Z
new=5 skip=2880 fail=0 disk=29%
Thu 2026-11-05 12:35:00 UTC     4min 19s Thu 2026-11-05 12:30:09 UTC       30s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   35G  29% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
