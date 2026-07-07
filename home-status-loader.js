/**
 * 首页状态聚合加载：尽早请求 /api/home-dashboard，sessionStorage 刷新秒开。
 */
(function (global) {
    'use strict';

    var CACHE_KEY = 'ussHomeDashboardV1';
    var CACHE_TTL_MS = 15 * 60 * 1000;
    var FETCH_TIMEOUT_MS = 8000;

    var listeners = [];
    var inflight = null;
    var latest = null;

    function apiBase() {
        if (global.UssAuthApi && global.UssAuthApi.base) {
            return String(global.UssAuthApi.base).replace(/\/$/, '');
        }
        if (global.USS_AUTH_API_BASE) {
            return String(global.USS_AUTH_API_BASE).replace(/\/$/, '');
        }
        return 'http://127.0.0.1:3789';
    }

    function readCache() {
        try {
            var raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (!obj || !obj.savedAt) return null;
            if (Date.now() - Number(obj.savedAt) > CACHE_TTL_MS) return null;
            return obj;
        } catch (e) {
            return null;
        }
    }

    function writeCache(payload) {
        if (!payload) return;
        try {
            sessionStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    savedAt: Date.now(),
                    rsiServerStatus: payload.rsiServerStatus || null,
                    execHangar: payload.execHangar || null,
                })
            );
        } catch (e) {
            /* quota / private mode */
        }
    }

    function notify(payload) {
        latest = payload;
        for (var i = 0; i < listeners.length; i++) {
            try {
                listeners[i](payload);
            } catch (e) {
                /* ignore subscriber errors */
            }
        }
    }

    function fetchWithTimeout(url, options, timeoutMs) {
        var ms = timeoutMs == null ? FETCH_TIMEOUT_MS : timeoutMs;
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
            return fetch(url, Object.assign({}, options || {}, { signal: AbortSignal.timeout(ms) }));
        }
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
                reject(new Error('请求超时'));
            }, ms);
            fetch(url, options)
                .then(function (r) {
                    clearTimeout(timer);
                    resolve(r);
                })
                .catch(function (e) {
                    clearTimeout(timer);
                    reject(e);
                });
        });
    }

    function fetchDashboard(options) {
        if (inflight) return inflight;
        var opts = options || {};
        var base = apiBase();
        var url = base + '/api/home-dashboard?_=' + Date.now();
        inflight = fetchWithTimeout(
            url,
            {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
            },
            opts.timeoutMs
        )
            .then(function (r) {
                return r.json().then(function (j) {
                    if (!r.ok || !j || j.ok === false) {
                        var err = new Error((j && j.message) || 'home-dashboard HTTP ' + r.status);
                        err.code = (j && j.code) || 'SRV_001';
                        throw err;
                    }
                    return j;
                });
            })
            .then(function (data) {
                writeCache(data);
                notify(data);
                return data;
            })
            .finally(function () {
                inflight = null;
            });
        return inflight;
    }

    function subscribe(fn) {
        if (typeof fn !== 'function') return function () {};
        listeners.push(fn);
        var cached = readCache();
        if (cached) {
            try {
                fn(cached);
            } catch (e) {
                /* ignore */
            }
        }
        if (latest) {
            try {
                fn(latest);
            } catch (e) {
                /* ignore */
            }
        }
        return function () {
            listeners = listeners.filter(function (f) {
                return f !== fn;
            });
        };
    }

    global.UssHomeStatusLoader = {
        readCache: readCache,
        getCached: readCache,
        getLatest: function () {
            return latest || readCache();
        },
        subscribe: subscribe,
        refresh: fetchDashboard,
    };

    var cached = readCache();
    if (cached) latest = cached;
    fetchDashboard();
})(
    typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this
);
