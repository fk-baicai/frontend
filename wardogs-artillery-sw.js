var CACHE = 'uss-wd-arty-tiles-v1';

self.addEventListener('install', function (ev) {
    self.skipWaiting();
});

self.addEventListener('activate', function (ev) {
    ev.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (ev) {
    var url = ev.request.url;
    if (url.indexOf('wardogs.t0ki.cn/maps/tiles/') === -1) return;
    ev.respondWith(
        caches.open(CACHE).then(function (cache) {
            return cache.match(ev.request).then(function (hit) {
                if (hit) return hit;
                return fetch(ev.request).then(function (res) {
                    if (res) cache.put(ev.request, res.clone());
                    return res;
                });
            });
        })
    );
});
