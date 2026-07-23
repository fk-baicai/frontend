/**
 * 首页 hero 视频：Cache API 后台预热；播放始终用直链（避免本地 blob: 首帧闪白）。
 */
(function (global) {
    'use strict';

    var CACHE_NAME = 'uss-hero-videos-v1';
    var HERO_PATHS = ['videos/hero-1.mp4', 'videos/hero-2.mp4'];
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

    function fetchAndStore(cache, req) {
        return fetch(req).then(function (res) {
            if (!res.ok) throw new Error('hero video fetch failed');
            var clone = res.clone();
            cache.put(req, clone).catch(function () {});
            return res;
        });
    }

    function prefetchToCache(path) {
        if (!path || !cacheSupported()) return;
        if (inflightByPath[path]) return;

        inflightByPath[path] = caches
            .open(CACHE_NAME)
            .then(function (cache) {
                var req = requestFor(path);
                return cache.match(req).then(function (cached) {
                    if (cached) return cached;
                    return fetchAndStore(cache, req);
                });
            })
            .catch(function () {
                /* 预热失败不影响直链播放 */
            })
            .finally(function () {
                delete inflightByPath[path];
            });
    }

    function resolveUrl(path) {
        if (!path) return Promise.reject(new Error('empty path'));
        prefetchToCache(path);
        return Promise.resolve(path);
    }

    function warmup(paths) {
        if (!paths || !paths.length) return;
        prefetchToCache(paths[0]);
        if (paths.length < 2) return;
        var rest = paths.slice(1);
        var idle =
            global.requestIdleCallback ||
            function (cb) {
                setTimeout(cb, 1200);
            };
        idle(function () {
            for (var i = 0; i < rest.length; i++) {
                prefetchToCache(rest[i]);
            }
        });
    }

    global.UssHeroVideoCache = {
        paths: HERO_PATHS.slice(),
        resolveUrl: resolveUrl,
        warmup: warmup,
    };
})(window);
