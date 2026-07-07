/**
 * 首页 hero 视频：Cache API 持久化，刷新不再重复拉网。
 */
(function (global) {
    'use strict';

    var CACHE_NAME = 'uss-hero-videos-v1';
    var HERO_PATHS = ['videos/hero-1.mp4', 'videos/hero-2.mp4'];
    var blobByPath = Object.create(null);
    var inflightByPath = Object.create(null);

    function cacheSupported() {
        return typeof caches !== 'undefined' && typeof caches.open === 'function';
    }

    function absoluteUrl(path) {
        try {
            return new URL(path, global.location.href).href;
        } catch (e) {
            return path;
        }
    }

    function requestFor(path) {
        return new Request(absoluteUrl(path), { credentials: 'same-origin' });
    }

    function blobToObjectUrl(path, blob) {
        if (blobByPath[path]) return blobByPath[path];
        var url = URL.createObjectURL(blob);
        blobByPath[path] = url;
        return url;
    }

    function fetchAndStore(cache, req) {
        return fetch(req).then(function (res) {
            if (!res.ok) throw new Error('hero video fetch failed');
            var clone = res.clone();
            cache.put(req, clone).catch(function () {});
            return res.blob();
        });
    }

    function resolveUrl(path) {
        if (!path) return Promise.reject(new Error('empty path'));
        if (blobByPath[path]) return Promise.resolve(blobByPath[path]);
        if (inflightByPath[path]) return inflightByPath[path];

        if (!cacheSupported()) {
            return Promise.resolve(path);
        }

        inflightByPath[path] = caches
            .open(CACHE_NAME)
            .then(function (cache) {
                var req = requestFor(path);
                return cache.match(req).then(function (cached) {
                    if (cached) return cached.blob();
                    return fetchAndStore(cache, req);
                });
            })
            .then(function (blob) {
                return blobToObjectUrl(path, blob);
            })
            .catch(function () {
                return path;
            })
            .finally(function () {
                delete inflightByPath[path];
            });

        return inflightByPath[path];
    }

    function warmup(paths) {
        if (!paths || !paths.length) return;
        resolveUrl(paths[0]).then(function () {
            if (paths.length < 2) return;
            var rest = paths.slice(1);
            var idle =
                global.requestIdleCallback ||
                function (cb) {
                    setTimeout(cb, 1200);
                };
            idle(function () {
                for (var i = 0; i < rest.length; i++) {
                    resolveUrl(rest[i]);
                }
            });
        });
    }

    global.UssHeroVideoCache = {
        paths: HERO_PATHS.slice(),
        resolveUrl: resolveUrl,
        warmup: warmup,
    };

    warmup(HERO_PATHS);
})(window);
