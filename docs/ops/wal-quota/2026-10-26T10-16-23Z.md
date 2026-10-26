# wal-quota — dernier diagnostic automatique

- Mesuré : 2026-10-26T10:16:23Z
- Run : https://github.com/ftechnologies18/403shield/actions/runs/40305933905
- Lecture : git fetch + docs/ops/wal-quota-latest.md (aucune API REST requise, N°297)

```text
═══ N°296 — wal-quota : diagnostic bucket mikcloud-wal ═══
═══ 1. Bucket (source de vérité) ═══
objets: 10671 · total: 7.73 Go (plafond gratuit: 10 Go)
basebackup: 8 objets · 77 Mo
WAL: 10663 objets · 7836 Mo
upload le plus ancien: 2026-10-19T00:00:14.045000+00:00 · plus récent: 2026-10-26T10:10:25.972000+00:00
--- policy lifecycle active ---
[{"action":"DELETE","is-enabled":true,"name":"expire-7d","object-name-filter":null,"target":"objects","time-amount":7,"time-unit":"DAYS"}]
═══ 2. Production WAL réelle (mesure 60 s) ═══
WAL brut mesuré: 15.94 Mo/min ≈ 22.4 Go/jour BRUT
--- réglages WAL actuels ---
archive_mode | on | 
archive_timeout | 60 | s
checkpoint_completion_target | 0.9 | 
checkpoint_timeout | 900 | s
max_wal_size | 4096 | MB
wal_compression | zstd | 
wal_segment_size | 16777216 | B
--- pg_stat_archiver ---
archivés=24713 échecs=0 dernier_ok=2026-10-26 10:15:46.15872+00 dernier_ko=—
═══ 3. Top tables réécrites (upd | hot | dead | table | taille) ═══
640321 | 636554 | 133 | devices | 328 kB
387388 | 386774 | 29 | routers | 1168 kB
381323 | 381096 | 228 | line_quality | 584 kB
346607 | 336964 | 772 | hotspot_users | 3992 kB
307009 | 289893 | 38 | sessions | 208 kB
288983 | 288983 | 11 | health_checkpoint | 64 kB
128068 | 147 | 1152 | commands | 7248 kB
52999 | 50866 | 17 | traffic | 328 kB
28330 | 28322 | 35 | settings | 704 kB
23333 | 23323 | 19 | volume_days | 152 kB
1752 | 1751 | 9 | vpn_peers | 96 kB
133 | 133 | 2 | admin_users | 80 kB
═══ 4. pg_stat_statements — top émetteurs WAL cumulés ═══
pg_stat_statements indisponible
═══ 5. Local / timers / disque ═══
WAL local en attente d'upload: 2880 fichiers
last_run=2026-10-26T10:15:26Z
new=5 skip=2879 fail=0 disk=25%
Mon 2026-10-26 10:20:00 UTC 3min 38s Mon 2026-10-26 10:15:08 UTC      1min 13s ago mikcloud-wal-upload.timer      mikcloud-wal-upload.service
/dev/sda1        48G   12G   36G  25% /
289M	/var/lib/postgresql/18/main/pg_wal
═══ DIAGNOSTIC TERMINÉ — aucun changement appliqué ═══
```
