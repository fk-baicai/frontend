
(function () {
    'use strict';

    var POLL_MS = 5 * 60 * 1000;
    var PERIODS = [
        { id: 'hour', label: '小时' },
        { id: 'day', label: '天' },
        { id: 'week', label: '周' },
        { id: 'month', label: '月' },
    ];

    var fundsEl = null;
    var fansEl = null;
    var chartEl = null;
    var tabsEl = null;
    var updatedEl = null;
    var timer = null;
    var resizeTimer = null;
    var currentPeriod = 'month';
    var lastData = null;
    var chartPoints = [];
    var chartLayout = null;
    var chartActiveIndex = -1;

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

    function formatInt(n) {
        var v = Math.round(Number(n));
        if (!isFinite(v)) return '—';
        return v.toLocaleString('en-US');
    }

    function formatUsd(n) {
        var v = Number(n);
        if (!isFinite(v)) return '—';
        return Math.round(v).toLocaleString('en-US');
    }

    function formatUsdSigned(n) {
        var v = Number(n);
        if (!isFinite(v)) return '—';
        var sign = v > 0 ? '+' : v < 0 ? '-' : '';
        return sign + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
    }

    function formatUsdCompact(n) {
        var v = Number(n);
        if (!isFinite(v)) return '—';
        var sign = v < 0 ? '-' : '';
        var abs = Math.abs(v);
        if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(abs >= 10000000 ? 1 : 2) + 'M';
        if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'K';
        return sign + '$' + Math.round(abs).toLocaleString('en-US');
    }

    var PERIOD_COMPARE = {
        hour: { now: '本小时', prev: '上一小时' },
        day: { now: '本日', prev: '上一天' },
        week: { now: '本周', prev: '上一周' },
        month: { now: '本月', prev: '上一月' },
    };

    function periodCopy(period) {
        return PERIOD_COMPARE[period] || { now: '本时段', prev: '上一时段' };
    }

    function withPeriodDeltas(points) {
        var list = Array.isArray(points) ? points : [];
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var raised = Number(list[i].grossUsd) || 0;
            var prevRaised = i > 0 ? Number(list[i - 1].grossUsd) || 0 : null;
            out.push({
                key: list[i].key,
                axis: list[i].axis,
                grossUsd: raised,
                raised: raised,
                prevRaised: prevRaised,
                diff: prevRaised == null ? null : raised - prevRaised,
            });
        }
        return out;
    }

    function formatAxisLabel(point, period) {
        if (!point) return '';
        if (period === 'hour' && point.key) {
            var parts = String(point.key).split(' ');
            return parts.length > 1 ? parts[1].slice(0, 5) : point.axis;
        }
        if (period === 'month' && point.key) {
            var m = String(point.key).split('-');
            if (m.length === 2) return Number(m[1]) + '月';
        }
        return String(point.axis != null ? point.axis : point.key || '');
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

    function hideChartTip() {
        if (!chartEl) return;
        var tip = chartEl.querySelector('.rsi-funding-chart-tooltip');
        if (tip) tip.hidden = true;
        chartEl.querySelectorAll('.rsi-funding-chart-point.is-active').forEach(function (node) {
            node.classList.remove('is-active');
        });
        chartActiveIndex = -1;
    }

    function showChartTip(index, cx, cy) {
        if (!chartEl || !chartLayout) return;
        var tip = chartEl.querySelector('.rsi-funding-chart-tooltip');
        var svg = chartEl.querySelector('.rsi-funding-chart-svg');
        var point = chartPoints[index];
        if (!tip || !svg || !point) return;

        var valEl = tip.querySelector('.rsi-funding-chart-tooltip-value');
        var cmpEl = tip.querySelector('.rsi-funding-chart-tooltip-compare');
        if (valEl) valEl.textContent = '$' + formatInt(point.raised);
        if (cmpEl) {
            if (point.diff == null || point.prevRaised == null) {
                cmpEl.textContent = '累计 $' + formatInt(point.grossUsd);
                cmpEl.className = 'rsi-funding-chart-tooltip-compare';
            } else {
                var pct = point.prevRaised ? (point.diff / Math.abs(point.prevRaised)) * 100 : null;
                var pctText = pct == null || !isFinite(pct) ? '' : ' · ' + (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';
                cmpEl.textContent = '较' + periodCopy(currentPeriod).prev + ' ' + formatUsdSigned(point.diff) + pctText;
                cmpEl.className = 'rsi-funding-chart-tooltip-compare' + (point.diff > 0 ? ' is-up' : point.diff < 0 ? ' is-down' : '');
            }
        }

        var frameRect = chartEl.getBoundingClientRect();
        var svgRect = svg.getBoundingClientRect();
        var xRatio = Number(cx) / chartLayout.width;
        var yRatio = Number(cy) / chartLayout.height;
        var tipLeft = svgRect.left - frameRect.left + svgRect.width * xRatio;
        var tipTop = svgRect.top - frameRect.top + svgRect.height * yRatio;
        tip.style.left = tipLeft + 'px';
        tip.style.top = tipTop + 'px';
        tip.hidden = false;
        var tipW = tip.offsetWidth;
        var edge = 6;
        var minCenter = edge + tipW / 2;
        var maxCenter = frameRect.width - edge - tipW / 2;
        if (tipLeft < minCenter) tipLeft = minCenter;
        if (tipLeft > maxCenter) tipLeft = maxCenter;
        tip.style.left = tipLeft + 'px';

        chartEl.querySelectorAll('.rsi-funding-chart-point').forEach(function (node) {
            node.classList.toggle('is-active', Number(node.getAttribute('data-index')) === index);
        });
        chartActiveIndex = index;
    }

    function bindChartInteraction() {
        if (!chartEl || chartEl._rsiChartBound) return;
        chartEl._rsiChartBound = true;
        chartEl.addEventListener('click', function (e) {
            var pointNode = e.target.closest('.rsi-funding-chart-point');
            if (!pointNode) {
                hideChartTip();
                return;
            }
            var index = Number(pointNode.getAttribute('data-index'));
            if (!isFinite(index)) return;
            var hit = pointNode.querySelector('.rsi-funding-chart-hit');
            if (!hit) return;
            if (chartActiveIndex === index) {
                hideChartTip();
                return;
            }
            showChartTip(index, hit.getAttribute('cx'), hit.getAttribute('cy'));
        });
    }

    function buildLinePath(points) {
        if (!points || !points.length) return '';
        if (points.length === 1) {
            return 'M' + points[0].x.toFixed(1) + ',' + points[0].y.toFixed(1);
        }

        var d = 'M' + points[0].x.toFixed(1) + ',' + points[0].y.toFixed(1);
        for (var i = 1; i < points.length; i++) {
            d += ' L' + points[i].x.toFixed(1) + ',' + points[i].y.toFixed(1);
        }
        return d;
    }

    function buildAreaPath(points, baselineY) {
        if (!points || !points.length) return '';
        var line = buildLinePath(points);
        if (!line) return '';
        var first = points[0];
        var last = points[points.length - 1];
        return (
            line +
            ' L' +
            last.x.toFixed(1) +
            ',' +
            baselineY +
            ' L' +
            first.x.toFixed(1) +
            ',' +
            baselineY +
            ' Z'
        );
    }

    function getChartMetrics() {
        var mobile =
            typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches;
        var compact =
            typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
        var width = 760;
        var height = compact ? (mobile ? 300 : 250) : 260;
        var padL = mobile ? 28 : 36;
        var padR = mobile ? 28 : 36;
        var padT = mobile ? 36 : 46;
        var padB = mobile ? 26 : 32;
        var axisOffset = mobile ? 12 : 10;
        var axisFont = mobile ? 14 : compact ? 12 : 11;

        if (chartEl) {
            var cs = window.getComputedStyle(chartEl);
            var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
            var innerW = chartEl.clientWidth - padX;
            if (innerW > 100) width = Math.max(280, Math.round(innerW));
        }

        return {
            width: width,
            height: height,
            padL: padL,
            padR: padR,
            padT: padT,
            padB: padB,
            axisOffset: axisOffset,
            axisFont: axisFont,
        };
    }

    function renderChart(points, period) {
        if (!chartEl) return;
        hideChartTip();
        var list = withPeriodDeltas(points);
        chartPoints = list;
        if (!list.length) {
            chartEl.innerHTML = '<p class="rsi-funding-chart-empty">暂无图表数据</p>';
            chartLayout = null;
            return;
        }

        var metrics = getChartMetrics();
        var width = metrics.width;
        var height = metrics.height;
        var padL = metrics.padL;
        var padR = metrics.padR;
        var padT = metrics.padT;
        var padB = metrics.padB;
        var innerW = width - padL - padR;
        var innerH = height - padT - padB;
        chartLayout = { width: width, height: height };

        var values = list.map(function (p) {
            return Number(p.raised) || 0;
        });
        var maxV = Math.max.apply(null, values.concat([1]));
        var minV = Math.min.apply(null, values.concat([0]));
        var dataRange = Math.max(maxV - minV, maxV * 0.05, 1);
        var yMargin = dataRange * 0.04;
        var yMin = minV - yMargin;
        var yMax = maxV + yMargin;
        var yRange = Math.max(yMax - yMin, 1);

        function xAt(i) {
            if (list.length <= 1) return padL + innerW / 2;
            return padL + (innerW * i) / (list.length - 1);
        }

        function yAt(v) {
            return padT + innerH - ((v - yMin) / yRange) * innerH;
        }

        var plotPoints = list.map(function (p, i) {
            return {
                x: xAt(i),
                y: yAt(Number(p.raised) || 0),
            };
        });
        var linePath = buildLinePath(plotPoints);
        var baselineY = padT + innerH;
        var areaPath = buildAreaPath(plotPoints, baselineY);

        var gridLines = '';
        for (var g = 0; g <= 4; g++) {
            var gy = padT + (innerH * g) / 4;
            gridLines +=
                '<line x1="' +
                padL +
                '" y1="' +
                gy +
                '" x2="' +
                (width - padR) +
                '" y2="' +
                gy +
                '" class="rsi-funding-chart-grid"/>';
        }

        var pointGap = list.length > 1 ? innerW / (list.length - 1) : innerW;
        var maxIndex = 0;
        list.forEach(function (p, i) {
            if ((Number(p.raised) || 0) > (Number(list[maxIndex].raised) || 0)) maxIndex = i;
        });
        var shownLabels = Object.create(null);
        function labelY(i) {
            return yAt(Number(list[i].raised) || 0);
        }
        function labelConflicts(i) {
            var x = xAt(i);
            var y = labelY(i);
            var keys = Object.keys(shownLabels);
            for (var k = 0; k < keys.length; k++) {
                var other = Number(keys[k]);
                if (Math.abs(xAt(other) - x) < 58 && Math.abs(labelY(other) - y) < 18) return true;
            }
            return false;
        }
        function keepLabel(i, force) {
            if (shownLabels[i]) return;
            if (!force && labelConflicts(i)) return;
            shownLabels[i] = true;
        }
        keepLabel(maxIndex, true);
        keepLabel(0, false);
        keepLabel(list.length - 1, false);
        for (var li = 0; li < list.length; li++) keepLabel(li, false);
        var dots = list
            .map(function (p, i) {
                var x = xAt(i);
                var y = yAt(Number(p.raised) || 0);
                var label = formatAxisLabel(p, period);
                var showValue = !!shownLabels[i];
                var deltaLabel = '';
                var valueLabel = '';
                if (showValue && p.diff != null && pointGap >= 96) {
                    var deltaClass = p.diff > 0 ? 'is-up' : p.diff < 0 ? 'is-down' : '';
                    deltaLabel =
                        '<text x="' +
                        x +
                        '" y="' +
                        (y - 22) +
                        '" class="rsi-funding-chart-pct ' +
                        deltaClass +
                        '" text-anchor="middle">' +
                        formatUsdCompact(p.diff) +
                        '</text>';
                }
                if (showValue) {
                    valueLabel =
                        '<text x="' +
                        x +
                        '" y="' +
                        (y - 8) +
                        '" class="rsi-funding-chart-value" text-anchor="middle">' +
                        formatUsdCompact(p.raised) +
                        '</text>';
                }
                var anchor = 'middle';
                var labelX = x;
                return (
                    '<g class="rsi-funding-chart-point" data-index="' +
                    i +
                    '" role="button" tabindex="0" aria-label="' +
                    label +
                    ' 新增 $' +
                    formatInt(p.raised) +
                    '">' +
                    '<circle cx="' +
                    x +
                    '" cy="' +
                    y +
                    '" r="9" class="rsi-funding-chart-dot-halo"/>' +
                    '<circle cx="' +
                    x +
                    '" cy="' +
                    y +
                    '" r="12" class="rsi-funding-chart-hit"/>' +
                    '<circle cx="' +
                    x +
                    '" cy="' +
                    y +
                    '" r="4.5" class="rsi-funding-chart-dot"/>' +
                    deltaLabel +
                    valueLabel +
                    '</g>' +
                    '<text x="' +
                    labelX +
                    '" y="' +
                    (height - metrics.axisOffset) +
                    '" font-size="' +
                    metrics.axisFont +
                    '" class="rsi-funding-chart-axis" text-anchor="' +
                    anchor +
                    '">' +
                    label +
                    '</text>'
                );
            })
            .join('');

        var latest = list[list.length - 1];
        var copy = periodCopy(period);
        var summaryDelta = '';
        if (latest && latest.diff != null) {
            var latestPct = latest.prevRaised ? (latest.diff / Math.abs(latest.prevRaised)) * 100 : null;
            var latestPctText = latestPct == null || !isFinite(latestPct) ? '' : ' · ' + (latestPct > 0 ? '+' : '') + latestPct.toFixed(1) + '%';
            var deltaClass = latest.diff > 0 ? ' is-up' : latest.diff < 0 ? ' is-down' : '';
            summaryDelta =
                '<span class="rsi-funding-chart-summary-delta' +
                deltaClass +
                '"><span class="rsi-funding-chart-summary-k">较' +
                copy.prev +
                '</span><b>' +
                formatUsdSigned(latest.diff) +
                '</b><b>' +
                (latestPctText ? latestPctText.replace(' · ', '') : '') +
                '</b></span>';
        }
        var summary =
            '<div class="rsi-funding-chart-summary">' +
            '<span class="rsi-funding-chart-summary-now"><span class="rsi-funding-chart-summary-k">' +
            copy.now +
            '</span><b>$' +
            formatInt(latest ? latest.raised : 0) +
            '</b></span>' +
            summaryDelta +
            '</div>';

        chartEl.innerHTML =
            summary +
            '<div class="rsi-funding-chart-tooltip" hidden aria-live="polite">' +
            '<span class="rsi-funding-chart-tooltip-value"></span>' +
            '<span class="rsi-funding-chart-tooltip-compare"></span>' +
            '</div>' +
            '<svg class="rsi-funding-chart-svg" viewBox="0 0 ' +
            width +
            ' ' +
            height +
            '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="众筹时间线">' +
            '<defs>' +
            '<linearGradient id="rsiFundingAreaGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#5fb8ff" stop-opacity="0.16"/>' +
            '<stop offset="55%" stop-color="#5fb8ff" stop-opacity="0.05"/>' +
            '<stop offset="100%" stop-color="#5fb8ff" stop-opacity="0"/>' +
            '</linearGradient>' +
            '</defs>' +
            gridLines +
            '<path d="' +
            areaPath +
            '" class="rsi-funding-chart-area" fill="url(#rsiFundingAreaGrad)"/>' +
            '<path d="' +
            linePath +
            '" class="rsi-funding-chart-line rsi-funding-chart-line--core"/>' +
            dots +
            '</svg>';
        bindChartInteraction();

        if (!chartEl._rsiLayoutRetry) {
            chartEl._rsiLayoutRetry = true;
            requestAnimationFrame(function () {
                chartEl._rsiLayoutRetry = false;
                var next = getChartMetrics();
                if (Math.abs(next.width - width) > 6) {
                    renderChart(points, period);
                }
            });
        }
    }

    function renderTabs() {
        if (!tabsEl) return;
        tabsEl.innerHTML = '';
        PERIODS.forEach(function (p) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rsi-funding-period-btn' + (p.id === currentPeriod ? ' is-active' : '');
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', p.id === currentPeriod ? 'true' : 'false');
            btn.textContent = p.label;
            btn.addEventListener('click', function () {
                currentPeriod = p.id;
                hideChartTip();
                renderTabs();
                if (lastData) renderChart(getPeriodPoints(lastData, currentPeriod), currentPeriod);
            });
            tabsEl.appendChild(btn);
        });
    }

    function getPeriodPoints(data, period) {
        if (!data || !data.periods || !data.periods[period]) return [];
        return data.periods[period].points || [];
    }

    function render(data) {
        lastData = data;
        if (fundsEl) fundsEl.textContent = formatUsd(data && data.fundsUsd);
        if (fansEl) fansEl.textContent = formatInt(data && data.fans);
        renderChart(getPeriodPoints(data, currentPeriod), currentPeriod);
        if (updatedEl && data && data.fetchedAt) {
            var when = formatFetchedAt(data.fetchedAt);
            var ageMs = Number(data.cacheAgeMs) || 0;
            var staleAfterMs = 24 * 60 * 60 * 1000;
            var showStale = ageMs > staleAfterMs;
            if (showStale) {
                when += ' · 待后端更新';
            }
            updatedEl.textContent = when ? '更新时间：' + when : '';
            updatedEl.hidden = !when;
            updatedEl.classList.toggle('is-stale', showStale);
        }
    }

    function renderLoading() {
        if (fundsEl) fundsEl.textContent = '…';
        if (fansEl) fansEl.textContent = '…';
        if (chartEl) {
            chartEl.innerHTML = '<p class="rsi-funding-chart-empty" role="status">正在加载资金统计…</p>';
        }
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
        if (chartEl) {
            chartEl.innerHTML =
                '<p class="rsi-funding-chart-empty rsi-funding-chart-empty--error" role="alert">' +
                String(msg || '暂时无法获取资金统计') +
                '</p>';
        }
    }

    async function fetchFromBackend() {
        var lastErr = null;
        var bases = apiBaseCandidates();
        for (var i = 0; i < bases.length; i++) {
            var base = bases[i];
            try {
                var url = base + '/api/rsi-funding-stats?_=' + Date.now();
                var r = await fetch(url, {
                    cache: 'no-store',
                    headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' },
                });
                var data = {};
                try {
                    data = await r.json();
                } catch (e) {
                    data = {};
                }
                if (!r.ok || !data.ok) {
                    var code = (data && data.code) || 'RSI_002';
                    throw typeof UssApiError !== 'undefined'
                        ? UssApiError.createApiError(r.status, data, code)
                        : new Error('暂时无法获取 RSI 资金统计，请稍后刷新。');
                }
                return data;
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr || new Error('Failed to fetch');
    }

    async function loadStats(options) {
        var opts = options || {};
        if (!opts.silent) renderLoading();

        try {
            var data = await fetchFromBackend();
            render(data);
        } catch (err) {
            renderError(formatFetchError(err));
        }
    }

    function scheduleRefresh() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () {
            loadStats({ silent: true });
        }, POLL_MS);
    }

    function init() {
        fundsEl = document.getElementById('rsiFundingFunds');
        fansEl = document.getElementById('rsiFundingFans');
        chartEl = document.getElementById('rsiFundingChart');
        tabsEl = document.getElementById('rsiFundingPeriodTabs');
        updatedEl = document.getElementById('rsiFundingUpdated');
        if (!fundsEl || !fansEl || !chartEl) return;
        renderTabs();
        loadStats();
        scheduleRefresh();
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (lastData) {
                    renderChart(getPeriodPoints(lastData, currentPeriod), currentPeriod);
                }
            }, 150);
        });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible') return;
            loadStats({ silent: true });
        });
    }

    function scheduleInit() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    scheduleInit();
})();
