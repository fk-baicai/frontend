
(function () {
    if (typeof document === 'undefined') return;

    var AUTH_KEY = 'ussHangzhouAuthSession';

    function loadSession() {
        if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.loadAuthSession === 'function') {
            return window.UssAuthSessionSync.loadAuthSession();
        }
        try {
            var raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function isLoggedIn() {
        var sess = loadSession();
        return !!(sess && sess.token);
    }

    function avatarSrc(sess) {
        var rel = sess && sess.avatarUrl;
        if (rel && window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === 'function') {
            var url = window.UssAuthApi.resolveAssetUrl(rel);
            if (url) return url;
        }
        if (rel && /^https?:\/\//i.test(String(rel))) return String(rel);
        return window.USS_DEFAULT_AVATAR || 'default-avatar.webp';
    }

    function ensureNavAccount() {
        if (document.getElementById('navLoginBtn')) return;
        var nav = document.querySelector('nav.navbar');
        if (!nav) return;
        var wrap = document.createElement('div');
        wrap.className = 'nav-right';
        wrap.innerHTML =
            '<button type="button" class="nav-login-trigger" id="navLoginBtn" aria-label="登录或注册">' +
            '<span id="navLoginGuestWrap" class="nav-login-guest-inner">' +
            '<span class="nav-login-label">' +
            '<svg class="nav-login-icon" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">' +
            '<path d="M324.224 497.707a213.333 213.333 0 1 1 145.11 56.96 298.667 298.667 0 0 0-298.667 298.666H85.333a384.128 384.128 0 0 1 238.891-355.626z m145.11-28.374a128 128 0 1 0 0-256 128 128 0 0 0 0 256z m213.333 213.334v-128H768v128h128V768H768v128h-85.333V768h-128v-85.333h128z"></path>' +
            '</svg></span></span>' +
            '<span id="navLoginAvatarWrap" class="nav-login-avatar-inner is-hidden">' +
            '<img id="navUserAvatarImg" class="nav-user-avatar" src="" alt="">' +
            '</span></button>';
        nav.appendChild(wrap);
        var btn = wrap.querySelector('#navLoginBtn');
        if (btn) {
            btn.addEventListener('click', function () {
                if (typeof window.openLoginDrawer === 'function') window.openLoginDrawer();
                else window.location.href = 'index.html';
            });
        }
    }

    function syncNavAccount() {
        ensureNavAccount();
        var btn = document.getElementById('navLoginBtn');
        var guestWrap = document.getElementById('navLoginGuestWrap');
        var avatarWrap = document.getElementById('navLoginAvatarWrap');
        var img = document.getElementById('navUserAvatarImg');
        if (!btn || !guestWrap || !avatarWrap || !img) return;
        var sess = loadSession();
        if (sess && sess.token) {
            guestWrap.classList.add('is-hidden');
            avatarWrap.classList.remove('is-hidden');
            btn.classList.add('is-logged-in');
            btn.setAttribute('aria-label', '账户');
            img.src = avatarSrc(sess);
            img.alt = '用户头像';
        } else {
            guestWrap.classList.remove('is-hidden');
            avatarWrap.classList.add('is-hidden');
            btn.classList.remove('is-logged-in');
            btn.setAttribute('aria-label', '登录或注册');
        }
    }

    function syncToolsNav() {
        var wrap = document.getElementById('navToolsWrap');
        if (wrap) wrap.hidden = false;
        syncNavAccount();
    }

    syncToolsNav();

    window.addEventListener('storage', syncToolsNav);
    document.addEventListener('uss:auth-session', syncToolsNav);

    try {
        var obs = new MutationObserver(syncToolsNav);
        obs.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
    } catch (e) {
        /* ignore */
    }

    window.UssNavTools = { refresh: syncToolsNav, isLoggedIn: isLoggedIn };
})();
