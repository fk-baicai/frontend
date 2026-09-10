var CACHE = 'uss-wd-arty-tiles-v2';

self.addEventListener('install', function (ev) {
    self.skipWaiting();
});

self.addEventListener('activate', function (ev) {
    ev.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (k) {
                        return k.indexOf('uss-wd-arty-tiles-') === 0 && k !== CACHE;
                    })
                    .map(function (k) {
                        return caches.delete(k);
                    })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (ev) {
    var url = ev.request.url;
    if (url.indexOf('wardogs.t0ki.cn/maps/tiles/') === -1) return;
    if (ev.request.method !== 'GET') return;
    ev.respondWith(
        caches.open(CACHE).then(function (cache) {
            return cache.match(ev.request).then(function (hit) {
                if (hit) return hit;
                return fetch(ev.request).then(function (res) {
                    if (res && res.ok) {
                        cache.put(ev.request, res.clone());
                    }
                    return res;
                });
            });
        })
    );
});
