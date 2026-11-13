
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

    function defaultAvatarSrc() {
        if (typeof window.ussDefaultAvatarSrc === 'function') return window.ussDefaultAvatarSrc();
        return window.USS_DEFAULT_AVATAR || 'default-avatar.webp';
    }

    function avatarSrc(sess) {
        var rel = sess && sess.avatarUrl;
        var generic = window.ussIsGenericDefaultAvatarUrl;
        if (rel && window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === 'function') {
            var url = window.UssAuthApi.resolveAssetUrl(rel);
            if (url && !(typeof generic === 'function' && generic(url))) return url;
        }
        if (rel && /^https?:\/\//i.test(String(rel)) && !(typeof generic === 'function' && generic(rel))) {
            return String(rel);
        }
        return defaultAvatarSrc();
    }

    function hasScript(name) {
        var nodes = document.getElementsByTagName('script');
        var i;
        for (i = 0; i < nodes.length; i++) {
            if ((nodes[i].getAttribute('src') || '').indexOf(name) >= 0) return true;
        }
        return false;
    }

    function mountLoginDrawer() {
        if (document.getElementById('loginDrawer')) return;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'login-drawer-snippet.html', false);
            xhr.send(null);
            if (xhr.status !== 200 || !xhr.responseText) return;
            var tpl = document.createElement('template');
            tpl.innerHTML = xhr.responseText.trim();
            document.body.appendChild(tpl.content);
        } catch (e) {
            /* ignore */
        }
    }

    var authStackLoading = false;
    var authStackWaiters = [];
    function ensureAuthStack(done) {
        mountLoginDrawer();
        if (typeof window.openLoginDrawer === 'function') {
            if (done) done();
            return;
        }
        if (done) authStackWaiters.push(done);
        if (authStackLoading) return;
        authStackLoading = true;
        var urls = [];
        if (!hasScript('auth-session-sync.js')) urls.push('auth-session-sync.js');
        if (!hasScript('api-error.js')) urls.push('api-error.js');
        if (!hasScript('auth-api.js')) urls.push('auth-api.js');
        if (!hasScript('home-app.js')) urls.push('home-app.js?v=20261113a');
        var index = 0;
        function finish() {
            authStackLoading = false;
            var waiters = authStackWaiters.splice(0);
            waiters.forEach(function (fn) { fn(); });
            syncNavAccount();
        }
        function next() {
            if (index >= urls.length) {
                finish();
                return;
            }
            var script = document.createElement('script');
            script.src = urls[index++];
            script.onload = next;
            script.onerror = next;
            document.body.appendChild(script);
        }
        next();
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
                ensureAuthStack(function () {
                    if (typeof window.openLoginDrawer === 'function') window.openLoginDrawer();
                });
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
            img.onerror = function () {
                img.onerror = null;
                img.src = defaultAvatarSrc();
            };
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

    ensureAuthStack();
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
