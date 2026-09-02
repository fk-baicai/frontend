
(function () {
    if (typeof window === 'undefined') return;
    if (window.USS_AUTH_API_BASE) return;

    var h = (window.location && window.location.hostname) || '';
    var PRODUCTION_SITE_HOSTS = ['ussxc.org', 'www.ussxc.org'];

    function isPrivateLanHost(host) {
        if (!host) return false;
        host = String(host).toLowerCase();
        if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
        if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
        if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
        return false;
    }

    var isLocal =
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h === '[::1]' ||
        h === '::1' ||
        /^127\.\d+\.\d+\.\d+$/.test(h) ||
        isPrivateLanHost(h) ||
        (window.location && window.location.protocol === 'file:');

    var isProductionSite =
        /\.netlify\.app$/i.test(h) ||
        PRODUCTION_SITE_HOSTS.indexOf(h.toLowerCase()) !== -1 ||
        window.USS_AUTH_SAME_ORIGIN === true ||
        window.USS_AUTH_SAME_ORIGIN === 1;

    if (isLocal) {
        var origin = window.location && window.location.origin;
        var port = window.location && window.location.port;

        if (origin && /^https?:\/\//i.test(origin) && (port === '8080' || port === '3789')) {
            window.USS_AUTH_API_BASE = String(origin).replace(/\/$/, '');
            return;
        }
        var pageHost = (window.location && window.location.hostname) || '127.0.0.1';
        if (pageHost === 'localhost' || pageHost === '[::1]' || pageHost === '::1') {
            window.USS_AUTH_API_BASE = 'http://localhost:3789';
        } else {
            window.USS_AUTH_API_BASE = 'http://127.0.0.1:3789';
        }
        return;
    }

    var directBase = window.USS_API_DIRECT_BASE;
    if (directBase && /^https:\/\//i.test(String(directBase))) {
        window.USS_AUTH_API_BASE = String(directBase).replace(/\/$/, '');
        return;
    }

    if (isProductionSite) {

        window.USS_AUTH_API_BASE = String(window.location.origin || '').replace(/\/$/, '');

        return;
    }

    if (window.location && window.location.protocol === 'https:') {
        window.USS_AUTH_API_BASE = String(window.location.origin || '').replace(/\/$/, '');
        return;
    }

    window.USS_AUTH_API_BASE = 'http://8.138.237.183:3789';
})();

(function () {
    if (typeof window === 'undefined') return;
    if (!window.USS_RSI_ORIGIN) {
        window.USS_RSI_ORIGIN = 'https://robertsspaceindustries.com';
    }
    if (!window.USS_RSI_REQUIRED_ORG_HREF) {
        window.USS_RSI_REQUIRED_ORG_HREF = '/orgs/5000';
    }
    if (!window.USS_DEFAULT_AVATAR) {
        window.USS_DEFAULT_AVATAR = 'default-avatar.webp';
    }
    window.ussDefaultAvatarSrc = function () {
        return String(window.USS_DEFAULT_AVATAR || 'default-avatar.webp');
    };
    window.ussIsGenericDefaultAvatarUrl = function (url) {
        var s = String(url || '');
        if (!s) return true;
        var def = String(window.USS_DEFAULT_AVATAR || 'default-avatar.webp');
        if (s === def) return true;
        if (/(?:^|\/)default-avatar\.(png|webp)(?:$|\?)/i.test(s)) return true;
        return /avatar_default/i.test(s);
    };
    if (!window.USS_HONGHOU_AVATAR) {
        window.USS_HONGHOU_AVATAR = '/avatars/honghou.webp';
    }
})();

(function () {
    if (typeof document === 'undefined' || !document.head) return;
    var origins = [];
    var apiBases = [window.USS_AUTH_API_BASE, window.USS_SC_COMPONENTS_API_BASE, window.USS_REGISTER_API_BASE];
    apiBases.forEach(function (apiBase) {
        if (!apiBase || !/^https?:\/\//i.test(String(apiBase))) return;
        try {
            var apiOrigin = new URL(String(apiBase)).origin;
            if (!window.location || apiOrigin !== window.location.origin) {
                if (!origins.some(function (o) { return o.href === apiOrigin; })) {
                    origins.push({ href: apiOrigin, rel: 'preconnect' });
                }
            }
        } catch (e) {
            /* ignore */
        }
    });
    if (window.USS_RSI_ORIGIN) {
        origins.push({
            href: String(window.USS_RSI_ORIGIN).replace(/\/$/, ''),
            rel: 'dns-prefetch',
        });
    }
    origins.forEach(function (item) {
        if (!item.href || document.querySelector('link[data-uss-preconnect="' + item.href + '"]')) return;
        var link = document.createElement('link');
        link.rel = item.rel || 'preconnect';
        if (link.rel === 'preconnect') link.crossOrigin = 'anonymous';
        link.href = item.href;
        link.setAttribute('data-uss-preconnect', item.href);
        document.head.appendChild(link);
    });
})();
