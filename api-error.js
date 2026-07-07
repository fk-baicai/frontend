/**
 * 前端 API 错误：用户看到中文说明，不展示技术错误码。
 */
(function (global) {
    'use strict';

    var DEFAULT_CODE = 'NET_E001';
    var DEFAULT_MSG = '网络异常，请检查网络后重试。';

    /** 错误码 → 用户可读中文（与 backend/lib/apiErrors.js _DOC 对应） */
    var USER_HINTS = {
        SRV_001: '服务器繁忙，请稍后重试。',
        RATE_001: '操作过于频繁，请稍后再试。',
        RATE_002: '发帖太频繁，请稍后再试。',
        RATE_003: '回复太频繁，请稍后再试。',
        RATE_004: '发送太频繁，请稍候。',
        AUTH_S001: '登录已失效，请重新登录。',
        AUTH_S002: '登录已过期，请重新登录。',
        AUTH_S003: '请先登录。',
        AUTH_S004: '用户不存在。',
        AUTH_L001: '邮箱或密码不正确。',
        AUTH_L002: '请填写邮箱和密码。',
        AUTH_R001: '请填写绑定 ID、邮箱和密码。',
        AUTH_R002: '密码至少需要 6 位。',
        AUTH_R003: '请填写有效的邮箱地址。',
        AUTH_R004: '该邮箱已被注册，请直接登录或使用其他邮箱。',
        AUTH_R005: '该绑定 ID 已被使用，请更换或联系管理员。',
        AUTH_R006: '注册未通过校验，请确认绑定 ID 正确且已加入指定组织。',
        AUTH_R007: '无法获取 RSI 头像，请稍后重试。',
        AUTH_R008: '绑定 ID 格式无效，请填写正确的 RSI Handle。',
        AUTH_R009: '该 Handle 不在注册白名单中。',
        AUTH_P001: '请填写有效的注册邮箱。',
        AUTH_P002: '请输入 6 位数字验证码。',
        AUTH_P003: '新密码至少需要 6 位。',
        AUTH_P004: '两次输入的新密码不一致。',
        AUTH_P005: '验证码不正确或已过期，请重新获取。',
        AUTH_P006: '验证失败，请重试。',
        AUTH_P007: '邮件服务未配置，请联系管理员。',
        AUTH_P008: '验证码发送失败，请稍后重试。',
        AUTH_P009: '发送过于频繁，请稍后再试。',
        AUTH_C001: '请填写当前密码与新密码。',
        AUTH_C002: '两次输入的新密码不一致。',
        AUTH_C003: '新密码至少需要 6 位。',
        AUTH_C004: '新密码不能与当前密码相同。',
        AUTH_C005: '当前密码不正确。',
        AUTH_H001: '尚未绑定 Handle。',
        AUTH_H002: 'RSI 资料同步失败，请稍后重试。',
        OOPZ_001: 'OOPZ ID 格式无效（5–12 位数字）。',
        OOPZ_002: 'OOPZ ID 已绑定，无法自行更换，请联系管理员。',
        OOPZ_003: '未在 OOPZ 语音频道找到该 ID，请先进语音频道并保持机器人在线。',
        OOPZ_004: '该 OOPZ ID 已被其他账号绑定。',
        OOPZ_005: '请先绑定 OOPZ ID 后再设置播报。',
        ADM_001: '需要管理员权限。',
        ADM_002: '需要超级管理员权限。',
        CHK_001: '签到分部无效，请刷新页面后重试。',
        CHK_002: '拼图未对齐缺口，请重新拖动滑块到正确位置后再签到。',
        CHK_003: '今日已在本分部签过到。',
        CHK_004: '积分调整参数无效。',
        CHK_005: '补签参数无效，请检查日期与分部。',
        CHK_006: '不能为未来日期补签。',
        CHK_007: '该日期已在本分部签过到。',
        CHK_008: '请提供有效的分部与日期。',
        CHK_009: '请选择有效的签到分部。',
        CHK_010: '验证请求过于频繁，请稍后再试。',
        CHK_011: '验证码已失效，请点击「换一张」重新验证。',
        CHK_012: '签到验证图未配置，请联系管理员。',
        CHK_013: '当前不在签到开放时间内，请稍后再来。',
        CHK_014: '未满足 OOPZ 在线要求，请先进入语音频道并满足时长后再签到。',
        RSI_001: '暂时无法获取 RSI 服务器状态，请稍后刷新。',
        RSI_002: '暂时无法获取 RSI 资金统计，请稍后刷新。',
        RSI_E001: 'RSI 资料校验失败，请稍后重试。',
        RSI_CF001: '暂时无法访问 RSI 公民页，请稍后重试。',
        RSI_EDGE_MISSING: '服务器环境暂不支持 RSI 抓取，请联系管理员。',
        EXEC_001: '行政机库数据尚未同步，请稍后刷新。',
        IP_001: '服务器 IP 尚未上报。',
        BRG_004: '上报密钥无效。',
        VAL_001: '提交的信息有误，请检查后重试。',
        RES_404: '请求的内容不存在。',
        NET_E001: DEFAULT_MSG,
        NET_E502: '请求超时，请稍后重试。',
        NET_E503: '服务暂时不可用，请稍后重试。',
        NET_E504: '请求超时，请稍后重试。',
        REG_P001: '注册仍在处理中，请稍后在登录页尝试。',
        REG_P002: '注册任务已过期，请重新提交注册。',
    };

    function pickCode(data, httpStatus, fallbackCode) {
        if (data && typeof data.code === 'string' && data.code.trim()) {
            return data.code.trim();
        }
        if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
            return 'NET_E' + String(httpStatus);
        }
        if (fallbackCode) return String(fallbackCode);
        if (httpStatus === 401) return 'AUTH_S001';
        if (httpStatus === 403) return 'ADM_001';
        if (httpStatus === 404) return 'RES_404';
        if (httpStatus === 429) return 'RATE_001';
        if (httpStatus >= 500) return 'SRV_001';
        if (httpStatus >= 400) return 'VAL_001';
        return DEFAULT_CODE;
    }

    function userHintForCode(code) {
        var c = String(code || '').trim();
        return USER_HINTS[c] || '';
    }

    /** 用户可见文案（中文说明） */
    function formatUserError(code) {
        var c = String(code || DEFAULT_CODE).trim() || DEFAULT_CODE;
        return userHintForCode(c) || DEFAULT_MSG;
    }

    var REGISTER_HINTS = USER_HINTS;
    var LOGIN_HINTS = USER_HINTS;
    var FORGOT_PW_HINTS = USER_HINTS;

    function forgotPasswordHintForCode(code) {
        return userHintForCode(code);
    }

    function registerHintForCode(code) {
        return userHintForCode(code);
    }

    function loginHintForCode(code) {
        return userHintForCode(code);
    }

    function createApiError(httpStatus, data, fallbackCode) {
        var code = pickCode(data, httpStatus, fallbackCode);
        var err = new Error(formatUserError(code));
        err.code = code;
        err.httpStatus = httpStatus;
        if (data && typeof data === 'object') {
            if (data.cooldownSec != null) err.cooldownSec = data.cooldownSec;
            if (data.canChangeAt != null) err.canChangeAt = data.canChangeAt;
            if (data.action != null) err.action = data.action;
        }
        return err;
    }

    function looksLikeErrorCode(s) {
        return /^[A-Z][A-Z0-9_]{2,}$/.test(s) || /^错误代码：/.test(s);
    }

    /** 从 Error / 字符串中提取用户可读中文 */
    function sanitizeUserMessage(input) {
        if (input == null) return formatUserError(DEFAULT_CODE);
        if (typeof input === 'object' && input.code) {
            return formatUserError(input.code);
        }
        if (typeof input === 'object' && input.message) {
            return sanitizeUserMessage(input.message);
        }
        var s = String(input).trim();
        if (!s) return formatUserError(DEFAULT_CODE);
        var m = s.match(/^错误代码：([A-Z0-9_]+)$/);
        if (m) return formatUserError(m[1]);
        if (/^[A-Z][A-Z0-9_]{2,}$/.test(s)) return formatUserError(s);
        if (looksLikeErrorCode(s)) return formatUserError(s);
        return s;
    }

    function makeError(code, extra) {
        var c = String(code || DEFAULT_CODE).trim() || DEFAULT_CODE;
        var err = new Error(formatUserError(c));
        err.code = c;
        if (extra && typeof extra === 'object') {
            Object.keys(extra).forEach(function (k) {
                err[k] = extra[k];
            });
        }
        return err;
    }

    var api = {
        DEFAULT_CODE: DEFAULT_CODE,
        USER_HINTS: USER_HINTS,
        pickCode: pickCode,
        userHintForCode: userHintForCode,
        formatUserError: formatUserError,
        makeError: makeError,
        registerHintForCode: registerHintForCode,
        loginHintForCode: loginHintForCode,
        forgotPasswordHintForCode: forgotPasswordHintForCode,
        createApiError: createApiError,
        sanitizeUserMessage: sanitizeUserMessage,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    global.UssApiError = api;
})(typeof window !== 'undefined' ? window : global);
