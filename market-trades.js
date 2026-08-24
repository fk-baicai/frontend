/**
 * 星巢贸易 — 买家/卖家订单中心
 */
(function () {
    'use strict';

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var API_BASE = (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
    var MAX_PROOF_IMAGE_BYTES = 1024 * 1024;

    var PURCHASE_STATUS_LABEL = {
        pending: '待卖家确认交易',
        approved: '待线下交易',
        completed: '已完成',
        cancelled: '已取消',
    };

    var VALID_TABS = { sell: 1, buy: 1, purchases: 1, incoming: 1, reviews: 1 };
    var TAB_STORAGE_KEY = 'ussMarketTradesTab';

    var state = {
        tab: 'sell',
        orders: [],
        purchases: [],
        loading: false,
        userStats: null,
        completingPurchaseId: null,
        completeRating: 0,
        highlightPurchaseId: '',
    };

    var el = {};

    function $(id) { return document.getElementById(id); }

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

    function isLoggedIn() {
        var s = loadSession();
        return !!(s && s.token);
    }

    function authHeaders() {
        var s = loadSession();
        if (!s || !s.token) return {};
        return { Authorization: 'Bearer ' + s.token };
    }

    function formatTradeError(data, fallback) {
        if (data && data.code && window.UssApiError && typeof window.UssApiError.formatUserError === 'function') {
            var hinted = window.UssApiError.formatUserError(data.code);
            if (hinted) return hinted;
        }
        return (data && data.message) || fallback || '操作失败';
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function primaryItemName(order) {
        var it = (order && order.items && order.items[0]) || {};
        return it.nameZh || it.name || '未填物品';
    }

    function formatPrice(order, quantity) {
        if (!order || order.tradeType === 'barter') {
            var want = (order.items && order.items[1]) || {};
            var wantName = want.nameZh || want.name;
            if (wantName) return '换取 ' + wantName;
            return '物品置换';
        }
        var item = (order.items && order.items[0]) || {};
        if (item.pricePerUnit == null) return '面议';
        var qty = Math.max(1, Math.floor(Number(quantity) || 1));
        var unit = Number(item.pricePerUnit);
        if (qty <= 1) return unit.toLocaleString('zh-CN') + ' aUEC';
        return unit.toLocaleString('zh-CN') + ' aUEC × ' + qty + ' = ' + (unit * qty).toLocaleString('zh-CN') + ' aUEC';
    }

    function formatExpires(iso) {
        if (!iso) return '无限';
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '无限';
        var d = Math.max(0, Math.ceil((t - Date.now()) / 86400000));
        return d + ' 天';
    }

    function formatDateYmd(iso) {
        if (window.UssMarket && typeof window.UssMarket.formatDateYmd === 'function') {
            return window.UssMarket.formatDateYmd(iso);
        }
        if (!iso) return '';
        var t = Date.parse(String(iso));
        if (!Number.isFinite(t)) return '';
        var d = new Date(t);
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }

    function dateDayHtml(iso, extraClass) {
        var day = formatDateYmd(iso);
        if (!day) return '';
        return (
            '<time' + (extraClass ? ' class="' + extraClass + '"' : '') +
            ' datetime="' + escapeHtml(String(iso)) + '">' +
            escapeHtml(day) +
            '</time>'
        );
    }

    function formatDateMinute(iso) {
        if (window.UssMarket && typeof window.UssMarket.formatDateMinute === 'function') {
            return window.UssMarket.formatDateMinute(iso);
        }
        if (!iso) return '';
        var t = Date.parse(String(iso));
        if (!Number.isFinite(t)) return '';
        var d = new Date(t);
        function pad(n) { return n < 10 ? '0' + n : String(n); }
        return (
            d.getFullYear() +
            '-' + pad(d.getMonth() + 1) +
            '-' + pad(d.getDate()) +
            ' ' + pad(d.getHours()) +
            ':' + pad(d.getMinutes())
        );
    }

    function dateTimeHtml(iso, extraClass) {
        if (window.UssMarket && typeof window.UssMarket.dateTimeHtml === 'function') {
            return window.UssMarket.dateTimeHtml(iso, extraClass);
        }
        var full = formatDateMinute(iso);
        if (!full) return '';
        return (
            '<time' + (extraClass ? ' class="' + extraClass + '"' : '') +
            ' datetime="' + escapeHtml(String(iso)) +
            '" title="' + escapeHtml(full) + '">' +
            escapeHtml(full) +
            '</time>'
        );
    }

    function timeLineHtml(label, iso) {
        if (window.UssMarket && typeof window.UssMarket.timeLineHtml === 'function') {
            return window.UssMarket.timeLineHtml(label, iso);
        }
        var stamp = dateTimeHtml(iso);
        if (!stamp) return '';
        return (
            '<p class="market-time-line">' +
            '<span class="market-time-line__label">' + escapeHtml(label) + '</span>' +
            stamp +
            '</p>'
        );
    }

    function buyerReviewAt(p) {
        return p.reviewAt || (p.reviewRating ? (p.completedAt || p.updatedAt) : '');
    }

    function sellerReviewAt(p) {
        return p.sellerReviewAt || (p.sellerReviewRating ? (p.completedAt || p.updatedAt) : '');
    }

    function showGate(msg) {
        if (!el.gate) return;
        el.gate.textContent = msg || '请先登录';
        el.gate.classList.remove('is-hidden');
        if (el.content) el.content.hidden = true;
    }

    function hideGate() {
        if (el.gate) el.gate.classList.add('is-hidden');
        if (el.content) el.content.hidden = false;
    }

    function syncTabs() {
        if (!el.tabs) return;
        el.tabs.forEach(function (btn) {
            var active = btn.getAttribute('data-tab') === state.tab;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function persistTabToUrl() {
        try {
            var url = new URL(window.location.href);
            if (url.searchParams.get('tab') !== state.tab) {
                url.searchParams.set('tab', state.tab);
                window.history.replaceState(null, '', url.pathname + url.search + url.hash);
            }
            window.sessionStorage.setItem(TAB_STORAGE_KEY, state.tab);
        } catch (e) { /* ignore */ }
    }

    function setActiveTab(tab, options) {
        var next = VALID_TABS[tab] ? tab : 'sell';
        var silent = options && options.silent;
        if (state.tab === next) {
            persistTabToUrl();
            return;
        }
        state.tab = next;
        syncTabs();
        persistTabToUrl();
        if (!silent) loadTabData();
    }

    async function fetchMyOrders(orderType) {
        var params = new URLSearchParams();
        if (orderType) params.set('orderType', orderType);
        params.set('includeExpired', '1');
        var r = await fetch(joinUrl('/api/market/my/orders?' + params.toString()), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '加载失败');
        return Array.isArray(data.orders) ? data.orders : [];
    }

    async function fetchPurchases(role) {
        var r = await fetch(joinUrl('/api/market/my/purchases?role=' + encodeURIComponent(role)), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '加载失败');
        return Array.isArray(data.purchases) ? data.purchases : [];
    }

    async function fetchMyStats() {
        var r = await fetch(joinUrl('/api/market/my/stats'), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '加载统计失败');
        return (data && data.stats) || null;
    }

    function normalizeTradeCount(v) {
        var n = v != null ? Number(v) : 0;
        if (!Number.isFinite(n) || n < 0) n = 0;
        return n;
    }

    function renderUserStats() {
        var countEl = $('marketTradesUserTradeCount');
        var ratingEl = $('marketTradesUserRating');
        if (!countEl) return;
        var stats = state.userStats || {};
        countEl.textContent = String(normalizeTradeCount(stats.completedTradeCount));
        if (ratingEl) {
            var avg = stats.averageRating != null ? Number(stats.averageRating) : null;
            var rc = stats.reviewCount != null ? Number(stats.reviewCount) : 0;
            if (avg != null && Number.isFinite(avg) && rc > 0) {
                ratingEl.textContent = ' · 好评 ' + avg.toFixed(1) + '★';
                ratingEl.hidden = false;
            } else {
                ratingEl.textContent = '';
                ratingEl.hidden = true;
            }
        }
    }

    async function loadUserStats() {
        try {
            state.userStats = await fetchMyStats();
        } catch (e) {
            state.userStats = { completedTradeCount: 0, averageRating: null, reviewCount: 0 };
        }
        renderUserStats();
    }

    function sellerTradeCountFromOrder(order) {
        if (!order) return null;
        var seller = order.seller;
        if (seller && seller.completedTradeCount != null) {
            return normalizeTradeCount(seller.completedTradeCount);
        }
        if (order.completedTradeCount != null) {
            return normalizeTradeCount(order.completedTradeCount);
        }
        return null;
    }

    async function loadTabData() {
        state.loading = true;
        renderPanel();
        try {
            if (state.tab === 'sell') {
                state.orders = await fetchMyOrders('sell');
                state.purchases = [];
            } else if (state.tab === 'buy') {
                state.orders = await fetchMyOrders('buy');
                state.purchases = [];
            } else if (state.tab === 'purchases') {
                state.orders = [];
                state.purchases = await fetchPurchases('buyer');
            } else if (state.tab === 'reviews') {
                var buyerList = await fetchPurchases('buyer');
                var sellerList = await fetchPurchases('seller');
                var seen = {};
                state.orders = [];
                state.purchases = buyerList.concat(sellerList).filter(function (p) {
                    if (!p || p.status !== 'completed' || seen[p.id]) return false;
                    seen[p.id] = true;
                    return true;
                });
            } else {
                state.orders = [];
                state.purchases = await fetchPurchases('seller');
            }
        } catch (e) {
            state.orders = [];
            state.purchases = [];
            if (el.empty) {
                el.empty.hidden = false;
                el.empty.textContent = (e && e.message) || '加载失败';
            }
        } finally {
            state.loading = false;
            renderPanel();
            if (window.UssMarketNotify && typeof window.UssMarketNotify.pollOnce === 'function') {
                window.UssMarketNotify.pollOnce();
            }
        }
    }

    function orderRowHtml(o) {
        var loc = (o.location && o.location.name) || '未指定地点';
        var status = o.status === 'closed' ? '已下架' : '进行中';
        return (
            '<article class="market-trades-row" data-order-id="' + escapeHtml(o.id) + '">' +
            '<div class="market-trades-row__main">' +
            '<h3 class="market-trades-row__title">' + escapeHtml(primaryItemName(o)) + '</h3>' +
            '<p class="market-trades-row__meta">' + escapeHtml(formatPrice(o)) + ' · ×' + escapeHtml((o.items[0] && o.items[0].quantity) || 1) +
            ' · ' + escapeHtml(loc) + ' · 剩余 ' + escapeHtml(formatExpires(o.expiresAt)) +
            '</p>' +
            '<span class="market-trades-row__status">' + escapeHtml(status) + '</span>' +
            '</div>' +
            '<div class="market-trades-row__actions">' +
            '<button type="button" class="market-btn market-trades-btn-edit" data-order-id="' + escapeHtml(o.id) + '">编辑</button>' +
            (o.status === 'closed'
                ? '<button type="button" class="market-btn market-btn--accent market-trades-btn-relist" data-order-id="' + escapeHtml(o.id) + '">再次上架</button>'
                : '<button type="button" class="market-btn market-trades-btn-close" data-order-id="' + escapeHtml(o.id) + '">下架</button>') +
            '<button type="button" class="market-btn market-trades-btn-delete" data-order-id="' + escapeHtml(o.id) + '">删除</button>' +
            '</div>' +
            '</article>'
        );
    }

    function findPurchase(id) {
        return state.purchases.find(function (p) { return p && p.id === id; }) || null;
    }

    function openReadonlyListing(order) {
        if (!order) {
            window.alert('暂无商品快照，无法查看详情');
            return;
        }
        if (window.UssMarket && typeof window.UssMarket.openListingDetail === 'function') {
            window.UssMarket.openListingDetail(order, { readOnly: true, unlockSellerContact: true });
            return;
        }
        window.alert('无法打开商品详情');
    }

    function proofUploadBtnHtml(purchaseId, proofType, done, label) {
        if (done) {
            return '<span class="market-trades-proof-done">' + escapeHtml(label) + '已上传</span>';
        }
        return (
            '<label class="market-trades-proof-upload">' +
            '<input type="file" class="market-trades-proof-file" data-proof-type="' + escapeHtml(proofType) + '" data-purchase-id="' + escapeHtml(purchaseId) + '" accept="image/jpeg,image/png,image/webp,image/gif" hidden>' +
            '<span class="market-btn">' + escapeHtml(label) + '</span>' +
            '</label>'
        );
    }

    function canCancelPurchase(p, role) {
        if (!p) return false;
        if (p.status === 'pending') return true;
        if (p.status !== 'approved') return false;
        if (role === 'buyer') return !p.buyerTransferProofUrl;
        if (role === 'seller') return !p.sellerProofImageUrl;
        return false;
    }

    function cancelPurchaseBtnHtml(purchaseId, label) {
        return '<button type="button" class="market-btn market-trades-btn-cancel-purchase" data-purchase-id="' + escapeHtml(purchaseId) + '">' + escapeHtml(label) + '</button>';
    }

    function buildPurchaseActions(p, role) {
        var actions = '';
        if (p.status === 'pending') {
            if (role === 'seller') {
                actions = '<button type="button" class="market-btn market-btn--accent market-trades-btn-approve" data-purchase-id="' + escapeHtml(p.id) + '">确认交易</button>' +
                    '<button type="button" class="market-btn market-trades-btn-cancel-purchase" data-purchase-id="' + escapeHtml(p.id) + '">拒绝</button>';
            } else {
                actions = '<span class="market-trades-wait-hint">等待卖家确认交易</span>' +
                    '<button type="button" class="market-btn market-trades-btn-cancel-purchase" data-purchase-id="' + escapeHtml(p.id) + '">取消购买</button>';
            }
        } else if (p.status === 'approved') {
            if (role === 'buyer') {
                var sellerProofHint = p.sellerProofImageUrl
                    ? '<span class="market-trades-proof-done">卖家交易凭证已上传</span>'
                    : '<span class="market-trades-wait-hint">等待卖家上传交易凭证…</span>';
                actions =
                    proofUploadBtnHtml(p.id, 'transfer', p.buyerTransferProofUrl, '上传转账截图') +
                    sellerProofHint +
                    '<button type="button" class="market-btn market-btn--accent market-trades-btn-complete-open" data-purchase-id="' + escapeHtml(p.id) + '">完成交易</button>';
                if (canCancelPurchase(p, 'buyer')) {
                    actions += cancelPurchaseBtnHtml(p.id, '取消订单');
                }
            } else {
                var autoHint = p.autoCompleteAt
                    ? '等待买家确认完成（到期将自动成交）'
                    : '等待买家确认完成（3 天未操作将自动完成）';
                actions =
                    proofUploadBtnHtml(p.id, 'seller', p.sellerProofImageUrl, '上传交易凭证') +
                    '<span class="market-trades-wait-hint">' + autoHint + '</span>';
                if (canCancelPurchase(p, 'seller')) {
                    actions += cancelPurchaseBtnHtml(p.id, '取消订单');
                }
            }
        } else if (p.status === 'completed') {
            if (p.completedBy === 'auto') {
                actions = '<span class="market-trades-wait-hint">系统已自动完成交易</span>';
            }
            if (!p.reviewRating && role === 'buyer') {
                actions += reviewFormHtml(p.id, 'buyer');
            }
            if (!p.sellerReviewRating && role === 'seller') {
                actions += reviewFormHtml(p.id, 'seller');
            }
        } else if (p.status === 'cancelled') {
            actions = '<span class="market-trades-wait-hint">订单已取消</span>' +
                '<button type="button" class="market-btn market-trades-btn-delete-purchase" data-purchase-id="' + escapeHtml(p.id) + '">删除</button>';
        }
        return actions;
    }

    function reviewFormHtml(purchaseId, role) {
        return (
            '<form class="market-trades-review-form" data-purchase-id="' + escapeHtml(purchaseId) + '" data-review-role="' + escapeHtml(role) + '">' +
            '<label>评分 <select name="rating">' +
            '<option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option>' +
            '</select></label>' +
            '<input type="text" name="text" maxlength="200" placeholder="评价（选填）">' +
            '<button type="submit" class="market-btn market-btn--accent">提交评价</button>' +
            '</form>'
        );
    }

    function reviewStarsHtml(rating) {
        var n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
        var html = '<span class="market-trades-review__stars" aria-label="' + n + '星">';
        var i;
        for (i = 1; i <= 5; i++) {
            html += '<span' + (i <= n ? ' class="is-on"' : '') + ' aria-hidden="true">★</span>';
        }
        return html + '</span>';
    }

    function fallbackAvatar() {
        return window.USS_DEFAULT_AVATAR || 'default-avatar.webp';
    }

    function partyName(p, who) {
        if (who === 'buyer') return p.buyerDisplayName || p.buyerBindingId || '—';
        return p.sellerDisplayName || p.sellerBindingId || '—';
    }

    function partyAvatarUrl(p, who) {
        var fromApi;
        if (who === 'buyer') {
            fromApi = p.buyerAvatarUrl || null;
        } else {
            var order = p && p.order;
            var seller = order && order.seller;
            fromApi =
                p.sellerAvatarUrl ||
                (seller && seller.avatarUrl) ||
                (order && order.avatarUrl) ||
                null;
        }
        if (fromApi) return fromApi;
        var sess = loadSession();
        var sessBid = sess && sess.bindingId != null ? String(sess.bindingId).trim().toLowerCase() : '';
        var partyBid = who === 'buyer'
            ? String(p.buyerBindingId || p.buyerDisplayName || '').trim().toLowerCase()
            : String(p.sellerBindingId || p.sellerDisplayName || '').trim().toLowerCase();
        if (sessBid && partyBid && sessBid === partyBid) {
            return sess.avatarUrl || sess.rsiCitizenAvatarSourceUrl || null;
        }
        return null;
    }

    function partyChipHtml(name, avatarUrl) {
        var src = mediaUrl(avatarUrl) || fallbackAvatar();
        return (
            '<span class="market-trades-person">' +
            '<img class="market-trades-person__avatar" src="' + escapeHtml(src) + '" alt="" onerror="this.onerror=null;this.src=\'' + escapeHtml(fallbackAvatar()) + '\'">' +
            '<span class="market-trades-person__name">' + escapeHtml(name || '—') + '</span>' +
            '</span>'
        );
    }

    function reviewQuoteHtml(label, name, avatarUrl, rating, text, formHtml, at) {
        var timeHtml = dateDayHtml(at, 'market-trades-review__time');
        var src = mediaUrl(avatarUrl) || fallbackAvatar();
        var inner = formHtml
            ? formHtml
            : (rating
                ? reviewStarsHtml(rating) + (text ? '<span class="market-trades-review__quote">' + escapeHtml(text) + '</span>' : '')
                : '<span class="market-trades-review__empty">暂无</span>');
        return (
            '<div class="market-trades-review__side">' +
            '<span class="market-trades-review__who">' +
            '<span class="market-trades-review__who-main">' +
            '<img class="market-trades-person__avatar" src="' + escapeHtml(src) + '" alt="" onerror="this.onerror=null;this.src=\'' + escapeHtml(fallbackAvatar()) + '\'">' +
            '<span class="market-trades-review__who-label">' + escapeHtml(label) + '</span>' +
            '<span class="market-trades-review__who-name">' + escapeHtml(name || '—') + '</span>' +
            '</span>' +
            (timeHtml || '') +
            '</span>' +
            '<div class="market-trades-review__content">' + inner + '</div>' +
            '</div>'
        );
    }

    function reviewEntryHtml(p, role) {
        var order = p.order || {};
        var title = primaryItemName(order);
        var buyerForm = !p.reviewRating && role === 'buyer' ? reviewFormHtml(p.id, 'buyer') : '';
        var sellerForm = !p.sellerReviewRating && role === 'seller' ? reviewFormHtml(p.id, 'seller') : '';
        var buyerName = partyName(p, 'buyer');
        var sellerName = partyName(p, 'seller');
        return (
            '<article class="market-card market-card--purchase market-card--review" data-purchase-id="' + escapeHtml(p.id) + '" role="listitem">' +
            '<div class="market-card__media">' +
            purchaseCardMediaHtml(order) +
            '</div>' +
            '<div class="market-card__info">' +
            '<div class="market-card__text">' +
            '<span class="market-card__cat">' + purchaseCardMetaLine(order, p.quantity) + '</span>' +
            '<h2 class="market-card__title">' + escapeHtml(title) + '</h2>' +
            '<p class="market-card__price">' + escapeHtml(formatPrice(order, p.quantity || 1)) + '</p>' +
            '</div>' +
            '</div>' +
            '<div class="market-trades-review__meta">' +
            '<p class="market-trades-review__party">' +
            '<span class="market-trades-review__party-k">卖家</span>' +
            partyChipHtml(sellerName, partyAvatarUrl(p, 'seller')) +
            '</p>' +
            '<div class="market-trades-review__quotes">' +
            reviewQuoteHtml('买家评价', buyerName, partyAvatarUrl(p, 'buyer'), p.reviewRating, p.reviewText, buyerForm, buyerReviewAt(p)) +
            reviewQuoteHtml('回复', sellerName, partyAvatarUrl(p, 'seller'), p.sellerReviewRating, p.sellerReviewText, sellerForm, sellerReviewAt(p)) +
            '</div>' +
            '</div>' +
            '</article>'
        );
    }

    function mediaUrl(rel) {
        if (!rel) return '';
        var s = String(rel);
        if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) return s;
        if (window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === 'function') {
            var u = window.UssAuthApi.resolveAssetUrl(s);
            if (u) return u;
        }
        return joinUrl(s.charAt(0) === '/' ? s : '/' + s);
    }

    function proofThumbHtml(url, alt, iso) {
        var src = mediaUrl(url);
        if (!src) return '';
        var dayHtml = dateDayHtml(iso);
        return (
            '<figure class="market-trades-proof-fig">' +
            '<button type="button" class="market-trades-proof-thumb" data-proof-lightbox="1" data-src="' +
            escapeHtml(src) +
            '" title="点击查看大图" aria-label="' +
            escapeHtml(alt) +
            '">' +
            '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' +
            '</button>' +
            '<figcaption class="market-trades-proof-time">' +
            '<span class="market-trades-proof-k">' + escapeHtml(alt) + '</span>' +
            (dayHtml || '') +
            '</figcaption>' +
            '</figure>'
        );
    }

    function proofThumbsHtml(p) {
        var html = '<div class="market-trades-proof-thumbs">';
        if (p.buyerTransferProofUrl) {
            html += proofThumbHtml(p.buyerTransferProofUrl, '买家凭证', p.buyerTransferProofAt);
        } else {
            html += '<span class="market-trades-wait-hint">买家凭证未传</span>';
        }
        if (p.sellerProofImageUrl) {
            html += proofThumbHtml(p.sellerProofImageUrl, '卖家凭证', p.sellerProofAt);
        } else {
            html += '<span class="market-trades-wait-hint">卖家凭证未传</span>';
        }
        html += '</div>';
        return html;
    }

    function openProofLightbox(src) {
        if (!src) return;
        if (window.UssCommunityImageLightbox && typeof window.UssCommunityImageLightbox.open === 'function') {
            window.UssCommunityImageLightbox.open(src);
            return;
        }
        window.open(src, '_blank', 'noopener,noreferrer');
    }

    function purchaseCardMediaHtml(order) {
        if (window.UssMarket && typeof window.UssMarket.cardMediaHtml === 'function') {
            return window.UssMarket.cardMediaHtml(order);
        }
        var title = primaryItemName(order);
        return '<span class="market-card__media--empty">' + escapeHtml(title.charAt(0) || '?') + '</span>';
    }

    function purchaseCardMetaLine(order, purchaseQty) {
        var qty = Math.max(1, Math.floor(Number(purchaseQty) || 1));
        if (window.UssMarket && typeof window.UssMarket.primaryCategory === 'function' && typeof window.UssMarket.formatQualityBrief === 'function') {
            return escapeHtml(window.UssMarket.primaryCategory(order)) + ' · ' + escapeHtml(window.UssMarket.formatQualityBrief(order)) + ' · 购买 ×' + escapeHtml(String(qty));
        }
        var it = (order && order.items && order.items[0]) || {};
        return '购买数量 ×' + escapeHtml(String(qty));
    }

    function purchaseProofSummaryHtml(p, role) {
        var parts = [];
        if (role === 'buyer') {
            parts.push(p.buyerTransferProofUrl ? '转账截图已传' : '转账截图未传');
            parts.push(p.sellerProofImageUrl ? '卖家凭证已传' : '卖家凭证未传');
        } else {
            parts.push(p.sellerProofImageUrl ? '交易凭证已传' : '交易凭证未传');
        }
        return '<p class="market-card__purchase-proof">' + escapeHtml(parts.join(' · ')) + '</p>';
    }

    function purchaseCardHtml(p, role) {
        var order = p.order || {};
        var title = primaryItemName(order);
        var price = formatPrice(order, p.quantity || 1);
        var partyHtml = role === 'seller'
            ? ('<span class="market-card__purchase-party-k">买家</span>' + partyChipHtml(partyName(p, 'buyer'), partyAvatarUrl(p, 'buyer')))
            : ('<span class="market-card__purchase-party-k">卖家</span>' + partyChipHtml(partyName(p, 'seller'), partyAvatarUrl(p, 'seller')));
        if (role === 'buyer') {
            var sellerTrades = sellerTradeCountFromOrder(order);
            if (sellerTrades != null) {
                partyHtml += '<span class="market-card__purchase-party-extra">交易：' + escapeHtml(String(sellerTrades)) + '</span>';
            }
        }
        var status = PURCHASE_STATUS_LABEL[p.status] || p.status;
        var highlightCls = state.highlightPurchaseId && state.highlightPurchaseId === p.id ? ' is-highlighted' : '';
        var actions = buildPurchaseActions(p, role);
        return (
            '<article class="market-card market-card--purchase market-card--purchase-' + escapeHtml(p.status) + highlightCls + '" data-purchase-id="' + escapeHtml(p.id) + '" role="listitem">' +
            '<div class="market-card__media">' +
            '<span class="market-card__badge market-card__badge--purchase">' + escapeHtml(status) + '</span>' +
            purchaseCardMediaHtml(order) +
            '</div>' +
            '<div class="market-card__info">' +
            '<div class="market-card__text">' +
            '<span class="market-card__cat">' + purchaseCardMetaLine(order, p.quantity) + '</span>' +
            '<h2 class="market-card__title">' + escapeHtml(title) + '</h2>' +
            '<p class="market-card__price">' + escapeHtml(price) + '</p>' +
            '</div>' +
            '</div>' +
            '<div class="market-card__purchase-meta">' +
            '<p class="market-card__purchase-party">' + partyHtml + '</p>' +
            purchaseProofSummaryHtml(p, role) +
            (p.status === 'completed' || p.buyerTransferProofUrl || p.sellerProofImageUrl ? proofThumbsHtml(p) : '') +
            '</div>' +
            (actions ? '<div class="market-card__purchase-actions">' + actions + '</div>' : '') +
            '</article>'
        );
    }

    function purchaseRowHtml(p, role) {
        return purchaseCardHtml(p, role);
    }

    function orderCardHtml(o) {
        if (window.UssMarket && typeof window.UssMarket.renderManageOrderCardHtml === 'function') {
            return window.UssMarket.renderManageOrderCardHtml(o);
        }
        return orderRowHtml(o);
    }

    function renderPanel() {
        if (!el.panel) return;
        if (state.loading) {
            el.panel.className = 'market-trades-panel market-trades-grid';
            el.panel.innerHTML = '<p class="market-empty">加载中…</p>';
            if (el.empty) el.empty.hidden = true;
            return;
        }
        var html = '';
        if (state.tab === 'sell' || state.tab === 'buy') {
            el.panel.className = 'market-trades-panel market-trades-grid';
            if (!state.orders.length) {
                if (el.empty) {
                    el.empty.hidden = false;
                    el.empty.textContent = state.tab === 'sell' ? '暂无出售挂单' : '暂无求购挂单';
                }
                el.panel.innerHTML = '';
                return;
            }
            html = state.orders.map(orderCardHtml).join('');
        } else if (state.tab === 'reviews') {
            el.panel.className = 'market-trades-panel market-trades-grid';
            if (!state.purchases.length) {
                if (el.empty) {
                    el.empty.hidden = false;
                    el.empty.textContent = '暂无已完成交易可评价';
                }
                el.panel.innerHTML = '';
                return;
            }
            html = state.purchases.map(function (p) {
                var sess = loadSession();
                var myBid = sess && sess.bindingId ? String(sess.bindingId).toLowerCase() : '';
                var cardRole = String(p.sellerBindingId || '').toLowerCase() === myBid ? 'seller' : 'buyer';
                return reviewEntryHtml(p, cardRole);
            }).join('');
        } else {
            el.panel.className = 'market-trades-panel market-trades-grid';
            var role = state.tab === 'incoming' ? 'seller' : 'buyer';
            if (!state.purchases.length) {
                if (el.empty) {
                    el.empty.hidden = false;
                    el.empty.textContent = state.tab === 'incoming' ? '暂无收到的购买订单' : '暂无购买记录';
                }
                el.panel.innerHTML = '';
                return;
            }
            html = state.purchases.map(function (p) {
                return purchaseCardHtml(p, role);
            }).join('');
        }
        if (el.empty) el.empty.hidden = true;
        el.panel.innerHTML = html;
        focusHighlightedPurchase();
    }

    function focusHighlightedPurchase() {
        if (!state.highlightPurchaseId || !el.panel) return;
        var card = el.panel.querySelector('[data-purchase-id="' + state.highlightPurchaseId + '"]');
        if (!card) return;
        card.classList.add('is-highlighted');
        window.requestAnimationFrame(function () {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        window.setTimeout(function () {
            card.classList.remove('is-highlighted');
            state.highlightPurchaseId = '';
        }, 3200);
    }

    function applyRouteFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search);
            var tab = params.get('tab');
            if (!VALID_TABS[tab]) {
                try { tab = window.sessionStorage.getItem(TAB_STORAGE_KEY); } catch (e1) { tab = ''; }
            }
            if (VALID_TABS[tab]) state.tab = tab;
            var highlight = params.get('highlight');
            if (highlight) state.highlightPurchaseId = String(highlight).trim();
        } catch (e) { /* ignore */ }
        persistTabToUrl();
    }

    function findOrder(id) {
        return state.orders.find(function (o) { return o.id === id; }) || null;
    }

    function openOrderEditor(orderId) {
        var order = findOrder(orderId);
        if (!order) return;
        if (window.UssMarket && typeof window.UssMarket.openEditModal === 'function') {
            window.UssMarket.openEditModal(order);
            return;
        }
        window.alert('编辑表单加载中，请刷新页面后重试');
    }

    async function patchOrder(orderId, body) {
        var r = await fetch(joinUrl('/api/market/orders/' + encodeURIComponent(orderId)), {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders()),
            body: JSON.stringify(body),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(formatTradeError(data, '操作失败'));
    }

    async function deleteOrder(orderId) {
        var r = await fetch(joinUrl('/api/market/orders/' + encodeURIComponent(orderId)), {
            method: 'DELETE',
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(formatTradeError(data, '删除失败'));
    }

    async function deletePurchase(purchaseId) {
        var r = await fetch(joinUrl('/api/market/purchases/' + encodeURIComponent(purchaseId)), {
            method: 'DELETE',
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(formatTradeError(data, '删除失败'));
    }

    async function patchPurchase(purchaseId, body) {
        var r = await fetch(joinUrl('/api/market/purchases/' + encodeURIComponent(purchaseId)), {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders()),
            body: JSON.stringify(body),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(formatTradeError(data, '操作失败'));
    }

    function openCompleteModal(purchaseId) {
        var purchase = findPurchase(purchaseId);
        if (!purchase) return;
        if (!purchase.sellerProofImageUrl) {
            askConfirm({
                title: '完成交易',
                message: '须卖家上传交易凭证后才能完成交易',
                confirmText: '知道了',
                notice: true,
            });
            return;
        }
        if (!purchase.buyerTransferProofUrl) {
            askConfirm({
                title: '完成交易',
                message: '请先上传转账截图',
                confirmText: '知道了',
                notice: true,
            });
            return;
        }
        state.completingPurchaseId = purchaseId;
        state.completeRating = 0;
        if (el.completeError) el.completeError.hidden = true;
        if (el.completeReview) el.completeReview.value = '';
        syncStarUi();
        if (el.completeBackdrop) {
            el.completeBackdrop.hidden = false;
            document.body.style.overflow = 'hidden';
        }
    }

    function closeCompleteModal() {
        state.completingPurchaseId = null;
        if (el.completeBackdrop) {
            el.completeBackdrop.hidden = true;
            document.body.style.overflow = '';
        }
    }

    function syncStarUi() {
        if (!el.completeStars) return;
        var buttons = el.completeStars.querySelectorAll('button[data-star]');
        buttons.forEach(function (btn) {
            var n = Number(btn.getAttribute('data-star'));
            btn.classList.toggle('is-on', n <= state.completeRating);
        });
    }

    async function saveComplete() {
        if (!state.completingPurchaseId || !el.completeError) return;
        el.completeError.hidden = true;
        if (!state.completeRating || state.completeRating < 1) {
            el.completeError.textContent = '请选择 1-5 星评价';
            el.completeError.hidden = false;
            return;
        }
        var payload = {
            status: 'completed',
            reviewRating: state.completeRating,
            reviewText: el.completeReview ? el.completeReview.value.trim() : '',
            rating: state.completeRating,
        };
        try {
            await patchPurchase(state.completingPurchaseId, payload);
            closeCompleteModal();
            await loadTabData();
            await loadUserStats();
        } catch (e) {
            el.completeError.textContent = (e && e.message) || '提交失败';
            el.completeError.hidden = false;
        }
    }

    var confirmResolver = null;

    function closeConfirmModal(result) {
        if (el.confirmBackdrop) el.confirmBackdrop.hidden = true;
        var resolve = confirmResolver;
        confirmResolver = null;
        if (resolve) resolve(!!result);
    }

    function askConfirm(opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            if (!el.confirmBackdrop || !el.confirmMessage || !el.confirmOk) {
                if (opts.notice) {
                    window.alert(opts.message || '');
                    resolve(true);
                    return;
                }
                resolve(window.confirm(opts.message || '确定？'));
                return;
            }
            var notice = !!opts.notice;
            confirmResolver = resolve;
            if (el.confirmTitle) el.confirmTitle.textContent = opts.title || (notice ? '提示' : '请确认');
            el.confirmMessage.textContent = opts.message || '确定？';
            el.confirmOk.textContent = opts.confirmText || (notice ? '知道了' : '确认');
            if (el.confirmCancel) {
                el.confirmCancel.hidden = notice;
                el.confirmCancel.textContent = opts.cancelText || '再想想';
            }
            if (el.confirmPromptWrap) el.confirmPromptWrap.hidden = true;
            if (el.confirmModal) el.confirmModal.classList.remove('market-confirm--prompt');
            el.confirmBackdrop.hidden = false;
            if (notice) el.confirmOk.focus();
            else if (el.confirmCancel) el.confirmCancel.focus();
        });
    }

    function wireEvents() {
        if (el.tabs) {
            el.tabs.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    setActiveTab(btn.getAttribute('data-tab') || 'sell');
                });
            });
        }
        if (el.panel) {
            el.panel.addEventListener('change', function (ev) {
                var input = ev.target.closest('.market-trades-proof-file');
                if (!input) return;
                var proofType = input.getAttribute('data-proof-type') || '';
                var purchaseId = input.getAttribute('data-purchase-id') || '';
                var file = input.files && input.files[0];
                input.value = '';
                if (!file || !purchaseId || !proofType) return;
                if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
                    window.alert('仅支持 JPG / PNG / WebP / GIF');
                    return;
                }
                if (file.size > MAX_PROOF_IMAGE_BYTES) {
                    window.alert('凭证图片不能超过 1M');
                    return;
                }
                var reader = new FileReader();
                reader.onload = function () {
                    var dataUrl = String(reader.result || '');
                    var body = {};
                    if (proofType === 'transfer') body.buyerTransferProofImage = dataUrl;
                    else if (proofType === 'seller') body.sellerProofImage = dataUrl;
                    else return;
                    patchPurchase(purchaseId, body).then(loadTabData).catch(function (e) {
                        window.alert((e && e.message) || '上传失败');
                    });
                };
                reader.readAsDataURL(file);
            });
            el.panel.addEventListener('submit', function (ev) {
                var form = ev.target.closest('.market-trades-review-form');
                if (!form) return;
                ev.preventDefault();
                var pid = form.getAttribute('data-purchase-id');
                var role = form.getAttribute('data-review-role');
                var ratingEl = form.querySelector('[name="rating"]');
                var textEl = form.querySelector('[name="text"]');
                var rating = Number(ratingEl && ratingEl.value);
                var text = textEl ? String(textEl.value || '').trim() : '';
                var body = role === 'seller'
                    ? { sellerReviewRating: rating, sellerReviewText: text }
                    : { reviewRating: rating, reviewText: text };
                patchPurchase(pid, body).then(loadTabData).catch(function (e) {
                    window.alert((e && e.message) || '评价失败');
                });
            });
            el.panel.addEventListener('click', function (ev) {
                var proofLink = ev.target.closest('[data-proof-lightbox]');
                if (proofLink) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var src = proofLink.getAttribute('data-src') || proofLink.getAttribute('href') || '';
                    if (!src) {
                        var proofImg = proofLink.querySelector('img');
                        src = (proofImg && (proofImg.currentSrc || proofImg.src)) || '';
                    }
                    openProofLightbox(src);
                    return;
                }
                var editBtn = ev.target.closest('.market-trades-btn-edit');
                if (editBtn) {
                    openOrderEditor(editBtn.getAttribute('data-order-id'));
                    return;
                }
                var closeBtn = ev.target.closest('.market-trades-btn-close');
                if (closeBtn) {
                    var oid = closeBtn.getAttribute('data-order-id');
                    if (!oid) return;
                    askConfirm({
                        title: '下架挂单',
                        message: '确认下架该挂单？',
                        confirmText: '确认下架',
                    }).then(function (ok) {
                        if (!ok) return;
                        patchOrder(oid, { status: 'closed' }).then(loadTabData).catch(function (e) {
                            window.alert((e && e.message) || '下架失败');
                        });
                    });
                    return;
                }
                var relistBtn = ev.target.closest('.market-trades-btn-relist');
                if (relistBtn) {
                    var relistId = relistBtn.getAttribute('data-order-id');
                    if (!relistId) return;
                    askConfirm({
                        title: '再次上架',
                        message: '确认将该挂单重新上架到市场？',
                        confirmText: '确认上架',
                    }).then(function (ok) {
                        if (!ok) return;
                        patchOrder(relistId, { status: 'active' }).then(loadTabData).catch(function (e) {
                            window.alert((e && e.message) || '上架失败');
                        });
                    });
                    return;
                }
                var delBtn = ev.target.closest('.market-trades-btn-delete');
                if (delBtn) {
                    var oid2 = delBtn.getAttribute('data-order-id');
                    if (!oid2) return;
                    askConfirm({
                        title: '删除挂单',
                        message: '确认删除该挂单？此操作不可恢复。',
                        confirmText: '确认删除',
                    }).then(function (ok) {
                        if (!ok) return;
                        deleteOrder(oid2).then(loadTabData).catch(function (e) {
                            window.alert((e && e.message) || '删除失败');
                        });
                    });
                    return;
                }
                var delPurchaseBtn = ev.target.closest('.market-trades-btn-delete-purchase');
                if (delPurchaseBtn) {
                    var pidDel = delPurchaseBtn.getAttribute('data-purchase-id');
                    if (!pidDel) return;
                    askConfirm({
                        title: '删除订单',
                        message: '确认从列表中删除该已取消订单？对方仍可在自己的记录里看到。',
                        confirmText: '确认删除',
                    }).then(function (ok) {
                        if (!ok) return;
                        deletePurchase(pidDel).then(loadTabData).catch(function (e) {
                            window.alert((e && e.message) || '删除失败');
                        });
                    });
                    return;
                }
                var approveBtn = ev.target.closest('.market-trades-btn-approve');
                if (approveBtn) {
                    var pidA = approveBtn.getAttribute('data-purchase-id');
                    if (!pidA) return;
                    askConfirm({
                        title: '接受交易',
                        message: '确认接受该买家的交易请求？确认后请与买家约定时间地点交易。',
                        confirmText: '确认接受',
                    }).then(function (ok) {
                        if (!ok) return;
                        patchPurchase(pidA, { status: 'approved' }).then(loadTabData).catch(function (e) {
                            window.alert((e && e.message) || '操作失败');
                        });
                    });
                    return;
                }
                var completeOpenBtn = ev.target.closest('.market-trades-btn-complete-open');
                if (completeOpenBtn) {
                    openCompleteModal(completeOpenBtn.getAttribute('data-purchase-id'));
                    return;
                }
                var cancelBtn = ev.target.closest('.market-trades-btn-cancel-purchase');
                if (cancelBtn) {
                    var pid = cancelBtn.getAttribute('data-purchase-id');
                    if (!pid) return;
                    var actionLabel = String(cancelBtn.textContent || '').trim();
                    var isReject = actionLabel === '拒绝';
                    askConfirm({
                        title: isReject ? '拒绝交易' : '取消订单',
                        message: isReject
                            ? '确认拒绝该买家的交易请求？'
                            : '确认取消该订单？提交凭证后将不可取消。',
                        confirmText: isReject ? '确认拒绝' : '确认取消',
                    }).then(function (ok) {
                        if (!ok) return;
                        patchPurchase(pid, { status: 'cancelled' }).then(loadTabData).catch(function (e) {
                            window.alert((e && e.message) || '取消失败');
                        });
                    });
                    return;
                }
                var itemBtn = ev.target.closest('[data-open-purchase-detail]');
                if (itemBtn) {
                    ev.preventDefault();
                    var pItem = findPurchase(itemBtn.getAttribute('data-open-purchase-detail'));
                    openReadonlyListing(pItem && pItem.order);
                    return;
                }
                if (ev.target.closest('button, a, input, select, textarea, label, form')) return;
                var manageCard = ev.target.closest('.market-card--manage');
                if (manageCard) {
                    var oidOpen = manageCard.getAttribute('data-order-id');
                    var listing = state.orders.find(function (o) { return o && String(o.id) === String(oidOpen); });
                    openReadonlyListing(listing);
                    return;
                }
                var purchaseCard = ev.target.closest('.market-card--purchase');
                if (purchaseCard) {
                    var pCard = findPurchase(purchaseCard.getAttribute('data-purchase-id'));
                    openReadonlyListing(pCard && pCard.order);
                }
            });
        }
        if (el.completeClose) el.completeClose.addEventListener('click', closeCompleteModal);
        if (el.completeCancel) el.completeCancel.addEventListener('click', closeCompleteModal);
        if (el.completeSave) el.completeSave.addEventListener('click', saveComplete);
        if (el.completeBackdrop) {
            el.completeBackdrop.addEventListener('click', function (ev) {
                if (ev.target === el.completeBackdrop) closeCompleteModal();
            });
        }
        if (el.completeStars) {
            el.completeStars.addEventListener('click', function (ev) {
                var btn = ev.target.closest('button[data-star]');
                if (!btn) return;
                state.completeRating = Number(btn.getAttribute('data-star')) || 0;
                syncStarUi();
            });
        }
        if (el.confirmClose) el.confirmClose.addEventListener('click', function () { closeConfirmModal(false); });
        if (el.confirmCancel) el.confirmCancel.addEventListener('click', function () { closeConfirmModal(false); });
        if (el.confirmOk) el.confirmOk.addEventListener('click', function () { closeConfirmModal(true); });
        if (el.confirmBackdrop) {
            el.confirmBackdrop.addEventListener('click', function (ev) {
                if (ev.target === el.confirmBackdrop) closeConfirmModal(false);
            });
        }
        document.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Escape') return;
            if (!el.confirmBackdrop || el.confirmBackdrop.hidden) return;
            ev.preventDefault();
            closeConfirmModal(false);
        });
        window.addEventListener('popstate', function () {
            applyRouteFromUrl();
            syncTabs();
            loadTabData();
        });
    }

    function cacheElements() {
        el.gate = $('marketTradesGate');
        el.content = $('marketTradesContent');
        el.panel = $('marketTradesPanel');
        el.empty = $('marketTradesEmpty');
        el.tabs = Array.prototype.slice.call(document.querySelectorAll('.market-trades-tab'));
        el.completeBackdrop = $('marketTradesCompleteBackdrop');
        el.completeClose = $('marketTradesCompleteClose');
        el.completeCancel = $('marketTradesCompleteCancel');
        el.completeSave = $('marketTradesCompleteSave');
        el.completeProofInput = $('marketTradesProofInput');
        el.completeProofPreview = $('marketTradesProofPreview');
        el.completeStars = $('marketTradesStars');
        el.completeReview = $('marketTradesReviewText');
        el.completeError = $('marketTradesCompleteError');
        el.confirmBackdrop = $('marketConfirmBackdrop');
        el.confirmModal = el.confirmBackdrop ? el.confirmBackdrop.querySelector('.market-confirm') : null;
        el.confirmTitle = $('marketConfirmTitle');
        el.confirmMessage = $('marketConfirmMessage');
        el.confirmClose = $('marketConfirmClose');
        el.confirmCancel = $('marketConfirmCancel');
        el.confirmOk = $('marketConfirmOk');
        el.confirmPromptWrap = $('marketConfirmPromptWrap');
    }

    function init() {
        cacheElements();
        wireEvents();
        applyRouteFromUrl();
        syncTabs();
        window.USS_MARKET_ON_ORDER_SAVED = function () {
            loadTabData();
        };
        if (!isLoggedIn()) {
            showGate('请先登录后访问商城管理');
            return;
        }
        hideGate();
        loadUserStats();
        loadTabData();
        if (window.UssMarketNotify && typeof window.UssMarketNotify.init === 'function') {
            window.UssMarketNotify.init();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
