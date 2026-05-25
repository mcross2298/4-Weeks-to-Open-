// MC Training — Service Worker
// Caches all workout pages for offline use

const CACHE_NAME = 'mc-training-v4';
const CACHE_URLS = [
    './',
    './exercise-library.html',
    './2on-1off.html',
    './3on-1off-high-freq.html',
    './45-minute-burner.html',
    './5on-2off.html',
    './back-traps-pump.html',
    './battle-ropes.html',
    './bis-tris-pump.html',
    './bonus-pump-cst.html',
    './bonus-pump-lats.html',
    './boxing-routine.html',
    './bro-split.html',
    './cat-faint.html',
    './cat-gainz.html',
    './cat-mc.html',
    './cat-pmc.html',
    './cat-psu.html',
    './cat-pump-new4.html',
    './cat-stndr.html',
    './chest-tri-pump.html',
    './driveway-demolition.html',
    './every-arms-day.html',
    './every-chest-day.html',
    './faint-instructions.html',
    './full-body-pyramid.html',
    './gainz-instructions.html',
    './hams-glutes-pump.html',
    './hell-week.html',
    './index.html',
    './legacy-prep.html',
    './legs-pump.html',
    './lets-get-shredded.html',
    './mc-cardio.html',
    './mc-home.html',
    './mc-instructions.html',
    './mc-s1-back.html',
    './mc-s1-bis-tris.html',
    './mc-s1-chest-shoulders.html',
    './mc-s1-legs.html',
    './mc-s1-legs2.html',
    './mc-s2-back.html',
    './mc-s2-chest-bis.html',
    './mc-s2-cst.html',
    './mc-s2-legs.html',
    './mc-s2-legs2.html',
    './mc-s3-back-bis-forearms.html',
    './mc-s3-back.html',
    './mc-s3-chest.html',
    './mc-s3-legs-back.html',
    './mc-s3-legs.html',
    './mc-s3-shoulders-tris.html',
    './mc-s4-bis-tris.html',
    './mc-s4-chest-tris.html',
    './mc-s4-legs.html',
    './mc-s4-shoulders.html',
    './mc-s5-legs.html',
    './mc-s5-pull.html',
    './mc-s5-push.html',
    './mc-split1.html',
    './mc-split2.html',
    './mc-split3.html',
    './mc-split4.html',
    './mc-split5.html',
    './mens-lean-bulk.html',
    './mens-shred.html',
    './pmc-back.html',
    './pmc-bis-tris.html',
    './pmc-chest-shoulders.html',
    './pmc-home.html',
    './pmc-instructions.html',
    './pmc-legs-hams.html',
    './pmc-legs-quad.html',
    './pmc-s2-back.html',
    './pmc-s2-chest-biceps.html',
    './pmc-s2-cst.html',
    './pmc-s2-legs-day2.html',
    './pmc-s2-legs-quad.html',
    './pmc-s3-back-bis-forearms.html',
    './pmc-s3-back.html',
    './pmc-s3-chest.html',
    './pmc-s3-legs.html',
    './pmc-s3-shoulders-tris.html',
    './pmc-s4-bis-tris.html',
    './pmc-s4-chest-tris.html',
    './pmc-s4-legs-back.html',
    './pmc-s4-legs-day2.html',
    './pmc-s4-shoulders.html',
    './pmc-s5-core.html',
    './pmc-s5-legs.html',
    './pmc-s5-pull.html',
    './pmc-s5-push.html',
    './pmc-s6-abs-circuit.html',
    './pmc-s6-back-traps.html',
    './pmc-s6-chest.html',
    './pmc-s6-delts-arms.html',
    './pmc-s6-legs.html',
    './pmc-s7-giant.html',
    './pmc-split1.html',
    './pmc-split2.html',
    './pmc-split3.html',
    './pmc-split4.html',
    './pmc-split5.html',
    './pmc-split6.html',
    './pmc-split7.html',
    './popeye.html',
    './psu-strength.html',
    './pump-instructions.html',
    './push-pull-legs.html',
    './s3-back-traps.html',
    './s3-chest-biceps.html',
    './s3-shoulders-triceps.html',
    './s3-upper-body.html',
    './shoulders-back-pump.html',
    './shoulders-bis-forearms-pump.html',
    './stndr-instructions.html',
    './the-500.html',
    './turn-and-burn.html',
    './weeks-to-open.html',
    './quads-pump.html',
    './s4-pull.html',
    './s4-push.html',
    './manifest.json'
];

// Install — cache everything
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Caching', CACHE_URLS.length, 'files');
            return cache.addAll(CACHE_URLS);
        }).catch(err => {
            console.log('Cache install error:', err);
        })
    );
    self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch — cache first, fallback to network
self.addEventListener('fetch', event => {
    // Only handle same-origin requests
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) {
                // Return cached version immediately
                // Fetch fresh version in background for next visit
                const fetchPromise = fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);
                return cached;
            }
            // Not in cache — fetch from network
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200) return response;
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => {
                // Offline fallback
                return new Response(
                    '<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;text-align:center;padding:60px 20px"><h2>You're offline</h2><p style="color:#9ca3af">This page hasn't been cached yet. Open it while online first.</p></body></html>',
                    {headers: {'Content-Type': 'text/html'}}
                );
            });
        })
    );
});
