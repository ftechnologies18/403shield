# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-08T11:22:59Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/42475408510
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10771 · total: 6.79 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10763 objets · 6876 Mo
upload le plus ancien: 2026-11-01T00:00:23.590000+00:00 · plus récent: 2026-11-08T11:20:20.949000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.96 Mo/min ≈ 22.4 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=43482 échecs=0 dernier_ok=2026-11-08 11:22:35.78392+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1167344 | 1162806 | 156 | devices | 384 kB
630893 | 630478 | 273 | line_quality | 768 kB
627231 | 626605 | 21 | routers | 1392 kB
563631 | 549082 | 911 | hotspot_users | 4024 kB
500401 | 473687 | 24 | sessions | 216 kB
477914 | 477914 | 12 | health_checkpoint | 64 kB
213965 | 254 | 1087 | commands | 7600 kB
87724 | 84020 | 33 | traffic | 376 kB
54272 | 54264 | 7 | settings | 704 kB
39458 | 39439 | 25 | volume_days | 200 kB
2814 | 2812 | 7 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2882 fichiers
last_run=2026-11-08T11:20:21Z
new=5 skip=2879 fail=0 disk=30%
Sun 2026-11-08 11:25:00 UTC 2min 2s Sun 2026-11-08 11:20:03 UTC 2min 54s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
