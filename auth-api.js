
(function () {
    var AUTH_API_BASE = (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
    var Err = typeof UssApiError !== 'undefined' ? UssApiError : null;

    function joinUrl(path) {
        return AUTH_API_BASE.replace(/\/$/, '') + path;
    }

    function joinUrlWithBase(base, path) {
        return String(base || AUTH_API_BASE).replace(/\/$/, '') + path;
    }

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function isFetchNetworkFailure(err) {
        if (!err) return false;
        if (err.name === 'AbortError' || err.name === 'TypeError') return true;
        var msg = String(err.message || '').toLowerCase();
        return (
            msg.indexOf('fetch') !== -1 ||
            msg.indexOf('network') !== -1 ||
            msg.indexOf('load failed') !== -1 ||
            msg.indexOf('failed to fetch') !== -1
        );
    }

    async function parseJson(r) {
        try {
            return await r.json();
        } catch (e) {
            return {};
        }
    }


    function throwIfNotOk(r, data, fallbackCode) {
        if (r.ok) return;
        var err;
        if (Err) err = Err.createApiError(r.status, data, fallbackCode);
        else {
            var code = (data && data.code) || fallbackCode || 'NET_E001';
            err = new Error(Err ? Err.formatUserError(code) : '网络异常，请稍后重试。');
            err.code = code;
        }
        err.status = r.status;
        err.httpStatus = r.status;
        throw err;
    }

    function parseTokenPayload(token) {
        if (!token || typeof token !== 'string') return null;
        var i = token.lastIndexOf('.');
        if (i <= 0) return null;
        try {
            return JSON.parse(atob(token.slice(0, i).replace(/-/g, '+').replace(/_/g, '/')));
        } catch (e) {
            return null;
        }
    }

    function getTokenExpiresAt(token) {
        var payload = parseTokenPayload(token);
        var exp = payload && payload.exp;
        return exp != null && Number.isFinite(Number(exp)) ? Number(exp) : null;
    }

    function isTokenExpired(token, skewMs) {
        var exp = getTokenExpiresAt(token);
        if (exp == null) return true;
        var skew = skewMs != null ? Number(skewMs) : 5000;
        return Date.now() >= exp - skew;
    }

    function isAuthSessionError(err) {
        var code =
            (err && err.code) ||
            (err && err.httpStatus === 401 ? 'AUTH_S002' : '');
        return code === 'AUTH_S001' || code === 'AUTH_S002' || code === 'AUTH_S003';
    }

    function authSessionExpiredMessage() {
        return '登录已过期，请重新登录';
    }

    async function fetchCheckinBranchUnit(token, branch, year, month) {
        var parts = ['branch=' + encodeURIComponent(branch)];
        if (year != null && month != null) {
            parts.push('year=' + encodeURIComponent(year));
            parts.push('month=' + encodeURIComponent(month));
        }
        var q = '?' + parts.join('&');
        var r = await fetch(joinUrl('/api/checkin/unit') + q, {
            headers: { Authorization: 'Bearer ' + token },
        });
        var data = await parseJson(r);
        throwIfNotOk(r, data, 'CHK_001');
        return data;
    }

    async function adminJson(token, path, init) {
        init = init || {};
        var headers = Object.assign({}, init.headers || {}, { Authorization: 'Bearer ' + token });
        var stepUp = '';
        try {
            stepUp =
                (window.UssAdminStepUp && window.UssAdminStepUp.getToken && window.UssAdminStepUp.getToken()) ||
                '';
            if (!stepUp) {
                try {
                    stepUp = localStorage.getItem('ussAdminStepUpToken') || '';
                } catch (e1) {
                    stepUp = '';
                }
            }
            if (!stepUp) {
                try {
                    stepUp = sessionStorage.getItem('ussAdminStepUpToken') || '';
                } catch (e2) {
                    stepUp = '';
                }
            }
        } catch (ignore) {}
        if (stepUp) headers['X-Admin-Step-Up'] = stepUp;
        var r = await fetch(joinUrl(path), Object.assign({}, init, { headers: headers }));
        var data = await parseJson(r);
        if (!r.ok) {
            if (
                r.status === 403 &&
                data &&
                (data.code === 'ADM_011' || data.code === 'ADM_012') &&
                window.UssAdminStepUp &&
                window.UssAdminStepUp.clearSession
            ) {
                window.UssAdminStepUp.clearSession();
            }
        }
        throwIfNotOk(r, data, 'ADM_001');
        return data;
    }

    window.UssAuthApi = {
        base: AUTH_API_BASE,
        parseTokenPayload: parseTokenPayload,
        getTokenExpiresAt: getTokenExpiresAt,
        isTokenExpired: isTokenExpired,
        isAuthSessionError: isAuthSessionError,
        authSessionExpiredMessage: authSessionExpiredMessage,

        setBase: function (url) {
            AUTH_API_BASE = String(url || '').replace(/\/$/, '') || AUTH_API_BASE;
            this.base = AUTH_API_BASE;
        },


        resolveAssetUrl: function (rel) {
            if (!rel || typeof rel !== 'string') return '';
            if (/^https?:\/\//i.test(rel)) return rel;
            var p = rel.charAt(0) === '/' ? rel : '/' + rel;
            return joinUrl(p);
        },


        communityImageThumbUrl: function (rel) {
            if (!rel || typeof rel !== 'string') return '';
            if (/^https?:\/\//i.test(rel)) return rel;
            var qs = '';
            var pathRel = rel;
            var qIdx = rel.indexOf('?');
            if (qIdx >= 0) {
                pathRel = rel.slice(0, qIdx);
                qs = rel.slice(qIdx);
            }
            if (pathRel.charAt(0) !== '/') pathRel = '/' + pathRel;
            if (pathRel.indexOf('/community-uploads/') !== 0) return joinUrl(pathRel + qs);
            var base = pathRel.split('/').pop() || '';
            var m = /^(.+)\.(jpe?g|png|gif|webp)$/i.exec(base);
            if (!m) return joinUrl(pathRel + qs);
            return joinUrl('/community-uploads/' + m[1] + '-thumb.webp' + qs);
        },

        async register(body, opts) {
            opts = opts || {};
            var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
            var pollMaxMs = opts.pollMaxMs != null ? Number(opts.pollMaxMs) : 300000;
            var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            var timer = null;
            if (controller) {
                timer = setTimeout(function () {
                    controller.abort();
                }, pollMaxMs + 15000);
            }
            var bases = [];
            var regBase =
                typeof window !== 'undefined' && window.USS_REGISTER_API_BASE
                    ? String(window.USS_REGISTER_API_BASE).replace(/\/$/, '')
                    : '';
            var mainBase = AUTH_API_BASE.replace(/\/$/, '');
            if (regBase && /^https?:\/\//i.test(regBase) && bases.indexOf(regBase) === -1) {
                bases.push(regBase);
            }
            if (mainBase && bases.indexOf(mainBase) === -1) {
                bases.push(mainBase);
            }
            if (!bases.length) bases.push(mainBase);

            function reportProgress(payload) {
                if (onProgress && payload) onProgress(payload);
            }

            async function pollRegisterJob(base, jobId, pollMs, message) {
                var deadline = Date.now() + pollMaxMs;
                var interval = Math.max(1000, Number(pollMs) || 2000);
                var transientFails = 0;
                reportProgress({ stage: 'pending', message: message || '正在处理注册，请稍候…' });
                while (Date.now() < deadline) {
                    if (controller && controller.signal && controller.signal.aborted) {
                        var abortErr = Err ? Err.makeError('REG_P001') : new Error('注册仍在处理中，请稍后在登录页尝试。');
                        throw abortErr;
                    }
                    await sleep(interval);
                    var sr;
                    try {
                        sr = await fetch(joinUrlWithBase(base, '/api/register/status/' + encodeURIComponent(jobId)), {
                            signal: controller ? controller.signal : undefined,
                        });
                    } catch (pollNetErr) {
                        transientFails += 1;
                        if (transientFails >= 5) throw pollNetErr;
                        continue;
                    }
                    transientFails = 0;
                    var statusData = await parseJson(sr);
                    if (sr.status === 404) {
                        var expiredErr = Err ? Err.makeError('REG_P002') : new Error('注册任务已过期，请重新提交注册。');
                        throw expiredErr;
                    }
                    if (!sr.ok && statusData && statusData.code) {
                        throwIfNotOk(sr, statusData, statusData.code);
                    }
                    if (statusData.message || statusData.stage) {
                        reportProgress({
                            stage: statusData.stage || 'pending',
                            message: statusData.message || '',
                        });
                    }
                    if (statusData.status === 'success') {
                        return {
                            token: statusData.token,
                            user: statusData.user,
                            sessionDays: statusData.sessionDays,
                            expiresAt: statusData.expiresAt,
                        };
                    }
                    if (statusData.status === 'failed') {
                        var failCode = (statusData && statusData.code) || 'SRV_001';
                        var failErr = Err ? Err.makeError(failCode, statusData && statusData.action ? { action: statusData.action } : null) : new Error('注册失败，请稍后重试。');
                        throw failErr;
                    }
                }
                var pollTimeoutErr = Err ? Err.makeError('REG_P001') : new Error('注册仍在处理中，请稍后在登录页尝试。');
                throw pollTimeoutErr;
            }

            var lastErr = null;
            try {
                for (var bi = 0; bi < bases.length; bi += 1) {
                    try {
                        var r = await fetch(joinUrlWithBase(bases[bi], '/api/register'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                            signal: controller ? controller.signal : undefined,
                        });
                        var data = await parseJson(r);
                        if (r.status === 202 && data && data.jobId) {
                            return await pollRegisterJob(
                                bases[bi],
                                data.jobId,
                                data.pollMs,
                                data.message
                            );
                        }
                        throwIfNotOk(r, data, 'AUTH_R006');
                        return data;
                    } catch (fetchErr) {
                        lastErr = fetchErr;
                        if (fetchErr && fetchErr.name === 'AbortError') {
                            var timeoutErr = Err ? Err.makeError('REG_P001') : new Error('注册仍在处理中，请稍后在登录页尝试。');
                            throw timeoutErr;
                        }
                        if (bi < bases.length - 1 && isFetchNetworkFailure(fetchErr)) {
                            continue;
                        }
                        throw fetchErr;
                    }
                }
                throw lastErr || (Err ? Err.makeError('NET_E001') : new Error('网络异常，请检查网络后重试。'));
            } finally {
                if (timer) clearTimeout(timer);
            }
        },

        async login(body) {
            var r = await fetch(joinUrl('/api/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            var raw = '';
            try {
                raw = await r.text();
            } catch (ignore) {}
            var data = {};
            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch (ignore) {}
            }
            if (!r.ok) {
                var fb = r.status === 401 ? 'AUTH_L001' : r.status >= 502 ? 'NET_E' + r.status : 'SRV_001';
                throwIfNotOk(r, data, fb);
            }
            return data;
        },

        async me(token) {
            var r = await fetch(joinUrl('/api/me'), {
                headers: { Authorization: 'Bearer ' + token }
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, r.status === 401 ? 'AUTH_S002' : 'AUTH_S001');
            return data;
        },

        async getClientPublicIpStatus() {
            var r = await fetch(joinUrl('/api/client-public-ip/status'), { cache: 'no-store' });
            var data = await parseJson(r);
            if (r.status === 404) {
                return { ok: false, code: (data && data.code) || 'IP_001' };
            }
            throwIfNotOk(r, data, 'SRV_001');
            return data;
        },

        async getClientPublicIp(token) {
            var r = await fetch(joinUrl('/api/client-public-ip'), {
                headers: { Authorization: 'Bearer ' + token },
                cache: 'no-store',
            });
            var data = await parseJson(r);
            if (r.status === 404) {
                return { ok: false, code: (data && data.code) || 'IP_001' };
            }
            throwIfNotOk(r, data, 'SRV_001');
            return data;
        },


        async refreshRsiProfile(token) {
            return this.syncRsiProfile(token, { refreshFromWeb: true, forceLoginSync: true });
        },

        async syncRsiProfile(token, payload) {
            var r = await fetch(joinUrl('/api/me/rsi-sync'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify(payload || { refreshFromWeb: true }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_H002');
            return data;
        },

        async changePassword(token, body) {
            var r = await fetch(joinUrl('/api/account/password'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify(body || {}),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_C001');
            return data;
        },

        async sendPasswordChangeCode(token) {
            var r = await fetch(joinUrl('/api/account/password/send-code'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_C007');
            return data;
        },

        async issueRsiBindCode(token, handle) {
            var r = await fetch(joinUrl('/api/account/rsi-bind/code'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ handle: handle }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_H011');
            return data;
        },

        async confirmRsiBind(token, handle) {
            var r = await fetch(joinUrl('/api/account/rsi-bind/confirm'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ handle: handle }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_H002');
            return data;
        },

        async sendEmailChangeCode(token) {
            var r = await fetch(joinUrl('/api/account/email/send-code'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_E007');
            return data;
        },

        async confirmEmailChange(token, body) {
            var r = await fetch(joinUrl('/api/account/email/confirm'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify(body || {}),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_E006');
            return data;
        },

        async sendEmailVerifyCode(token) {
            var r = await fetch(joinUrl('/api/account/email/verify/send-code'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_V004');
            return data;
        },

        async confirmEmailVerify(token, body) {
            var r = await fetch(joinUrl('/api/account/email/verify/confirm'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify(body || {}),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_V003');
            return data;
        },

        async getOopzBinding(token) {
            var r = await fetch(joinUrl('/api/me/oopz'), {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'OOPZ_001');
            return data;
        },

        async bindOopzId(token, oopzId) {
            var r = await fetch(joinUrl('/api/me/oopz/bind'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ oopzId: oopzId }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'OOPZ_001');
            return data;
        },

        async setOopzAnnounceEnabled(token, enabled) {
            var r = await fetch(joinUrl('/api/me/oopz/announce'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ enabled: !!enabled }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'OOPZ_005');
            return data;
        },

        async sendPasswordResetCode(email) {
            var r = await fetch(joinUrl('/api/password-reset/send-code'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_P008');
            return data;
        },

        async confirmPasswordReset(body) {
            var r = await fetch(joinUrl('/api/password-reset/confirm'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_P006');
            return data;
        },

        async health() {
            var r = await fetch(joinUrl('/api/health'));
            return r.ok;
        },

        async checkinStatus(token, branch) {
            var q = '';
            if (branch) {
                q = '?branch=' + encodeURIComponent(branch);
            }
            var r = await fetch(joinUrl('/api/checkin/status') + q, {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'CHK_001');
            return data;
        },

        async checkinHub(token) {
            var r = await fetch(joinUrl('/api/checkin/hub'), {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'CHK_001');
            return data;
        },


        checkinUnit: fetchCheckinBranchUnit,


        checkinSummary: fetchCheckinBranchUnit,

        async checkinCaptcha(token) {
            var r = await fetch(joinUrl('/api/checkin/captcha'), {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'CHK_010');
            return data;
        },

        async checkinCaptchaPuzzle(token, captchaId) {
            var id = encodeURIComponent(String(captchaId || '').trim());
            var r = await fetch(joinUrl('/api/checkin/captcha/' + id + '/puzzle'), {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'CHK_011');
            return data;
        },

        async checkin(token, body) {
            var r = await fetch(joinUrl('/api/checkin'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify(body || {}),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'CHK_002');
            return data;
        },

        async adminListAdmins(token) {
            return adminJson(token, '/api/admin/admins');
        },
        async adminAddAdmin(token, bindingId) {
            return adminJson(token, '/api/admin/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bindingId: bindingId }),
            });
        },
        async adminRemoveAdmin(token, bindingId) {
            return adminJson(token, '/api/admin/admins/' + encodeURIComponent(bindingId), { method: 'DELETE' });
        },
        async adminListUsers(token) {
            return adminJson(token, '/api/admin/users');
        },
        async adminPatchUser(token, userId, body) {
            return adminJson(token, '/api/admin/users/' + encodeURIComponent(userId), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminDeleteUser(token, userId) {
            return adminJson(token, '/api/admin/users/' + encodeURIComponent(userId), {
                method: 'DELETE',
            });
        },
        async adminCheckinBranch(token, branch, year, month) {
            var q = '/api/admin/checkin/branch?branch=' + encodeURIComponent(branch);
            if (year != null && month != null && String(year) !== '' && String(month) !== '') {
                q += '&year=' + encodeURIComponent(year) + '&month=' + encodeURIComponent(month);
            }
            return adminJson(token, q);
        },
        async adminAdjustPoints(token, body) {
            return adminJson(token, '/api/admin/checkin/adjust-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminCheckinMakeup(token, body) {
            return adminJson(token, '/api/admin/checkin/makeup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminCheckinMakeupPoints(token, branch, date) {
            var q =
                '/api/admin/checkin/makeup-points?branch=' +
                encodeURIComponent(branch) +
                '&date=' +
                encodeURIComponent(date);
            return adminJson(token, q);
        },
        async adminGetSchedule(token) {
            return adminJson(token, '/api/admin/checkin/schedule');
        },
        async adminPutSchedule(token, body) {
            return adminJson(token, '/api/admin/checkin/schedule', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminGetOopzAutoCheckin(token) {
            return adminJson(token, '/api/admin/checkin/oopz-auto');
        },
        async adminPutOopzAutoCheckin(token, body) {
            return adminJson(token, '/api/admin/checkin/oopz-auto', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminGetManualCheckinOopz(token) {
            return adminJson(token, '/api/admin/checkin/manual-oopz');
        },
        async adminPutManualCheckinOopz(token, body) {
            return adminJson(token, '/api/admin/checkin/manual-oopz', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminGetOopzTts(token) {
            return adminJson(token, '/api/admin/oopz/tts');
        },
        async adminGetOopzBridgeState(token) {
            return adminJson(token, '/api/oopz-bridge/state');
        },
        async adminPutOopzTts(token, body) {
            return adminJson(token, '/api/admin/oopz/tts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminListAnnouncements(token) {
            return adminJson(token, '/api/admin/announcements');
        },
        async adminGetVisitStats(token, query) {
            var q = query && typeof query === 'object' ? query : {};
            var parts = [];
            Object.keys(q).forEach(function (k) {
                if (q[k] == null || q[k] === '') return;
                parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(q[k])));
            });
            var suffix = parts.length ? '?' + parts.join('&') : '';
            return adminJson(token, '/api/admin/visit-stats' + suffix);
        },
        async adminCreateAnnouncement(token, body) {
            return adminJson(token, '/api/admin/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminUpdateAnnouncement(token, id, body) {
            return adminJson(token, '/api/admin/announcements/' + encodeURIComponent(id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminDeleteAnnouncement(token, id) {
            return adminJson(token, '/api/admin/announcements/' + encodeURIComponent(id), {
                method: 'DELETE',
            });
        },
        async announcementsActive(token) {
            var r = await fetch(joinUrl('/api/announcements/active?_=' + Date.now()), {
                cache: 'no-store',
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_S001');
            return data;
        },
        async announcementsAck(token, id) {
            var r = await fetch(joinUrl('/api/announcements/ack'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ id: id }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'VAL_001');
            return data;
        },
        async adminGetRegisterWhitelist(token) {
            return adminJson(token, '/api/admin/register-whitelist');
        },
        async adminPutRegisterWhitelist(token, body) {
            return adminJson(token, '/api/admin/register-whitelist', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
        },
        async adminAuditLog(token, limit, offset) {
            var q = '/api/admin/audit-log?limit=' + encodeURIComponent(limit != null ? limit : 80);
            if (offset != null && offset !== '') {
                q += '&offset=' + encodeURIComponent(offset);
            }
            return adminJson(token, q);
        },


        async rsiServerStatus() {
            var r = await fetch(joinUrl('/api/rsi-server-status?_=' + Date.now()), { cache: 'no-store' });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'RSI_001');
            return data;
        },


        async communityListPosts(token, limit) {
            var q = limit != null && limit !== '' ? '?limit=' + encodeURIComponent(limit) : '';
            var sep = q ? '&' : '?';
            var r = await fetch(joinUrl('/api/community/posts') + q + sep + '_=' + Date.now(), {
                cache: 'no-store',
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_P002');
            return data;
        },


        async communityGetPost(token, postId) {
            var r = await fetch(
                joinUrl('/api/community/posts/' + encodeURIComponent(postId)) + '?_=' + Date.now(),
                {
                    cache: 'no-store',
                    headers: { Authorization: 'Bearer ' + token },
                }
            );
            var data = await parseJson(r);
            if (r.status === 404) throwIfNotOk(r, data, 'COMM_P002');
            throwIfNotOk(r, data, 'COMM_P002');
            return data;
        },


        async communityCreatePost(token, body) {
            var r = await fetch(joinUrl('/api/community/posts'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify(body || {}),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_P003');
            return data;
        },

        async communityDeletePost(token, postId) {
            var r = await fetch(joinUrl('/api/community/posts/' + encodeURIComponent(postId)), {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_P014');
            return data;
        },

        async communityReplyPost(token, postId, content) {
            var r = await fetch(joinUrl('/api/community/posts/' + encodeURIComponent(postId) + '/replies'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ content: content }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_P008');
            return data;
        },

        async communityDeleteReply(token, postId, replyId) {
            var r = await fetch(
                joinUrl(
                    '/api/community/posts/' +
                        encodeURIComponent(postId) +
                        '/replies/' +
                        encodeURIComponent(replyId)
                ),
                {
                    method: 'DELETE',
                    headers: { Authorization: 'Bearer ' + token },
                }
            );
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_P013');
            return data;
        },

        async communityChatFetch(token, afterSeq) {
            var q = '';
            if (afterSeq != null && Number(afterSeq) > 0) {
                q = '?afterSeq=' + encodeURIComponent(afterSeq);
            }
            var r = await fetch(joinUrl('/api/community/chat') + q, {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'SRV_001');
            return data;
        },

        async communityChatSend(token, payload) {
            var body =
                typeof payload === 'string'
                    ? { text: payload, images: [] }
                    : Object.assign({ text: '', images: [] }, payload || {});
            var r = await fetch(joinUrl('/api/community/chat'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({
                    text: body.text != null ? body.text : '',
                    images: Array.isArray(body.images) ? body.images : [],
                }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_C001');
            return data;
        },

        async communityChatDelete(token, messageId) {
            var r = await fetch(joinUrl('/api/community/chat/' + encodeURIComponent(messageId)), {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_C006');
            return data;
        },

        async communityChatPin(token, messageId) {
            var r = await fetch(joinUrl('/api/community/chat/pin'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ messageId: messageId || null }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_C007');
            return data;
        },

        async communityRoster(token) {
            var r = await fetch(joinUrl('/api/community/roster'), {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_S003');
            return data;
        },

        async communityInbox(token) {
            var r = await fetch(joinUrl('/api/community/inbox'), {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'AUTH_S003');
            return data;
        },

        async communityDmFetch(token, peerBindingId, afterSeq) {
            var q = '?peerBindingId=' + encodeURIComponent(peerBindingId);
            if (afterSeq != null && Number(afterSeq) > 0) {
                q += '&afterSeq=' + encodeURIComponent(afterSeq);
            }
            var r = await fetch(joinUrl('/api/community/dm') + q, {
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_D001');
            return data;
        },

        async communityDmSend(token, peerBindingId, payload) {
            var body =
                typeof payload === 'string'
                    ? { text: payload, images: [] }
                    : Object.assign({ text: '', images: [] }, payload || {});
            var r = await fetch(joinUrl('/api/community/dm'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({
                    peerBindingId: peerBindingId,
                    text: body.text != null ? body.text : '',
                    images: Array.isArray(body.images) ? body.images : [],
                }),
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_C001');
            return data;
        },

        async communityDmDelete(token, messageId) {
            var r = await fetch(joinUrl('/api/community/dm/' + encodeURIComponent(messageId)), {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + token },
            });
            var data = await parseJson(r);
            throwIfNotOk(r, data, 'COMM_C006');
            return data;
        },
    };
})();
