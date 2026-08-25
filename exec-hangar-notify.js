/**
 * 行政机库插卡窗口提醒：用户开关，窗口从关到开时弹出（样式同商城提醒）。
 */
(function (global) {
    'use strict';

    if (global.__ussExecHangarNotifyLoaded) return;
    global.__ussExecHangarNotifyLoaded = true;

    var ENABLED_KEY = 'ussExecHangarInsertNotifyOn';
    var WAS_OPEN_KEY = 'ussExecHangarInsertWasOpen';
    var POLL_MS = 8000;
    var CYCLE_MS = 185 * 60 * 1000;
    var CHARGE_MS = 120 * 60 * 1000;
    var DISCHARGE_MS = 60 * 60 * 1000;

    var pollTimer = null;
    var pollInFlight = false;

    function shouldNotifyInsert(enabled, canInsert, wasOpen) {
        return !!(enabled && canInsert && !wasOpen);
    }

    function apiBase() {
        return String((global.USS_AUTH_API_BASE || 'http://127.0.0.1:3789')).replace(/\/$/, '');
    }

    function isEnabled() {
        try {
            return localStorage.getItem(ENABLED_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function wasOpen() {
        try {
            return localStorage.getItem(WAS_OPEN_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setWasOpen(open) {
        try {
            localStorage.setItem(WAS_OPEN_KEY, open ? '1' : '0');
        } catch (e) { /* ignore */ }
    }

    function setEnabled(on) {
        try {
            localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
        } catch (e) { /* ignore */ }
        syncToggles();
        if (on) {
            maybeAskPermission();
            startPolling();
            pollOnce().then(function () {
                emitArmedToast(wasOpen());
            });
        } else {
            stopPolling();
        }
        try {
            global.dispatchEvent(new CustomEvent('uss-exec-hangar-notify-toggle', { detail: { on: !!on } }));
        } catch (e2) { /* ignore */ }
    }

    function maybeAskPermission() {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'default') {
            try {
                Notification.requestPermission();
            } catch (e) { /* ignore */ }
        }
    }

    function canInsertFromState(state) {
        if (!state || typeof state !== 'object') return false;
        if (state.canInsert === true) return true;
        if (state.phase === 'discharge') return true;
        var elapsed = Number(state.elapsedMs);
        if (!Number.isFinite(elapsed)) return false;
        var t = elapsed % CYCLE_MS;
        if (t < 0) t += CYCLE_MS;
        return t >= CHARGE_MS && t < CHARGE_MS + DISCHARGE_MS;
    }

    function emitToast(alert) {
        if (!alert) return;
        if (global.UssMarketNotify && typeof global.UssMarketNotify.push === 'function') {
            global.UssMarketNotify.push(alert);
            return;
        }
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                var n = new Notification('行政机库 · ' + String(alert.title || '机库提醒'), {
                    body: alert.body || '',
                    icon: '/favicon-48x48.png',
                    tag: 'uss-hangar-insert',
                });
                n.onclick = function () {
                    n.close();
                    global.location.href = alert.url || '/executive-hangar';
                };
            } catch (e) { /* ignore */ }
        }
    }

    function emitInsertToast() {
        emitToast({
            kind: 'hangar',
            sticky: false,
            title: '插卡窗口已开启',
            body: '行政机库进入放电阶段，当前可插卡。',
            url: '/executive-hangar',
            actionLabel: '打开行政机库',
        });
    }

    function emitArmedToast(canInsertNow) {
        emitToast({
            kind: 'hangar',
            sticky: false,
            title: canInsertNow ? '提醒已开启' : '插卡窗口提醒已打开',
            body: canInsertNow
                ? '当前正处于插卡窗口。下一轮放电开始时会再次提醒。'
                : '当前还不能插卡。放电阶段一开始会在右下角提醒你。',
            url: '/executive-hangar',
            actionLabel: '打开行政机库',
        });
    }

    function applyCanInsert(open) {
        var enabled = isEnabled();
        var prev = wasOpen();
        if (shouldNotifyInsert(enabled, open, prev)) emitInsertToast();
        setWasOpen(!!open);
    }

    async function pollOnce() {
        if (!isEnabled()) return;
        if (pollInFlight) return;
        pollInFlight = true;
        try {
            var r = await fetch(apiBase() + '/api/exec-hangar/state', { headers: { Accept: 'application/json' } });
            var data = await r.json().catch(function () { return {}; });
            if (data && data.ok) {
                applyCanInsert(canInsertFromState(data));
            } else {
                setWasOpen(false);
            }
        } catch (e) {
            setWasOpen(false);
        } finally {
            pollInFlight = false;
        }
    }

    function startPolling() {
        if (pollTimer || !isEnabled()) return;
        pollTimer = global.setInterval(pollOnce, POLL_MS);
    }

    function stopPolling() {
        if (!pollTimer) return;
        global.clearInterval(pollTimer);
        pollTimer = null;
    }

    function toggleHtml() {
        var on = isEnabled();
        return (
            '<label class="exec-notify-toggle">' +
            '<input type="checkbox" class="exec-notify-toggle__input" ' +
            (on ? 'checked ' : '') +
            '/>' +
            '<span class="exec-notify-toggle__track" aria-hidden="true"><span class="exec-notify-toggle__knob"></span></span>' +
            '<span class="exec-notify-toggle__label">插卡窗口提醒</span>' +
            '</label>'
        );
    }

    function bindToggle(root) {
        if (!root || root.getAttribute('data-exec-notify-bound') === '1') return;
        root.setAttribute('data-exec-notify-bound', '1');
        root.innerHTML = toggleHtml();
        var input = root.querySelector('.exec-notify-toggle__input');
        if (!input) return;
        input.addEventListener('change', function () {
            setEnabled(!!input.checked);
        });
    }

    function syncToggles() {
        if (typeof document === 'undefined') return;
        var on = isEnabled();
        var nodes = document.querySelectorAll('.exec-notify-toggle__input');
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].checked = on;
        }
    }

    function mountToggles() {
        if (typeof document === 'undefined') return;
        var ids = ['execInsertNotifyMount', 'homeExecHangarNotifyMount'];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el) bindToggle(el);
        }
        syncToggles();
    }

    function init() {
        mountToggles();
        if (isEnabled()) {
            startPolling();
            pollOnce();
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', function () {
                if (document.hidden || !isEnabled()) return;
                pollOnce();
            });
        }
        try {
            if (global.location && /(?:\?|&)hangarNotifyPreview=1(?:&|$)/.test(String(global.location.search || ''))) {
                emitInsertToast();
            }
        } catch (e3) { /* ignore */ }
        global.addEventListener('storage', function (ev) {
            if (ev && ev.key && ev.key !== ENABLED_KEY && ev.key !== WAS_OPEN_KEY) return;
            syncToggles();
            if (isEnabled()) {
                startPolling();
                pollOnce();
            } else stopPolling();
        });
    }

    var api = {
        shouldNotifyInsert: shouldNotifyInsert,
        isEnabled: isEnabled,
        setEnabled: setEnabled,
        applyCanInsert: applyCanInsert,
        preview: emitInsertToast,
        init: init,
        mountToggles: mountToggles,
    };
    global.UssExecHangarNotify = api;

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
