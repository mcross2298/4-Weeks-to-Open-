'use strict';
/* ==========================================================================
   _harness.js — shared browser harness for the clean-room GO LIVE run.
   --------------------------------------------------------------------------
   Every clean-room scenario boots through here so that "a console error" and
   "a page load" mean exactly the same thing in every report. Playwright is
   resolved off the global prefix because this repo has no package.json by
   design (see CLAUDE.md, Build/test/CI).
   ========================================================================== */
const path = require('path');
module.paths.push('/opt/node22/lib/node_modules');
const { chromium } = require('playwright');

const BASE = process.env.MC_BASE || 'http://localhost:8080';

/* Resource 404s are reported separately from script errors: a missing PNG is
   not the same defect class as a thrown exception, and conflating them is how
   a real throw gets lost in noise. */
function attach(page, sink) {
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    sink.console.push(t);
  });
  page.on('pageerror', e => sink.thrown.push(String(e && e.message || e)));
  page.on('requestfailed', r => sink.netfail.push(r.url().replace(BASE, '') + ' :: ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) sink.http.push(r.status() + ' ' + r.url().replace(BASE, '')); });
}

function newSink() { return { console: [], thrown: [], netfail: [], http: [] }; }

/* Errors that are environment, not product. The agent sandbox cannot reach
   fonts.googleapis.com from inside the BROWSER (curl reaches it and returns
   200 — verified; the browser's request is aborted). That is a documented
   constraint of this environment, re-derived rather than cited. Likewise the
   Supabase host is unreachable, which is correct for an offline-first app and
   is itself part of what we test. */
const ENV_NOISE = [
  /fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i,
  /supabase\.co/i, /Failed to load resource/i,
  /net::ERR_(ABORTED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION|BLOCKED)/i,
  /the server responded with a status of 4\d\d/i,
];
const isNoise = s => ENV_NOISE.some(r => r.test(s));
function productErrors(sink) {
  return {
    console: sink.console.filter(s => !isNoise(s)),
    thrown:  sink.thrown.filter(s => !isNoise(s)),
  };
}

async function browser(opts = {}) {
  return chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], ...opts });
}

/* 390x844 is the iPhone 14/15 logical viewport — the device this product is
   actually used on, per the Executive Summary's "pocket gym". 320 is the
   narrowest phone still in real use and is where this repo has repeatedly
   found overflow the 390 gates missed. */
const PHONE = { width: 390, height: 844 };

async function ctx(b, viewport = PHONE) {
  return b.newContext({
    viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
}

/* Structural defects any page can be asked about without knowing what it does. */
async function structure(page) {
  return page.evaluate(() => {
    const ids = {}, dupes = [];
    document.querySelectorAll('[id]').forEach(e => {
      const k = e.id; if (!k) return;
      ids[k] = (ids[k] || 0) + 1;
      if (ids[k] === 2) dupes.push(k);
    });
    const de = document.documentElement;
    return {
      dupeIds: dupes,
      overflowX: Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0) - de.clientWidth,
      title: document.title || '',
      lang: de.getAttribute('lang') || '',
      viewportMeta: (document.querySelector('meta[name=viewport]') || {}).content || '',
      h1: document.querySelectorAll('h1').length,
      nodes: document.querySelectorAll('*').length,
    };
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { BASE, chromium, browser, ctx, attach, newSink, productErrors, structure, PHONE, sleep, isNoise };
