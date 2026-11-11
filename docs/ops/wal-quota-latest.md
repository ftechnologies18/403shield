# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-11T11:57:20Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/43016026611
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10805 · total: 7.07 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 80 Mo
WAL: 10797 objets · 7163 Mo
upload le plus ancien: 2026-11-04T00:00:23.152000+00:00 · plus récent: 2026-11-11T11:55:27.075000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 17.23 Mo/min ≈ 24.2 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=47834 échecs=0 dernier_ok=2026-11-11 11:56:49.52975+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1319900 | 1315151 | 144 | devices | 400 kB
690042 | 689413 | 34 | routers | 3136 kB
689994 | 689515 | 258 | line_quality | 784 kB
628435 | 612656 | 876 | hotspot_users | 4024 kB
558457 | 528793 | 38 | sessions | 200 kB
529872 | 529872 | 18 | health_checkpoint | 64 kB
236054 | 264 | 926 | commands | 8008 kB
95824 | 91693 | 33 | traffic | 288 kB
60306 | 60298 | 35 | settings | 704 kB
42418 | 42394 | 36 | volume_days | 208 kB
3099 | 3097 | 12 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-11-11T11:55:27Z
new=5 skip=2879 fail=0 disk=30%
Wed 2026-11-11 12:00:00 UTC 2min 42s Wed 2026-11-11 11:55:09 UTC   2min 8s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
