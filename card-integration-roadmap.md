# Card Integration Roadmap — S0–S6

**Status:** in progress · **Opened:** 2026-08-19

Governs the merged execution of two audits taken on the same day against the
same page (`mm-p1.html`), which turned out to be the same subject measured on
two different axes:

- **the runtime waste audit** — TIMWOODS, 16 findings, 17 actions `A-1…A-17`,
  measuring *work per second* during an active session;
- **the card UX council report** — 5 recommendations `R1…R5`, 4 phases,
  measuring *pixels per exercise* on real iPhone viewports.

Full integration review, interaction register and per-item apply order:
<https://claude.ai/code/artifact/82d23f33-d8ee-4722-bcc0-b6b5cffbde9b>

Per the planning rule at the top of `CLAUDE.md`, that artifact plus this entry
are sufficient direction to implement S0–S3; S4 carries an `AskUserQuestion`
gate and S5 needs explicit owner sign-off.

---

## Why they had to be merged

Seven proposals collide. The three that changed the plan:

1. **`R4` deletes `.a-reps`** — the container of the `.a-rep` spans whose
   no-op class writes were `A-1`'s target, and a live set-by-set progress
   indicator (`.a-rep.live`, with its own reduced-motion rule and light-theme
   palette) that the UX report assessed as a static restatement of "5×5"
   because at rest that is what it looks like. Emitted by `mm-engine.js` and
   `mc-pmc-engine.js`, so the blast radius is fleet-wide, not per-page.
2. **`A-7` gates `R3`.** `restoreSets()` writes `.done` classes without
   calling `updateCount()`, and `updateCount()` is the only writer of the
   collapsed strip's set count. Today that is cosmetic — the strip only
   appears on finished cards. Under `R3` the strip becomes the resting state
   of every card, so a mid-session reload would leave nine of ten cards
   reading `0/5 Sets`.
3. **`R3` and `A-14` are one change.** `R3` hides siblings in CSS, so it buys
   the height win and none of the runtime win; `A-14` defers the build, so it
   buys the runtime win and no height change for the open day. Fused: *a
   collapsed card is a card whose logger has not been built yet.*

## Decisions (locked 2026-08-19)

| # | Question | Decision |
|---|----------|----------|
| 1 | Does `.a-reps` stay? | **Keep it, shrunk** — collapse into the header pill's slot rather than delete, so the live glow survives at a smaller size. Take `A-1`'s guard regardless; it also serves `.ss-ex` superset units. |
| 2 | Reverse the no-accordion decision (`base.css`)? | **Yes** — but only fused with `A-14`, and only after S2. The original call was made when a card was ~150 px; it is 328 px now. |
| 3 | Which store is authoritative for set history? | **Keep the `workout_logs` rows; drop `mc_setlog_v1` from the sync whitelist.** Rows already carry per-set granularity, and localStorage stays the system of record either way. |
| 4 | Ghost prefill vs the light-mode contrast ratchet | **Carry the ghost state on the dashed underline and italic**, opacity no lower than the ratchet's floor. A prefill the athlete cannot read is worse than no prefill. |

## Sequence

`mc-setlog.js` is edited in five of the six code steps, and `mc-setlog.css`,
`mc-rep-progress.js` and `mc-session.js` in three each — so this runs as one
serial chain, one PR at a time. The only contention-free items (`A-6`, `A-9`,
`A-5`, `A-12`) can float.

| Step | Contents | Gate | State |
|------|----------|------|-------|
| **S0** | `tools/measure-session.js` + committed baseline | none | ✅ shipped |
| **S1** | `A-1` `A-2` `A-3` `A-4` `A-6` + `R1` `R5` | none | ✅ shipped |
| **S2** | `A-7` `A-10`+§3.3 `A-5` `A-8` `A-9` | none — **gates S5** | next |
| **S3** | `R2` + the self-opening logger (`A-11`/`M-1`/§3.4) | none | |
| **S4** | `R4` header consolidation + `A-17` `defer` sweep | `AskUserQuestion` | |
| **S5** | `A-13` render signal → `A-14` lazy build → `R3` collapse | explicit sign-off | |
| **S6** | `A-15` CI budget, `A-12` vendored SDKs, `A-16` delta sync | none | |

### Ordering rules this encodes

1. **Delete before you optimise.** `R1` removes a per-card injection from the
   same loop `A-4` memoises.
2. **Measure between `A-1` and `A-2`.** They attack the same feedback loop from
   opposite ends; landed together, neither can be attributed, and `A-15`'s
   thresholds depend on knowing.
3. **Persistence before presentation.** `A-10` defines the stored shape;
   §3.3's ghost is a state that must never reach it.
4. **Budgets last, seeded from measurement.** A gate seeded from ambition
   fails on the first honest PR and gets disabled.

### Naming

`A-13` is the **render signal** (`mc:cards-rendered`), *not* "the render
contract" — that name already belongs to the completed Volume II Phase 4
initiative that collapsed six `makeRestTimer` bodies onto one implementation
(commit `242c9f5`). Reusing it would make the history unreadable.

---

## S0 shipped (2026-08-19)

`tools/measure-session.js` — one harness for both audits' questions, because
they share a page load, an interaction script and (at S6) a CI budget.
Counts mutation records **as delivered to the app's own observers** rather
than as emitted by the DOM: one attribute write reaching eleven body-scoped
observers is eleven units of work, and that ratio is what this sequence
attacks. Sampled in an explicit window with an idle control window on the
same page, so boot cost never leaks into a steady-state number.

Reproduced both audits' published figures before any change: 3,607 elements
and 172 set rows built at load with zero cards visible; a 595.9 px active card
(71% of 390×844, 89% of the 375×667 SE floor); the five sub-44 pt controls.

## S1 shipped (2026-08-19)

| per second, rest timer running | before | after | |
|---|---:|---:|---|
| mutation records delivered | 2983.8 | **35** | −99% |
| observer callbacks | 55.4 | **14** | −75% |
| `querySelectorAll` | 1061.6 | **289.9** | −73% |
| `localStorage` reads | 1927.3 | **26** | −99% |
| controls under 44 pt | 5 | **0** | |
| elements at load | 3607 | **3327** | −280 |

`A-1` landed and was measured alone first: **−98% of records on its own**,
confirming the feedback-loop diagnosis rather than assuming it. `A-2` took a
further −37% of what remained.

`A-3` rewrote two persistence-key functions, so the new and old algorithms
were compared card-by-card in a browser before landing — **identical output on
216 cards across 9 pages**.

**Honest cost:** the active card grew 595.9 → 624 px and the inactive card
328 → 341.6 px. `R5` spends height by design; S3/S4/S5 repay it. An
accessibility defect does not wait for a density win.

**Still open, as expected at this stage:** typed weights remain volatile until
the checkbox is tapped (`D-5`) — reproduced during verification, fixed in S2.
