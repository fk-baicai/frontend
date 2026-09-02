(function () {
    'use strict';
    if (window.__ussVisitTrackBoot) return;
    window.__ussVisitTrackBoot = true;

    function isAdminPage() {
        return /admin/i.test(String(location.pathname || ''));
    }

    function apiBase() {
        return String((window.USS_AUTH_API_BASE || window.USS_REGISTER_API_BASE || '') || '').replace(/\/$/, '');
    }

    function joinUrl(p) {
        var b = apiBase();
        if (!b) return p;
        if (p.charAt(0) !== '/') p = '/' + p;
        return b + p;
    }

    function token() {
        try {
            var raw = sessionStorage.getItem('ussHangzhouAuthSession') || localStorage.getItem('ussHangzhouAuthSession');
            if (!raw) return '';
            var sess = JSON.parse(raw);
            return sess && sess.token ? String(sess.token) : '';
        } catch (e) {
            return '';
        }
    }

    function uid(key, days) {
        var k = 'ussVisit_' + key;
        var rec = null;
        try {
            rec = JSON.parse(localStorage.getItem(k) || 'null');
        } catch (e) {
            rec = null;
        }
        var now = Date.now();
        var maxAge = Math.max(1, days) * 86400000;
        if (rec && rec.id && rec.ts && now - rec.ts < maxAge) {
            rec.ts = now;
            try {
                localStorage.setItem(k, JSON.stringify(rec));
            } catch (e2) {}
            return rec.id;
        }
        var id = 'v' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        try {
            localStorage.setItem(k, JSON.stringify({ id: id, ts: now }));
        } catch (e3) {}
        return id;
    }

    function post(body) {
        var headers = { 'Content-Type': 'application/json' };
        var t = token();
        if (t) headers.Authorization = 'Bearer ' + t;
        var payload = JSON.stringify(body);
        var url = joinUrl('/api/stats/visit');
        try {
            if (navigator.sendBeacon && body.kind === 'dwell') {
                var blob = new Blob([payload], { type: 'application/json' });
                if (navigator.sendBeacon(url, blob)) return;
            }
        } catch (e) {}
        try {
            fetch(url, { method: 'POST', headers: headers, body: payload, keepalive: true, cache: 'no-store' });
        } catch (e2) {}
    }

    function pathNow() {
        return String(location.pathname || '/') + String(location.search || '');
    }

    var lastViewPath = '';
    var lastViewAt = 0;
    var visibleSince = Date.now();

    function sendView() {
        if (document.visibilityState === 'hidden') return;
        var p = pathNow();
        var now = Date.now();
        if (p === lastViewPath && now - lastViewAt < 4000) return;
        lastViewPath = p;
        lastViewAt = now;
        visibleSince = now;
        post({
            kind: 'view',
            path: p,
            referrer: document.referrer || '',
            sid: uid('sid', 1),
            vid: uid('vid', 365),
        });
    }

    function sendDwell() {
        if (document.visibilityState !== 'visible') return;
        var ms = Date.now() - visibleSince;
        visibleSince = Date.now();
        if (ms < 1200) return;
        post({
            kind: 'dwell',
            path: pathNow(),
            referrer: '',
            sid: uid('sid', 1),
            vid: uid('vid', 365),
            dwellMs: Math.min(60000, ms),
        });
    }

    function boot() {
        if (isAdminPage()) return;
        sendView();
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') sendDwell();
            else visibleSince = Date.now();
        });
        window.addEventListener('pagehide', sendDwell);
        window.addEventListener('uss-auth-session-changed', function () {
            lastViewPath = '';
            sendView();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
