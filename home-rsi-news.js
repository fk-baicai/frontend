(function () {
    'use strict';

    var grid = document.getElementById('homeRsiNewsGrid');
    if (!grid) return;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function render(items) {
        if (!items.length) {
            grid.innerHTML = '<p class="home-rsi-news-status">暂时没有拉到官方资讯</p>';
            return;
        }
        grid.innerHTML = items.map(function (item) {
            var title = item.title || item.titleEn || '';
            var en = item.titleEn && item.titleEn !== title ? item.titleEn : '';
            return (
                '<a class="home-rsi-news-card" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' +
                '<span class="home-rsi-news-media">' +
                (item.image
                    ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
                    : '') +
                '</span>' +
                '<span class="home-rsi-news-copy">' +
                '<span class="home-rsi-news-name"><span class="home-rsi-news-marquee">' + escapeHtml(title) + '</span></span>' +
                (en ? '<span class="home-rsi-news-en"><span class="home-rsi-news-marquee">' + escapeHtml(en) + '</span></span>' : '') +
                '</span></a>'
            );
        }).join('');
        grid.querySelectorAll('.home-rsi-news-card').forEach(bindMarquee);
    }

    function marqueeNodes(card) {
        return card.querySelectorAll('.home-rsi-news-marquee');
    }

    function startMarquee(el) {
        el.classList.add('is-overflow');
        var view = el.parentElement.clientWidth;
        var full = el.scrollWidth;
        if (full <= view + 1) {
            el.classList.remove('is-overflow');
            return;
        }
        var distance = full - view;
        var ms = Math.min(7000, Math.max(1100, distance * 22));
        el.style.transitionDuration = ms + 'ms';
        el.style.transform = 'translateX(' + (-distance) + 'px)';
    }

    function stopMarquee(el) {
        el.style.transitionDuration = '0.35s';
        el.style.transform = 'translateX(0)';
        window.setTimeout(function () {
            if (el.style.transform === 'translateX(0px)' || el.style.transform === 'translateX(0)') {
                el.classList.remove('is-overflow');
                el.style.transform = '';
                el.style.transitionDuration = '';
            }
        }, 360);
    }

    function bindMarquee(card) {
        card.addEventListener('mouseenter', function () {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            marqueeNodes(card).forEach(startMarquee);
        });
        card.addEventListener('mouseleave', function () {
            marqueeNodes(card).forEach(stopMarquee);
        });
    }

    var api = (window.USS_API_BASE || '') + '/api/rsi/comm-link';
    fetch(api)
        .then(function (res) { return res.json(); })
        .then(function (data) {
            render(((data && data.items) || []).slice(0, 5));
        })
        .catch(function () {
            grid.innerHTML = '<p class="home-rsi-news-status">暂时没有拉到官方资讯</p>';
        });
})();
