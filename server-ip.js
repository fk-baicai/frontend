/**
 * 服务器 IP / 状态页面（人人可访问；真实 IP 仅舰队成员/白名单可见，其余显示 ******）
 */
(function () {
    if (typeof document === 'undefined') return;

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var pollTimer = null;
    var MASKED_IP = '******';

    var mainEl = document.getElementById('serverIpMain');
    var valueEl = document.getElementById('serverIpValue');
    var metaEl = document.getElementById('serverIpMeta');
    var detailsEl = document.getElementById('serverIpDetails');
    var errEl = document.getElementById('serverIpError');

    function loadSession() {
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

    /** 与 home-app 一致：舰队成员或白名单可见真实 IP */
    function hasFleetPrivilege() {
        var sess = loadSession();
        if (!sess) return false;
        if (sess.hasFleetPrivilege === true || sess.hasFleetPrivilege === 1) return true;
        if (sess.hasFleetPrivilege === false || sess.hasFleetPrivilege === 0) return false;
        if (sess.memberKind === 'civilian') return false;
        return true;
    }

    function maskIpHint(opts) {
        opts = opts || {};
        if (opts.civilianLoggedIn) return '仅舰队成员可见真实 IP';
        return '登录后可见真实 IP';
    }

    function showError(msg) {
        if (!errEl) return;
        errEl.textContent = msg;
        errEl.classList.remove('is-hidden');
    }

    function hideError() {
        if (errEl) errEl.classList.add('is-hidden');
    }

    function formatUpdatedAt(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return '更新于 ' + d.toLocaleString('zh-CN', { hour12: false });
    }

    function formatPercent(n) {
        var v = Number(n);
        if (!isFinite(v)) return '—';
        return v.toFixed(1) + '%';
    }

    function formatBps(bps) {
        var n = Number(bps);
        if (!isFinite(n) || n < 0) return '—';
        if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB/s';
        if (n >= 1024) return (n / 1024).toFixed(1) + ' KB/s';
        return Math.round(n) + ' B/s';
    }

    function joinNames(list, fallback) {
        if (!list || !list.length) return fallback || '—';
        return list.join(' · ');
    }

    function buildDetailCard(title, value, hwName, subLines, opts) {
        opts = opts || {};
        var card = document.createElement('div');
        card.className = 'server-ip-detail-card';
        if (opts.type) card.setAttribute('data-type', opts.type);

        var head = document.createElement('div');
        head.className = 'server-ip-detail-head';

        var titleEl = document.createElement('span');
        titleEl.className = 'server-ip-detail-title';
        titleEl.textContent = title;

        var detailValueEl = document.createElement('span');
        detailValueEl.className = 'server-ip-detail-value';
        detailValueEl.textContent = value;

        head.appendChild(titleEl);
        head.appendChild(detailValueEl);
        card.appendChild(head);

        if (opts.percent != null && isFinite(Number(opts.percent))) {
            var meter = document.createElement('div');
            meter.className = 'server-ip-meter';
            var fill = document.createElement('span');
            fill.className = 'server-ip-meter-fill';
            fill.style.width = Math.min(100, Math.max(0, Number(opts.percent))) + '%';
            meter.appendChild(fill);
            card.appendChild(meter);
        }

        if (hwName) {
            var hwEl = document.createElement('span');
            hwEl.className = 'server-ip-hw-name';
            hwEl.textContent = hwName;
            card.appendChild(hwEl);
        }

        if (subLines && subLines.length) {
            subLines.forEach(function (line) {
                var sub = document.createElement('span');
                sub.className = 'server-ip-detail-sub';
                sub.textContent = line;
                card.appendChild(sub);
            });
        }

        return card;
    }

    function renderDetails(data) {
        if (!detailsEl) return;
        detailsEl.innerHTML = '';

        var metrics = (data && data.metrics) || {};
        var hw = (data && data.hardware) || {};

        detailsEl.hidden = false;

        detailsEl.appendChild(
            buildDetailCard('CPU 占用', formatPercent(metrics.cpuPercent), hw.cpuName || '—', null, {
                type: 'cpu',
                percent: metrics.cpuPercent,
            })
        );
        detailsEl.appendChild(
            buildDetailCard('内存占用', formatPercent(metrics.memPercent), hw.memName || '—', null, {
                type: 'mem',
                percent: metrics.memPercent,
            })
        );
        detailsEl.appendChild(
            buildDetailCard(
                '硬盘传输',
                formatBps(metrics.diskReadBps) + ' ↓',
                joinNames(hw.diskNames, '—'),
                ['写入: ' + formatBps(metrics.diskWriteBps)],
                { type: 'disk' }
            )
        );
        detailsEl.appendChild(
            buildDetailCard(
                '网络传输',
                formatBps(metrics.netDownBps) + ' ↓',
                joinNames(hw.netNames, '—'),
                ['上行: ' + formatBps(metrics.netUpBps)],
                { type: 'net' }
            )
        );
    }

    function render(data, opts) {
        opts = opts || {};
        if (!valueEl) return;

        if (data && data.ok) {
            valueEl.textContent = opts.maskIp ? MASKED_IP : data.ip || '—';
            if (metaEl) {
                var parts = [];
                var updated = formatUpdatedAt(data.updatedAt);
                if (updated) parts.push(updated);
                if (opts.maskIp) parts.push(maskIpHint(opts));
                metaEl.textContent = parts.join(' · ') || '已上报';
            }
            renderDetails(data);
            hideError();
            return;
        }

        valueEl.textContent = opts.maskIp ? MASKED_IP : '—';
        if (metaEl) {
            var waitCode = (data && data.code) || 'IP_001';
            var waitMsg =
                typeof UssApiError !== 'undefined'
                    ? UssApiError.formatUserError(waitCode)
                    : '服务器 IP 尚未上报。';
            metaEl.textContent = opts.maskIp ? maskIpHint(opts) + ' · ' + waitMsg : waitMsg;
        }
        renderDetails(null);
        hideError();
    }

    function apiErrText(data, err) {
        if (typeof UssApiError !== 'undefined') {
            if (err) return UssApiError.sanitizeUserMessage(err);
            if (data && data.code) return UssApiError.formatUserError(data.code);
        }
        return '暂时无法获取服务器 IP 信息，请稍后刷新。';
    }

    function fetchServerIp() {
        if (!window.UssAuthApi) {
            showError(typeof UssApiError !== 'undefined' ? UssApiError.formatUserError('NET_E001') : '网络异常，请检查网络后重试。');
            return Promise.resolve();
        }
        var sess = loadSession();
        if (!sess || !sess.token) return Promise.resolve();

        var fleet = hasFleetPrivilege();
        var req = fleet
            ? window.UssAuthApi.getClientPublicIp(sess.token)
            : window.UssAuthApi.getClientPublicIpStatus();

        return req
            .then(function (data) {
                render(data, { maskIp: !fleet, civilianLoggedIn: !fleet && isLoggedIn() });
            })
            .catch(function (e) {
                if (fleet && e && e.code === 'AUTH_F001') {
                    return window.UssAuthApi.getClientPublicIpStatus()
                        .then(function (data) {
                            render(data, { maskIp: true, civilianLoggedIn: true });
                        })
                        .catch(function (e2) {
                            render({ ok: false, code: (e2 && e2.code) || 'SRV_001' }, {
                                maskIp: true,
                                civilianLoggedIn: true,
                            });
                            showError(apiErrText(null, e2));
                        });
                }
                render(
                    { ok: false, code: (e && e.code) || 'SRV_001' },
                    { maskIp: !fleet, civilianLoggedIn: !fleet && isLoggedIn() }
                );
                showError(apiErrText(null, e));
            });
    }

    function fetchGuestStatus() {
        if (!window.UssAuthApi) {
            render(null, { maskIp: true });
            showError(typeof UssApiError !== 'undefined' ? UssApiError.formatUserError('NET_E001') : '网络异常，请检查网络后重试。');
            return Promise.resolve();
        }

        return window.UssAuthApi.getClientPublicIpStatus()
            .then(function (data) {
                render(data, { maskIp: true, civilianLoggedIn: false });
            })
            .catch(function (e) {
                render({ ok: false, code: (e && e.code) || 'SRV_001' }, { maskIp: true, civilianLoggedIn: false });
                showError(apiErrText(null, e));
            });
    }

    function syncView() {
        if (mainEl) mainEl.hidden = false;
        if (window.UssNavTools && typeof window.UssNavTools.refresh === 'function') {
            window.UssNavTools.refresh();
        }
        if (isLoggedIn()) {
            fetchServerIp();
        } else {
            fetchGuestStatus();
        }
    }

    function start() {
        renderDetails(null);
        syncView();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(syncView, 30000);
    }

    window.addEventListener('storage', syncView);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') syncView();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
