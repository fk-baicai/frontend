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
            ' · ' + escapeHtml(loc) + ' · 剩余 ' + escapeHtml(formatExpires(o.expiresAt)) + '</p>' +
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
                actions = '<span class="market-trades-wait-hint">等待卖家确认交易…</span>' +
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
                actions =
                    proofUploadBtnHtml(p.id, 'seller', p.sellerProofImageUrl, '上传交易凭证') +
                    '<span class="market-trades-wait-hint">等待买家确认完成（3 天未操作将自动完成）</span>';
                if (canCancelPurchase(p, 'seller')) {
                    actions += cancelPurchaseBtnHtml(p.id, '取消订单');
                }
            }
        } else if (p.status === 'completed') {
            if (p.completedBy === 'auto') {
                actions = '<span class="market-trades-wait-hint">系统已自动完成交易</span>';
            }
            if (p.reviewRating) {
                actions += '<span class="market-trades-wait-hint">买家评价：' + escapeHtml(p.reviewRating) + ' 星</span>';
            }
        } else if (p.status === 'cancelled') {
            actions = '<button type="button" class="market-btn market-trades-btn-delete-purchase" data-purchase-id="' + escapeHtml(p.id) + '">删除</button>';
        }
        return actions;
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
        var party = role === 'seller'
            ? ('买家：' + (p.buyerBindingId || '—'))
            : ('卖家：' + (p.sellerBindingId || '—'));
        if (role === 'buyer') {
            var sellerTrades = sellerTradeCountFromOrder(order);
            if (sellerTrades != null) {
                party += ' · 交易：' + sellerTrades;
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
            '<p class="market-card__purchase-party">' + escapeHtml(party) + '</p>' +
            purchaseProofSummaryHtml(p, role) +
            '</div>' +
            '<div class="market-card__purchase-actions">' + actions + '</div>' +
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
            html = state.purchases.map(function (p) { return purchaseCardHtml(p, role); }).join('');
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
            if (tab === 'sell' || tab === 'buy' || tab === 'purchases' || tab === 'incoming') {
                state.tab = tab;
            }
            var highlight = params.get('highlight');
            if (highlight) state.highlightPurchaseId = String(highlight).trim();
        } catch (e) { /* ignore */ }
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
            el.confirmBackdrop.hidden = false;
            if (notice) el.confirmOk.focus();
            else if (el.confirmCancel) el.confirmCancel.focus();
        });
    }

    function wireEvents() {
        if (el.tabs) {
            el.tabs.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    state.tab = btn.getAttribute('data-tab') || 'sell';
                    syncTabs();
                    loadTabData();
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
            el.panel.addEventListener('click', function (ev) {
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
        el.confirmTitle = $('marketConfirmTitle');
        el.confirmMessage = $('marketConfirmMessage');
        el.confirmClose = $('marketConfirmClose');
        el.confirmCancel = $('marketConfirmCancel');
        el.confirmOk = $('marketConfirmOk');
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
