# PM Mode — Operator Playbook

A short field guide for the owner. PM Mode is the owner-only editor that paints
permanent program/exercise/split/badge customizations on top of the static
workout HTML. Normal users never see any of it.

## Unlock

1. Open any page with `?pm=1` (e.g. `dashboard.html?pm=1`).
2. Sign in with the owner email + password (Supabase). Writes are owner-only,
   enforced server-side by Row-Level Security — this is the real boundary.
3. Optionally enroll Face ID / Touch ID (per-device, per-session gate).

When unlocked you get the fixed **PM bar** and a "Program Manager edit" item in
each exercise card's ⋮ menu.

## What you can rename, and where it applies

| Entity | Edit from | Scope |
| --- | --- | --- |
| Exercise (this split only) | card ⋮ → Program Manager edit | the current page |
| Exercise (everywhere) | same modal, tick **"Rename in ALL programs & splits"**, or Rename Center → Exercises | all pages |
| Program name / icon / description | Rename Center → Program | dashboard + cat page |
| Split name | Rename Center → Splits | dashboard chips + split hub |
| Badge label / color | Rename Center → Badges (This program / All programs) | matching chips + legend |

**Precedence (what actually shows):** split-level exercise name → global
exercise name → original. The exercise modal's tier indicator tells you which
is in effect. Originals are never overwritten — renames are paint, so Reset
always restores the authored name and historical logs stay keyed to originals.

## PM bar buttons

- **Publish** — shows a review sheet of every pending change, then pushes to
  Supabase. Live for all users within ~1 minute (no redeploy).
- **Names** — opens the Rename Center (programs, splits, badges, global
  exercises) with a filter box; remembers the last program you edited.
- **Find** — jump straight to renaming any catalog exercise globally, without
  hunting for a page that shows it.
- **Preview** — paint the published layer only, hiding your unpublished working
  copy, so you see exactly what users see. Toggles off on Lock. View-only:
  Export/Publish still use your full working copy.
- **Export / Import** — download / load the `program-overrides.json` working
  copy (offline fallback + manual backup).
- **Discard** — drop ALL unpublished local edits (published overrides
  unaffected). Confirmed via dialog.
- **Lock** — leave PM Mode for this session.

## Working copy → published

Edits land in a local working copy (instant preview). **Publish** promotes them
to Supabase for everyone. The committed `program-overrides.json` is the
offline/fallback copy. There is currently **no one-click rollback** of a
published change — to revert, edit it back (or Reset) and Publish again. (A
published-history + revert feature is roadmap item H1.)

## Deploy model — do NOT hand-edit the public repo

- `4-Weeks-to-Open-` is the **master**. Pushing to its `main` triggers
  `market-deploy.yml`, which runs the leak/syntax/resolver hard-gates and then
  **force-pushes a clean build to `MC-Training-Rolodex`**.
- `MC-Training-Rolodex` is therefore **generated** — never commit to it by
  hand. Edit the master and let the pipeline deploy. (Locking Rolodex `main` to
  the deploy bot is roadmap item G6; see `tools/g6-rolodex-branch-protection.md`.)

## If something looks wrong

- A program-scoped badge/split rename not showing on a page? Check the page
  resolves to a program — `MC_NAMES.progOf('<page>.html')`. Catalog pages and
  split hubs are mapped explicitly; coverage is asserted by
  `tools/test-naming.js`.
- Publish failed with a permission error → the signed-in account isn't in the
  `admins` table yet.
- Validate the committed fallback locally: `python3 tools/validate-overrides.py`.
