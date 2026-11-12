
(function (global) {
    'use strict';

    if (global.__ussMarketNotifyLoaded) return;
    global.__ussMarketNotifyLoaded = true;

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var API_BASE = (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
    var STORAGE_KEY = 'ussMarketPurchaseNotifyState';
    var STICKY_KEY = 'ussMarketPurchaseNotifySticky';
    var CHAT_SEEN_KEY = 'ussMarketChatSeen';
    var POLL_MS = 2500;
    var TOAST_MS = 8000;
    var MAX_TOASTS = 4;

    var pollTimer = null;
    var pollInFlight = null;
    var listenersBound = false;
    var toastUid = 0;
    var unreadChatThreads = [];
    var chatScriptPromise = null;
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
            if (!raw) return { initialized: false, purchases: {}, chats: {} };
            var data = JSON.parse(raw);
            return {
                initialized: !!data.initialized,
                purchases: data.purchases && typeof data.purchases === 'object' ? data.purchases : {},
                chats: data.chats && typeof data.chats === 'object' ? data.chats : {},
            };
        } catch (e) {
            return { initialized: false, purchases: {}, chats: {} };
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                initialized: !!state.initialized,
                purchases: state.purchases || {},
                chats: state.chats || {},
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

    function sellerPurchaseAlert(p, title, body) {
        return {
            kind: 'seller',
            sticky: true,
            purchaseId: p && p.id,
            title: title,
            body: body,
            url: tradesUrl('incoming', p && p.id),
            actionLabel: '查看订单',
        };
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
                alerts.push(sellerPurchaseAlert(
                    pending[0],
                    '待确认购买请求',
                    pending.length === 1
                        ? '买家意向：' + primaryItemName(pending[0].order)
                        : '你有 ' + pending.length + ' 笔购买请求待确认'
                ));
            }
            return { alerts: alerts, state: { initialized: true, purchases: nextPurchases, chats: {} } };
        }

        (sellerList || []).forEach(function (p) {
            if (!p || !p.id) return;
            if (p.status !== 'pending' && p.status !== 'approved') return;
            if (!state.purchases[p.id]) {
                alerts.push(sellerPurchaseAlert(
                    p,
                    '买家已提交购买',
                    primaryItemName(p.order)
                ));
            }
        });

        (buyerList || []).forEach(function (p) {
            if (!p || !p.id) return;
            var prev = state.purchases[p.id];
            if (prev && prev.status === 'pending' && p.status === 'approved') {
                alerts.push({
                    kind: 'buyer',
                    title: '交易已开始',
                    body: primaryItemName(p.order) + ' 可以联系卖家了',
                    url: tradesUrl('purchases', p.id),
                    actionLabel: '查看订单',
                });
            }
            if (prev && prev.status === 'pending' && p.status === 'cancelled' && p.cancelledBy === 'seller') {
                alerts.push({
                    kind: 'buyer',
                    title: '卖家已取消这笔交易',
                    body: primaryItemName(p.order) + ' 的购买请求已被拒绝',
                    url: tradesUrl('purchases', p.id),
                    actionLabel: '查看订单',
                });
            }
        });

        rememberPurchases(nextPurchases, buyerList);
        rememberPurchases(nextPurchases, sellerList);
        return { alerts: alerts, state: { initialized: true, purchases: nextPurchases, chats: {} } };
    }

    function canNotify() {
        return typeof Notification !== 'undefined' && Notification.permission === 'granted';
    }

    function showNative(title, body, url, kind) {
        if (!canNotify()) return;
        try {
            var prefix = kind === 'hangar' ? '行政机库 · ' : '星巢贸易 · ';
            var n = new Notification(prefix + String(title || ''), {
                body: body,
                icon: '/favicon-48x48.png',
                tag: kind === 'hangar' ? 'uss-hangar-insert' : 'uss-market-' + String(title || '') + '-' + String(body || ''),
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
            '.mkt-notify-card{pointer-events:auto;position:relative;display:grid;grid-template-columns:3px minmax(0,1fr) 44px;width:100%;overflow:hidden;background:rgba(14, 41, 67,.94);border:1px solid rgba(95,184,255,.18);border-radius:8px;box-shadow:0 16px 40px rgba(0,0,0,.45);backdrop-filter:blur(14px);color:#e8f4ff;transform:translateX(112%);opacity:0;transition:transform .28s ease,opacity .28s ease}' +
            '.mkt-notify-card.is-in{transform:translateX(0);opacity:1}' +
            '.mkt-notify-card.is-out{transform:translateX(112%);opacity:0}' +
            '.mkt-notify-card__bar{background:#5fb8ff}' +
            '.mkt-notify-card--seller .mkt-notify-card__bar{background:#f78f1e}' +
            '.mkt-notify-card--hangar .mkt-notify-card__bar{background:#39ff9a}' +
            '.mkt-notify-card__body{padding:.85rem .2rem .95rem .9rem;min-width:0}' +
            '.mkt-notify-card__kicker{margin:0 0 .12rem;font-size:.625rem;font-weight:700;letter-spacing:.16em;color:rgba(92,228,255,.72)}' +
            '.mkt-notify-card--seller .mkt-notify-card__kicker{color:rgba(247,143,30,.88)}' +
            '.mkt-notify-card--hangar .mkt-notify-card__kicker{color:rgba(57,255,154,.88)}' +
            '.mkt-notify-card__title{margin:0;font-size:.9375rem;font-weight:700;color:#fff;line-height:1.3}' +
            '.mkt-notify-card__text{margin:.35rem 0 .7rem;font-size:.8125rem;line-height:1.45;color:rgba(200,220,235,.78)}' +
            '.mkt-notify-card__action{display:inline-flex;align-items:center;min-height:44px;padding:0;font-size:.75rem;font-weight:700;letter-spacing:.04em;color:#8ee0ff;text-decoration:none}' +
            '.mkt-notify-card__action:hover,.mkt-notify-card__action:focus-visible{color:#9ee8ff;outline:none}' +
            '.mkt-notify-card__close{appearance:none;border:none;background:transparent;color:rgba(200,220,235,.55);font-size:1.35rem;line-height:1;width:44px;height:44px;margin-top:.15rem;cursor:pointer}' +
            '.mkt-notify-card__close:hover,.mkt-notify-card__close:focus-visible{color:#fff;outline:none}' +
            '.mkt-notify-card__timer{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(95,184,255,.38);transform-origin:left center;animation:mkt-notify-timer 8s linear forwards}' +
            '.mkt-notify-card--seller .mkt-notify-card__timer{background:rgba(247,143,30,.5)}' +
            '.mkt-notify-card--hangar .mkt-notify-card__timer{background:rgba(57,255,154,.5)}' +
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
        if (alert.kind === 'hangar') return false;
        return alert.kind === 'seller';
    }

    function stickyFingerprint(alert) {
        if (!alert) return '';
        if (alert.purchaseId) return 'id:' + String(alert.purchaseId);
        return 'url:' + String(alert.url || '') + '|' + String(alert.title || '');
    }

    function isLegacyChatSticky(alert) {
        if (!alert) return false;
        var pid = String(alert.purchaseId || '');
        if (pid.indexOf('chat:') === 0) return true;
        var title = String(alert.title || '');
        return title.indexOf('买家发来消息') !== -1 || title.indexOf('买家消息') !== -1;
    }

    function loadSticky() {
        try {
            if (typeof localStorage === 'undefined') return [];
            var raw = localStorage.getItem(STICKY_KEY);
            if (!raw) return [];
            var data = JSON.parse(raw);
            var list = Array.isArray(data) ? data : [];
            var cleaned = list.filter(function (item) { return !isLegacyChatSticky(item); });
            if (cleaned.length !== list.length) saveSticky(cleaned);
            return cleaned;
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
            actionLabel: alert.actionLabel || '查看订单',
            url: alert.url || tradesUrl('incoming', alert.purchaseId),
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

    function pruneStickyToasts() {
        var next = [];
        loadSticky().forEach(function (item) {
            if (isLegacyChatSticky(item)) return;
            var pid = item && item.purchaseId != null ? String(item.purchaseId) : '';
            if (item && !item.actionLabel) item.actionLabel = '查看订单';
            if (item && (!item.url || String(item.url).indexOf('tab=incoming') === -1)) {
                item.url = tradesUrl('incoming', pid || undefined);
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
        var kind = alert.kind === 'seller' ? 'seller' : alert.kind === 'hangar' ? 'hangar' : 'buyer';
        var url = alert.url || (kind === 'hangar' ? '/executive-hangar' : 'market-trades.html');
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
            '<p class="mkt-notify-card__kicker">' +
            (kind === 'hangar' ? 'EXEC HANGAR' : 'STAR NEST TRADE') +
            '</p>' +
            '<h3 class="mkt-notify-card__title">' + escapeHtml(alert.title || (kind === 'hangar' ? '机库提醒' : '交易提醒')) + '</h3>' +
            '<p class="mkt-notify-card__text">' + escapeHtml(alert.body || '') + '</p>' +
            '<a class="mkt-notify-card__action" href="' + escapeHtml(url) + '">' +
            escapeHtml(alert.actionLabel || (kind === 'hangar' ? '打开行政机库' : '查看订单')) +
            '</a>' +
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
        showNative(alert.title, alert.body, alert.url, alert.kind);
    }

    function push(alert) {
        if (!alert) return;
        var kind = alert.kind === 'seller' ? 'seller' : alert.kind === 'hangar' ? 'hangar' : 'buyer';
        emitAlert({
            kind: kind,
            sticky: kind === 'hangar' ? false : !!alert.sticky || kind === 'seller',
            purchaseId: alert.purchaseId || '',
            title: alert.title || (kind === 'hangar' ? '机库提醒' : '交易提醒'),
            body: alert.body || '',
            url: alert.url || (kind === 'hangar' ? '/executive-hangar' : 'market-trades.html'),
            actionLabel: alert.actionLabel || '',
        });
    }

    function preview() {
        push({
            kind: 'seller',
            sticky: true,
            title: '收到购买请求',
            body: '买家意向：示例配件',
            actionLabel: '查看订单',
            url: 'market-trades.html?tab=incoming',
        });
    }

    async function fetchPurchases(role) {
        var r = await fetch(joinUrl('/api/market/my/purchases?role=' + encodeURIComponent(role)), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '加载失败');
        return Array.isArray(data.purchases) ? data.purchases : [];
    }

    function loadChatSeen() {
        try {
            var raw = localStorage.getItem(CHAT_SEEN_KEY);
            if (!raw) return {};
            var data = JSON.parse(raw);
            return data && typeof data === 'object' ? data : {};
        } catch (e) {
            return {};
        }
    }

    function saveChatSeen(map) {
        try {
            localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(map || {}));
        } catch (e) { /* ignore */ }
    }

    function markChatSeen(purchaseId, lastAt) {
        var pid = String(purchaseId || '').trim();
        if (!pid) return;
        var map = loadChatSeen();
        map[pid] = String(lastAt || new Date().toISOString());
        saveChatSeen(map);
        unreadChatThreads = unreadChatThreads.filter(function (t) {
            return !(t && String(t.purchaseId) === pid);
        });
        renderAvatarChatPings();
    }

    function isChatUnread(thread) {
        if (!thread || !thread.purchaseId || !thread.unreadFromPeer || !thread.lastAt) return false;
        var seen = loadChatSeen()[String(thread.purchaseId)];
        if (!seen) return true;
        return String(seen) < String(thread.lastAt);
    }

    function pickUnreadChats(chatThreads) {
        return (chatThreads || [])
            .filter(isChatUnread)
            .sort(function (a, b) {
                return String((b && b.lastAt) || '').localeCompare(String((a && a.lastAt) || ''));
            });
    }

    function ensureAvatarPing(host, id, drawer) {
        if (!host || typeof document === 'undefined') return null;
        var btn = document.getElementById(id);
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.id = id;
            btn.className = 'market-chat-avatar-ping' + (drawer ? ' market-chat-avatar-ping--drawer' : '');
            btn.hidden = true;
            btn.setAttribute('aria-label', '未读交易消息，点击打开聊天');
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                openLatestUnreadChat();
            });
            host.appendChild(btn);
        }
        return btn;
    }

    function renderAvatarChatPings() {
        if (typeof document === 'undefined') return;
        var has = unreadChatThreads.length > 0;
        var navHost = document.getElementById('navLoginAvatarWrap');
        var navBtn = ensureAvatarPing(navHost, 'marketChatAvatarPingNav', false);
        if (navBtn) {
            navBtn.hidden = !has;
            navBtn.title = has
                ? ('未读交易消息：' + (unreadChatThreads[0].itemName || '打开聊天'))
                : '';
        }
        var drawerImg = document.getElementById('drawerUserAvatarImg');
        var drawerHost = drawerImg && drawerImg.parentElement;
        var drawerBtn = ensureAvatarPing(drawerHost, 'marketChatAvatarPingDrawer', true);
        if (drawerBtn) {
            drawerBtn.hidden = !has;
            drawerBtn.title = has
                ? ('未读交易消息：' + (unreadChatThreads[0].itemName || '打开聊天'))
                : '';
        }
    }

    function ensureMarketChatScript() {
        if (global.UssMarketChat && typeof global.UssMarketChat.open === 'function') {
            return Promise.resolve(global.UssMarketChat);
        }
        if (chatScriptPromise) return chatScriptPromise;
        chatScriptPromise = new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[src*="market-chat.js"]');
            if (existing) {
                var tries = 0;
                var timer = global.setInterval(function () {
                    tries += 1;
                    if (global.UssMarketChat && typeof global.UssMarketChat.open === 'function') {
                        global.clearInterval(timer);
                        resolve(global.UssMarketChat);
                    } else if (tries > 40) {
                        global.clearInterval(timer);
                        reject(new Error('聊天组件加载超时'));
                    }
                }, 50);
                return;
            }
            var s = document.createElement('script');
            s.src = 'market-chat.js?v=5';
            s.defer = true;
            s.onload = function () {
                if (global.UssMarketChat) resolve(global.UssMarketChat);
                else reject(new Error('聊天组件不可用'));
            };
            s.onerror = function () { reject(new Error('聊天组件加载失败')); };
            document.body.appendChild(s);
        });
        return chatScriptPromise;
    }

    function openLatestUnreadChat() {
        var t = unreadChatThreads[0];
        if (!t || !t.purchaseId) return;
        ensureMarketChatScript().then(function (chat) {
            chat.open({
                purchaseId: t.purchaseId,
                itemName: t.itemName || '交易沟通',
                peerName: t.peerBindingId || '',
                myRole: t.myRole || '',
                canSend: t.canSend !== false,
                snapshot: !!t.snapshot,
            });
            markChatSeen(t.purchaseId, t.lastAt);
        }).catch(function (e) {
            global.alert((e && e.message) || '无法打开聊天');
        });
    }

    function applyAlerts(buyerList, sellerList, chatThreads) {
        var result = collectMarketAlerts(loadState(), buyerList, sellerList);
        saveState(result.state);
        pruneStickyToasts(sellerList);
        (result.alerts || []).forEach(emitAlert);
        unreadChatThreads = pickUnreadChats(chatThreads);
        renderAvatarChatPings();
        return result.alerts;
    }

    async function fetchChatThreads() {
        var r = await fetch(joinUrl('/api/market/chat/threads'), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) return [];
        return Array.isArray(data.threads) ? data.threads : [];
    }

    async function fetchPurchasesSafe(role) {
        try {
            return await fetchPurchases(role);
        } catch (e) {
            return [];
        }
    }

    async function pollOnce() {
        if (!isLoggedIn()) return [];
        if (pollInFlight) return pollInFlight;
        pollInFlight = (async function () {
            var packed = await Promise.all([
                fetchPurchasesSafe('buyer'),
                fetchPurchasesSafe('seller'),
                fetchChatThreads(),
            ]);
            return applyAlerts(packed[0], packed[1], packed[2]);
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
        global.addEventListener('focus', function () {
            if (isLoggedIn()) pollOnce();
        });
        global.addEventListener('storage', function () {
            if (isLoggedIn()) {
                restoreStickyToasts();
                startPolling();
                pollOnce();
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
        markChatSeen: markChatSeen,
        refreshChatPings: function () {
            return pollOnce();
        },
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
