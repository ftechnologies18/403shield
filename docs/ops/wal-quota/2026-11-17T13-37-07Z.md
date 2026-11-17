# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-17T13:37:07Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/44094315714
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10864 · total: 7.28 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 82 Mo
WAL: 10856 objets · 7373 Mo
upload le plus ancien: 2026-11-10T00:00:24.393000+00:00 · plus récent: 2026-11-17T13:35:27.279000+00:00
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
archivés=56530 échecs=0 dernier_ok=2026-11-17 13:36:57.857573+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1600074 | 1595183 | 155 | devices | 424 kB
820480 | 819849 | 38 | routers | 1168 kB
814831 | 814295 | 376 | line_quality | 872 kB
753639 | 735745 | 1087 | hotspot_users | 4072 kB
672430 | 638755 | 1 | sessions | 208 kB
630630 | 630630 | 18 | health_checkpoint | 64 kB
277628 | 291 | 57 | commands | 7440 kB
112984 | 108053 | 46 | traffic | 264 kB
72395 | 72387 | 28 | settings | 704 kB
50668 | 50643 | 48 | volume_days | 224 kB
3130 | 3128 | 13 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2882 fichiers
last_run=2026-11-17T13:35:27Z
new=5 skip=2880 fail=0 disk=30%
Tue 2026-11-17 13:40:00 UTC 2min 55s Tue 2026-11-17 13:35:09 UTC      1min 55s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   15G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
