
(function () {
    var TOKEN_KEY = 'ussAdminStepUpToken';
    var EXPIRES_KEY = 'ussAdminStepUpExpiresAt';
    var DURATION_OPTIONS = [7, 30, 180, 360];
    var DEFAULT_DURATION_DAYS = 7;

    function joinUrl(path) {
        var base =
            (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
        return String(base).replace(/\/$/, '') + path;
    }

    function readStore(key) {
        try {
            var v = localStorage.getItem(key);
            if (v) return v;
            v = sessionStorage.getItem(key);
            if (v) {
                localStorage.setItem(key, v);
                sessionStorage.removeItem(key);
                return v;
            }
        } catch (e) {
            try {
                return sessionStorage.getItem(key) || '';
            } catch (e2) {
                return '';
            }
        }
        return '';
    }

    function writeStore(key, value) {
        try {
            localStorage.setItem(key, String(value || ''));
            sessionStorage.removeItem(key);
        } catch (e) {
            try {
                sessionStorage.setItem(key, String(value || ''));
            } catch (e2) {
                /* ignore */
            }
        }
    }

    function removeStore(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            /* ignore */
        }
        try {
            sessionStorage.removeItem(key);
        } catch (e) {
            /* ignore */
        }
    }

    function getToken() {
        var exp = getExpiresAt();
        if (exp) {
            var t = Date.parse(exp);
            if (Number.isFinite(t) && t <= Date.now()) {
                clearSession();
                return '';
            }
        }
        return readStore(TOKEN_KEY) || '';
    }

    function getExpiresAt() {
        return readStore(EXPIRES_KEY) || '';
    }

    function setSession(stepUpToken, expiresAt) {
        writeStore(TOKEN_KEY, stepUpToken);
        if (expiresAt) writeStore(EXPIRES_KEY, expiresAt);
        else removeStore(EXPIRES_KEY);
    }

    function clearSession() {
        removeStore(TOKEN_KEY);
        removeStore(EXPIRES_KEY);
    }

    function isStepUpError(err) {
        var code = err && err.code;
        return code === 'ADM_011' || code === 'ADM_012';
    }

    function getAuthHeaders(bearerToken, extra) {
        var headers = Object.assign({}, extra || {}, { Authorization: 'Bearer ' + bearerToken });
        var stepUp = getToken();
        if (stepUp) headers['X-Admin-Step-Up'] = stepUp;
        return headers;
    }

    function getSelectedDuration(gateEl) {
        if (!gateEl) return DEFAULT_DURATION_DAYS;
        var checked = gateEl.querySelector('input[name="adminStepUpDuration"]:checked');
        var n = checked ? parseInt(String(checked.value), 10) : DEFAULT_DURATION_DAYS;
        if (DURATION_OPTIONS.indexOf(n) < 0) return DEFAULT_DURATION_DAYS;
        return n;
    }

    function gateMarkup() {
        var opts = DURATION_OPTIONS.map(function (days, i) {
            var checked = i === 0 ? ' checked' : '';
            return (
                '<label class="admin-step-up-duration-option">' +
                '<input type="radio" name="adminStepUpDuration" value="' +
                days +
                '"' +
                checked +
                ' />' +
                '<span>' +
                days +
                ' 天</span></label>'
            );
        }).join('');
        return (
            '<div class="admin-step-up-panel" role="dialog" aria-modal="true" aria-labelledby="adminStepUpTitle">' +
            '<header class="admin-step-up-head">' +
            '<h2 class="admin-step-up-title" id="adminStepUpTitle">邮箱二次验证</h2>' +
            '</header>' +
            '<div class="admin-step-up-body">' +
            '<p class="admin-step-up-lead">进入管理系统前，请先向注册邮箱发送验证码并完成验证。</p>' +
            '<div class="admin-step-up-field">' +
            '<label class="admin-step-up-field-label" for="adminStepUpCode">验证码</label>' +
            '<div class="admin-step-up-code-row">' +
            '<input id="adminStepUpCode" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" placeholder="6 位验证码" />' +
            '<button type="button" class="admin-step-up-btn" id="btnAdminStepUpSend">发送验证码</button>' +
            '</div></div>' +
            '<p id="adminStepUpSendStatus" class="admin-step-up-status" aria-live="polite"></p>' +
            '<div class="admin-step-up-duration">' +
            '<span class="admin-step-up-duration-label" id="adminStepUpDurationLabel">验证有效期限</span>' +
            '<div class="admin-step-up-duration-options" role="radiogroup" aria-labelledby="adminStepUpDurationLabel">' +
            opts +
            '</div></div>' +
            '<p id="adminStepUpErr" class="admin-step-up-err" hidden role="alert"></p>' +
            '<p id="adminStepUpValidHint" class="admin-step-up-status"></p>' +
            '</div>' +
            '<footer class="admin-step-up-foot">' +
            '<button type="button" class="admin-step-up-btn admin-step-up-btn--primary" id="btnAdminStepUpVerify">验证并进入</button>' +
            '</footer></div>'
        );
    }

    function ensureGateElement(preferred) {
        var el = preferred || document.getElementById('adminStepUpGate');
        if (!el) {
            el = document.createElement('div');
            el.id = 'adminStepUpGate';
            el.hidden = true;
            var main = document.querySelector('main');
            var app = document.getElementById('app');
            if (main && app && app.parentNode === main) {
                main.insertBefore(el, app);
            } else if (main) {
                main.insertBefore(el, main.firstChild);
            } else {
                document.body.appendChild(el);
            }
        }
        if (!el.querySelector('#btnAdminStepUpSend')) {
            el.innerHTML = gateMarkup();
        }
        return el;
    }

    async function parseJson(r) {
        try {
            return await r.json();
        } catch (e) {
            return {};
        }
    }

    function formatUserError(r, data, fallback) {
        if (typeof UssApiError !== 'undefined' && UssApiError.createApiError) {
            return UssApiError.createApiError(r.status, data, fallback);
        }
        var code = (data && data.code) || fallback || 'SRV_001';
        var err = new Error(code);
        err.code = code;
        err.status = r.status;
        err.httpStatus = r.status;
        return err;
    }

    async function fetchStatus(authToken) {
        var r = await fetch(joinUrl('/api/admin/step-up/status'), {
            headers: getAuthHeaders(authToken),
            cache: 'no-store',
        });
        var data = await parseJson(r);
        if (!r.ok) {
            if (isStepUpError(formatUserError(r, data, 'ADM_011'))) {
                clearSession();
            }
            throw formatUserError(r, data, 'ADM_001');
        }
        if (data && data.valid && data.expiresAt) {
            setSession(getToken(), data.expiresAt);
        }
        return data || { valid: false };
    }

    async function sendCode(authToken) {
        var r = await fetch(joinUrl('/api/admin/step-up/send-code'), {
            method: 'POST',
            headers: getAuthHeaders(authToken, { 'Content-Type': 'application/json' }),
        });
        var data = await parseJson(r);
        if (!r.ok) throw formatUserError(r, data, 'ADM_013');
        return data;
    }

    async function verify(authToken, code, durationDays) {
        var r = await fetch(joinUrl('/api/admin/step-up/verify'), {
            method: 'POST',
            headers: getAuthHeaders(authToken, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                code: String(code || '').trim(),
                durationDays: durationDays != null ? durationDays : DEFAULT_DURATION_DAYS,
            }),
        });
        var data = await parseJson(r);
        if (!r.ok) throw formatUserError(r, data, 'AUTH_P005');
        var tok = data && data.stepUpToken;
        if (tok) {
            setSession(tok, data.expiresAt);
        }
        return data;
    }

    function formatExpiresHint(iso) {
        if (!iso) return '';
        try {
            return new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(new Date(iso));
        } catch (e) {
            return String(iso);
        }
    }

    function formatValidHint(expiresAt, durationDays) {
        var tail = formatExpiresHint(expiresAt);
        if (durationDays) {
            return '已验证 · 有效期限 ' + durationDays + ' 天 · 到期 ' + tail;
        }
        return '已验证 · 到期 ' + tail;
    }

    function mountGate(opts) {
        opts = opts || {};
        var authToken = opts.authToken;
        if (!authToken) {
            return Promise.resolve(false);
        }
        var gateEl = ensureGateElement(opts.gateEl);

        var sendBtn = gateEl.querySelector('#btnAdminStepUpSend');
        var verifyBtn = gateEl.querySelector('#btnAdminStepUpVerify');
        var codeInput = gateEl.querySelector('#adminStepUpCode');
        var sendStatus = gateEl.querySelector('#adminStepUpSendStatus');
        var errEl = gateEl.querySelector('#adminStepUpErr');
        var validHint = gateEl.querySelector('#adminStepUpValidHint');

        function showErr(msg) {
            if (!errEl) return;
            if (!msg) {
                errEl.hidden = true;
                errEl.textContent = '';
                return;
            }
            errEl.hidden = false;
            errEl.textContent = msg;
        }

        function setSendStatus(msg) {
            if (sendStatus) sendStatus.textContent = msg || '';
        }

        gateEl.hidden = false;
        document.body.classList.add('admin-step-up-active');
        if (codeInput && typeof codeInput.focus === 'function') {
            codeInput.focus();
        }

        if (sendBtn) {
            sendBtn.onclick = async function () {
                showErr('');
                sendBtn.disabled = true;
                setSendStatus('发送中…');
                try {
                    var res = await sendCode(authToken);
                    setSendStatus((res && res.message) || '验证码已发送');
                } catch (e) {
                    setSendStatus('');
                    showErr((e && e.message) || '发送失败');
                } finally {
                    sendBtn.disabled = false;
                }
            };
        }

        if (verifyBtn && codeInput) {
            verifyBtn.onclick = async function () {
                showErr('');
                var code = String(codeInput.value || '').trim();
                if (!/^\d{6}$/.test(code)) {
                    showErr('请输入 6 位数字验证码');
                    return;
                }
                var durationDays = getSelectedDuration(gateEl);
                verifyBtn.disabled = true;
                try {
                    var vres = await verify(authToken, code, durationDays);
                    if (validHint && vres && vres.expiresAt) {
                        validHint.textContent = formatValidHint(vres.expiresAt, vres.durationDays);
                    }
                    gateEl.hidden = true;
                    document.body.classList.remove('admin-step-up-active');
                    if (typeof opts.onVerified === 'function') opts.onVerified(vres);
                    if (gateResolver) gateResolver(true);
                } catch (e) {
                    showErr((e && e.message) || '验证失败');
                } finally {
                    verifyBtn.disabled = false;
                }
            };
            codeInput.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') verifyBtn.click();
            });
        }

        var gateResolver = null;
        return new Promise(function (resolve) {
            gateResolver = resolve;
        });
    }

    async function ensureVerified(authToken, opts) {
        opts = opts || {};
        if (!authToken) return false;

        try {
            var status = await fetchStatus(authToken);
            if (status && status.valid) {
                if (opts.validHintEl && status.expiresAt) {
                    opts.validHintEl.textContent = formatValidHint(status.expiresAt, status.durationDays);
                }
                return true;
            }
        } catch (e) {
            if (!isStepUpError(e)) throw e;
            clearSession();
        }

        clearSession();
        await mountGate({
            authToken: authToken,
            gateEl: opts.gateEl,
            onVerified: opts.onVerified,
        });
        return true;
    }

    window.UssAdminStepUp = {
        DURATION_OPTIONS: DURATION_OPTIONS,
        DEFAULT_DURATION_DAYS: DEFAULT_DURATION_DAYS,
        getToken: getToken,
        getExpiresAt: getExpiresAt,
        setSession: setSession,
        clearSession: clearSession,
        getAuthHeaders: getAuthHeaders,
        getSelectedDuration: getSelectedDuration,
        ensureGateElement: ensureGateElement,
        isStepUpError: isStepUpError,
        fetchStatus: fetchStatus,
        sendCode: sendCode,
        verify: verify,
        ensureVerified: ensureVerified,
        mountGate: mountGate,
        formatExpiresHint: formatExpiresHint,
        formatValidHint: formatValidHint,
    };
})();
