/* tools/bundle-outputs.js — the generated bundles (flagship readiness J).
   workout-core.js and workout-logger.js are COPIES of their member modules
   (tools/bundles.json). A gate that reads source must read each module once,
   from the member, or every "exactly once", "only writer" and "every reader
   guards" rule would count the copy as a second implementation. */
'use strict';
const path = require('path');
const NAMES = new Set(Object.keys(require(path.join(__dirname, 'bundles.json')).bundles));
module.exports = { NAMES, isBundle: (f) => NAMES.has(path.basename(String(f))) };
