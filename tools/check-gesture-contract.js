#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-gesture-contract.js — U1/U3 gesture regressions, caught at the
   source, the same way check-topbar-inset.js is.
   --------------------------------------------------------------------------
   Neither defect this guards is visible to a headless browser: env() and a
   simulated pointer event can't reproduce a real Android pull-to-refresh or
   the native double-tap-to-zoom timer a touchscreen browser applies before
   any declared `touch-action` overrides it — both are UA/hardware gesture
   recognizers, not something a DOM snapshot or a dispatched `click` shows.
   So, like check-topbar-inset.js, this reads the CSS source directly rather
   than driving a page.

   Asserts:
     1. base.css contains `overscroll-behavior` on BOTH `html` and `body` (the
        root scroller varies by page, so both are required — see base.css's
        own comment on this block) — without it, a downward pull at the top
        of any page chains to the browser's native pull-to-refresh and
        reloads mid-workout, discarding whatever was open.
     2. Every selector in HOT_TARGETS below carries `touch-action` inside its
        OWN rule body, in whichever stylesheet declares it — without it, a
        fast double-tap on that control (logging two sets back to back,
        restarting a timer) can be swallowed as a zoom gesture instead of
        two taps, with no visible error.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fail = [];

// selector -> stylesheet that declares its canonical rule.
const HOT_TARGETS = {
    '.rest-timer': 'base.css',
    '.setlog-toggle': 'base.css',
    '.mc-day-back': 'base.css',
    '.day-card.mc-day-row': 'base.css',
    '.mcl-ck': 'mc-setlog.css',
};

function ruleBody(src, selector) {
    // Find `<selector>{...}` (allowing whitespace before the brace) and
    // return its body. Good enough for this app's hand-authored, un-nested
    // CSS — same pragmatic regex approach as this repo's other source checks.
    const re = new RegExp(selector.replace(/[.[\]]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
    const m = re.exec(src);
    return m ? m[1] : null;
}

// ---- 1. overscroll-behavior on both html and body ------------------------
{
    const base = fs.readFileSync(path.join(ROOT, 'base.css'), 'utf8');
    ['html', 'body'].forEach(sel => {
        const body = ruleBody(base, sel);
        if (!body || !/overscroll-behavior(-y)?\s*:\s*(contain|none)/.test(body)) {
            fail.push(
                `base.css: \`${sel}\` has no overscroll-behavior:contain (or -y:contain) — ` +
                'a downward pull at the top of the page can chain to the browser\'s ' +
                'native pull-to-refresh and reload mid-workout.'
            );
        }
    });
}

// ---- 2. touch-action on every declared hot tap target ---------------------
Object.keys(HOT_TARGETS).forEach(selector => {
    const file = HOT_TARGETS[selector];
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const body = ruleBody(src, selector);
    if (!body) {
        fail.push(`${file}: expected rule \`${selector}{...}\` not found — ` +
            'update HOT_TARGETS in check-gesture-contract.js if it moved or was renamed.');
        return;
    }
    if (!/touch-action\s*:/.test(body)) {
        fail.push(`${file}: \`${selector}\` has no touch-action — a fast double-tap ` +
            'on this control can be eaten as a zoom gesture instead of two taps.');
    }
});

if (fail.length) {
    console.error('check-gesture-contract: FAIL\n');
    fail.forEach(f => console.error('  * ' + f + '\n'));
    process.exit(1);
}
console.log(`check-gesture-contract: OK — overscroll-behavior on html+body, ` +
    `touch-action on ${Object.keys(HOT_TARGETS).length} hot tap target(s).`);
