# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-28T13:13:52Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/46148470628
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10790 · total: 7.94 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 83 Mo
WAL: 10782 objets · 8052 Mo
upload le plus ancien: 2026-11-21T00:00:25.097000+00:00 · plus récent: 2026-11-28T13:10:29.665000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.84 Mo/min ≈ 22.3 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=72250 échecs=0 dernier_ok=2026-11-28 13:12:56.928329+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
2074651 | 2069055 | 148 | devices | 504 kB
1055396 | 1054761 | 37 | routers | 952 kB
1037623 | 1036885 | 270 | line_quality | 1016 kB
996694 | 974563 | 1032 | hotspot_users | 4104 kB
891278 | 847491 | 33 | sessions | 216 kB
815934 | 815934 | 24 | health_checkpoint | 64 kB
352323 | 407 | 34 | commands | 7576 kB
143181 | 136828 | 30 | traffic | 304 kB
94230 | 94221 | 24 | settings | 704 kB
64076 | 64047 | 35 | volume_days | 240 kB
3694 | 3692 | 12 | vpn_peers | 96 kB
143 | 143 | 12 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2869 fichiers
last_run=2026-11-28T13:10:29Z
new=5 skip=2866 fail=0 disk=31%
Sat 2026-11-28 13:15:00 UTC   1min 9s Sat 2026-11-28 13:10:09 UTC 3min 41s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   33G  31% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
