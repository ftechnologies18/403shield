# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-02T12:37:13Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/41445993450
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10833 · total: 7.8 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 80 Mo
WAL: 10825 objets · 7906 Mo
upload le plus ancien: 2026-10-26T00:00:23.041000+00:00 · plus récent: 2026-11-02T12:35:25.854000+00:00
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
archivés=34918 échecs=0 dernier_ok=2026-11-02 12:36:20.849374+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
925671 | 921500 | 70 | devices | 352 kB
508212 | 507930 | 342 | line_quality | 688 kB
502397 | 501773 | 38 | routers | 952 kB
453161 | 441131 | 1201 | hotspot_users | 4024 kB
401602 | 379617 | 3 | sessions | 216 kB
385728 | 385728 | 10 | health_checkpoint | 64 kB
171641 | 210 | 61 | commands | 7872 kB
70693 | 67776 | 46 | traffic | 320 kB
42414 | 42406 | 35 | settings | 704 kB
31724 | 31710 | 32 | volume_days | 192 kB
2577 | 2575 | 10 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-11-02T12:35:26Z
new=5 skip=2879 fail=0 disk=30%
Mon 2026-11-02 12:40:00 UTC 2min 48s Mon 2026-11-02 12:35:08 UTC       2min 3s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
