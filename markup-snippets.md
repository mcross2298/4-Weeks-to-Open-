# Onyx — markup snippets & line icons

Drop-in HTML for the redesigned `#scr-dashboard`. Classes match
`onyx-tokens-and-styles.css`. **Keep every existing id and `onclick`** — only the
structure/styling around them changes. Inline SVGs replace all emoji.

---

## 1. Header (topbar)

```html
<div class="topbar">
  <div class="topbar-left">
    <div class="avatar">MC</div>
    <div>
      <div class="topbar-sub" id="todayDate"></div>
      <div class="topbar-title" id="greeting">Good morning, Mike</div>
    </div>
  </div>
  <!-- keep the existing calendar/PM handlers on this control -->
  <div class="topbar-icon" onclick="if(window.MCCalendar)MCCalendar.toggle();" title="Search / calendar">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="#c9c9cf" stroke-width="2"/>
      <path d="M20 20l-3.2-3.2" stroke="#c9c9cf" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </div>
</div>
```

## 2. Streak strip (existing `.momentum-strip` — restyled, emoji → SVG)

```html
<div class="momentum-strip show" id="momentumStrip">
  <span class="ms-flame">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 3c1.6 3 4 4.2 4 7.5A4 4 0 0 1 8 11c0-1 .3-1.7.8-2.4C8 9 7 10.3 7 12.5A5 5 0 0 0 17 12.5C17 8 13.5 6 12 3z" fill="#e6c579"/></svg>
  </span>
  <div class="ms-body">
    <div class="ms-streak" id="msStreak">12-day streak</div>
    <div class="ms-sub" id="msSub">Train today to keep it alive</div>
  </div>
  <div class="ms-badge" id="msBadge">DAY 3</div>
</div>
```

## 3. Hero — Continue / Resume (existing `.hero-card`)

```html
<div class="hero-wrap">
  <div class="hero-eyebrow">Continue where you left off</div>
  <div class="hero-card" id="heroCard" onclick="openActiveProgram()">
    <div class="hero-glow"></div>
    <div class="hero-sheen"></div>
    <div class="hero-inner">
      <div class="hero-top-row">
        <div>
          <div class="hero-badge" id="heroBadge">Active Program</div>
          <div class="hero-name" id="heroName">Strength &amp; Supersets</div>
          <div class="hero-desc" id="heroDesc">Week 2 · Day 3 · Push</div>
        </div>
        <!-- progress ring: set stroke-dashoffset from cycle % (r=26, C≈163) -->
        <div class="hero-ring">
          <svg width="60" height="60" viewBox="0 0 60 60" style="transform:rotate(-90deg)">
            <circle cx="30" cy="30" r="26" stroke="rgba(255,255,255,.08)" stroke-width="5" fill="none"/>
            <circle cx="30" cy="30" r="26" stroke="#e6c579" stroke-width="5" fill="none"
                    stroke-linecap="round" stroke-dasharray="163" stroke-dashoffset="62"/>
          </svg>
          <div class="hero-ring-center">
            <div class="hero-ring-num" id="heroDay">62%</div>
            <div class="hero-ring-lbl">CYCLE</div>
          </div>
        </div>
      </div>
      <div class="hero-phases" id="heroPhases">
        <span class="phase-pill active">Chest</span>
        <span class="phase-pill">Shoulders</span>
        <span class="phase-pill">Triceps</span>
        <span class="phase-pill">10 lifts</span>
      </div>
      <div class="hero-tap" id="heroTap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1a1409"><path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5z"/></svg>
        Resume workout
      </div>
    </div>
  </div>
</div>
```
> Ring geometry: `dashoffset = 163 * (1 - pct/100)`. For 62% → ~62. Wire this to
> the same value that drives the current cycle/day display.

## 4. Programs rail (NEW — insert after hero, before Training Tools)

Ideally render this from the same program data as `#flagGrid` (`mc-pm-data.js`) so
it never drifts. Static reference markup:

```html
<div class="prog-rail-head">
  <div class="prog-rail-title">Programs</div>
  <div class="prog-rail-link" onclick="switchTab('programs')">Browse all</div>
</div>
<div class="prog-rail">
  <a href="cat-strength.html" class="rail-card ss">
    <div class="rail-icon">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#e8828b" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>
    </div>
    <div class="rail-name">Strength &amp; Supersets</div>
    <div class="rail-meta">6-week cycle · 5 days</div>
  </a>
  <a href="cat-pmc.html" class="rail-card pmc">
    <div class="rail-icon">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b3aaf7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>
    </div>
    <div class="rail-name">Project Muscle Confusion</div>
    <div class="rail-meta">7 splits · advanced</div>
  </a>
  <a href="cat-mc.html" class="rail-card mc">
    <div class="rail-icon">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#e6c579" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l3.5 2.5L12 4l4.5 6.5L20 8l-1.5 10h-13z"/></svg>
    </div>
    <div class="rail-name">Mike's Favorite Splits</div>
    <div class="rail-meta">5 splits · all styles</div>
  </a>
  <!-- + cat-ks (.ks), cat-mm (.mm), cat-hv (.hv) with matching accents -->
</div>
```

## 5. Training tools (existing `.tools-grid` — emoji → SVG)

```html
<div class="tools-grid">
  <a href="exercise-library.html" class="tool-card gold">
    <div class="tool-icon-wrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e6c579" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5A1.5 1.5 0 0 0 20 18.5z"/></svg>
    </div>
    <div class="tool-name">Exercise Library</div>
    <div class="tool-sub" id="libCountDash">577 exercises</div>
  </a>
  <a href="build-workout.html" class="tool-card">
    <div class="tool-icon-wrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9c9cf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6M3 21l1-4L15 6l3 3L7 20z"/></svg>
    </div>
    <div class="tool-name">Build Your Own</div>
    <div class="tool-sub">Custom workouts</div>
  </a>
  <a href="stats.html" class="tool-card">
    <div class="tool-icon-wrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9c9cf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
    </div>
    <div class="tool-name">Progress</div>
    <div class="tool-sub">History &amp; PRs</div>
  </a>
  <a href="dashboard.html?tab=nutrition" class="tool-card">
    <div class="tool-icon-wrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9c9cf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8c-2-3 1-5 2-5-1 2 .5 3 1.5 4A5 5 0 1 1 8 8.5C9 10 11 10 12 8z"/></svg>
    </div>
    <div class="tool-name">Nutrition</div>
    <div class="tool-sub">Macros &amp; meals</div>
  </a>
</div>
```

## 6. Tab bar (existing `.tab-bar` — emoji → SVG; keep switchTab handlers)

```html
<div class="tab-bar">
  <div class="tab active" id="tab-dashboard" onclick="switchTab('dashboard')">
    <div class="tab-icon"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#e6c579" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/></svg></div>
    <div>Home</div>
  </div>
  <div class="tab" id="tab-programs" onclick="switchTab('programs')">
    <div class="tab-icon"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#6b6b72" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg></div>
    <div>Programs</div>
  </div>
  <div class="tab" id="tab-conditioning" onclick="switchTab('conditioning')">
    <div class="tab-icon"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#6b6b72" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.6 3 4 4.2 4 7.5A4 4 0 0 1 8 11c0-1 .3-1.7.8-2.4C8 9 7 10.3 7 12.5A5 5 0 0 0 17 12.5"/></svg></div>
    <div>Conditioning</div>
  </div>
  <div class="tab" id="tab-nutrition" onclick="switchTab('nutrition')">
    <div class="tab-icon"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#6b6b72" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8c-2-3 1-5 2-5-1 2 .5 3 1.5 4A5 5 0 1 1 8 8.5C9 10 11 10 12 8z"/></svg></div>
    <div>Nutrition</div>
  </div>
  <div class="tab" id="tab-stats" onclick="location.href='stats.html'">
    <div class="tab-icon"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#6b6b72" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M4 9h16M9 3v3M15 3v3"/></svg></div>
    <div>History</div>
  </div>
</div>
```

---

## Helper CSS the snippets assume
Add alongside `onyx-tokens-and-styles.css`:

```css
.hero-inner{ position:relative;padding:20px 20px 18px; }
.hero-top-row{ display:flex;align-items:flex-start;justify-content:space-between;gap:14px; }
.hero-ring{ position:relative;width:60px;height:60px;flex-shrink:0; }
.hero-ring-center{ position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center; }
.hero-phases{ display:flex;gap:7px;flex-wrap:wrap;margin:16px 0; }
.momentum-strip{ display:flex;align-items:center;gap:9px; }
.ms-flame{ line-height:0; }
.topbar-icon{ display:flex;align-items:center;justify-content:center; }
```

## Icon reference
search · flame · dumbbell (programs/strength) · bolt (muscle confusion) ·
star-badge (favorites) · book (library) · wrench (build) · bars (progress) ·
apple (nutrition) · home · calendar (history) · play (resume). All are 2px-stroke,
round-cap line icons — swap stroke color to match context (accent vs `#c9c9cf`
vs `#6b6b72`).
