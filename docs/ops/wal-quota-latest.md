# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-18T08:55:45Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/39113263995
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10621 · total: 9.02 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 74 Mo
WAL: 10613 objets · 9165 Mo
upload le plus ancien: 2026-10-11T00:00:11.653000+00:00 · plus récent: 2026-10-18T08:50:16.718000+00:00
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
archivés=13146 échecs=0 dernier_ok=2026-10-18 08:54:55.035292+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
325545 | 322460 | 157 | devices | 304 kB
225709 | 225112 | 18 | routers | 1184 kB
214724 | 214579 | 99 | line_quality | 480 kB
200190 | 194048 | 854 | hotspot_users | 3976 kB
176098 | 165708 | 2 | sessions | 224 kB
167689 | 167689 | 10 | health_checkpoint | 64 kB
72666 | 107 | 455 | commands | 7512 kB
30342 | 29150 | 37 | traffic | 336 kB
13233 | 13225 | 46 | settings | 704 kB
12781 | 12775 | 13 | volume_days | 136 kB
112 | 112 | 2 | vpn_peers | 64 kB
99 | 99 | 9 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2879 fichiers
last_run=2026-10-18T08:55:17Z
new=5 skip=2879 fail=0 disk=24%
Sun 2026-10-18 09:00:00 UTC 4min 16s Sun 2026-10-18 08:55:00 UTC      43s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
