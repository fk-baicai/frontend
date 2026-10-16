
(function () {
    'use strict';

    if (typeof document === 'undefined') return;

    var gridEl = document.getElementById('homeExecHangarGrid');
    var errEl = document.getElementById('homeExecHangarError');
    var metaEl = document.getElementById('homeExecHangarUpdated');
    if (!gridEl) return;

    var CYCLE_MS = 185 * 60 * 1000;
    var anchorStartTime = null;
    var calibrationOffsetMs = 0;
    var tickTimer = null;
    var pollTimer = null;
    var POLL_MS = 30 * 1000;

    var PHASE_RANGE = {
        charging: '0 – 120 分钟',
        discharge: '120 – 180 分钟',
        cooldown: '180 – 185 分钟',
    };

    var PHASE_REMAIN_LABEL = {
        charging: '充电阶段还剩',
        discharge: '放电阶段还剩',
        cooldown: '冷却阶段还剩',
    };

    var INSERT_WINDOW = 12 * 60000;
    var DISCHARGE = 60 * 60000;

    function apiBase() {
        return (
            (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) ||
            'http://127.0.0.1:3789'
        ).replace(/\/$/, '');
    }

    function modMs(n, d) {
        var x = n % d;
        return x < 0 ? x + d : x;
    }

    function pad2(n) {
        return String(Math.floor(n)).padStart(2, '0');
    }

    function formatMs(ms) {
        var total = Math.max(0, Math.floor(ms / 1000));
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        if (h > 0) return pad2(h) + 'h ' + pad2(m) + 'm ' + pad2(s) + 's';
        if (m > 0) return pad2(m) + 'm ' + pad2(s) + 's';
        return pad2(s) + 's';
    }

    function partsFromMs(ms) {
        var total = Math.max(0, Math.floor(ms / 1000));
        return {
            h: Math.floor(total / 3600),
            m: Math.floor((total % 3600) / 60),
            s: total % 60,
        };
    }

    function formatClockParts(parts) {
        return pad2(parts.h) + 'h ' + pad2(parts.m) + 'm ' + pad2(parts.s) + 's';
    }

    function dischargeOffset(t) {
        return Math.max(0, t - 120 * 60000);
    }

    function computeLocal(elapsedMs) {
        var t = modMs(elapsedMs, CYCLE_MS);
        var CHARGE = 120 * 60000;
        var phase;
        var phaseEnd;
        var phaseLabel;

        if (t < CHARGE) {
            phase = 'charging';
            phaseLabel = '充电中';
            phaseEnd = CHARGE;
        } else if (t < CHARGE + DISCHARGE) {
            phase = 'discharge';
            phaseLabel = '放电中';
            phaseEnd = CHARGE + DISCHARGE;
        } else {
            phase = 'cooldown';
            phaseLabel = '冷却中';
            phaseEnd = CYCLE_MS;
        }

        var greenCount = 0;
        var leds = [];
        var ledDetails = [];
        var i;
        var dt = dischargeOffset(t);
        if (phase === 'charging') {
            greenCount = Math.min(5, Math.floor(t / (24 * 60000)));
            for (i = 0; i < 5; i++) {
                var isGreenCharge = i < greenCount;
                leds.push(isGreenCharge);
                ledDetails.push({ green: isGreenCharge, red: !isGreenCharge });
            }
        } else if (phase === 'discharge') {
            if (dt < INSERT_WINDOW) {
                greenCount = 5;
                for (i = 0; i < 5; i++) {
                    leds.push(true);
                    ledDetails.push({ green: true, red: false });
                }
            } else {
                var extinguished = Math.min(5, Math.floor((dt - INSERT_WINDOW) / (12 * 60000)) + 1);
                greenCount = Math.max(0, 5 - extinguished);
                for (i = 0; i < 5; i++) {
                    var isGreenDischarge = i < greenCount;
                    leds.push(isGreenDischarge);
                    ledDetails.push({ green: isGreenDischarge, red: false });
                }
            }
        } else {
            greenCount = 0;
            for (i = 0; i < 5; i++) {
                leds.push(false);
                ledDetails.push({ green: false, red: true });
            }
        }

        var canInsert = phase === 'discharge';
        var cycleRemainingMs = CYCLE_MS - t;
        var phaseRemainingMs = phaseEnd - t;
        var indicatorRemainingMs = phaseRemainingMs;

        if (phase === 'charging') {
            var slot = 24 * 60000;
            indicatorRemainingMs = Math.min(CHARGE, Math.ceil((t + 1) / slot) * slot) - t;
        } else if (phase === 'discharge') {
            if (dt < INSERT_WINDOW) {
                indicatorRemainingMs = INSERT_WINDOW - dt;
            } else {
                var base = INSERT_WINDOW;
                var slotD = 12 * 60000;
                var nextDt = Math.min(DISCHARGE, base + Math.ceil((dt - base + 1) / slotD) * slotD);
                indicatorRemainingMs = CHARGE + nextDt - t;
            }
        }

        var nextAccessMs = canInsert ? null : phase === 'charging' ? CHARGE - t : cycleRemainingMs + CHARGE;

        var nextAccessLabelText;
        var nextAccessText;
        if (canInsert) {
            nextAccessLabelText = '距插卡窗口关闭';
            nextAccessText = formatMs(phaseRemainingMs);
        } else {
            nextAccessLabelText = '距下次插卡窗口';
            nextAccessText = formatMs(nextAccessMs);
        }

        var showIndicatorCountdown = phase === 'charging' || phase === 'discharge';
        var indicatorText =
            pad2(Math.floor(indicatorRemainingMs / 60000)) +
            ':' +
            pad2(Math.floor((indicatorRemainingMs / 1000) % 60));

        var phaseRemainLabel = showIndicatorCountdown
            ? '距下次指示灯变化'
            : PHASE_REMAIN_LABEL[phase] || '当前阶段还剩';

        var phaseRemainingDisplayText = showIndicatorCountdown ? indicatorText : formatMs(phaseRemainingMs);

        var insertLabel = canInsert ? '可插卡' : phase === 'cooldown' ? '机库消杀' : '不可插卡';
        var insertTone = canInsert ? 'green' : phase === 'cooldown' ? 'orange' : 'red';

        var pipelineHint = '充电段逐盏点亮，放电段逐盏熄灭';
        if (phase === 'discharge' && dt < INSERT_WINDOW) pipelineHint = '五盏全绿 · 前 12 分钟';
        else if (phase === 'discharge') pipelineHint = '绿灯 ' + greenCount + ' / 5 · 逐盏熄灭中';
        else if (phase === 'charging') pipelineHint = '绿灯 ' + greenCount + ' / 5 · 每 24 分钟亮 1 盏';
        else pipelineHint = '冷却段指示灯全灭';

        var goldenWindow =
            phase === 'discharge' && dt < INSERT_WINDOW && greenCount === 5;

        return {
            phase: phase,
            phaseLabel: phaseLabel,
            phaseRange: PHASE_RANGE[phase] || '',
            phaseRemainingMs: phaseRemainingMs,
            phaseRemainingText: formatMs(phaseRemainingMs),
            phaseRemainLabel: phaseRemainLabel,
            phaseRemainingDisplayText: phaseRemainingDisplayText,
            elapsedText: formatMs(t),
            cycleRemainingMs: cycleRemainingMs,
            cycleRemainingParts: partsFromMs(cycleRemainingMs),
            cycleRemainingText: formatClockParts(partsFromMs(cycleRemainingMs)),
            cycleProgress: Math.round((t / CYCLE_MS) * 100),
            greenCount: greenCount,
            leds: leds,
            ledDetails: ledDetails,
            canInsert: canInsert,
            goldenWindow: goldenWindow,
            insertLabel: insertLabel,
            insertTone: insertTone,
            nextAccessMs: canInsert ? phaseRemainingMs : nextAccessMs,
            nextAccessLabelText: nextAccessLabelText,
            nextAccessText: nextAccessText,
            pipelineHint: pipelineHint,
        };
    }

    function localElapsedMs() {
        if (anchorStartTime == null) return 0;
        return modMs(Date.now() - anchorStartTime + calibrationOffsetMs, CYCLE_MS);
    }

    function insertHint(state) {
        if (state.canInsert) {
            if (state.goldenWindow) return '五盏全绿 · 前 12 分钟黄金窗口，建议优先插卡';
            return '放电段内随时可插卡 · 阶段结束后窗口关闭';
        }
        if (state.phase === 'cooldown') return '冷却 5 分钟后进入充电，期间不可插卡';
        return '充电段结束后进入放电，全程可插卡';
    }

    function ensureBoard() {
        if (gridEl.querySelector('.home-exec-console')) return;
        gridEl.innerHTML =
            '<article class="home-exec-console" data-phase="charging" data-can-insert="no">' +
            '<div class="home-exec-console-bar">' +
            '<span class="home-exec-kicker">PYRO · 185 MIN</span>' +
            '<span class="home-exec-phase" data-home-exec="phase"></span>' +
            '</div>' +
            '<div class="home-exec-leds" data-home-exec="leds" aria-hidden="true"></div>' +
            '<p class="home-exec-clock-label">本轮剩余</p>' +
            '<div class="home-exec-clock" data-home-exec="clock">' +
            '<b data-home-exec="h">00</b><span class="home-exec-colon">:</span>' +
            '<b data-home-exec="m">00</b><span class="home-exec-colon">:</span>' +
            '<b data-home-exec="s">00</b>' +
            '</div>' +
            '<div class="home-exec-stats">' +
            '<div class="home-exec-stat"><span data-home-exec="phaseLabel">当前阶段</span><strong data-home-exec="phaseRemain"></strong><em data-home-exec="nextLight"></em></div>' +
            '<div class="home-exec-stat"><span data-home-exec="insertTitle">插卡窗口</span><strong data-home-exec="insertValue"></strong><em data-home-exec="insertNote"></em></div>' +
            '<div class="home-exec-stat"><span>本轮进度</span><strong data-home-exec="progress"></strong><em data-home-exec="elapsed"></em></div>' +
            '</div>' +
            '</article>';
        var board = gridEl.querySelector('.home-exec-console');
        var head = document.querySelector('.home-exec-hangar-head');
        if (board && head && head.parentNode !== board) {
            board.insertBefore(head, board.firstChild);
        }
        if (!board || !head) return;
        var text = head.querySelector('.home-exec-hangar-head-text');
        var notify = document.getElementById('homeExecHangarNotifyMount');
        var phase = board.querySelector('.home-exec-phase');
        var kicker = board.querySelector('.home-exec-kicker');
        var bar = board.querySelector('.home-exec-console-bar');
        var aside = board.querySelector('.home-exec-hangar-aside');
        if (!aside) {
            aside = document.createElement('div');
            aside.className = 'home-exec-hangar-aside';
            board.appendChild(aside);
        }
        if (notify) aside.appendChild(notify);
        if (phase) aside.appendChild(phase);
        var stage = board.querySelector('.home-exec-stage');
        if (!stage) {
            stage = document.createElement('div');
            stage.className = 'home-exec-stage';
            ['home-exec-leds', 'home-exec-clock-label', 'home-exec-clock'].forEach(function (cls) {
                var node = board.querySelector('.' + cls);
                if (node) stage.appendChild(node);
            });
            board.appendChild(stage);
        }
        if (kicker && text) text.appendChild(kicker);
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    }

    function setText(name, value) {
        var el = gridEl.querySelector('[data-home-exec="' + name + '"]');
        if (el) el.textContent = value == null ? '' : String(value);
    }

    function render(state) {
        if (!state || !gridEl) return;
        var parts = state.cycleRemainingParts || { h: 0, m: 0, s: 0 };
        var chargingNote =
            state.phase === 'charging'
                ? '当前充电段进行中'
                : state.cycleRemainingText + ' 后开始（含冷却）';
        ensureBoard();
        var board = gridEl.querySelector('.home-exec-console');
        board.setAttribute('data-phase', state.phase || 'charging');
        board.setAttribute('data-can-insert', state.canInsert ? 'yes' : 'no');
        if (state.goldenWindow) board.setAttribute('data-golden', 'yes');
        else board.removeAttribute('data-golden');
        setText('phase', state.phaseLabel);
        setText('h', pad2(parts.h));
        setText('m', pad2(parts.m));
        setText('s', pad2(parts.s));
        var clock = gridEl.querySelector('[data-home-exec="clock"]');
        if (clock) clock.setAttribute('aria-label', '本轮剩余 ' + state.cycleRemainingText);
        setText('phaseLabel', state.phaseRemainLabel || '当前阶段');
        setText('phaseRemain', state.phaseRemainingDisplayText);
        setText('nextLight', state.phaseRange + ' · ' + state.greenCount + '/5 · ' + state.pipelineHint);
        setText('insertTitle', state.canInsert ? '当前可插卡' : state.nextAccessLabelText || '距下次插卡');
        setText('insertValue', state.nextAccessText);
        setText('insertNote', insertHint(state));
        setText('progress', state.cycleProgress + '%');
        setText('elapsed', '已进行 ' + state.elapsedText + ' · 下轮充电 ' + chargingNote);
        var leds = gridEl.querySelector('[data-home-exec="leds"]');
        if (leds) {
            var details = state.ledDetails || [];
            var html = '';
            var i;
            for (i = 0; i < details.length; i++) {
                var cls = 'home-exec-led';
                if (details[i] && details[i].green) cls += ' is-on';
                else if (details[i] && details[i].red) cls += ' is-red';
                html += '<span class="' + cls + '"></span>';
            }
            if (leds.getAttribute('data-sig') !== html) {
                leds.innerHTML = html;
                leds.setAttribute('data-sig', html);
            }
        }
    }

    function renderLoading() {
        gridEl.innerHTML = '<div class="rsi-status-loading" role="status">正在同步行政机库…</div>';
    }

    function showError(msg) {
        if (errEl) {
            errEl.textContent = msg;
            errEl.classList.remove('is-hidden');
        }
        gridEl.innerHTML =
            '<div class="rsi-status-error" role="alert">' + String(msg || '暂时无法获取状态') + '</div>';
    }

    function hideError() {
        if (errEl) errEl.classList.add('is-hidden');
    }

    function formatSyncedAt(iso) {
        if (!iso) return '';
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

    function buildSyncMetaText(data) {
        if (!data || !data.ok) return '';
        var calibratedAt = data.webCalibratedAt || data.ingestedAt || '';
        var when = formatSyncedAt(calibratedAt);
        if (!when) return '';
        var parts = [when];
        if (data.webElapsedTextAtCalibrate) {
            parts.push('校准时 ' + data.webElapsedTextAtCalibrate);
        } else if (data.elapsedText) {
            parts.push('当前 ' + data.elapsedText);
        }
        return parts.join(' · ');
    }

    function reanchorFromServer(data) {
        if (data.cycleDurationMs) CYCLE_MS = data.cycleDurationMs;
        calibrationOffsetMs = 0;
        if (data.elapsedMs != null && Number.isFinite(Number(data.elapsedMs))) {
            var serverNow =
                data.serverNow != null && Number.isFinite(Number(data.serverNow))
                    ? Number(data.serverNow)
                    : Date.now();
            anchorStartTime = serverNow - modMs(Number(data.elapsedMs), CYCLE_MS);
            return;
        }
        if (data.anchorStartTime != null) {
            var skew =
                data.serverNow != null && Number.isFinite(Number(data.serverNow))
                    ? Date.now() - Number(data.serverNow)
                    : 0;
            anchorStartTime = Number(data.anchorStartTime) + skew;
            calibrationOffsetMs = Number(data.calibrationOffsetMs) || 0;
        }
    }

    function formatErr(data, err, fallback) {
        var code = (data && data.code) || (err && err.code) || fallback || 'SRV_001';
        if (typeof UssApiError !== 'undefined') return UssApiError.formatUserError(code);
        return '暂时无法获取行政机库状态，请稍后刷新。';
    }

    function tick() {
        if (anchorStartTime == null) return;
        var state = computeLocal(localElapsedMs());
        render(state);
        if (window.UssExecHangarNotify && typeof window.UssExecHangarNotify.applyCanInsert === 'function') {
            window.UssExecHangarNotify.applyCanInsert(!!state.canInsert);
        }
    }

    function applyExecHangarPayload(data) {
        if (!data || !data.ok) {
            showError(formatErr(data, null, 'SRV_001'));
            return;
        }
        hideError();
        if (metaEl) {
            var metaText = buildSyncMetaText(data);
            metaEl.textContent = metaText;
            metaEl.hidden = !metaText;
        }
        reanchorFromServer(data);
        render(computeLocal(data.elapsedMs != null ? Number(data.elapsedMs) : localElapsedMs()));
    }

    function fetchState(fresh) {
        var url =
            apiBase() +
            '/api/exec-hangar/state?fresh=' +
            (fresh ? '1' : '0') +
            '&_=' +
            Date.now();
        return fetch(url, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        })
            .then(function (r) {
                return r.json().then(function (j) {
                    if (!r.ok) {
                        var err = new Error(formatErr(j, null, 'SRV_001'));
                        err.code = (j && j.code) || 'SRV_001';
                        throw err;
                    }
                    return j;
                });
            })
            .then(function (data) {
                applyExecHangarPayload(data);
            })
            .catch(function (e) {
                showError(formatErr(null, e, 'NET_E001'));
            });
    }

    function startTimers() {
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(tick, 1000);
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(function () {
            if (window.UssHomeStatusLoader) {
                window.UssHomeStatusLoader.refresh();
            } else {
                fetchState(false);
            }
        }, POLL_MS);
    }

    function startWithLoader() {
        var cached = window.UssHomeStatusLoader.getCached();
        if (cached && cached.execHangar && cached.execHangar.ok) {
            applyExecHangarPayload(cached.execHangar);
        } else {
            renderLoading();
        }
        window.UssHomeStatusLoader.subscribe(function (payload) {
            if (payload && payload.execHangar) applyExecHangarPayload(payload.execHangar);
        });
        startTimers();
    }

    function startLegacy() {
        renderLoading();
        fetchState(false);
        startTimers();
    }

    function start() {
        if (window.UssHomeStatusLoader) {
            startWithLoader();
            return;
        }
        startLegacy();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
