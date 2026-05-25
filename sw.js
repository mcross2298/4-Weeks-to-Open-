// MC Training — Service Worker v2
// Absolute URL cache for GitHub Pages

const CACHE_NAME = 'mc-training-v4';
const BASE = 'https://mcross2298.github.io/4-Weeks-to-Open-/';
const CACHE_URLS = [
    'https://mcross2298.github.io/4-Weeks-to-Open-/',
    'https://mcross2298.github.io/4-Weeks-to-Open-/exercise-library.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/2on-1off.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/3on-1off-high-freq.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/45-minute-burner.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/5on-2off.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/back-traps-pump.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/battle-ropes.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/bis-tris-pump.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/bonus-pump-cst.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/bonus-pump-lats.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/boxing-routine.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/bro-split.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/cat-faint.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/cat-gainz.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/cat-mc.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/cat-pmc.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/cat-psu.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/cat-pump-new4.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/cat-stndr.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/chest-tri-pump.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/driveway-demolition.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/every-arms-day.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/every-chest-day.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/faint-instructions.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/full-body-pyramid.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/gainz-instructions.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/hams-glutes-pump.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/hell-week.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/index-v4.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/legacy-prep.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/legs-pump.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/lets-get-shredded.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-cardio.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-home.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-instructions.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s1-back.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s1-bis-tris.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s1-chest-shoulders.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s1-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s1-legs2.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s2-back.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s2-chest-bis.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s2-cst.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s2-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s2-legs2.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s3-back-bis-forearms.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s3-back.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s3-chest.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s3-legs-back.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s3-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s3-shoulders-tris.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s4-bis-tris.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s4-chest-tris.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s4-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s4-shoulders.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s5-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s5-pull.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-s5-push.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-split1.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-split2.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-split3.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-split4.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mc-split5.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mens-lean-bulk.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/mens-shred.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-back.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-bis-tris.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-chest-shoulders.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-home.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-instructions.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-legs-hams.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-legs-quad.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s2-back.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s2-chest-biceps.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s2-cst.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s2-legs-day2.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s2-legs-quad.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s3-back-bis-forearms.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s3-back.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s3-chest.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s3-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s3-shoulders-tris.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s4-bis-tris.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s4-chest-tris.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s4-legs-back.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s4-legs-day2.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s4-shoulders.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s5-core.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s5-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s5-pull.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s5-push.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s6-abs-circuit.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s6-back-traps.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s6-chest.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s6-delts-arms.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s6-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-s7-giant.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-split1.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-split2.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-split3.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-split4.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-split5.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-split6.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pmc-split7.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/popeye.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/psu-strength.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/pump-instructions.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/push-pull-legs.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/s3-back-traps.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/s3-chest-biceps.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/s3-shoulders-triceps.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/s3-upper-body.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/shoulders-back-pump.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/shoulders-bis-forearms-pump.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/stndr-instructions.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/the-500.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/turn-and-burn.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/weeks-to-open.html',
    'https://mcross2298.github.io/4-Weeks-to-Open-/manifest.json',
    'https://mcross2298.github.io/4-Weeks-to-Open-/sw.js'
];

// Install — cache everything
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching', CACHE_URLS.length, 'files');
            // Cache in batches to avoid timeout
            const batch = (arr, size) => Array.from({length:Math.ceil(arr.length/size)}, (_,i) => arr.slice(i*size,i*size+size));
            const batches = batch(CACHE_URLS, 20);
            return batches.reduce((p, b) => p.then(() =>
                cache.addAll(b).catch(err => console.log('[SW] Batch error:', err))
            ), Promise.resolve());
        })
    );
    self.skipWaiting();
});

// Activate — remove old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
                console.log('[SW] Removing old cache:', k);
                return caches.delete(k);
            }))
        )
    );
    self.clients.claim();
});

// Fetch — cache first, update in background
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Only handle requests to our domain
    if (!url.startsWith('https://mcross2298.github.io')) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) {
                // Serve from cache, refresh in background
                fetch(event.request).then(resp => {
                    if (resp && resp.status === 200) {
                        caches.open(CACHE_NAME).then(c => c.put(event.request, resp));
                    }
                }).catch(() => {});
                return cached;
            }
            // Not cached — fetch and store
            return fetch(event.request).then(resp => {
                if (!resp || resp.status !== 200) return resp;
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                return resp;
            }).catch(() => {
                return new Response(
                    '<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;text-align:center;padding:60px 20px"><h2 style="color:#d4af37">MC Training</h2><p style="color:#9ca3af;margin-top:12px">You are offline. Open this page while online to cache it.</p><a href="/" style="display:inline-block;margin-top:20px;color:#d4af37">← Home</a></body></html>',
                    {headers: {'Content-Type': 'text/html'}}
                );
            });
        })
    );
});

// Message — force update
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});
