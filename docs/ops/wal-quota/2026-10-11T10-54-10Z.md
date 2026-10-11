# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-11T10:54:10Z
- Run : https://github.com/ftechnologies18/mikcloud/actions/runs/38133540222
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 3191 · total: 2.74 Go (plafond gratuit: 10 Go)
basebackup: 7 objets · 52 Mo
WAL: 3184 objets · 2752 Mo
upload le plus ancien: 2026-10-09T04:50:06.670000+00:00 · plus récent: 2026-10-11T10:50:16.010000+00:00
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
archivés=3189 échecs=0 dernier_ok=2026-10-11 10:54:07.8754+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
54750 | 54747 | 10 | routers | 424 kB
54503 | 52839 | 1252 | hotspot_users | 2848 kB
48686 | 45827 | 12 | sessions | 232 kB
46470 | 46431 | 87 | line_quality | 352 kB
39991 | 39991 | 5 | health_checkpoint | 64 kB
16237 | 29 | 1102 | commands | 5272 kB
7138 | 6878 | 18 | traffic | 288 kB
3282 | 3278 | 21 | volume_days | 120 kB
3240 | 3233 | 39 | settings | 616 kB
59 | 59 | 13 | admin_users | 80 kB
3 | 0 | 120 | activity | 320 kB
1 | 1 | 1 | notif_settings | 64 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2834 fichiers
last_run=2026-10-11T10:50:16Z
new=5 skip=2829 fail=0 disk=22%
Sun 2026-10-11 10:55:00 UTC      50s Sun 2026-10-11 10:50:00 UTC  4min 9s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   10G   38G  22% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
