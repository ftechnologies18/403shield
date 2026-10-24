# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-24T08:57:33Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/40079976802
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10596 · total: 7.58 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 77 Mo
WAL: 10588 objets · 7689 Mo
upload le plus ancien: 2026-10-17T00:00:13.720000+00:00 · plus récent: 2026-10-24T08:55:25.099000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.50 Mo/min ≈ 21.8 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=21755 échecs=0 dernier_ok=2026-10-24 08:56:50.687112+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
567874 | 564257 | 109 | devices | 320 kB
351117 | 350508 | 27 | routers | 2480 kB
345283 | 345071 | 199 | line_quality | 552 kB
320041 | 311032 | 569 | hotspot_users | 3984 kB
283651 | 267643 | 37 | sessions | 216 kB
261295 | 261295 | 13 | health_checkpoint | 64 kB
115955 | 139 | 1152 | commands | 7368 kB
47963 | 46037 | 9 | traffic | 360 kB
24256 | 24248 | 21 | settings | 704 kB
20912 | 20902 | 21 | volume_days | 152 kB
1432 | 1431 | 8 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2850 fichiers
last_run=2026-10-24T08:55:25Z
new=5 skip=2848 fail=0 disk=24%
Sat 2026-10-24 09:00:00 UTC  2min 28s Sat 2026-10-24 08:55:08 UTC 2min 22s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   11G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
