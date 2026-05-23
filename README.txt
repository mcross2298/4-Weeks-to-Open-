README — Run in order, one at a time.

1. python 1-infra-deploy.py     (4 files  — sw.js + homepage + Exercise Library)
2. python 2-pump-deploy.py      (18 files — pump fixes + next batch features)
3. python 3-mc-deploy.py        (32 files — MC splits)
4. python 4-pmc-deploy.py       (40 files — PMC splits)
5. python 5-rest-deploy.py      (29 files — Gainz, STNDR, Faint, PSU)

After all 5: close app, wait 2 min, reopen.

NEW IN THIS BUILD:
- Pump timer fix (all 16 files verified passing simulation)
- Progress bar wired to render()
- Exercise Library (1020 exercises, muscle group filter, search)
- Replace Exercise (long-press any exercise card → library opens)
- Workout history log on homepage
- Streak tracker on homepage  
- Weight/notes per exercise card
- Next workout shortcut (26 pages)
