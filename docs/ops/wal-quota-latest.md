# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-12T12:54:58Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/43222113320
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10859 · total: 7.7 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 81 Mo
WAL: 10851 objets · 7801 Mo
upload le plus ancien: 2026-11-05T00:00:23.341000+00:00 · plus récent: 2026-11-12T12:50:21.205000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.93 Mo/min ≈ 22.4 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=49330 échecs=0 dernier_ok=2026-11-12 12:53:56.771129+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1341824 | 1337069 | 162 | devices | 400 kB
712671 | 712042 | 27 | routers | 1168 kB
711382 | 710888 | 251 | line_quality | 792 kB
643837 | 627674 | 836 | hotspot_users | 4024 kB
572610 | 542803 | 61 | sessions | 200 kB
548510 | 548510 | 26 | health_checkpoint | 64 kB
242648 | 266 | 605 | commands | 7280 kB
98787 | 94528 | 39 | traffic | 288 kB
62385 | 62377 | 14 | settings | 704 kB
43848 | 43824 | 31 | volume_days | 208 kB
3119 | 3117 | 8 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2882 fichiers
last_run=2026-11-12T12:50:21Z
new=5 skip=2878 fail=0 disk=30%
Thu 2026-11-12 12:55:00 UTC     3s Thu 2026-11-12 12:50:02 UTC 4min 53s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
