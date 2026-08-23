/**
 * 星巢贸易 — 购买订单浏览器通知（买家/卖家）
 */
(function () {
    'use strict';

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var API_BASE = (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
    var STORAGE_KEY = 'ussMarketPurchaseNotifyState';
    var POLL_MS = 30000;

    var pollTimer = null;

    function joinUrl(path) {
        return String(API_BASE).replace(/\/$/, '') + path;
    }

    function loadSession() {
        if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.loadAuthSession === 'function') {
            return window.UssAuthSessionSync.loadAuthSession();
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

    function canNotify() {
        return typeof Notification !== 'undefined' && Notification.permission === 'granted';
    }

    function requestPermission() {
        if (typeof Notification === 'undefined') return Promise.resolve(false);
        if (Notification.permission === 'granted') return Promise.resolve(true);
        if (Notification.permission === 'denied') return Promise.resolve(false);
        return Notification.requestPermission().then(function (p) { return p === 'granted'; });
    }

    function showNotification(title, body, url) {
        if (!canNotify()) return;
        try {
            var n = new Notification(title, {
                body: body,
                icon: '/favicon-48x48.png',
                tag: 'uss-market-' + Date.now(),
            });
            n.onclick = function () {
                window.focus();
                n.close();
                if (url) window.location.href = url;
            };
        } catch (e) { /* ignore */ }
    }

    async function fetchPurchases(role) {
        var r = await fetch(joinUrl('/api/market/my/purchases?role=' + encodeURIComponent(role)), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '加载失败');
        return Array.isArray(data.purchases) ? data.purchases : [];
    }

    function rememberPurchases(state, list) {
        (list || []).forEach(function (p) {
            if (!p || !p.id) return;
            state.purchases[p.id] = {
                status: p.status,
                updatedAt: p.updatedAt || p.createdAt || '',
            };
        });
    }

    function processNotifications(buyerList, sellerList) {
        var state = loadState();
        if (!state.initialized) {
            rememberPurchases(state, buyerList);
            rememberPurchases(state, sellerList);
            state.initialized = true;
            saveState(state);
            return;
        }

        (sellerList || []).forEach(function (p) {
            if (!p || !p.id || p.status !== 'pending') return;
            var prev = state.purchases[p.id];
            if (!prev) {
                var item = primaryItemName(p.order);
                showNotification(
                    '星巢贸易 · 收到购买请求',
                    '买家意向：' + item,
                    tradesUrl('incoming', p.id)
                );
            }
        });

        (buyerList || []).forEach(function (p) {
            if (!p || !p.id) return;
            var prev = state.purchases[p.id];
            if (prev && prev.status === 'pending' && p.status === 'approved') {
                var item = primaryItemName(p.order);
                showNotification(
                    '星巢贸易 · 卖家已确认交易',
                    item + ' 已进入待线下交易',
                    tradesUrl('purchases', p.id)
                );
            }
        });

        rememberPurchases(state, buyerList);
        rememberPurchases(state, sellerList);
        saveState(state);
    }

    async function pollOnce() {
        if (!isLoggedIn()) return;
        try {
            var buyerList = await fetchPurchases('buyer');
            var sellerList = await fetchPurchases('seller');
            processNotifications(buyerList, sellerList);
        } catch (e) { /* ignore poll errors */ }
    }

    function startPolling() {
        if (pollTimer) return;
        pollOnce();
        pollTimer = window.setInterval(pollOnce, POLL_MS);
    }

    function stopPolling() {
        if (!pollTimer) return;
        window.clearInterval(pollTimer);
        pollTimer = null;
    }

    function init() {
        if (!isLoggedIn()) return;
        requestPermission().finally(function () {
            startPolling();
        });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) return;
            pollOnce();
        });
    }

    window.UssMarketNotify = {
        init: init,
        stop: stopPolling,
        requestPermission: requestPermission,
        pollOnce: pollOnce,
        tradesUrl: tradesUrl,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
