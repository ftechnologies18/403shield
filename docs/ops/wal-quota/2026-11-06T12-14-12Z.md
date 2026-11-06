# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-11-06T12:14:12Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/42215957148
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10821 · total: 6.76 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 78 Mo
WAL: 10813 objets · 6847 Mo
upload le plus ancien: 2026-10-30T00:00:18.495000+00:00 · plus récent: 2026-11-06T12:10:27.369000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.78 Mo/min ≈ 22.2 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=40654 échecs=0 dernier_ok=2026-11-06 12:13:42.88749+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
1061110 | 1056713 | 153 | devices | 368 kB
587301 | 586916 | 211 | line_quality | 768 kB
581867 | 581243 | 25 | routers | 1168 kB
517092 | 503441 | 1025 | hotspot_users | 4024 kB
458508 | 433842 | 55 | sessions | 208 kB
447947 | 447947 | 10 | health_checkpoint | 64 kB
198008 | 240 | 1128 | commands | 6720 kB
81704 | 78297 | 22 | traffic | 288 kB
50359 | 50351 | 42 | settings | 704 kB
36974 | 36955 | 29 | volume_days | 200 kB
2772 | 2770 | 7 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2883 fichiers
last_run=2026-11-06T12:10:27Z
new=5 skip=2879 fail=0 disk=30%
Fri 2026-11-06 12:15:00 UTC       49s Fri 2026-11-06 12:10:09 UTC  4min 1s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   14G   34G  30% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
