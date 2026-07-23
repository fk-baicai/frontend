/**
 * 首页应用逻辑（自 index.html 拆出，defer 加载以缩短 HTML 解析时间）
 */
        const DEFAULT_AVATAR_DATA_URI = 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
            '<circle cx="32" cy="32" r="32" fill="#1e4d6b"/>' +
            '<circle cx="32" cy="26" r="14" fill="#a8d8e8"/>' +
            '<ellipse cx="32" cy="56" rx="22" ry="18" fill="#a8d8e8"/>' +
            '</svg>'
        );

        function sessionAvatarSrc() {
            if (!isLoggedIn()) return DEFAULT_AVATAR_DATA_URI;
            const sess = loadAuthSession();
            const rel = sess && sess.avatarUrl;
            if (rel && window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === 'function') {
                const url = window.UssAuthApi.resolveAssetUrl(rel);
                if (url) return url;
            }
            return DEFAULT_AVATAR_DATA_URI;
        }

        function sessionRankIconSrc(sess) {
            const u = sess && sess.rsiRankIconUrl;
            if (!u) return '';
            if (/^https?:\/\//i.test(u)) return u;
            if (window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === 'function') {
                return window.UssAuthApi.resolveAssetUrl(u);
            }
            return u;
        }

        let savedPageScrollY = 0;

        function isPageScrollLockNeeded() {
            const loginOpen = document.getElementById('loginDrawer').classList.contains('active');
            const ticketOpen = document.getElementById('sidebarModal').classList.contains('active');
            const alertOpen = document.getElementById('alertModal').style.display === 'block';
            const settingsBackdrop = document.getElementById('accountSettingsBackdrop');
            const settingsOpen = settingsBackdrop && !settingsBackdrop.hidden;
            const forgotBackdrop = document.getElementById('forgotPasswordBackdrop');
            const forgotOpen = forgotBackdrop && !forgotBackdrop.hidden;
            const lightbox = document.getElementById('communityImageLightbox');
            const lightboxOpen = lightbox && lightbox.classList.contains('is-open');
            return !!(loginOpen || ticketOpen || alertOpen || settingsOpen || forgotOpen || lightboxOpen);
        }

        function updatePageScrollLock() {
            const body = document.body;
            const html = document.documentElement;
            const needLock = isPageScrollLockNeeded();
            const locked = body.classList.contains('page-scroll-locked');
            if (needLock && !locked) {
                savedPageScrollY = window.scrollY || html.scrollTop || 0;
                body.classList.add('page-scroll-locked');
                html.classList.add('page-scroll-locked');
            } else if (!needLock && locked) {
                body.classList.remove('page-scroll-locked');
                html.classList.remove('page-scroll-locked');
                window.scrollTo(0, savedPageScrollY);
            }
        }

        document.addEventListener('uss-community-lightbox-change', updatePageScrollLock);

        function syncOverlay() {
            const overlay = document.getElementById('overlay');
            const ticketOpen = document.getElementById('sidebarModal').classList.contains('active');
            const loginOpen = document.getElementById('loginDrawer').classList.contains('active');
            const alertOpen = document.getElementById('alertModal').style.display === 'block';
            if (ticketOpen || loginOpen || alertOpen) {
                overlay.classList.add('active');
                /* 仅账户侧栏：透明遮罩，避免礼品区等主内容被压暗变色 */
                overlay.classList.toggle('overlay--login-only', !!(loginOpen && !ticketOpen && !alertOpen));
            } else {
                overlay.classList.remove('active', 'overlay--login-only');
            }
            updatePageScrollLock();
        }

        function closeModal() {
            document.getElementById('sidebarModal').classList.remove('active');
            syncOverlay();
        }

        function openLoginDrawer() {
            document.getElementById('sidebarModal').classList.remove('active');
            document.getElementById('loginDrawer').classList.add('active');
            clearLoginFormHint();
            clearRegisterFormHint();
            refreshLoginDrawerView();
            syncAuthFloatFields();
            syncOverlay();
            if (isLoggedIn()) {
                if (hydrateProfileCacheIfNeeded()) {
                    refreshNavLoginState();
                    refreshLoginDrawerView();
                }
                if (sessionProfileLooksIncomplete(loadAuthSession())) {
                    ensureUserProfileWithRetry({ reason: 'drawer' });
                }
            }
        }

        function closeLoginDrawer() {
            document.getElementById('loginDrawer').classList.remove('active');
            clearLoginFormHint();
            clearRegisterFormHint();
            syncOverlay();
        }

        function onOverlayClick() {
            closeModal();
            closeLoginDrawer();
        }

        // QQ号白名单列表
        const whitelistedQQNumbers = [
            '33009004043', 
            '2418299632',           
            '52640099364'
        ];

        function isQQInWhitelist(qqNumber) {
            return whitelistedQQNumbers.includes(qqNumber);
        }

        function showAlert(message) {
            document.getElementById('alertMessage').textContent = message;
            document.getElementById('alertModal').style.display = 'block';
            syncOverlay();
        }

        function closeAlert() {
            document.getElementById('alertModal').style.display = 'none';
            syncOverlay();
        }

        function showTicketPurchaseClosedNotice() {
            showAlert('USS HANGZHOU BC 已完美闭幕');
        }

        function verifyAndProceed() {
            const idNumber = document.getElementById('idNumber').value;
            const qqNumber = document.getElementById('qqNumber').value;
            const gameId = document.getElementById('gameId').value;
            const ticketType = document.getElementById('modalTicketType').textContent;

            if (!idNumber || !qqNumber || !gameId) {
                showAlert('请填写所有信息！');
                return;
            }

            // 首先验证QQ号是否在白名单中
            if (!isQQInWhitelist(qqNumber)) {
                showAlert(' 未查询到你的预约！ 请联系主办方 ');
                return;
            }

            // 验证年龄
            const age = calculateAge(idNumber);
            
            if (ticketType === 'UEE海军门票') {
                // UEE海军门票需要小于18岁
                if (age < 18) {
                    // 存储信息
                    localStorage.setItem('userInfo', JSON.stringify({
                        qq: qqNumber,
                        gameId: gameId,
                        idNumber: idNumber,
                        ticketType: 'uee'
                    }));
                    showAlert('验证成功！即将跳转到支付页面...');
                    setTimeout(() => {
                        window.location.href = 'payment.html';
                    }, 1500);
                } else {
                    showAlert('UEE海军门票仅限18岁以下购买！');
                }
            } else {
                // 巴奴门票需要大于等于18岁
                if (age >= 18) {
                    // 存储信息
                    localStorage.setItem('userInfo', JSON.stringify({
                        qq: qqNumber,
                        gameId: gameId,
                        idNumber: idNumber,
                        ticketType: 'banu'
                    }));
                    showAlert('验证成功！即将跳转到支付页面...');
                    setTimeout(() => {
                        window.location.href = 'payment.html';
                    }, 1500);
                } else {
                    showAlert('巴奴门票需要年满18岁才能购买！');
                }
            }
        }

        function calculateAge(idNumber) {
            // 简单的示例验证，实际应该有更严格的验证
            if (idNumber.length === 18) {
                const year = parseInt(idNumber.substring(6, 10));
                const month = parseInt(idNumber.substring(10, 12));
                const day = parseInt(idNumber.substring(12, 14));
                
                const today = new Date();
                const birthDate = new Date(year, month - 1, day);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                
                return age;
            }
            return 0;
        }

        function verifyRefund() {
            const qqNumber = prompt('请输入你的QQ号进行验证：');
            if (!qqNumber) return;

            if (isQQInWhitelist(qqNumber)) {
                showAlert('请联系主办方发送你的支付信息和备注的手机号\nQQ：330094043');
            } else {
                showAlert('未查询到你的预约！请联系主办方');
            }
        }

        // 点击遮罩层关闭弹窗
        document.getElementById('overlay').addEventListener('click', onOverlayClick);

        /* 登录/注册：账号在自建 API（仓库 backend/），浏览器只存会话 token。本机先启动 backend；公网基址由 auth-config.js / USS_AUTH_API_BASE 决定。 */

        function registerFormErrorHint(err) {
            var code = '';
            if (err && typeof err === 'object' && err.code) {
                code = String(err.code).trim();
            } else if (err && err.message) {
                var m = String(err.message).match(/^错误代码：([A-Z0-9_]+)$/);
                if (m) code = m[1];
            }
            if (code && typeof UssApiError !== 'undefined') {
                var hint = UssApiError.registerHintForCode(code);
                if (hint) return hint;
            }
            if (err && err.message) return safeUserFacingMessage(err.message);
            return safeUserFacingMessage(err);
        }

        function loginFormErrorHint(err) {
            var code = '';
            if (err && typeof err === 'object' && err.code) {
                code = String(err.code).trim();
            } else if (err && err.message) {
                var m = String(err.message).match(/^错误代码：([A-Z0-9_]+)$/);
                if (m) code = m[1];
            }
            if (code && typeof UssApiError !== 'undefined') {
                var hint = UssApiError.loginHintForCode(code);
                if (hint) return hint;
            }
            if (err && err.message) return safeUserFacingMessage(err.message);
            return safeUserFacingMessage(err);
        }

        function registerRsiScrapeErrorHint(err) {
            var msg = err && err.message ? String(err.message).trim() : '';
            if (msg.indexOf('未找到该绑定 ID') !== -1) {
                return '未找到该 RSI Handle，请确认绑定 ID 拼写正确。';
            }
            if (msg.indexOf('跨域') !== -1 || msg.indexOf('无法从本浏览器访问') !== -1) {
                return '浏览器无法读取 RSI 公民页，请确认能正常打开 RSI 官网后重试。';
            }
            if (msg.indexOf('RSI 页面解析结果不完整') !== -1) {
                return '未能从 RSI 解析完整资料，请确认已加入指定组织且公民页可公开访问。';
            }
            if (msg.indexOf('绑定 ID 无效') !== -1) {
                return '绑定 ID 格式无效，请填写 2–60 位小写英文、数字、下划线或连字符。';
            }
            if (msg) return msg;
            return '读取 RSI 资料失败，请稍后重试。';
        }

        function safeUserFacingMessage(msg) {
            if (typeof UssApiError !== 'undefined') {
                return UssApiError.sanitizeUserMessage(msg);
            }
            if (msg && typeof msg === 'object' && msg.message) {
                return safeUserFacingMessage(msg.message);
            }
            var s = msg == null ? '' : String(msg).trim();
            if (!s || /^[A-Z][A-Z0-9_]{2,}$/.test(s) || /^错误代码：/.test(s)) {
                return '操作失败，请稍后重试。';
            }
            return s;
        }

        function formatCommunityChatHintError(err) {
            var code = '';
            if (err && typeof err === 'object' && err.code) {
                code = String(err.code).trim();
            } else {
                var s = err && err.message ? String(err.message) : String(err || '');
                var m = s.match(/^错误代码：([A-Z0-9_]+)$/);
                if (m) code = m[1];
            }
            if (code === 'COMM_C002') {
                return '字数上限，无法发送';
            }
            return safeUserFacingMessage(err);
        }

        function isLikelyNetworkError(msg) {
            if (!msg || typeof msg !== 'string') return false;
            const s = msg.toLowerCase();
            return s.indexOf('fetch') !== -1 || s.indexOf('failed') !== -1 || s.indexOf('networkerror') !== -1 || s.indexOf('load failed') !== -1;
        }

        const AUTH_SESSION_KEY = 'ussHangzhouAuthSession';

        function authSessionLivesInSessionStorage() {
            try {
                return !!sessionStorage.getItem(AUTH_SESSION_KEY);
            } catch (e) {
                return false;
            }
        }

        function loadAuthSession() {
            if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.loadAuthSession === 'function') {
                return window.UssAuthSessionSync.loadAuthSession();
            }
            try {
                let raw = sessionStorage.getItem(AUTH_SESSION_KEY);
                if (raw) return JSON.parse(raw);
                raw = localStorage.getItem(AUTH_SESSION_KEY);
                if (raw) return JSON.parse(raw);
            } catch (e) {
                return null;
            }
            return null;
        }

        // remember: true → localStorage；false → sessionStorage（「一次」登录）。省略则保持当前存储位置。
        function saveAuthSession(data, remember) {
            if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.saveAuthSession === 'function') {
                window.UssAuthSessionSync.saveAuthSession(data, remember);
                return;
            }
            if (remember === undefined) {
                remember = !authSessionLivesInSessionStorage();
            }
            const json = JSON.stringify(data);
            if (remember) {
                localStorage.setItem(AUTH_SESSION_KEY, json);
                try {
                    sessionStorage.removeItem(AUTH_SESSION_KEY);
                } catch (e) { /* ignore */ }
            } else {
                sessionStorage.setItem(AUTH_SESSION_KEY, json);
                try {
                    localStorage.removeItem(AUTH_SESSION_KEY);
                } catch (e) { /* ignore */ }
            }
        }

        function clearAuthSession() {
            if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.clearAuthSession === 'function') {
                window.UssAuthSessionSync.clearAuthSession();
                return;
            }
            try {
                localStorage.removeItem(AUTH_SESSION_KEY);
            } catch (e) { /* ignore */ }
            try {
                sessionStorage.removeItem(AUTH_SESSION_KEY);
            } catch (e) { /* ignore */ }
        }

        function syncAuthFloatField(input) {
            if (!input) return;
            var field = input.closest('.rsi-field--float');
            if (!field) return;
            field.classList.toggle('is-filled', !!String(input.value || '').trim());
        }

        function syncAuthFloatFields() {
            [
                'loginEmail',
                'loginPassword',
                'regBindingId',
                'regEmail',
                'regPassword',
                'forgotPwEmail',
                'forgotPwCode',
                'forgotPwNewPassword',
                'forgotPwConfirmPassword',
                'settingsCurrentPassword',
                'settingsNewPassword',
                'settingsConfirmPassword',
            ].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) syncAuthFloatField(el);
            });
        }

        function getLoginSessionDays() {
            const el = document.getElementById('loginSessionDays');
            if (!el) return 7;
            const n = Number(el.value);
            if (n === 0 || n === 7 || n === 30 || n === 365) return n;
            return 7;
        }

        const LOGIN_SESSION_LABELS = { '0': '24 hour', '7': '7 Sky', '30': '30 Sky', '365': '1Year' };

        function formatSessionSelectText(val) {
            const label = LOGIN_SESSION_LABELS[String(val)];
            return label ? '保持登录 - ' + label : '保持登录';
        }

        function initLoginSessionSelect() {
            const wrap = document.getElementById('loginSessionDaysWrap');
            if (!wrap || wrap.dataset.wired === '1') return;
            wrap.dataset.wired = '1';
            const hidden = document.getElementById('loginSessionDays');
            const trigger = document.getElementById('loginSessionDaysTrigger');
            const menu = document.getElementById('loginSessionDaysMenu');
            const valueEl = document.getElementById('loginSessionDaysValue');
            if (!hidden || !trigger || !menu || !valueEl) return;

            function setValue(val) {
                const v = String(val);
                if (!LOGIN_SESSION_LABELS[v]) return;
                hidden.value = v;
                valueEl.textContent = formatSessionSelectText(v);
                menu.querySelectorAll('.rsi-custom-select-option').forEach(function (opt) {
                    const on = opt.getAttribute('data-value') === v;
                    opt.classList.toggle('is-selected', on);
                    opt.setAttribute('aria-selected', on ? 'true' : 'false');
                });
            }

            function closeMenu() {
                menu.hidden = true;
                trigger.setAttribute('aria-expanded', 'false');
                wrap.classList.remove('is-open');
            }

            function openMenu() {
                menu.hidden = false;
                trigger.setAttribute('aria-expanded', 'true');
                wrap.classList.add('is-open');
            }

            valueEl.textContent = formatSessionSelectText(hidden.value);

            trigger.addEventListener('click', function (e) {
                e.preventDefault();
                if (wrap.classList.contains('is-open')) closeMenu();
                else openMenu();
            });

            menu.querySelectorAll('.rsi-custom-select-option').forEach(function (opt) {
                opt.addEventListener('click', function () {
                    setValue(opt.getAttribute('data-value'));
                    closeMenu();
                });
            });

            document.addEventListener('click', function (e) {
                if (!wrap.contains(e.target)) closeMenu();
            });

            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && wrap.classList.contains('is-open')) {
                    closeMenu();
                    trigger.focus();
                }
            });
        }

        function handleAuthSessionExpired() {
            clearAuthSession();
            refreshNavLoginState();
            refreshLoginDrawerView();
        }

        const AUTH_BUTTON_FEEDBACK_MS = 1600;
        /** 登录按钮至少显示「登录中」时长，避免接口太快用户以为没点上 */
        const LOGIN_MIN_LOADING_MS = 600;

        function resetLoginSubmitBtn() {
            const b = document.getElementById('loginSubmitBtn');
            if (b) {
                b.classList.remove('rsi-submit-btn--loading');
                b.removeAttribute('aria-busy');
                b.innerHTML = '';
                b.textContent = '登录';
                b.disabled = false;
            }
        }

        function setLoginSubmitLoading(isLoading) {
            const b = document.getElementById('loginSubmitBtn');
            if (!b) return;
            if (isLoading) {
                b.disabled = true;
                b.classList.add('rsi-submit-btn--loading');
                b.setAttribute('aria-busy', 'true');
                b.innerHTML =
                    '<span class="rsi-btn-spinner" aria-hidden="true"></span><span class="rsi-btn-spinner-text">登录中…</span>';
            } else {
                b.classList.remove('rsi-submit-btn--loading');
                b.removeAttribute('aria-busy');
            }
        }

        function resetRegisterSubmitBtn() {
            const b = document.getElementById('registerSubmitBtn');
            if (b) {
                b.textContent = '注册';
                b.disabled = false;
            }
        }

        function resetLogoutSubmitBtn() {
            const b = document.getElementById('logoutSubmitBtn');
            if (b) {
                b.disabled = false;
                b.setAttribute('aria-label', '退出登录');
                b.title = '退出登录';
            }
        }

        function clearAccountSettingsHint() {
            const el = document.getElementById('accountSettingsHint');
            if (el) {
                el.textContent = '';
                el.hidden = true;
                el.classList.remove('rsi-form-hint--info');
                el.classList.add('rsi-form-hint--error');
            }
        }

        function setAccountSettingsHint(msg, isInfo) {
            const el = document.getElementById('accountSettingsHint');
            if (!el) return;
            if (!msg) {
                clearAccountSettingsHint();
                return;
            }
            el.textContent = msg;
            el.hidden = false;
            el.classList.toggle('rsi-form-hint--info', !!isInfo);
            el.classList.toggle('rsi-form-hint--error', !isInfo);
        }

        function resetAccountSettingsForm() {
            ['settingsCurrentPassword', 'settingsNewPassword', 'settingsConfirmPassword'].forEach(function (id) {
                const input = document.getElementById(id);
                if (input) {
                    input.value = '';
                    input.type = 'password';
                }
            });
            ['settingsCurrentPwToggle', 'settingsNewPwToggle', 'settingsConfirmPwToggle'].forEach(function (id) {
                setPasswordToggleIcon(document.getElementById(id), false);
            });
            syncAuthFloatFields();
            const submit = document.getElementById('settingsPasswordSubmitBtn');
            if (submit) {
                submit.disabled = false;
                submit.textContent = '确认修改';
            }
            clearAccountSettingsHint();
        }

        function openAccountSettings() {
            if (!isLoggedIn()) {
                openLoginDrawer();
                return;
            }
            resetAccountSettingsForm();
            const backdrop = document.getElementById('accountSettingsBackdrop');
            if (!backdrop) return;
            backdrop.hidden = false;
            backdrop.onclick = function (e) {
                if (e.target === backdrop) closeAccountSettings();
            };
            updatePageScrollLock();
        }

        function closeAccountSettings() {
            const backdrop = document.getElementById('accountSettingsBackdrop');
            if (backdrop) backdrop.hidden = true;
            resetAccountSettingsForm();
            updatePageScrollLock();
        }

        async function submitChangePassword() {
            clearAccountSettingsHint();
            const sess = loadAuthSession();
            if (!sess || !sess.token) {
                setAccountSettingsHint('请先登录');
                return;
            }
            const currentPassword = String(document.getElementById('settingsCurrentPassword')?.value || '');
            const newPassword = String(document.getElementById('settingsNewPassword')?.value || '');
            const confirmPassword = String(document.getElementById('settingsConfirmPassword')?.value || '');
            if (!currentPassword || !newPassword || !confirmPassword) {
                setAccountSettingsHint('请填写完整');
                return;
            }
            if (newPassword !== confirmPassword) {
                setAccountSettingsHint('两次输入的新密码不一致');
                return;
            }
            if (newPassword.length < 6) {
                setAccountSettingsHint('新密码至少 6 位');
                return;
            }
            const btn = document.getElementById('settingsPasswordSubmitBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '提交中…';
            }
            try {
                await window.UssAuthApi.changePassword(sess.token, {
                    currentPassword: currentPassword,
                    newPassword: newPassword,
                    confirmPassword: confirmPassword,
                });
                setAccountSettingsHint('密码已更新', true);
                setTimeout(function () {
                    closeAccountSettings();
                }, 700);
            } catch (e) {
                setAccountSettingsHint(safeUserFacingMessage(e));
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '确认修改';
                }
            }
        }

        function isLoggedIn() {
            const session = loadAuthSession();
            return !!(session && session.token);
        }

        function authSessionPayloadFromUser(token, user, prev) {
            if (
                window.UssAuthSessionSync &&
                typeof window.UssAuthSessionSync.mergeUserIntoSession === 'function'
            ) {
                return window.UssAuthSessionSync.mergeUserIntoSession(token, user, prev || {});
            }
            const p = prev || {};
            const u = user || {};
            return {
                token: token,
                bindingId: u.bindingId != null ? u.bindingId : p.bindingId,
                email: u.email != null ? u.email : p.email,
                loginAt: p.loginAt || new Date().toISOString(),
                avatarUrl: u.avatarUrl != null ? u.avatarUrl : p.avatarUrl,
                rsiCitizenAvatarSourceUrl:
                    u.rsiCitizenAvatarSourceUrl !== undefined
                        ? u.rsiCitizenAvatarSourceUrl
                        : p.rsiCitizenAvatarSourceUrl,
                rsiProfileHandle: u.rsiProfileHandle !== undefined ? u.rsiProfileHandle : p.rsiProfileHandle,
                rsiRankIconUrl: u.rsiRankIconUrl !== undefined ? u.rsiRankIconUrl : p.rsiRankIconUrl,
                rsiRankLabel: u.rsiRankLabel !== undefined ? u.rsiRankLabel : p.rsiRankLabel,
                rsiEnlisted: u.rsiEnlisted !== undefined ? u.rsiEnlisted : p.rsiEnlisted,
                rsiLocation: u.rsiLocation !== undefined ? u.rsiLocation : p.rsiLocation,
                rsiFluency: u.rsiFluency !== undefined ? u.rsiFluency : p.rsiFluency,
                rsiOrgName: u.rsiOrgName !== undefined ? u.rsiOrgName : p.rsiOrgName,
                rsiOrgSid: u.rsiOrgSid !== undefined ? u.rsiOrgSid : p.rsiOrgSid,
                rsiOrgHref: u.rsiOrgHref !== undefined ? u.rsiOrgHref : p.rsiOrgHref,
                rsiOrgPageUrl: u.rsiOrgPageUrl !== undefined ? u.rsiOrgPageUrl : p.rsiOrgPageUrl,
                rsiOrgLogoUrl: u.rsiOrgLogoUrl !== undefined ? u.rsiOrgLogoUrl : p.rsiOrgLogoUrl,
                rsiOrgRoleLabel: u.rsiOrgRoleLabel !== undefined ? u.rsiOrgRoleLabel : p.rsiOrgRoleLabel,
                rsiOrgRankSlots: u.rsiOrgRankSlots !== undefined ? u.rsiOrgRankSlots : p.rsiOrgRankSlots,
                rsiProfileSyncedAt:
                    u.rsiProfileSyncedAt !== undefined ? u.rsiProfileSyncedAt : p.rsiProfileSyncedAt,
                rsiAssetsPending:
                    u.rsiAssetsPending !== undefined ? !!u.rsiAssetsPending : p.rsiAssetsPending,
                isAdmin: u.isAdmin !== undefined ? !!u.isAdmin : !!p.isAdmin,
                isSuperAdmin: u.isSuperAdmin !== undefined ? !!u.isSuperAdmin : !!p.isSuperAdmin,
            };
        }

        /** 抓取全部失败时，用进入流程前的快照 + 本地资料缓存恢复展示 */
        function restoreProfileFromSnapshot(token, snapshot, remember) {
            if (!snapshot || !token) return null;
            var cached =
                window.UssAuthSessionSync && window.UssAuthSessionSync.loadProfileCache
                    ? window.UssAuthSessionSync.loadProfileCache(snapshot.bindingId)
                    : null;
            var base = loadAuthSession() || {};
            var merged = Object.assign({}, cached || {}, base, snapshot, { token: token });
            saveAuthSession(merged, remember);
            return merged;
        }

        function saveAuthSessionFromUser(token, user, remember, prev) {
            const basePrev = prev || loadAuthSession() || {};
            const payload = authSessionPayloadFromUser(token, user, basePrev);
            if (basePrev.sessionDays != null) payload.sessionDays = basePrev.sessionDays;
            if (basePrev.expiresAt != null) {
                payload.expiresAt = basePrev.expiresAt;
            } else if (window.UssAuthApi && typeof window.UssAuthApi.getTokenExpiresAt === 'function') {
                const exp = window.UssAuthApi.getTokenExpiresAt(token);
                if (exp != null) payload.expiresAt = exp;
            }
            const useRemember =
                remember !== undefined
                    ? remember
                    : !!(localStorage.getItem(AUTH_SESSION_KEY) && !sessionStorage.getItem(AUTH_SESSION_KEY));
            saveAuthSession(payload, useRemember);
            return payload;
        }

        /** 服务端重新抓取 RSI 由登录后 scheduleLoginRsiRefresh 负责；页面侧不重复包装 */

        /** 会话中 RSI 公民资料是否明显未抓取成功 */
        function sessionProfileLooksIncomplete(sess) {
            if (
                window.UssRsiSync &&
                typeof window.UssRsiSync.profileLooksIncomplete === 'function'
            ) {
                return window.UssRsiSync.profileLooksIncomplete(sess);
            }
            return false;
        }

        let ensureUserProfilePromise = null;

        /** 优先 /api/me；F5 刷新不触发 Edge/CDP，仅登录或打开账户抽屉且资料过期时才抓取 RSI */
        async function ensureUserProfileWithRetry(options) {
            if (!isLoggedIn()) return null;
            if (ensureUserProfilePromise) return ensureUserProfilePromise;
            ensureUserProfilePromise = (async function () {
                const opts = options || {};
                const sess0 = loadAuthSession();
                if (!sess0 || !sess0.token) return null;
                const authEpoch0 =
                    window.UssAuthSessionSync &&
                    typeof window.UssAuthSessionSync.getAuthSessionEpoch === 'function'
                        ? window.UssAuthSessionSync.getAuthSessionEpoch()
                        : 0;
                const token0 = sess0.token;
                function stillLoggedIn() {
                    return (
                        window.UssAuthSessionSync &&
                        typeof window.UssAuthSessionSync.isAuthSessionOpValid === 'function' &&
                        window.UssAuthSessionSync.isAuthSessionOpValid(authEpoch0, token0)
                    );
                }

                function onProfileUpdated() {
                    if (!stillLoggedIn()) return;
                    refreshNavLoginState();
                    refreshLoginDrawerView();
                }

                const reason = String(opts.reason || 'boot').trim();
                const skipServerRefresh = opts.skipServerRefresh === true;

                if (
                    !skipServerRefresh &&
                    window.UssAuthSessionSync &&
                    typeof window.UssAuthSessionSync.refreshAuthSessionFromServerWithRetry === 'function'
                ) {
                    await window.UssAuthSessionSync.refreshAuthSessionFromServerWithRetry({
                        maxAttempts: 3,
                        onUpdated: onProfileUpdated,
                    });
                } else if (!skipServerRefresh && window.UssAuthApi) {
                    try {
                        const me = await window.UssAuthApi.me(token0);
                        if (stillLoggedIn()) {
                            saveAuthSessionFromUser(token0, me, undefined, sess0);
                            onProfileUpdated();
                        }
                    } catch (ignore) {}
                }

                if (!stillLoggedIn()) return null;

                let sess = loadAuthSession();
                if (!sess || !sess.token) return null;

                const allowRsiWebRefresh = reason === 'drawer';

                if (
                    allowRsiWebRefresh &&
                    window.UssRsiSync &&
                    typeof window.UssRsiSync.shouldRefreshRsiOnLogin === 'function' &&
                    window.UssRsiSync.shouldRefreshRsiOnLogin(sess) &&
                    typeof window.UssRsiSync.refreshUserRsiOnLoginWithFallback === 'function'
                ) {
                    const user = await window.UssRsiSync.refreshUserRsiOnLoginWithFallback(
                        sess.token,
                        sess.bindingId,
                        { maxAttempts: 2 }
                    );
                    if (user && stillLoggedIn()) {
                        saveAuthSessionFromUser(sess.token, user, undefined, sess);
                        onProfileUpdated();
                    }
                }

                return stillLoggedIn() ? loadAuthSession() : null;
            })().finally(function () {
                ensureUserProfilePromise = null;
            });
            return ensureUserProfilePromise;
        }

        /** 进入页/打开抽屉时：若当前会话资料为空，先用 localStorage 里的历史资料填充展示 */
        function hydrateProfileCacheIfNeeded() {
            if (!isLoggedIn() || !window.UssAuthSessionSync) return false;
            const sess = loadAuthSession();
            if (!sess || !sess.token || !sessionProfileLooksIncomplete(sess)) return false;
            const cached = window.UssAuthSessionSync.loadProfileCache(sess.bindingId);
            if (!cached) return false;
            const remember = !!(
                localStorage.getItem(AUTH_SESSION_KEY) && !sessionStorage.getItem(AUTH_SESSION_KEY)
            );
            const merged = window.UssAuthSessionSync.mergeUserIntoSession(
                sess.token,
                {},
                Object.assign({}, cached, sess)
            );
            saveAuthSession(merged, remember);
            return true;
        }

        async function validateAuthSession() {
            const s = loadAuthSession();
            if (!s || !s.token) return;
            const onAuthUi = function () {
                refreshNavLoginState();
                refreshLoginDrawerView();
            };
            try {
                if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.refreshAuthSessionFromServerWithRetry === 'function') {
                    await window.UssAuthSessionSync.refreshAuthSessionFromServerWithRetry({
                        onUpdated: onAuthUi,
                        onSessionExpired: onAuthUi,
                    });
                    return;
                }
                if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.refreshAuthSessionFromServer === 'function') {
                    await window.UssAuthSessionSync.refreshAuthSessionFromServer({
                        onUpdated: onAuthUi,
                        onSessionExpired: onAuthUi,
                    });
                    return;
                }
                const me = await window.UssAuthApi.me(s.token);
                saveAuthSessionFromUser(s.token, me, undefined, s);
            } catch (e) {
                if (window.UssAuthApi && window.UssAuthApi.isAuthSessionError(e)) {
                    handleAuthSessionExpired();
                } else {
                    clearAuthSession();
                    onAuthUi();
                }
            }
        }

        function refreshNavLoginState() {
            try {
                const root = document.documentElement;
                if (isLoggedIn()) root.classList.add('auth-session-cached');
                else root.classList.remove('auth-session-cached');
            } catch (e) {
                /* ignore */
            }
            const btn = document.getElementById('navLoginBtn');
            const guestWrap = document.getElementById('navLoginGuestWrap');
            const avatarWrap = document.getElementById('navLoginAvatarWrap');
            const img = document.getElementById('navUserAvatarImg');
            if (!btn || !guestWrap || !avatarWrap || !img) {
                if (window.UssNavTools && typeof window.UssNavTools.refresh === 'function') {
                    window.UssNavTools.refresh();
                }
                refreshCommunitySessionUi();
                return;
            }
            if (isLoggedIn()) {
                guestWrap.classList.add('is-hidden');
                avatarWrap.classList.remove('is-hidden');
                btn.classList.add('is-logged-in');
                btn.setAttribute('aria-label', '账户');
                img.decoding = 'async';
                img.fetchPriority = 'high';
                img.src = sessionAvatarSrc();
                img.alt = '用户头像';
            } else {
                guestWrap.classList.remove('is-hidden');
                avatarWrap.classList.add('is-hidden');
                btn.classList.remove('is-logged-in');
                btn.setAttribute('aria-label', '登录或注册');
                img.src = DEFAULT_AVATAR_DATA_URI;
                img.alt = '默认头像';
            }
            if (window.UssNavTools && typeof window.UssNavTools.refresh === 'function') {
                window.UssNavTools.refresh();
            }
            refreshCommunitySessionUi();
        }

        /** 首页舰员交流区（论坛式发帖 + 图片/GIF） */
        const COMMUNITY_MAX_IMAGES = 6;
        const COMMUNITY_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
        const COMMUNITY_CHAT_POLL_MS = 3500;
        const COMMUNITY_UI_CACHE_TTL_MS = 30 * 60 * 1000;
        const COMMUNITY_CHAT_MAX_TEXT = 3000;
        const COMMUNITY_CHAT_EMOJIS = [
            '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘',
            '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏',
            '😒', '🙄', '😬', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶',
            '😎', '🤓', '🥳', '😤', '😠', '😡', '🤬', '😭', '😱', '😨', '😰', '😥', '😓', '🤯', '😵',
            '👍', '👎', '👊', '✊', '🤝', '👏', '🙌', '🙏', '💪', '👋', '🤞', '✌️', '🤟', '🤘', '👌',
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💖', '💘', '💯', '✨', '⭐',
            '🔥', '🎉', '🎊', '🍻', '🚀', '🛸', '⚔️', '🎯', '✅', '❌', '❗', '❓', '💤', '🫡', '🤡',
        ];
        let communityChatEmojiOpen = false;
        let communityPendingImages = [];
        let communityChatPendingImages = [];
        let communityChatMaxSeq = 0;
        let communityChatPollTimer = null;
        let communityChatPollBackoffMs = 0;
        let communityChatNearBottom = true;
        let communityChatKind = 'fleet';
        let communityChatPinned = null;
        let communityChatDmPeer = '';
        let communityChatDmLabel = '';
        let communityDmMaxSeq = 0;
        /** 舰队成员列表搜索关键字（列表重绘时保留） */
        let communityRosterSearchQuery = '';
        let communityInboxSnapshot = { fleetMaxSeq: 0, dmMaxByPeer: {} };
        /** 全量成员（含自己），用于 @ 补全 */
        let communityChatRosterMembersList = [];
        /** 聊天历史懒渲染：先画可见区，上滑再补更早消息 */
        const COMMUNITY_CHAT_HISTORY_BATCH = 24;
        let communityChatBufferedMessages = [];
        let communityChatBufferedLineKind = 'fleet';
        let communityChatRenderedCount = 0;
        let communityChatHistoryLoading = false;
        let communityChatHistoryObserver = null;
        const communityMentionNotifiedKeys = new Set();
        let communityMentionUI = {
            open: false,
            atStart: 0,
            query: '',
            activeIdx: 0,
            filtered: [],
        };

        function openCommunityImageLightbox(src) {
            if (window.UssCommunityImageLightbox) window.UssCommunityImageLightbox.open(src);
        }

        function communityUiCacheStorageKey(suffix) {
            const s = loadAuthSession();
            const bid = s && s.bindingId ? String(s.bindingId).trim().toLowerCase() : '';
            if (!bid) return null;
            return 'UssCommunityUi_v1:' + bid + ':' + suffix;
        }

        function readCommunityUiCache(suffix) {
            try {
                const key = communityUiCacheStorageKey(suffix);
                if (!key) return null;
                const raw = sessionStorage.getItem(key);
                if (!raw) return null;
                const o = JSON.parse(raw);
                if (!o || typeof o !== 'object') return null;
                if (!Number.isFinite(o.at) || Date.now() - o.at > COMMUNITY_UI_CACHE_TTL_MS) return null;
                return o;
            } catch (e) {
                return null;
            }
        }

        function writeCommunityUiCache(suffix, payload) {
            try {
                const key = communityUiCacheStorageKey(suffix);
                if (!key) return;
                const o = Object.assign({ at: Date.now() }, payload || {});
                sessionStorage.setItem(key, JSON.stringify(o));
            } catch (e) {
                /* sessionStorage 满时忽略 */
            }
        }

        function mergeCommunityChatCacheMessages(prev, incoming) {
            const map = new Map();
            (prev || []).forEach(function (m) {
                if (m && m.seq != null) map.set(String(m.seq), m);
            });
            (incoming || []).forEach(function (m) {
                if (m && m.seq != null) map.set(String(m.seq), m);
            });
            return Array.from(map.values()).sort(function (a, b) {
                return Number(a.seq) - Number(b.seq);
            });
        }

        function communityReadStateStorageKey() {
            const s = loadAuthSession();
            const bid = s && s.bindingId ? String(s.bindingId).trim().toLowerCase() : '';
            return bid ? 'UssCommunityRead_v1:' + bid : null;
        }

        function loadCommunityReadState() {
            const key = communityReadStateStorageKey();
            if (!key) return null;
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return null;
                const o = JSON.parse(raw);
                if (!o || typeof o !== 'object') return null;
                return {
                    fleet: Number.isFinite(Number(o.fleet)) ? Math.max(0, Math.floor(Number(o.fleet))) : 0,
                    dm: o.dm && typeof o.dm === 'object' ? o.dm : {},
                };
            } catch (e) {
                return null;
            }
        }

        function saveCommunityReadState(st) {
            const key = communityReadStateStorageKey();
            if (!key || !st) return;
            try {
                localStorage.setItem(
                    key,
                    JSON.stringify({
                        fleet: Math.max(0, Math.floor(Number(st.fleet) || 0)),
                        dm: st.dm && typeof st.dm === 'object' ? st.dm : {},
                    })
                );
            } catch (e) {
                /* ignore */
            }
        }

        function communityDmPinStorageKey() {
            const s = loadAuthSession();
            const bid = s && s.bindingId ? String(s.bindingId).trim().toLowerCase() : '';
            return bid ? 'UssCommunityDmPin_v1:' + bid : null;
        }

        function loadCommunityDmPinOrder() {
            const key = communityDmPinStorageKey();
            if (!key) return {};
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return {};
                const o = JSON.parse(raw);
                if (!o || typeof o !== 'object') return {};
                const out = {};
                Object.keys(o).forEach(function (k) {
                    const kk = String(k).trim().toLowerCase();
                    const n = Number(o[k]);
                    if (kk && Number.isFinite(n) && n > 0) out[kk] = n;
                });
                return out;
            } catch (e) {
                return {};
            }
        }

        function saveCommunityDmPinOrder(map) {
            const key = communityDmPinStorageKey();
            if (!key || !map || typeof map !== 'object') return;
            try {
                localStorage.setItem(key, JSON.stringify(map));
            } catch (e) {
                /* ignore */
            }
        }

        /** 私聊往来后置顶该成员（时间戳越大越靠前） */
        function touchCommunityDmPeer(peerBindingId, at) {
            const k = String(peerBindingId || '').trim().toLowerCase();
            if (!k || !communityDmPinStorageKey()) return false;
            const ts = Number.isFinite(Number(at)) && Number(at) > 0 ? Number(at) : Date.now();
            const pin = loadCommunityDmPinOrder();
            if (pin[k] === ts) return false;
            pin[k] = ts;
            saveCommunityDmPinOrder(pin);
            return true;
        }

        function bootstrapCommunityDmPinFromInbox(dmNorm) {
            const pin = loadCommunityDmPinOrder();
            const peers = Object.keys(dmNorm || {}).filter(function (peer) {
                return (dmNorm[peer] || 0) > 0 && !pin[peer];
            });
            if (!peers.length) return false;
            peers.sort(function (a, b) {
                return (dmNorm[b] || 0) - (dmNorm[a] || 0);
            });
            const base = Date.now() - peers.length * 1000;
            peers.forEach(function (peer, i) {
                pin[peer] = base + (peers.length - i) * 1000;
            });
            saveCommunityDmPinOrder(pin);
            return true;
        }

        function sortCommunityRosterMembersForDisplay(members) {
            const pin = loadCommunityDmPinOrder();
            return (Array.isArray(members) ? members : []).slice().sort(function (a, b) {
                const ba = a && a.bindingId != null ? String(a.bindingId).trim().toLowerCase() : '';
                const bb = b && b.bindingId != null ? String(b.bindingId).trim().toLowerCase() : '';
                const ta = pin[ba] || 0;
                const tb = pin[bb] || 0;
                if (ta !== tb) return tb - ta;
                return String(a && a.bindingId != null ? a.bindingId : '').localeCompare(
                    String(b && b.bindingId != null ? b.bindingId : ''),
                    'zh-CN'
                );
            });
        }

        function reorderCommunityChatRosterPeers() {
            if (!communityChatRosterMembersList.length) return;
            renderCommunityChatRosterFromMembers(communityChatRosterMembersList);
        }

        function ensureCommunityReadBaseline(fleetMax, dmMap) {
            if (loadCommunityReadState()) return;
            const dmCopy = {};
            if (dmMap && typeof dmMap === 'object') {
                Object.keys(dmMap).forEach(function (k) {
                    const kk = String(k).trim().toLowerCase();
                    const n = Number(dmMap[k]);
                    if (kk && Number.isFinite(n) && n >= 0) dmCopy[kk] = Math.floor(n);
                });
            }
            const fm = Number.isFinite(Number(fleetMax)) ? Math.max(0, Math.floor(fleetMax)) : 0;
            saveCommunityReadState({ fleet: fm, dm: dmCopy });
        }

        function markCommunityFleetRead(seq) {
            if (!communityReadStateStorageKey()) return;
            const n = Number(seq);
            const nn = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
            const read = loadCommunityReadState() || { fleet: 0, dm: {} };
            if (!read.dm || typeof read.dm !== 'object') read.dm = {};
            if (nn > (read.fleet || 0)) read.fleet = nn;
            saveCommunityReadState(read);
            updateCommunityUnreadBadges();
        }

        function markCommunityDmPeerRead(peerBindingId, seq) {
            if (!communityReadStateStorageKey()) return;
            const k = String(peerBindingId || '').trim().toLowerCase();
            if (!k) return;
            const n = Number(seq);
            const nn = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
            const read = loadCommunityReadState() || { fleet: 0, dm: {} };
            if (!read.dm || typeof read.dm !== 'object') read.dm = {};
            if (nn > (read.dm[k] || 0)) read.dm[k] = nn;
            saveCommunityReadState(read);
            updateCommunityUnreadBadges();
        }

        async function refreshCommunityInboxSnapshot() {
            if (!window.UssAuthApi || !isLoggedIn()) return;
            const sess = loadAuthSession();
            if (!sess || !sess.token) return;
            try {
                const data = await window.UssAuthApi.communityInbox(sess.token);
                const fleetMax =
                    typeof data.fleetMaxSeq === 'number' && data.fleetMaxSeq > 0
                        ? Math.floor(data.fleetMaxSeq)
                        : 0;
                const dmRaw = data.dmMaxByPeer && typeof data.dmMaxByPeer === 'object' ? data.dmMaxByPeer : {};
                const dmNorm = {};
                Object.keys(dmRaw).forEach(function (k) {
                    const kk = String(k).trim().toLowerCase();
                    const n = Number(dmRaw[k]);
                    if (kk && Number.isFinite(n) && n >= 0) dmNorm[kk] = Math.floor(n);
                });
                ensureCommunityReadBaseline(fleetMax, dmNorm);
                const prevDm = communityInboxSnapshot.dmMaxByPeer || {};
                let pinChanged = bootstrapCommunityDmPinFromInbox(dmNorm);
                Object.keys(dmNorm).forEach(function (peer) {
                    const next = dmNorm[peer] || 0;
                    const prev = prevDm[peer] || 0;
                    if (next > prev && touchCommunityDmPeer(peer)) {
                        pinChanged = true;
                    }
                });
                communityInboxSnapshot.fleetMaxSeq = fleetMax;
                communityInboxSnapshot.dmMaxByPeer = dmNorm;
                updateCommunityUnreadBadges();
                syncCommunityFleetPollCursorFromInbox();
                if (pinChanged) reorderCommunityChatRosterPeers();
            } catch (e) {
                /* 静默 */
            }
        }

        /** 从未打开过舰队聊天时，用收件箱 maxSeq 对齐轮询游标，避免用 afterSeq=0 拉整页历史并误触发 @ 提醒。 */
        function syncCommunityFleetPollCursorFromInbox() {
            const fm = communityInboxSnapshot.fleetMaxSeq || 0;
            if (communityChatKind !== 'fleet' && fm > 0 && (communityChatMaxSeq || 0) === 0) {
                communityChatMaxSeq = fm;
            }
        }

        function updateCommunityUnreadBadges() {
            const read = loadCommunityReadState();
            const fleetBtn = document.querySelector('.community-chat-roster-fleet');
            if (fleetBtn) {
                const b = fleetBtn.querySelector('.community-chat-unread-badge');
                if (b) {
                    let unread = !!(read && communityInboxSnapshot.fleetMaxSeq > (read.fleet || 0));
                    if (communityChatKind === 'fleet') unread = false;
                    b.hidden = !unread;
                }
            }
            document.querySelectorAll('.community-chat-roster-peer').forEach(function (row) {
                const peer = row.getAttribute('data-peer');
                const badge = row.querySelector('.community-chat-unread-badge');
                if (!peer || !badge) return;
                const pl = peer.toLowerCase();
                const max = communityInboxSnapshot.dmMaxByPeer[pl];
                let unread = !!(read && max != null && max > (read.dm && read.dm[pl] != null ? read.dm[pl] : 0));
                if (
                    communityChatKind === 'dm' &&
                    communityChatDmPeer &&
                    communityChatDmPeer.toLowerCase() === pl
                ) {
                    unread = false;
                }
                badge.hidden = !unread;
            });
        }

        function sessionIsCommunityStaff() {
            const s = loadAuthSession();
            return !!(s && s.token && (s.isSuperAdmin || s.isAdmin));
        }

        function communityPostIsMine(p) {
            const s = loadAuthSession();
            if (!s || !s.token || !s.bindingId || !p) return false;
            return (
                String(s.bindingId)
                    .trim()
                    .toLowerCase() ===
                String(p.bindingId || '')
                    .trim()
                    .toLowerCase()
            );
        }

        function communityReplyIsMine(r) {
            return communityPostIsMine(r);
        }

        function clearCommunityChatHint() {
            const el = document.getElementById('communityChatHint');
            if (el) el.textContent = '';
        }

        function closeCommunityChatMentionPicker() {
            communityMentionUI.open = false;
            communityMentionUI.filtered = [];
            const pop = document.getElementById('communityChatMentionPop');
            if (pop) {
                pop.hidden = true;
                pop.innerHTML = '';
            }
        }

        function closeCommunityChatEmojiPicker() {
            const pop = document.getElementById('communityChatEmojiPop');
            const btn = document.getElementById('communityChatEmojiBtn');
            if (pop) pop.hidden = true;
            if (btn) btn.setAttribute('aria-expanded', 'false');
            communityChatEmojiOpen = false;
        }

        function toggleCommunityChatEmojiPicker() {
            const pop = document.getElementById('communityChatEmojiPop');
            const btn = document.getElementById('communityChatEmojiBtn');
            const input = document.getElementById('communityChatInput');
            if (!pop || !btn || btn.disabled) return;
            const opening = pop.hidden;
            closeCommunityChatMentionPicker();
            var chatMenu = document.getElementById('communityChatSendMenu');
            var cmb = document.getElementById('communityChatSendMenuBtn');
            if (chatMenu) chatMenu.hidden = true;
            if (cmb) cmb.setAttribute('aria-expanded', 'false');
            if (opening) {
                pop.hidden = false;
                btn.setAttribute('aria-expanded', 'true');
                communityChatEmojiOpen = true;
                if (input) input.focus();
            } else {
                closeCommunityChatEmojiPicker();
            }
        }

        function installCommunityChatEmojiPicker() {
            const grid = document.getElementById('communityChatEmojiGrid');
            const btn = document.getElementById('communityChatEmojiBtn');
            if (!grid || grid.childNodes.length) return;
            COMMUNITY_CHAT_EMOJIS.forEach(function (em) {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'community-chat-emoji-pop__item';
                item.textContent = em;
                item.setAttribute('aria-label', '插入表情 ' + em);
                item.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    insertTextAtCommunityChatInput(em);
                    const input = document.getElementById('communityChatInput');
                    if (input) input.focus();
                });
                grid.appendChild(item);
            });
            if (btn) {
                btn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    toggleCommunityChatEmojiPicker();
                });
            }
        }

        function communityMentionShowEveryoneOption(q) {
            const qq = String(q || '').trim().toLowerCase();
            if (!qq) return true;
            if (qq === '全') return true;
            if ('全体成员'.indexOf(qq) === 0) return true;
            return false;
        }

        function communityGetFilteredMentionList(query) {
            const q = String(query || '').trim().toLowerCase();
            const list = Array.isArray(communityChatRosterMembersList) ? communityChatRosterMembersList : [];
            const members = list
                .map(function (m) {
                    const bindingId = String(m && m.bindingId != null ? m.bindingId : '').trim();
                    return {
                        bindingId,
                        avatarUrl: m && m.avatarUrl != null ? m.avatarUrl : null,
                    };
                })
                .filter(function (x) {
                    return x.bindingId && (!q || x.bindingId.toLowerCase().indexOf(q) !== -1);
                });
            const showEveryone =
                communityChatKind === 'fleet' &&
                sessionIsCommunityStaff() &&
                communityMentionShowEveryoneOption(q);
            if (showEveryone) {
                members.unshift({ bindingId: '__ALL_MEMBERS__', avatarUrl: null, isAll: true });
            }
            return members;
        }

        function renderCommunityChatMentionPicker(items) {
            const pop = document.getElementById('communityChatMentionPop');
            if (!pop) return;
            pop.innerHTML = '';
            if (!items.length) {
                pop.hidden = true;
                communityMentionUI.open = false;
                return;
            }
            items.forEach(
                function (it, idx) {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'community-chat-mention-pop__item';
                    if (it.isAll) b.classList.add('community-chat-mention-pop__item--all');
                    b.setAttribute('role', 'option');
                    b.setAttribute('aria-selected', idx === communityMentionUI.activeIdx ? 'true' : 'false');
                    if (idx === communityMentionUI.activeIdx) b.classList.add('is-active');
                    const av = document.createElement('span');
                    av.className = 'community-chat-mention-pop__avatar';
                    av.setAttribute('aria-hidden', 'true');
                    const img = document.createElement('img');
                    img.className = 'community-chat-mention-pop__avatar-img';
                    img.alt = '';
                    if (it.isAll) {
                        img.src = communityAvatarFallbackDataUri('全');
                    } else {
                        const src = communityAvatarSrc(it.avatarUrl);
                        img.src = src || communityAvatarFallbackDataUri(communityAuthorInitial(it.bindingId));
                    }
                    av.appendChild(img);
                    const lab = document.createElement('span');
                    lab.className = 'community-chat-mention-pop__label';
                    lab.textContent = it.isAll ? '@全体成员' : '@' + it.bindingId;
                    b.appendChild(av);
                    b.appendChild(lab);
                    b.addEventListener('mousedown', function (e) {
                        e.preventDefault();
                    });
                    b.addEventListener('click', function () {
                        insertCommunityChatMention(it.isAll ? '__ALL_MEMBERS__' : it.bindingId);
                    });
                    pop.appendChild(b);
                }
            );
            closeCommunityChatEmojiPicker();
            pop.hidden = false;
            communityMentionUI.open = true;
        }

        function insertCommunityChatMention(bindingId) {
            const input = document.getElementById('communityChatInput');
            if (!input) return;
            const bid = String(bindingId || '').trim();
            if (!bid) return;
            const v = input.value;
            const pos = input.selectionStart != null ? input.selectionStart : v.length;
            const start = communityMentionUI.atStart >= 0 ? communityMentionUI.atStart : v.lastIndexOf('@');
            if (start < 0) return;
            const before = v.slice(0, start);
            const after = v.slice(pos);
            const insert = bid === '__ALL_MEMBERS__' ? '@全体成员 ' : '@' + bid + ' ';
            input.value = before + insert + after;
            const np = before.length + insert.length;
            try {
                input.setSelectionRange(np, np);
            } catch (ignore) {}
            closeCommunityChatMentionPicker();
            input.focus();
        }

        function syncCommunityChatMentionFromInput() {
            const input = document.getElementById('communityChatInput');
            if (!input || input.disabled) {
                closeCommunityChatMentionPicker();
                return;
            }
            const v = input.value;
            const pos = input.selectionStart != null ? input.selectionStart : v.length;
            let i = pos - 1;
            while (i >= 0 && v.charAt(i) !== '\n' && v.charAt(i) !== ' ') {
                i--;
            }
            const segStart = i + 1;
            const seg = v.slice(segStart, pos);
            if (seg.charAt(0) !== '@') {
                closeCommunityChatMentionPicker();
                return;
            }
            const q = seg.slice(1);
            if (q.indexOf(' ') !== -1 || q.indexOf('@') !== -1) {
                closeCommunityChatMentionPicker();
                return;
            }
            communityMentionUI.atStart = segStart;
            communityMentionUI.query = q;
            const items = communityGetFilteredMentionList(q);
            communityMentionUI.filtered = items;
            if (!items.length) {
                closeCommunityChatMentionPicker();
                return;
            }
            if (communityMentionUI.activeIdx >= items.length) communityMentionUI.activeIdx = 0;
            renderCommunityChatMentionPicker(items);
        }

        const COMMUNITY_URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
        const COMMUNITY_EMOJI_GLYPH_RE = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;

        function communityChatTextIsEmojiOnly(text) {
            const s = String(text || '').trim();
            if (!s) return false;
            return !/[^\s\p{Extended_Pictographic}\u200d\ufe0f]/u.test(s);
        }

        function appendCommunityTextWithEmojiSpans(parent, text) {
            const raw = String(text != null ? text : '');
            if (!raw) return;
            let lastIndex = 0;
            COMMUNITY_EMOJI_GLYPH_RE.lastIndex = 0;
            let match;
            while ((match = COMMUNITY_EMOJI_GLYPH_RE.exec(raw)) !== null) {
                if (match.index > lastIndex) {
                    parent.appendChild(document.createTextNode(raw.slice(lastIndex, match.index)));
                }
                const span = document.createElement('span');
                span.className = 'community-chat-emoji-glyph';
                span.textContent = match[0];
                parent.appendChild(span);
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < raw.length) {
                parent.appendChild(document.createTextNode(raw.slice(lastIndex)));
            }
        }

        function appendCommunityChatTextWithLinks(parent, text) {
            const raw = String(text != null ? text : '');
            if (!raw) return;
            let lastIndex = 0;
            COMMUNITY_URL_RE.lastIndex = 0;
            let match;
            while ((match = COMMUNITY_URL_RE.exec(raw)) !== null) {
                if (match.index > lastIndex) {
                    appendCommunityTextWithEmojiSpans(parent, raw.slice(lastIndex, match.index));
                }
                const href = normalizeCommunityUrl(match[0]);
                if (href && /^https?:\/\//i.test(href)) {
                    const bvid = extractBilibiliBvid(href);
                    if (bvid && /bilibili\.com\/video\//i.test(href)) {
                        appendCommunityChatVideoEmbed(parent, bvid);
                    } else {
                        const link = document.createElement('a');
                        link.className = 'community-text-link';
                        link.href = href;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = match[0];
                        parent.appendChild(link);
                    }
                } else {
                    appendCommunityTextWithEmojiSpans(parent, match[0]);
                }
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < raw.length) {
                appendCommunityTextWithEmojiSpans(parent, raw.slice(lastIndex));
            }
        }

        function normalizeCommunityUrl(url) {
            return String(url || '').replace(/[.,;:!?，。；：！？、）」』\]]+$/u, '');
        }

        function extractBilibiliBvid(url) {
            const u = normalizeCommunityUrl(String(url || ''));
            let m = u.match(/\/video\/(BV[1-9A-HJ-NP-Za-km-z]{10})/i);
            if (m) return m[1];
            m = u.match(/[?&]bvid=(BV[1-9A-HJ-NP-Za-km-z]{10})/i);
            return m ? m[1] : null;
        }

        function extractBilibiliShareUrl(text) {
            const raw = String(text != null ? text : '');
            const m =
                raw.match(/https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/[^\s<>"']+/i) ||
                raw.match(/https?:\/\/b23\.tv\/[^\s<>"']+/i);
            return m ? normalizeCommunityUrl(m[0]) : null;
        }

        function communityBilibiliStreamUrl(bvid) {
            const base =
                (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
            return String(base).replace(/\/$/, '') + '/api/bilibili/hero-stream?bvid=' + encodeURIComponent(bvid);
        }

        function insertTextAtCommunityChatInput(text) {
            const input = document.getElementById('communityChatInput');
            if (!input) return;
            const insert = String(text != null ? text : '');
            const v = String(input.value || '');
            const start = input.selectionStart != null ? input.selectionStart : v.length;
            const end = input.selectionEnd != null ? input.selectionEnd : start;
            input.value = v.slice(0, start) + insert + v.slice(end);
            const np = start + insert.length;
            try {
                input.setSelectionRange(np, np);
            } catch (ignore) {}
            input.focus();
            syncCommunityChatMentionFromInput();
        }

        function appendCommunityChatVideoEmbed(parent, bvid) {
            const wrap = document.createElement('div');
            wrap.className = 'community-chat-video';
            const video = document.createElement('video');
            video.className = 'community-chat-video-player';
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.src = communityBilibiliStreamUrl(bvid);
            wrap.appendChild(video);
            parent.appendChild(wrap);
        }

        function buildCommunityChatImageCell(rel) {
            const fullSrc = resolveCommunityAssetUrl(rel);
            const thumbSrc = resolveCommunityThumbUrl(rel);
            const wrap = document.createElement('div');
            wrap.className = 'community-chat-img-wrap community-chat-img-wrap--censored';

            const im = document.createElement('img');
            im.className = 'community-chat-img';
            im.decoding = 'async';
            im.alt = '聊天图片';
            im.src =
                'data:image/svg+xml,' +
                encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3" preserveAspectRatio="none"><rect width="4" height="3" fill="#1a2834"/></svg>'
                );
            im.dataset.src = thumbSrc;
            im.dataset.fullSrc = fullSrc;

            const mask = document.createElement('button');
            mask.type = 'button';
            mask.className = 'community-chat-img-reveal';
            mask.setAttribute('aria-label', '点击查看图片');
            mask.innerHTML =
                '<svg class="community-chat-img-reveal-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">' +
                '<path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>' +
                '</svg>';

            function revealImage(ev) {
                if (ev) ev.stopPropagation();
                if (window.UssLazyMedia) window.UssLazyMedia.loadNow(im);
                else if (im.dataset.src) {
                    im.src = im.dataset.src;
                    delete im.dataset.src;
                }
                wrap.classList.remove('community-chat-img-wrap--censored');
                if (mask.parentNode) mask.remove();
            }

            mask.addEventListener('click', revealImage);
            im.addEventListener('click', function (e) {
                if (wrap.classList.contains('community-chat-img-wrap--censored')) {
                    revealImage(e);
                    return;
                }
                e.stopPropagation();
                const full = im.dataset.fullSrc || im.src;
                openCommunityImageLightbox(full);
            });

            wrap.appendChild(im);
            wrap.appendChild(mask);
            return wrap;
        }

        function appendCommunityTextWithLinks(parent, text) {
            const raw = String(text != null ? text : '');
            if (!raw) return;
            let lastIndex = 0;
            COMMUNITY_URL_RE.lastIndex = 0;
            let match;
            while ((match = COMMUNITY_URL_RE.exec(raw)) !== null) {
                if (match.index > lastIndex) {
                    parent.appendChild(document.createTextNode(raw.slice(lastIndex, match.index)));
                }
                const href = normalizeCommunityUrl(match[0]);
                if (href && /^https?:\/\//i.test(href)) {
                    const bvid = extractBilibiliBvid(href);
                    if (bvid && /bilibili\.com\/video\//i.test(href)) {
                        appendCommunityChatVideoEmbed(parent, bvid);
                    } else {
                        const link = document.createElement('a');
                        link.className = 'community-text-link';
                        link.href = href;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = match[0];
                        parent.appendChild(link);
                    }
                } else {
                    parent.appendChild(document.createTextNode(match[0]));
                }
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < raw.length) {
                parent.appendChild(document.createTextNode(raw.slice(lastIndex)));
            }
        }

        function applyCommunityPlainTextWithLinks(el, text) {
            while (el.firstChild) el.removeChild(el.firstChild);
            appendCommunityTextWithLinks(el, text);
        }

        function applyCommunityChatTextWithMentions(el, text, mentionBindingIds, mentionEveryone) {
            while (el.firstChild) el.removeChild(el.firstChild);
            const raw = String(text != null ? text : '');
            const mentionAll = !!mentionEveryone;
            const set = new Set(
                (Array.isArray(mentionBindingIds) ? mentionBindingIds : []).map(function (x) {
                    return String(x || '')
                        .trim()
                        .toLowerCase();
                }).filter(Boolean)
            );
            const parts = raw.split(/(@全体成员|@[^\s@]+)/g);
            for (let pi = 0; pi < parts.length; pi++) {
                const part = parts[pi];
                if (part === '@全体成员' && mentionAll) {
                    const span = document.createElement('span');
                    span.className = 'community-chat-mention';
                    span.textContent = part;
                    el.appendChild(span);
                } else if (
                    part.length > 1 &&
                    part.charAt(0) === '@' &&
                    part !== '@全体成员' &&
                    set.has(part.slice(1).toLowerCase())
                ) {
                    const span = document.createElement('span');
                    span.className = 'community-chat-mention';
                    span.textContent = part;
                    el.appendChild(span);
                } else if (part) {
                    appendCommunityChatTextWithLinks(el, part);
                }
            }
        }

        function showCommunityMentionToast(fromHandle, channelLabel, snippet) {
            const el = document.getElementById('communityMentionToast');
            if (!el) return;
            const sn = String(snippet || '').trim().slice(0, 120);
            el.textContent =
                String(channelLabel || '聊天') +
                '：' +
                String(fromHandle || '成员') +
                ' 提到了你' +
                (sn ? '：' + sn : '');
            el.hidden = false;
            if (el._communityMentionT) clearTimeout(el._communityMentionT);
            el._communityMentionT = setTimeout(function () {
                el.hidden = true;
            }, 7000);
            try {
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('舰员交流 · ' + String(channelLabel || '聊天'), {
                        body: String(fromHandle || '成员') + ' @了你' + (sn ? '：' + sn : ''),
                        tag: 'ussmax-mention-' + String(fromHandle || '') + '-' + String(snippet || '').slice(0, 20),
                    });
                } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                    Notification.requestPermission().catch(function () {});
                }
            } catch (ignore) {}
        }

        function maybeNotifyCommunityChatMention(m, chatKind) {
            if (!m || communityChatMessageIsMine(m)) return;
            const sess = loadAuthSession();
            if (!sess || !sess.bindingId) return;
            const me = String(sess.bindingId)
                .trim()
                .toLowerCase();
            const ids = Array.isArray(m.mentionBindingIds) ? m.mentionBindingIds : [];
            if (!ids.length) return;
            const hit = ids.some(function (id) {
                return String(id || '')
                    .trim()
                    .toLowerCase() === me;
            });
            if (!hit) return;
            const kind = chatKind || 'fleet';
            const key = kind + ':' + String(m.seq) + ':' + String(m.id || '');
            if (communityMentionNotifiedKeys.has(key)) return;
            communityMentionNotifiedKeys.add(key);
            if (communityMentionNotifiedKeys.size > 400) {
                communityMentionNotifiedKeys.clear();
                communityMentionNotifiedKeys.add(key);
            }
            const from = String(m.bindingId || '').trim() || '成员';
            const label = kind === 'dm' ? '私信' : '舰队聊天';
            const snippet = String(m.text != null ? m.text : '').trim();
            showCommunityMentionToast(from, label, snippet);
        }

        function setCommunityChatHint(msg) {
            const el = document.getElementById('communityChatHint');
            if (el) el.textContent = msg || '';
        }

        function clearCommunityFormHint() {
            const el = document.getElementById('communityFormHint');
            if (el) el.textContent = '';
        }

        function setCommunityFormHint(msg) {
            const el = document.getElementById('communityFormHint');
            if (el) el.textContent = msg || '';
        }

        function renderCommunityPreviews() {
            const row = document.getElementById('communityPreviewRow');
            if (!row) return;
            row.innerHTML = '';
            communityPendingImages.forEach(function (item, idx) {
                const wrap = document.createElement('div');
                wrap.className = 'community-preview-tile';
                const img = document.createElement('img');
                img.src = item.previewUrl;
                img.alt = item.name || '预览';
                img.style.cursor = 'pointer';
                img.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openCommunityImageLightbox(img.src);
                });
                const rm = document.createElement('button');
                rm.type = 'button';
                rm.className = 'community-preview-remove';
                rm.setAttribute('aria-label', '移除图片');
                rm.textContent = '×';
                rm.addEventListener('click', function () {
                    try {
                        URL.revokeObjectURL(item.previewUrl);
                    } catch (e) {
                        /* ignore */
                    }
                    communityPendingImages.splice(idx, 1);
                    renderCommunityPreviews();
                });
                wrap.appendChild(img);
                wrap.appendChild(rm);
                row.appendChild(wrap);
            });
        }

        function clearCommunityChatPendingImages() {
            communityChatPendingImages.forEach(function (x) {
                try {
                    URL.revokeObjectURL(x.previewUrl);
                } catch (e) {
                    /* ignore */
                }
            });
            communityChatPendingImages = [];
            renderCommunityChatPreviews();
        }

        function renderCommunityChatPreviews() {
            const row = document.getElementById('communityChatPreviewRow');
            if (!row) return;
            row.innerHTML = '';
            communityChatPendingImages.forEach(function (item, idx) {
                const wrap = document.createElement('div');
                wrap.className = 'community-preview-tile';
                const img = document.createElement('img');
                img.src = item.previewUrl;
                img.alt = item.name || '预览';
                img.style.cursor = 'pointer';
                img.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openCommunityImageLightbox(img.src);
                });
                const rm = document.createElement('button');
                rm.type = 'button';
                rm.className = 'community-preview-remove';
                rm.setAttribute('aria-label', '移除图片');
                rm.textContent = '×';
                rm.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    try {
                        URL.revokeObjectURL(item.previewUrl);
                    } catch (e) {
                        /* ignore */
                    }
                    communityChatPendingImages.splice(idx, 1);
                    renderCommunityChatPreviews();
                });
                wrap.appendChild(img);
                wrap.appendChild(rm);
                row.appendChild(wrap);
            });
        }

        async function ingestCommunityChatFiles(files, fromClipboard) {
            if (!isLoggedIn()) {
                setCommunityChatHint('请先登录后再添加图片。');
                return;
            }
            const list = files && files.length ? Array.from(files) : [];
            if (!list.length) return;
            clearCommunityChatHint();
            for (let i = 0; i < list.length; i += 1) {
                if (communityChatPendingImages.length >= COMMUNITY_MAX_IMAGES) {
                    setCommunityChatHint('已达到 6 张上限。');
                    break;
                }
                const f = list[i];
                const mime = String(f.type || '').toLowerCase();
                const mimeOk = !mime || mime.indexOf('image/') === 0
                    || (fromClipboard && mime === 'application/octet-stream');
                if (!mimeOk) {
                    setCommunityChatHint('仅支持图片文件。');
                    continue;
                }
                if (!mime && !fromClipboard) {
                    setCommunityChatHint('仅支持图片文件。');
                    continue;
                }
                if (f.size > COMMUNITY_MAX_IMAGE_BYTES) {
                    setCommunityChatHint('单张图片须 ≤5MB，请压缩后重试。');
                    continue;
                }
                try {
                    const dataUrl = await readFileAsDataURL(f);
                    const previewUrl = URL.createObjectURL(f);
                    communityChatPendingImages.push({
                        name: f.name,
                        dataUrl: dataUrl,
                        previewUrl: previewUrl,
                    });
                } catch (e) {
                    setCommunityChatHint(safeUserFacingMessage(e));
                }
            }
            renderCommunityChatPreviews();
        }

        async function onCommunityChatFilesSelected(ev) {
            const input = ev.target;
            const files = input && input.files ? Array.from(input.files) : [];
            await ingestCommunityChatFiles(files);
            if (input) input.value = '';
        }

        function readFileAsDataURL(file) {
            return new Promise(function (resolve, reject) {
                const fr = new FileReader();
                fr.onload = function () {
                    resolve(String(fr.result || ''));
                };
                fr.onerror = function () {
                    reject(new Error('读取文件失败'));
                };
                fr.readAsDataURL(file);
            });
        }

        async function ingestCommunityPostFiles(files) {
            if (!isLoggedIn()) {
                setCommunityFormHint('请先登录后再添加图片。');
                return;
            }
            const list = files && files.length ? Array.from(files) : [];
            if (!list.length) return;
            clearCommunityFormHint();
            for (let i = 0; i < list.length; i += 1) {
                if (communityPendingImages.length >= COMMUNITY_MAX_IMAGES) {
                    setCommunityFormHint('已达到 6 张上限。');
                    break;
                }
                const f = list[i];
                if (!f.type || f.type.indexOf('image/') !== 0) {
                    setCommunityFormHint('仅支持图片文件。');
                    continue;
                }
                if (f.size > COMMUNITY_MAX_IMAGE_BYTES) {
                    setCommunityFormHint('单张图片须 ≤5MB，请压缩后重试。');
                    continue;
                }
                try {
                    const dataUrl = await readFileAsDataURL(f);
                    const previewUrl = URL.createObjectURL(f);
                    communityPendingImages.push({
                        name: f.name,
                        dataUrl: dataUrl,
                        previewUrl: previewUrl,
                    });
                } catch (e) {
                    setCommunityFormHint(safeUserFacingMessage(e));
                }
            }
            renderCommunityPreviews();
        }

        async function onCommunityFilesSelected(ev) {
            const input = ev.target;
            const files = input && input.files ? Array.from(input.files) : [];
            await ingestCommunityPostFiles(files);
            if (input) input.value = '';
        }

        function formatCommunityTime(iso) {
            try {
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return '';
                return new Intl.DateTimeFormat('zh-CN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                }).format(d);
            } catch (e) {
                return '';
            }
        }

        function shouldShowCommunityChatTimeDivider(prevIso, curIso) {
            if (!curIso) return false;
            if (!prevIso) return true;
            const prev = new Date(prevIso);
            const cur = new Date(curIso);
            if (Number.isNaN(prev.getTime()) || Number.isNaN(cur.getTime())) return false;
            if (prev.toDateString() !== cur.toDateString()) return true;
            return prev.getHours() !== cur.getHours();
        }

        function formatCommunityChatTimeDivider(iso) {
            try {
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return '';
                const now = new Date();
                const timeStr = new Intl.DateTimeFormat('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }).format(d);
                if (d.toDateString() === now.toDateString()) return timeStr;
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                if (d.toDateString() === yesterday.toDateString()) return '昨天 ' + timeStr;
                if (d.getFullYear() === now.getFullYear()) {
                    return new Intl.DateTimeFormat('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                    }).format(d);
                }
                return formatCommunityTime(iso);
            } catch (e) {
                return '';
            }
        }

        function buildCommunityChatTimeDivider(iso) {
            const el = document.createElement('div');
            el.className = 'community-chat-time-divider';
            el.setAttribute('role', 'separator');
            el.textContent = formatCommunityChatTimeDivider(iso);
            return el;
        }

        function communityChatPinPreviewText(m) {
            if (!m) return '置顶消息';
            const t = String(m.text != null ? m.text : '')
                .trim()
                .replace(/\s+/g, ' ');
            if (t) return t;
            if (Array.isArray(m.images) && m.images.length) return '[图片]';
            return '置顶消息';
        }

        function renderCommunityChatPinBar(pinned) {
            const bar = document.getElementById('communityChatPinBar');
            const textEl = document.getElementById('communityChatPinBarText');
            const unpinBtn = document.getElementById('communityChatPinUnpinBtn');
            if (!bar || !textEl) return;
            communityChatPinned = pinned || null;
            if (communityChatKind !== 'fleet' || !pinned || !pinned.message) {
                bar.hidden = true;
                if (unpinBtn) unpinBtn.hidden = true;
                return;
            }
            const msg = pinned.message;
            const who = msg.bindingId ? String(msg.bindingId) + '：' : '';
            textEl.textContent = who + communityChatPinPreviewText(msg);
            bar.hidden = false;
            if (unpinBtn) unpinBtn.hidden = !sessionIsCommunityStaff();
        }

        function getCommunityChatInitialRenderCount() {
            const sc = getCommunityChatScrollEl();
            const h = sc && sc.clientHeight > 0 ? sc.clientHeight : 480;
            return Math.max(16, Math.min(48, Math.ceil(h / 72) + 8));
        }

        function resetCommunityChatLazyState() {
            communityChatBufferedMessages = [];
            communityChatBufferedLineKind = 'fleet';
            communityChatRenderedCount = 0;
            communityChatHistoryLoading = false;
        }

        function removeCommunityChatHistorySentinel(log) {
            if (!log) return;
            const sentinel = log.querySelector('.community-chat-history-sentinel');
            if (sentinel) sentinel.remove();
        }

        function ensureCommunityChatHistorySentinel(log) {
            if (!log) return null;
            let sentinel = log.querySelector('.community-chat-history-sentinel');
            if (!sentinel) {
                sentinel = document.createElement('div');
                sentinel.className = 'community-chat-history-sentinel';
                sentinel.setAttribute('role', 'status');
                sentinel.textContent = '向上滚动加载更早消息…';
                log.insertBefore(sentinel, log.firstChild);
            }
            observeCommunityChatHistorySentinel();
            return sentinel;
        }

        function observeCommunityChatHistorySentinel() {
            if (!communityChatHistoryObserver) return;
            const log = document.getElementById('communityChatLog');
            if (!log) return;
            const sentinel = log.querySelector('.community-chat-history-sentinel');
            communityChatHistoryObserver.disconnect();
            if (sentinel) communityChatHistoryObserver.observe(sentinel);
        }

        function mountCommunityChatMessageNodes(log, messages, startIdx, endIdx, lineKind, insertBeforeNode) {
            if (!log || !messages || startIdx >= endIdx) return;
            let prev = startIdx > 0 ? messages[startIdx - 1].createdAt : null;
            const frag = document.createDocumentFragment();
            for (let i = startIdx; i < endIdx; i++) {
                const m = messages[i];
                if (!m || m.seq == null) continue;
                if (shouldShowCommunityChatTimeDivider(prev, m.createdAt)) {
                    frag.appendChild(buildCommunityChatTimeDivider(m.createdAt));
                }
                frag.appendChild(buildCommunityChatLine(m, lineKind));
                prev = m.createdAt;
            }
            if (insertBeforeNode) log.insertBefore(frag, insertBeforeNode);
            else log.appendChild(frag);
        }

        function prependOlderCommunityChatMessages() {
            const log = document.getElementById('communityChatLog');
            if (!log || communityChatHistoryLoading) return false;
            const total = communityChatBufferedMessages.length;
            if (communityChatRenderedCount >= total) {
                removeCommunityChatHistorySentinel(log);
                return false;
            }
            communityChatHistoryLoading = true;
            const batch = Math.min(COMMUNITY_CHAT_HISTORY_BATCH, total - communityChatRenderedCount);
            const endIdx = total - communityChatRenderedCount;
            const startIdx = endIdx - batch;
            const sc = getCommunityChatScrollEl();
            const prevHeight = sc ? sc.scrollHeight : 0;
            const sentinel = log.querySelector('.community-chat-history-sentinel');
            mountCommunityChatMessageNodes(
                log,
                communityChatBufferedMessages,
                startIdx,
                endIdx,
                communityChatBufferedLineKind,
                sentinel || log.firstChild
            );
            communityChatRenderedCount += batch;
            if (startIdx <= 0) removeCommunityChatHistorySentinel(log);
            else observeCommunityChatHistorySentinel();
            if (sc) {
                const delta = sc.scrollHeight - prevHeight;
                if (delta > 0) sc.scrollTop += delta;
            }
            bindCommunityChatAvatars(log, { eagerLast: 0 });
            communityChatHistoryLoading = false;
            return true;
        }

        function revealCommunityChatMessageById(messageId, chatKind, done) {
            const log = document.getElementById('communityChatLog');
            if (!log) {
                if (done) done(null);
                return;
            }
            const kind = chatKind || 'fleet';
            function findLine() {
                return log.querySelector(
                    '.community-chat-line[data-id="' + String(messageId) + '"][data-chat-kind="' + kind + '"]'
                );
            }
            function step() {
                const line = findLine();
                if (line) {
                    if (done) done(line);
                    return;
                }
                if (communityChatRenderedCount >= communityChatBufferedMessages.length) {
                    if (done) done(null);
                    return;
                }
                prependOlderCommunityChatMessages();
                requestAnimationFrame(step);
            }
            step();
        }

        function scrollToCommunityChatMessage(messageId) {
            if (!messageId) return;
            revealCommunityChatMessageById(messageId, 'fleet', function (line) {
                if (!line) {
                    setCommunityChatHint('原消息已不存在或不在当前列表中');
                    return;
                }
                clearCommunityChatHint();
                line.scrollIntoView({ behavior: 'smooth', block: 'center' });
                line.classList.add('community-chat-line--highlight');
                window.setTimeout(function () {
                    line.classList.remove('community-chat-line--highlight');
                }, 2200);
            });
        }

        async function handleCommunityChatUnpin(chatKind) {
            if (chatKind !== 'fleet' || !window.UssAuthApi) return;
            if (!sessionIsCommunityStaff()) return;
            const sess = loadAuthSession();
            if (!sess || !sess.token) {
                setCommunityChatHint('请先登录。');
                return;
            }
            clearCommunityChatHint();
            try {
                const data = await window.UssAuthApi.communityChatPin(sess.token, null);
                renderCommunityChatPinBar(data.pinned || null);
            } catch (e) {
                setCommunityChatHint(safeUserFacingMessage(e));
            }
        }

        async function handleCommunityChatPin(messageId, chatKind) {
            if (chatKind !== 'fleet' || !window.UssAuthApi) return;
            if (!sessionIsCommunityStaff()) return;
            const sess = loadAuthSession();
            if (!sess || !sess.token) {
                setCommunityChatHint('请先登录。');
                return;
            }
            if (!messageId) return;
            clearCommunityChatHint();
            try {
                const data = await window.UssAuthApi.communityChatPin(sess.token, messageId);
                renderCommunityChatPinBar(data.pinned || null);
            } catch (e) {
                setCommunityChatHint(safeUserFacingMessage(e));
            }
        }

        function communityAuthorInitial(bindingId, authorLabel) {
            if (authorLabel) {
                const s = String(authorLabel).trim();
                if (s) return s.charAt(0);
            }
            const s = String(bindingId || '').trim();
            if (s === '__honghou__') return '红';
            if (!s) return '?';
            const ch = s.charAt(0);
            return ch.toUpperCase();
        }

        function communityAvatarSrc(avatarUrl) {
            if (avatarUrl && window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === 'function') {
                const url = window.UssAuthApi.resolveAssetUrl(avatarUrl);
                if (url) return url;
            }
            return window.USS_DEFAULT_AVATAR || 'default-avatar.png';
        }

        function communityResolveAvatarUrl(bindingId, avatarUrl) {
            if (avatarUrl) return avatarUrl;
            if (String(bindingId || '').trim().toLowerCase() === '__honghou__') {
                return window.USS_HONGHOU_AVATAR || '/avatars/honghou.jpg';
            }
            return null;
        }

        function communityAvatarFallbackDataUri(initial) {
            const ch = String(initial || '?').charAt(0).toUpperCase();
            return (
                'data:image/svg+xml,' +
                encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
                        '<circle cx="32" cy="32" r="32" fill="#1e4d6b"/>' +
                        '<text x="32" y="40" text-anchor="middle" font-size="28" fill="#a8d8e8" font-family="sans-serif">' +
                        ch +
                        '</text>' +
                        '</svg>'
                )
            );
        }

        function communityPrepareAvatarImg(img, bindingId, avatarUrl, authorLabel, eager) {
            img.decoding = 'async';
            img.loading = 'lazy';
            const fallback = communityAvatarFallbackDataUri(
                communityAuthorInitial(bindingId, authorLabel)
            );
            const remote = communityAvatarSrc(communityResolveAvatarUrl(bindingId, avatarUrl));
            img.src = fallback;
            if (!remote || remote === fallback) return;
            if (eager || !window.UssLazyMedia) {
                img.src = remote;
                img.dataset.loadedSrc = remote;
                return;
            }
            img.dataset.src = remote;
        }

        function bindCommunityAuthorAvatars(root, opts) {
            if (!root) return;
            const options = opts || {};
            const imgs = root.querySelectorAll('.community-author-avatar-img[data-src]');
            if (!imgs.length) return;
            if (!window.UssLazyMedia) {
                imgs.forEach(function (img) {
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.dataset.loadedSrc = img.dataset.src;
                    }
                });
                return;
            }
            const scrollRoot = options.root != null ? options.root : null;
            const eager = !!options.eager;
            imgs.forEach(function (img) {
                if (eager) window.UssLazyMedia.loadNow(img);
                else {
                    window.UssLazyMedia.observe(img, {
                        root: scrollRoot,
                        rootMargin: options.rootMargin || '200px 0px',
                    });
                }
            });
        }

        function bindCommunityChatAvatars(root, opts) {
            if (!root || !window.UssLazyMedia) return;
            const scroll = getCommunityChatScrollEl();
            const options = opts || {};
            const eagerLast = options.eagerLast != null ? options.eagerLast : 10;
            const lines = root.querySelectorAll('.community-chat-line');
            const startEager = Math.max(0, lines.length - eagerLast);
            lines.forEach(function (line, idx) {
                const eager = idx >= startEager;
                bindCommunityAuthorAvatars(line, {
                    root: scroll,
                    rootMargin: '180px 0px',
                    eager: eager,
                });
            });
            root.querySelectorAll('.community-chat-img[data-src]').forEach(function (img) {
                window.UssLazyMedia.observe(img, { root: scroll, rootMargin: '240px 0px' });
            });
        }

        function bindCommunityChatLineMedia(line, eagerAvatar) {
            if (!line) return;
            bindCommunityAuthorAvatars(line, {
                root: getCommunityChatScrollEl(),
                rootMargin: '180px 0px',
                eager: !!eagerAvatar,
            });
            if (!window.UssLazyMedia) return;
            const scroll = getCommunityChatScrollEl();
            line.querySelectorAll('.community-chat-img[data-src]').forEach(function (img) {
                window.UssLazyMedia.observe(img, { root: scroll, rootMargin: '240px 0px' });
            });
        }

        function communityRsiCitizenProfileUrl(handle) {
            const h = String(handle || '').trim();
            if (!h) return '';
            return 'https://robertsspaceindustries.com/en/citizens/' + encodeURIComponent(h);
        }

        function buildCommunityAuthorRow(
            bindingId,
            avatarUrl,
            createdAt,
            trailingEl,
            avatarRsiHref,
            authorLabel,
            eagerAvatar
        ) {
            const row = document.createElement('div');
            row.className = 'community-author-row';
            const displayName =
                authorLabel != null && String(authorLabel).trim()
                    ? String(authorLabel).trim()
                    : String(bindingId || '—');
            if (String(bindingId || '').trim().toLowerCase() === '__honghou__' || authorLabel) {
                row.classList.add('community-author-row--bot');
            }
            const avWrap = document.createElement('div');
            avWrap.className = 'community-author-avatar';
            const img = document.createElement('img');
            img.className = 'community-author-avatar-img';
            img.alt = displayName + ' 头像';
            communityPrepareAvatarImg(img, bindingId, avatarUrl, authorLabel, !!eagerAvatar);
            const rsi =
                authorLabel || String(bindingId || '').trim().toLowerCase() === '__honghou__'
                    ? ''
                    : typeof avatarRsiHref === 'string' && avatarRsiHref.trim()
                      ? avatarRsiHref.trim()
                      : '';
            if (rsi) {
                const a = document.createElement('a');
                a.className = 'community-author-avatar-link';
                a.href = rsi;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.setAttribute('aria-label', '在 RSI 打开 ' + String(bindingId || '玩家') + ' 的个人页');
                a.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                });
                a.appendChild(img);
                avWrap.appendChild(a);
            } else {
                avWrap.appendChild(img);
            }
            const idEl = document.createElement('span');
            idEl.className = 'community-author-id';
            idEl.textContent = displayName;
            const timeEl = document.createElement('time');
            timeEl.className = 'community-author-time';
            timeEl.dateTime = createdAt || '';
            timeEl.textContent = formatCommunityTime(createdAt);
            row.appendChild(avWrap);
            row.appendChild(idEl);
            row.appendChild(timeEl);
            if (trailingEl) row.appendChild(trailingEl);
            return row;
        }

        const COMMUNITY_CHAT_RECALL_MS = 3 * 60 * 1000;

        function communityChatCanRecall(m) {
            const sess = loadAuthSession();
            if (!sess || !sess.token || !m) return false;
            const mine =
                String(sess.bindingId || '')
                    .trim()
                    .toLowerCase() ===
                String(m.bindingId || '')
                    .trim()
                    .toLowerCase();
            if (!mine) return false;
            const created = new Date(m.createdAt).getTime();
            if (Number.isNaN(created)) return false;
            return Date.now() - created <= COMMUNITY_CHAT_RECALL_MS;
        }

        function getCommunityChatContextOptions(m, chatKind) {
            const staff = sessionIsCommunityStaff();
            const kind = chatKind != null ? chatKind : communityChatKind;
            const canRecall = staff || communityChatCanRecall(m);
            const canDelete = staff;
            const canPin = staff && kind === 'fleet';
            return { canRecall: canRecall, canDelete: canDelete, canPin: canPin };
        }

        function communityChatHasContextActions(m, chatKind) {
            if (!m || !m.id || !isLoggedIn()) return false;
            const opts = getCommunityChatContextOptions(m, chatKind);
            return opts.canRecall || opts.canDelete || opts.canPin;
        }

        let communityChatContextMenuState = null;

        function closeCommunityChatContextMenu() {
            const menu = document.getElementById('communityChatContextMenu');
            if (!menu) return;
            menu.hidden = true;
            communityChatContextMenuState = null;
        }

        function positionCommunityChatContextMenu(menu, clientX, clientY) {
            const pad = 8;
            menu.style.left = clientX + 'px';
            menu.style.top = clientY + 'px';
            const rect = menu.getBoundingClientRect();
            let left = clientX;
            let top = clientY;
            if (rect.right > window.innerWidth - pad) {
                left = Math.max(pad, window.innerWidth - rect.width - pad);
            }
            if (rect.bottom > window.innerHeight - pad) {
                top = Math.max(pad, window.innerHeight - rect.height - pad);
            }
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
        }

        function communityChatGetCopyText(m) {
            return String(m && m.text != null ? m.text : '').trim();
        }

        async function copyCommunityChatMessageText(m) {
            const text = communityChatGetCopyText(m);
            if (!text) return;
            try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    await navigator.clipboard.writeText(text);
                    return;
                }
            } catch (ignore) {}
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            } catch (ignore) {}
        }

        function showCommunityChatContextMenu(ev, m, chatKind) {
            if (!m || !isLoggedIn()) return;
            const copyText = communityChatGetCopyText(m);
            const opts = getCommunityChatContextOptions(m, chatKind);
            const hasStaffActions = opts.canRecall || opts.canDelete || opts.canPin;
            if (!copyText && !hasStaffActions) return;
            const menu = document.getElementById('communityChatContextMenu');
            if (!menu) return;
            const copyBtn = menu.querySelector('[data-action="copy"]');
            const recallBtn = menu.querySelector('[data-action="recall"]');
            const deleteBtn = menu.querySelector('[data-action="delete"]');
            const pinBtn = menu.querySelector('[data-action="pin"]');
            const unpinBtn = menu.querySelector('[data-action="unpin"]');
            if (copyBtn) copyBtn.hidden = !copyText;
            if (recallBtn) recallBtn.hidden = !opts.canRecall;
            if (deleteBtn) deleteBtn.hidden = !opts.canDelete;
            const isThisPinned =
                communityChatPinned &&
                communityChatPinned.messageId &&
                String(communityChatPinned.messageId) === String(m.id);
            if (pinBtn) {
                pinBtn.hidden = !opts.canPin || isThisPinned;
            }
            if (unpinBtn) {
                unpinBtn.hidden = !opts.canPin || !isThisPinned;
            }
            ev.preventDefault();
            ev.stopPropagation();
            communityChatContextMenuState = { m: m, chatKind: chatKind || 'fleet' };
            menu.hidden = false;
            positionCommunityChatContextMenu(menu, ev.clientX, ev.clientY);
        }

        function installCommunityChatContextMenu() {
            const menu = document.getElementById('communityChatContextMenu');
            if (!menu || menu.dataset.wired === '1') return;
            menu.dataset.wired = '1';
            menu.querySelectorAll('[data-action]').forEach(function (btn) {
                btn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    const state = communityChatContextMenuState;
                    const action = btn.getAttribute('data-action');
                    closeCommunityChatContextMenu();
                    if (!state || !state.m) return;
                    if (action === 'copy') {
                        copyCommunityChatMessageText(state.m);
                    } else if (action === 'delete' || action === 'recall') {
                        if (!state.m.id) return;
                        handleCommunityChatDelete(state.m.id, state.chatKind);
                    } else if (action === 'pin') {
                        if (!state.m.id) return;
                        handleCommunityChatPin(state.m.id, state.chatKind);
                    } else if (action === 'unpin') {
                        handleCommunityChatUnpin(state.chatKind);
                    }
                });
            });
            document.addEventListener('click', closeCommunityChatContextMenu);
            document.addEventListener('contextmenu', function (ev) {
                if (!menu.contains(ev.target)) closeCommunityChatContextMenu();
            });
            window.addEventListener('scroll', closeCommunityChatContextMenu, true);
            window.addEventListener('resize', closeCommunityChatContextMenu);
        }

        function installCommunityChatPinBar() {
            const btn = document.getElementById('communityChatPinBarBtn');
            const unpinBtn = document.getElementById('communityChatPinUnpinBtn');
            if (btn && btn.dataset.wired !== '1') {
                btn.dataset.wired = '1';
                btn.addEventListener('click', function () {
                    if (communityChatPinned && communityChatPinned.messageId) {
                        scrollToCommunityChatMessage(communityChatPinned.messageId);
                    }
                });
            }
            if (unpinBtn && unpinBtn.dataset.wired !== '1') {
                unpinBtn.dataset.wired = '1';
                unpinBtn.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    handleCommunityChatUnpin('fleet');
                });
            }
        }

        function showCommunityConfirm(message, options) {
            const opts = options || {};
            return new Promise(function (resolve) {
                const root = document.getElementById('communityConfirmModal');
                const msgEl = document.getElementById('communityConfirmMsg');
                const okBtn = document.getElementById('communityConfirmOk');
                const cancelBtn = document.getElementById('communityConfirmCancel');
                if (!root || !msgEl || !okBtn || !cancelBtn) {
                    resolve(window.confirm(message || '确定？'));
                    return;
                }
                const danger = !!opts.danger;
                msgEl.textContent = message || '确定？';
                okBtn.textContent = danger ? '删除' : '确定';
                cancelBtn.textContent = '取消';
                if (danger) root.classList.add('community-confirm-modal--danger');
                else root.classList.remove('community-confirm-modal--danger');

                function cleanup(result) {
                    root.classList.remove('is-open');
                    root.hidden = true;
                    root.setAttribute('aria-hidden', 'true');
                    document.removeEventListener('keydown', onKey);
                    root.removeEventListener('click', onBackdrop);
                    okBtn.removeEventListener('click', onOk);
                    cancelBtn.removeEventListener('click', onCancel);
                    resolve(result);
                }

                function onOk() {
                    cleanup(true);
                }
                function onCancel() {
                    cleanup(false);
                }
                function onBackdrop(ev) {
                    if (ev.target === root) cleanup(false);
                }
                function onKey(ev) {
                    if (ev.key === 'Escape') cleanup(false);
                }

                root.hidden = false;
                root.classList.add('is-open');
                root.setAttribute('aria-hidden', 'false');
                document.addEventListener('keydown', onKey);
                root.addEventListener('click', onBackdrop);
                okBtn.addEventListener('click', onOk);
                cancelBtn.addEventListener('click', onCancel);
                requestAnimationFrame(function () {
                    okBtn.focus();
                });
            });
        }

        async function handleCommunityChatDelete(messageId, chatKind) {
            if (!messageId || !window.UssAuthApi) return;
            const sess = loadAuthSession();
            if (!sess || !sess.token) {
                setCommunityChatHint('请先登录。');
                return;
            }
            let kind = chatKind;
            if (!kind) {
                const line0 = document.querySelector(
                    '.community-chat-line[data-id="' + String(messageId) + '"]'
                );
                kind = line0 && line0.dataset.chatKind ? line0.dataset.chatKind : 'fleet';
            }
            clearCommunityChatHint();
            try {
                const data =
                    kind === 'dm'
                        ? await window.UssAuthApi.communityDmDelete(sess.token, messageId)
                        : await window.UssAuthApi.communityChatDelete(sess.token, messageId);
                const line = document.querySelector(
                    '.community-chat-line[data-id="' + String(messageId) + '"]'
                );
                if (line) line.remove();
                const log = document.getElementById('communityChatLog');
                if (log && !log.querySelector('.community-chat-line')) {
                    const empty = document.createElement('div');
                    empty.className = 'community-empty';
                    empty.textContent =
                        kind === 'dm'
                            ? '暂无私信，可发文字或图片。'
                            : '暂无消息，可发文字或图片。';
                    log.appendChild(empty);
                }
                if (data && typeof data.maxSeq === 'number') {
                    if (kind === 'dm') communityDmMaxSeq = data.maxSeq;
                    else communityChatMaxSeq = data.maxSeq;
                }
                if (kind === 'fleet' && data && 'pinned' in data) {
                    renderCommunityChatPinBar(data.pinned || null);
                }
            } catch (e) {
                setCommunityChatHint(safeUserFacingMessage(e));
            }
        }

        function communityChatMessageIsMine(m) {
            const sess = loadAuthSession();
            if (!sess || !sess.bindingId || !m) return false;
            return (
                String(sess.bindingId || '')
                    .trim()
                    .toLowerCase() ===
                String(m.bindingId || '')
                    .trim()
                    .toLowerCase()
            );
        }

        function buildCommunityChatLine(m, lineKind) {
            const kind = lineKind != null ? lineKind : communityChatKind;
            const line = document.createElement('div');
            line.className = 'community-chat-line';
            line.dataset.chatKind = kind;
            const isMine = communityChatMessageIsMine(m);
            const isBotLine =
                String(m.bindingId || '').trim().toLowerCase() === '__honghou__' || !!m.authorLabel;
            if (isMine) {
                line.classList.add('community-chat-line--mine');
            } else {
                line.classList.add('community-chat-line--other');
            }
            if (isBotLine) {
                line.classList.add('community-chat-line--bot');
            }
            line.setAttribute('data-seq', String(m.seq));
            if (m.id) line.setAttribute('data-id', String(m.id));
            if (m.createdAt) line.setAttribute('data-created-at', String(m.createdAt));

            const bodyText = String(m.text != null ? m.text : '').trim();
            const imgs = Array.isArray(m.images) ? m.images : [];

            function buildCommunityChatImageGrid() {
                if (!imgs.length) return null;
                const grid = document.createElement('div');
                grid.className = 'community-chat-images';
                imgs.forEach(function (rel) {
                    if (typeof rel !== 'string' || rel.indexOf('/community-uploads/') !== 0) return;
                    grid.appendChild(buildCommunityChatImageCell(rel));
                });
                return grid.childNodes.length ? grid : null;
            }

            const imageGrid = buildCommunityChatImageGrid();
            const mediaOnly = !!imageGrid && !bodyText;
            if (mediaOnly) line.classList.add('community-chat-line--media-only');

            const avatarRsiHref =
                isBotLine || (m.authorLabel != null && String(m.authorLabel).trim())
                    ? ''
                    : communityRsiCitizenProfileUrl(m.bindingId);
            line.appendChild(
                buildCommunityAuthorRow(
                    m.bindingId,
                    m.avatarUrl,
                    m.createdAt,
                    null,
                    avatarRsiHref,
                    m.authorLabel,
                    false
                )
            );
            const bubble = document.createElement('div');
            bubble.className = 'community-chat-bubble';
            if (bodyText) {
                const txt = document.createElement('div');
                txt.className = 'community-chat-text';
                if (communityChatTextIsEmojiOnly(bodyText)) {
                    txt.classList.add('community-chat-text--emoji-only');
                    line.classList.add('community-chat-line--emoji-only');
                }
                applyCommunityChatTextWithMentions(txt, bodyText, m.mentionBindingIds, m.mentionEveryone);
                bubble.appendChild(txt);
            }
            if (imageGrid) bubble.appendChild(imageGrid);
            if (bubble.childNodes.length) line.appendChild(bubble);

            line.addEventListener('contextmenu', function (ev) {
                if (line.classList.contains('community-chat-line--guest-preview')) return;
                showCommunityChatContextMenu(ev, m, kind);
            });

            return line;
        }

        function getLastCommunityChatMessageCreatedAt(log) {
            if (!log) return null;
            const lines = log.querySelectorAll('.community-chat-line[data-created-at]');
            if (!lines.length) return null;
            return lines[lines.length - 1].getAttribute('data-created-at');
        }

        function renderCommunityChatMessagesToLog(log, list, lineKind) {
            if (!log) return;
            log.innerHTML = '';
            resetCommunityChatLazyState();
            communityChatBufferedMessages = (list || []).filter(function (m) {
                return m && m.seq != null;
            });
            communityChatBufferedLineKind = lineKind != null ? lineKind : communityChatKind;
            const total = communityChatBufferedMessages.length;
            if (!total) return;
            const initialCount = Math.min(total, getCommunityChatInitialRenderCount());
            communityChatRenderedCount = initialCount;
            const startIdx = total - initialCount;
            mountCommunityChatMessageNodes(
                log,
                communityChatBufferedMessages,
                startIdx,
                total,
                communityChatBufferedLineKind,
                null
            );
            if (startIdx > 0) ensureCommunityChatHistorySentinel(log);
            bindCommunityChatAvatars(log, { eagerLast: initialCount });
        }

        function syncCommunityFeedLayout(hasPosts) {
            const feed = document.getElementById('communityFeed');
            if (!feed) return;
            feed.classList.toggle('community-feed--has-posts', !!hasPosts);
            feed.classList.toggle('community-feed--empty', !hasPosts);
        }

        function communityPostStableId(p) {
            if (!p || typeof p !== 'object') return '';
            const raw = p.id != null ? p.id : p.postId != null ? p.postId : '';
            return String(raw != null ? raw : '')
                .trim();
        }

        /** 同时使用查询参数与 hash，避免部分宿主环境丢弃 ?id= */
        function communityPostDetailHref(postId) {
            const id = String(postId != null ? postId : '').trim();
            if (!id) return 'community-post.html';
            const enc = encodeURIComponent(id);
            return 'community-post.html?id=' + enc + '#id=' + enc;
        }

        function truncateCommunityPostExcerpt(text, maxLen) {
            const s = String(text || '')
                .trim()
                .replace(/\s+/g, ' ');
            if (!s) return '';
            if (s.length <= maxLen) return s;
            return s.slice(0, maxLen) + '…';
        }

        function resolveCommunityAssetUrl(rel) {
            if (window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === 'function') {
                return window.UssAuthApi.resolveAssetUrl(rel);
            }
            return rel;
        }

        function resolveCommunityThumbUrl(rel) {
            if (window.UssAuthApi && typeof window.UssAuthApi.communityImageThumbUrl === 'function') {
                return window.UssAuthApi.communityImageThumbUrl(rel);
            }
            return resolveCommunityAssetUrl(rel);
        }

        function renderCommunityPosts(posts) {
            const feed = document.getElementById('communityFeed');
            const loading = document.getElementById('communityFeedLoading');
            if (!feed) return;
            if (loading) loading.remove();
            feed.innerHTML = '';
            const hasPosts = !!(posts && posts.length);
            syncCommunityFeedLayout(hasPosts);
            if (!hasPosts) {
                const empty = document.createElement('div');
                empty.className = 'community-empty';
                empty.textContent = '还没有帖子，来做第一条吧。';
                feed.appendChild(empty);
                return;
            }
            posts.forEach(function (p) {
                const pid = communityPostStableId(p);
                if (!pid) return;

                const card = document.createElement('a');
                card.className = 'community-post-card community-post-card--compact';
                card.href = communityPostDetailHref(pid);

                const inner = document.createElement('div');
                inner.className = 'community-post-compact-inner';

                inner.appendChild(
                    buildCommunityAuthorRow(
                        p.bindingId,
                        p.avatarUrl,
                        p.createdAt,
                        null,
                        null,
                        p.authorLabel,
                        true
                    )
                );

                const content = String(p.content || '').trim();
                const imgs = Array.isArray(p.images) ? p.images : [];
                const replies = Array.isArray(p.replies) ? p.replies : [];

                if (content) {
                    const excerpt = document.createElement('p');
                    excerpt.className = 'community-post-compact-excerpt';
                    excerpt.textContent = truncateCommunityPostExcerpt(content, 120);
                    inner.appendChild(excerpt);
                } else if (imgs.length) {
                    const excerpt = document.createElement('p');
                    excerpt.className = 'community-post-compact-excerpt community-post-compact-excerpt--media';
                    excerpt.textContent = '[图片帖子]';
                    inner.appendChild(excerpt);
                }

                const footer = document.createElement('div');
                footer.className = 'community-post-compact-footer';

                const replyBadge = document.createElement('span');
                replyBadge.className = 'community-post-compact-replies';
                replyBadge.textContent = replies.length + ' 条回复';
                footer.appendChild(replyBadge);

                if (imgs.length) {
                    const rel = imgs[0];
                    if (typeof rel === 'string' && rel.indexOf('/community-uploads/') === 0) {
                        const thumb = document.createElement('img');
                        thumb.className = 'community-post-compact-thumb';
                        thumb.loading = 'lazy';
                        thumb.decoding = 'async';
                        thumb.alt = '帖子配图';
                        const thumbUrl = resolveCommunityThumbUrl(rel);
                        if (window.UssLazyMedia) {
                            thumb.src =
                                'data:image/svg+xml,' +
                                encodeURIComponent(
                                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#1a2834"/></svg>'
                                );
                            thumb.dataset.src = thumbUrl;
                        } else {
                            thumb.src = thumbUrl;
                        }
                        footer.appendChild(thumb);
                    }
                }

                const enter = document.createElement('span');
                enter.className = 'community-post-compact-enter';
                enter.textContent = '查看帖子 →';
                footer.appendChild(enter);

                inner.appendChild(footer);
                card.appendChild(inner);
                feed.appendChild(card);
            });
            bindCommunityAuthorAvatars(feed, { eager: true });
            if (window.UssLazyMedia) {
                window.UssLazyMedia.observeAll('.community-post-compact-thumb[data-src]', {
                    rootMargin: '200px 0px',
                }, feed);
            }
        }

        async function loadCommunityPosts() {
            const feed = document.getElementById('communityFeed');
            if (!feed || !window.UssAuthApi) return;
            if (!isLoggedIn()) {
                feed.innerHTML = '';
                syncCommunityFeedLayout(false);
                return;
            }
            const loading = document.getElementById('communityFeedLoading');
            const cached = readCommunityUiCache('posts');
            const hadCache = !!(cached && Array.isArray(cached.posts) && cached.posts.length);
            if (hadCache) {
                renderCommunityPosts(cached.posts);
            } else if (loading) {
                loading.hidden = false;
            }
            try {
                const data = await window.UssAuthApi.communityListPosts(50);
                const posts = data.posts || [];
                renderCommunityPosts(posts);
                writeCommunityUiCache('posts', { posts: posts });
            } catch (e) {
                if (!hadCache) {
                    if (loading) loading.hidden = true;
                    feed.innerHTML = '';
                    syncCommunityFeedLayout(false);
                    const err = document.createElement('div');
                    err.className = 'community-feed-error';
                    err.textContent = safeUserFacingMessage(e);
                    feed.appendChild(err);
                }
            }
        }

        function getCommunityChatScrollEl() {
            return document.getElementById('communityChatScroll');
        }

        function appendCommunityChatLine(m, lineKind) {
            const log = document.getElementById('communityChatLog');
            if (!log || !m || m.seq == null) return;
            if (!isLoggedIn()) return;
            const lk = lineKind != null ? lineKind : communityChatKind;
            const seqKey = String(m.seq);
            if (log.querySelector('.community-chat-line[data-seq="' + seqKey + '"][data-chat-kind="' + lk + '"]')) return;
            const empty = log.querySelector('.community-empty');
            if (empty) empty.remove();
            const prev = getLastCommunityChatMessageCreatedAt(log);
            if (shouldShowCommunityChatTimeDivider(prev, m.createdAt)) {
                log.appendChild(buildCommunityChatTimeDivider(m.createdAt));
            }
            log.appendChild(buildCommunityChatLine(m, lk));
            const line = log.querySelector('.community-chat-line[data-seq="' + seqKey + '"][data-chat-kind="' + lk + '"]');
            bindCommunityChatLineMedia(line, communityChatNearBottom);
        }

        function scrollCommunityChatToBottom(force) {
            const sc = getCommunityChatScrollEl();
            if (!sc) return;
            if (force || communityChatNearBottom) {
                sc.scrollTop = sc.scrollHeight;
            }
        }

        function installCommunityChatScrollGuard() {
            const sc = getCommunityChatScrollEl();
            if (!sc || sc.dataset.communityGuard === '1') return;
            sc.dataset.communityGuard = '1';
            sc.addEventListener('scroll', function () {
                const rest = sc.scrollHeight - sc.clientHeight - sc.scrollTop;
                communityChatNearBottom = rest < 48;
            });
        }

        async function loadCommunityChatFull(opts) {
            opts = opts || {};
            const log = document.getElementById('communityChatLog');
            if (!log || !window.UssAuthApi) return;
            clearCommunityChatHint();
            if (!isLoggedIn()) {
                communityChatMaxSeq = 0;
                return;
            }
            delete log.dataset.guestPreview;
            if (!opts.force) {
                const cached = readCommunityUiCache('chat:fleet');
                if (cached && Array.isArray(cached.messages) && cached.messages.length) {
                    communityChatMaxSeq =
                        typeof cached.maxSeq === 'number' && cached.maxSeq > 0
                            ? cached.maxSeq
                            : 0;
                    renderCommunityChatMessagesToLog(log, cached.messages, 'fleet');
                    renderCommunityChatPinBar(cached.pinned || null);
                    scrollCommunityChatToBottom(true);
                }
            }
            try {
                const hasRenderedFleet = !!log.querySelector(
                    '.community-chat-line[data-chat-kind="fleet"]'
                );
                const afterSeq =
                    opts.force || !hasRenderedFleet || !(communityChatMaxSeq || 0)
                        ? 0
                        : communityChatMaxSeq;
                const data = await window.UssAuthApi.communityChatFetch(afterSeq);
                const list = data.messages || [];
                if (afterSeq > 0) {
                    if (list.length) {
                        list.forEach(function (m) {
                            appendCommunityChatLine(m, 'fleet');
                        });
                        scrollCommunityChatToBottom(false);
                    }
                    if ('pinned' in data) renderCommunityChatPinBar(data.pinned || null);
                } else {
                    log.innerHTML = '';
                    renderCommunityChatPinBar(data.pinned || null);
                    if (!list.length) {
                        const empty = document.createElement('div');
                        empty.className = 'community-empty';
                        empty.textContent = '暂无聊天消息，可发文字或图片。';
                        log.appendChild(empty);
                    } else {
                        renderCommunityChatMessagesToLog(log, list, 'fleet');
                    }
                    scrollCommunityChatToBottom(true);
                }
                if (typeof data.maxSeq === 'number' && data.maxSeq > 0) {
                    communityChatMaxSeq = data.maxSeq;
                }
                const cachedNow = readCommunityUiCache('chat:fleet');
                const merged = mergeCommunityChatCacheMessages(
                    cachedNow && cachedNow.messages ? cachedNow.messages : [],
                    list
                );
                writeCommunityUiCache('chat:fleet', {
                    messages: afterSeq > 0 ? merged : list,
                    maxSeq: communityChatMaxSeq,
                    pinned: 'pinned' in data ? data.pinned || null : cachedNow && cachedNow.pinned,
                });
                markCommunityFleetRead(communityChatMaxSeq);
            } catch (e) {
                if (!log.querySelector('.community-chat-line[data-chat-kind="fleet"]')) {
                    log.innerHTML = '';
                    renderCommunityChatPinBar(null);
                    const err = document.createElement('div');
                    err.className = 'community-feed-error';
                    err.textContent = safeUserFacingMessage(e);
                    log.appendChild(err);
                }
            }
        }

        async function loadCommunityDmFull() {
            const log = document.getElementById('communityChatLog');
            if (!log || !window.UssAuthApi) return;
            clearCommunityChatHint();
            if (!isLoggedIn() || communityChatKind !== 'dm' || !communityChatDmPeer) {
                if (isLoggedIn()) {
                    log.innerHTML = '';
                }
                communityDmMaxSeq = 0;
                return;
            }
            delete log.dataset.guestPreview;
            const sess = loadAuthSession();
            if (!sess || !sess.token) return;
            try {
                const data = await window.UssAuthApi.communityDmFetch(sess.token, communityChatDmPeer, 0);
                log.innerHTML = '';
                communityDmMaxSeq =
                    typeof data.maxSeq === 'number' && data.maxSeq > 0 ? data.maxSeq : 0;
                renderCommunityChatPinBar(null);
                const list = data.messages || [];
                if (!list.length) {
                    const empty = document.createElement('div');
                    empty.className = 'community-empty';
                    empty.textContent = '暂无私信，可发文字或图片。';
                    log.appendChild(empty);
                } else {
                    renderCommunityChatMessagesToLog(log, list, 'dm');
                }
                scrollCommunityChatToBottom(true);
                if (communityChatDmPeer) {
                    markCommunityDmPeerRead(communityChatDmPeer, communityDmMaxSeq);
                }
            } catch (e) {
                log.innerHTML = '';
                const err = document.createElement('div');
                err.className = 'community-feed-error';
                err.textContent = safeUserFacingMessage(e);
                log.appendChild(err);
            }
        }

        function syncCommunityChatMainTitle() {
            const title = document.getElementById('communityChatMainTitle');
            if (!title) return;
            if (communityChatKind === 'dm' && communityChatDmLabel) {
                title.textContent = '与 ' + communityChatDmLabel + ' 私聊';
            } else {
                title.textContent = '舰队聊天';
            }
        }

        function syncCommunityChatRosterActive() {
            document.querySelectorAll('[data-chat-target]').forEach(function (el) {
                el.classList.remove('is-active');
            });
            if (communityChatKind === 'fleet') {
                const f = document.querySelector('[data-chat-target="fleet"]');
                if (f) f.classList.add('is-active');
            } else if (communityChatKind === 'dm' && communityChatDmPeer) {
                document.querySelectorAll('[data-chat-target="dm"]').forEach(function (el) {
                    if (el.getAttribute('data-peer') === communityChatDmPeer) {
                        el.classList.add('is-active');
                    }
                });
            }
        }

        function applyCommunityRosterSearchFilter(query) {
            const inner = document.getElementById('communityChatRosterInner');
            if (!inner) return;
            const needle = String(query || '').trim().toLowerCase();
            inner.querySelectorAll('.community-chat-roster-peer[data-peer]').forEach(function (row) {
                const peer = String(row.getAttribute('data-peer') || '').toLowerCase();
                const lab = String(row.getAttribute('data-peer-label') || '').toLowerCase();
                const hit = !needle || peer.indexOf(needle) !== -1 || lab.indexOf(needle) !== -1;
                row.hidden = !hit;
            });
        }

        const COMMUNITY_GUEST_ROSTER_PREVIEW = [
            { bindingId: 'Helios-7' },
            { bindingId: 'Vanguard-12' },
            { bindingId: 'Atlas-3' }
        ];

        function renderCommunityChatGuestPreview() {
            const log = document.getElementById('communityChatLog');
            if (!log || isLoggedIn()) return;
            const now = Date.now();
            const samples = [
                {
                    seq: 'guest-preview-1',
                    bindingId: 'Helios-7',
                    text: '今晚舰队巡航还照常吗？',
                    createdAt: new Date(now - 55 * 60000).toISOString()
                },
                {
                    seq: 'guest-preview-2',
                    bindingId: 'Vanguard-12',
                    text: '照常，20:00 在 Pyro 集合。',
                    createdAt: new Date(now - 48 * 60000).toISOString()
                },
                {
                    seq: 'guest-preview-3',
                    bindingId: 'Atlas-3',
                    text: '收到，我带两艘补给船。',
                    createdAt: new Date(now - 41 * 60000).toISOString()
                }
            ];
            log.innerHTML = '';
            log.dataset.guestPreview = '1';
            samples.forEach(function (m) {
                const line = buildCommunityChatLine(m, 'fleet');
                line.classList.add('community-chat-line--guest-preview');
                log.appendChild(line);
            });
            scrollCommunityChatToBottom(true);
        }

        function renderCommunityChatGuestRoster() {
            const inner = document.getElementById('communityChatRosterInner');
            if (!inner || isLoggedIn()) return;
            inner.hidden = false;
            renderCommunityChatRosterFromMembers(COMMUNITY_GUEST_ROSTER_PREVIEW);
        }

        function renderCommunityChatRosterFromMembers(members) {
            const inner = document.getElementById('communityChatRosterInner');
            if (!inner) return;
            const list = sortCommunityRosterMembersForDisplay(members);
            communityChatRosterMembersList = list.slice();
            const sess = loadAuthSession();
            const me = sess && sess.bindingId ? String(sess.bindingId).trim().toLowerCase() : '';
            inner.innerHTML = '';
            const fleetBtn = document.createElement('button');
            fleetBtn.type = 'button';
            fleetBtn.className = 'community-chat-roster-item community-chat-roster-fleet';
            fleetBtn.setAttribute('data-chat-target', 'fleet');
            fleetBtn.textContent = '舰队聊天';
            const fleetBadge = document.createElement('span');
            fleetBadge.className = 'community-chat-unread-badge';
            fleetBadge.setAttribute('aria-hidden', 'true');
            fleetBadge.hidden = true;
            fleetBtn.appendChild(fleetBadge);
            inner.appendChild(fleetBtn);
            let totalInFleet = 0;
            list.forEach(function (mem) {
                const bid0 = mem && mem.bindingId != null ? String(mem.bindingId).trim() : '';
                if (bid0) totalInFleet += 1;
            });
            const sub = document.createElement('div');
            sub.className = 'community-chat-roster-sub';
            sub.textContent = '舰队成员（' + totalInFleet + '）';
            inner.appendChild(sub);
            const search = document.createElement('input');
            search.type = 'search';
            search.id = 'communityChatRosterSearch';
            search.className = 'community-chat-roster-search';
            search.placeholder = '搜索成员…';
            search.setAttribute('autocomplete', 'off');
            search.setAttribute('aria-label', '搜索舰队成员');
            search.value = communityRosterSearchQuery;
            inner.appendChild(search);
            function syncRosterSearchFromInput() {
                communityRosterSearchQuery = search.value;
                applyCommunityRosterSearchFilter(search.value);
            }
            search.addEventListener('input', syncRosterSearchFromInput);
            search.addEventListener('search', syncRosterSearchFromInput);
            list.forEach(function (mem) {
                const bid = mem && mem.bindingId != null ? String(mem.bindingId).trim() : '';
                if (!bid) return;
                if (bid.toLowerCase() === me) return;
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'community-chat-roster-item community-chat-roster-peer';
                row.setAttribute('data-chat-target', 'dm');
                row.setAttribute('data-peer', bid);
                row.setAttribute('data-peer-label', bid);
                const av = document.createElement('span');
                av.className = 'community-chat-roster-avatar';
                const img = document.createElement('img');
                img.className = 'community-chat-roster-avatar-img';
                img.alt = bid;
                communityPrepareAvatarImg(img, bid, mem.avatarUrl, null, false);
                av.appendChild(img);
                const lab = document.createElement('span');
                lab.className = 'community-chat-roster-label';
                lab.textContent = bid;
                row.appendChild(av);
                row.appendChild(lab);
                const dmBadge = document.createElement('span');
                dmBadge.className = 'community-chat-unread-badge community-chat-unread-badge--peer';
                dmBadge.setAttribute('aria-hidden', 'true');
                dmBadge.hidden = true;
                row.appendChild(dmBadge);
                inner.appendChild(row);
            });
            applyCommunityRosterSearchFilter(communityRosterSearchQuery);
            syncCommunityChatRosterActive();
            updateCommunityUnreadBadges();
            if (window.UssLazyMedia) {
                window.UssLazyMedia.observeAll(
                    '.community-chat-roster-avatar-img[data-src]',
                    { root: inner, rootMargin: '160px 0px' },
                    inner
                );
            }
        }

        async function loadCommunityRoster() {
            const inner = document.getElementById('communityChatRosterInner');
            if (!inner) return;
            if (!isLoggedIn() || !window.UssAuthApi) {
                communityRosterSearchQuery = '';
                communityChatRosterMembersList = [];
                return;
            }
            inner.hidden = false;
            try {
                const sess = loadAuthSession();
                if (!sess || !sess.token) throw new Error('未登录');
                await refreshCommunityInboxSnapshot();
                const data = await window.UssAuthApi.communityRoster(sess.token);
                renderCommunityChatRosterFromMembers(data.members || []);
            } catch (e) {
                communityChatRosterMembersList = [];
                inner.innerHTML = '';
                const err = document.createElement('div');
                err.className = 'community-chat-roster-error';
                err.textContent = safeUserFacingMessage(e);
                inner.appendChild(err);
                inner.hidden = false;
            }
        }

        function selectCommunityFleet() {
            communityChatKind = 'fleet';
            communityChatDmPeer = '';
            communityChatDmLabel = '';
            communityDmMaxSeq = 0;
            syncCommunityChatMainTitle();
            syncCommunityChatRosterActive();
            loadCommunityChatFull();
            updateCommunityChatInputPlaceholder();
        }

        function selectCommunityDmPeer(peerBindingId, label) {
            const sess = loadAuthSession();
            const me = sess && sess.bindingId ? String(sess.bindingId).trim().toLowerCase() : '';
            const peer = String(peerBindingId || '').trim();
            if (!peer || peer.toLowerCase() === me) return;
            communityChatKind = 'dm';
            communityChatDmPeer = peer;
            communityChatDmLabel = label || peer;
            communityDmMaxSeq = 0;
            touchCommunityDmPeer(peer);
            reorderCommunityChatRosterPeers();
            syncCommunityChatMainTitle();
            syncCommunityChatRosterActive();
            loadCommunityDmFull();
            updateCommunityChatInputPlaceholder();
        }

        function wireCommunityChatRoster() {
            const host = document.getElementById('communityChatRoster');
            if (!host || host.dataset.rosterWired === '1') return;
            host.dataset.rosterWired = '1';
            host.addEventListener('click', function (ev) {
                const t = ev.target.closest('[data-chat-target]');
                if (!t) return;
                const target = t.getAttribute('data-chat-target');
                if (target === 'fleet') {
                    selectCommunityFleet();
                } else if (target === 'dm') {
                    const peer = t.getAttribute('data-peer');
                    const label = t.getAttribute('data-peer-label') || peer;
                    if (peer) selectCommunityDmPeer(peer, label);
                }
            });
        }

        async function pollCommunityChat() {
            if (!window.UssAuthApi) return { ok: true, skipped: true };
            if (!isLoggedIn()) return { ok: true, skipped: true };
            try {
                const sess = loadAuthSession();
                if (!sess || !sess.token) return { ok: true, skipped: true };

                let curFleet = communityChatMaxSeq || 0;
                if (curFleet === 0 && (communityInboxSnapshot.fleetMaxSeq || 0) > 0) {
                    communityChatMaxSeq = communityInboxSnapshot.fleetMaxSeq;
                    curFleet = communityChatMaxSeq;
                }

                const fleetData = await window.UssAuthApi.communityChatFetch(curFleet);
                const fleetList = fleetData.messages || [];
                if (fleetList.length) {
                    fleetList.forEach(function (m) {
                        maybeNotifyCommunityChatMention(m, 'fleet');
                        if (communityChatKind === 'fleet') {
                            appendCommunityChatLine(m, 'fleet');
                        }
                    });
                    if (communityChatKind === 'fleet') {
                        scrollCommunityChatToBottom(false);
                    }
                }
                if (typeof fleetData.maxSeq === 'number' && fleetData.maxSeq > 0) {
                    communityChatMaxSeq = fleetData.maxSeq;
                }
                if (communityChatKind === 'fleet') {
                    if ('pinned' in fleetData) renderCommunityChatPinBar(fleetData.pinned || null);
                    markCommunityFleetRead(communityChatMaxSeq);
                }

                if (communityChatKind === 'dm' && communityChatDmPeer) {
                    const curDm = communityDmMaxSeq || 0;
                    const data = await window.UssAuthApi.communityDmFetch(
                        sess.token,
                        communityChatDmPeer,
                        curDm
                    );
                    const list = data.messages || [];
                    if (list.length) {
                        list.forEach(function (m) {
                            maybeNotifyCommunityChatMention(m, 'dm');
                            appendCommunityChatLine(m, 'dm');
                        });
                        scrollCommunityChatToBottom(false);
                    }
                    if (typeof data.maxSeq === 'number' && data.maxSeq > 0) {
                        communityDmMaxSeq = data.maxSeq;
                    }
                    markCommunityDmPeerRead(communityChatDmPeer, communityDmMaxSeq);
                }

                return { ok: true };
            } catch (e) {
                if (e && e.status === 429) return { ok: false, rateLimited: true };
                return { ok: true };
            }
        }

        function scheduleNextCommunityChatPoll() {
            if (communityChatPollTimer) clearTimeout(communityChatPollTimer);
            if (!isLoggedIn()) return;
            const sess = loadAuthSession();
            if (!sess || !sess.token) return;
            const delay = communityChatPollBackoffMs || COMMUNITY_CHAT_POLL_MS;
            communityChatPollTimer = setTimeout(runCommunityChatPollTick, delay);
        }

        async function runCommunityChatPollTick() {
            communityChatPollTimer = null;
            if (!isLoggedIn()) return;
            const sess = loadAuthSession();
            if (!sess || !sess.token) return;
            await refreshCommunityInboxSnapshot();
            const result = await pollCommunityChat();
            if (result && result.rateLimited) {
                communityChatPollBackoffMs = Math.min((communityChatPollBackoffMs || 4000) * 2, 90000);
            } else if (result && result.ok && !result.skipped) {
                communityChatPollBackoffMs = 0;
            }
            scheduleNextCommunityChatPoll();
        }

        function stopCommunityChatPoll() {
            if (communityChatPollTimer) {
                clearTimeout(communityChatPollTimer);
                communityChatPollTimer = null;
            }
            communityChatPollBackoffMs = 0;
        }

        function startCommunityChatPoll() {
            stopCommunityChatPoll();
            communityChatPollBackoffMs = 0;
            scheduleNextCommunityChatPoll();
        }

        async function sendCommunityChat() {
            if (!window.UssAuthApi) return;
            clearCommunityChatHint();
            closeCommunityChatMentionPicker();
            closeCommunityChatEmojiPicker();
            const sess = loadAuthSession();
            if (!sess || !sess.token) {
                setCommunityChatHint('请先登录后再发言。');
                return;
            }
            const input = document.getElementById('communityChatInput');
            const text = input ? String(input.value || '').trim() : '';
            const imgs = communityChatPendingImages.map(function (x) {
                return x.dataUrl;
            });
            if (!text && !imgs.length) {
                return;
            }
            if (text.length > COMMUNITY_CHAT_MAX_TEXT) {
                setCommunityChatHint('字数上限，无法发送');
                return;
            }
            const btn = document.getElementById('communityChatSendBtn');
            const chatMenuBtn = document.getElementById('communityChatSendMenuBtn');
            if (btn) btn.disabled = true;
            if (chatMenuBtn) chatMenuBtn.disabled = true;
            try {
                const payload =
                    imgs.length > 0 ? { text: text, images: imgs } : text;
                let data;
                if (communityChatKind === 'dm' && communityChatDmPeer) {
                    data = await window.UssAuthApi.communityDmSend(sess.token, communityChatDmPeer, payload);
                } else {
                    data = await window.UssAuthApi.communityChatSend(sess.token, payload);
                }
                if (input) input.value = '';
                clearCommunityChatPendingImages();
                if (data && data.entry) {
                    appendCommunityChatLine(data.entry, communityChatKind);
                    if (Array.isArray(data.assistantReplies)) {
                        data.assistantReplies.forEach(function (replyRow) {
                            appendCommunityChatLine(replyRow, communityChatKind);
                        });
                    }
                    if (typeof data.maxSeq === 'number' && data.maxSeq > 0) {
                        if (communityChatKind === 'dm') {
                            communityDmMaxSeq = Math.max(communityDmMaxSeq || 0, data.maxSeq);
                            markCommunityDmPeerRead(communityChatDmPeer, communityDmMaxSeq);
                            touchCommunityDmPeer(communityChatDmPeer);
                            reorderCommunityChatRosterPeers();
                        } else {
                            communityChatMaxSeq = Math.max(communityChatMaxSeq || 0, data.maxSeq);
                            markCommunityFleetRead(communityChatMaxSeq);
                        }
                    }
                }
                scrollCommunityChatToBottom(true);
            } catch (e) {
                setCommunityChatHint(formatCommunityChatHintError(e));
            } finally {
                refreshCommunitySessionUi();
            }
        }

        async function refreshCommunityAll() {
            await loadCommunityPosts();
            await loadCommunityRoster();
            if (communityChatKind === 'dm' && communityChatDmPeer) {
                await loadCommunityDmFull();
            } else {
                await loadCommunityChatFull();
            }
        }

        async function submitCommunityPost() {
            if (!window.UssAuthApi) return;
            const sess = loadAuthSession();
            if (!sess || !sess.token) {
                setCommunityFormHint('请先登录。');
                return;
            }
            const ta = document.getElementById('communityText');
            const content = ta ? String(ta.value || '').trim() : '';
            const imgs = communityPendingImages.map(function (x) {
                return x.dataUrl;
            });
            if (!content && !imgs.length) {
                setCommunityFormHint('请填写正文或添加图片。');
                return;
            }
            clearCommunityFormHint();
            const btn = document.getElementById('communitySubmitBtn');
            const postMenuBtn = document.getElementById('communityPostMenuBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '发送中…';
            }
            if (postMenuBtn) postMenuBtn.disabled = true;
            try {
                await window.UssAuthApi.communityCreatePost(sess.token, { content: content, images: imgs });
                if (ta) ta.value = '';
                communityPendingImages.forEach(function (x) {
                    try {
                        URL.revokeObjectURL(x.previewUrl);
                    } catch (e) {
                        /* ignore */
                    }
                });
                communityPendingImages = [];
                renderCommunityPreviews();
                await loadCommunityPosts();
            } catch (e) {
                setCommunityFormHint(safeUserFacingMessage(e));
            } finally {
                refreshCommunitySessionUi();
                if (btn) btn.textContent = '发送帖子';
            }
        }

        function updateCommunityChatInputPlaceholder() {
            const chatInput = document.getElementById('communityChatInput');
            if (chatInput) chatInput.placeholder = '';
        }

        function dataUrlToImageFile(dataUrl) {
            const m = String(dataUrl || '').match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
            if (!m) return null;
            const mime = m[1].toLowerCase();
            if (mime.indexOf('image/') !== 0) return null;
            try {
                const bin = atob(m[2].replace(/\s/g, ''));
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                const ext = mime.indexOf('jpeg') !== -1 || mime.indexOf('jpg') !== -1 ? 'jpg' : 'png';
                return new File([arr], 'pasted-' + Date.now() + '.' + ext, { type: mime });
            } catch (e) {
                return null;
            }
        }

        function collectClipboardImageDataUrls(clipboardData) {
            if (!clipboardData) return [];
            const urls = [];
            const plain = String(clipboardData.getData('text/plain') || '').trim();
            if (plain.indexOf('data:image/') === 0 && urls.indexOf(plain) === -1) urls.push(plain);
            const html = clipboardData.getData('text/html') || '';
            if (!html) return urls;
            const re = /src\s*=\s*["']?(data:image\/[^"'\s>]+)/gi;
            let match;
            while ((match = re.exec(html)) !== null) {
                if (urls.indexOf(match[1]) === -1) urls.push(match[1]);
            }
            return urls;
        }

        function collectClipboardImageFiles(clipboardData) {
            if (!clipboardData) return [];
            const out = [];
            const seen = new Set();

            function pushFile(file) {
                if (!file || !file.size) return;
                const mime = String(file.type || '').toLowerCase();
                if (mime && mime.indexOf('image/') !== 0 && mime !== 'application/octet-stream') return;
                // 剪贴板同一张图常同时出现在 items 与 files，用体积去重即可
                const key = String(file.size);
                if (seen.has(key)) return;
                seen.add(key);
                const outMime = mime.indexOf('image/') === 0 ? mime : 'image/png';
                if (!file.name) {
                    const ext = outMime.indexOf('jpeg') !== -1 || outMime.indexOf('jpg') !== -1 ? 'jpg' : 'png';
                    out.push(new File([file], 'pasted-' + Date.now() + '-' + out.length + '.' + ext, {
                        type: outMime,
                    }));
                } else {
                    out.push(file);
                }
            }

            if (clipboardData.items && clipboardData.items.length) {
                Array.from(clipboardData.items).forEach(function (item) {
                    if (item.kind !== 'file') return;
                    const file = item.getAsFile();
                    if (!file || !file.size) return;
                    const type = String(item.type || file.type || '').toLowerCase();
                    if (type && type.indexOf('image/') !== 0 && type !== 'application/octet-stream') return;
                    pushFile(file);
                });
            } else if (clipboardData.files && clipboardData.files.length) {
                Array.from(clipboardData.files).forEach(pushFile);
            }
            if (!out.length) {
                collectClipboardImageDataUrls(clipboardData).forEach(function (url) {
                    const file = dataUrlToImageFile(url);
                    if (file) pushFile(file);
                });
            }
            return out;
        }

        function handleCommunityChatPaste(ev) {
            if (ev._ussChatPasteHandled) return false;
            const cd = ev.clipboardData;
            if (!cd || !isLoggedIn()) return false;

            const imageFiles = collectClipboardImageFiles(cd);
            if (imageFiles.length) {
                ev._ussChatPasteHandled = true;
                ev.preventDefault();
                ev.stopPropagation();
                ingestCommunityChatFiles(imageFiles, true);
                return true;
            }
            return false;
        }

        function refreshCommunitySessionUi(opts) {
            opts = opts || {};
            const deferNetwork = !!opts.deferNetwork || !window.__ussPageReady;
            const logged = isLoggedIn();
            const hint = document.getElementById('communityAuthHint');
            const ta = document.getElementById('communityText');
            const fileInput = document.getElementById('communityFileInput');
            const postBtn = document.getElementById('communitySubmitBtn');
            const postMenuBtn = document.getElementById('communityPostMenuBtn');
            const chatInput = document.getElementById('communityChatInput');
            const chatBtn = document.getElementById('communityChatSendBtn');
            const chatMenuBtn = document.getElementById('communityChatSendMenuBtn');
            const chatEmojiBtn = document.getElementById('communityChatEmojiBtn');
            const chatFileInput = document.getElementById('communityChatFileInput');
            const guestLock = document.getElementById('communityChatGuestLock');
            const forumGuestLock = document.getElementById('communityForumGuestLock');
            const chatLog = document.getElementById('communityChatLog');

            if (guestLock) guestLock.hidden = !!logged;
            if (forumGuestLock) forumGuestLock.hidden = !!logged;
            if (!logged) {
                closeCommunitySendMenus();
                closeCommunityChatEmojiPicker();
                communityChatMaxSeq = 0;
                communityDmMaxSeq = 0;
                communityChatKind = 'fleet';
                communityChatDmPeer = '';
                communityChatDmLabel = '';
                clearCommunityChatPendingImages();
                communityInboxSnapshot = { fleetMaxSeq: 0, dmMaxByPeer: {} };
                stopCommunityChatPoll();
                syncCommunityChatMainTitle();
            } else {
                if (chatLog) delete chatLog.dataset.guestPreview;
                if (!deferNetwork) {
                    startCommunityChatPoll();
                }
                updateCommunityChatInputPlaceholder();
                if (!deferNetwork) {
                    if (window.UssLazyMedia) {
                        window.UssLazyMedia.runWhenIdle(loadCommunityRoster, 700);
                    } else {
                        setTimeout(loadCommunityRoster, 700);
                    }
                }
            }

            if (hint) hint.hidden = true;
            if (ta) {
                ta.disabled = !logged;
                ta.placeholder = '';
            }
            if (fileInput) fileInput.disabled = !logged;
            if (postMenuBtn) postMenuBtn.disabled = !logged;
            if (postBtn) postBtn.disabled = !logged;
            if (chatInput) {
                chatInput.disabled = !logged;
                updateCommunityChatInputPlaceholder();
            }
            if (chatBtn) chatBtn.disabled = !logged;
            if (chatMenuBtn) chatMenuBtn.disabled = !logged;
            if (chatEmojiBtn) chatEmojiBtn.disabled = !logged;
            if (chatFileInput) chatFileInput.disabled = !logged;
        }

        function closeCommunitySendMenus() {
            var chatMenu = document.getElementById('communityChatSendMenu');
            var postMenu = document.getElementById('communityPostSendMenu');
            var cmb = document.getElementById('communityChatSendMenuBtn');
            var pmb = document.getElementById('communityPostMenuBtn');
            if (chatMenu) chatMenu.hidden = true;
            if (postMenu) postMenu.hidden = true;
            if (cmb) cmb.setAttribute('aria-expanded', 'false');
            if (pmb) pmb.setAttribute('aria-expanded', 'false');
            closeCommunityChatEmojiPicker();
        }

        function installCommunitySendMenus() {
            var chatMenuBtn = document.getElementById('communityChatSendMenuBtn');
            var chatMenu = document.getElementById('communityChatSendMenu');
            var chatAdd = document.getElementById('communityChatAddImageBtn');
            var chatFile = document.getElementById('communityChatFileInput');
            var postMenuBtn = document.getElementById('communityPostMenuBtn');
            var postMenu = document.getElementById('communityPostSendMenu');
            var postAdd = document.getElementById('communityPostAddImageBtn');
            var postFile = document.getElementById('communityFileInput');
            if (chatMenuBtn && chatMenu) {
                chatMenuBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var opening = chatMenu.hidden;
                    closeCommunitySendMenus();
                    if (opening) {
                        chatMenu.hidden = false;
                        chatMenuBtn.setAttribute('aria-expanded', 'true');
                    }
                });
            }
            if (chatAdd && chatFile) {
                chatAdd.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeCommunitySendMenus();
                    if (chatFile && !chatFile.disabled) chatFile.click();
                });
            }
            if (postMenuBtn && postMenu) {
                postMenuBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var opening = postMenu.hidden;
                    closeCommunitySendMenus();
                    if (opening) {
                        postMenu.hidden = false;
                        postMenuBtn.setAttribute('aria-expanded', 'true');
                    }
                });
            }
            if (postAdd && postFile) {
                postAdd.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeCommunitySendMenus();
                    if (postFile && !postFile.disabled) postFile.click();
                });
            }
            document.addEventListener('click', function (e) {
                if (e.target.closest && e.target.closest('.community-send-menu')) return;
                if (e.target.closest && e.target.closest('.community-send-split__more')) return;
                if (e.target.closest && e.target.closest('.community-chat-emoji-pop')) return;
                if (e.target.closest && e.target.closest('.community-chat-emoji-btn')) return;
                closeCommunitySendMenus();
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') closeCommunitySendMenus();
            });
        }

        function installCommunityDropzones() {
            function bindDropzone(el, ingestFn, setHint) {
                if (!el) return;
                el.addEventListener('dragover', function (e) {
                    if (!isLoggedIn()) return;
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        e.dataTransfer.dropEffect = 'copy';
                    } catch (ignore) {}
                    el.classList.add('community-dropzone--active');
                });
                el.addEventListener('dragleave', function (e) {
                    if (!el.contains(e.relatedTarget)) el.classList.remove('community-dropzone--active');
                });
                el.addEventListener('drop', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    el.classList.remove('community-dropzone--active');
                    if (!isLoggedIn()) return;
                    var dt = e.dataTransfer;
                    if (!dt || !dt.files || !dt.files.length) return;
                    var imageFiles = Array.from(dt.files).filter(function (f) {
                        return f.type && f.type.indexOf('image/') === 0;
                    });
                    if (!imageFiles.length) {
                        setHint('请拖入图片文件。');
                        return;
                    }
                    ingestFn(imageFiles);
                });
            }
            bindDropzone(
                document.querySelector('.community-chat-compose'),
                ingestCommunityChatFiles,
                setCommunityChatHint
            );
            bindDropzone(
                document.querySelector('.community-panel-forum .community-composer'),
                ingestCommunityPostFiles,
                setCommunityFormHint
            );
        }

        function initCommunityBoard() {
            const fileInput = document.getElementById('communityFileInput');
            const submitBtn = document.getElementById('communitySubmitBtn');
            const chatSendBtn = document.getElementById('communityChatSendBtn');
            const chatInput = document.getElementById('communityChatInput');
            const chatFileInput = document.getElementById('communityChatFileInput');

            if (fileInput) fileInput.addEventListener('change', onCommunityFilesSelected);
            if (chatFileInput) chatFileInput.addEventListener('change', onCommunityChatFilesSelected);
            if (submitBtn) submitBtn.addEventListener('click', submitCommunityPost);
            if (chatSendBtn) chatSendBtn.addEventListener('click', sendCommunityChat);
            if (chatInput) {
                chatInput.addEventListener('keydown', function (ev) {
                    if (ev.isComposing) return;
                    if (ev.key === 'Escape' && communityChatEmojiOpen) {
                        ev.preventDefault();
                        closeCommunityChatEmojiPicker();
                        return;
                    }
                    const isEnter = ev.key === 'Enter' || ev.key === 'NumpadEnter';
                    if (isEnter && (ev.ctrlKey || ev.metaKey)) {
                        ev.preventDefault();
                        const ta = chatInput;
                        const v = String(ta.value || '');
                        const start = ta.selectionStart != null ? ta.selectionStart : v.length;
                        const end = ta.selectionEnd != null ? ta.selectionEnd : start;
                        ta.value = v.slice(0, start) + '\n' + v.slice(end);
                        const np = start + 1;
                        try {
                            ta.setSelectionRange(np, np);
                        } catch (ignore) {}
                        syncCommunityChatMentionFromInput();
                        return;
                    }
                    if (communityMentionUI.open && communityMentionUI.filtered.length) {
                        if (ev.key === 'ArrowDown') {
                            ev.preventDefault();
                            communityMentionUI.activeIdx = Math.min(
                                communityMentionUI.filtered.length - 1,
                                communityMentionUI.activeIdx + 1
                            );
                            renderCommunityChatMentionPicker(communityMentionUI.filtered);
                            return;
                        }
                        if (ev.key === 'ArrowUp') {
                            ev.preventDefault();
                            communityMentionUI.activeIdx = Math.max(0, communityMentionUI.activeIdx - 1);
                            renderCommunityChatMentionPicker(communityMentionUI.filtered);
                            return;
                        }
                        if (ev.key === 'Escape') {
                            ev.preventDefault();
                            if (communityChatEmojiOpen) {
                                closeCommunityChatEmojiPicker();
                                return;
                            }
                            closeCommunityChatMentionPicker();
                            return;
                        }
                        if (ev.key === 'Tab') {
                            ev.preventDefault();
                            const pick = communityMentionUI.filtered[communityMentionUI.activeIdx];
                            if (pick) insertCommunityChatMention(pick.bindingId);
                            return;
                        }
                        if (isEnter && !ev.ctrlKey && !ev.metaKey) {
                            ev.preventDefault();
                            const pick = communityMentionUI.filtered[communityMentionUI.activeIdx];
                            if (pick) insertCommunityChatMention(pick.bindingId);
                            return;
                        }
                    }
                    if (isEnter && !ev.ctrlKey && !ev.metaKey) {
                        ev.preventDefault();
                        sendCommunityChat();
                    }
                });
                chatInput.addEventListener('input', syncCommunityChatMentionFromInput);
                chatInput.addEventListener('keyup', syncCommunityChatMentionFromInput);
                chatInput.addEventListener('click', syncCommunityChatMentionFromInput);
                chatInput.addEventListener('blur', function () {
                    window.setTimeout(closeCommunityChatMentionPicker, 200);
                });
                chatInput.addEventListener('paste', function (ev) {
                    if (ev.defaultPrevented) return;

                    const cd = ev.clipboardData;
                    if (!cd || !isLoggedIn()) return;
                    const clip = cd.getData('text/plain') || '';
                    if (!clip || !clip.trim()) return;
                    const url = extractBilibiliShareUrl(clip);
                    if (!url) return;
                    if (clip.trim() === url) return;
                    ev.preventDefault();
                    insertTextAtCommunityChatInput(url);
                });
            }

            const chatCompose = document.querySelector('.community-chat-compose');
            if (chatCompose) {
                chatCompose.addEventListener('paste', function (ev) {
                    handleCommunityChatPaste(ev);
                }, true);
            }

            installCommunityDropzones();
            installCommunitySendMenus();
            installCommunityChatEmojiPicker();

            installCommunityChatScrollGuard();
            installCommunityChatContextMenu();
            installCommunityChatPinBar();
            wireCommunityChatRoster();
            refreshCommunitySessionUi({ deferNetwork: true });
            installCommunityChatHistoryLazyLoad();
            installCommunityChatScrollLazyReload();

            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState !== 'visible' || !isLoggedIn()) return;
                communityChatPollBackoffMs = 0;
                clearTimeout(communityVisibilityTimer);
                communityVisibilityTimer = setTimeout(function () {
                    runCommunityChatPollTick();
                }, 200);
            });
        }

        function installCommunityChatHistoryLazyLoad() {
            const sc = getCommunityChatScrollEl();
            if (!sc || sc.dataset.historyLazy === '1') return;
            sc.dataset.historyLazy = '1';
            if (typeof IntersectionObserver !== 'function') return;
            communityChatHistoryObserver = new IntersectionObserver(
                function (entries) {
                    entries.forEach(function (entry) {
                        if (!entry.isIntersecting || communityChatHistoryLoading) return;
                        prependOlderCommunityChatMessages();
                    });
                },
                { root: sc, rootMargin: '120px 0px', threshold: 0 }
            );
        }

        function installCommunityChatScrollLazyReload() {
            const sc = getCommunityChatScrollEl();
            if (!sc || sc.dataset.lazyMedia === '1') return;
            sc.dataset.lazyMedia = '1';
            var ticking = false;
            sc.addEventListener('scroll', function () {
                if (ticking || !window.UssLazyMedia) return;
                ticking = true;
                requestAnimationFrame(function () {
                    ticking = false;
                    bindCommunityChatAvatars(document.getElementById('communityChatLog'), { eagerLast: 8 });
                });
            });
        }

        let communityVisibilityTimer = null;
        var pageReadyMarked = false;

        function markPageReadyOnce() {
            if (pageReadyMarked) return;
            pageReadyMarked = true;
            if (window.UssHomeBoot && typeof window.UssHomeBoot.markPageReady === 'function') {
                window.UssHomeBoot.markPageReady();
            } else {
                window.__ussPageReady = true;
                window.dispatchEvent(new CustomEvent('uss:page-ready'));
            }
        }

        async function bootHomeAfterAuth() {
            if (isLoggedIn()) hydrateProfileCacheIfNeeded();
            refreshNavLoginState();
            refreshLoginDrawerView();
            markPageReadyOnce();
            if (!isLoggedIn()) return;
            loadCommunityChatFull().catch(function () {});
            startCommunityChatPoll();
            refreshCommunitySessionUi();
            ensureUserProfileWithRetry({ reason: 'boot', skipServerRefresh: true })
                .catch(function () {
                    return null;
                })
                .then(function () {
                    refreshNavLoginState();
                    refreshLoginDrawerView();
                });
            var scheduleIdle =
                window.UssHomeBoot && typeof window.UssHomeBoot.scheduleIdle === 'function'
                    ? window.UssHomeBoot.scheduleIdle.bind(window.UssHomeBoot)
                    : window.UssLazyMedia && typeof window.UssLazyMedia.runWhenIdle === 'function'
                      ? window.UssLazyMedia.runWhenIdle.bind(window.UssLazyMedia)
                      : function (fn, ms) {
                            setTimeout(fn, ms == null ? 500 : ms);
                        };
            scheduleIdle(function () {
                loadCommunityPosts();
                loadCommunityRoster();
            }, 300);
        }

        /** 舰队职务等级：每级一颗 SVG 图标（与抽屉青色风格一致） */
        var ORG_RANK_ICON_SVG =
            '<svg class="drawer-org-rank-svg" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M512 890.35c-51.06 0-100.62-10.01-147.28-29.75-45.06-19.06-85.52-46.33-120.25-81.07s-62.01-75.2-81.07-120.25c-19.74-46.67-29.75-96.22-29.75-147.28 0-71.37 19.98-140.89 57.79-201.05 36.76-58.5 88.74-105.84 150.32-136.92 15.37-7.76 34.13-1.58 41.89 13.79 7.76 15.37 1.58 34.13-13.79 41.89-51.46 25.97-94.89 65.53-125.62 114.42-31.55 50.21-48.23 108.26-48.23 167.87 0 84.4 32.87 163.76 92.55 223.44S427.6 827.99 512 827.99s163.76-32.87 223.44-92.55c59.68-59.68 92.55-139.04 92.55-223.44s-32.87-163.76-92.55-223.44C675.76 228.88 596.4 196.01 512 196.01c-17.22 0-31.18-13.96-31.18-31.18s13.96-31.18 31.18-31.18c51.06 0 100.62 10.01 147.28 29.75 45.06 19.06 85.52 46.33 120.25 81.07s62.01 75.2 81.07 120.25c19.74 46.67 29.75 96.22 29.75 147.28s-10.01 100.62-29.75 147.28c-19.06 45.06-46.33 85.52-81.07 120.25s-75.2 62.01-120.25 81.07c-46.66 19.74-96.22 29.75-147.28 29.75z"/>' +
            '<path d="M163.25 925.49c-19.55 0-35.3-5.9-47.07-17.67-8.53-8.53-18.52-24.21-17.67-50.47 0.5-15.45 4.55-32.95 12.36-53.5 13.73-36.13 38.74-80.38 74.32-131.53 9.84-14.14 29.27-17.62 43.4-7.79 14.14 9.83 17.62 29.27 7.79 43.4-73.56 105.76-76.13 145.9-75.38 155.08 8.71 0.71 45.41-1.6 140.27-65.28 81.02-54.39 176.51-135.21 268.88-227.58s173.2-187.86 227.59-268.88c63.68-94.86 65.99-131.55 65.28-140.27-9.23-0.75-49.94 1.86-157.45 77.06-14.11 9.87-33.55 6.43-43.42-7.68-9.87-14.11-6.43-33.55 7.68-43.42 51.74-36.19 96.52-61.66 133.09-75.71 20.76-7.98 38.43-12.13 54.02-12.71 26.52-0.99 42.31 9.06 50.9 17.65 19.81 19.81 22.98 50.87 9.43 92.33-10.11 30.93-29.65 68.89-58.07 112.83-56.61 87.53-143.6 191.55-244.94 292.9-101.35 101.35-205.37 188.33-292.9 244.94-43.95 28.42-81.91 47.96-112.83 58.07-16.84 5.49-31.94 8.23-45.28 8.23z"/>' +
            '</svg>';

        function fillOrgFleetBlock(sess) {
            const wrap = document.getElementById('loggedInOrgFleet');
            const logo = document.getElementById('loggedInOrgLogo');
            const nameA = document.getElementById('loggedInOrgName');
            const sidEl = document.getElementById('loggedInOrgSid');
            const roleRow = document.getElementById('loggedInOrgRoleRow');
            const roleEl = document.getElementById('loggedInOrgRole');
            const rankWrap = document.getElementById('loggedInOrgRanking');
            if (!wrap || !logo || !nameA || !sidEl || !roleRow || !roleEl || !rankWrap) return;
            const orgName = sess && sess.rsiOrgName != null ? String(sess.rsiOrgName).trim() : '';
            const orgSid = sess && sess.rsiOrgSid != null ? String(sess.rsiOrgSid).trim() : '';
            const orgLogo = sess && sess.rsiOrgLogoUrl;
            const orgRole = sess && sess.rsiOrgRoleLabel != null ? String(sess.rsiOrgRoleLabel).trim() : '';
            var slots = sess && sess.rsiOrgRankSlots != null ? Number(sess.rsiOrgRankSlots) : 0;
            if (!Number.isFinite(slots)) slots = 0;
            const showFleet = !!(orgName || orgSid || orgLogo || orgRole || slots > 0);
            if (!showFleet) {
                wrap.hidden = true;
                logo.removeAttribute('src');
                logo.hidden = true;
                nameA.textContent = '';
                nameA.setAttribute('href', '#');
                sidEl.textContent = '';
                roleEl.textContent = '';
                roleRow.hidden = true;
                rankWrap.innerHTML = '';
                return;
            }
            wrap.hidden = false;
            if (orgLogo) {
                logo.src = window.UssAuthApi.resolveAssetUrl(orgLogo);
                logo.hidden = false;
            } else {
                logo.removeAttribute('src');
                logo.hidden = true;
            }
            nameA.textContent = orgName || orgSid || '—';
            var pageUrl = sess && sess.rsiOrgPageUrl;
            if (pageUrl) nameA.setAttribute('href', pageUrl);
            else nameA.setAttribute('href', '#');
            sidEl.textContent = orgSid;
            if (orgRole) {
                roleEl.textContent = orgRole;
                roleRow.hidden = false;
            } else {
                roleEl.textContent = '';
                roleRow.hidden = true;
            }
            var n = Math.max(0, Math.min(20, slots));
            rankWrap.innerHTML = '';
            for (var i = 0; i < n; i++) {
                var sp = document.createElement('span');
                sp.className = 'active drawer-org-rank-slot';
                sp.setAttribute('aria-hidden', 'true');
                sp.innerHTML = ORG_RANK_ICON_SVG;
                rankWrap.appendChild(sp);
            }
        }

        function refreshLoginDrawerView() {
            const guest = document.getElementById('loginDrawerGuest');
            const authed = document.getElementById('loginDrawerAuthed');
            const drawerContent = document.querySelector('.login-drawer-content');
            if (!guest || !authed) return;
            if (isLoggedIn()) {
                guest.style.display = 'none';
                authed.style.display = '';
                if (drawerContent) drawerContent.classList.add('login-drawer-content--authed');
                const sess = loadAuthSession();
                /* 与注册表单 #regBindingId 同源字段（bindingId），服务端 normalize 后的账号 Handle */
                document.getElementById('loggedInBindingId').textContent = sess && sess.bindingId ? sess.bindingId : '—';
                const rsiHandleWrap = document.getElementById('loggedInRsiHandleWrap');
                const rsiHandleEl = document.getElementById('loggedInRsiHandle');
                const rankRow = document.getElementById('loggedInRsiRankRow');
                const rankIcon = document.getElementById('loggedInRsiRankIcon');
                const rankLbl = document.getElementById('loggedInRsiRankLabel');
                const rsiHandle = sess && sess.rsiProfileHandle;
                if (rsiHandleWrap && rsiHandleEl) {
                    if (rsiHandle) {
                        rsiHandleEl.textContent = rsiHandle;
                        rsiHandleWrap.hidden = false;
                    } else {
                        rsiHandleEl.textContent = '';
                        rsiHandleWrap.hidden = true;
                    }
                }
                fillOrgFleetBlock(sess);
                var admL = document.getElementById('drawerAdminLink');
                if (admL) {
                    admL.style.display = sess && sess.isAdmin ? 'block' : 'none';
                }
                if (rankRow && rankIcon && rankLbl) {
                    const iconUrl = sess && sess.rsiRankIconUrl;
                    const rankText = sess && sess.rsiRankLabel;
                    if (iconUrl || rankText) {
                        rankRow.hidden = false;
                        const resolvedIcon = sessionRankIconSrc(sess);
                        if (resolvedIcon) {
                            rankIcon.onerror = function () {
                                rankIcon.onerror = null;
                                rankIcon.removeAttribute('src');
                                rankIcon.hidden = true;
                            };
                            rankIcon.src = resolvedIcon;
                            rankIcon.hidden = false;
                        } else {
                            rankIcon.removeAttribute('src');
                            rankIcon.hidden = true;
                        }
                        rankLbl.textContent = rankText || '';
                    } else {
                        rankRow.hidden = true;
                        rankIcon.removeAttribute('src');
                        rankLbl.textContent = '';
                    }
                }
                const metaWrap = document.getElementById('loggedInRsiMeta');
                const rowEn = document.getElementById('loggedInRsiMetaRowEnlisted');
                const rowLoc = document.getElementById('loggedInRsiMetaRowLocation');
                const rowFlu = document.getElementById('loggedInRsiMetaRowFluency');
                const enEl = document.getElementById('loggedInRsiEnlisted');
                const locEl = document.getElementById('loggedInRsiLocation');
                const fluEl = document.getElementById('loggedInRsiFluency');
                function fillRsiMetaRow(row, valEl, v) {
                    const t = v != null && String(v).trim() !== '' ? String(v).trim() : '';
                    if (row && valEl) {
                        valEl.textContent = t;
                        row.hidden = !t;
                    }
                }
                /** 网站未抓取到内容时显示占位符，不隐藏整行 */
                function fillRsiMetaRowPlaceholder(row, valEl, v, placeholder) {
                    const ph = placeholder != null && String(placeholder).trim() !== '' ? String(placeholder).trim() : '------';
                    const empty = v == null || String(v).trim() === '';
                    const t = empty ? ph : String(v).trim();
                    if (row && valEl) {
                        valEl.textContent = t;
                        row.hidden = false;
                    }
                }
                fillRsiMetaRow(rowEn, enEl, sess && sess.rsiEnlisted);
                fillRsiMetaRowPlaceholder(rowLoc, locEl, sess && sess.rsiLocation, '------');
                fillRsiMetaRow(rowFlu, fluEl, sess && sess.rsiFluency);
                if (metaWrap) {
                    metaWrap.hidden = !(
                        (rowEn && !rowEn.hidden) ||
                        (rowLoc && !rowLoc.hidden) ||
                        (rowFlu && !rowFlu.hidden)
                    );
                }
                const dImg = document.getElementById('drawerUserAvatarImg');
                if (dImg) {
                    dImg.src = sessionAvatarSrc();
                    dImg.alt = '用户头像';
                }
                if (typeof window.refreshOopzBindSection === 'function') {
                    window.refreshOopzBindSection();
                }
            } else {
                guest.style.display = '';
                authed.style.display = 'none';
                if (drawerContent) drawerContent.classList.remove('login-drawer-content--authed');
                if (typeof window.refreshOopzBindSection === 'function') {
                    window.refreshOopzBindSection();
                }
            }
        }

        function switchAuthTab(which) {
            clearLoginFormHint();
            clearRegisterFormHint();
            const headLogin = document.getElementById('rsiAuthHeadLogin');
            const headReg = document.getElementById('rsiAuthHeadRegister');
            const loginPanel = document.getElementById('authPanelLogin');
            const regPanel = document.getElementById('authPanelRegister');
            if (!loginPanel || !regPanel) return;
            if (which === 'register') {
                if (headLogin) headLogin.style.display = 'none';
                if (headReg) headReg.style.display = 'block';
                loginPanel.style.display = 'none';
                regPanel.style.display = 'block';
            } else {
                if (headReg) headReg.style.display = 'none';
                if (headLogin) headLogin.style.display = 'block';
                regPanel.style.display = 'none';
                loginPanel.style.display = 'block';
            }
            syncAuthFloatFields();
        }

        function setPasswordToggleIcon(btn, showPlainText) {
            if (!btn) return;
            const showIcon = btn.querySelector('.rsi-pw-icon--show');
            const hideIcon = btn.querySelector('.rsi-pw-icon--hide');
            if (showIcon) showIcon.hidden = !!showPlainText;
            if (hideIcon) hideIcon.hidden = !showPlainText;
        }

        function playPasswordToggleTapAnimation(btn) {
            if (!btn) return;
            btn.classList.remove('rsi-pw-toggle--tap');
            void btn.offsetWidth;
            btn.classList.add('rsi-pw-toggle--tap');
            const iconWrap = btn.querySelector('.rsi-pw-toggle-icon');
            const target = iconWrap || btn;
            const done = function () {
                btn.classList.remove('rsi-pw-toggle--tap');
                target.removeEventListener('animationend', done);
            };
            target.addEventListener('animationend', done, { once: true });
        }

        function togglePasswordField(inputId, toggleBtnId) {
            const input = document.getElementById(inputId);
            const btn = document.getElementById(toggleBtnId);
            if (!input || !btn) return;
            if (input.type === 'password') {
                input.type = 'text';
                setPasswordToggleIcon(btn, true);
            } else {
                input.type = 'password';
                setPasswordToggleIcon(btn, false);
            }
            playPasswordToggleTapAnimation(btn);
        }

        function validateEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
        }

        function clearLoginFormHint() {
            const el = document.getElementById('loginFormHint');
            if (el) {
                el.textContent = '';
                el.hidden = true;
                el.classList.remove('rsi-form-hint--info');
                el.classList.add('rsi-form-hint--error');
            }
        }

        function setLoginFormHint(text, isInfo) {
            const el = document.getElementById('loginFormHint');
            if (!el) return;
            if (text) {
                el.textContent = text;
                el.hidden = false;
                el.classList.toggle('rsi-form-hint--info', !!isInfo);
                el.classList.toggle('rsi-form-hint--error', !isInfo);
            } else {
                clearLoginFormHint();
            }
        }

        let forgotPwSendCooldownTimer = null;

        function clearForgotPasswordHint() {
            const el = document.getElementById('forgotPasswordHint');
            if (el) {
                el.textContent = '';
                el.hidden = true;
                el.classList.remove('rsi-form-hint--info');
                el.classList.add('rsi-form-hint--error');
            }
        }

        function setForgotPasswordHint(msg, isInfo) {
            const el = document.getElementById('forgotPasswordHint');
            if (!el) return;
            if (!msg) {
                clearForgotPasswordHint();
                return;
            }
            el.textContent = msg;
            el.hidden = false;
            el.classList.toggle('rsi-form-hint--info', !!isInfo);
            el.classList.toggle('rsi-form-hint--error', !isInfo);
        }

        function resetForgotPasswordForm() {
            ['forgotPwEmail', 'forgotPwCode', 'forgotPwNewPassword', 'forgotPwConfirmPassword'].forEach(function (id) {
                const input = document.getElementById(id);
                if (input) {
                    input.value = '';
                    if (id.indexOf('Password') >= 0) input.type = 'password';
                }
            });
            ['forgotPwNewToggle', 'forgotPwConfirmToggle'].forEach(function (id) {
                setPasswordToggleIcon(document.getElementById(id), false);
            });
            const submit = document.getElementById('forgotPwSubmitBtn');
            if (submit) {
                submit.disabled = false;
                submit.textContent = '重置密码';
            }
            stopForgotPwSendCooldown();
            clearForgotPasswordHint();
        }

        function stopForgotPwSendCooldown() {
            if (forgotPwSendCooldownTimer) {
                clearInterval(forgotPwSendCooldownTimer);
                forgotPwSendCooldownTimer = null;
            }
            const btn = document.getElementById('forgotPwSendCodeBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '发送验证码';
            }
        }

        function startForgotPwSendCooldown(seconds) {
            stopForgotPwSendCooldown();
            const btn = document.getElementById('forgotPwSendCodeBtn');
            if (!btn || !seconds || seconds < 1) return;
            let left = Math.ceil(seconds);
            btn.disabled = true;
            btn.textContent = left + 's 后重发';
            forgotPwSendCooldownTimer = setInterval(function () {
                left -= 1;
                if (left <= 0) {
                    stopForgotPwSendCooldown();
                    return;
                }
                btn.textContent = left + 's 后重发';
            }, 1000);
        }

        function openForgotPasswordDialog() {
            resetForgotPasswordForm();
            const loginEmail = document.getElementById('loginEmail');
            const forgotEmail = document.getElementById('forgotPwEmail');
            if (loginEmail && forgotEmail && loginEmail.value.trim()) {
                forgotEmail.value = loginEmail.value.trim();
            }
            const backdrop = document.getElementById('forgotPasswordBackdrop');
            if (!backdrop) return;
            backdrop.hidden = false;
            backdrop.onclick = function (e) {
                if (e.target === backdrop) closeForgotPasswordDialog();
            };
            updatePageScrollLock();
            syncAuthFloatFields();
            if (forgotEmail) forgotEmail.focus();
        }

        function closeForgotPasswordDialog() {
            const backdrop = document.getElementById('forgotPasswordBackdrop');
            if (backdrop) backdrop.hidden = true;
            resetForgotPasswordForm();
            updatePageScrollLock();
        }

        function forgotPasswordErrorHint(err) {
            var code = '';
            if (err && typeof err === 'object' && err.code) {
                code = String(err.code).trim();
            }
            if (code && typeof UssApiError !== 'undefined' && UssApiError.forgotPasswordHintForCode) {
                var hint = UssApiError.forgotPasswordHintForCode(code);
                if (hint) return hint;
            }
            return safeUserFacingMessage(err);
        }

        async function submitForgotPasswordSendCode() {
            clearForgotPasswordHint();
            const email = String(document.getElementById('forgotPwEmail')?.value || '').trim();
            if (!validateEmail(email)) {
                setForgotPasswordHint('请填写有效的注册邮箱');
                return;
            }
            const btn = document.getElementById('forgotPwSendCodeBtn');
            if (btn && btn.disabled) return;
            if (btn) {
                btn.disabled = true;
                btn.textContent = '发送中…';
            }
            try {
                const res = await window.UssAuthApi.sendPasswordResetCode(email);
                setForgotPasswordHint(res.message || '若该邮箱已注册，验证码将发送到您的邮箱', true);
                startForgotPwSendCooldown(60);
            } catch (e) {
                if (e.cooldownSec) startForgotPwSendCooldown(e.cooldownSec);
                else stopForgotPwSendCooldown();
                setForgotPasswordHint(forgotPasswordErrorHint(e));
            }
        }

        async function submitForgotPasswordReset() {
            clearForgotPasswordHint();
            const email = String(document.getElementById('forgotPwEmail')?.value || '').trim();
            const code = String(document.getElementById('forgotPwCode')?.value || '').trim();
            const newPassword = String(document.getElementById('forgotPwNewPassword')?.value || '');
            const confirmPassword = String(document.getElementById('forgotPwConfirmPassword')?.value || '');

            if (!validateEmail(email)) {
                setForgotPasswordHint('请填写有效的注册邮箱');
                return;
            }
            if (!/^\d{6}$/.test(code)) {
                setForgotPasswordHint('请输入 6 位数字验证码');
                return;
            }
            if (!newPassword || newPassword.length < 6) {
                setForgotPasswordHint('新密码至少 6 位');
                return;
            }
            if (newPassword !== confirmPassword) {
                setForgotPasswordHint('两次输入的新密码不一致');
                return;
            }

            const btn = document.getElementById('forgotPwSubmitBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '提交中…';
            }
            try {
                const res = await window.UssAuthApi.confirmPasswordReset({
                    email: email,
                    code: code,
                    newPassword: newPassword,
                    confirmPassword: confirmPassword,
                });
                setForgotPasswordHint(res.message || '密码已重置', true);
                const loginEmail = document.getElementById('loginEmail');
                if (loginEmail) loginEmail.value = email;
                setTimeout(function () {
                    closeForgotPasswordDialog();
                    setLoginFormHint('密码已重置，请使用新密码登录');
                    const loginHint = document.getElementById('loginFormHint');
                    if (loginHint) {
                        loginHint.classList.remove('rsi-form-hint--error');
                        loginHint.classList.add('rsi-form-hint--info');
                    }
                }, 1200);
            } catch (e) {
                setForgotPasswordHint(forgotPasswordErrorHint(e));
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '重置密码';
                }
            }
        }

        function clearRegisterFormHint() {
            const el = document.getElementById('registerFormHint');
            if (el) {
                el.textContent = '';
                el.hidden = true;
                el.classList.remove('rsi-form-hint--info');
                el.classList.add('rsi-form-hint--error');
            }
        }

        function setRegisterFormHint(text, isSuccess) {
            const el = document.getElementById('registerFormHint');
            if (!el) return;
            if (text) {
                el.textContent = text;
                el.hidden = false;
                el.classList.toggle('rsi-form-hint--info', !!isSuccess);
                el.classList.toggle('rsi-form-hint--error', !isSuccess);
            } else {
                clearRegisterFormHint();
            }
        }

        async function submitRegister() {
            const bindingId = document.getElementById('regBindingId').value.trim().toLowerCase();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;

            if (!bindingId) {
                setRegisterFormHint('请填写绑定 ID。');
                return;
            }
            if (!validateEmail(email)) {
                setRegisterFormHint('请填写有效的邮箱地址。');
                return;
            }
            if (!password || password.length < 6) {
                setRegisterFormHint('密码至少需要 6 位。');
                return;
            }
            if (isLoggedIn()) {
                setRegisterFormHint('请先退出当前账号再注册新账号。');
                return;
            }

            const regBtn = document.getElementById('registerSubmitBtn');
            if (regBtn) {
                regBtn.disabled = true;
                regBtn.textContent = '注册中…';
            }

            try {
                clearRegisterFormHint();
                await window.UssAuthApi.register(
                    {
                        bindingId,
                        email,
                        password,
                        sessionDays: 7,
                    }
                );
                clearRegisterFormHint();
                document.getElementById('regBindingId').value = '';
                document.getElementById('regEmail').value = '';
                document.getElementById('regPassword').value = '';
                const loginEmailEl = document.getElementById('loginEmail');
                const loginPasswordEl = document.getElementById('loginPassword');
                if (loginEmailEl) loginEmailEl.value = email;
                if (loginPasswordEl) loginPasswordEl.value = '';
                switchAuthTab('login');
                syncAuthFloatFields();
                setLoginFormHint('注册成功，请登录', true);
                resetRegisterSubmitBtn();
                refreshLoginDrawerView();
            } catch (e) {
                if (
                    e &&
                    e.message &&
                    !e.code &&
                    (String(e.message).indexOf('RSI') !== -1 ||
                        String(e.message).indexOf('绑定 ID') !== -1 ||
                        String(e.message).indexOf('跨域') !== -1)
                ) {
                    setRegisterFormHint(registerRsiScrapeErrorHint(e));
                } else {
                    setRegisterFormHint(registerFormErrorHint(e));
                }
            } finally {
                if (regBtn && regBtn.textContent === '注册中…') {
                    resetRegisterSubmitBtn();
                }
            }
        }

        async function submitLogin() {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            clearLoginFormHint();
            if (!email || !password) {
                setLoginFormHint(safeUserFacingMessage('AUTH_L002'));
                return;
            }

            const loginBtn = document.getElementById('loginSubmitBtn');
            const t0 = Date.now();
            setLoginSubmitLoading(true);

            try {
                clearLoginFormHint();
                const sessionDays = getLoginSessionDays();
                const res = await window.UssAuthApi.login({ email, password, sessionDays });
                const elapsed = Date.now() - t0;
                const waitMore = Math.max(0, LOGIN_MIN_LOADING_MS - elapsed);
                if (waitMore > 0) {
                    await new Promise(function (resolve) {
                        setTimeout(resolve, waitMore);
                    });
                }

                const remember = sessionDays !== 0;
                saveAuthSessionFromUser(
                    res.token,
                    res.user,
                    remember,
                    {
                        loginAt: new Date().toISOString(),
                        sessionDays: res.sessionDays != null ? res.sessionDays : sessionDays,
                        expiresAt:
                            res.expiresAt != null
                                ? res.expiresAt
                                : window.UssAuthApi.getTokenExpiresAt
                                  ? window.UssAuthApi.getTokenExpiresAt(res.token)
                                  : undefined,
                    }
                );
                refreshNavLoginState();
                loadCommunityChatFull();
                loadCommunityPosts();
                ensureUserProfileWithRetry({ reason: 'boot' }).then(function () {
                    refreshLoginDrawerView();
                });
                if (loginBtn) {
                    loginBtn.classList.remove('rsi-submit-btn--loading');
                    loginBtn.removeAttribute('aria-busy');
                    loginBtn.innerHTML = '';
                    loginBtn.textContent = '登录成功';
                    loginBtn.disabled = true;
                }
                setTimeout(function () {
                    resetLoginSubmitBtn();
                    refreshLoginDrawerView();
                }, AUTH_BUTTON_FEEDBACK_MS);
            } catch (e) {
                resetLoginSubmitBtn();
                if (isLikelyNetworkError(e && e.message)) {
                    setLoginFormHint(safeUserFacingMessage('NET_E001'));
                } else {
                    setLoginFormHint(loginFormErrorHint(e));
                }
            }
        }

        function logoutUser() {
            const lo = document.getElementById('logoutSubmitBtn');
            if (lo) {
                lo.disabled = true;
                lo.setAttribute('aria-label', '已退出');
                lo.title = '已退出';
            }
            ensureUserProfilePromise = null;
            clearAuthSession();
            refreshNavLoginState();
            refreshLoginDrawerView();
            setTimeout(function () {
                if (isLoggedIn()) return;
                refreshLoginDrawerView();
                resetLogoutSubmitBtn();
            }, AUTH_BUTTON_FEEDBACK_MS);
        }

        initCommunityBoard();
        initLoginSessionSelect();
        syncAuthFloatFields();
        bootHomeAfterAuth();