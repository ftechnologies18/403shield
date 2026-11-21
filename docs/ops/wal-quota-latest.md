# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-21T12:47:38Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/44905557636
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10813 · total: 7.4 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10805 objets · 7492 Mo
upload le plus ancien: 2026-11-14T00:00:24.896000+00:00 · plus récent: 2026-11-21T12:45:27.526000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.27 Mo/min ≈ 22.9 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=62237 échecs=0 dernier_ok=2026-11-21 12:46:37.187372+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1768417 | 1763359 | 80 | devices | 432 kB
908542 | 907907 | 30 | routers | 1392 kB
893875 | 893319 | 424 | line_quality | 920 kB
831361 | 812065 | 437 | hotspot_users | 4088 kB
741893 | 705526 | 52 | sessions | 208 kB
700899 | 700899 | 27 | health_checkpoint | 64 kB
304403 | 311 | 164 | commands | 7976 kB
123757 | 118338 | 26 | traffic | 312 kB
80328 | 80319 | 42 | settings | 704 kB
55216 | 55190 | 35 | volume_days | 232 kB
3190 | 3188 | 7 | vpn_peers | 96 kB
142 | 142 | 11 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2880 fichiers
last_run=2026-11-21T12:45:27Z
new=5 skip=2878 fail=0 disk=31%
Sat 2026-11-21 12:50:00 UTC  2min 23s Sat 2026-11-21 12:45:09 UTC 2min 27s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  31% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
