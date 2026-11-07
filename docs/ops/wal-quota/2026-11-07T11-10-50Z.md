# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-07T11:10:50Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/42366987784
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10756 · total: 6.74 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 79 Mo
WAL: 10748 objets · 6826 Mo
upload le plus ancien: 2026-10-31T00:00:22.366000+00:00 · plus récent: 2026-11-07T11:05:21.787000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 16.03 Mo/min ≈ 22.5 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=42030 échecs=0 dernier_ok=2026-11-07 11:10:17.872455+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1111348 | 1106866 | 141 | devices | 376 kB
609472 | 609072 | 256 | line_quality | 768 kB
604378 | 603753 | 24 | routers | 1168 kB
540255 | 526188 | 934 | hotspot_users | 4024 kB
479447 | 453840 | 73 | sessions | 216 kB
462055 | 462055 | 18 | health_checkpoint | 64 kB
205776 | 244 | 166 | commands | 7328 kB
84724 | 81166 | 13 | traffic | 264 kB
52263 | 52255 | 28 | settings | 704 kB
38238 | 38219 | 30 | volume_days | 200 kB
2814 | 2812 | 7 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2879 fichiers
last_run=2026-11-07T11:10:27Z
new=5 skip=2878 fail=0 disk=30%
Sat 2026-11-07 11:15:00 UTC  4min 11s Sat 2026-11-07 11:10:09 UTC      39s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
