(function () {
    'use strict';
    if (window.__ussSiteAnnBoot) return;
    window.__ussSiteAnnBoot = true;

    var shown = false;
    var current = null;

    function isAdminPage() {
        return /admin/i.test(String(location.pathname || ''));
    }

    function readToken() {
        try {
            var raw = sessionStorage.getItem('ussHangzhouAuthSession') || localStorage.getItem('ussHangzhouAuthSession');
            if (!raw) return '';
            var sess = JSON.parse(raw);
            return sess && sess.token ? String(sess.token) : '';
        } catch (e) {
            return '';
        }
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensureHost() {
        var host = document.getElementById('siteAnnStack');
        if (host) return host;
        host = document.createElement('div');
        host.id = 'siteAnnStack';
        host.className = 'site-ann-stack';
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
        return host;
    }

    function hideCard() {
        var card = document.getElementById('siteAnnCard');
        if (!card) {
            current = null;
            return;
        }
        card.classList.remove('is-in');
        card.classList.add('is-out');
        setTimeout(function () {
            if (card.parentNode) card.parentNode.removeChild(card);
        }, 300);
        current = null;
    }

    async function ackThen(navigateHref) {
        var item = current;
        var token = readToken();
        hideCard();
        if (item && item.id && token && window.UssAuthApi && window.UssAuthApi.announcementsAck) {
            try {
                await window.UssAuthApi.announcementsAck(token, item.id);
            } catch (e) {}
        }
        if (navigateHref) {
            location.href = navigateHref;
        }
    }

    function openToast(item) {
        current = item;
        var host = ensureHost();
        var card = document.createElement('div');
        card.id = 'siteAnnCard';
        card.className = 'site-ann-card';
        card.setAttribute('role', 'status');
        var href = String(item.ctaHref || '').trim();
        var actionHtml = href
            ? '<button type="button" class="site-ann-card__action" id="siteAnnCta">' +
              escapeHtml(item.ctaLabel || '前往') +
              '</button>'
            : '';
        card.innerHTML =
            '<div class="site-ann-card__bar" aria-hidden="true"></div>' +
            '<div class="site-ann-card__body">' +
            '<p class="site-ann-card__kicker">' +
            escapeHtml(item.kicker || 'NOTICE') +
            '</p>' +
            '<h3 class="site-ann-card__title">' +
            escapeHtml(item.title || '公告') +
            '</h3>' +
            '<p class="site-ann-card__text">' +
            escapeHtml(item.body || '') +
            '</p>' +
            actionHtml +
            '</div>' +
            '<button type="button" class="site-ann-card__close" id="siteAnnClose" aria-label="关闭">&times;</button>' +
            '<span class="site-ann-card__timer" aria-hidden="true"></span>';
        host.appendChild(card);
        requestAnimationFrame(function () {
            card.classList.add('is-in');
        });
        document.getElementById('siteAnnClose').onclick = function () {
            ackThen('');
        };
        var cta = document.getElementById('siteAnnCta');
        if (cta) {
            cta.onclick = function () {
                ackThen(href);
            };
        }
    }

    async function poll() {
        if (isAdminPage() || shown) return;
        if (!window.UssAuthApi || !window.UssAuthApi.announcementsActive) return;
        var token = readToken();
        if (!token) return;
        try {
            var data = await window.UssAuthApi.announcementsActive(token);
            var item = data && data.announcement;
            if (!item || !item.id) return;
            shown = true;
            openToast(item);
        } catch (e) {}
    }

    function boot() {
        if (isAdminPage()) return;
        function start() {
            setTimeout(poll, 700);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
        window.addEventListener('uss-auth-session-changed', function () {
            shown = false;
            setTimeout(poll, 400);
        });
    }

    boot();
})();
