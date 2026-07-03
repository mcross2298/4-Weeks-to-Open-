# Markup snippets — Onyx Programs screen

Paste-ready replacements for the existing `#scr-programs` markup in
`dashboard.html`. Every `href`, id, and the `MARKET:STRIP` comment markers are
preserved exactly — only the inner content of each card changes (emoji → SVG
icon chip, long-form tag → short "Flagship" pill + trailing chevron, once per
card).

## Top bar

```html
<div class="topbar">
  <div>
    <div class="topbar-title">Programs</div>
    <div class="topbar-sub" id="flagCount"></div>
  </div>
</div>
```
(unchanged structure — styling comes from the CSS file)

## Flagship tier — `#flagGrid`

```html
<div class="tier-label flag">★ Flagship Programs</div>

<div class="prog-cards lay-stack" id="flagGrid">

  <a href="cat-strength.html" class="cat-card ss">
    <svg class="cat-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b8b92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    <span class="cat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8828b" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>
    </span>
    <div class="cat-tag">Flagship</div>
    <div class="cat-name">Strength &amp; Supersets</div>
    <div class="cat-meta">Heavy low-rep compounds paired with high-volume supersets and AMRAP finishers for raw strength and size.</div>
    <div class="cat-count">6-Week Cycle · 5 Days</div>
  </a>

  <a href="cat-pmc.html" class="cat-card pmc">
    <svg class="cat-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b8b92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    <span class="cat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b3aaf7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>
    </span>
    <div class="cat-tag">Flagship</div>
    <div class="cat-name">Project Muscle Confusion</div>
    <div class="cat-meta">Constantly varied supersets, pyramids, drop sets, AMRAP and tempo work that never lets your muscles adapt.</div>
    <div class="cat-count">7 Splits · 2 Weeks Each</div>
  </a>

  <a href="cat-mc.html" class="cat-card mc">
    <svg class="cat-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b8b92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    <span class="cat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e6c579" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l3.5 2.5L12 4l4.5 6.5L20 8l-1.5 10h-13z"/></svg>
    </span>
    <div class="cat-tag">Flagship</div>
    <div class="cat-name">Mike Cross' Favorite Splits</div>
    <div class="cat-meta">Mike's five personal splits spanning every major training style — the way he actually trains.</div>
    <div class="cat-count">5 Splits · 23 Workouts</div>
  </a>

  <a href="cat-ks.html" class="cat-card ks">
    <svg class="cat-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b8b92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    <span class="cat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3c1.6 3 4 4.2 4 7.5A4 4 0 0 1 8 11c0-1 .3-1.7.8-2.4C8 9 7 10.3 7 12.5A5 5 0 0 0 17 12.5C17 8 13.5 6 12 3z" fill="#f0c078"/></svg>
    </span>
    <div class="cat-tag">Flagship</div>
    <div class="cat-name">Everything Under the Kitchen Sink</div>
    <div class="cat-meta">Six distinct training splits under one roof — the complete MC arsenal, station-anchored for commercial gym efficiency.</div>
    <div class="cat-count">6 Splits · Station-Anchored</div>
  </a>

  <a href="cat-mm.html" class="cat-card mm">
    <svg class="cat-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b8b92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    <span class="cat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a3a8f2" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7z"/></svg>
    </span>
    <div class="cat-tag">Flagship</div>
    <div class="cat-name">The Modality Matrix</div>
    <div class="cat-meta">Three phases, three modalities — dumbbell isolation, barbell strength, cable conditioning — one complete system.</div>
    <div class="cat-count">15 Weeks · 3 Phases · 4-Day Split</div>
  </a>

  <a href="cat-hv.html" class="cat-card hv">
    <svg class="cat-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b8b92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    <span class="cat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c3dc8f" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
    </span>
    <div class="cat-tag">Flagship</div>
    <div class="cat-name">High-Volume Training Template</div>
    <div class="cat-meta">Compound-dominant into full supersets, into high-set pyramids, into bodyweight &amp; accessory density — trisets banned throughout.</div>
    <div class="cat-count">4-Week Block · 5–6 Sets · 15–25 Reps</div>
  </a>

</div><!-- /#flagGrid -->
```

> The `.ss-glow` / `.ss-sheen` / `.pmc-glow` / `.pmc-sheen` / `.mc-glow` /
> `.mc-sheen` / `.ks-glow` / `.ks-sheen` decorative spans from the current
> markup are dropped — Onyx's flat accent-tint gradient replaces the old
> animated glow/sheen treatment for a calmer, more premium feel. If the owner
> wants to keep the breathing/sheen animation, layer the existing keyframes
> back in unchanged; they're purely additive and don't conflict with the new
> tokens.

Leave `#bonusCardSlot` and `#collectionsSlot` exactly as they are — untouched,
JS-populated, and they inherit `.cat-card` styling automatically.

## Influencer tier — `.influencer-grid`

Keep this entire block, including both `MARKET:STRIP` comments, exactly where
it is in the file — only the card internals change:

```html
<!-- MARKET:STRIP influencer-programs START — licensed content, see content-manifest.json -->
<div class="tier-label influencer">Influencer Programs</div>

<div class="influencer-grid">

  <a href="cat-stndr.html" class="cat-card stndr">
    <span class="cat-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6bd9b3" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>
    </span>
    <div class="cat-name">STNDR</div>
    <div class="cat-meta">CBUM-style structured lifting built on progressive overload, supersets and smart periodization.</div>
    <div class="cat-count">5 Programs</div>
  </a>

  <a href="cat-pump-new4.html" class="cat-card pump">
    <span class="cat-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f0a583" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>
    </span>
    <div class="cat-name">Daily Pump</div>
    <div class="cat-meta">Fast, high-rep isolation work that chases maximum pump and muscle fullness.</div>
    <div class="cat-count">10 Workouts</div>
  </a>

  <a href="cat-gainz.html" class="cat-card gainz" id="gainzCard">
    <span class="cat-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8fbdec" stroke-width="2" stroke-linecap="round"><path d="M7 12h10M4 9v6M8 6v12M16 6v12M20 9v6"/></svg>
    </span>
    <div class="cat-name">Daily Gainz</div>
    <div class="cat-meta">Bradley Martyn volume training — daily builders engineered for steady, consistent size.</div>
    <div class="gz-live" id="gzLive" style="display:none;">
      <div class="gz-streak" id="gzStreak"></div>
    </div>
    <div class="cat-count">8 Programs</div>
  </a>

  <a href="cat-psu.html" class="cat-card psu">
    <span class="cat-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b2d97f" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/></svg>
    </span>
    <div class="cat-name">PSU Football</div>
    <div class="cat-meta">Penn State's strength and conditioning system, built for real athletic performance.</div>
    <div class="cat-count">1 Program</div>
  </a>

</div>
<!-- MARKET:STRIP influencer-programs END -->
```

> `#gzLive` / `#gzStreak` keep their existing `.gz-live` / `.gz-streak` classes
> and inline `display:none` toggle — `mc-*.js` continues to control them
> unmodified. The `.gz-sheen` decorative span is dropped for the same calmer
> Onyx treatment noted above; re-add if the owner wants to keep it.

Leave `#pubTier` / `#pubProgList` and `#customTier` / `#customProgList`
untouched — owner-only, JS-toggled, inherit `.cat-card` styling automatically.

## Exercise Library link

```html
<a href="exercise-library.html" class="lib-link">
  <span class="lib-icon">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e6c579" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5A1.5 1.5 0 0 0 20 18.5z"/></svg>
  </span>
  <div style="flex:1;min-width:0;">
    <div class="lib-name">Exercise Library</div>
    <div class="lib-sub">577 exercises · search &amp; substitute</div>
  </div>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
</a>
```

## Build a Program CTA

```html
<a href="build-program.html" class="build-cta">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e6c579" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
  <div class="build-cta-title">Build a Program</div>
  <div class="build-cta-sub">Multi-week custom program with its own hero card, schedule and color rail.</div>
</a>
```

(replaces the old dashed `.cat-card` CTA — same destination, same intent, new
class names `.build-cta` / `.build-cta-title` / `.build-cta-sub` defined in
`onyx-programs-tokens-and-styles.css`)
