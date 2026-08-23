/**
 * 星巢贸易 — 右下角交易提醒（站内弹窗为主，系统通知为可选增强）
 */
(function (global) {
    'use strict';

    if (global.__ussMarketNotifyLoaded) return;
    global.__ussMarketNotifyLoaded = true;

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var API_BASE = (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
    var STORAGE_KEY = 'ussMarketPurchaseNotifyState';
    var STICKY_KEY = 'ussMarketPurchaseNotifySticky';
    var POLL_MS = 15000;
    var TOAST_MS = 8000;
    var MAX_TOASTS = 4;

    var pollTimer = null;
    var pollInFlight = null;
    var listenersBound = false;
    var toastUid = 0;
    function later(fn, ms) {
        var t = global.setTimeout(fn, ms);
        if (t && typeof t.unref === 'function') t.unref();
        return t;
    }

    function joinUrl(path) {
        return String(API_BASE).replace(/\/$/, '') + path;
    }

    function loadSession() {
        if (global.UssAuthSessionSync && typeof global.UssAuthSessionSync.loadAuthSession === 'function') {
            return global.UssAuthSessionSync.loadAuthSession();
        }
        try {
            var raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { return null; }
        return null;
    }

    function authHeaders() {
        var s = loadSession();
        if (!s || !s.token) return {};
        return { Authorization: 'Bearer ' + s.token };
    }

    function isLoggedIn() {
        var s = loadSession();
        return !!(s && s.token);
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function primaryItemName(order) {
        var it = (order && order.items && order.items[0]) || {};
        return it.nameZh || it.name || '未填物品';
    }

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { initialized: false, purchases: {} };
            var data = JSON.parse(raw);
            return {
                initialized: !!data.initialized,
                purchases: data.purchases && typeof data.purchases === 'object' ? data.purchases : {},
            };
        } catch (e) {
            return { initialized: false, purchases: {} };
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                initialized: !!state.initialized,
                purchases: state.purchases || {},
            }));
        } catch (e) { /* ignore */ }
    }

    function tradesUrl(tab, purchaseId) {
        var base = 'market-trades.html?tab=' + encodeURIComponent(tab || 'purchases');
        if (purchaseId) base += '&highlight=' + encodeURIComponent(purchaseId);
        return base;
    }

    function rememberPurchases(map, list) {
        (list || []).forEach(function (p) {
            if (!p || !p.id) return;
            map[p.id] = {
                status: p.status,
                updatedAt: p.updatedAt || p.createdAt || '',
            };
        });
    }

    function collectMarketAlerts(state, buyerList, sellerList) {
        var alerts = [];
        var nextPurchases = {};
        if (state && state.purchases && typeof state.purchases === 'object') {
            Object.keys(state.purchases).forEach(function (k) {
                nextPurchases[k] = state.purchases[k];
            });
        }
        var initialized = !!(state && state.initialized);

        if (!initialized) {
            rememberPurchases(nextPurchases, buyerList);
            rememberPurchases(nextPurchases, sellerList);
            var pending = (sellerList || []).filter(function (p) {
                return p && p.status === 'pending';
            });
            if (pending.length) {
                alerts.push({
                    kind: 'seller',
                    sticky: true,
                    purchaseId: pending[0].id,
                    title: '待确认购买请求',
                    body: pending.length === 1
                        ? '买家意向：' + primaryItemName(pending[0].order)
                        : '你有 ' + pending.length + ' 笔购买请求待确认',
                    url: tradesUrl('incoming', pending[0].id),
                });
            }
            return { alerts: alerts, state: { initialized: true, purchases: nextPurchases } };
        }

        (sellerList || []).forEach(function (p) {
            if (!p || !p.id || p.status !== 'pending') return;
            if (!state.purchases[p.id]) {
                alerts.push({
                    kind: 'seller',
                    sticky: true,
                    purchaseId: p.id,
                    title: '收到购买请求',
                    body: '买家意向：' + primaryItemName(p.order),
                    url: tradesUrl('incoming', p.id),
                });
            }
        });

        (buyerList || []).forEach(function (p) {
            if (!p || !p.id) return;
            var prev = state.purchases[p.id];
            if (prev && prev.status === 'pending' && p.status === 'approved') {
                alerts.push({
                    kind: 'buyer',
                    title: '卖家已确认交易',
                    body: primaryItemName(p.order) + ' 已进入待线下交易',
                    url: tradesUrl('purchases', p.id),
                });
            }
        });

        rememberPurchases(nextPurchases, buyerList);
        rememberPurchases(nextPurchases, sellerList);
        return { alerts: alerts, state: { initialized: true, purchases: nextPurchases } };
    }

    function canNotify() {
        return typeof Notification !== 'undefined' && Notification.permission === 'granted';
    }

    function showNative(title, body, url) {
        if (!canNotify()) return;
        try {
            var n = new Notification('星巢贸易 · ' + String(title || ''), {
                body: body,
                icon: '/favicon-48x48.png',
                tag: 'uss-market-' + String(title || '') + '-' + String(body || ''),
            });
            n.onclick = function () {
                try { global.focus(); } catch (e1) { /* ignore */ }
                n.close();
                if (url) global.location.href = url;
            };
        } catch (e) { /* ignore */ }
    }

    function notifyStyles() {
        return (
            '.mkt-notify-stack{position:fixed;right:1.25rem;bottom:1.25rem;z-index:9600;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:.65rem;width:min(22.5rem,calc(100vw - 1.5rem));pointer-events:none}' +
            '.mkt-notify-card{pointer-events:auto;position:relative;display:grid;grid-template-columns:3px minmax(0,1fr) 44px;width:100%;overflow:hidden;background:rgba(8,22,37,.94);border:1px solid rgba(95,184,255,.18);border-radius:8px;box-shadow:0 16px 40px rgba(0,0,0,.45);backdrop-filter:blur(14px);color:#e8f4ff;transform:translateX(112%);opacity:0;transition:transform .28s ease,opacity .28s ease}' +
            '.mkt-notify-card.is-in{transform:translateX(0);opacity:1}' +
            '.mkt-notify-card.is-out{transform:translateX(112%);opacity:0}' +
            '.mkt-notify-card__bar{background:#5fb8ff}' +
            '.mkt-notify-card--seller .mkt-notify-card__bar{background:#f78f1e}' +
            '.mkt-notify-card__body{padding:.85rem .2rem .95rem .9rem;min-width:0}' +
            '.mkt-notify-card__kicker{margin:0 0 .12rem;font-size:.625rem;font-weight:700;letter-spacing:.16em;color:rgba(92,228,255,.72)}' +
            '.mkt-notify-card--seller .mkt-notify-card__kicker{color:rgba(247,143,30,.88)}' +
            '.mkt-notify-card__title{margin:0;font-size:.9375rem;font-weight:700;color:#fff;line-height:1.3}' +
            '.mkt-notify-card__text{margin:.35rem 0 .7rem;font-size:.8125rem;line-height:1.45;color:rgba(200,220,235,.78)}' +
            '.mkt-notify-card__action{display:inline-flex;align-items:center;min-height:44px;padding:0;font-size:.75rem;font-weight:700;letter-spacing:.04em;color:#8ee0ff;text-decoration:none}' +
            '.mkt-notify-card__action:hover,.mkt-notify-card__action:focus-visible{color:#9ee8ff;outline:none}' +
            '.mkt-notify-card__close{appearance:none;border:none;background:transparent;color:rgba(200,220,235,.55);font-size:1.35rem;line-height:1;width:44px;height:44px;margin-top:.15rem;cursor:pointer}' +
            '.mkt-notify-card__close:hover,.mkt-notify-card__close:focus-visible{color:#fff;outline:none}' +
            '.mkt-notify-card__timer{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(95,184,255,.38);transform-origin:left center;animation:mkt-notify-timer 8s linear forwards}' +
            '.mkt-notify-card--seller .mkt-notify-card__timer{background:rgba(247,143,30,.5)}' +
            '.mkt-notify-card--sticky .mkt-notify-card__timer{display:none;animation:none}' +
            '@keyframes mkt-notify-timer{to{transform:scaleX(0)}}' +
            '@media (max-width:640px){.mkt-notify-stack{right:.75rem;bottom:.75rem;width:calc(100vw - 1.5rem)}}' +
            '@media (prefers-reduced-motion:reduce){.mkt-notify-card{transition:none;transform:none;opacity:1}.mkt-notify-card__timer{animation:none}}'
        );
    }

    function ensureStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('ussMarketNotifyStyles')) return;
        var style = document.createElement('style');
        style.id = 'ussMarketNotifyStyles';
        style.textContent = notifyStyles();
        document.head.appendChild(style);
    }

    function ensureStack() {
        if (typeof document === 'undefined') return null;
        ensureStyles();
        var stack = document.getElementById('ussMarketNotifyStack');
        if (stack) return stack;
        stack = document.createElement('div');
        stack.id = 'ussMarketNotifyStack';
        stack.className = 'mkt-notify-stack';
        stack.setAttribute('aria-live', 'polite');
        stack.setAttribute('aria-relevant', 'additions');
        document.body.appendChild(stack);
        return stack;
    }

    function isStickyAlert(alert) {
        if (!alert) return false;
        if (alert.sticky === false) return false;
        if (alert.sticky) return true;
        return alert.kind === 'seller';
    }

    function stickyFingerprint(alert) {
        if (!alert) return '';
        if (alert.purchaseId) return 'id:' + String(alert.purchaseId);
        return 'url:' + String(alert.url || '') + '|' + String(alert.title || '');
    }

    function loadSticky() {
        try {
            if (typeof localStorage === 'undefined') return [];
            var raw = localStorage.getItem(STICKY_KEY);
            if (!raw) return [];
            var data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            return [];
        }
    }

    function saveSticky(list) {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(STICKY_KEY, JSON.stringify(list || []));
        } catch (e) { /* ignore */ }
    }

    function rememberSticky(alert) {
        if (!isStickyAlert(alert)) return;
        var key = stickyFingerprint(alert);
        if (!key) return;
        var list = loadSticky();
        if (list.some(function (item) { return stickyFingerprint(item) === key; })) return;
        list.push({
            kind: 'seller',
            sticky: true,
            purchaseId: alert.purchaseId || '',
            title: alert.title || '收到购买请求',
            body: alert.body || '',
            url: alert.url || tradesUrl('incoming'),
        });
        saveSticky(list);
    }

    function forgetStickyKey(key) {
        var k = String(key || '');
        if (!k) return;
        saveSticky(loadSticky().filter(function (item) {
            return stickyFingerprint(item) !== k;
        }));
    }

    function findNonStickyChild(stack) {
        if (!stack || !stack.children) return null;
        for (var i = 0; i < stack.children.length; i++) {
            var child = stack.children[i];
            if (child.getAttribute && child.getAttribute('data-sticky') === '1') continue;
            return child;
        }
        return null;
    }

    function dismissToast(card) {
        if (!card || card.classList.contains('is-out')) return;
        card.classList.remove('is-in');
        card.classList.add('is-out');
        later(function () {
            if (card && card.parentNode) card.parentNode.removeChild(card);
        }, 280);
    }

    function dismissStickyByPurchaseId(purchaseId) {
        var pid = String(purchaseId || '');
        if (!pid || typeof document === 'undefined') return;
        var stack = document.getElementById('ussMarketNotifyStack');
        if (!stack) return;
        for (var i = stack.children.length - 1; i >= 0; i--) {
            var child = stack.children[i];
            if (child.getAttribute && child.getAttribute('data-purchase-id') === pid) {
                dismissToast(child);
            }
        }
    }

    function pruneStickyToasts(sellerList) {
        var pending = {};
        (sellerList || []).forEach(function (p) {
            if (p && p.id && p.status === 'pending') pending[String(p.id)] = true;
        });
        var next = [];
        loadSticky().forEach(function (item) {
            var pid = item && item.purchaseId != null ? String(item.purchaseId) : '';
            if (pid && !pending[pid]) {
                dismissStickyByPurchaseId(pid);
                return;
            }
            next.push(item);
        });
        saveSticky(next);
    }

    function toastAlreadyVisible(alert) {
        if (typeof document === 'undefined') return false;
        var stack = document.getElementById('ussMarketNotifyStack');
        if (!stack) return false;
        var key = stickyFingerprint(alert);
        var url = String((alert && alert.url) || '');
        for (var i = 0; i < stack.children.length; i++) {
            var child = stack.children[i];
            var childKey = child.getAttribute ? child.getAttribute('data-sticky-key') : '';
            var href = child.getAttribute ? child.getAttribute('data-notify-url') : '';
            if (key && childKey === key) return true;
            if (url && href === url) return true;
        }
        return false;
    }

    function showToast(alert) {
        if (typeof document === 'undefined' || !alert) return null;
        var sticky = isStickyAlert(alert);
        if (sticky && toastAlreadyVisible(alert)) return null;
        var stack = ensureStack();
        if (!stack) return null;
        while (stack.children.length >= MAX_TOASTS) {
            var victim = findNonStickyChild(stack);
            if (!victim) break;
            dismissToast(victim);
        }
        var kind = alert.kind === 'seller' ? 'seller' : 'buyer';
        var url = alert.url || 'market-trades.html';
        var card = document.createElement('article');
        var id = 'mkt-notify-' + (++toastUid);
        card.id = id;
        card.className = 'mkt-notify-card mkt-notify-card--' + kind + (sticky ? ' mkt-notify-card--sticky' : '');
        card.setAttribute('role', sticky ? 'alert' : 'status');
        card.setAttribute('data-sticky', sticky ? '1' : '0');
        card.setAttribute('data-notify-url', url);
        card.setAttribute('data-sticky-key', stickyFingerprint(alert));
        if (alert.purchaseId) card.setAttribute('data-purchase-id', String(alert.purchaseId));
        card.innerHTML =
            '<div class="mkt-notify-card__bar" aria-hidden="true"></div>' +
            '<div class="mkt-notify-card__body">' +
            '<p class="mkt-notify-card__kicker">STAR NEST TRADE</p>' +
            '<h3 class="mkt-notify-card__title">' + escapeHtml(alert.title || '交易提醒') + '</h3>' +
            '<p class="mkt-notify-card__text">' + escapeHtml(alert.body || '') + '</p>' +
            '<a class="mkt-notify-card__action" href="' + escapeHtml(url) + '">查看订单</a>' +
            '</div>' +
            '<button type="button" class="mkt-notify-card__close" aria-label="关闭提醒">&times;</button>' +
            (sticky ? '' : '<span class="mkt-notify-card__timer" aria-hidden="true"></span>');
        stack.appendChild(card);
        var raf = global.requestAnimationFrame || function (fn) { global.setTimeout(fn, 16); };
        raf(function () {
            card.classList.add('is-in');
        });
        if (sticky) rememberSticky(alert);
        var timer = sticky ? null : later(function () { dismissToast(card); }, TOAST_MS);
        function settleSticky() {
            if (!sticky) return;
            var key = (card.getAttribute && card.getAttribute('data-sticky-key')) || stickyFingerprint(alert);
            forgetStickyKey(key);
        }
        var closeBtn = card.querySelector('.mkt-notify-card__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                if (timer) global.clearTimeout(timer);
                settleSticky();
                dismissToast(card);
            });
        }
        var action = card.querySelector('.mkt-notify-card__action');
        if (action && action.addEventListener) {
            action.addEventListener('click', function () {
                settleSticky();
            });
        }
        card.addEventListener('click', function (ev) {
            if (ev.target && ev.target.closest && ev.target.closest('.mkt-notify-card__close')) return;
            if (ev.target && ev.target.closest && ev.target.closest('.mkt-notify-card__action')) return;
            settleSticky();
            global.location.href = url;
        });
        return card;
    }

    function restoreStickyToasts() {
        loadSticky().forEach(function (alert) {
            showToast(alert);
        });
    }

    function emitAlert(alert) {
        showToast(alert);
        showNative(alert.title, alert.body, alert.url);
    }

    function push(alert) {
        if (!alert) return;
        emitAlert({
            kind: alert.kind === 'seller' ? 'seller' : 'buyer',
            sticky: !!alert.sticky || alert.kind === 'seller',
            purchaseId: alert.purchaseId || '',
            title: alert.title || '交易提醒',
            body: alert.body || '',
            url: alert.url || 'market-trades.html',
        });
    }

    function preview() {
        push({
            kind: 'seller',
            sticky: true,
            title: '收到购买请求',
            body: '买家意向：示例配件',
            url: 'market-trades.html?tab=incoming',
        });
        later(function () {
            push({
                kind: 'buyer',
                title: '卖家已确认交易',
                body: '示例配件 已进入待线下交易',
                url: 'market-trades.html?tab=purchases',
            });
        }, 450);
    }

    async function fetchPurchases(role) {
        var r = await fetch(joinUrl('/api/market/my/purchases?role=' + encodeURIComponent(role)), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '加载失败');
        return Array.isArray(data.purchases) ? data.purchases : [];
    }

    function applyAlerts(buyerList, sellerList) {
        var result = collectMarketAlerts(loadState(), buyerList, sellerList);
        saveState(result.state);
        pruneStickyToasts(sellerList);
        (result.alerts || []).forEach(emitAlert);
        return result.alerts;
    }

    async function pollOnce() {
        if (!isLoggedIn()) return [];
        if (pollInFlight) return pollInFlight;
        pollInFlight = (async function () {
            var buyerList = await fetchPurchases('buyer');
            var sellerList = await fetchPurchases('seller');
            return applyAlerts(buyerList, sellerList);
        })().catch(function () {
            return [];
        }).finally(function () {
            pollInFlight = null;
        });
        return pollInFlight;
    }

    function startPolling() {
        if (pollTimer) return;
        pollOnce();
        pollTimer = global.setInterval(pollOnce, POLL_MS);
    }

    function stopPolling() {
        if (!pollTimer) return;
        global.clearInterval(pollTimer);
        pollTimer = null;
    }

    function init() {
        if (typeof document === 'undefined') return;
        if (isLoggedIn()) {
            restoreStickyToasts();
            startPolling();
        }
        if (listenersBound) return;
        listenersBound = true;
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) return;
            if (isLoggedIn()) {
                startPolling();
                pollOnce();
            }
        });
        global.addEventListener('storage', function () {
            if (isLoggedIn()) {
                restoreStickyToasts();
                startPolling();
            } else stopPolling();
        });
        try {
            if (global.location && /(?:\?|&)mktNotifyPreview=1(?:&|$)/.test(String(global.location.search || ''))) {
                preview();
            }
        } catch (e) { /* ignore */ }
    }

    var api = {
        init: init,
        stop: stopPolling,
        pollOnce: pollOnce,
        push: push,
        preview: preview,
        tradesUrl: tradesUrl,
        collectMarketAlerts: collectMarketAlerts,
    };
    global.UssMarketNotify = api;

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
