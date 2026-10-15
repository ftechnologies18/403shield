# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-15T09:13:49Z
- Run : https://github.com/ftechnologies18/mikcloud/actions/runs/38711249377
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 8853 · total: 7.98 Go (plafond gratuit: 10 Go)
basebackup: 11 objets · 89 Mo
WAL: 8842 objets · 8080 Mo
upload le plus ancien: 2026-10-09T04:50:06.670000+00:00 · plus récent: 2026-10-15T09:10:17.674000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.18 Mo/min ≈ 22.8 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=8846 échecs=0 dernier_ok=2026-10-15 09:13:12.948572+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
175628 | 172926 | 99 | devices | 288 kB
155522 | 155087 | 21 | routers | 1344 kB
144700 | 144611 | 224 | line_quality | 448 kB
137001 | 132464 | 684 | hotspot_users | 3976 kB
120309 | 113061 | 24 | sessions | 224 kB
114612 | 114612 | 16 | health_checkpoint | 64 kB
49409 | 88 | 238 | commands | 7544 kB
20803 | 20055 | 36 | traffic | 304 kB
8846 | 8839 | 26 | settings | 696 kB
8349 | 8343 | 33 | volume_days | 136 kB
78 | 78 | 9 | admin_users | 80 kB
12 | 12 | 2 | profiles | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2882 fichiers
last_run=2026-10-15T09:10:17Z
new=5 skip=2878 fail=0 disk=25%
Thu 2026-10-15 09:15:00 UTC      1min 13s Thu 2026-10-15 09:10:00 UTC 3min 46s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   36G  25% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
