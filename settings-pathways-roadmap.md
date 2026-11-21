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

## `SP2` — one Settings hub + per-alert push switches

`workout-settings.html` becomes the one Settings page: today's groups, plus
Notifications (with a switch per alert type), Diagnostics, Report a problem
and Repair moved out of the account sheet. The account sheet keeps account
actions and links here. Each section gets an anchor (`#notifications`,
`#diagnostics`) so a push or a link can open it.

**Decision needed at the check-in:** where per-alert preferences live.
`mc_prefs_v1` is device-only, a PR push is sent from the client and the
check-in from the server. The options are a synced store that `weekly-checkin`
reads (as it already reads `mc_body_v1`), or a column on `push_subscriptions`
(per device, needs a migration the owner applies).

## `SP3` — display & accessibility

In the Settings hub, per device: density (comfortable / compact), Reduce
motion (alongside the phone's own setting), and larger text. Tokens only, so
`check-design-tokens.js` keeps holding; the 48px / 13px session floor is a
minimum the larger text may only raise.

## `SP4` — made-up athlete fixture

One invented athlete (programs, finished workouts, set log, body and macro
entries) loaded into `localStorage` before any page script runs, for
screenshots and the browser gates. A gate fails if any fixture value equals
real data. No demo mode in the app itself.
