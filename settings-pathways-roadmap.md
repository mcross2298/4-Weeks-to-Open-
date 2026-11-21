# Settings & pathways roadmap (`SP1`–`SP4`)

Opened 2026-11-21. A review of how the household finance app connects its
screens (a feature registry, typed push routing, route aliases, one
notifications hub and one Settings screen), set against this app, and the
patterns the owner chose to bring over. Decided with the owner across two
`AskUserQuestion` rounds.

## Decisions on record (owner, 2026-11-21)

- **Bring over:** typed push routing, one Settings hub, display &
  accessibility settings, a made-up athlete fixture.
- **Not now:** a notifications hub with a badge, a weekly training review,
  URL-held Home sheets, Home "settings checks", and a redirect table for moved
  pages. Recorded so a later pass does not re-propose them as new.
- **Port the pattern, not the file.** Each app keeps its own copy; no shared
  module and no new cross-repo drift gate. The finance app is private.
- **`SP1` first.** Each later phase opens with its own `AskUserQuestion`
  check-in, per the multi-phase rule.

## What the review found

| Finance pathway | This app today |
|---|---|
| A push carries a `type`; one router (`push-route.js`) decides where a tap opens, shared by the service worker and a test | Every push carries only a title and body. `sw.js`'s `notificationclick` always opens `dashboard.html`: a new PR, a streak and the weekly check-in all land in the same place |
| Each alert can be switched off on its own (`notifyPush[key]`, unset is on, each sender checks its own key) | One Notifications switch in Workout Settings |
| One Settings screen with sections | Workout switches on `workout-settings.html`; Diagnostics, Repair and Report a problem in the account sheet; Keep screen on has moved between them once already |
| Design: Day/Night looks, density, reduce motion, per device | Light/dark only |
| A fictional household fixture and harness: screenshots and gates never use real data | Gates seed their own fixtures one test at a time; no shared made-up athlete |

## `SP1` — typed push routing ✅ shipped (2026-11-21)

- `mc-push-route.js` (`MC_PUSH_ROUTE.route(payload)`): one function decides
  where a tapped push opens. `sw.js` loads it with `importScripts` and
  `tools/test-mc-push-route.js` runs the same file, so the routing the test
  checks is the routing a phone gets.
- Types: `pr` opens History (`workout-logs.html`), `checkin` opens Stats,
  `streak` opens Home. An unknown type or none opens Home, which is what every
  push did before. A `pr` tap focuses an already-open window instead of
  navigating it, because a PR fires mid-session and a tap must never pull the
  athlete off the workout in front of them.
- Senders add the type: `mc-setlog.js` (PR), `dashboard.html` (streak) and
  `weekly-checkin` (check-in). `push-notify` forwards `type` from an
  allowlist and drops anything else. Each type gets its own notification
  `tag`, so a check-in no longer replaces an unread PR.
- **Order does not matter.** Before the Edge Functions are redeployed, pushes
  arrive with no type and open Home, exactly as today.
- Not done: opening a specific exercise's trend. Neither History nor Stats
  reads a URL parameter yet; that is its own change.

## `SP2` — one Settings hub + per-alert push switches ✅ shipped (2026-11-21)

**Decision (owner, 2026-11-21): a synced store.** `mc_notify_v1`
(`{ pr: false }`, unset is on) syncs per key (`dictBase`), so muting PRs on one
phone and the check-in on another both hold.

- `workout-settings.html` is **Settings** (same file, so the rest row's link
  and bookmarks still land): the workout switches, then Notifications (the
  permission switch, unchanged), **Which pushes** (one switch per push type,
  staged with Save changes like the rest), and **Help** (Report a problem,
  Diagnostics). Sections carry anchors: `#notifications`, `#alerts`, `#help`.
- **Every sender honours the switch.** `mc-supabase.js`'s `sendPush()` skips
  a muted type before calling out; `push-notify` reads the synced copy and
  answers `muted`, for a phone that has not pulled the change yet;
  `weekly-checkin` reads it beside `mc_body_v1` and counts the user as
  `muted`. Unset or unsynced means on, so nobody loses a push by default.
- **Diagnostics moved out of the account sheet.** Settings opens it through
  `MC_ACCOUNT.openDiagnostics()`, as the account sheet's own dark panel, so
  nothing was restyled onto the page. The account sheet keeps account,
  appearance, install and backup, and one row into Settings.
- `tools/test-mc-push-route.js` holds Settings' switches equal to
  `MC_PUSH_ROUTE.TYPES` and checks each sender's mute.

Not done: a sync on the Settings page itself. It does not load `mc-sync.js`
(a pull's one-shot reload would throw away an unsaved form), so a change
reaches the account the next time Home syncs. Until then the client check
covers the phone it was made on.

## `SP3` — display & accessibility ✅ shipped (2026-11-21)

- **Appearance moved into Settings** (`#appearance`): Theme (dark/light),
  Spacing (Default / Compact / Spacious), Text size (Default / Larger),
  Accent colour, and **Reduce motion**. Staged with Save changes like the
  rest of the page. The account sheet's Appearance section is gone.
- **The choices now reach every page.** They lived in `mc-theme.js`, which
  only 14 of 145 pages load, so a density chosen on Home never reached a
  workout. The head boot (`tools/apply-head-contract.py`) now reads
  `mc_personal_theme_v1` before first paint and sets `data-density`,
  `data-motion="off"` and `data-text="large"` on every page, known values
  only (`tools/test-head-boot-guard.js` SP3a–d). **Accent stays on the pages
  that load `mc-theme.js`** (Home, History, Stats, the builders): applying it
  everywhere would repaint pages that carry a program's own colour.
- **Larger text** steps the whole `--fs-*` scale up about 15% in `base.css`.
  Measured at 390px, it reaches 100% of the text on Settings, 78% on a
  Modality Matrix day, 68% on Kitchen Sink, 56% on Home and **33% on
  History**; the rest is written as px literals and does not move. No page
  overflowed. Tokenizing those literals is its own change.
  **History and workout detail, done (2026-11-21).** The 33% was measured on
  an empty History; with the made-up athlete loaded it was **3%** (6 of 200
  text runs) and workout detail 12%. All 50 `font-size` literals on the two
  pages are now tokens — exact at today's size (19/22/26px became
  `calc(var(--fs-…) + Npx)`), so default-size rendering is identical, checked
  element by element. Larger text now reaches every text run on both pages
  except the bottom-nav labels, on purpose: five labels share a phone-width
  bar and grew into being cut off at 320px, so they read a new fixed
  `--fs-nav` (11px) that Larger text does not step. "Conditioning" is already
  cut off at default on 320–360px screens; that is older and unchanged.
- **Larger text with Compact** first came out *smaller* than default (an
  exercise name went 15px → 13.9px, because compact multiplies by 0.82).
  Together they now use a 0.9 density, so text never ends below default.
- **Reduce motion** uses `base.css`'s existing `data-motion="off"` rule, and
  the three smooth scrolls that read only the phone's setting now read the
  switch too. The rest-over green flash keeps a static wash with motion off,
  as it already did under the phone's own setting.

## `SP4` — made-up athlete fixture ✅ shipped (2026-11-21)

- `tools/fixture-athlete.js` (`athlete(today)`): 12 finished workouts over four
  weeks across two programs, a bodyweight trend, macro goals with a week of
  food, and an active program — generated from the date and a fixed seed, so
  one day always gives the same athlete. Program pages and exercise names are
  the app's own content; every number is invented.
- `tools/fixture-harness.js`: loads it into `localStorage` before any page
  script, blocks the service worker and every outside host, and `openRoute()`
  refuses a page whose saved log is not the fixture's. From the command line:
  `node tools/fixture-harness.js <baseUrl> <page> --width 390 --out shot.png`.
- `tools/check-fixture.js` (CI, static and browser): every fixture key is a
  declared store, the app's own `MC_LOG` reader returns all 12 workouts with
  their sets, and Home, History, Stats and Settings render it with no page
  error and no sideways overflow. Proven to fail on an undeclared store and on
  a workout with no sets.
- **Not ported from the finance app: "no fixture value may equal a real one."**
  That app keeps its household's real figures in its repo; this one keeps
  none (training lives on the phone and in Supabase), so there is nothing to
  compare against, and comparing against Supabase from CI would put real data
  on a test path.
- **It found a real bug on its first render.** History filed every Strength &
  Supersets workout under **Individual / Standalone**: programs were matched by
  id prefix (`ss-…`, `cat-ss…`), but that program is trained on its landing,
  `cat-strength`. `workout-logs.html` and `workout-detail.html` now also match a
  program's own `href`; the gate checks History files every fixture workout
  under a program, and fails on the old code.

