
(function () {
    'use strict';

    var REFRESH_MS = 5 * 60 * 1000;

    var gridEl = null;
    var detailEl = null;
    var updatedEl = null;
    var timer = null;
    var lastData = null;
    var openKey = null;
    var staleRepollCount = 0;

    var SUMMARY_ZH = {
        operational: '全部服务正常',
        degraded: '检测到服务降级',
        partial: '检测到部分故障',
        major: '检测到严重故障',
        maintenance: '维护进行中',
        unknown: '状态未知',
    };

    var TONE_BY_STATUS = {
        operational: 'green',
        degraded: 'yellow',
        partial: 'orange',
        major: 'red',
        maintenance: 'blue',
        unknown: 'gray',
    };

    function apiBase() {
        if (window.UssAuthApi && window.UssAuthApi.base) {
            return String(window.UssAuthApi.base).replace(/\/$/, '');
        }
        if (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) {
            return String(window.USS_AUTH_API_BASE).replace(/\/$/, '');
        }
        return 'http://127.0.0.1:3789';
    }

    function apiBaseCandidates() {
        var seen = {};
        var list = [];
        function add(url) {
            var u = String(url || '').replace(/\/$/, '');
            if (!u || seen[u]) return;
            seen[u] = true;
            list.push(u);
        }
        add(apiBase());
        var origin = window.location && window.location.origin;
        var host = window.location && window.location.hostname;
        if (origin && /^https?:\/\//i.test(origin)) add(origin);
        if (host === 'localhost' || host === '[::1]' || host === '::1') add('http://localhost:3789');
        add('http://127.0.0.1:3789');
        return list;
    }

    function formatFetchedAt(iso) {
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString('zh-CN', {
                hour12: false,
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
        } catch (e) {
            return '';
        }
    }

    function ensureUpdatedEl() {
        if (updatedEl) return updatedEl;
        updatedEl = document.getElementById('rsiServerStatusUpdated');
        return updatedEl;
    }

    function renderUpdated(data) {
        var el = ensureUpdatedEl();
        if (!el || !data || !data.fetchedAt) {
            if (el) el.hidden = true;
            return;
        }
        var when = formatFetchedAt(data.fetchedAt);
        el.textContent = when || '';
        el.hidden = !when;
    }

    function ensureDetailEl() {
        if (!detailEl) detailEl = document.getElementById('rsiServerStatusDetail');
        return detailEl;
    }

    function hideDetail() {
        var el = ensureDetailEl();
        if (!el) return;
        el.hidden = true;
        el.innerHTML = '';
    }

    function deriveSummary(components) {
        var rank = { major: 5, partial: 4, degraded: 3, maintenance: 2, operational: 1, unknown: 0 };
        var worst = 'operational';
        var seen = false;
        (components || []).forEach(function (row) {
            var status = row && row.status;
            if (!status || status === 'unknown') return;
            seen = true;
            if ((rank[status] || 0) > (rank[worst] || 0)) worst = status;
        });
        if (!seen) worst = 'unknown';
        return {
            status: worst,
            labelZh: SUMMARY_ZH[worst] || '状态未知',
            tone: TONE_BY_STATUS[worst] || 'gray',
        };
    }

    function normName(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function incidentMatches(item, row) {
        var aliases = [row && row.key, row && row.name, row && row.label, row && row.labelEn]
            .map(normName)
            .filter(Boolean);
        var affected = item && Array.isArray(item.affected) ? item.affected : [];
        if (!affected.length) return false;
        return affected.some(function (entry) {
            var name = normName(entry && (entry.name || entry.label));
            if (!name) return false;
            return aliases.some(function (alias) {
                return alias === name || name.indexOf(alias) >= 0 || alias.indexOf(name) >= 0;
            });
        });
    }

    function detailFor(row, data) {
        var components = data && Array.isArray(data.components) ? data.components : [];
        var summary = data && data.summary && data.summary.status ? data.summary : deriveSummary(components);
        var incidents = (data && Array.isArray(data.incidents) ? data.incidents : []).filter(function (item) {
            return incidentMatches(item, row);
        });
        var showSummary =
            summary &&
            summary.status &&
            summary.status !== 'operational' &&
            summary.status !== 'unknown' &&
            row &&
            row.status === summary.status;
        return {
            summary: showSummary ? summary : null,
            incidents: incidents,
        };
    }

    function hasDetail(row, data) {
        var detail = detailFor(row, data);
        return !!(detail.summary || detail.incidents.length);
    }

    function buildSummaryBar(summary) {
        var tone = summary.tone || TONE_BY_STATUS[summary.status] || 'gray';
        var bar = document.createElement('div');
        bar.className = 'rsi-status-summary rsi-status-summary--' + tone;
        var main = document.createElement('div');
        main.className = 'rsi-status-summary-main';
        var dot = document.createElement('span');
        dot.className = 'rsi-status-dot';
        dot.setAttribute('aria-hidden', 'true');
        dot.style.background =
            tone === 'green'
                ? '#3dd97a'
                : tone === 'yellow'
                  ? '#f0c040'
                  : tone === 'orange'
                    ? '#ff8c3a'
                    : tone === 'red'
                      ? '#ff5555'
                      : tone === 'blue'
                        ? '#54adf7'
                        : '#aab5bb';
        var text = document.createElement('span');
        text.className = 'rsi-status-summary-text';
        text.textContent = summary.labelZh || SUMMARY_ZH[summary.status] || '状态未知';
        main.appendChild(dot);
        main.appendChild(text);
        bar.appendChild(main);
        return bar;
    }

    function buildIncidentCard(item) {
        var tone = item.tone || TONE_BY_STATUS[item.status] || 'yellow';
        var card = document.createElement('article');
        card.className = 'rsi-status-incident rsi-status-incident--' + tone;

        var kicker = document.createElement('p');
        kicker.className = 'rsi-status-incident-kicker';
        kicker.textContent = '官网通报 · 未解决';

        var title = document.createElement('h3');
        title.className = 'rsi-status-incident-title';
        title.textContent = item.title || '服务异常';

        card.appendChild(kicker);
        card.appendChild(title);

        var lines = Array.isArray(item.lines) ? item.lines : [];
        if (lines.length) {
            var body = document.createElement('div');
            body.className = 'rsi-status-incident-body';
            lines.forEach(function (line) {
                var p = document.createElement('p');
                p.textContent = line;
                body.appendChild(p);
            });
            card.appendChild(body);
        }

        if (item.url) {
            var link = document.createElement('a');
            link.className = 'rsi-status-incident-link';
            link.href = item.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = '查看官网原文';
            card.appendChild(link);
        }
        return card;
    }

    function showDetail(row, data) {
        var el = ensureDetailEl();
        if (!el) return;
        var detail = detailFor(row, data);
        el.innerHTML = '';
        if (detail.summary) el.appendChild(buildSummaryBar(detail.summary));
        detail.incidents.forEach(function (item) {
            el.appendChild(buildIncidentCard(item));
        });
        el.hidden = !el.childNodes.length;
        if (gridEl) {
            var cards = gridEl.querySelectorAll('.rsi-status-card');
            cards.forEach(function (card) {
                var on = card.getAttribute('data-key') === row.key;
                card.classList.toggle('is-open', on);
                if (card.hasAttribute('aria-expanded')) card.setAttribute('aria-expanded', on ? 'true' : 'false');
            });
        }
    }

    function scheduleStaleRepoll(data) {
        var age = data && Number(data.cacheAgeMs);
        if (!data || data.stale !== true || !isFinite(age) || age < 20 * 60 * 1000) {
            staleRepollCount = 0;
            return;
        }
        if (staleRepollCount >= 4) return;
        staleRepollCount += 1;
        setTimeout(function () {
            if (window.UssHomeStatusLoader) {
                window.UssHomeStatusLoader.refresh();
                return;
            }
            loadStatus({ silent: true });
        }, 5000);
    }

    function renderLoading() {
        if (!gridEl) return;
        openKey = null;
        hideDetail();
        gridEl.innerHTML = '<div class="rsi-status-loading" role="status">正在加载服务器状态…</div>';
        if (updatedEl) updatedEl.hidden = true;
    }

    function formatFetchError(err) {
        var msg = (err && err.message) || '';
        if (!msg || msg === 'Failed to fetch' || (err && err.name === 'TypeError')) {
            return '无法连接后端 API，请确认：① backend 已启动（端口 3789）；② 使用 node frontend/dev-server.js 或 本地测试启动.bat 打开前端（不要用 npx serve）';
        }
        return msg;
    }

    function renderError(msg) {
        if (!gridEl) return;
        openKey = null;
        hideDetail();
        gridEl.innerHTML =
            '<div class="rsi-status-error" role="alert">' +
            String(msg || '暂时无法获取状态，请稍后重试') +
            '</div>';
    }

    function renderCard(row, data) {
        var tone = row.tone || 'gray';
        var card = document.createElement('article');
        card.className = 'rsi-status-card rsi-status-card--' + tone;
        card.setAttribute('data-status', row.status || 'unknown');
        card.setAttribute('data-key', row.key || '');
        if (hasDetail(row, data)) {
            card.classList.add('rsi-status-card--action');
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-expanded', openKey === row.key ? 'true' : 'false');
            card.setAttribute('aria-label', (row.label || row.name || '服务器') + '，查看详情');
            var toggle = function () {
                if (openKey === row.key) {
                    openKey = null;
                    hideDetail();
                    card.classList.remove('is-open');
                    card.setAttribute('aria-expanded', 'false');
                    return;
                }
                openKey = row.key;
                showDetail(row, lastData || data);
            };
            card.addEventListener('click', toggle);
            card.addEventListener('keydown', function (event) {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggle();
            });
        }

        var head = document.createElement('div');
        head.className = 'rsi-status-card-head';

        var title = document.createElement('h3');
        title.className = 'rsi-status-card-title';
        title.textContent = row.label || row.name || '—';

        var sub = document.createElement('p');
        sub.className = 'rsi-status-card-sub';
        sub.textContent = row.labelEn || row.name || '';

        head.appendChild(title);
        head.appendChild(sub);

        var badge = document.createElement('div');
        badge.className = 'rsi-status-badge rsi-status-badge--' + tone;

        var dot = document.createElement('span');
        dot.className = 'rsi-status-dot';
        dot.setAttribute('aria-hidden', 'true');

        var label = document.createElement('span');
        label.className = 'rsi-status-label';
        label.textContent = row.statusLabelZh || row.statusLabel || '—';

        badge.appendChild(dot);
        badge.appendChild(label);

        card.appendChild(head);
        card.appendChild(badge);
        return card;
    }

    function render(data) {
        if (!gridEl) return;
        var list = data && Array.isArray(data.components) ? data.components : [];
        if (!list.length) {
            renderError('未解析到服务器状态');
            return;
        }

        gridEl.innerHTML = '';
        lastData = data;
        list.forEach(function (row) {
            gridEl.appendChild(renderCard(row, data));
        });
        var opened = openKey ? list.find(function (row) { return row.key === openKey; }) : null;
        if (opened && hasDetail(opened, data)) showDetail(opened, data);
        else {
            openKey = null;
            hideDetail();
        }
        renderUpdated(data);
        scheduleStaleRepoll(data);
    }

    async function fetchFromBackend() {
        var lastErr = null;
        var bases = apiBaseCandidates();
        for (var i = 0; i < bases.length; i++) {
            var base = bases[i];
            try {
                var url = base + '/api/rsi-server-status?_=' + Date.now();
                var fetchOpts = {
                    cache: 'no-store',
                    headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
                };
                if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
                    fetchOpts.signal = AbortSignal.timeout(5000);
                }
                var r = await fetch(url, fetchOpts);
                var data = {};
                try {
                    data = await r.json();
                } catch (e) {
                    data = {};
                }
                if (!r.ok || !data.ok) {
                    var code = (data && data.code) || 'RSI_001';
                    throw typeof UssApiError !== 'undefined'
                        ? UssApiError.createApiError(r.status, data, code)
                        : new Error('暂时无法获取 RSI 服务器状态，请稍后刷新。');
                }
                return data;
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr || new Error('Failed to fetch');
    }

    async function loadStatus(options) {
        if (!gridEl) return;
        var opts = options || {};
        if (!opts.silent) renderLoading();

        try {
            var data = await fetchFromBackend();
            render(data);
        } catch (err) {
            renderError(formatFetchError(err));
        }
    }

    var optsSilent = false;

    function scheduleRefresh() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () {
            loadStatus({ silent: true });
        }, REFRESH_MS);
    }

    function initWithLoader() {
        gridEl = document.getElementById('rsiServerStatusGrid');
        if (!gridEl) return;
        ensureUpdatedEl();

        var cached = window.UssHomeStatusLoader.getCached();
        if (cached && cached.rsiServerStatus && cached.rsiServerStatus.ok) {
            render(cached.rsiServerStatus);
        } else {
            renderLoading();
        }

        window.UssHomeStatusLoader.subscribe(function (payload) {
            if (!payload || !payload.rsiServerStatus) return;
            if (payload.rsiServerStatus.ok) {
                render(payload.rsiServerStatus);
                return;
            }
            if (!optsSilent) {
                renderError(
                    typeof UssApiError !== 'undefined'
                        ? UssApiError.formatUserError(payload.rsiServerStatus.code || 'RSI_001')
                        : '暂时无法获取 RSI 服务器状态，请稍后刷新。'
                );
            }
        });

        scheduleRefreshLoader();
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible') return;
            optsSilent = true;
            window.UssHomeStatusLoader.refresh().finally(function () {
                optsSilent = false;
            });
        });
    }

    function scheduleRefreshLoader() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () {
            optsSilent = true;
            window.UssHomeStatusLoader.refresh().finally(function () {
                optsSilent = false;
            });
        }, REFRESH_MS);
    }

    function initLegacy() {
        gridEl = document.getElementById('rsiServerStatusGrid');
        if (!gridEl) return;
        ensureUpdatedEl();
        loadStatus();
        scheduleRefresh();
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible') return;
            loadStatus({ silent: true });
        });
    }

    function init() {
        if (window.UssHomeStatusLoader) {
            initWithLoader();
            return;
        }
        initLegacy();
    }

    function scheduleInit() {
        if (window.__ussPageReady) {
            init();
            return;
        }
        window.addEventListener(
            'uss:page-ready',
            function onReady() {
                window.removeEventListener('uss:page-ready', onReady);
                init();
            },
            { once: true }
        );
        setTimeout(init, 0);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleInit);
    } else {
        scheduleInit();
    }
})();
