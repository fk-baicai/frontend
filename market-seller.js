(function () {
    var API = (window.USS_AUTH_API_BASE || 'http://127.0.0.1:3789').replace(/\/$/, '');
    var seller = '';
    try { seller = new URLSearchParams(location.search).get('seller') || ''; } catch (e) { seller = ''; }

    function boot() {
        var listEl = document.getElementById('sellerList');
        var profileEl = document.getElementById('sellerProfile');
        var emptyEl = document.getElementById('sellerEmpty');
        var shareBtn = document.getElementById('sellerShareBtn');
        var pageEl = document.getElementById('sellerPage');
        if (shareBtn && pageEl) {
            shareBtn.addEventListener('click', function () {
                if (!window.UssPageShare) return;
                pageEl.setAttribute('data-share-url', location.href.split('#')[0]);
                pageEl.setAttribute('data-share-clip', 'page');
                window.UssPageShare.share(pageEl, shareBtn);
            });
        }
        if (!listEl) return;
        if (!seller) {
            listEl.innerHTML = '';
            if (emptyEl) {
                emptyEl.hidden = false;
                emptyEl.textContent = '缺少卖家信息。';
            }
            return;
        }
        if (listEl) listEl.innerHTML = '<p class="market-empty">加载中…</p>';
        var headers = { Accept: 'application/json' };
        try {
            var raw = sessionStorage.getItem('ussHangzhouAuthSession') || localStorage.getItem('ussHangzhouAuthSession');
            var sess = raw ? JSON.parse(raw) : null;
            if (sess && sess.token) headers.Authorization = 'Bearer ' + sess.token;
        } catch (e) { /* ignore */ }
        fetch(API + '/api/market/orders?orderType=sell&limit=200&seller=' + encodeURIComponent(seller), { headers: headers })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var orders = (data && data.orders) || [];
                if (!orders.length) {
                    listEl.innerHTML = '';
                    if (emptyEl) emptyEl.hidden = false;
                    return;
                }
                if (emptyEl) emptyEl.hidden = true;
                var sellerInfo = orders[0].seller || {};
                if (profileEl && window.UssMarket && typeof window.UssMarket.renderSellerProfileHtml === 'function') {
                    profileEl.innerHTML = window.UssMarket.renderSellerProfileHtml(sellerInfo, '出售者信息', { compact: true });
                }
                if (window.UssMarket && typeof window.UssMarket.renderListingCardHtml === 'function') {
                    listEl.innerHTML = orders.map(function (order) {
                        return window.UssMarket.renderListingCardHtml(order);
                    }).join('');
                } else {
                    listEl.innerHTML = '<p class="market-empty">商品加载失败。</p>';
                }
            })
            .catch(function () {
                listEl.innerHTML = '';
                if (emptyEl) {
                    emptyEl.hidden = false;
                    emptyEl.textContent = '商品加载失败。';
                }
            });
        if (listEl) {
            listEl.addEventListener('click', function (ev) {
                var card = ev.target.closest && ev.target.closest('[data-order-id]');
                if (!card || !listEl.contains(card)) return;
                var id = card.getAttribute('data-order-id');
                if (!id) return;
                location.href = 'market.html?order=' + encodeURIComponent(id);
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
