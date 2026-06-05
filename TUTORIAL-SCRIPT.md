# MC Training — Quick Tour: Video & Slide Production Script

**Format:** 12 modules. Each = a high-level visual slide **+** step-by-step on-screen actions.
**Tone:** Motivating + practical (gym-coach energy, clear and actionable).
**Audience:** Mobile-first lifters of mixed comfort levels — beginner-safe, never condescending.
**Hosted at:** `quick-tour.html`, launched from the gold **🎬 Quick Tour** tile on the dashboard.
**Runtime target:** ~3–3½ minutes (≈15–20s narration per module).

> **How to use this doc:** The left column is what shows on screen / the screen-capture clip to record.
> The right column ("Coach VO") is the narration, written to match the in-app `quick-tour.html` copy.
> Each module maps 1:1 to a slide in the tour, so the video and the in-app tour stay in sync.

---

## 🎬 Module 0 — Welcome (Cover)

**On screen / B-roll:** App icon → dashboard fades in. Glyph 💪. Caption: *"7 programs · 450+ exercises · full set & PR tracking."*

**Coach VO:**
> "Welcome in. Whether you came to lift heavy, chase a pump, or build your own session — everything lives one or two taps from your dashboard. This'll take about three minutes. Let's go."

**On-screen steps shown:**
1. Navigate with **Next / Back**, the dots, or swipe.
2. Tap any gold **"Open it"** card to jump into the real screen.
3. **Skip** anytime — relaunch from the dashboard's **Quick Tour** tile.

---

## ⚡ Module 1 — Your Dashboard at a Glance

**On screen:** Slow pan down the dashboard: topbar → hero card → tools grid → bottom tab bar. Highlight each zone with a soft gold outline.

**Coach VO:**
> "Start at the top: your Current Program hero card. Below it, the Training Tools grid — Library, Logs, Build Your Own, Program Guide, and this tour. And pinned to the bottom: Dashboard, Programs, and Conditioning. That bar follows you everywhere."

**Steps:**
1. **Top — Current Program:** the program you've pinned shows here with its splits.
2. **Middle — Training Tools:** your 2×2 grid of power tools.
3. **Bottom tabs:** ⚡ Dashboard · 🏋️ Programs · 🔥 Conditioning.

**💡 Tip:** On any screen, the bottom bar brings you home — you can't get lost.

---

## 📌 Module 2 — Pin Your Current Program

**On screen:** Tap **"See all"** → bottom sheet slides up → tap a program (checkmark animates) → **Set as Active Program** → hero card updates with split chips.

**Coach VO:**
> "See that hero card at the top? Tap 'See all,' and a sheet slides up with all seven programs. Pick the one you're running, hit Set as Active Program, and it pins to your dashboard — split chips and all. Change it anytime; it remembers your choice."

**Steps:**
1. Tap **See all** (top-right of Current Program).
2. Tap a program — the checkmark confirms.
3. Tap **Set as Active Program**. Hero card updates instantly.

**In-app CTA:** *Open the dashboard & pin a program* → `dashboard.html`

---

## 🏋️ Module 3 — Browse Programs & Open a Workout

**On screen:** Tap 🏋️ Programs → scroll the 7 color-coded category cards → tap **Daily Pump** → tap a split → workout page loads with exercise cards.

**Coach VO:**
> "Tap Programs on the bottom bar. You'll see seven color-coded categories — Strength & Supersets, STNDR, Daily Gainz, Daily Pump, PSU Football, Project Muscle Confusion, and Mike Cross' Favorites. Tap one, pick a split, and you're on the workout page with every exercise laid out."

**Steps:**
1. Tap **🏋️ Programs** in the bottom bar.
2. Tap a **category card** to see its splits.
3. Pick a **split / day** to open that workout.

**In-app CTA:** *Browse all 7 programs* → `dashboard.html?tab=programs`

---

## ✅ Module 4 — Log Your Sets + Rest Timer ⭐ *(core skill)*

**On screen:** Exercise card → tap **Log Sets** → type weight + reps → tap ✓ → row turns gold, **rest timer auto-starts** and counts down. Show the **"Last: X lb · date"** cue. Briefly reveal a **+ DROP / + AMRAP** row.

**Coach VO:**
> "This is the heartbeat of the app. On any workout, tap 'Log Sets' under an exercise. Punch in your weight and reps, then tap the check. Two things happen: the set locks in, and your prescribed rest timer kicks off automatically. Last time's top weight shows right on the card, so you always know what to beat. Drop sets and AMRAP rows are built in too."

**Steps:**
1. Tap **Log Sets** on an exercise card.
2. Type your **Weight** and **Reps**.
3. Tap the **✓** checkbox — set saves, **rest timer auto-starts**.
4. **+ DROP / + AMRAP** rows appear when the program calls for it.

**💡 Tip:** The card shows **"Last: X lb · date"** — your built-in cue to progressively overload.

---

## ⋮ Module 5 — The Meatball (⋮) Menu: Customize Any Exercise

**On screen:** Tap the **⋮** in an exercise card's top-right → bottom sheet opens with **Replace / Reorder / Add Tempo / Notes**. Demo each: Replace → Library opens; Reorder → ▲/▼ shuffle a card; Add Tempo → pick `3:1:1:0`, a tempo pill appears; Notes → type a note, it saves on the card with a dot on the ⋮.

**Coach VO:**
> "See the three dots in the corner of every exercise? That's your control panel. Tap it and you can swap an exercise you can't or don't want to do, reorder your lineup, dial in a lifting tempo, or jot a note to your future self. Every change saves to that workout automatically."

**Steps:**
1. On any exercise card, tap the **⋮** (top-right).
2. **🔁 Replace exercise** — opens the Library to swap in a different movement.
3. **↕️ Reorder exercises** — use the **▲ ▼** arrows; your order sticks.
4. **⏱️ Add Tempo** — pick an *eccentric : pause-bottom : concentric : pause-top* cadence; it shows as a pill.
5. **📝 Notes** — leave a per-exercise note saved right onto the card.

**💡 Tip:** A small dot on the **⋮** flags an exercise with a saved **note or tempo** — everything persists per workout, on your device.

*(Tempo can be disabled per page via `window.MC_TEMPO_ENABLED = false`; default options come from the STNDR notation.)*

---

## 🏆 Module 6 — Finish Workout, PRs & Live Summary ⭐ *(core skill)*

**On screen:** First set check-off → sticky stat strip animates in (timer + sets-done). Tap **Summary** → live session card expands. Tap **Finish Workout** → confirmation, PR flagged with gold 🏆.

**Coach VO:**
> "The moment you check your first set, a timer and a sets-done counter come alive at the top. Tap Summary anytime to see your session take shape. When you're done, hit Finish Workout — the app saves the session, counts your sets, and flags any personal records you just set. That's how PRs get earned."

**Steps:**
1. Check off sets — the **sticky stat strip** tracks duration + total sets live.
2. Tap **Summary** to expand your in-progress session card.
3. Tap **Finish Workout** — **PRs detected and saved automatically**.

**💡 Tip:** Beat a previous best and it's tagged with a gold **🏆 PR** in your logs.

---

## 📊 Module 7 — Workout Logs & Progress

**On screen:** Dashboard → 📊 Workout Logs tile → three-stat bar (Workouts · Sets Logged · PRs Set) → scroll dated history cards with weights and PR tags.

**Coach VO:**
> "From the dashboard, open Workout Logs. Up top: three running totals — workouts, sets logged, and PRs set. Below, every session by date with the weights you actually moved. This is your proof of work and your roadmap for next time."

**Steps:**
1. Dashboard → **📊 Workout Logs** tile.
2. Read your **three-stat bar**.
3. Scroll your **dated history** — live daily sessions show even before you tap Finish.

**In-app CTA:** *Open your Workout Logs* → `workout-logs.html`

---

## 🔧 Module 8 — Build Your Own Workout ⭐ *(make it yours)*

**On screen:** Build Your Own → name field → search/filter by muscle → tap exercises (they drop into tray) → set sets/reps → **✅ Create Workout** → saved card → **▶ Start Workout** → logs like any program.

**Coach VO:**
> "Want a custom session? Tap Build Your Own. Name your workout, then search or filter 450+ exercises by muscle group. Tap to add each one — they drop into a tray at the bottom where you set sets and reps. Hit Create Workout, and it's saved under My Custom Workouts. Press Start, and it logs sets exactly like every built-in program."

**Steps:**
1. Dashboard → **🔧 Build Your Own** tile.
2. Name it, then **search/filter by muscle** and tap exercises to add.
3. Set **sets & reps** per exercise, tap **✅ Create Workout**.
4. Tap **▶ Start Workout** — full set logging & PRs.

**In-app CTA:** *Build a custom workout* → `build-workout.html`

---

## 📚 Module 9 — Library, Guide & Conditioning

**On screen:** Quick cuts — Exercise Library search/filter & expand a master group → Program Guide list → Conditioning tab (🔥) with cardio/core cards.

**Coach VO:**
> "Quick hits. The Exercise Library lets you search every movement, grouped by muscle, with tap-to-expand variations. The Program Guide explains the rules, set styles, and rep ranges behind all seven programs. And the Conditioning tab — bottom bar, the flame — is where cardio, conditioning, and core finishers live."

**Steps:**
1. **📚 Exercise Library** — search & filter by muscle group.
2. **📋 Program Guide** — methodology, set styles & rep ranges.
3. **🔥 Conditioning** tab — cardio & core, as a finisher or standalone.

**In-app CTA:** *Open the Exercise Library* → `exercise-library.html`

---

## 📲 Module 10 — Install & Train Offline (PWA)

**On screen:** Browser Share menu → **Add to Home Screen** → app icon on home screen → full-screen launch → airplane-mode demo still working → green **🔄 Update available** banner.

**Coach VO:**
> "Last thing. This app installs. From your browser's Share menu, tap Add to Home Screen — it launches full-screen like a native app, and once cached it runs offline. Dead gym signal? Your programs, logging, and PRs keep working. An update banner taps you to refresh when there's something new."

**Steps:**
1. Browser **Share** → **Add to Home Screen**.
2. Launch from the icon — **full-screen, no browser bar**.
3. Train **offline**; tap the green **🔄 Update available** banner when it appears.

**💡 Tip:** Your logs, PRs, and custom workouts are saved **on your device** — private and instant.

---

## 🔥 Module 11 — You're Ready (Wrap-up)

**On screen:** Montage of the 5 core actions, glyph 🔥. Caption: *"Pin · Log · Finish · Review · Build."* End card with **Go to my Dashboard** button.

**Coach VO:**
> "That's it — you're tour-complete. Pin a program, log your sets, finish strong, and watch those PRs stack up. Replay this tour anytime from the dashboard. Now go put in the work."

**You can now:**
- ✓ Pin your Current Program from the dashboard
- ✓ Log sets with weight, reps & auto rest timer
- ✓ Finish Workout to bank your PRs
- ✓ Review everything in Workout Logs
- ✓ Build & run your own custom workouts

**In-app CTA:** *Go to my Dashboard* → `dashboard.html` (marks the tour complete; hides the dashboard "NEW" badge).

---

## Production notes

- **Capturing clips:** Each in-app slide has a `.scene` frame with a "Tour clip" marker — record a short screen-capture per module (portrait, ~720×1280) and it can drop straight into that frame later. Until then the branded still reads as a slide.
- **Sync rule:** If you reword a slide in `quick-tour.html`, mirror it here (and vice versa) so the video VO and the in-app tour never drift.
- **Length control:** To hit ~3–3½ min, keep each VO to 2–3 sentences. The ⭐ core modules (4 Log Sets, 6 Finish/PRs, 8 Build) plus the ⋮ menu (5) can run slightly longer; trim the bonus modules (9, 10) if needed.
- **Accessibility:** Captions = the Coach VO text verbatim. Steps double as on-screen lower-thirds.
