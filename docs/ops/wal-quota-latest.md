# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-15T12:02:15Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/43711691908
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10768 · total: 7.24 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 81 Mo
WAL: 10760 objets · 7329 Mo
upload le plus ancien: 2026-11-08T00:00:24.803000+00:00 · plus récent: 2026-11-15T12:00:28.333000+00:00
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
archivés=53555 échecs=0 dernier_ok=2026-11-15 12:01:37.151412+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1494344 | 1489522 | 126 | devices | 416 kB
774253 | 773622 | 27 | routers | 520 kB
771728 | 771209 | 335 | line_quality | 840 kB
709666 | 692552 | 825 | hotspot_users | 4048 kB
632566 | 600226 | 0 | sessions | 200 kB
596794 | 596794 | 22 | health_checkpoint | 64 kB
263036 | 284 | 868 | commands | 8024 kB
107069 | 102439 | 27 | traffic | 304 kB
68272 | 68264 | 35 | settings | 704 kB
47755 | 47730 | 38 | volume_days | 216 kB
3130 | 3128 | 13 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2839 fichiers
last_run=2026-11-15T12:00:28Z
new=5 skip=2837 fail=0 disk=29%
Sun 2026-11-15 12:05:00 UTC 2min 46s Sun 2026-11-15 12:00:09 UTC  2min 4s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  29% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
