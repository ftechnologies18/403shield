# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-16T12:54:28Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/43870610144
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10818 · total: 7.17 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 81 Mo
WAL: 10810 objets · 7260 Mo
upload le plus ancien: 2026-11-09T00:00:24.754000+00:00 · plus récent: 2026-11-16T12:50:27.667000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.00 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=55048 échecs=0 dernier_ok=2026-11-16 12:54:19.663951+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1542668 | 1537790 | 129 | devices | 424 kB
795811 | 795180 | 26 | routers | 1168 kB
791922 | 791392 | 350 | line_quality | 856 kB
730123 | 712677 | 1292 | hotspot_users | 4072 kB
651179 | 618255 | 65 | sessions | 200 kB
613596 | 613596 | 24 | health_checkpoint | 64 kB
269780 | 289 | 770 | commands | 8032 kB
109842 | 105053 | 23 | traffic | 360 kB
70337 | 70329 | 42 | settings | 704 kB
49065 | 49040 | 31 | volume_days | 216 kB
3130 | 3128 | 13 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2856 fichiers
last_run=2026-11-16T12:50:27Z
new=5 skip=2851 fail=0 disk=29%
Mon 2026-11-16 12:55:00 UTC      34s Mon 2026-11-16 12:50:09 UTC 4min 16s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  29% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
