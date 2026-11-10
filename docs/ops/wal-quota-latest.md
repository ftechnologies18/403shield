# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-10T12:46:49Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/42818478031
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10856 · total: 7.05 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10848 objets · 7141 Mo
upload le plus ancien: 2026-11-03T00:00:15.233000+00:00 · plus récent: 2026-11-10T12:45:27.131000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 17.27 Mo/min ≈ 24.3 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=46444 échecs=0 dernier_ok=2026-11-10 12:45:52.375221+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1281141 | 1276401 | 166 | devices | 400 kB
672440 | 671987 | 269 | line_quality | 784 kB
670355 | 669728 | 25 | routers | 2264 kB
609899 | 594499 | 927 | hotspot_users | 4024 kB
541849 | 512920 | 37 | sessions | 216 kB
513039 | 513039 | 14 | health_checkpoint | 64 kB
229555 | 258 | 292 | commands | 8144 kB
93420 | 89408 | 31 | traffic | 288 kB
58381 | 58373 | 42 | settings | 704 kB
41598 | 41574 | 36 | volume_days | 208 kB
2983 | 2981 | 4 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2880 fichiers
last_run=2026-11-10T12:45:27Z
new=5 skip=2879 fail=0 disk=30%
Tue 2026-11-10 12:50:00 UTC 3min 13s Tue 2026-11-10 12:45:09 UTC  1min 37s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
