# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-19T10:02:21Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/39234368817
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10690 · total: 8.8 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 76 Mo
WAL: 10682 objets · 8939 Mo
upload le plus ancien: 2026-10-12T00:00:21.131000+00:00 · plus récent: 2026-10-19T10:00:17.546000+00:00
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
archivés=14652 échecs=0 dernier_ok=2026-10-19 10:01:24.260391+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
379876 | 376700 | 161 | devices | 312 kB
249552 | 248952 | 44 | routers | 1184 kB
240261 | 240092 | 173 | line_quality | 512 kB
224080 | 217278 | 1757 | hotspot_users | 3984 kB
197204 | 185442 | 35 | sessions | 216 kB
185640 | 185640 | 4 | health_checkpoint | 64 kB
81630 | 117 | 1160 | commands | 7536 kB
33743 | 32442 | 38 | traffic | 304 kB
15027 | 15019 | 34 | settings | 704 kB
14170 | 14162 | 23 | volume_days | 144 kB
215 | 215 | 2 | vpn_peers | 64 kB
105 | 105 | 15 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2881 fichiers
last_run=2026-10-19T10:00:17Z
new=5 skip=2879 fail=0 disk=24%
Mon 2026-10-19 10:05:00 UTC     2min 40s Mon 2026-10-19 10:00:00 UTC 2min 19s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   37G  24% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
