
(function (global) {
    'use strict';

    var AUTH_SESSION_KEY = 'ussHangzhouAuthSession';
    var authSessionEpoch = 0;

    function getAuthSessionEpoch() {
        return authSessionEpoch;
    }


    function isAuthSessionOpValid(epoch, token) {
        if (epoch !== authSessionEpoch) return false;
        var t = token != null ? String(token) : '';
        if (!t) return false;
        var sess = null;
        try {
            var raw = sessionStorage.getItem(AUTH_SESSION_KEY);
            if (!raw) raw = localStorage.getItem(AUTH_SESSION_KEY);
            if (!raw) return false;
            sess = JSON.parse(raw);
        } catch (e) {
            return false;
        }
        if (!sess || !sess.token) return false;
        if (isAuthSessionExpired(sess)) return false;
        return String(sess.token) === t;
    }

    function clearAuthSession() {
        authSessionEpoch += 1;
        try {
            localStorage.removeItem(AUTH_SESSION_KEY);
        } catch (e) {
            /* ignore */
        }
        try {
            sessionStorage.removeItem(AUTH_SESSION_KEY);
        } catch (e) {
            /* ignore */
        }
        syncHtmlMemberGateClasses(null);
    }

    function isAuthSessionExpired(sess) {
        if (!sess || !sess.token) return true;
        if (global.UssAuthApi && typeof global.UssAuthApi.isTokenExpired === 'function') {
            return global.UssAuthApi.isTokenExpired(sess.token);
        }
        if (sess.expiresAt != null && Number.isFinite(Number(sess.expiresAt))) {
            return Date.now() >= Number(sess.expiresAt);
        }
        return false;
    }

    function loadAuthSession() {
        var sess = null;
        try {
            var raw = sessionStorage.getItem(AUTH_SESSION_KEY);
            if (!raw) raw = localStorage.getItem(AUTH_SESSION_KEY);
            if (!raw) return null;
            sess = JSON.parse(raw);
        } catch (e) {
            return null;
        }
        if (isAuthSessionExpired(sess)) {
            clearAuthSession();
            return null;
        }
        return sess;
    }

    function sessionHasFleetUiAccess(sess) {
        if (!sess || !sess.token) return false;
        if (sess.isSuperAdmin || sess.isAdmin) return true;
        if (sess.hasFleetPrivilege === true || sess.hasFleetPrivilege === 1) return true;
        if (sess.hasFleetPrivilege === false || sess.hasFleetPrivilege === 0) return false;
        if (String(sess.memberKind || '').toLowerCase() === 'civilian') return false;
        return true;
    }

    function syncHtmlMemberGateClasses(sess) {
        if (typeof document === 'undefined' || !document.documentElement) return;
        var root = document.documentElement;
        if (!sess || !sess.token) {
            root.classList.remove('auth-session-cached', 'auth-fleet-member');
            return;
        }
        root.classList.add('auth-session-cached');
        if (sessionHasFleetUiAccess(sess)) root.classList.add('auth-fleet-member');
        else root.classList.remove('auth-fleet-member');
    }

    function saveAuthSession(payload, remember) {
        if (!payload) return;
        var json = JSON.stringify(payload);
        try {
            if (remember) {
                localStorage.setItem(AUTH_SESSION_KEY, json);
                sessionStorage.removeItem(AUTH_SESSION_KEY);
            } else {
                sessionStorage.setItem(AUTH_SESSION_KEY, json);
                localStorage.removeItem(AUTH_SESSION_KEY);
            }
        } catch (e) {
            /* ignore */
        }
        syncHtmlMemberGateClasses(payload);
    }

    function sessionUsesRemember() {
        try {
            return !!localStorage.getItem(AUTH_SESSION_KEY) && !sessionStorage.getItem(AUTH_SESSION_KEY);
        } catch (e) {
            return false;
        }
    }

    function isEmptyProfileValue(val) {
        if (val === undefined || val === null) return true;
        if (typeof val === 'string' && val.trim() === '') return true;
        return false;
    }


    function mergeProfileField(next, prev) {
        if (isEmptyProfileValue(next)) {
            return prev !== undefined ? prev : next;
        }
        return next;
    }

    var PROFILE_CACHE_KEY = 'ussHangzhouProfileCache';

    function resolveProfileCacheKey(bindingId, rsiProfileHandle) {
        var bid = String(bindingId || '')
            .trim()
            .toLowerCase();
        if (bid) return bid;
        return String(rsiProfileHandle || '')
            .trim()
            .toLowerCase();
    }

    function loadProfileCache(bindingId, rsiProfileHandle) {
        var bid = resolveProfileCacheKey(bindingId, rsiProfileHandle);
        if (!bid) return null;
        try {
            var raw = localStorage.getItem(PROFILE_CACHE_KEY);
            if (!raw) return null;
            var all = JSON.parse(raw);
            if (!all || typeof all !== 'object') return null;
            return all[bid] || null;
        } catch (e) {
            return null;
        }
    }

    function saveProfileCache(bindingId, profile, rsiProfileHandle) {
        var bid = resolveProfileCacheKey(
            bindingId || (profile && profile.bindingId),
            rsiProfileHandle || (profile && profile.rsiProfileHandle)
        );
        if (!bid || !profile || typeof profile !== 'object') return;
        try {
            var raw = localStorage.getItem(PROFILE_CACHE_KEY);
            var all = raw ? JSON.parse(raw) : {};
            if (!all || typeof all !== 'object') all = {};
            all[bid] = profile;
            localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(all));
        } catch (e) {
            /* quota / private mode */
        }
    }

    function snapshotProfileFields(sess) {
        sess = sess || {};
        return {
            avatarUrl: sess.avatarUrl,
            rsiCitizenAvatarSourceUrl: sess.rsiCitizenAvatarSourceUrl,
            rsiProfileHandle: sess.rsiProfileHandle,
            rsiRankIconUrl: sess.rsiRankIconUrl,
            rsiRankLabel: sess.rsiRankLabel,
            rsiEnlisted: sess.rsiEnlisted,
            rsiLocation: sess.rsiLocation,
            rsiFluency: sess.rsiFluency,
            rsiOrgName: sess.rsiOrgName,
            rsiOrgSid: sess.rsiOrgSid,
            rsiOrgHref: sess.rsiOrgHref,
            rsiOrgPageUrl: sess.rsiOrgPageUrl,
            rsiOrgLogoUrl: sess.rsiOrgLogoUrl,
            rsiOrgRoleLabel: sess.rsiOrgRoleLabel,
            rsiOrgRankSlots: sess.rsiOrgRankSlots,
            rsiOrgRankTotal: sess.rsiOrgRankTotal,
            rsiProfileSyncedAt: sess.rsiProfileSyncedAt,
            rsiAssetsPending: sess.rsiAssetsPending,
        };
    }

    function profileCacheHasContent(profile) {
        if (!profile) return false;
        return !!(
            (profile.rsiEnlisted && String(profile.rsiEnlisted).trim()) ||
            (profile.rsiLocation && String(profile.rsiLocation).trim()) ||
            (profile.rsiRankLabel && String(profile.rsiRankLabel).trim()) ||
            (profile.rsiProfileHandle && String(profile.rsiProfileHandle).trim()) ||
            (profile.rsiOrgSid && String(profile.rsiOrgSid).trim()) ||
            (profile.rsiOrgName && String(profile.rsiOrgName).trim())
        );
    }

    function mergeUserIntoSession(token, user, prev) {
        prev = prev || {};
        user = user || {};
        var cached = loadProfileCache(
            user.bindingId || prev.bindingId,
            user.rsiProfileHandle || prev.rsiProfileHandle
        );
        if (cached) {
            prev = Object.assign({}, cached, prev);
        }
        var tokenExpiresAt =
            global.UssAuthApi && typeof global.UssAuthApi.getTokenExpiresAt === 'function'
                ? global.UssAuthApi.getTokenExpiresAt(token)
                : null;
        var nextBindingId =
            user.bindingId != null && String(user.bindingId).trim() !== ''
                ? String(user.bindingId).trim()
                : user.bindingId === null || user.bindingId === ''
                  ? ''
                  : prev.bindingId;
        var merged = {
            token: token,
            bindingId: nextBindingId,
            email: user.email != null ? user.email : prev.email,
            emailVerified: user.emailVerified !== undefined ? !!user.emailVerified : !!prev.emailVerified,
            loginAt: prev.loginAt || new Date().toISOString(),
            sessionDays: prev.sessionDays !== undefined ? prev.sessionDays : undefined,
            expiresAt:
                prev.expiresAt != null
                    ? prev.expiresAt
                    : tokenExpiresAt != null
                      ? tokenExpiresAt
                      : undefined,
            avatarUrl: mergeProfileField(user.avatarUrl, prev.avatarUrl),
            rsiCitizenAvatarSourceUrl: mergeProfileField(
                user.rsiCitizenAvatarSourceUrl,
                prev.rsiCitizenAvatarSourceUrl
            ),
            rsiProfileHandle: mergeProfileField(user.rsiProfileHandle, prev.rsiProfileHandle),
            rsiRankIconUrl: mergeProfileField(user.rsiRankIconUrl, prev.rsiRankIconUrl),
            rsiRankLabel: mergeProfileField(user.rsiRankLabel, prev.rsiRankLabel),
            rsiEnlisted: mergeProfileField(user.rsiEnlisted, prev.rsiEnlisted),
            rsiLocation: mergeProfileField(user.rsiLocation, prev.rsiLocation),
            rsiFluency: mergeProfileField(user.rsiFluency, prev.rsiFluency),
            rsiOrgName: mergeProfileField(user.rsiOrgName, prev.rsiOrgName),
            rsiOrgSid: mergeProfileField(user.rsiOrgSid, prev.rsiOrgSid),
            rsiOrgHref: mergeProfileField(user.rsiOrgHref, prev.rsiOrgHref),
            rsiOrgPageUrl: mergeProfileField(user.rsiOrgPageUrl, prev.rsiOrgPageUrl),
            rsiOrgLogoUrl: mergeProfileField(user.rsiOrgLogoUrl, prev.rsiOrgLogoUrl),
            rsiOrgRoleLabel: mergeProfileField(user.rsiOrgRoleLabel, prev.rsiOrgRoleLabel),
            rsiOrgRankSlots:
                user.rsiOrgRankSlots !== undefined && user.rsiOrgRankSlots !== null
                    ? user.rsiOrgRankSlots
                    : prev.rsiOrgRankSlots,
            rsiOrgRankTotal:
                user.rsiOrgRankTotal !== undefined && user.rsiOrgRankTotal !== null
                    ? user.rsiOrgRankTotal
                    : prev.rsiOrgRankTotal,
            rsiProfileSyncedAt: mergeProfileField(user.rsiProfileSyncedAt, prev.rsiProfileSyncedAt),
            rsiBindLocked:
                user.rsiBindLocked !== undefined ? !!user.rsiBindLocked : !!prev.rsiBindLocked,
            rsiAssetsPending:
                user.rsiAssetsPending !== undefined
                    ? !!user.rsiAssetsPending
                    : prev.rsiAssetsPending,
            isAdmin: user.isAdmin !== undefined ? !!user.isAdmin : !!prev.isAdmin,
            isSuperAdmin: !!user.isSuperAdmin,
            memberKind:
                user.memberKind !== undefined && user.memberKind !== null
                    ? user.memberKind
                    : prev.memberKind,
            hasFleetPrivilege:
                user.hasFleetPrivilege !== undefined
                    ? !!user.hasFleetPrivilege
                    : prev.hasFleetPrivilege,
            marketCompletedTradeCount:
                user.marketCompletedTradeCount !== undefined && user.marketCompletedTradeCount !== null
                    ? user.marketCompletedTradeCount
                    : prev.marketCompletedTradeCount,
            marketAverageRating:
                user.marketAverageRating !== undefined && user.marketAverageRating !== null
                    ? user.marketAverageRating
                    : prev.marketAverageRating,
            marketReviewCount:
                user.marketReviewCount !== undefined && user.marketReviewCount !== null
                    ? user.marketReviewCount
                    : prev.marketReviewCount,
            oopzId: user.oopzId !== undefined ? user.oopzId : prev.oopzId,
            oopzUid: user.oopzUid !== undefined ? user.oopzUid : prev.oopzUid,
            oopzName: user.oopzName !== undefined ? user.oopzName : prev.oopzName,
            oopzBoundAt: user.oopzBoundAt !== undefined ? user.oopzBoundAt : prev.oopzBoundAt,
            canChangeOopz: user.canChangeOopz !== undefined ? user.canChangeOopz : prev.canChangeOopz,
            oopzChangeCooldownSec:
                user.oopzChangeCooldownSec !== undefined ? user.oopzChangeCooldownSec : prev.oopzChangeCooldownSec,
            oopzCanChangeAt: user.oopzCanChangeAt !== undefined ? user.oopzCanChangeAt : prev.oopzCanChangeAt,
        };
        if (profileCacheHasContent(snapshotProfileFields(merged))) {
            saveProfileCache(merged.bindingId, snapshotProfileFields(merged), merged.rsiProfileHandle);
        }
        return merged;
    }

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }


    async function refreshAuthSessionFromServer(options) {
        options = options || {};
        if (!global.UssAuthApi) return null;
        var epoch = authSessionEpoch;
        var sess = loadAuthSession();
        if (!sess || !sess.token) return null;
        var tokenAtStart = sess.token;

        var me;
        try {
            me = await global.UssAuthApi.me(tokenAtStart);
        } catch (eMe) {
            if (global.UssAuthApi && global.UssAuthApi.isAuthSessionError(eMe)) {
                clearAuthSession();
                if (typeof options.onSessionExpired === 'function') {
                    try {
                        options.onSessionExpired(eMe);
                    } catch (eCb) {
                        /* ignore */
                    }
                }
            }
            return null;
        }

        var remember = sessionUsesRemember();
        if (!isAuthSessionOpValid(epoch, tokenAtStart)) return null;
        var merged = mergeUserIntoSession(tokenAtStart, me, sess);
        saveAuthSession(merged, remember);
        if (typeof options.onUpdated === 'function') {
            try {
                options.onUpdated(merged);
            } catch (eCb) {
                /* ignore */
            }
        }
        return merged;
    }


    async function refreshAuthSessionFromServerWithRetry(options) {
        options = options || {};
        var maxAttempts = options.maxAttempts != null ? options.maxAttempts : 3;
        var baseDelayMs = options.baseDelayMs != null ? options.baseDelayMs : 800;
        for (var attempt = 1; attempt <= maxAttempts; attempt += 1) {
            if (!loadAuthSession()) return null;
            var merged = await refreshAuthSessionFromServer(options);
            if (merged) return merged;
            if (!loadAuthSession()) return null;
            if (attempt < maxAttempts) {
                await sleep(Math.min(8000, baseDelayMs * Math.pow(2, attempt - 1)));
            }
        }
        return null;
    }

    global.UssAuthSessionSync = {
        AUTH_SESSION_KEY: AUTH_SESSION_KEY,
        PROFILE_CACHE_KEY: PROFILE_CACHE_KEY,
        clearAuthSession: clearAuthSession,
        getAuthSessionEpoch: getAuthSessionEpoch,
        isAuthSessionOpValid: isAuthSessionOpValid,
        isAuthSessionExpired: isAuthSessionExpired,
        loadAuthSession: loadAuthSession,
        saveAuthSession: saveAuthSession,
        sessionHasFleetUiAccess: sessionHasFleetUiAccess,
        syncHtmlMemberGateClasses: syncHtmlMemberGateClasses,
        mergeUserIntoSession: mergeUserIntoSession,
        mergeProfileField: mergeProfileField,
        snapshotProfileFields: snapshotProfileFields,
        loadProfileCache: loadProfileCache,
        saveProfileCache: saveProfileCache,
        refreshAuthSessionFromServer: refreshAuthSessionFromServer,
        refreshAuthSessionFromServerWithRetry: refreshAuthSessionFromServerWithRetry,
    };
})(typeof window !== 'undefined' ? window : globalThis);
