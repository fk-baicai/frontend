(function () {
    var handles = {};
    var busy = false;
    var paintTimer = 0;
    var RETRY_DELAYS = [0, 320, 900];

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

    function isFrameHost(el) {
        if (!el || !el.classList) return false;
        return el.classList.contains('community-author-avatar') ||
            el.classList.contains('community-chat-roster-avatar') ||
            el.classList.contains('community-chat-mention-pop__avatar') ||
            el.classList.contains('oopz-bridge-member-avatar-wrap') ||
            el.classList.contains('nav-login-avatar-inner') ||
            el.classList.contains('market-seller-card__avatar-wrap') ||
            el.classList.contains('uss-avatar-frame');
    }

    function frameHost(img) {
        var node = img.parentElement;
        var i = 0;
        while (node && i < 4) {
            if (isFrameHost(node)) return node;
            node = node.parentElement;
            i += 1;
        }
        return img;
    }

    function clearOrnament(host) {
        if (!host) return;
        host.classList.remove('uss-has-frame');
        var leftover = host.querySelector(':scope > .uss-frame-svg, :scope > #ussFrameSprite');
        if (leftover) leftover.remove();
    }

    function mountOrnament(host) {
        host.classList.add('uss-has-frame');
        var leftover = host.querySelector(':scope > .uss-frame-svg');
        if (leftover) leftover.remove();
    }

    function paint(img) {
        if (!img || img.tagName !== 'IMG') return;
        var parent = img.parentElement;
        var handle = String(img.getAttribute('data-avatar-handle') || '').trim().toLowerCase();
        var on = !!(handle && handles[handle]) || img.getAttribute('data-avatar-frame') === '1';
        if (parent && parent.classList.contains('uss-avatar-frame')) {
            if (on) {
                mountOrnament(parent);
                return;
            }
            parent.parentNode.insertBefore(img, parent);
            parent.remove();
            parent = img.parentElement;
        }
        img.classList.remove('uss-has-frame');
        var host = frameHost(img);
        if (host !== img) {
            if (on) mountOrnament(host);
            else clearOrnament(host);
            return;
        }
        if (!on || !img.parentNode) {
            clearOrnament(img);
            return;
        }
        var wrap = document.createElement('span');
        wrap.className = 'uss-avatar-frame uss-has-frame';
        img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(img);
        mountOrnament(wrap);
    }

    function syncDrawerHint() {
        var dImg = document.getElementById('drawerUserAvatarImg');
        if (!dImg) return;
        var sess = session();
        var owned = !!(sess && sess.avatarFrameOwned);
        var host = dImg.closest('.uss-avatar-frame') || dImg;
        host.style.cursor = owned ? 'pointer' : '';
        dImg.style.cursor = owned ? 'pointer' : '';
        dImg.title = owned ? (sess.avatarFrameOn ? '点击摘下头像框' : '点击佩戴头像框') : '';
        if (sess && sess.bindingId) {
            var id = String(sess.bindingId).trim().toLowerCase();
            dImg.setAttribute('data-avatar-handle', id);
            handles[id] = !!(owned && sess.avatarFrameOn);
        }
    }

    function paintAll() {
        var sprite = document.getElementById('ussFrameSprite');
        if (sprite) sprite.remove();
        syncDrawerHint();
        document.querySelectorAll('img[data-avatar-handle], img.min-note-avatar').forEach(paint);
        var dImg = document.getElementById('drawerUserAvatarImg');
        if (dImg) paint(dImg);
        var nImg = document.getElementById('navUserAvatarImg');
        if (nImg) paint(nImg);
        syncDrawerHint();
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

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function isRetryableError(err, data, res) {
        if (err && (err.name === 'TypeError' || /Failed to fetch|NetworkError|network|abort/i.test(String(err.message || '')))) {
            return true;
        }
        var code = data && data.code;
        if (code === 'RLY_004' || code === 'RLY_001' || code === 'RLY_002') return true;
        var msg = String((data && data.message) || (err && err.message) || '');
        if (/服务暂时没有连上|请再试一次|没有连上|Failed to fetch/i.test(msg)) return true;
        if (res && (res.status === 502 || res.status === 503 || res.status === 504)) return true;
        return false;
    }

    function applyUser(data) {
        var sess = session();
        if (data && data.user) {
            sess = saveSession(data.user) || sess;
            if (data.user.bindingId) {
                handles[String(data.user.bindingId).toLowerCase()] = !!data.user.avatarFrameOn;
            }
            paintAll();
        }
        return data;
    }

    function authFetch(path, body, opts) {
        var sess = session();
        if (!sess || !sess.token) return Promise.reject(new Error('请先登录。'));
        var options = opts || {};
        var maxAttempts = options.maxAttempts || RETRY_DELAYS.length;
        var attempt = 0;
        var payload = body || {};

        function once() {
            attempt += 1;
            var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            var timer = setTimeout(function () {
                if (ctrl) ctrl.abort();
            }, options.timeoutMs || 25000);
            return fetch(api(path), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.token },
                body: JSON.stringify(payload),
                signal: ctrl ? ctrl.signal : undefined
            }).then(function (res) {
                return res.text().then(function (text) {
                    clearTimeout(timer);
                    var data = null;
                    try { data = text ? JSON.parse(text) : null; } catch (e) {
                        var parseErr = new Error('接口没有返回数据，请确认本机服务已启动。');
                        parseErr.retryable = attempt < maxAttempts;
                        throw parseErr;
                    }
                    if (!res.ok || !data || !data.ok) {
                        var fail = new Error((data && (data.message || data.code)) || '没有完成。');
                        fail.code = data && data.code;
                        fail.status = res.status;
                        fail.retryable = isRetryableError(null, data, res) && attempt < maxAttempts;
                        throw fail;
                    }
                    return applyUser(data);
                });
            }).catch(function (err) {
                clearTimeout(timer);
                if (err && err.name === 'AbortError') {
                    err = new Error('请求超时，正在重试…');
                    err.retryable = attempt < maxAttempts;
                }
                if (!err.retryable && isRetryableError(err, null, null) && attempt < maxAttempts) {
                    err.retryable = true;
                }
                if (err.retryable && attempt < maxAttempts) {
                    var wait = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)] || 400;
                    if (typeof options.onRetry === 'function') {
                        options.onRetry(attempt + 1, maxAttempts, err);
                    }
                    return sleep(wait).then(once);
                }
                if (err && /正在重试/.test(String(err.message || ''))) {
                    err.message = '服务暂时没有连上，请再试一次。';
                }
                throw err;
            });
        }

        return once();
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
        var node = event.target;
        if (!node) return;
        if (node.nodeType !== 1) node = node.parentElement;
        var drawerImg = document.getElementById('drawerUserAvatarImg');
        if (!drawerImg || !node || !node.closest) return;
        var area = drawerImg.closest('.uss-avatar-frame') || drawerImg;
        if (node !== area && !area.contains(node)) return;
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
