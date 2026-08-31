/**
 * 全站数值展示：先按两位小数格式化；若小数位全是 0（.00）则去掉。
 * .01 / .50 等非零小数仍保留。列表 / 卡片 / 详情 / 蓝图共用。
 */
(function (global) {
    'use strict';

    function trimTrailingDotZeroZero(text) {
        return String(text == null ? '' : text).replace(/\.00(?!\d)/g, '');
    }

    function formatFixedDecimal2(v) {
        if (v == null || v === '' || !Number.isFinite(Number(v))) return null;
        var text = Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return trimTrailingDotZeroZero(text);
    }

    function formatDisplayNumber(v, suffix) {
        var hit = formatFixedDecimal2(v);
        if (hit == null) return '—';
        return suffix ? hit + suffix : hit;
    }

    function formatDisplayMass(v) {
        return formatDisplayNumber(v, ' kg');
    }

    function formatDisplayPrice(v) {
        return formatDisplayNumber(v, ' aUEC');
    }

    function formatDisplaySpeed(v) {
        return formatDisplayNumber(v, ' m/s');
    }

    /** raw volume（µSCU 等原始单位）→ SCU，两位小数 */
    function formatDisplayVolumeScuFromRaw(v) {
        if (v == null || !Number.isFinite(Number(v))) return '—';
        return formatDisplayNumber(Number(v) / 1000000, ' SCU');
    }

    /** 已是 SCU 单位 */
    function formatDisplayScu(v) {
        return formatDisplayNumber(v, ' SCU');
    }

    function formatDisplayPercentFromFraction(v, opts) {
        if (v == null || !Number.isFinite(Number(v))) return null;
        var n = Number(v);
        if (!opts || !opts.allowZero) {
            if (n === 0) return null;
        }
        return formatFixedDecimal2(n * 100) + '%';
    }

    function roundDisplay2(v) {
        var n = Number(v);
        if (!Number.isFinite(n)) return null;
        return Math.round(n * 100) / 100;
    }

    global.ScDisplayFormat = {
        formatFixedDecimal2: formatFixedDecimal2,
        formatDisplayNumber: formatDisplayNumber,
        formatDisplayMass: formatDisplayMass,
        formatDisplayPrice: formatDisplayPrice,
        formatDisplaySpeed: formatDisplaySpeed,
        formatDisplayVolumeScuFromRaw: formatDisplayVolumeScuFromRaw,
        formatDisplayScu: formatDisplayScu,
        formatDisplayPercentFromFraction: formatDisplayPercentFromFraction,
        roundDisplay2: roundDisplay2,
        trimTrailingDotZeroZero: trimTrailingDotZeroZero,
    };
})(typeof window !== 'undefined' ? window : global);
