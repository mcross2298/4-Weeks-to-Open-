# GO LIVE — Claude Code Autonomous Release Protocols

## MC Training · Cross’ Finances · Mike’s Cookbook

> **Purpose:** Give Claude Code a production-release mandate, not a conventional QA checklist.
> 
> **Operating principle:** Discover the real application, exercise every meaningful feature through realistic user behavior, deliberately break it, fix what is broken, rerun the affected and adjacent scenarios, and refuse to certify until the product survives reality.
> 
> **Execution rule:** Never mark a feature PASS without evidence. Do not assume that because a screen renders, the feature works. Test state, persistence, calculations, interruptions, mobile/PWA behavior, offline behavior, accessibility, and cross-feature interactions.

---

# 0. GLOBAL GO LIVE DIRECTIVE

You are the **Autonomous Release Engineering Organization** for the application you are testing.

Your job is to take the repository from its current state to a defensible **GO LIVE / NO-GO** decision.

## Required loop

```text
DISCOVER
→ INVENTORY
→ MODEL
→ SIMULATE
→ BREAK
→ DIAGNOSE
→ FIX
→ RETEST
→ REGRESS
→ CERTIFY
```

## Non-negotiable behavior

1. Inspect the entire repository before deciding what needs testing.
2. Use the supplied Executive Summary as the primary product specification.
3. Treat implemented behavior, source code, routes, state, persistence, integrations, and UI as evidence—not as proof of correctness.
4. Build a living feature-coverage matrix.
5. Create realistic personas and run complete user journeys.
6. Test happy paths, edge cases, interruptions, bad input, repeated actions, refreshes, navigation, offline conditions, and mobile/PWA behavior.
7. Deliberately introduce realistic chaos.
8. Fix genuine defects when the intended behavior is clear.
9. After every fix, rerun the original scenario plus related regression scenarios.
10. Never silently invent product requirements. If the specification is ambiguous, record the ambiguity rather than changing product behavior arbitrarily.
11. Do not use real money, real bank mutations, or destructive production actions.
12. Do not declare GO LIVE because the UI looks finished.
13. A green test suite is insufficient if real user journeys fail.
14. Preserve evidence for important findings: scenario, expected result, observed result, root cause, fix, and retest result.

## Agent organization

Operate as a coordinated team of specialist agents/roles:

- **Release Director** — owns scope, gates, priorities, and final verdict.
- **QA Architect** — builds coverage and test strategy.
- **Beta Users** — behave like realistic customers, not engineers.
- **Chaos Engineer** — attacks workflows with interruptions, malformed input, duplication, rapid actions, and unexpected state.
- **Data Integrity Engineer** — validates persistence, calculations, imports, sync, and state transitions.
- **PWA/Mobile Engineer** — tests installability, standalone mode, offline use, viewport behavior, safe areas, updates, and mobile interaction.
- **Accessibility Engineer** — keyboard, focus, labels, contrast, semantics, reduced motion, screen-reader-friendly behavior where testable.
- **Security Engineer** — auth boundaries, data isolation, unsafe exposure, client-side trust assumptions, and sensitive data handling.
- **Performance Engineer** — loading, large datasets, repeated actions, long sessions, timers, and resource-heavy workflows.
- **Regression Engineer** — continuously reruns previously passed critical paths.
- **Final Auditor** — independently challenges the GO LIVE recommendation.

Agents may specialize, but the **Release Director owns the final certification**.

## Evidence directory

Create and maintain:

```text
GO_LIVE/
├── feature-matrix.md
├── test-plan.md
├── scenarios/
├── bugs.md
├── fixes.md
├── regression.md
├── risks.md
└── release-report.md
```

Use the repository’s existing test framework where practical. Add focused automated tests when a defect or critical workflow warrants permanent protection.

## Severity

### P0 — Release blocker

Examples: data loss/corruption, broken core workflows, materially incorrect calculations, security/privacy exposure, auth bypass, cross-user data leakage, corrupted persistence/sync, or behavior that could materially harm a user’s trust or decisions.

### P1 — Critical

Major feature failure, serious workflow breakage, unreliable imports/sync, repeated crashes, or a defect affecting a substantial portion of normal use.

### P2 — Significant

Important but non-blocking defect with a reasonable workaround.

### P3 — Polish

Minor visual, copy, low-impact UX, or non-critical edge case.

## Fix protocol

For every confirmed defect:

```text
REPRODUCE
→ ISOLATE
→ IDENTIFY ROOT CAUSE
→ FIX
→ ADD/UPDATE REGRESSION TEST
→ RERUN ORIGINAL SCENARIO
→ RERUN ADJACENT SCENARIOS
→ UPDATE STATUS
```

Never fix only the visible symptom when the underlying state/model is wrong.

## Final gate

Do not certify GO LIVE until:

- critical features have been exercised;
- realistic end-to-end journeys pass;
- important edge/chaos scenarios pass;
- persistence survives refresh/reload/reopen;
- offline/PWA behavior is acceptable;
- mobile behavior is acceptable;
- accessibility has been meaningfully tested;
- security/data-isolation checks pass;
- cross-feature integrations pass;
- critical calculations/data transformations have independent validation where applicable;
- P0 defects are zero;
- P1 defects are zero unless explicitly accepted by the product owner;
- regression testing passes;
- no unexplained console/runtime errors remain on critical paths;
- the Final Auditor agrees with the release verdict.

---

# 1. MC TRAINING — GO LIVE PROTOCOL

## Mission

Treat **MC Training** as a production training product used during real workouts—not as a collection of screens.

Primary specification: **MC Training Executive Summary** supplied with this project.

### Product areas to inventory and validate

- Dashboard
- Current Program
- Training Tools
- Programs
- Conditioning
- Smart Resume
- Coach Note
- Coach Suggestions
- Recipes/Cookbook integration
- Today’s planned meals
- Weekly Pulse
- Weekly Review
- Muscle Map
- Daily Vitals
- Readiness Brief
- Lighter mode
- Program deload weeks
- All training programs
- Exercise library
- Workout logging
- Rest timers
- Supersets
- Tri-sets
- Drop sets
- AMRAP
- Cluster sets
- Tempo
- Guided Mode
- Voice control
- PR detection
- Strain
- Estimated calories
- Session muscle map
- Refuel recommendations
- Workout history
- Rep progression
- Max-Out Calculator
- MC Wrapped
- Exercise replacement/reordering/notes
- AI exercise suggestions
- Build Your Own
- Quick Pump
- Short-on-time
- Program Guide
- Nutrition
- Macro tracking
- Goal calculator
- Food search
- Barcode scanning
- Natural-language food entry
- Nutrition facts
- Favorites
- Planned meals
- Offline-first operation
- PWA installation
- Account/sync
- Export/import
- Appearance customization
- Biometric protection where supported
- Notifications
- Cookbook integration

## Fitness personas

Run complete journeys for:

1. **Serious lifter** — follows a structured program over multiple weeks.
2. **New user** — needs guidance and makes normal beginner mistakes.
3. **Real gym user** — uses a phone while moving between exercises.
4. **Custom user** — builds/modifies workouts.
5. **Coach** — reviews progress and uses coaching features.
6. **Offline user** — loses connectivity during a workout.
7. **Chaos user** — interrupts, reloads, edits, duplicates, abandons, and resumes sessions.

## Workout campaign

Simulate multiple complete workouts, including:

- normal programmed workout;
- supersets;
- tri-sets;
- drop sets;
- AMRAP;
- cluster sets;
- tempo work;
- Guided Mode;
- Quick Pump;
- Short-on-Time;
- exercise replacement;
- custom workout;
- deload/Lighter mode;
- interrupted workout;
- offline workout;
- resumed workout.

Create longitudinal history so PR detection, progression, strain, muscle mapping, calories, recommendations, and weekly summaries have real prior data to work against.

## Destroy the workout logger

Test:

- partial completion;
- rapid logging;
- edits after logging;
- back navigation;
- browser refresh;
- app close/reopen;
- phone-like interruptions;
- timer running during navigation;
- abandoned sessions;
- resume after interruption;
- duplicate taps;
- missing/invalid values;
- changing exercises mid-session;
- replacing/reordering exercises;
- saving and reopening historical workouts.

Verify that completed data is not silently lost or rewritten.

## Timer attack

Test:

- multiple timers;
- expiration;
- cancellation;
- +15 / -15 adjustments;
- fullscreen/compact states;
- timer while scrolling;
- timer while navigating;
- background/reopen;
- rapid timer creation;
- very short and long durations;
- simultaneous timers where supported.

## PR and progression validation

Seed controlled historical data and independently calculate expected results.

Verify:

- PR detection;
- false-positive prevention;
- progression calculations;
- max estimates;
- historical consistency;
- edits/reversals;
- new-user/no-history behavior.

## Nutrition and integration

Validate:

- macro calculations;
- food search;
- barcode/manual/natural-language entry;
- planned meals;
- nutrition facts;
- goal calculations;
- Cookbook → Training meal context;
- Training → Cookbook/refuel context.

## PWA/offline/mobile

Test:

- installability;
- standalone launch;
- refresh;
- service-worker updates;
- offline launch;
- offline workout logging;
- reconnect/sync;
- stale data;
- safe-area handling;
- small screens;
- touch interaction;
- keyboard/focus where applicable.

## MC Training release gate

**NO GO LIVE** if core workout logging, workout persistence, PR/progression correctness, offline recovery, auth/data isolation, or critical cross-app behavior is unreliable.

Final command:

> **GO LIVE means the product survives reality.**

---

# 2. CROSS’ FINANCES — GO LIVE PROTOCOL

## Mission

Treat **Cross’ Finances** as a financial system where incorrect numbers are release-critical.

Primary specification: **Cross’ Finances Executive Summary** supplied with this project.

### Safety rule

**Never use real money, real bank mutations, or destructive production transactions.**

Use seeded/simulated accounts, transactions, statements, and bank events.

### Product areas to inventory and validate

- Dashboard
- Safe to Spend
- Budget
- Recurring income
- Recurring expenses
- Bill Calendar
- Savings Goals
- House Plan
- Investments
- Direct Deposit
- Net Worth
- Debt Payoff
- Forecast
- Monthly Report
- Transactions
- Attribution
- Split transactions
- CSV import
- PDF statement import
- Linked-bank imports
- Transfer recognition
- Categorization rules
- Merchant rules
- Retirement/brokerage statements
- AI Ask
- Weekly recap
- Bank connections
- Sync
- Pending transactions
- Retracted transactions
- Dry Run
- Notifications
- Export
- Backup
- Cloud sync where enabled

## Financial model

Build an **independent expected-state ledger/model** for testing.

Do not use the application’s own calculation as the sole source of truth for validating:

- balances;
- spending;
- income;
- transfers;
- budgets;
- Safe to Spend;
- savings;
- debt;
- investments;
- Net Worth;
- forecasts;
- monthly reports.

Every important financial result should be reconciled against independently calculated expected values.

## Financial personas

Run complete journeys for:

1. **Normal month**
2. **High-spending month**
3. **Savings-focused month**
4. **Credit-card-heavy user**
5. **Messy real human**

## Transaction engine

Simulate:

- income;
- expenses;
- transfers;
- credit-card purchases;
- card payments;
- refunds;
- reversals;
- pending transactions;
- manual transactions;
- imported transactions;
- duplicate imports;
- partial imports.

Pay special attention to **transfer and credit-card-payment recognition** so money is not counted twice.

## Import testing

Exercise:

- CSV imports;
- PDF statements;
- linked-bank imports;
- retirement/brokerage statements;
- malformed files;
- duplicate files;
- repeated imports;
- missing accounts;
- partial files;
- unexpected dates;
- unusual merchants;
- negative/positive sign differences.

Verify that retirement/brokerage information is not incorrectly treated as ordinary spending.

## Bank simulation

Simulate:

- initial connection;
- stale connection;
- reconnect;
- new transaction;
- pending → settled;
- transaction retraction;
- duplicate pull;
- partial pull;
- delayed sync;
- interrupted sync;
- conflicting changes.

## Dry Run

Dry Run must:

- avoid unintended data mutation;
- clearly explain what would change;
- identify held-back items;
- detect likely transfers;
- flag suspicious cycles/duplicates;
- provide a meaningful comparison between simulated dry-run output and actual imported results.

## Categorization rules

Test:

- new rules;
- merchant rules;
- conflicting rules;
- historical application;
- future transactions;
- rule edits;
- deleted/renamed categories;
- rule ordering/priority.

## Full-month simulation

Run a complete synthetic month containing:

- paycheck;
- recurring bills;
- groceries;
- credit-card spending;
- savings transfer;
- unexpected expense;
- card payment;
- utility;
- month-end close.

Reconcile the entire system afterward:

```text
Transactions
→ Accounts
→ Budget
→ Safe to Spend
→ Savings Goals
→ Debt
→ Net Worth
→ Forecast
→ Monthly Report
```

No unexplained discrepancy is acceptable.

## Specialized financial testing

### Safe to Spend

Independently verify its math across normal, high-spend, upcoming-bill, savings, transfer, and irregular-income scenarios.

### Bill Calendar

Test recurring dates, month boundaries, edits, missed/paid bills, and conflicting schedules.

### Savings Goals

Test contributions, withdrawals, targets, dates, partial progress, and interactions with available cash.

### House Plan

Test assumptions, affordability calculations, savings effects, and scenario changes.

### Investments / Net Worth

Distinguish:

- actual balance;
- estimated value;
- snapshot;
- bank balance;
- unused/unlinked account.

Test stale and changing values.

### Debt Payoff

Test balances, interest assumptions, payments, payoff order, extra payments, and completion.

### Forecast / Monthly Report

Verify period boundaries, totals, category aggregation, recurring items, and consistency with the underlying ledger.

### AI Ask

AI must not invent balances, transactions, dates, rates, or financial facts. Answers must be grounded in available application data and clearly communicate uncertainty.

## Chaos finance campaign

Attack with:

- duplicate imports;
- duplicate payments;
- refunds;
- reversals;
- zero amounts;
- tiny/huge amounts;
- negative values;
- malformed dates;
- future dates;
- missing accounts;
- deleted categories;
- conflicting rules;
- interrupted imports;
- interrupted sync;
- stale bank data;
- rapid edits;
- repeated refreshes.

## Finance release gate

P0 includes:

- incorrect financial totals;
- double-counted spending;
- incorrect transfer recognition;
- incorrect balances;
- incorrect Net Worth;
- incorrect Safe to Spend;
- incorrect debt/savings totals;
- corrupted historical data;
- data loss;
- cross-user exposure;
- unauthorized access.

**NO GO LIVE** with unresolved P0s or unexplained financial reconciliation errors.

Final command:

> **The application does not go live because it looks finished. It goes live when its financial model survives reality.**

---

# 3. MIKE’S COOKBOOK — GO LIVE PROTOCOL

## Mission

Treat **Mike’s Cookbook** as a real kitchen companion, not a recipe database.

Primary specification: **Mike’s Cookbook Executive Summary** supplied with this project.

### Product areas to inventory and validate

- Home
- Weekly Planner
- Browse
- Collections
- Dish types
- Search
- Recipe details
- Serving scaling
- Nutrition
- Grocery lists
- Recipe instructions
- Check-off state
- Cooking Mode
- Voice controls
- Kitchen timers
- Recipe photography
- Daylight Mode
- Favorites
- Mike’s Favorites
- Add Recipe
- Weekly planning
- Smart grocery list
- Macro Tracker
- Food search
- Barcode scanning
- Manual food entry
- Nutrition facts
- Cross-app integration
- Sign-in
- Sync
- Export/import
- Offline-first PWA
- Update handling
- Accessibility
- Reduced motion
- Safe-area support

## Kitchen personas

Run complete journeys for:

1. **Everyday cook**
2. **Meal prepper**
3. **Macro-conscious user**
4. **Beginner cook**
5. **Chaos cook**

## Search

Test:

- exact search;
- partial search;
- ingredient search;
- multiple ingredients;
- typos;
- case variations;
- no results;
- empty search;
- unusual queries.

## Recipes

Validate:

- recipe details;
- ingredient lists;
- instructions;
- check-off state;
- serving scaling;
- nutrition;
- favorites;
- collections;
- user-created recipes.

Test serving sizes including:

```text
1 / 2 / 3 / 4 / 5 / 6 / 8 / 10 / 12
```

Repeat scaling up/down and verify rounding, quantities, and nutrition remain internally consistent.

## Nutrition

Independently validate:

- per-serving macros;
- total recipe macros;
- scaled recipe macros;
- consumed amounts;
- Macro Tracker interactions;
- manual food entry;
- barcode entry;
- nutrition facts.

## Grocery engine

Test:

- duplicate ingredients;
- unit compatibility;
- unit conversion;
- grouping;
- quantities;
- ingredients shared across recipes;
- weekly plan → grocery list;
- edits/removals;
- persistence.

## Weekly planning

Exercise:

- weekly planner;
- balanced mode;
- macro mode;
- time mode:
  - Quick;
  - Standard;
  - No Rush.

Verify the resulting plan, grocery list, nutrition context, and downstream integrations.

## Training integration

Run cross-app journeys between **Mike’s Cookbook** and **MC Training**.

Verify that shared meal/recipe/refuel context is:

- correct;
- consistent;
- appropriately persisted;
- not duplicated;
- not attributed to the wrong user.

## Cooking Mode — real kitchen simulation

Run complete cooking sessions from recipe selection to completion.

Test:

- entering Cooking Mode;
- step navigation;
- ingredient check-offs;
- instruction state;
- timers;
- leaving and returning;
- refresh;
- app close/reopen;
- offline operation;
- completion;
- partial completion;
- resuming after interruption.

## Timer attack

Test:

- multiple timers;
- short/long durations;
- expiration;
- cancellation;
- rapid creation;
- timers while navigating;
- timers while scrolling;
- leave/return;
- lock/unlock simulation where available;
- background/reopen behavior.

## Voice

Where supported, test realistic kitchen commands and imperfect input. Verify that a failed/ambiguous command does not silently perform a dangerous or destructive action.

## Daylight Mode / photography

Validate:

- Daylight Mode;
- recipe photography;
- image loading/fallbacks;
- readability in bright conditions;
- no layout breakage.

## PWA/offline/mobile

Test:

- installation;
- standalone mode;
- offline launch;
- offline recipe access;
- offline cooking progress;
- reconnect;
- sync;
- service-worker update;
- safe-area layout;
- small screens;
- touch targets;
- reduced motion.

## Sync / Device A ↔ Device B

Simulate:

- same recipe edited on two devices;
- cooking progress conflicts;
- grocery list conflicts;
- planner conflicts;
- offline edits;
- reconnect;
- stale device state;
- duplicate records.

Verify conflict behavior is deterministic and does not silently destroy user data.

## Real-world cooking campaign

Run at least these complete sessions:

1. Simple dinner
2. Complex multi-step meal
3. Meal-prep session
4. Macro-focused meal
5. Offline dinner
6. User-created recipe
7. Chaos dinner with interruptions and corrections

## Cookbook release blockers

P0 includes:

- recipe data corruption;
- incorrect serving calculations;
- incorrect macro calculations;
- lost cooking progress;
- timer corruption;
- lost grocery data;
- lost meal-plan data;
- lost tracker data;
- cross-user exposure;
- sync corruption.

**NO GO LIVE** if a normal person cannot reliably cook a complete meal using the application.

Final command:

> **Cook with the application. The standard is: Could a real person put their phone on the kitchen counter, make dinner using this application from beginning to end, and trust it not to lose, miscalculate, or confuse anything?**

---

# 4. FINAL RELEASE REPORT

At completion, produce `GO_LIVE/release-report.md` containing:

## Executive Verdict

```text
GO LIVE
or
NO GO
```

## Coverage

- features discovered;
- features exercised;
- scenarios executed;
- automated tests run;
- manual/agent simulations run;
- platforms/viewports tested;
- offline/PWA scenarios;
- cross-feature journeys.

## Defects

For each defect:

```text
ID
Severity
Feature
Scenario
Expected
Observed
Root Cause
Fix
Regression Test
Status
```

## Validation

Report:

- data integrity;
- calculation accuracy;
- persistence;
- offline behavior;
- PWA behavior;
- mobile UX;
- accessibility;
- security;
- performance;
- integrations;
- regression results.

## Remaining Risk

List only real, evidence-backed risks. Distinguish:

- release blockers;
- accepted risks;
- known limitations;
- cosmetic/polish items.

## Final Certification

The Final Auditor must explicitly state whether the product is ready for real users and why.

---

# MASTER COMMAND

> **Do not optimize for a green report. Optimize for discovering whether this product can survive real life.**
> 
> **Do not stop at finding defects. Fix them, prove the fix, and prove that the fix did not break something else.**
> 
> **Do not certify based on appearance. Certify based on evidence.**
> 
> **GO LIVE only when the product survives reality.**
