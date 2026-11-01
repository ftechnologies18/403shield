# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-01T11:22:28Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/41301512541
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10759 · total: 7.91 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10751 objets · 8017 Mo
upload le plus ancien: 2026-10-25T00:00:20.803000+00:00 · plus récent: 2026-11-01T11:20:25.923000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.89 Mo/min ≈ 22.3 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=33404 échecs=0 dernier_ok=2026-11-01 11:21:38.413114+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
902984 | 898817 | 155 | devices | 352 kB
488659 | 488389 | 322 | line_quality | 680 kB
485173 | 484549 | 43 | routers | 1168 kB
439631 | 427973 | 677 | hotspot_users | 4024 kB
389429 | 368013 | 6 | sessions | 216 kB
371218 | 371218 | 16 | health_checkpoint | 64 kB
165597 | 202 | 128 | commands | 7872 kB
67950 | 65132 | 29 | traffic | 280 kB
40321 | 40313 | 42 | settings | 704 kB
30447 | 30435 | 19 | volume_days | 176 kB
2457 | 2455 | 10 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-11-01T11:20:26Z
new=5 skip=2879 fail=0 disk=30%
Sun 2026-11-01 11:25:00 UTC 2min 33s Sun 2026-11-01 11:20:08 UTC 2min 17s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
