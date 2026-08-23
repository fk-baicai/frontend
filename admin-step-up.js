/**
 * 管理员二次验证（可选 7/30/180/360 天 step-up 会话，sessionStorage）
 */
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

    function getToken() {
        try {
            return sessionStorage.getItem(TOKEN_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function getExpiresAt() {
        try {
            return sessionStorage.getItem(EXPIRES_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function setSession(stepUpToken, expiresAt) {
        try {
            sessionStorage.setItem(TOKEN_KEY, String(stepUpToken || ''));
            if (expiresAt) sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
        } catch (e) {
            /* ignore */
        }
    }

    function clearSession() {
        try {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(EXPIRES_KEY);
        } catch (e) {
            /* ignore */
        }
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
        if (data && data.stepUpToken) {
            setSession(data.stepUpToken, data.expiresAt);
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

    /**
     * 挂载 gate UI，验证通过后 resolve(true)。
     * @param {{ authToken: string, gateEl?: HTMLElement, onVerified?: function }} opts
     */
    function mountGate(opts) {
        opts = opts || {};
        var authToken = opts.authToken;
        var gateEl = opts.gateEl || document.getElementById('adminStepUpGate');
        if (!gateEl || !authToken) {
            return Promise.resolve(false);
        }

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

    /**
     * 若已有有效 step-up 会话则直接通过，否则显示 gate 并等待验证。
     */
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
