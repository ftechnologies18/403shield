# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-19T13:27:46Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/44533480456
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10854 · total: 7.35 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10846 objets · 7439 Mo
upload le plus ancien: 2026-11-12T00:00:23.999000+00:00 · plus récent: 2026-11-19T13:25:27.446000+00:00
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
archivés=59399 échecs=0 dernier_ok=2026-11-19 13:27:02.861724+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1699690 | 1694704 | 178 | devices | 424 kB
867063 | 866429 | 34 | routers | 1168 kB
857579 | 857026 | 408 | line_quality | 896 kB
796204 | 777574 | 447 | hotspot_users | 4088 kB
710630 | 675455 | 72 | sessions | 208 kB
666270 | 666270 | 18 | health_checkpoint | 64 kB
292228 | 304 | 365 | commands | 7496 kB
118857 | 113640 | 36 | traffic | 264 kB
76394 | 76385 | 37 | settings | 704 kB
53218 | 53193 | 34 | volume_days | 224 kB
3181 | 3179 | 11 | vpn_peers | 96 kB
142 | 142 | 11 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-11-19T13:25:27Z
new=5 skip=2879 fail=0 disk=30%
Thu 2026-11-19 13:30:00 UTC      2min 15s Thu 2026-11-19 13:25:09 UTC 2min 35s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
