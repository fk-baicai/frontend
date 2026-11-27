(function () {
    var handles = {};
    var busy = false;
    var paintTimer = 0;

    function api(path) {
        var base = String(window.USS_AUTH_API_BASE || window.USS_REGISTER_API_BASE || '').replace(/\/$/, '');
        return base + path;
    }

    function session() {
        try {
            var raw = sessionStorage.getItem('ussHangzhouAuthSession') || localStorage.getItem('ussHangzhouAuthSession');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function remember(payload) {
        if (!payload) return;
        try {
            if (sessionStorage.getItem('ussHangzhouAuthSession')) {
                sessionStorage.setItem('ussHangzhouAuthSession', JSON.stringify(payload));
            }
            if (localStorage.getItem('ussHangzhouAuthSession')) {
                localStorage.setItem('ussHangzhouAuthSession', JSON.stringify(payload));
            }
            if (!sessionStorage.getItem('ussHangzhouAuthSession') && !localStorage.getItem('ussHangzhouAuthSession')) {
                sessionStorage.setItem('ussHangzhouAuthSession', JSON.stringify(payload));
            }
        } catch (e) { /* ignore */ }
    }

    function saveSession(user) {
        var sess = session();
        if (!sess || !user) return sess;
        Object.keys(user).forEach(function (key) { sess[key] = user[key]; });
        remember(sess);
        return sess;
    }

    function frameHost(img) {
        var parent = img.parentElement;
        if (!parent) return img;
        if (parent.classList.contains('community-author-avatar') ||
            parent.classList.contains('community-chat-roster-avatar') ||
            parent.classList.contains('community-chat-mention-pop__avatar') ||
            parent.classList.contains('oopz-bridge-member-avatar-wrap') ||
            parent.classList.contains('nav-login-avatar-inner') ||
            parent.classList.contains('market-seller-card__avatar-wrap')) return parent;
        return img;
    }

    function paint(img) {
        if (!img || img.tagName !== 'IMG') return;
        var parent = img.parentElement;
        if (parent && parent.classList.contains('uss-avatar-frame')) {
            parent.parentNode.insertBefore(img, parent);
            parent.remove();
        }
        var handle = String(img.getAttribute('data-avatar-handle') || '').trim().toLowerCase();
        var on = !!(handle && handles[handle]) || img.getAttribute('data-avatar-frame') === '1';
        var host = frameHost(img);
        img.classList.toggle('uss-has-frame', on && host === img);
        if (host !== img) host.classList.toggle('uss-has-frame', on);
    }

    function syncDrawerHint() {
        var dImg = document.getElementById('drawerUserAvatarImg');
        if (!dImg) return;
        var sess = session();
        var owned = !!(sess && sess.avatarFrameOwned);
        dImg.style.cursor = owned ? 'pointer' : '';
        dImg.title = owned ? (sess.avatarFrameOn ? '点击摘下头像框' : '点击佩戴头像框') : '';
        if (sess && sess.bindingId) {
            dImg.setAttribute('data-avatar-handle', String(sess.bindingId).trim().toLowerCase());
        }
        if (owned && sess.avatarFrameOn) {
            handles[String(sess.bindingId || '').trim().toLowerCase()] = true;
        }
    }

    function paintAll() {
        syncDrawerHint();
        document.querySelectorAll('img[data-avatar-handle], img.min-note-avatar').forEach(paint);
        var dImg = document.getElementById('drawerUserAvatarImg');
        if (dImg) paint(dImg);
        var nImg = document.getElementById('navUserAvatarImg');
        if (nImg) paint(nImg);
    }

    function schedulePaint() {
        if (paintTimer) return;
        paintTimer = setTimeout(function () {
            paintTimer = 0;
            paintAll();
        }, 40);
    }

    function refresh() {
        return fetch(api('/api/site/avatar-frames'))
            .then(function (res) { return res.json(); })
            .then(function (body) {
                handles = {};
                ((body && body.handles) || []).forEach(function (name) { handles[String(name).toLowerCase()] = true; });
                var sess = session();
                if (sess && sess.avatarFrameOn && sess.bindingId) {
                    handles[String(sess.bindingId).toLowerCase()] = true;
                }
                paintAll();
            })
            .catch(function () { paintAll(); });
    }

    function authFetch(path, body) {
        var sess = session();
        if (!sess || !sess.token) return Promise.reject(new Error('请先登录。'));
        return fetch(api(path), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.token },
            body: JSON.stringify(body || {})
        }).then(function (res) {
            return res.text().then(function (text) {
                var data = null;
                try { data = text ? JSON.parse(text) : null; } catch (e) {
                    throw new Error('接口没有返回数据，请确认本机服务已启动。');
                }
                if (!res.ok || !data || !data.ok) {
                    throw new Error((data && (data.message || data.code)) || '没有完成。');
                }
                if (data.user) {
                    sess = saveSession(data.user) || sess;
                }
                if (data.user && data.user.bindingId) {
                    handles[String(data.user.bindingId).toLowerCase()] = !!data.user.avatarFrameOn;
                }
                paintAll();
                return data;
            });
        });
    }

    function toggleFrame() {
        var sess = session();
        if (!sess || !sess.token) {
            window.alert('请先登录。');
            return;
        }
        if (!sess.avatarFrameOwned) {
            window.alert('还没有头像框。请先在充电里兑换。');
            return;
        }
        if (busy) return;
        busy = true;
        authFetch('/api/site/avatar-frame')
            .catch(function (err) { window.alert(err.message || '头像框没有切换。'); })
            .then(function () { busy = false; });
    }

    document.addEventListener('click', function (event) {
        var avatar = event.target.closest('#drawerUserAvatarImg');
        if (!avatar) return;
        event.preventDefault();
        event.stopPropagation();
        toggleFrame();
    }, true);

    if (document.body) {
        new MutationObserver(schedulePaint).observe(document.body, { childList: true, subtree: true });
    }
    refresh();
    window.UssAvatarFrame = {
        refresh: refresh,
        paint: paint,
        paintAll: paintAll,
        authFetch: authFetch,
        session: session,
        toggle: toggleFrame
    };
})();
