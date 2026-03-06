const CACHE_VERSION = 'gilmaru-runtime-v1.7.10-20260307';
const OFFLINE_FALLBACKS = ['./', './index.html'];
const CORE_CACHE_URLS = [
    './manifest.json',
    './style.css',
    './app.js',
    './gilmaru_core.js',
    './gilmaru_engine.js',
    './map-provider.js',
    './point-pack-validator.js',
    './word_data.js',
    './vendor/qrcode.min.js',
    './vendor/html2canvas.min.js',
    './data/point-packs/examples/gangnam-station-access-pack.json',
    './data/point-packs/examples/seoul-cityhall-access-pack.json',
    './icons/icon.svg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cacheUrlsBestEffort(cache, [...OFFLINE_FALLBACKS, ...CORE_CACHE_URLS]))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names
                    .filter((name) => name !== CACHE_VERSION)
                    .map((name) => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirst(event.request));
        return;
    }

    event.respondWith(staleWhileRevalidate(event.request));
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_VERSION);

    try {
        const response = await fetch(request);
        if (isCacheable(response)) {
            await cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return (await cache.match(request)) || cache.match('./index.html');
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);

    const fetched = fetch(request)
        .then(async (response) => {
            if (isCacheable(response)) {
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cached);

    return cached || fetched;
}

function isCacheable(response) {
    return Boolean(response && response.ok && (response.type === 'basic' || response.type === 'cors'));
}

async function cacheUrlsBestEffort(cache, urls) {
    await Promise.all(
        urls.map(async (url) => {
            try {
                const request = new Request(url, { cache: 'reload' });
                const response = await fetch(request);
                if (isCacheable(response)) {
                    await cache.put(request, response.clone());
                }
            } catch (error) {
                // Ignore missing hashed assets and cross-origin failures during install.
            }
        })
    );
}
