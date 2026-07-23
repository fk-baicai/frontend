/**
 * 登录后同步 RSI 资料（全部由服务端 Headless Edge 抓取，浏览器不直连 RSI）：
 * ① POST /api/me/rsi-sync refreshFromWeb（Edge 无头）
 * ② 失败则 GET /api/rsi/citizen-profile 再同步
 * ③ 仍失败则保留原会话资料（不覆盖）
 */
(function (global) {
    'use strict';

    var RSI_LOGIN_REFRESH_MS = 24 * 60 * 60 * 1000;

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function clientScrapedLooksUsable(scraped) {
        if (!scraped || typeof scraped !== 'object') return false;
        if (scraped.citizenAvatarUrl) return true;
        if (Array.isArray(scraped.citizenAvatarUrls) && scraped.citizenAvatarUrls.length) return true;
        return !!(
            (scraped.rsiRankLabel && String(scraped.rsiRankLabel).trim()) ||
            (scraped.rsiOrgSid && String(scraped.rsiOrgSid).trim()) ||
            (scraped.rsiEnlisted && String(scraped.rsiEnlisted).trim())
        );
    }

    async function syncUserRsiViaApiProxy(token, handle) {
        if (!token || !handle || !global.UssRsiClient || !global.UssAuthApi) return null;
        try {
            const scraped = await global.UssRsiClient.scrapeCitizenPublicProfile(handle);
            if (!clientScrapedLooksUsable(scraped)) return null;
            return await global.UssAuthApi.syncRsiProfile(token, scraped);
        } catch (e) {
            console.warn('[rsi] API 代理同步失败', e && e.message ? e.message : e);
            return null;
        }
    }

    function profileLooksIncomplete(profile) {
        if (!profile || !profile.bindingId) return true;
        if (profile.rsiAssetsPending) return true;
        if (!profile.avatarUrl && profile.rsiCitizenAvatarSourceUrl) return true;
        var enlisted = profile.rsiEnlisted && String(profile.rsiEnlisted).trim();
        var location = profile.rsiLocation && String(profile.rsiLocation).trim();
        var rank = profile.rsiRankLabel && String(profile.rsiRankLabel).trim();
        var handle = profile.rsiProfileHandle && String(profile.rsiProfileHandle).trim();
        var orgSid = profile.rsiOrgSid && String(profile.rsiOrgSid).trim();
        var orgName = profile.rsiOrgName && String(profile.rsiOrgName).trim();
        var any = enlisted || location || rank || handle || orgSid || orgName;
        if (!any) return true;
        if (!enlisted && !location && !orgSid) return true;
        return false;
    }

    function shouldRefreshRsiOnLogin(profile) {
        if (!profile || !profile.bindingId) return false;
        if (profileLooksIncomplete(profile)) return true;
        var syncedAt = profile.rsiProfileSyncedAt && String(profile.rsiProfileSyncedAt).trim();
        if (!syncedAt) return true;
        var t = Date.parse(syncedAt);
        if (!Number.isFinite(t)) return true;
        return Date.now() - t >= RSI_LOGIN_REFRESH_MS;
    }

    async function refreshUserRsiOnAuth(token) {
        if (!token || !global.UssAuthApi) return null;
        try {
            return await global.UssAuthApi.refreshRsiProfile(token);
        } catch (eSync) {
            console.warn('[rsi] 服务端同步失败', eSync && eSync.message ? eSync.message : eSync);
            return null;
        }
    }

    async function refreshUserRsiOnLoginWithFallback(token, handle, options) {
        options = options || {};
        var maxAttempts = options.maxAttempts != null ? options.maxAttempts : 2;
        var baseDelayMs = options.baseDelayMs != null ? options.baseDelayMs : 1200;
        if (!token || !handle) return null;

        for (var attempt = 1; attempt <= maxAttempts; attempt += 1) {
            var viaServer = await refreshUserRsiOnAuth(token);
            if (viaServer && typeof viaServer === 'object') return viaServer;
            if (attempt < maxAttempts) {
                await sleep(Math.min(8000, baseDelayMs * attempt));
            }
        }

        for (var attempt2 = 1; attempt2 <= maxAttempts; attempt2 += 1) {
            var viaApi = await syncUserRsiViaApiProxy(token, handle);
            if (viaApi && typeof viaApi === 'object') return viaApi;
            if (attempt2 < maxAttempts) {
                await sleep(Math.min(8000, baseDelayMs * attempt2));
            }
        }

        console.warn('[rsi] 登录 RSI 更新均未成功，保留原资料');
        return null;
    }

    global.UssRsiSync = {
        profileLooksIncomplete: profileLooksIncomplete,
        shouldRefreshRsiOnLogin: shouldRefreshRsiOnLogin,
        refreshUserRsiOnLoginWithFallback: refreshUserRsiOnLoginWithFallback,
    };
})(typeof window !== 'undefined' ? window : globalThis);
