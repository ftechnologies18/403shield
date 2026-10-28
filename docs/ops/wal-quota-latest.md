# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-28T10:40:38Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/40673843056
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10695 · total: 7.74 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 78 Mo
WAL: 10687 objets · 7843 Mo
upload le plus ancien: 2026-10-21T00:00:14.019000+00:00 · plus récent: 2026-10-28T10:35:25.402000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.97 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=27616 échecs=0 dernier_ok=2026-10-28 10:39:57.93382+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
746389 | 742413 | 159 | devices | 344 kB
424321 | 423703 | 28 | routers | 1168 kB
420786 | 420545 | 238 | line_quality | 616 kB
383241 | 372887 | 1013 | hotspot_users | 4000 kB
339612 | 320571 | 5 | sessions | 216 kB
319392 | 319392 | 30 | health_checkpoint | 64 kB
142272 | 175 | 520 | commands | 7832 kB
58486 | 56087 | 25 | traffic | 256 kB
32341 | 32333 | 42 | settings | 704 kB
25870 | 25858 | 31 | volume_days | 160 kB
2108 | 2107 | 9 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2879 fichiers
last_run=2026-10-28T10:40:25Z
new=5 skip=2879 fail=0 disk=29%
Wed 2026-10-28 10:45:00 UTC 4min 24s Wed 2026-10-28 10:40:08 UTC       27s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  29% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
