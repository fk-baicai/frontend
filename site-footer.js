(function () {
    'use strict';
    if (typeof document === 'undefined' || document.getElementById('ussSiteFooter')) return;

    var RSI_LOGO_SVG =
        '<svg class="uss-footer-rsi-logo" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 80 34" aria-hidden="true">' +
        '<path fill="#BCBEC0" fill-rule="evenodd" d="M24.907 25.642a1.35 1.35 0 0 1-1.155-1.005l-1.335-5.699 6.092-3a6.12 6.12 0 0 0 3.15-3.974l2.086-8.053A2.82 2.82 0 0 0 30.91.146H8.403L0 33.14h7.922l2.041-7.993 5.342-2.685 1.905 7.949a3.73 3.73 0 0 0 3.436 2.73h6.362l1.95-7.5zM12.47 15.144l1.89-7.499h9.168c.705 0 1.2.375 1.02.945a2.38 2.38 0 0 1-1.335 1.5l-10.803 5.399z" clip-rule="evenodd"></path>' +
        '<path fill="#FFA000" d="m59.058.146-1.951 7.5h1.41l1.951-7.5z"></path>' +
        '<path fill="#BCBEC0" d="m43.258 10.525 12.724 8.398a4.33 4.33 0 0 1 1.65 4.214l-1.83 7.184a3.87 3.87 0 0 1-3.556 2.76H36.22l1.965-7.5h9.738a1.5 1.5 0 0 0 1.38-1.049 1.35 1.35 0 0 0-.66-1.635l-12.813-8.533a4.3 4.3 0 0 1-1.65-4.274l1.83-7.214A3.78 3.78 0 0 1 39.4.146h18.366l-1.98 7.59v-.09l-11.824.09a1.38 1.38 0 0 0-1.5 1.094 1.5 1.5 0 0 0 .795 1.695M67.07.267s0-.12-8.462 32.874h8.012L75.022.31z"></path>' +
        '<path fill="#FFA000" d="M34.135 25.642 32.17 33.14h-1.32l1.965-7.5zM30.189 25.642v-.06l-2.01 7.558h1.365l1.98-7.498zM35.426 25.642h1.365l-1.95 7.499H33.46zM63.739 7.645l1.95-7.499h-1.275l-1.965 7.5zM63.079.146l-1.95 7.5h-1.291l1.965-7.5z"></path>' +
        '<path fill="#AAB5BB" d="M76.022 2.138c0-1.373.623-1.997 1.99-1.997S80 .768 80 2.138c0 1.372-.622 2-1.989 2s-1.989-.628-1.989-2m3.677 0c0-1.17-.529-1.701-1.692-1.701s-1.692.527-1.692 1.7c0 1.17.53 1.702 1.692 1.702 1.167 0 1.692-.532 1.692-1.701m-.887-.34c0 .393-.103.554-.404.61l.45.717c.022.022.012.043-.02.043h-.373c-.046 0-.064-.01-.082-.046l-.44-.685h-.222v.692c0 .032-.003.036-.032.036h-.361c-.032 0-.036-.008-.036-.036V1.182c0-.022.007-.032.032-.032.24-.022.494-.025.723-.025.569 0 .765.153.765.674m-1.09-.302v.62H78c.287 0 .372-.053.372-.303 0-.257-.085-.317-.372-.317z"></path>' +
        '</svg>';

    var BC_LOGO_SVG =
        '<svg class="uss-footer-bc-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="32" height="32" aria-hidden="true">' +
        '<path fill="currentColor" d="M508.51456 745.54624c24.40064 0 52.288 0 76.68608-3.4816 20.9152-3.48928 41.8304-10.4576 62.7456-17.4336 3.48416 0 3.48416-3.48544 3.48416-6.96832 3.48672-27.88864 3.48672-55.77216 3.48672-80.17664 0-24.39808-6.9696-48.79872-20.9152-66.22848-24.39936-27.8848-52.288-41.82528-87.14368-41.82528l-62.74688 0c-24.39936 0-45.31712 6.96832-66.22848 20.91136-24.39936 17.42976-38.34496 41.83296-41.82912 69.71648-3.48544 31.3728 0 66.22976-3.48544 101.08672 3.48544 0 10.4576 3.48544 13.94304 3.48544C428.34048 735.08864 466.68288 745.54624 508.51456 745.54624z"></path>' +
        '<path fill="currentColor" d="M233.13792 546.85824l0 87.14368c0 3.48416 0 3.48416 3.48544 6.97216 27.88352 6.96832 55.77216 13.94304 83.65952 17.4272 10.45632 0 24.39936 3.488 34.85568 3.488l0-20.9152c0-10.45632 0-20.9152 3.488-31.3728 10.45376-41.82912 34.85696-69.71776 69.71392-87.14752 6.97216-3.4816 10.45376-3.4816 17.43104-6.9696-20.91648-20.91392-31.37664-41.82912-31.37664-69.71264L341.1968 445.77152c-13.9456 0-27.8848 3.48416-38.34496 6.96832C264.50944 466.688 233.13792 505.02784 233.13792 546.85824z"></path>' +
        '<path fill="currentColor" d="M682.8032 445.7728l-66.23232 0c0 27.88352-10.45504 52.28288-31.37024 69.71264 3.48672 0 6.9696 3.48928 6.9696 3.48928 17.43104 6.9696 34.85568 17.4272 48.80256 31.37024 20.9152 24.39936 31.37152 52.28672 31.37152 83.65824l0 24.40064c17.4272-3.48544 31.37408-3.48544 48.80384-6.9696 20.91136-3.48928 45.31072-10.4576 66.22464-20.91392 3.48928 0 3.48928-3.48672 3.48928-6.97344L790.86208 553.8304c0-13.9456-3.48928-31.37536-10.4576-45.31328C759.49056 466.68416 728.11776 445.7728 682.8032 445.7728z"></path>' +
        '<path fill="currentColor" d="M431.82464 442.28352c3.488 45.31456 38.34496 83.65952 83.65952 83.65952 45.31712 0 83.65824-38.34624 80.17536-83.65952 0-45.31456-38.34624-80.17408-80.17536-80.17408C470.1696 362.10944 431.82464 396.96896 431.82464 442.28352z"></path>' +
        '<path fill="currentColor" d="M616.57088 435.31136c10.45632 3.48928 20.91776 6.976 34.85568 6.976 45.3184 0 83.66208-38.34496 80.17536-83.65952 0-45.3184-38.3424-80.17408-80.17536-80.17408-45.31072 0-83.6544 34.85568-83.6544 80.17408C595.65952 372.56704 613.08672 400.4544 616.57088 435.31136z"></path>' +
        '<path fill="currentColor" d="M372.56832 281.93792c-45.31712 0-83.65952 34.8608-83.65952 80.1728 0 41.83296 38.3424 80.17408 83.65952 80.17408 13.94304 0 31.36896-3.48416 41.82656-10.4576 3.488-27.88352 17.42976-52.28672 38.34368-66.22976l0-3.48672C452.73856 316.79872 414.39488 281.93792 372.56832 281.93792z"></path>' +
        '<path fill="currentColor" d="M965.40416 342.76608c-19.50976-52.24704-47.744-100.41472-83.92064-143.16288-18.26688-21.5872-50.57536-24.27392-72.15872-6.0096-21.58464 18.26688-24.2752 50.5728-6.00832 72.15872C861.4336 334.42816 893.44 421.88032 893.44 512c0 210.32576-171.11424 381.44-381.44 381.44-210.32704 0-381.44-171.11424-381.44-381.44 0-210.32704 171.11296-381.44 381.44-381.44 60.48896 0 118.30784 13.72672 171.85152 40.8 25.2288 12.75648 56.03328 2.64704 68.7936-22.58816 12.76032-25.23392 2.64576-56.03456-22.58816-68.7936C662.05312 45.5936 588.68992 28.16 512 28.16c-65.29536 0-128.66432 12.8-188.34688 38.04416-57.62176 24.37248-109.36064 59.2512-153.7792 103.66976-44.41856 44.41856-79.29856 96.15744-103.66976 153.77792C40.96 383.3344 28.16 446.70464 28.16 512c0 65.29536 12.8 128.6656 38.04416 188.34688 24.37248 57.62176 59.2512 109.36064 103.66976 153.7792s96.15744 79.29856 153.7792 103.66976C383.33568 983.04 446.70464 995.84 512 995.84c65.29536 0 128.6656-12.8 188.34816-38.04416 57.62176-24.3712 109.36064-59.2512 153.77792-103.66976 44.41856-44.41856 79.29856-96.15744 103.66976-153.7792C983.04 640.6656 995.84 577.29536 995.84 512 995.84 453.79328 985.6 396.85504 965.40416 342.76608z"></path>' +
        '</svg>';

    var DONATE_LOGO_SVG =
        '<svg class="uss-footer-donate-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="32" height="32" aria-hidden="true">' +
        '<path d="M512 512m-512 0a512 512 0 1 0 1024 0 512 512 0 1 0-1024 0Z" fill="currentColor" opacity="0.12"></path>' +
        '<path d="M515.490909 489.611636l106.170182-278.155636-305.896727 347.042909h195.490909l-106.356364 278.109091 306.036364-347.042909h-195.490909z" fill="currentColor"></path>' +
        '</svg>';

    var SC_DISCLAIMER_EN =
        'This is an unofficial Star Citizen website and has no affiliation with any companies under the Cloud Imperium group.';
    var SC_DISCLAIMER_ZH = '本网站为星际公民非官方站点，与云帝国集团旗下各公司无任何隶属关系';

    var footer = document.createElement('footer');
    footer.id = 'ussSiteFooter';
    footer.className = 'uss-site-footer';
    footer.setAttribute('role', 'contentinfo');
    footer.setAttribute('data-nosnippet', '');
    var pageKey = (location.pathname || '').split('/').pop().replace(/\.html$/i, '').toLowerCase();
    if (pageKey && pageKey !== 'index') footer.classList.add('uss-site-footer--tools');
    footer.innerHTML =
        '<div class="uss-site-footer-main">' +
        '<div class="uss-site-footer-bar">' +
        '<div class="uss-site-footer-seg uss-site-footer-seg--brand">' +
        '<span class="uss-footer-sc-badge" tabindex="0" role="img" aria-label="' +
        SC_DISCLAIMER_EN +
        ' ' +
        SC_DISCLAIMER_ZH +
        '">' +
        '<img class="uss-footer-sc-community-logo" src="sp/png/%E7%A4%BE%E5%8C%BA.webp" alt="星际公民非官方站点标识" width="64" height="64" decoding="async">' +
        '<span class="uss-footer-sc-badge-tip" role="tooltip">' +
        '<span class="uss-footer-sc-badge-tip-en">' +
        SC_DISCLAIMER_EN +
        '</span>' +
        '<span class="uss-footer-sc-badge-tip-zh">' +
        SC_DISCLAIMER_ZH +
        '</span>' +
        '</span>' +
        '</span>' +
        '</div>' +
        '<div class="uss-site-footer-vrule" aria-hidden="true"></div>' +
        '<div class="uss-site-footer-seg uss-site-footer-seg--community">' +
        '<nav class="uss-site-footer-seg-body" aria-label="社区链接">' +
        '<ul class="uss-footer-link-list uss-footer-link-list--duo">' +
        '<li><a class="uss-footer-link-row" href="https://apps.microsoft.com/detail/9nf3swfwnkl1?launch=false&amp;mode=mini&amp;hl=zh-CN&amp;gl=CN" target="_blank" rel="noopener noreferrer" aria-label="SC汉化盒子 · Microsoft Store">' +
        '<span class="uss-footer-link-row-icon"><img class="uss-footer-hanghua-logo" src="sp/png/hanghua.webp" alt="" width="32" height="32" decoding="async"><span class="uss-footer-link-desc-tip" role="tooltip">Microsoft Store</span></span>' +
        '<span class="uss-footer-link-row-text"><span class="uss-footer-link-title">SC汉化盒子</span></span></a></li>' +
        '<li><a class="uss-footer-link-row uss-footer-link-row--erkul" href="https://www.erkul.games/live/calculator" target="_blank" rel="noopener noreferrer" aria-label="DPS 计算器 · Erkul.games">' +
        '<span class="uss-footer-link-row-icon"><img class="uss-footer-erkul-logo" src="sp/png/erkul.webp" alt="" width="32" height="32" decoding="async"><span class="uss-footer-link-desc-tip" role="tooltip">Erkul.games</span></span>' +
        '<span class="uss-footer-link-row-text"><span class="uss-footer-link-title">DPS 计算器</span></span></a></li>' +
        '<li><a class="uss-footer-link-row uss-footer-link-row--sctools" href="https://starcitizen.tools/" target="_blank" rel="noopener noreferrer" aria-label="SC Wiki · Star Citizen Wiki">' +
        '<span class="uss-footer-link-row-icon"><img class="uss-footer-sctools-logo" src="sp/svg/sctools-logo.svg" alt="" width="32" height="32" decoding="async"><span class="uss-footer-link-desc-tip" role="tooltip">Star Citizen Wiki</span></span>' +
        '<span class="uss-footer-link-row-text"><span class="uss-footer-link-title">SC Wiki</span></span></a></li>' +
        '</ul>' +
        '</nav>' +
        '</div>' +
        '<div class="uss-site-footer-vrule" aria-hidden="true"></div>' +
        '<div class="uss-site-footer-seg uss-site-footer-seg--official">' +
        '<nav class="uss-site-footer-seg-body" aria-label="官方">' +
        '<ul class="uss-footer-link-list uss-footer-link-list--middle">' +
        '<li><a class="uss-footer-link-row uss-footer-link-row--rsi" href="https://robertsspaceindustries.com/en/" target="_blank" rel="noopener noreferrer" aria-label="星际公民 · Roberts Space Industries">' +
        '<span class="uss-footer-link-row-icon uss-footer-link-row-icon--rsi">' +
        RSI_LOGO_SVG +
        '<span class="uss-footer-link-desc-tip" role="tooltip">Roberts Space Industries</span>' +
        '</span>' +
        '<span class="uss-footer-link-row-text"><span class="uss-footer-link-title">星际公民</span></span>' +
        '</a></li>' +
        '</ul>' +
        '</nav>' +
        '</div>' +
        '<div class="uss-site-footer-vrule" aria-hidden="true"></div>' +
        '<div class="uss-site-footer-seg uss-site-footer-seg--fleet">' +
        '<nav class="uss-site-footer-seg-body" aria-label="舰队活动">' +
        '<ul class="uss-footer-link-list uss-footer-link-list--middle">' +
        '<li><a class="uss-footer-link-row uss-footer-link-row--bc" href="hangzhou-barcitizen.html" aria-label="杭州 BARCITIZEN · U.S.S 杭州线下活动">' +
        '<span class="uss-footer-link-row-icon">' +
        BC_LOGO_SVG +
        '<span class="uss-footer-link-desc-tip" role="tooltip">U.S.S 杭州线下活动</span></span>' +
        '<span class="uss-footer-link-row-text"><span class="uss-footer-link-title">杭州 BARCITIZEN</span></span></a></li>' +
        '<li><button type="button" class="uss-footer-link-row uss-footer-link-row--donate" id="ussFooterDonateBtn" aria-haspopup="dialog" aria-controls="ussDonateModal" aria-label="充电赞助">' +
        '<span class="uss-footer-link-row-icon">' +
        DONATE_LOGO_SVG +
        '<span class="uss-footer-link-desc-tip" role="tooltip">支持本站维护</span></span>' +
        '<span class="uss-footer-link-row-text"><span class="uss-footer-link-title">充电</span></span></button></li>' +
        '</ul>' +
        '</nav>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="uss-site-footer-bottom">' +
        '<div class="uss-site-footer-bottom-inner">' +
        '<a class="uss-site-footer-copy" href="index.html" aria-label="回到首页">© UMBRELLA FLEET · USSXC</a>' +
        '<p class="uss-site-footer-note">本站非星际公民官方网站 由白菜 fkbaicai 开发维护</p>' +
        '</div>' +
        '</div>';

    document.body.appendChild(footer);

    function donateApiBase() {
        return String((window.USS_AUTH_API_BASE || window.USS_REGISTER_API_BASE || '') || '').replace(/\/$/, '');
    }

    function donateQrUrl() {
        var base = donateApiBase();
        var path = '/api/site/donate-qr';
        return (base ? base + path : path) + '?t=' + Date.now();
    }

    var donateModal = document.createElement('div');
    donateModal.id = 'ussDonateModal';
    donateModal.className = 'uss-donate-modal';
    donateModal.hidden = true;
    donateModal.setAttribute('role', 'dialog');
    donateModal.setAttribute('aria-modal', 'true');
    donateModal.setAttribute('aria-labelledby', 'ussDonateTitle');
    donateModal.innerHTML =
        '<div class="uss-donate-modal__backdrop" data-uss-donate-close="1"></div>' +
        '<div class="uss-donate-modal__panel" role="document">' +
        '<button type="button" class="uss-donate-modal__close" data-uss-donate-close="1" aria-label="关闭">×</button>' +
        '<p class="uss-donate-modal__kicker">UMBRELLA FLEET</p>' +
        '<h2 class="uss-donate-modal__title" id="ussDonateTitle">充电赞助</h2>' +
        '<p class="uss-donate-modal__lead">支付宝扫码，支持本站持续维护</p>' +
        '<div class="uss-donate-modal__qr-frame">' +
        '<img class="uss-donate-modal__qr" id="ussDonateQr" alt="支付宝收款二维码" width="280" height="280" decoding="async">' +
        '</div>' +
        '<p class="uss-donate-modal__hint">为爱发光 · 一无所有</p>' +
        '<div class="uss-donate-modal__actions">' +
        '<button type="button" class="uss-donate-modal__feedback" id="ussDonateFeedbackBtn" data-site-note="donate" data-label="充电">反馈</button>' +
        '<button type="button" class="uss-donate-modal__redeem" id="ussDonateRedeemBtn">兑换</button>' +
        '</div>' +
        '<div class="uss-donate-redeem" id="ussDonateRedeem" hidden>' +
        '<p class="uss-donate-redeem__desc">有兑换码即可领取鎏金流光头像框。兑换后，在侧栏点自己的头像就能佩戴或摘下。</p>' +
        '<input id="ussDonateRedeemInput" type="text" maxlength="16" autocomplete="off" placeholder="兑换码">' +
        '<button type="button" class="uss-donate-modal__redeem" id="ussDonateRedeemMake">生成兑换码</button>' +
        '<button type="button" class="uss-donate-modal__redeem" id="ussDonateRedeemGo">确认兑换</button>' +
        '<p class="uss-donate-redeem__msg" id="ussDonateRedeemMsg"></p>' +
        '</div>' +
        '</div>';
    document.body.appendChild(donateModal);

    var donateBtn = document.getElementById('ussFooterDonateBtn');
    var donateQr = document.getElementById('ussDonateQr');
    var donateLastFocus = null;

    function openDonateModal() {
        donateLastFocus = document.activeElement;
        if (donateQr) donateQr.src = donateQrUrl();
        donateModal.hidden = false;
        document.body.classList.add('uss-donate-modal-open');
        var closeBtn = donateModal.querySelector('.uss-donate-modal__close');
        if (closeBtn) closeBtn.focus();
    }

    function closeDonateModal() {
        if (donateModal.hidden) return;
        donateModal.hidden = true;
        document.body.classList.remove('uss-donate-modal-open');
        if (donateLastFocus && typeof donateLastFocus.focus === 'function') {
            try {
                donateLastFocus.focus();
            } catch (e) {}
        }
    }

    if (donateBtn) {
        donateBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            openDonateModal();
        });
    }
    donateModal.addEventListener('click', function (ev) {
        var t = ev.target;
        if (t && t.getAttribute && t.getAttribute('data-uss-donate-close') === '1') {
            closeDonateModal();
        }
    });
    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && !donateModal.hidden && !document.getElementById('missionNoteMask')) {
            closeDonateModal();
        }
    });

    if (!document.querySelector('script[src*="item-notes.js"]')) {
        var notesScript = document.createElement('script');
        notesScript.src = 'item-notes.js?v=9';
        notesScript.defer = true;
        document.body.appendChild(notesScript);
    }

    if (!document.querySelector('script[src*="market-notify.js"]')) {
        var notifyScript = document.createElement('script');
        notifyScript.src = 'market-notify.js?v=12';
        notifyScript.defer = true;
        notifyScript.setAttribute('data-uss-market-notify', '1');
        document.body.appendChild(notifyScript);
    }
    if (!document.querySelector('script[src*="exec-hangar-notify.js"]')) {
        var hangarNotify = document.createElement('script');
        hangarNotify.src = 'exec-hangar-notify.js?v=2';
        hangarNotify.defer = true;
        hangarNotify.setAttribute('data-uss-hangar-notify', '1');
        document.body.appendChild(hangarNotify);
    }
    if (!document.querySelector('link[href*="site-announcement.css"]')) {
        var annCss = document.createElement('link');
        annCss.rel = 'stylesheet';
        annCss.href = 'site-announcement.css?v=3';
        document.head.appendChild(annCss);
    }
    if (!document.querySelector('script[src*="site-announcement.js"]')) {
        var annScript = document.createElement('script');
        annScript.src = 'site-announcement.js?v=3';
        annScript.defer = true;
        annScript.setAttribute('data-uss-site-ann', '1');
        document.body.appendChild(annScript);
    }
    if (!document.getElementById('ussAvatarFrameStyle')) {
        var frameBase = String(window.USS_AUTH_API_BASE || window.USS_REGISTER_API_BASE || '').replace(/\/$/, '');
        var frameImg = (frameBase || '') + '/api/site/avatar-frame.png?v=af2';
        document.documentElement.style.setProperty('--uss-frame-img', 'url("' + frameImg + '")');
        var frameStyle = document.createElement('style');
        frameStyle.id = 'ussAvatarFrameStyle';
        frameStyle.textContent = [
            '.uss-avatar-frame.uss-has-frame{position:relative;display:inline-block;line-height:0;vertical-align:middle;overflow:visible;border-radius:50%}',
            '.uss-avatar-frame.uss-has-frame>img{border-radius:50%;display:block;position:relative;z-index:1}',
            '.community-author-avatar.uss-has-frame,.community-chat-roster-avatar.uss-has-frame,.community-chat-mention-pop__avatar.uss-has-frame,.oopz-bridge-member-avatar-wrap.uss-has-frame,.nav-login-avatar-inner.uss-has-frame,.market-seller-card__avatar-wrap.uss-has-frame,.uss-avatar-frame.uss-has-frame{position:relative;border-radius:50%;overflow:visible!important}',
            '.community-author-avatar.uss-has-frame .community-author-avatar-link{overflow:visible}',
            '.community-chat-line .community-author-avatar.uss-has-frame{margin:.28rem}',
            '.community-chat-roster-avatar.uss-has-frame{margin:.2rem .12rem .2rem 0}',
            '.uss-has-frame::before{content:"";position:absolute;inset:-4%;border-radius:50%;background:conic-gradient(from var(--uss-frame-turn,0deg),transparent 0deg,transparent 300deg,rgba(232,176,70,.5) 328deg,rgba(255,236,170,.9) 338deg,rgba(196,140,40,.45) 348deg,transparent 360deg);-webkit-mask:radial-gradient(circle,transparent 58%,#000 66%,#000 74%,transparent 82%);mask:radial-gradient(circle,transparent 58%,#000 66%,#000 74%,transparent 82%);mix-blend-mode:screen;pointer-events:none;z-index:4;animation:uss-frame-spin 7.5s linear infinite}',
            '.uss-has-frame::after{content:"";position:absolute;left:50%;top:50%;width:156%;height:156%;transform:translate(-50%,-50%);background:var(--uss-frame-img) center/contain no-repeat;pointer-events:none;z-index:3;animation:uss-frame-glow 4.8s ease-in-out infinite}',
            '.uss-has-frame>.drawer-user-avatar,.uss-has-frame .nav-user-avatar,.uss-has-frame .oopz-bridge-member-avatar,.uss-has-frame .market-seller-card__avatar,.uss-has-frame .checkin-member-avatar{border:none;box-shadow:none}',
            '.nav-login-avatar-inner.uss-has-frame{width:2.45rem;height:2.45rem;flex:none;z-index:2}',
            '@media (max-width:600px){.nav-login-avatar-inner.uss-has-frame{width:2rem;height:2rem}}',
            '.nav-login-avatar-inner.uss-has-frame .nav-user-avatar{width:100%;height:100%;max-width:none;max-height:none}',
            '.uss-has-frame img,.nav-login-avatar-inner.uss-has-frame,.oopz-bridge-member-avatar-wrap.uss-has-frame .oopz-bridge-member-avatar,.market-seller-card__avatar-wrap.uss-has-frame .market-seller-card__avatar,.checkin-member-avatar.uss-has-frame{border-radius:50%}',
            '@keyframes uss-frame-spin{to{--uss-frame-turn:360deg}}',
            '@keyframes uss-frame-glow{0%,100%{filter:drop-shadow(0 0 2px rgba(212,160,48,.4))}50%{filter:drop-shadow(0 0 5px rgba(255,214,110,.62))}}',
            '@property --uss-frame-turn{syntax:"<angle>";inherits:false;initial-value:0deg}'
        ].join('');
        document.head.appendChild(frameStyle);
    }
    if (!document.querySelector('script[src*="avatar-frame.js"]')) {
    var frameScript = document.createElement('script');
    frameScript.src = 'avatar-frame.js?v=16';
    frameScript.defer = true;
    document.body.appendChild(frameScript);
    }
    var redeem = document.getElementById('ussDonateRedeem');
    var redeemBtn = document.getElementById('ussDonateRedeemBtn');
    var redeemMsg = document.getElementById('ussDonateRedeemMsg');
    var redeemInput = document.getElementById('ussDonateRedeemInput');
    var redeemMake = document.getElementById('ussDonateRedeemMake');
    var redeemGo = document.getElementById('ussDonateRedeemGo');
    var redeemBusy = false;

    function setRedeemBusy(on, label) {
        redeemBusy = !!on;
        if (redeemMake) redeemMake.disabled = redeemBusy;
        if (redeemGo) redeemGo.disabled = redeemBusy;
        if (redeemInput) redeemInput.disabled = redeemBusy;
        if (on && redeemMsg && label) redeemMsg.textContent = label;
    }

    function normalizeRedeemCode(raw) {
        return String(raw || '').trim().toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 10);
    }

    function waitAvatarFrame() {
        if (window.UssAvatarFrame && window.UssAvatarFrame.authFetch) {
            return Promise.resolve(window.UssAvatarFrame);
        }
        return new Promise(function (resolve, reject) {
            var n = 0;
            var timer = setInterval(function () {
                n += 1;
                if (window.UssAvatarFrame && window.UssAvatarFrame.authFetch) {
                    clearInterval(timer);
                    resolve(window.UssAvatarFrame);
                } else if (n > 40) {
                    clearInterval(timer);
                    reject(new Error('兑换组件还没加载完，请稍后再试。'));
                }
            }, 50);
        });
    }

    if (redeemBtn && redeem) {
        redeemBtn.addEventListener('click', function () {
            redeem.hidden = !redeem.hidden;
            var sess = window.UssAvatarFrame && window.UssAvatarFrame.session ? window.UssAvatarFrame.session() : null;
            if (redeemMake) redeemMake.hidden = !(sess && sess.isSuperAdmin);
        });
    }
    if (redeemMake) {
        redeemMake.addEventListener('click', function () {
            if (redeemBusy) return;
            setRedeemBusy(true, '正在生成兑换码…');
            waitAvatarFrame().then(function (api) {
                return api.authFetch('/api/site/avatar-redeem-codes', {}, {
                    onRetry: function (n, max) {
                        if (redeemMsg) redeemMsg.textContent = '线路不稳，正在重试（' + n + '/' + max + ')…';
                    }
                });
            }).then(function (data) {
                if (redeemInput) redeemInput.value = data.code || '';
                if (redeemMsg) redeemMsg.textContent = '兑换码已生成，发给充电用户即可。';
            }).catch(function (err) {
                if (redeemMsg) redeemMsg.textContent = (err && err.message) || '兑换码没有生成。';
            }).then(function () {
                setRedeemBusy(false);
            });
        });
    }
    if (redeemGo) {
        redeemGo.addEventListener('click', function () {
            if (redeemBusy) return;
            var code = normalizeRedeemCode(redeemInput ? redeemInput.value : '');
            if (redeemInput) redeemInput.value = code;
            if (!/^[A-F0-9]{10}$/.test(code)) {
                if (redeemMsg) redeemMsg.textContent = '兑换码不正确。';
                return;
            }
            setRedeemBusy(true, '正在兑换…');
            waitAvatarFrame().then(function (api) {
                return api.authFetch('/api/site/avatar-redeem', { code: code }, {
                    onRetry: function (n, max) {
                        if (redeemMsg) redeemMsg.textContent = '线路不稳，正在重试（' + n + '/' + max + ')…';
                    }
                });
            }).then(function (data) {
                if (redeemMsg) {
                    redeemMsg.textContent = data && data.already
                        ? '账号已有头像框，可直接佩戴。'
                        : '兑换成功。点开头像即可佩戴。';
                }
            }).catch(function (err) {
                if (redeemMsg) redeemMsg.textContent = (err && err.message) || '兑换没有完成。';
            }).then(function () {
                setRedeemBusy(false);
            });
        });
    }
    if (redeemInput) {
        redeemInput.addEventListener('blur', function () {
            redeemInput.value = normalizeRedeemCode(redeemInput.value);
        });
    }

    if (!document.querySelector('script[src*="visit-tracker.js"]')) {
        var visitScript = document.createElement('script');
        visitScript.src = 'visit-tracker.js?v=2';
        visitScript.defer = true;
        document.body.appendChild(visitScript);
    }
})();
