/**
 * 商城 — 售卖 / 收购列表与新建交易单据
 */
(function () {
    'use strict';

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var API_BASE = (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';

    var TYPE_TO_NAV_GROUP = (function () {
        var map = {};
        var groups = {
            component: ['cooling', 'power', 'shield', 'quantum', 'jump', 'radar'],
            weapon: ['ship_weapon', 'ship_missile', 'missile_rack', 'ship_turret'],
            other: ['mining_laser', 'ship_module', 'salvage_scraper', 'fuel_nozzle'],
            fps_weapon: [
                'weapon_pistol', 'weapon_smg', 'weapon_rifle', 'weapon_sniper',
                'weapon_shotgun', 'weapon_lmg', 'weapon_launcher', 'weapon_crossbow',
                'weapon_throwable', 'weapon_melee', 'weapon_misc',
            ],
            fps_armor: ['armor_helmet', 'armor_torso', 'armor_legs', 'armor_arms', 'armor_backpack', 'armor_undersuit'],
            fps_magazine: [
                'magazine', 'attachment_ironsight', 'attachment_barrel',
                'attachment_bottom', 'attachment_utility', 'attachment_missile',
            ],
        };
        Object.keys(groups).forEach(function (gk) {
            groups[gk].forEach(function (t) { map[t] = gk; });
        });
        return map;
    })();

    var MAIN_CATEGORY_GROUPS = {
        component: 1,
        weapon: 1,
        fps_weapon: 1,
        fps_magazine: 1,
        fps_armor: 1,
    };

    var CATEGORY_LABELS = {
        component: '舰船组件',
        weapon: '舰船武器',
        other: '其他',
        fps_weapon: '个人武器',
        fps_magazine: '武器配件',
        fps_armor: '个人护甲',
        hq_points: '签到积分',
    };

    var CATEGORY_GROUPS = [
        { id: '', label: '全部' },
        { id: 'component', label: '舰船组件' },
        { id: 'weapon', label: '舰船武器' },
        { id: 'fps_weapon', label: '个人武器' },
        { id: 'fps_magazine', label: '武器配件' },
        { id: 'fps_armor', label: '个人护甲' },
        { id: 'other', label: '其他' },
    ];

    var STATION_ZH = {
        'Port Olisar': '奥丽莎空间站',
        'Port Tressler': '特雷斯勒空间站',
        'Everus Harbor': '埃弗勒斯空间站',
        'Baijini Point': '拜基尼空间站',
        'Checkmate Station': '死局空间站',
        'Checkmate': '死局空间站',
        'Ruin Station': '废墟空间站',
        'Ruin': '废墟空间站',
        'Seraphim Station': '炽天使空间站',
        'Seraphim': '炽天使空间站',
        'Gaslight': '煤气灯空间站',
        "Rat's Nest": '鼠巢空间站',
        'Endgame': '终局空间站',
        'Starlight Service Station': '星光服务站',
        'Grim HEX': '六角湾',
        'GrimHEX': '六角湾',
        'Orison': '奥里森',
        'Lorville': '罗威尔',
        'Area18': '18区',
        'Area 18': '18区',
        'New Babbage': '新巴贝奇',
        'Levski': '列夫斯基',
        'Orbituary': '轨道讣闻站',
        'Dudley & Daughters': '达德利父女空间站',
        'HUR-L5 High Course Station': '赫-L5 高速路线站',
        'ARC-L1 Wide Forest Station': '弧-L1 广袤森林站',
        'MIC-L5 Modern Icarus Station': '微-L5 现代伊卡洛斯站',
        'CRU-L1 Ambitious Dream Station': '十-L1 雄心伟梦站',
    };

    var SYSTEM_ZH = {
        Stanton: '斯坦顿',
        Pyro: '派罗',
        Nyx: '尼克斯',
    };

    var MAJOR_STATIONS = [
        { name: '奥丽莎空间站', nameEn: 'Port Olisar', system: 'Stanton' },
        { name: '特雷斯勒空间站', nameEn: 'Port Tressler', system: 'Stanton' },
        { name: '埃弗勒斯空间站', nameEn: 'Everus Harbor', system: 'Stanton' },
        { name: '拜基尼空间站', nameEn: 'Baijini Point', system: 'Stanton' },
        { name: '炽天使空间站', nameEn: 'Seraphim Station', system: 'Stanton' },
        { name: '死局空间站', nameEn: 'Checkmate Station', system: 'Pyro' },
        { name: '废墟空间站', nameEn: 'Ruin Station', system: 'Pyro' },
        { name: '煤气灯空间站', nameEn: 'Gaslight', system: 'Pyro' },
        { name: '鼠巢空间站', nameEn: "Rat's Nest", system: 'Pyro' },
        { name: '终局空间站', nameEn: 'Endgame', system: 'Pyro' },
        { name: '星光服务站', nameEn: 'Starlight Service Station', system: 'Pyro' },
        { name: '六角湾', nameEn: 'Grim HEX', system: 'Stanton' },
        { name: '奥里森', nameEn: 'Orison', system: 'Stanton' },
        { name: '罗威尔', nameEn: 'Lorville', system: 'Stanton' },
        { name: '18区', nameEn: 'Area18', system: 'Stanton' },
        { name: '新巴贝奇', nameEn: 'New Babbage', system: 'Stanton' },
        { name: '列夫斯基', nameEn: 'Levski', system: 'Nyx' },
    ];

    var CART_SVG =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M6 6h15l-1.5 9H7.5L6 6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<circle cx="9" cy="19" r="1.5" fill="currentColor"/>' +
        '<circle cx="17" cy="19" r="1.5" fill="currentColor"/>' +
        '<path d="M6 6L5 3H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>';

    var DEFAULT_QUALITY = 500;

    function refreshNavLoginState() {
        try {
            var root = document.documentElement;
            if (isLoggedIn()) root.classList.add('auth-session-cached');
            else root.classList.remove('auth-session-cached');
        } catch (e) { /* ignore */ }
        var btn = document.getElementById('navLoginBtn');
        var guestWrap = document.getElementById('navLoginGuestWrap');
        var avatarWrap = document.getElementById('navLoginAvatarWrap');
        var img = document.getElementById('navUserAvatarImg');
        if (!btn || !guestWrap || !avatarWrap || !img) return;
        if (isLoggedIn()) {
            guestWrap.classList.add('is-hidden');
            avatarWrap.classList.remove('is-hidden');
            btn.classList.add('is-logged-in');
            btn.setAttribute('aria-label', '账户');
            img.src = absMediaUrl(loadSession() && loadSession().avatarUrl) || defaultAvatar();
            img.alt = '用户头像';
        } else {
            guestWrap.classList.remove('is-hidden');
            avatarWrap.classList.add('is-hidden');
            btn.classList.remove('is-logged-in');
            btn.setAttribute('aria-label', '登录或注册');
            img.removeAttribute('src');
            img.alt = '';
        }
    }

    var PAGE_SIZE_KEY = 'ussMarketPageSize';
    var PAGE_SIZES = [20, 40, 60];

    var state = {
        tab: 'sell',
        categoryGroup: '',
        searchQ: '',
        orders: [],
        loading: false,
        editingOrderId: null,
        page: 1,
        pageSize: 20,
        create: {
            tradeType: 'currency',
            orderType: 'sell',
            expireDays: 7,
            tradeTimeStart: '20:00',
            tradeTimeEnd: '21:00',
            categoryGroup: '',
            itemInfo: '',
            contact: '',
            location: null,
            items: [{ componentId: null, name: '', categoryGroup: null, typeLabel: '', quantity: 1, pricePerUnit: '', quality: DEFAULT_QUALITY }],
            autoImage: null,
            userImage: null,
            existingImage: null,
            barterWant: { componentId: null, name: '', nameZh: null, categoryGroup: null, typeLabel: '', quantity: 1, quality: DEFAULT_QUALITY },
            barterWantCategoryGroup: '',
            barterWantAutoImage: null,
            barterWantUserImage: null,
            barterWantExistingImage: null,
        },
    };

    var el = {};
    var searchTimer = null;
    var itemSuggestTimer = null;
    var itemSuggestController = null;
    var wantItemSuggestTimer = null;
    var wantItemSuggestController = null;
    var locSuggestTimer = null;

    function $(id) { return document.getElementById(id); }

    function joinUrl(path) {
        return String(API_BASE).replace(/\/$/, '') + path;
    }

    function loadSession() {
        if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.loadAuthSession === 'function') {
            return window.UssAuthSessionSync.loadAuthSession();
        }
        try {
            var raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { return null; }
        return null;
    }

    function isLoggedIn() {
        var s = loadSession();
        return !!(s && s.token);
    }

    function hasVerifiedRsiBind() {
        var s = loadSession();
        return !!(s && s.rsiBindLocked);
    }

    function openRsiBindPanel() {
        if (typeof window.openRsiBindSettings === 'function') {
            window.openRsiBindSettings();
            return;
        }
        if (typeof window.openAccountSettings === 'function') {
            window.openAccountSettings();
            if (typeof window.showAccountSettingsPanel === 'function') {
                window.showAccountSettingsPanel('rsi');
            }
        }
    }

    function ensureRsiBindThen(next) {
        if (typeof next !== 'function') return;
        if (hasVerifiedRsiBind()) {
            next();
            return;
        }
        askConfirm({
            title: '需要 RSI 绑定',
            message: '发布挂单前须先完成 RSI 绑定（验证公民 Handle）。绑定完成后即可挂单。',
            confirmText: '去绑定',
            cancelText: '取消',
        }).then(function (ok) {
            if (ok) openRsiBindPanel();
        });
    }

    function apiErrorText(data, fallback) {
        if (data && data.code && window.UssApiError && typeof window.UssApiError.formatUserError === 'function') {
            var hinted = window.UssApiError.formatUserError(data.code);
            if (hinted) return hinted;
        }
        return (data && data.message) || fallback;
    }

    function accountEmail() {
        var s = loadSession();
        return s && s.email ? String(s.email).trim() : '';
    }

    function authHeaders() {
        var s = loadSession();
        if (!s || !s.token) return {};
        return { Authorization: 'Bearer ' + s.token };
    }

    function absMediaUrl(rel) {
        if (!rel) return '';
        var s = String(rel);
        if (/^data:/i.test(s) || /^blob:/i.test(s)) return s;
        if (/^https?:\/\//i.test(s)) {
            try {
                var abs = new URL(s);
                if (/\/(?:api\/market\/uploads|market-uploads)\//i.test(abs.pathname)) {
                    return joinUrl('/api/market/uploads/' + abs.pathname.split('/').pop());
                }
            } catch (e) { /* keep original */ }
            return s;
        }
        if (/\/(?:api\/market\/uploads|market-uploads)\//i.test(s)) {
            return joinUrl('/api/market/uploads/' + s.split('/').pop().split('?')[0]);
        }
        return joinUrl(s.charAt(0) === '/' ? s : '/' + s);
    }

    function hqPointsImageUrl() {
        return 'market-hq-points.webp';
    }

    function componentImageUrl(componentId) {
        if (!componentId) return '';
        return joinUrl('/api/sc/components/image/' + encodeURIComponent(componentId));
    }

    function defaultAvatar() {
        return window.USS_DEFAULT_AVATAR || 'default-avatar.webp';
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatTradeCount(seller) {
        var n = seller && seller.completedTradeCount != null ? Number(seller.completedTradeCount) : 0;
        if (!Number.isFinite(n) || n < 0) n = 0;
        return n;
    }

    function maskAuthorName(raw) {
        var s = String(raw || '').trim();
        if (!s || s === '—') return { display: '—', full: '' };
        if (s.length === 1) return { display: '*', full: s };
        if (s.length === 2) return { display: s.charAt(0) + '*', full: s };
        if (s.length <= 4) return { display: s.charAt(0) + '**' + s.charAt(s.length - 1), full: s };
        return { display: s.slice(0, 2) + '***' + s.slice(-1), full: s };
    }

    function maskSidDisplay(sid) {
        var s = String(sid || '').trim();
        if (!s) return '';
        if (s.length === 1) return '*';
        if (s.length === 2) return s.charAt(0) + '*';
        if (s.indexOf('*') !== -1) return s;
        return s.charAt(0) + '***';
    }

    function maskEmailDisplay(email) {
        var s = String(email || '').trim();
        if (!s) return '';
        var at = s.indexOf('@');
        if (at < 1) {
            if (s.length <= 2) return s.charAt(0) + '***';
            return s.slice(0, 2) + '****';
        }
        var local = s.slice(0, at);
        var domain = s.slice(at);
        if (local.length <= 2) return local.charAt(0) + '***' + domain;
        return local.slice(0, 2) + '****' + domain;
    }

    function renderCardFooterHtml(order, seller, avatarUrl, opts) {
        opts = opts || {};
        var masked = maskAuthorName(order.authorHandle || (order.seller && order.seller.bindingId) || '—');
        var it0 = (order.items && order.items[0]) || {};
        var loc = (order.location && order.location.name) || '未指定地点';
        var qty = it0.quantity || 1;
        var leftChips = '';
        if (order.isFleetMember) {
            leftChips += '<span class="market-footer-chip market-footer-chip--fleet" title="舰队成员">舰队</span>';
        }
        leftChips +=
            '<span class="market-footer-chip market-footer-chip--trade" title="已完成交易数">交易：' +
            escapeHtml(formatTradeCount(seller)) +
            '</span>';
        var rightChips =
            '<span class="market-footer-chip" title="交易位置"><span class="market-footer-chip__k">位置</span>' +
            escapeHtml(loc) +
            '</span>' +
            '<span class="market-footer-chip market-footer-chip--qty" title="可购数量"><span class="market-footer-chip__k">数量</span>' +
            escapeHtml(String(qty)) +
            '</span>';
        var manageCls = opts.manage ? ' market-card__footer--manage' : '';
        return (
            '<div class="market-card__footer' +
            manageCls +
            '">' +
            '<div class="market-card__footer-head">' +
            '<img class="market-card__avatar" src="' +
            escapeHtml(avatarUrl) +
            '" alt="">' +
            '<span class="market-card__author-name">' +
            escapeHtml(masked.display) +
            '</span>' +
            '</div>' +
            '<div class="market-card__footer-tags">' +
            '<div class="market-card__footer-tags-left">' +
            leftChips +
            '</div>' +
            '<div class="market-card__footer-tags-right">' +
            rightChips +
            '</div>' +
            '</div></div>'
        );
    }

    function inferNavGroupFromType(typeKey) {
        return TYPE_TO_NAV_GROUP[String(typeKey || '').trim()] || null;
    }

    function itemDisplayName(it) {
        if (!it) return '';
        var zh = String(it.name_zh || it.nameZh || '').trim();
        var en = String(it.name_en || it.name || '').trim();
        if (zh && en && zh !== en) return zh + ' (' + en + ')';
        return zh || en || '';
    }

    function itemTypeLabel(it) {
        return (it && (it.type_label_zh || it.type_label || it.type)) || '';
    }

    function itemComponentId(it) {
        if (!it) return null;
        return it.id_item || it.componentId || it.id || null;
    }

    function isOtherCategory(group) {
        var g = String(group || '').trim();
        if (!g) return true;
        if (g === 'other' || g === 'fuel_nozzle' || g === 'mining' || g === 'salvage') return true;
        return !MAIN_CATEGORY_GROUPS[g];
    }

    function categoryLabel(group) {
        var g = String(group || '').trim();
        if (g === 'hq_points') return '签到积分';
        if (isOtherCategory(group)) return '其他';
        return CATEGORY_LABELS[group] || '其他';
    }

    function normalizeQuality(value) {
        if (value === '' || value == null) return DEFAULT_QUALITY;
        var n = Number(value);
        if (!Number.isFinite(n)) return DEFAULT_QUALITY;
        return Math.max(0, Math.min(1000, Math.round(n)));
    }

    function itemQuality(it) {
        return normalizeQuality(it && it.quality != null ? it.quality : DEFAULT_QUALITY);
    }

    function isSuperAdminSession() {
        var s = loadSession();
        return !!(s && s.isSuperAdmin);
    }

    function isPrivilegedSession() {
        var s = loadSession();
        return !!(s && (s.isSuperAdmin || s.isAdmin));
    }

    function isHqPointsItem(it) {
        if (!it) return false;
        if (String(it.componentId || '').trim() === 'uss-hq-points') return true;
        var n = String(it.name || it.nameZh || '').replace(/\s+/g, '');
        return n === '积分' || n === 'USS总部积分' || n === 'USS总部签到积分';
    }

    function isHqPointsListing(order) {
        if (!order || order.tradeType !== 'barter' || !order.items) return false;
        return isHqPointsItem(order.items[0]) || isHqPointsItem(order.items[1]);
    }

    function hqPointsSuggestItem() {
        return {
            id_item: 'uss-hq-points',
            name: '积分',
            name_zh: 'USS总部签到积分',
            name_en: 'HQ Check-in Points',
            type: 'hq_points',
            type_label_zh: 'USS总部签到积分',
            _hqPoints: true,
        };
    }

    function withHqPointsSuggest(q, items) {
        var list = Array.isArray(items) ? items.slice() : [];
        if (!isSuperAdminSession() || state.create.tradeType !== 'barter') return list;
        var t = String(q || '').trim();
        if (!t || t.indexOf('积分') < 0) return list;
        list.unshift(hqPointsSuggestItem());
        return list;
    }

    function coerceTypedHqPoints(it) {
        if (!it || !isSuperAdminSession() || state.create.tradeType !== 'barter') return it;
        if (!isHqPointsItem(it) && String(it.name || '').trim() !== '积分') return it;
        it.componentId = 'uss-hq-points';
        it.name = '积分';
        it.nameZh = 'USS总部签到积分';
        it.categoryGroup = 'hq_points';
        it.typeLabel = 'USS总部签到积分';
        return it;
    }

    function formatQualityBrief(order) {
        var it = (order.items && order.items[0]) || {};
        if (isHqPointsItem(it)) return 'USS总部签到积分 ×' + String(it.hqPointsAmount || it.quantity || 1);
        return '品质 ' + itemQuality(it);
    }

    function formatPrice(order) {
        if (order.tradeType === 'barter') {
            var want = (order.items && order.items[1]) || {};
            var offer = (order.items && order.items[0]) || {};
            if (isHqPointsItem(want)) {
                return '换取 积分 ×' + String(want.hqPointsAmount || want.quantity || 1);
            }
            if (isHqPointsItem(offer)) {
                return '给出 积分 ×' + String(offer.hqPointsAmount || 1);
            }
            var wantName = want.nameZh || want.name;
            if (wantName) return '换取 ' + wantName;
            return '物品置换';
        }
        var item = (order.items && order.items[0]) || {};
        if (item.pricePerUnit == null) return '面议';
        return Number(item.pricePerUnit).toLocaleString('zh-CN') + ' aUEC';
    }

    function formatPriceTotal(order, quantity) {
        if (order.tradeType === 'barter') return formatPrice(order);
        var item = (order.items && order.items[0]) || {};
        if (item.pricePerUnit == null) return '面议';
        var qty = Math.max(1, Math.floor(Number(quantity) || 1));
        var unit = Number(item.pricePerUnit);
        if (qty <= 1) return unit.toLocaleString('zh-CN') + ' aUEC';
        return (
            unit.toLocaleString('zh-CN') +
            ' aUEC × ' +
            qty +
            ' = ' +
            (unit * qty).toLocaleString('zh-CN') +
            ' aUEC'
        );
    }

    function wantItemName(order) {
        var it = (order.items && order.items[1]) || {};
        return it.nameZh || it.name || '';
    }

    function wantImageSrc(order) {
        var it1 = (order.items && order.items[1]) || {};
        if (order.images && order.images[1]) return absMediaUrl(order.images[1]);
        if (isHqPointsItem(it1)) return hqPointsImageUrl();
        if (it1.componentId) return componentImageUrl(it1.componentId);
        return '';
    }

    function emptyBarterWant() {
        return {
            componentId: null,
            name: '',
            nameZh: null,
            categoryGroup: null,
            typeLabel: '',
            quantity: 1,
            quality: DEFAULT_QUALITY,
        };
    }

    function currentWantItem() {
        if (!state.create.barterWant) state.create.barterWant = emptyBarterWant();
        return state.create.barterWant;
    }

    function formatExpires(iso) {
        if (!iso) return '无限';
        var t = Date.parse(iso);
        if (!Number.isFinite(t)) return '无限';
        var d = Math.max(0, Math.ceil((t - Date.now()) / 86400000));
        return d + ' 天';
    }

    function formatDateMinute(iso) {
        if (!iso) return '';
        var t = Date.parse(String(iso));
        if (!Number.isFinite(t)) return '';
        var d = new Date(t);
        function pad(n) { return n < 10 ? '0' + n : String(n); }
        return (
            d.getFullYear() +
            '-' + pad(d.getMonth() + 1) +
            '-' + pad(d.getDate()) +
            ' ' + pad(d.getHours()) +
            ':' + pad(d.getMinutes())
        );
    }

    function formatDateShort(iso) {
        if (!iso) return '';
        var t = Date.parse(String(iso));
        if (!Number.isFinite(t)) return '';
        var d = new Date(t);
        var day = d.getDate();
        return (d.getMonth() + 1) + '-' + (day < 10 ? '0' + day : String(day));
    }

    function formatDateYmd(iso) {
        if (!iso) return '';
        var t = Date.parse(String(iso));
        if (!Number.isFinite(t)) return '';
        var d = new Date(t);
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }

    function dateTimeHtml(iso, extraClass) {
        var day = formatDateYmd(iso);
        if (!day) return '';
        var cls = 'market-datetime' + (extraClass ? ' ' + extraClass : '');
        return (
            '<time class="' + cls + '" datetime="' + escapeHtml(String(iso)) + '">' +
            escapeHtml(day) +
            '</time>'
        );
    }

    function timeLineHtml(label, iso) {
        var stamp = dateTimeHtml(iso);
        if (!stamp) return '';
        return (
            '<p class="market-time-line">' +
            '<span class="market-time-line__label">' + escapeHtml(label) + '</span>' +
            stamp +
            '</p>'
        );
    }

    function isSameMinute(a, b) {
        var left = formatDateMinute(a);
        var right = formatDateMinute(b);
        return !!(left && right && left === right);
    }

    function listingUpdatedAt(order) {
        if (!order) return '';
        if (isSameMinute(order.updatedAt, order.createdAt)) return '';
        return order.updatedAt || '';
    }

    function primaryItemName(order) {
        var it = (order.items && order.items[0]) || {};
        return it.nameZh || it.name || '未填物品';
    }

    function primaryCategory(order) {
        var it = (order.items && order.items[0]) || {};
        return categoryLabel(it.categoryGroup);
    }

    function currentItem() {
        if (!state.create.items.length) {
            state.create.items.push({
                componentId: null,
                name: '',
                categoryGroup: null,
                typeLabel: '',
                quantity: 1,
                pricePerUnit: '',
                quality: DEFAULT_QUALITY,
            });
        }
        return state.create.items[0];
    }

    function showGate(msg) {
        if (!el.gate) return;
        el.gate.textContent = msg || '请先登录后访问星巢贸易';
        el.gate.classList.remove('is-hidden');
        if (el.content) el.content.hidden = true;
    }

    function hideGate() {
        if (el.gate) el.gate.classList.add('is-hidden');
        if (el.content) el.content.hidden = false;
    }

    function initHeroParallax() {
        var hero = document.querySelector('.market-hero');
        if (!hero) return;

        var reduceMotion =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var mobileHero =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(max-width: 600px)').matches;
        if (reduceMotion || mobileHero) return;

        var MAX_PAN_X = 10;
        var MAX_PAN_Y = 8;
        var targetX = 0;
        var targetY = 0;
        var curX = 0;
        var curY = 0;
        var active = false;
        var tickId = 0;

        function applyTransform() {
            var px = (curX * MAX_PAN_X).toFixed(2);
            var py = (curY * MAX_PAN_Y).toFixed(2);
            hero.style.setProperty('--market-hero-pan-x', px + 'px');
            hero.style.setProperty('--market-hero-pan-y', py + 'px');
        }

        function tick() {
            tickId = window.requestAnimationFrame(function () {
                var ease = active ? 0.11 : 0.07;
                curX += (targetX - curX) * ease;
                curY += (targetY - curY) * ease;
                applyTransform();
                if (Math.abs(curX - targetX) > 0.0005 || Math.abs(curY - targetY) > 0.0005) {
                    tick();
                } else {
                    curX = targetX;
                    curY = targetY;
                    applyTransform();
                    tickId = 0;
                }
            });
        }

        function queueTick() {
            if (!tickId) tick();
        }

        function onMove(ev) {
            var rect = hero.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            targetX = (ev.clientX - rect.left) / rect.width - 0.5;
            targetY = (ev.clientY - rect.top) / rect.height - 0.5;
            active = true;
            queueTick();
        }

        function onLeave() {
            targetX = 0;
            targetY = 0;
            active = false;
            queueTick();
        }

        hero.addEventListener('mousemove', onMove);
        hero.addEventListener('mouseleave', onLeave);
        window.addEventListener('resize', applyTransform);
        applyTransform();
    }

    async function fetchOrders() {
        state.loading = true;
        renderGrid();
        var params = new URLSearchParams();
        params.set('orderType', state.tab === 'sell' ? 'sell' : 'buy');
        if (state.searchQ) params.set('q', state.searchQ);
        if (state.categoryGroup) params.set('categoryGroup', state.categoryGroup);
        try {
            var r = await fetch(joinUrl('/api/market/orders?' + params.toString()), {
                headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
            });
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok) throw new Error((data && data.message) || '加载失败');
            state.orders = Array.isArray(data.orders) ? data.orders : [];
        } catch (e) {
            state.orders = [];
            if (el.gridEmpty) {
                el.gridEmpty.hidden = false;
                el.gridEmpty.textContent = (e && e.message) || '加载订单失败';
            }
        } finally {
            state.loading = false;
            state.page = 1;
            renderGrid();
        }
    }

    function readPageSize() {
        try {
            var n = Number(localStorage.getItem(PAGE_SIZE_KEY));
            if (PAGE_SIZES.indexOf(n) >= 0) return n;
        } catch (e) { /* ignore */ }
        return 20;
    }

    function pagedOrders() {
        var size = PAGE_SIZES.indexOf(state.pageSize) >= 0 ? state.pageSize : 20;
        var total = state.orders.length;
        var pages = Math.max(1, Math.ceil(total / size) || 1);
        if (state.page > pages) state.page = pages;
        if (state.page < 1) state.page = 1;
        var start = (state.page - 1) * size;
        return state.orders.slice(start, start + size);
    }

    function renderPager() {
        if (!el.pager) return;
        var total = state.orders.length;
        if (!total || state.loading) {
            el.pager.hidden = true;
            el.pager.innerHTML = '';
            return;
        }
        el.pager.hidden = false;
        var size = PAGE_SIZES.indexOf(state.pageSize) >= 0 ? state.pageSize : 20;
        var pages = Math.max(1, Math.ceil(total / size));
        var sizeOpts = PAGE_SIZES.map(function (n) {
            return '<option value="' + n + '"' + (n === size ? ' selected' : '') + '>' + n + '</option>';
        }).join('');
        var btns = '';
        var i;
        for (i = 1; i <= pages; i++) {
            btns += '<button type="button" class="market-pager__btn' + (i === state.page ? ' is-active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }
        el.pager.innerHTML =
            '<label class="market-pager__size">每页 <select id="marketPageSize" aria-label="每页条数">' + sizeOpts + '</select></label>' +
            '<div class="market-pager__pages">' +
            '<button type="button" class="market-pager__btn" data-page="prev"' + (state.page <= 1 ? ' disabled' : '') + '>上一页</button>' +
            btns +
            '<button type="button" class="market-pager__btn" data-page="next"' + (state.page >= pages ? ' disabled' : '') + '>下一页</button>' +
            '</div>' +
            '<span class="market-pager__meta">共 ' + total + ' 条</span>';
    }

    function isFleetMemberSession() {
        var s = loadSession();
        if (!s) return false;
        if (s.isSuperAdmin || s.isAdmin) return true;
        return String(s.memberKind || '').toLowerCase() !== 'civilian';
    }

    function orderImageSrc(order) {
        var it0 = (order.items && order.items[0]) || {};
        if (order.images && order.images[0]) {
            return absMediaUrl(order.images[0]);
        }
        if (isHqPointsItem(it0)) return hqPointsImageUrl();
        if (it0.componentId) {
            return componentImageUrl(it0.componentId);
        }
        return '';
    }

    function cardMediaHtml(order) {
        var img = orderImageSrc(order);
        if (img) {
            var fallback = '';
            var it0 = (order.items && order.items[0]) || {};
            if (it0.componentId && !isHqPointsItem(it0)) {
                fallback = componentImageUrl(it0.componentId);
            }
            return '<img src="' + escapeHtml(img) + '"' +
                (fallback && fallback !== img ? ' data-fallback="' + escapeHtml(fallback) + '"' : '') +
                ' alt="" loading="lazy" decoding="async" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback}else{this.onerror=null;this.classList.add(\'is-broken\');this.alt=\'\';var p=this.parentNode;if(p&&!p.querySelector(\'.market-card__media--empty\')){var s=document.createElement(\'span\');s.className=\'market-card__media--empty\';s.textContent=\'?\';p.appendChild(s);}}">';
        }
        var it0m = (order.items && order.items[0]) || {};
        if (isHqPointsItem(it0m)) {
            return '<span class="market-card__media--empty market-card__media--points">分</span>';
        }
        var initial = escapeHtml(primaryItemName(order).charAt(0) || '?');
        return '<span class="market-card__media--empty">' + initial + '</span>';
    }

    var FLOW_ACK_KEY = 'ussMarketFlowAck.v2';
    var TERMS_ACK_KEY = 'ussMarketTermsAck.v1';
    var FLOW_FORCE_SECONDS = 5;
    var flowForceTimer = null;
    var flowForceDeadline = 0;
    var flowForceOnAck = null;
    var flowForceKind = '';

    function flowAckStorageKey() {
        var sess = loadSession();
        var bid = sess && sess.bindingId ? String(sess.bindingId).trim().toLowerCase() : '';
        return FLOW_ACK_KEY + ':' + (bid || 'anon');
    }

    function readFlowAck() {
        try {
            var raw = localStorage.getItem(flowAckStorageKey());
            var data = raw ? JSON.parse(raw) : {};
            return { mute: !!data.mute };
        } catch (e) {
            return { mute: false };
        }
    }

    function writeFlowMute() {
        try {
            localStorage.setItem(flowAckStorageKey(), JSON.stringify({ mute: true, at: new Date().toISOString() }));
        } catch (e) { /* ignore */ }
    }

    function hasFlowAck() {
        return readFlowAck().mute;
    }

    function clearFlowForceTimer() {
        if (flowForceTimer) {
            clearInterval(flowForceTimer);
            flowForceTimer = null;
        }
        flowForceDeadline = 0;
    }

    function flowForceRemain() {
        if (!flowForceDeadline) return 0;
        return Math.max(0, Math.ceil((flowForceDeadline - Date.now()) / 1000));
    }

    function syncBodyScrollLock() {
        var locked =
            (el.termsBackdrop && !el.termsBackdrop.hidden) ||
            (el.flowBackdrop && !el.flowBackdrop.hidden) ||
            (el.detailBackdrop && !el.detailBackdrop.hidden) ||
            (el.confirmBackdrop && !el.confirmBackdrop.hidden);
        document.body.style.overflow = locked ? 'hidden' : '';
    }

    var confirmResolver = null;
    var confirmPromptMode = false;
    var confirmPromptRequired = false;
    var confirmPromptValue = '';

    function resetConfirmPromptUi() {
        confirmPromptMode = false;
        confirmPromptRequired = false;
        confirmPromptValue = '';
        if (el.confirmModal) el.confirmModal.classList.remove('market-confirm--prompt');
        if (el.confirmPromptWrap) el.confirmPromptWrap.hidden = true;
        if (el.confirmPromptInput) {
            el.confirmPromptInput.value = '';
            el.confirmPromptInput.removeAttribute('aria-invalid');
        }
        if (el.confirmPromptError) {
            el.confirmPromptError.hidden = true;
            el.confirmPromptError.textContent = '';
        }
    }

    function closeConfirmModal(result) {
        if (el.confirmBackdrop) el.confirmBackdrop.hidden = true;
        syncBodyScrollLock();
        var resolve = confirmResolver;
        var promptMode = confirmPromptMode;
        var promptValue = confirmPromptValue;
        confirmResolver = null;
        resetConfirmPromptUi();
        if (!resolve) return;
        if (promptMode) resolve(result ? promptValue : null);
        else resolve(!!result);
    }

    function submitConfirmModal() {
        if (confirmPromptMode) {
            var val = el.confirmPromptInput ? String(el.confirmPromptInput.value || '').trim() : '';
            if (confirmPromptRequired && !val) {
                if (el.confirmPromptError) {
                    el.confirmPromptError.textContent = '请填写下架理由';
                    el.confirmPromptError.hidden = false;
                }
                if (el.confirmPromptInput) {
                    el.confirmPromptInput.setAttribute('aria-invalid', 'true');
                    el.confirmPromptInput.focus();
                }
                return;
            }
            if (el.confirmPromptError) {
                el.confirmPromptError.hidden = true;
                el.confirmPromptError.textContent = '';
            }
            if (el.confirmPromptInput) el.confirmPromptInput.removeAttribute('aria-invalid');
            confirmPromptValue = val;
        }
        closeConfirmModal(true);
    }

    function askConfirm(opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            var promptOpts = opts.prompt && typeof opts.prompt === 'object' ? opts.prompt : (opts.prompt ? {} : null);
            if (!el.confirmBackdrop || !el.confirmMessage || !el.confirmOk) {
                if (promptOpts) {
                    var fallback = window.prompt(promptOpts.label || opts.message || '请填写');
                    resolve(fallback == null ? null : String(fallback).trim());
                    return;
                }
                if (opts.notice) {
                    window.alert(opts.message || '');
                    resolve(true);
                    return;
                }
                resolve(window.confirm(opts.message || '确定？'));
                return;
            }
            var notice = !!opts.notice;
            confirmResolver = resolve;
            confirmPromptMode = !!promptOpts;
            confirmPromptRequired = !!(promptOpts && promptOpts.required !== false);
            confirmPromptValue = '';
            if (el.confirmTitle) el.confirmTitle.textContent = opts.title || (notice ? '提示' : '请确认');
            el.confirmMessage.textContent = opts.message || '确定？';
            el.confirmOk.textContent = opts.confirmText || (notice ? '知道了' : '确认');
            if (el.confirmCancel) {
                el.confirmCancel.hidden = notice;
                el.confirmCancel.textContent = opts.cancelText || '再想想';
            }
            if (el.confirmModal) el.confirmModal.classList.toggle('market-confirm--prompt', confirmPromptMode);
            if (el.confirmPromptWrap) el.confirmPromptWrap.hidden = !confirmPromptMode;
            if (el.confirmPromptLabel) {
                el.confirmPromptLabel.textContent = (promptOpts && promptOpts.label) || '下架理由';
            }
            if (el.confirmPromptHint) {
                var hint = promptOpts && promptOpts.hint;
                el.confirmPromptHint.textContent = hint || '最多 200 字，买家可见。';
                el.confirmPromptHint.hidden = !confirmPromptMode;
            }
            if (el.confirmPromptError) {
                el.confirmPromptError.hidden = true;
                el.confirmPromptError.textContent = '';
            }
            if (el.confirmPromptInput) {
                el.confirmPromptInput.value = (promptOpts && promptOpts.value) || '';
                el.confirmPromptInput.placeholder = (promptOpts && promptOpts.placeholder) || '请填写下架理由';
                el.confirmPromptInput.maxLength = (promptOpts && promptOpts.maxLength) || 200;
                el.confirmPromptInput.removeAttribute('aria-invalid');
            }
            el.confirmBackdrop.hidden = false;
            syncBodyScrollLock();
            if (confirmPromptMode && el.confirmPromptInput) el.confirmPromptInput.focus();
            else if (notice) el.confirmOk.focus();
            else if (el.confirmCancel) el.confirmCancel.focus();
        });
    }

    function termsAckStorageKey() {
        var sess = loadSession();
        var bid = sess && sess.bindingId ? String(sess.bindingId).trim().toLowerCase() : '';
        return TERMS_ACK_KEY + ':' + (bid || 'anon');
    }

    function hasTermsAck() {
        try {
            var raw = localStorage.getItem(termsAckStorageKey());
            var data = raw ? JSON.parse(raw) : {};
            return !!data.ack;
        } catch (e) {
            return false;
        }
    }

    function writeTermsAck() {
        try {
            localStorage.setItem(termsAckStorageKey(), JSON.stringify({ ack: true, at: new Date().toISOString() }));
        } catch (e) { /* ignore */ }
    }

    var termsForceOnAck = null;
    var termsForceKind = '';

    function isTermsForced() {
        return !!(el.termsBackdrop && el.termsBackdrop.classList.contains('is-forced'));
    }

    function syncTermsAckBtn() {
        if (!el.termsAckBtn) return;
        var checked = !!(el.termsChk && el.termsChk.checked);
        el.termsAckBtn.disabled = !checked;
        if (!isTermsForced()) {
            el.termsAckBtn.textContent = '关闭';
            el.termsAckBtn.disabled = false;
            return;
        }
        el.termsAckBtn.textContent = checked
            ? (termsForceKind === 'purchase' ? '同意并继续购买' : '同意并继续发布')
            : '请先勾选同意';
    }

    function showTermsGuide(options) {
        options = options || {};
        if (!el.termsBackdrop) return;
        var forced = !!options.forced;
        termsForceKind = forced ? String(options.kind || 'publish') : '';
        termsForceOnAck = forced && typeof options.onAck === 'function' ? options.onAck : null;
        if (el.termsChk) el.termsChk.checked = false;
        el.termsBackdrop.hidden = false;
        el.termsBackdrop.classList.toggle('is-forced', forced);
        if (el.termsBody) el.termsBody.scrollTop = 0;
        if (el.termsForceFoot) el.termsForceFoot.hidden = false;
        if (el.termsChk) {
            var wrap = el.termsChk.closest('.market-terms-check');
            if (wrap) wrap.hidden = !forced && hasTermsAck();
        }
        syncTermsAckBtn();
        syncBodyScrollLock();
        if (el.termsChk && el.termsChk.closest('.market-terms-check') && !el.termsChk.closest('.market-terms-check').hidden) {
            el.termsChk.focus();
        } else if (el.termsAckBtn) {
            el.termsAckBtn.focus();
        }
    }

    function closeTermsGuide(fromAck) {
        if (!el.termsBackdrop) return;
        var pendingAck = fromAck ? termsForceOnAck : null;
        termsForceOnAck = null;
        termsForceKind = '';
        el.termsBackdrop.hidden = true;
        el.termsBackdrop.classList.remove('is-forced');
        if (el.termsChk) el.termsChk.checked = false;
        syncBodyScrollLock();
        if (typeof pendingAck === 'function') pendingAck();
    }

    function ackForcedTerms() {
        if (!isTermsForced()) {
            if (el.termsChk && el.termsChk.checked) writeTermsAck();
            closeTermsGuide(false);
            return;
        }
        if (!el.termsChk || !el.termsChk.checked) return;
        writeTermsAck();
        closeTermsGuide(true);
    }

    function requireTermsAck(kind, thenFn, opts) {
        opts = opts || {};
        if (typeof thenFn !== 'function') return;
        if (!el.termsBackdrop) {
            thenFn();
            return;
        }
        if (!opts.always && hasTermsAck()) {
            thenFn();
            return;
        }
        if (isTermsForced() && termsForceKind === kind) {
            termsForceOnAck = thenFn;
            return;
        }
        showTermsGuide({
            forced: true,
            kind: kind,
            onAck: thenFn,
        });
    }

    function requireMarketAck(kind, thenFn) {
        requireTermsAck(kind, function () {
            requireFlowAck(kind, thenFn);
        });
    }

    function openTermsGuide() {
        if (isTermsForced()) return;
        showTermsGuide({ forced: false });
    }

    function isFlowForced() {
        return !!(el.flowBackdrop && el.flowBackdrop.classList.contains('is-forced'));
    }

    function syncFlowForceUi() {
        if (!el.flowBackdrop) return;
        var forced = isFlowForced();
        var remain = flowForceRemain();
        var wasReady = el.flowBackdrop.classList.contains('is-ack-ready');
        el.flowBackdrop.classList.toggle('is-ack-ready', forced && remain <= 0);
        if (el.flowForceFoot) el.flowForceFoot.hidden = !forced;
        if (el.flowClose) {
            el.flowClose.disabled = forced && remain > 0;
            el.flowClose.setAttribute('aria-hidden', forced && remain > 0 ? 'true' : 'false');
        }
        if (!el.flowAckBtn) return;
        if (!forced) return;
        if (remain > 0) {
            el.flowAckBtn.disabled = true;
            el.flowAckBtn.textContent = '请阅读（' + remain + '）';
        } else {
            el.flowAckBtn.disabled = false;
            el.flowAckBtn.textContent = flowForceKind === 'purchase' ? '我已阅读，继续购买' : '我已阅读，继续发布';
            if (!wasReady) el.flowAckBtn.focus();
        }
    }

    function setFlowPanelFocus(kind) {
        if (!el.flowBackdrop) return;
        var buyer = el.flowBackdrop.querySelector('.market-flow-panel--buyer');
        var seller = el.flowBackdrop.querySelector('.market-flow-panel--seller');
        if (buyer) buyer.classList.toggle('is-focus', kind === 'purchase');
        if (seller) seller.classList.toggle('is-focus', kind === 'publish');
    }

    function showFlowGuide(options) {
        options = options || {};
        if (!el.flowBackdrop) return;
        clearFlowForceTimer();
        var forced = !!options.forced;
        flowForceKind = forced ? String(options.kind || 'publish') : '';
        flowForceOnAck = forced && typeof options.onAck === 'function' ? options.onAck : null;
        el.flowBackdrop.hidden = false;
        el.flowBackdrop.classList.toggle('is-forced', forced);
        el.flowBackdrop.classList.remove('is-ack-ready');
        el.flowBackdrop.scrollTop = 0;
        setFlowPanelFocus(flowForceKind);
        if (el.flowForceHint) {
            el.flowForceHint.textContent = flowForceKind === 'purchase'
                ? '首次购买前请完整阅读交易流程，倒计时结束后才可继续。'
                : '首次发布挂单前请完整阅读交易流程，倒计时结束后才可继续。';
        }
        if (forced) {
            if (el.flowMuteChk) el.flowMuteChk.checked = false;
            flowForceDeadline = Date.now() + FLOW_FORCE_SECONDS * 1000;
            syncFlowForceUi();
            flowForceTimer = setInterval(function () {
                var remain = flowForceRemain();
                syncFlowForceUi();
                if (remain <= 0) clearFlowForceTimer();
            }, 1000);
        } else {
            if (el.flowForceFoot) el.flowForceFoot.hidden = true;
            if (el.flowClose) {
                el.flowClose.disabled = false;
                el.flowClose.setAttribute('aria-hidden', 'false');
            }
        }
        syncBodyScrollLock();
    }

    function closeFlowGuide(fromAck) {
        if (!el.flowBackdrop) return;
        if (isFlowForced() && flowForceRemain() > 0 && !fromAck) return;
        var pendingAck = fromAck ? flowForceOnAck : null;
        clearFlowForceTimer();
        flowForceOnAck = null;
        flowForceKind = '';
        el.flowBackdrop.hidden = true;
        el.flowBackdrop.classList.remove('is-forced', 'is-ack-ready');
        setFlowPanelFocus('');
        if (el.flowForceFoot) el.flowForceFoot.hidden = true;
        if (el.flowClose) {
            el.flowClose.disabled = false;
            el.flowClose.setAttribute('aria-hidden', 'false');
        }
        syncBodyScrollLock();
        if (typeof pendingAck === 'function') pendingAck();
    }

    function ackForcedFlow() {
        if (!isFlowForced() || flowForceRemain() > 0) return;
        if (el.flowMuteChk && el.flowMuteChk.checked) writeFlowMute();
        closeFlowGuide(true);
    }

    function requireFlowAck(kind, thenFn) {
        if (typeof thenFn !== 'function') return;
        if (hasFlowAck() || !el.flowBackdrop) {
            thenFn();
            return;
        }
        if (isFlowForced() && flowForceKind === kind) {
            flowForceOnAck = thenFn;
            return;
        }
        showFlowGuide({
            forced: true,
            kind: kind,
            onAck: thenFn,
        });
    }

    function openFlowGuide() {
        if (isFlowForced()) return;
        showFlowGuide({ forced: false });
    }

    function renderGrid() {
        if (!el.grid) return;
        if (state.loading) {
            el.grid.innerHTML = '';
            if (el.gridEmpty) {
                el.gridEmpty.hidden = false;
                el.gridEmpty.textContent = '加载中…';
            }
            renderPager();
            return;
        }
        if (!state.orders.length) {
            el.grid.innerHTML = '';
            if (el.gridEmpty) {
                el.gridEmpty.hidden = false;
                el.gridEmpty.textContent = state.tab === 'sell' ? '暂无售卖单据' : '暂无收购单据';
            }
            renderPager();
            return;
        }
        if (el.gridEmpty) el.gridEmpty.hidden = true;
        var visible = pagedOrders();
        el.grid.innerHTML = visible.map(function (o) {
            var priceClass = o.tradeType === 'barter' ? ' market-card__price--barter' : '';
            var avatar = absMediaUrl(o.avatarUrl) || defaultAvatar();
            var seller = getSeller(o);
            var extra = formatQualityBrief(o);
            var catLine = escapeHtml(primaryCategory(o)) + ' · ' + escapeHtml(extra);
            var typeMeta = listingTypeMeta(o);
            return (
                '<article class="market-card" data-order-id="' + escapeHtml(o.id) + '" role="listitem" data-listing-type="' + typeMeta.text + '">' +
                '<div class="market-card__media">' +
                cardMediaHtml(o) +
                listingTypeBadgeHtml(o) +
                '</div>' +
                '<div class="market-card__info">' +
                '<div class="market-card__text">' +
                '<span class="market-card__cat">' + catLine + '</span>' +
                '<h2 class="market-card__title">' + escapeHtml(primaryItemName(o)) +
                (o.tradeType !== 'barter' && o.items.length > 1 ? ' 等' + o.items.length + '件' : '') + '</h2>' +
                '<p class="market-card__price' + priceClass + '">' + escapeHtml(formatPrice(o)) + '</p>' +
                '</div>' +
                '<button type="button" class="market-card__cta" aria-label="购买">' + CART_SVG + '</button>' +
                '</div>' +
                '<div class="market-card__times">' + timeLineHtml('上架时间', o.createdAt) + '</div>' +
                renderCardFooterHtml(o, seller, avatar) +
                '</article>'
            );
        }).join('');
        renderPager();
    }

    function renderManageOrderCardHtml(o) {
        var priceClass = o.tradeType === 'barter' ? ' market-card__price--barter' : '';
        var extra = formatQualityBrief(o);
        var catLine = escapeHtml(primaryCategory(o)) + ' · ' + escapeHtml(extra);
        var status = o.status === 'closed' ? '已下架' : '进行中';
        var statusCls = o.status === 'closed' ? ' market-card__manage-status--closed' : '';
        var typeMeta = listingTypeMeta(o);
        return (
            '<article class="market-card market-card--manage' + (o.status === 'closed' ? ' market-card--closed' : '') + '" data-order-id="' + escapeHtml(o.id) + '" role="listitem" data-listing-type="' + typeMeta.text + '">' +
            '<div class="market-card__media">' +
            cardMediaHtml(o) +
            listingTypeBadgeHtml(o) +
            '</div>' +
            '<div class="market-card__info">' +
            '<div class="market-card__text">' +
            '<span class="market-card__cat">' + catLine + '</span>' +
            '<h2 class="market-card__title">' + escapeHtml(primaryItemName(o)) +
            (o.tradeType !== 'barter' && o.items.length > 1 ? ' 等' + o.items.length + '件' : '') + '</h2>' +
            '<p class="market-card__price' + priceClass + '">' + escapeHtml(formatPrice(o)) + '</p>' +
            '</div>' +
            '<span class="market-card__manage-status' + statusCls + '">' + escapeHtml(status) + '</span>' +
            '</div>' +
            '<div class="market-card__times">' +
            timeLineHtml('上架时间', o.createdAt) +
            timeLineHtml('最近更新', listingUpdatedAt(o)) +
            (o.status === 'closed' ? timeLineHtml('下架时间', o.takenDownAt || o.updatedAt) : '') +
            (formatDateMinute(o.expiresAt) ? timeLineHtml('到期时间', o.expiresAt) : '') +
            '</div>' +
            renderCardFooterHtml(o, getSeller(o), absMediaUrl(o.avatarUrl) || defaultAvatar(), { remaining: true, manage: true }) +
            (o.status === 'closed' && o.takedownReason
                ? '<p class="market-card__takedown-reason">下架理由：' + escapeHtml(o.takedownReason) + '</p>'
                : '') +
            '<div class="market-card__manage-actions">' +
            '<button type="button" class="market-btn market-trades-btn-edit" data-order-id="' + escapeHtml(o.id) + '">编辑</button>' +
            (o.status === 'closed'
                ? '<button type="button" class="market-btn market-btn--accent market-trades-btn-relist" data-order-id="' + escapeHtml(o.id) + '">再次上架</button>'
                : '<button type="button" class="market-btn market-trades-btn-close" data-order-id="' + escapeHtml(o.id) + '">下架</button>') +
            '<button type="button" class="market-btn market-trades-btn-delete" data-order-id="' + escapeHtml(o.id) + '">删除</button>' +
            '</div>' +
            '</article>'
        );
    }

    function resolveAssetUrl(rel) {
        if (!rel) return '';
        var s = String(rel);
        if (/^https?:\/\//i.test(s)) return s;
        if (window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === 'function') {
            var u = window.UssAuthApi.resolveAssetUrl(s);
            if (u) return u;
        }
        return absMediaUrl(s);
    }

    function renderStars(rating) {
        var n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
        var html = '';
        for (var i = 1; i <= 5; i++) {
            html += '<span class="market-seller-card__star' + (i <= n ? ' is-on' : '') + '" aria-hidden="true">★</span>';
        }
        return html;
    }

    function renderSellerProfileHtml(seller, partyLabel, opts) {
        opts = opts || {};
        var revealed = !!seller.contactRevealed || !!opts.revealed;
        var rawHandle = seller.rsiProfileHandle || seller.bindingId || '—';
        var rawName = seller.bindingId || rawHandle;
        var handle = revealed ? String(rawHandle || '—') : maskAuthorName(rawHandle).display;
        var displayName = revealed ? String(rawName || '—') : maskAuthorName(rawName).display;
        var avatar = resolveAssetUrl(seller.avatarUrl) || defaultAvatar();
        var rankIcon = resolveAssetUrl(seller.rsiRankIconUrl);
        var orgLogo = resolveAssetUrl(seller.rsiOrgLogoUrl);
        var tradeHtml = '<span class="market-seller-card__trade">交易：' + escapeHtml(formatTradeCount(seller)) + '</span>';
        var fleetBadge = seller.isFleetMember ? '<span class="market-seller-card__fleet">舰队</span>' : '';
        var ratingHtml = '';
        if (seller.averageRating != null && seller.reviewCount > 0) {
            ratingHtml =
                '<div class="market-seller-card__rating">' +
                renderStars(seller.averageRating) +
                '<span class="market-seller-card__rating-num">' + escapeHtml(seller.averageRating) + '</span>' +
                '<span class="market-seller-card__rating-count">(' + escapeHtml(seller.reviewCount) + ')</span>' +
                '</div>';
        }
        var rankLine = '';
        if (rankIcon || seller.rsiRankLabel) {
            rankLine =
                '<span class="market-seller-card__rank-inline">' +
                (rankIcon ? '<img class="market-seller-card__rank-icon" src="' + escapeHtml(rankIcon) + '" alt="" referrerpolicy="no-referrer">' : '') +
                '<span>' + escapeHtml(seller.rsiRankLabel || '') + '</span>' +
                '</span>';
        }
        var subLine = '<div class="market-seller-card__subline">@' + escapeHtml(handle) + (rankLine ? '<span class="market-seller-card__subsep">·</span>' + rankLine : '') + '</div>';
        var orgHtml = '';
        if (seller.rsiOrgName || seller.rsiOrgSid || orgLogo) {
            var orgMeta = [];
            if (seller.rsiOrgSid) orgMeta.push('SID ' + escapeHtml(revealed ? seller.rsiOrgSid : maskSidDisplay(seller.rsiOrgSid)));
            if (seller.rsiOrgRoleLabel) orgMeta.push(escapeHtml(seller.rsiOrgRoleLabel));
            orgHtml =
                '<div class="market-seller-card__org">' +
                (orgLogo ? '<img class="market-seller-card__org-logo" src="' + escapeHtml(orgLogo) + '" alt="" referrerpolicy="no-referrer">' : '') +
                '<div class="market-seller-card__org-text">' +
                '<div class="market-seller-card__org-name">' + escapeHtml(seller.rsiOrgName || '—') + '</div>' +
                (orgMeta.length ? '<div class="market-seller-card__org-meta">' + orgMeta.join(' · ') + '</div>' : '') +
                '</div></div>';
        }
        var facts = [];
        if (seller.rsiEnlisted) {
            facts.push('<div class="market-seller-card__fact"><span class="market-seller-card__fact-label">入伍</span><strong>' + escapeHtml(seller.rsiEnlisted) + '</strong></div>');
        }
        if (seller.rsiLocation) {
            facts.push('<div class="market-seller-card__fact"><span class="market-seller-card__fact-label">地址</span><strong>' + escapeHtml(seller.rsiLocation) + '</strong></div>');
        }
        facts.push('<div class="market-seller-card__fact"><span class="market-seller-card__fact-label">站内身份</span><strong>' + escapeHtml(memberKindLabel(seller.memberKind)) + '</strong></div>');
        var factsHtml = facts.length
            ? '<div class="market-seller-card__facts">' + facts.join('') + '</div>'
            : '';
        var email = seller.email ? String(seller.email).trim() : '';
        var emailMasked = seller.emailMasked ? String(seller.emailMasked).trim() : '';
        var hasContact = seller.hasContact === true || !!email || !!emailMasked;
        var contactHtml;
        if (revealed && email) {
            var copyLabel = email.indexOf('@') >= 0 ? '复制邮箱' : '复制';
            contactHtml =
                '<div class="market-seller-card__contact">' +
                '<span class="market-detail__email">' + escapeHtml(email) + '</span>' +
                '<button type="button" class="market-detail__copy-btn market-seller-card__copy" data-email="' + escapeHtml(email) + '" data-copy-label="' + escapeHtml(copyLabel) + '">' + escapeHtml(copyLabel) + '</button>' +
                '</div>';
        } else if (hasContact) {
            contactHtml =
                '<div class="market-seller-card__contact">' +
                '<span class="market-detail__email market-seller-card__email--masked">' +
                escapeHtml(emailMasked || maskEmailDisplay(email) || '****@****') +
                '</span>' +
                '</div>';
            if (!revealed) {
                contactHtml += '<p class="market-seller-card__contact-hint">提交购买后显示完整联系方式</p>';
            }
        } else {
            contactHtml = '<p class="market-detail__note">发布者未公开联系方式</p>';
        }

        return (
            '<div class="market-detail__section market-seller-card">' +
            '<h4 class="market-seller-card__title">' + escapeHtml(partyLabel) + '</h4>' +
            '<div class="market-seller-card__body">' +
            '<div class="market-seller-card__profile">' +
            '<img class="market-seller-card__avatar" src="' + escapeHtml(avatar) + '" alt="">' +
            '<div class="market-seller-card__identity">' +
            '<div class="market-seller-card__name-row">' +
            '<span class="market-seller-card__name">' + escapeHtml(displayName) + '</span>' +
            '<div class="market-seller-card__badges">' + tradeHtml + fleetBadge + '</div>' +
            '</div>' +
            subLine +
            ratingHtml +
            '</div></div>' +
            orgHtml +
            factsHtml +
            '<div class="market-seller-card__contact-wrap">' +
            '<div class="market-seller-card__contact-label">联系方式</div>' +
            contactHtml +
            '</div>' +
            sellerReviewsHtml(seller) +
            '</div></div>'
        );
    }

    function reviewHasSellerReply(r) {
        if (!r) return false;
        return !!String(r.sellerReplyText || r.sellerReviewText || '').trim();
    }

    function sellerReviewReplyHtml(r) {
        if (!reviewHasSellerReply(r)) return '';
        var text = String(r.sellerReplyText || r.sellerReviewText || '').trim();
        var at = r.sellerReplyAt || r.sellerReviewAt;
        var timeHtml = formatDateMinute(at)
            ? dateTimeHtml(at, 'market-seller-card__review-time')
            : '';
        return (
            '<div class="market-seller-card__review-reply is-collapsed">' +
            '<div class="market-seller-card__review-reply-body" hidden>' +
            '<p class="market-seller-card__review-reply-text">' + escapeHtml(text) + '</p>' +
            timeHtml +
            '</div>' +
            '</div>'
        );
    }

    function sellerReviewReplyToggleHtml(r) {
        if (!reviewHasSellerReply(r)) return '';
        return (
            '<button type="button" class="market-seller-card__review-reply-toggle" aria-expanded="false" aria-label="展开卖家回复">' +
            '<span>回复</span>' +
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>'
        );
    }

    function sellerReviewAuthorHtml(r) {
        var rawName = r.fromDisplayName || r.fromBindingId || '';
        var name = r.fromDisplayName
            ? String(r.fromDisplayName)
            : maskAuthorName(rawName).display;
        if (!name) name = '买家';
        return '<span class="market-seller-card__review-name">' + escapeHtml(name) + '</span>';
    }

    function sellerReviewsHtml(seller) {
        var list = Array.isArray(seller && seller.recentReviews) ? seller.recentReviews.slice(0, 10) : [];
        if (!list.length) {
            return (
                '<div class="market-seller-card__reviews">' +
                '<div class="market-seller-card__reviews-label">历史评价</div>' +
                '<p class="market-seller-card__reviews-empty">暂无评价</p>' +
                '</div>'
            );
        }
        var extra = list.length > 2;
        var items = list.map(function (r, i) {
            var hidden = i >= 2 ? ' hidden' : '';
            var timeHtml = formatDateMinute(r.createdAt)
                ? dateTimeHtml(r.createdAt, 'market-seller-card__review-time')
                : '';
            return (
                '<li class="market-seller-card__review"' + hidden + '>' +
                '<div class="market-seller-card__review-meta">' +
                sellerReviewAuthorHtml(r) +
                '<div class="market-seller-card__review-aside">' +
                '<span class="market-seller-card__review-stars">' + renderStars(r.rating) + '</span>' +
                timeHtml +
                sellerReviewReplyToggleHtml(r) +
                '</div>' +
                '</div>' +
                (r.text ? '<p class="market-seller-card__review-text">' + escapeHtml(r.text) + '</p>' : '') +
                sellerReviewReplyHtml(r) +
                '</li>'
            );
        }).join('');
        return (
            '<div class="market-seller-card__reviews' + (extra ? ' is-collapsed' : '') + '">' +
            '<div class="market-seller-card__reviews-head">' +
            '<div class="market-seller-card__reviews-label">历史评价</div>' +
            (extra
                ? '<button type="button" class="market-seller-card__reviews-toggle" aria-expanded="false" aria-label="展开更多评价">' +
                  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                  '</button>'
                : '') +
            '</div>' +
            '<ul class="market-seller-card__review-list">' + items + '</ul>' +
            '</div>'
        );
    }

    function getSeller(order) {
        if (order && order.seller) return order.seller;
        return {
            bindingId: order.bindingId || order.authorHandle || null,
            email: null,
            avatarUrl: order.avatarUrl || null,
            isFleetMember: !!order.isFleetMember,
            rsiProfileHandle: null,
            rsiRankLabel: null,
            rsiEnlisted: null,
            rsiLocation: null,
            rsiOrgName: null,
            rsiOrgSid: null,
            rsiOrgRoleLabel: null,
            memberKind: null,
            hasContact: false,
            contactRevealed: false,
            emailMasked: null,
            completedTradeCount: order.completedTradeCount || 0,
            averageRating: null,
            reviewCount: 0,
            rsiRankIconUrl: null,
            rsiOrgLogoUrl: null,
        };
    }

    function detailMediaHtml(order) {
        var img = orderImageSrc(order);
        if (img) {
            var it0 = (order.items && order.items[0]) || {};
            var fallback = it0.componentId && !isHqPointsItem(it0) ? componentImageUrl(it0.componentId) : '';
            return '<img class="market-detail__media-img market-detail__media-img--zoom" src="' + escapeHtml(img) + '"' +
                (fallback && fallback !== img ? ' data-fallback="' + escapeHtml(fallback) + '"' : '') +
                ' alt="点击查看大图" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback}else{this.onerror=null;this.classList.add(\'is-broken\');var p=this.parentNode;if(p&&!p.querySelector(\'.market-detail__media--empty\')){var s=document.createElement(\'span\');s.className=\'market-detail__media--empty\';s.textContent=\'?\';p.appendChild(s);}}">';
        }
        var initial = escapeHtml(primaryItemName(order).charAt(0) || '?');
        var it0e = (order.items && order.items[0]) || {};
        if (isHqPointsItem(it0e)) initial = '分';
        return '<span class="market-detail__media--empty">' + initial + '</span>';
    }

    function formatTradeWindow(order) {
        var s = String(order.tradeTimeStart || '20:00').slice(0, 5);
        var e = String(order.tradeTimeEnd || '21:00').slice(0, 5);
        return s + ' – ' + e;
    }

    function listingTypeMeta(order) {
        if (order.tradeType === 'barter') {
            if (isHqPointsListing(order)) {
                return { cls: 'market-card__badge--points-barter', text: '积分互换' };
            }
            return { cls: 'market-card__badge--barter', text: '互换' };
        }
        if (order.orderType === 'buy') {
            return { cls: 'market-card__badge--buy', text: '求购' };
        }
        return { cls: 'market-card__badge--sell', text: '售卖' };
    }

    function listingTypeBadgeHtml(order) {
        var t = listingTypeMeta(order);
        return '<span class="market-card__badge ' + t.cls + '">' + t.text + '</span>';
    }

    function orderTypeBadge(order) {
        if (order.tradeType === 'barter') {
            if (isHqPointsListing(order)) {
                return { cls: ' market-detail__badge--points-barter', text: '积分互换' };
            }
            return { cls: ' market-detail__badge--barter', text: '互换' };
        }
        if (order.orderType === 'buy') {
            return { cls: ' market-detail__badge--buy', text: '求购' };
        }
        return { cls: '', text: '售卖' };
    }

    function memberKindLabel(kind) {
        if (String(kind || '').toLowerCase() === 'civilian') return '普通注册';
        return '舰队注册';
    }

    function copyTextToClipboard(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            try {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                var ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (ok) resolve();
                else reject(new Error('copy failed'));
            } catch (e) {
                reject(e);
            }
        });
    }

    function isOwnOrder(order) {
        var sess = loadSession();
        var bid = sess && sess.bindingId ? String(sess.bindingId).trim().toLowerCase() : '';
        var owner = String((order && order.bindingId) || (order && order.authorHandle) || '').trim().toLowerCase();
        return !!(bid && owner && bid === owner);
    }

    async function submitPurchase(orderId, quantity) {
        var body = { orderId: orderId };
        if (quantity != null) body.quantity = quantity;
        var r = await fetch(joinUrl('/api/market/purchases'), {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders()),
            body: JSON.stringify(body),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '提交购买失败');
        return data;
    }

    async function fetchMyBuyerPurchaseForOrder(orderId) {
        var sess = loadSession();
        if (!sess || !sess.token) return null;
        var r = await fetch(joinUrl('/api/market/my/purchases?role=buyer'), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        if (!r.ok) return null;
        var data = await r.json().catch(function () { return {}; });
        var list = Array.isArray(data.purchases) ? data.purchases : [];
        return list.find(function (p) {
            if (!p || String(p.orderId) !== String(orderId)) return false;
            return p.status === 'pending' || p.status === 'approved';
        }) || null;
    }

    async function sendPurchaseNudge(orderId) {
        var r = await fetch(joinUrl('/api/market/purchases/nudge'), {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders()),
            body: JSON.stringify({ orderId: orderId }),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '强提醒发送失败');
        return data;
    }

    function mergeOrderIntoState(nextOrder) {
        if (!nextOrder || !nextOrder.id) return null;
        var idx = state.orders.findIndex(function (o) { return o && o.id === nextOrder.id; });
        var prev = idx >= 0 ? state.orders[idx] : null;
        var merged = prev ? Object.assign({}, prev, nextOrder) : nextOrder;
        if (prev && prev.seller && nextOrder.seller) {
            merged.seller = Object.assign({}, prev.seller, nextOrder.seller);
            var prevReviews = prev.seller.recentReviews;
            var nextReviews = nextOrder.seller.recentReviews;
            if (Array.isArray(prevReviews) && prevReviews.length) {
                if (!Array.isArray(nextReviews) || !nextReviews.length) {
                    merged.seller.recentReviews = prevReviews;
                }
            }
        }
        if (idx >= 0) state.orders[idx] = merged;
        else state.orders.unshift(merged);
        return merged;
    }

    function setPurchaseSubmittedUi(order, submitted) {
        var hint = document.getElementById('marketDetailPurchaseHint');
        var nudgeBtn = document.getElementById('marketDetailNudgeBtn');
        var purchaseBtn = document.getElementById('marketDetailPurchaseBtn');
        var qtyPicker = document.getElementById('marketDetailQtyPicker');
        if (hint) hint.hidden = !submitted;
        if (nudgeBtn) nudgeBtn.hidden = !submitted;
        if (qtyPicker) qtyPicker.hidden = !!submitted;
        if (!purchaseBtn || !submitted) return;
        purchaseBtn.disabled = true;
        purchaseBtn.classList.remove('market-btn--accent');
        purchaseBtn.classList.add('is-done');
        purchaseBtn.setAttribute('aria-disabled', 'true');
        purchaseBtn.textContent = order.tradeType === 'barter' ? '已提交意向' : '已提交购买';
    }

    function renderOrderDetail(order, options) {
        options = options || {};
        var showPurchaseHint = !!options.showPurchaseHint;
        if (!el.detailBody) return;
        var it0 = (order.items && order.items[0]) || {};
        var stockQty = Math.max(1, Math.floor(Number(it0.quantity) || 1));
        var seller = getSeller(order);
        var sellerRevealed = isOwnOrder(order) || !!options.unlockSellerContact
            || (!!seller.contactRevealed && !isPrivilegedSession());
        var badge = orderTypeBadge(order);
        var priceClass = order.tradeType === 'barter' ? ' market-detail__price--barter' : '';
        var loc = (order.location && order.location.name) || '未指定地点';
        var sys = order.location && order.location.system ? SYSTEM_ZH[order.location.system] || order.location.system : '';
        var locLine = sys ? loc + '（' + sys + '）' : loc;
        var note = order.note ? String(order.note).trim() : '';
        var partyLabel = order.tradeType === 'barter' ? '发布者信息' : (order.orderType === 'buy' ? '收购方信息' : '出售者信息');
        var it1 = (order.items && order.items[1]) || {};
        var barterWantHtml = '';
        var canPickQty = !options.readOnly && !isOwnOrder(order) && order.orderType === 'sell' && order.tradeType !== 'barter';
        var qtyPickerHtml = canPickQty
            ? (
                '<div class="market-detail__qty" id="marketDetailQtyPicker"' + (showPurchaseHint ? ' hidden' : '') + '>' +
                '<span class="market-detail__qty-label">购买数量</span>' +
                '<div class="market-detail__qty-stepper">' +
                '<button type="button" class="market-detail__qty-btn" id="marketDetailQtyMinus" aria-label="减少数量">−</button>' +
                '<input type="number" class="market-detail__qty-input" id="marketDetailQtyInput" min="1" max="' + escapeHtml(String(stockQty)) + '" value="1" inputmode="numeric">' +
                '<button type="button" class="market-detail__qty-btn" id="marketDetailQtyPlus" aria-label="增加数量">+</button>' +
                '</div></div>'
            )
            : '';
        if (order.tradeType === 'barter') {
            var wantImg = wantImageSrc(order);
            var wantName = wantItemName(order) || '未指定';
            var wantMediaInner = wantImg
                ? '<img class="market-detail__media-img market-detail__media-img--zoom" src="' + escapeHtml(wantImg) + '" alt="点击查看大图">'
                : '<span class="market-detail__media--empty">' + escapeHtml(isHqPointsItem(it1) ? '分' : (wantName.charAt(0) || '?')) + '</span>';
            barterWantHtml =
                '<div class="market-detail__section market-detail__barter-want">' +
                '<h4 class="market-detail__section-title">期望换取</h4>' +
                '<div class="market-detail__grid">' +
                '<div class="market-detail__media">' + wantMediaInner + '</div>' +
                '<div class="market-detail__main">' +
                '<p class="market-detail__cat">' + escapeHtml(categoryLabel(it1.categoryGroup)) + '</p>' +
                '<h3 class="market-detail__title">' + escapeHtml(wantName) + '</h3>' +
                '<dl class="market-detail__dl">' +
                (isHqPointsItem(it1)
                    ? '<dt>积分数</dt><dd>×' + escapeHtml(String(it1.hqPointsAmount || it1.quantity || 1)) + '</dd>'
                    : '<dt>数量</dt><dd>×' + escapeHtml(it1.quantity || 1) + '</dd><dt>品质</dt><dd>' + escapeHtml(itemQuality(it1)) + '</dd>') +
                '</dl></div></div></div>';
        }

        if (el.detailModal) {
            el.detailModal.classList.toggle('market-detail--barter', order.tradeType === 'barter');
        }

        var canTakedown = !options.readOnly && isSuperAdminSession() && !isOwnOrder(order) && order.status !== 'closed';
        var canPurchase = !options.readOnly && !isOwnOrder(order) && order.orderType === 'sell';
        var detailActionsHtml = '';
        if (canTakedown || canPurchase) {
            detailActionsHtml =
                '<div class="market-detail__actions' + (canTakedown && !canPurchase ? ' market-detail__actions--end' : '') + '">' +
                (canPurchase ? '<a class="market-detail__dash-link" href="market-trades.html">查看我的贸易订单</a>' : '') +
                '<div class="market-detail__actions-end">' +
                (canPurchase
                    ? (
                        '<p class="market-detail__hint" id="marketDetailPurchaseHint"' + (showPurchaseHint ? '' : ' hidden') + '>请等待卖家确认交易，或点击「强提醒」、自行联系卖家。</p>' +
                        '<button type="button" class="market-btn market-detail__nudge" id="marketDetailNudgeBtn" data-order-id="' + escapeHtml(order.id) + '"' + (showPurchaseHint ? '' : ' hidden') + '>强提醒</button>' +
                        '<button type="button" class="market-btn market-btn--accent" id="marketDetailPurchaseBtn" data-order-id="' + escapeHtml(order.id) + '">' +
                        (order.tradeType === 'barter' ? '确认互换意向' : '提交购买') +
                        '</button>'
                    )
                    : '') +
                (canTakedown
                    ? '<button type="button" class="market-btn market-detail__takedown-btn" id="marketDetailTakedownBtn" data-order-id="' + escapeHtml(order.id) + '">下架该商品</button>'
                    : '') +
                '</div></div>';
        }

        el.detailBody.innerHTML =
            (order.listingGone
                ? '<p class="market-detail__snapshot-note">挂单已删除，以下为成交时保存的商品快照</p>'
                : '') +
            '<div class="market-detail__grid">' +
            '<div class="market-detail__media">' +
            '<span class="market-detail__badge' + badge.cls + '">' + badge.text + '</span>' +
            detailMediaHtml(order) +
            '</div>' +
            '<div class="market-detail__main">' +
            '<p class="market-detail__cat">' + escapeHtml(categoryLabel(it0.categoryGroup)) + '</p>' +
            '<h3 class="market-detail__title">' + escapeHtml(primaryItemName(order)) + '</h3>' +
            '<p class="market-detail__price' + priceClass + '" id="marketDetailPriceLine">' + escapeHtml(formatPrice(order)) + '</p>' +
            '<dl class="market-detail__dl">' +
            (isHqPointsItem(it0)
                ? '<dt>积分数</dt><dd>×' + escapeHtml(String(it0.hqPointsAmount || 1)) + '</dd>'
                : '<dt>可购数量</dt><dd>×' + escapeHtml(String(stockQty)) + '</dd><dt>品质</dt><dd>' + escapeHtml(itemQuality(it0)) + '</dd>') +
            '<dt>交易位置</dt><dd>' + escapeHtml(locLine) + '</dd>' +
            '<dt>交易时段</dt><dd>每日 ' + escapeHtml(formatTradeWindow(order)) + '</dd>' +
            (formatDateMinute(order.createdAt)
                ? '<dt>上架时间</dt><dd>' + dateTimeHtml(order.createdAt) + '</dd>'
                : '') +
            (formatDateMinute(order.expiresAt)
                ? '<dt>到期时间</dt><dd>' + dateTimeHtml(order.expiresAt) + '</dd>'
                : '') +
            (order.status === 'closed' && formatDateMinute(order.takenDownAt || order.updatedAt)
                ? '<dt>下架时间</dt><dd>' + dateTimeHtml(order.takenDownAt || order.updatedAt) + '</dd>'
                : '') +
            (it0.typeLabel ? '<dt>物品类型</dt><dd>' + escapeHtml(it0.typeLabel) + '</dd>' : '') +
            '</dl>' +
            (note ? (
                '<div class="market-detail__section">' +
                '<h4 class="market-detail__section-title">商品说明</h4>' +
                '<p class="market-detail__note">' + escapeHtml(note) + '</p>' +
                '</div>'
            ) : '') +
            qtyPickerHtml +
            '</div>' +
            '</div>' +
            barterWantHtml +
            renderSellerProfileHtml(seller, partyLabel, { revealed: sellerRevealed }) +
            (order.status === 'closed' && order.takedownReason
                ? '<p class="market-detail__takedown">下架理由：' + escapeHtml(order.takedownReason) + '</p>'
                : '') +
            detailActionsHtml;

        var copyBtns = el.detailBody.querySelectorAll('.market-seller-card__copy, #marketDetailCopyEmail');
        copyBtns.forEach(function (copyBtn) {
            copyBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var em = copyBtn.getAttribute('data-email') || '';
                if (!em) return;
                copyTextToClipboard(em).then(function () {
                    var label = copyBtn.getAttribute('data-copy-label') || '复制';
                    copyBtn.textContent = '已复制';
                    copyBtn.classList.add('is-copied');
                    setTimeout(function () {
                        copyBtn.textContent = label;
                        copyBtn.classList.remove('is-copied');
                    }, 1800);
                }).catch(function () {
                    var label = copyBtn.getAttribute('data-copy-label') || '复制';
                    copyBtn.textContent = '复制失败';
                    setTimeout(function () { copyBtn.textContent = label; }, 1800);
                });
            });
        });
        var reviewsToggle = el.detailBody.querySelector('.market-seller-card__reviews-toggle');
        if (reviewsToggle) {
            reviewsToggle.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var box = reviewsToggle.closest('.market-seller-card__reviews');
                if (!box) return;
                var collapsed = box.classList.toggle('is-collapsed');
                reviewsToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                box.querySelectorAll('.market-seller-card__review').forEach(function (li, idx) {
                    if (idx >= 2) li.hidden = collapsed;
                });
            });
        }
        el.detailBody.querySelectorAll('.market-seller-card__review-reply-toggle').forEach(function (btn) {
            btn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var li = btn.closest('.market-seller-card__review');
                var wrap = li && li.querySelector('.market-seller-card__review-reply');
                if (!wrap) return;
                var body = wrap.querySelector('.market-seller-card__review-reply-body');
                var collapsed = wrap.classList.toggle('is-collapsed');
                btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                btn.setAttribute('aria-label', collapsed ? '展开卖家回复' : '收起卖家回复');
                btn.classList.toggle('is-open', !collapsed);
                if (body) body.hidden = collapsed;
            });
        });
        el.detailBody.querySelectorAll('.market-detail__media-img--zoom').forEach(function (img) {
            img.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var src = img.currentSrc || img.src;
                if (!src) return;
                if (window.UssCommunityImageLightbox && typeof window.UssCommunityImageLightbox.open === 'function') {
                    window.UssCommunityImageLightbox.open(src);
                }
            });
        });
        var nudgeBtn = document.getElementById('marketDetailNudgeBtn');
        if (nudgeBtn) {
            nudgeBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var oid = nudgeBtn.getAttribute('data-order-id') || '';
                if (!oid) return;
                nudgeBtn.disabled = true;
                sendPurchaseNudge(oid).then(function () {
                    return askConfirm({
                        title: '强提醒',
                        message: '已发送强提醒，请等待卖家确认交易。',
                        confirmText: '确定',
                        notice: true,
                    });
                }).catch(function (e) {
                    return askConfirm({
                        title: '强提醒',
                        message: (e && e.message) || '强提醒发送失败',
                        confirmText: '确定',
                        notice: true,
                    });
                }).finally(function () {
                    nudgeBtn.disabled = false;
                });
            });
        }
        var purchaseBtn = document.getElementById('marketDetailPurchaseBtn');
        var qtyInput = document.getElementById('marketDetailQtyInput');
        var qtyMinus = document.getElementById('marketDetailQtyMinus');
        var qtyPlus = document.getElementById('marketDetailQtyPlus');
        var priceLine = document.getElementById('marketDetailPriceLine');

        function clampDetailQty(raw) {
            var n = Math.floor(Number(raw));
            if (!Number.isFinite(n) || n < 1) n = 1;
            if (n > stockQty) n = stockQty;
            return n;
        }

        function syncDetailQtyUi() {
            if (!qtyInput) return;
            var qty = clampDetailQty(qtyInput.value);
            qtyInput.value = String(qty);
            if (qtyMinus) qtyMinus.disabled = qty <= 1;
            if (qtyPlus) qtyPlus.disabled = qty >= stockQty;
            if (priceLine && order.tradeType !== 'barter') {
                priceLine.textContent = formatPriceTotal(order, qty);
            }
        }

        if (qtyInput) {
            qtyInput.addEventListener('input', syncDetailQtyUi);
            qtyInput.addEventListener('change', syncDetailQtyUi);
        }
        if (qtyMinus) {
            qtyMinus.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (!qtyInput) return;
                qtyInput.value = String(clampDetailQty(Number(qtyInput.value) - 1));
                syncDetailQtyUi();
            });
        }
        if (qtyPlus) {
            qtyPlus.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (!qtyInput) return;
                qtyInput.value = String(clampDetailQty(Number(qtyInput.value) + 1));
                syncDetailQtyUi();
            });
        }
        syncDetailQtyUi();

        if (purchaseBtn) {
            purchaseBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var oid = purchaseBtn.getAttribute('data-order-id') || '';
                if (!oid) return;
                if (!isLoggedIn()) {
                    if (typeof window.openLoginDrawer === 'function') window.openLoginDrawer();
                    return;
                }
                if (isHqPointsListing(order) && !isFleetMemberSession()) {
                    window.alert('无权限');
                    return;
                }
                var buyQty = qtyInput ? clampDetailQty(qtyInput.value) : 1;
                requireMarketAck('purchase', function () {
                    purchaseBtn.disabled = true;
                    submitPurchase(oid, buyQty).then(function (data) {
                        var next = data && data.purchase && data.purchase.order;
                        var shown = next ? mergeOrderIntoState(next) || order : order;
                        renderOrderDetail(shown, { showPurchaseHint: true, unlockSellerContact: true });
                        setPurchaseSubmittedUi(shown, true);
                        if (window.UssMarketNotify && typeof window.UssMarketNotify.push === 'function') {
                            window.UssMarketNotify.push({
                                kind: 'buyer',
                                title: '购买已提交',
                                body: '请等待卖家确认交易，可在商城管理中查看进度。',
                                url: 'market-trades.html?tab=purchases',
                            });
                        }
                        if (window.UssMarketNotify && typeof window.UssMarketNotify.pollOnce === 'function') {
                            window.UssMarketNotify.pollOnce();
                        }
                    }).catch(function (e) {
                        purchaseBtn.disabled = false;
                        purchaseBtn.classList.add('market-btn--accent');
                        purchaseBtn.classList.remove('is-done');
                        purchaseBtn.removeAttribute('aria-disabled');
                        window.alert((e && e.message) || '提交失败');
                    });
                });
            });
        }
        var takedownBtn = document.getElementById('marketDetailTakedownBtn');
        if (takedownBtn) {
            takedownBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var oid = takedownBtn.getAttribute('data-order-id') || order.id || '';
                askConfirm({
                    title: '下架商品',
                    message: '下架后该商品将对买家不可见。请填写理由。',
                    confirmText: '确认下架',
                    cancelText: '再想想',
                    prompt: {
                        label: '下架理由',
                        placeholder: '例如：违规定价、虚假商品、重复挂单',
                        hint: '最多 200 字，买家可见。',
                        required: true,
                        maxLength: 200,
                    },
                }).then(function (reason) {
                    if (reason == null) return;
                    reason = String(reason).trim();
                    if (!reason) return;
                    takedownBtn.disabled = true;
                    return fetch(joinUrl('/api/market/orders/' + encodeURIComponent(oid)), {
                        method: 'PATCH',
                        headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders()),
                        body: JSON.stringify({ status: 'closed', takedownReason: reason }),
                    }).then(function (r) {
                        return r.json().catch(function () { return {}; }).then(function (data) {
                            if (!r.ok) throw new Error(apiErrorText(data, '下架失败'));
                            closeOrderDetail();
                            return fetchOrders();
                        });
                    }).catch(function (e) {
                        takedownBtn.disabled = false;
                        return askConfirm({
                            title: '下架失败',
                            message: (e && e.message) || '下架失败',
                            confirmText: '确定',
                            notice: true,
                        });
                    });
                });
            });
        }
    }

    function openOrderDetail(orderId) {
        var order = state.orders.find(function (o) { return o.id === orderId; });
        if (!el.detailBackdrop) return;
        if (order) {
            renderOrderDetail(order);
            el.detailBackdrop.hidden = false;
            syncBodyScrollLock();
            if (el.detailClose) el.detailClose.focus();
        }
        fetch(joinUrl('/api/market/orders/' + encodeURIComponent(orderId)), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (data) {
                if (!r.ok || !data.order) return;
                var shown = mergeOrderIntoState(data.order) || data.order;
                if (el.detailBackdrop && !el.detailBackdrop.hidden) {
                    renderOrderDetail(shown);
                }
            });
        }).catch(function () { /* ignore */ });
        if (!order) return;
        if (!isOwnOrder(order) && order.orderType === 'sell') {
            fetchMyBuyerPurchaseForOrder(orderId).then(function (purchase) {
                if (!purchase) return;
                var shown = purchase.order ? (mergeOrderIntoState(purchase.order) || order) : order;
                renderOrderDetail(shown, {
                    showPurchaseHint: purchase.status === 'pending',
                    unlockSellerContact: true,
                });
                setPurchaseSubmittedUi(shown, true);
                if (purchase.status !== 'pending') {
                    var hint = document.getElementById('marketDetailPurchaseHint');
                    var nudgeBtn = document.getElementById('marketDetailNudgeBtn');
                    if (hint) hint.hidden = true;
                    if (nudgeBtn) nudgeBtn.hidden = true;
                }
            }).catch(function () { /* ignore */ });
        }
    }

    function openListingDetail(order, options) {
        if (!order || !el.detailBackdrop) return;
        var opts = options || {};
        renderOrderDetail(order, opts);
        el.detailBackdrop.hidden = false;
        syncBodyScrollLock();
        if (el.detailClose) el.detailClose.focus();
        if (!order.id) return;
        fetch(joinUrl('/api/market/orders/' + encodeURIComponent(order.id)), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (data) {
                if (!r.ok || !data.order) return;
                var shown = mergeOrderIntoState(data.order) || data.order;
                if (el.detailBackdrop && !el.detailBackdrop.hidden) {
                    renderOrderDetail(shown, opts);
                }
            });
        }).catch(function () { /* ignore */ });
    }

    function closeOrderDetail() {
        if (!el.detailBackdrop) return;
        el.detailBackdrop.hidden = true;
        syncBodyScrollLock();
        if (el.detailModal) el.detailModal.classList.remove('market-detail--barter');
    }

    function renderCategoryChips() {
        if (!el.cats) return;
        el.cats.innerHTML = CATEGORY_GROUPS.map(function (g) {
            var active = g.id === state.categoryGroup ? ' is-active' : '';
            return '<button type="button" class="market-cat' + active + '" data-cat="' + escapeHtml(g.id) + '">' + escapeHtml(g.label) + '</button>';
        }).join('');
    }

    function syncTabs() {
        if (!el.tabSell || !el.tabBuy) return;
        el.tabSell.classList.toggle('is-active', state.tab === 'sell');
        el.tabBuy.classList.toggle('is-active', state.tab === 'buy');
        el.tabSell.setAttribute('aria-selected', state.tab === 'sell' ? 'true' : 'false');
        el.tabBuy.setAttribute('aria-selected', state.tab === 'buy' ? 'true' : 'false');
    }

    function openModal() {
        if (!isLoggedIn()) {
            if (typeof window.openLoginDrawer === 'function') window.openLoginDrawer();
            return;
        }
        ensureRsiBindThen(openCreateModal);
    }

    function openCreateModal() {
        state.editingOrderId = null;
        resetCreateForm();
        if (el.modalBackdrop) {
            el.modalBackdrop.hidden = false;
            el.modalBackdrop.scrollTop = 0;
        }
        if (el.itemInput) {
            window.setTimeout(function () { el.itemInput.focus(); }, 0);
        }
    }

    function inferExpireDays(order) {
        if (!order || !order.expiresAt) return 0;
        var created = Date.parse(order.createdAt || '');
        var expires = Date.parse(order.expiresAt || '');
        if (!Number.isFinite(created) || !Number.isFinite(expires) || expires <= created) return 7;
        var days = Math.round((expires - created) / 86400000);
        if (days <= 10) return 7;
        if (days <= 45) return 30;
        return 30;
    }

    function setSegLocked(container, locked) {
        if (!container) return;
        container.classList.toggle('is-locked', !!locked);
        container.querySelectorAll('button').forEach(function (btn) {
            btn.disabled = !!locked;
            btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
        });
    }

    function listingTermsRequired() {
        return !state.editingOrderId && !!(el.listingTermsChk && el.listingTermsWrap && !el.listingTermsWrap.hidden);
    }

    function showListingTermsHint() {
        if (el.listingTermsWrap) {
            el.listingTermsWrap.classList.add('is-error');
        }
        if (el.listingTermsChk) el.listingTermsChk.focus();
        var msg = '请先勾选服务与风险告知后再生成单据';
        if (el.listingTermsHint) {
            el.listingTermsHint.textContent = msg;
            el.listingTermsHint.hidden = false;
        }
        if (el.formError) {
            el.formError.textContent = msg;
            el.formError.hidden = false;
        }
    }

    function clearListingTermsHint() {
        if (el.listingTermsWrap) el.listingTermsWrap.classList.remove('is-error');
        if (el.listingTermsHint) {
            el.listingTermsHint.hidden = true;
            el.listingTermsHint.textContent = '';
        }
    }

    function syncListingSubmitEnabled() {
        if (!el.btnSubmit) return;
        var needChk = listingTermsRequired();
        var ready = !needChk || !!(el.listingTermsChk && el.listingTermsChk.checked);
        el.btnSubmit.disabled = false;
        el.btnSubmit.classList.toggle('is-locked', needChk && !ready);
        el.btnSubmit.setAttribute('aria-disabled', needChk && !ready ? 'true' : 'false');
        if (ready) clearListingTermsHint();
    }

    function setEditModalUi(isEdit) {
        if (el.modalTitle) el.modalTitle.textContent = isEdit ? '编辑挂单' : '发布挂单';
        if (el.btnSubmit) el.btnSubmit.textContent = isEdit ? '保存修改' : '生成单据';
        setSegLocked(el.segTradeType, isEdit);
        setSegLocked(el.segOrderType, isEdit);
        if (el.tradeTypeField) el.tradeTypeField.classList.toggle('is-field-locked', isEdit);
        if (el.orderTypeField) el.orderTypeField.classList.toggle('is-field-locked', isEdit);
        if (el.listingTermsWrap) el.listingTermsWrap.hidden = !!isEdit;
        if (el.listingTermsChk && !isEdit) el.listingTermsChk.checked = false;
        syncListingSubmitEnabled();
    }

    async function openEditModal(order) {
        if (!order || !order.id) return;
        if (!isLoggedIn()) {
            if (typeof window.openLoginDrawer === 'function') window.openLoginDrawer();
            return;
        }
        state.editingOrderId = order.id;
        var it0 = (order.items && order.items[0]) || {};
        var it1 = (order.items && order.items[1]) || {};
        state.create = {
            tradeType: order.tradeType || 'currency',
            orderType: order.orderType || 'sell',
            expireDays: inferExpireDays(order),
            tradeTimeStart: order.tradeTimeStart || '20:00',
            tradeTimeEnd: order.tradeTimeEnd || '21:00',
            categoryGroup: it0.categoryGroup || '',
            itemInfo: order.note || '',
            contact: order.contact || (order.seller && order.seller.email) || accountEmail(),
            location: order.location ? {
                id: order.location.id || null,
                name: order.location.name || '',
                system: order.location.system || null,
            } : null,
            items: [{
                componentId: it0.componentId || null,
                name: it0.nameZh || it0.name || '',
                nameZh: it0.nameZh || null,
                categoryGroup: it0.categoryGroup || null,
                typeLabel: '',
                quantity: it0.quantity || 1,
                pricePerUnit: it0.pricePerUnit != null ? it0.pricePerUnit : '',
                quality: itemQuality(it0),
            }],
            autoImage: null,
            userImage: null,
            existingImage: (order.images && order.images[0]) ? absMediaUrl(order.images[0]) : null,
            barterWant: {
                componentId: it1.componentId || null,
                name: it1.nameZh || it1.name || '',
                nameZh: it1.nameZh || null,
                categoryGroup: it1.categoryGroup || null,
                typeLabel: '',
                quantity: it1.quantity || 1,
                quality: itemQuality(it1),
            },
            barterWantCategoryGroup: it1.categoryGroup || '',
            barterWantAutoImage: null,
            barterWantUserImage: null,
            barterWantExistingImage: (order.images && order.images[1]) ? absMediaUrl(order.images[1]) : null,
        };
        if (el.imageInput) el.imageInput.value = '';
        if (el.wantImageInput) el.wantImageInput.value = '';
        setEditModalUi(true);
        syncCreateFormUi();
        if (el.modalBackdrop) {
            el.modalBackdrop.hidden = false;
            el.modalBackdrop.scrollTop = 0;
        }
    }

    function closeModal() {
        if (el.modalBackdrop) el.modalBackdrop.hidden = true;
        hideSuggest(el.itemSuggest);
        hideSuggest(el.locSuggest);
        state.editingOrderId = null;
        setEditModalUi(false);
    }

    function resetCreateForm() {
        state.editingOrderId = null;
        state.create = {
            tradeType: 'currency',
            orderType: state.tab === 'buy' ? 'buy' : 'sell',
            expireDays: 7,
            tradeTimeStart: '20:00',
            tradeTimeEnd: '21:00',
            categoryGroup: '',
            itemInfo: '',
            contact: accountEmail(),
            location: null,
            items: [{ componentId: null, name: '', categoryGroup: null, typeLabel: '', quantity: 1, pricePerUnit: '', quality: DEFAULT_QUALITY }],
            autoImage: null,
            userImage: null,
            existingImage: null,
            barterWant: emptyBarterWant(),
            barterWantCategoryGroup: '',
            barterWantAutoImage: null,
            barterWantUserImage: null,
            barterWantExistingImage: null,
        };
        if (el.imageInput) el.imageInput.value = '';
        if (el.wantImageInput) el.wantImageInput.value = '';
        if (el.itemInfoInput) el.itemInfoInput.value = '';
        if (el.contactInput) el.contactInput.value = state.create.contact || '';
        setEditModalUi(false);
        syncCreateFormUi();
    }

    function syncSeg(container, value, attr) {
        if (!container) return;
        container.querySelectorAll('button[data-' + attr + ']').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-' + attr) === value);
        });
    }

    function syncHqPointsFormHints() {
        var offerPts = isHqPointsItem(currentItem());
        var wantPts = isHqPointsItem(currentWantItem());
        if (el.hqPointsHint) {
            el.hqPointsHint.hidden = !(isSuperAdminSession() && state.create.tradeType === 'barter');
        }
        if (el.qtyLabel) el.qtyLabel.textContent = offerPts ? '积分数' : '数量';
        if (el.wantQtyLabel) el.wantQtyLabel.textContent = wantPts ? '积分数' : '换取数量';
    }

    function syncCreateFormUi() {
        var c = state.create;
        var it = currentItem();
        syncSeg(el.segTradeType, c.tradeType, 'trade-type');
        syncSeg(el.segOrderType, c.orderType, 'order-type');
        syncSeg(el.segExpireDays, String(c.expireDays), 'expire-days');
        if (el.locInput) el.locInput.value = c.location ? c.location.name || '' : '';
        if (el.categorySelect) el.categorySelect.value = c.categoryGroup || it.categoryGroup || '';
        if (el.itemInput) el.itemInput.value = it.name || '';
        if (el.qtyInput) el.qtyInput.value = it.quantity || 1;
        if (el.priceInput) el.priceInput.value = it.pricePerUnit !== '' && it.pricePerUnit != null ? it.pricePerUnit : '';
        if (el.tradeTimeStart) el.tradeTimeStart.value = c.tradeTimeStart || '20:00';
        if (el.tradeTimeEnd) el.tradeTimeEnd.value = c.tradeTimeEnd || '21:00';
        if (el.itemInfoInput) el.itemInfoInput.value = c.itemInfo || '';
        if (el.contactInput) el.contactInput.value = c.contact || '';
        if (el.qualityInput) el.qualityInput.value = itemQuality(it);
        var isBarter = c.tradeType === 'barter';
        if (el.priceField) el.priceField.hidden = isBarter;
        if (el.orderTypeField) el.orderTypeField.hidden = isBarter;
        if (el.barterWantSection) el.barterWantSection.hidden = !isBarter;
        if (el.formRoot) el.formRoot.classList.toggle('market-form--barter', isBarter);
        if (el.modal) el.modal.classList.toggle('market-modal--barter', isBarter);
        if (el.offerLabel) el.offerLabel.textContent = isBarter ? '我方物品' : '商品名称';
        var want = currentWantItem();
        if (el.wantItemInput) el.wantItemInput.value = want.name || '';
        if (el.wantCategorySelect) el.wantCategorySelect.value = c.barterWantCategoryGroup || want.categoryGroup || '';
        if (el.wantQualityInput) el.wantQualityInput.value = itemQuality(want);
        if (el.qtyInput) {
            el.qtyInput.value = isHqPointsItem(it) ? (it.hqPointsAmount || it.quantity || 1) : (it.quantity || 1);
        }
        if (el.wantQtyInput) {
            el.wantQtyInput.value = isHqPointsItem(want) ? (want.hqPointsAmount || want.quantity || 1) : (want.quantity || 1);
        }
        renderProductImage(it);
        renderWantProductImage(want);
        syncHqPointsFormHints();
        if (el.formError) el.formError.hidden = true;
    }

    function displayImageSrc() {
        if (state.create.userImage) return state.create.userImage;
        if (state.create.existingImage) return absMediaUrl(state.create.existingImage);
        if (state.create.autoImage) return state.create.autoImage;
        var it = currentItem();
        if (it && isHqPointsItem(it)) return hqPointsImageUrl();
        return '';
    }

    function renderProductImage(it) {
        if (!el.imagePreview || !el.imagePreviewImg) return;
        var src = displayImageSrc();
        var hasUser = !!state.create.userImage;
        var hasExisting = !!state.create.existingImage;
        var hasAuto = !!(state.create.autoImage || (it && isHqPointsItem(it)));
        if (el.imageRemove) el.imageRemove.hidden = !(hasUser || hasExisting);
        if (el.imagePlaceholder) el.imagePlaceholder.hidden = !!src;
        if (el.itemPreviewType) {
            if (it && it.typeLabel) {
                el.itemPreviewType.textContent = it.typeLabel;
                el.itemPreviewType.hidden = false;
            } else {
                el.itemPreviewType.textContent = '';
                el.itemPreviewType.hidden = true;
            }
        }
        if (!src) {
            el.imagePreviewImg.hidden = true;
            el.imagePreviewImg.removeAttribute('src');
            return;
        }
        el.imagePreviewImg.hidden = false;
        el.imagePreviewImg.onerror = function () {
            el.imagePreviewImg.onerror = null;
            el.imagePreviewImg.hidden = true;
            el.imagePreviewImg.removeAttribute('src');
            if (el.imagePlaceholder) el.imagePlaceholder.hidden = false;
        };
        el.imagePreviewImg.src = src;
    }

    function displayWantImageSrc() {
        if (state.create.barterWantUserImage) return state.create.barterWantUserImage;
        if (state.create.barterWantExistingImage) return absMediaUrl(state.create.barterWantExistingImage);
        if (state.create.barterWantAutoImage) return state.create.barterWantAutoImage;
        var want = currentWantItem();
        if (want && isHqPointsItem(want)) return hqPointsImageUrl();
        return '';
    }

    function renderWantProductImage(want) {
        if (!el.wantImagePreview || !el.wantImagePreviewImg) return;
        var src = displayWantImageSrc();
        var hasUser = !!state.create.barterWantUserImage;
        var hasExisting = !!state.create.barterWantExistingImage;
        var hasAuto = !!(state.create.barterWantAutoImage || (want && isHqPointsItem(want)));
        if (el.wantImageRemove) el.wantImageRemove.hidden = !(hasUser || hasExisting);
        if (el.wantImagePlaceholder) el.wantImagePlaceholder.hidden = !!src;
        if (el.wantItemPreviewType) {
            if (want && want.typeLabel) {
                el.wantItemPreviewType.textContent = want.typeLabel;
                el.wantItemPreviewType.hidden = false;
            } else {
                el.wantItemPreviewType.textContent = '';
                el.wantItemPreviewType.hidden = true;
            }
        }
        if (!src) {
            el.wantImagePreviewImg.hidden = true;
            el.wantImagePreviewImg.removeAttribute('src');
            return;
        }
        el.wantImagePreviewImg.hidden = false;
        el.wantImagePreviewImg.onerror = function () {
            el.wantImagePreviewImg.onerror = null;
            el.wantImagePreviewImg.hidden = true;
            el.wantImagePreviewImg.removeAttribute('src');
            if (el.wantImagePlaceholder) el.wantImagePlaceholder.hidden = false;
        };
        el.wantImagePreviewImg.src = src;
    }

    function submitImages() {
        var offer = state.create.userImage || state.create.existingImage || state.create.autoImage || '';
        if (state.create.tradeType !== 'barter') {
            return offer ? [offer] : [];
        }
        var want = state.create.barterWantUserImage || state.create.barterWantExistingImage || state.create.barterWantAutoImage || '';
        var out = [];
        if (offer) out[0] = offer;
        if (want) out[1] = want;
        return out;
    }

    async function cacheComponentImageDataUrl(componentId) {
        if (!componentId) return null;
        try {
            var r = await fetch(componentImageUrl(componentId));
            if (!r.ok) return null;
            var blob = await r.blob();
            return await new Promise(function (resolve) {
                var reader = new FileReader();
                reader.onload = function () { resolve(String(reader.result || '')); };
                reader.onerror = function () { resolve(null); };
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            return null;
        }
    }

    async function applyWantItemPick(picked) {
        var want = currentWantItem();
        if (picked && (picked._hqPoints || String(picked.id_item || picked.componentId || '') === 'uss-hq-points')) {
            want.componentId = 'uss-hq-points';
            want.name = '积分';
            want.nameZh = 'USS总部签到积分';
            want.typeLabel = 'USS总部签到积分';
            want.categoryGroup = 'hq_points';
            state.create.barterWantCategoryGroup = 'hq_points';
            if (el.wantCategorySelect) el.wantCategorySelect.value = 'hq_points';
            if (el.wantItemInput) {
                el.wantItemInput.value = '积分';
                el.wantItemInput.setAttribute('aria-expanded', 'false');
            }
            hideSuggest(el.wantItemSuggest);
            state.create.barterWantAutoImage = null;
            renderWantProductImage(want);
            syncHqPointsFormHints();
            return;
        }
        var want = currentWantItem();
        want.componentId = itemComponentId(picked);
        want.name = itemDisplayName(picked) || String(picked.id_item || '');
        want.nameZh = picked.name_zh || null;
        want.typeLabel = itemTypeLabel(picked);
        want.categoryGroup = inferNavGroupFromType(picked.type) || 'other';
        want.quality = DEFAULT_QUALITY;
        state.create.barterWantCategoryGroup = want.categoryGroup;
        if (el.wantCategorySelect) el.wantCategorySelect.value = want.categoryGroup;
        if (el.wantQualityInput) el.wantQualityInput.value = DEFAULT_QUALITY;
        if (el.wantItemInput) {
            el.wantItemInput.value = want.name;
            el.wantItemInput.setAttribute('aria-expanded', 'false');
        }
        hideSuggest(el.wantItemSuggest);
        var dataUrl = await cacheComponentImageDataUrl(want.componentId);
        state.create.barterWantAutoImage = dataUrl || null;
        renderWantProductImage(want);
    }

    function clearWantItemPick() {
        var want = currentWantItem();
        want.componentId = null;
        want.typeLabel = '';
        if (!state.create.barterWantCategoryGroup) want.categoryGroup = null;
        state.create.barterWantAutoImage = null;
        want.quality = DEFAULT_QUALITY;
        if (el.wantQualityInput) el.wantQualityInput.value = DEFAULT_QUALITY;
        renderWantProductImage(want);
    }

    async function applyItemPick(picked) {
        var it = currentItem();
        if (picked && (picked._hqPoints || String(picked.id_item || picked.componentId || '') === 'uss-hq-points')) {
            it.componentId = 'uss-hq-points';
            it.name = '积分';
            it.nameZh = 'USS总部签到积分';
            it.typeLabel = 'USS总部签到积分';
            it.categoryGroup = 'hq_points';
            state.create.categoryGroup = 'hq_points';
            if (el.categorySelect) el.categorySelect.value = 'hq_points';
            if (el.itemInput) {
                el.itemInput.value = '积分';
                el.itemInput.setAttribute('aria-expanded', 'false');
            }
            hideSuggest(el.itemSuggest);
            state.create.autoImage = null;
            renderProductImage(it);
            syncHqPointsFormHints();
            return;
        }
        var it = currentItem();
        it.componentId = itemComponentId(picked);
        it.name = itemDisplayName(picked) || String(picked.id_item || '');
        it.nameZh = picked.name_zh || null;
        it.typeLabel = itemTypeLabel(picked);
        it.categoryGroup = inferNavGroupFromType(picked.type) || 'other';
        it.quality = DEFAULT_QUALITY;
        state.create.categoryGroup = it.categoryGroup;
        if (el.categorySelect) el.categorySelect.value = it.categoryGroup;
        if (el.qualityInput) el.qualityInput.value = DEFAULT_QUALITY;
        if (el.itemInput) {
            el.itemInput.value = it.name;
            el.itemInput.setAttribute('aria-expanded', 'false');
        }
        hideSuggest(el.itemSuggest);
        var dataUrl = await cacheComponentImageDataUrl(it.componentId);
        state.create.autoImage = dataUrl || null;
        renderProductImage(it);
    }

    function clearItemPick() {
        var it = currentItem();
        it.componentId = null;
        it.typeLabel = '';
        if (!state.create.categoryGroup) it.categoryGroup = null;
        state.create.autoImage = null;
        it.quality = DEFAULT_QUALITY;
        if (el.qualityInput) el.qualityInput.value = DEFAULT_QUALITY;
        renderProductImage(it);
    }

    function parseTimeMinutes(value) {
        var m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        var h = parseInt(m[1], 10);
        var min = parseInt(m[2], 10);
        if (h < 0 || h > 23 || min < 0 || min > 59) return null;
        return h * 60 + min;
    }

    function formatTimeMinutes(total) {
        var h = Math.floor(total / 60);
        var m = total % 60;
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function readFormIntoState() {
        var c = state.create;
        var it = currentItem();
        if (el.qtyInput) it.quantity = Math.max(1, parseInt(el.qtyInput.value, 10) || 1);
        if (el.priceInput) it.pricePerUnit = el.priceInput.value;
        if (el.categorySelect) {
            c.categoryGroup = el.categorySelect.value || '';
            it.categoryGroup = c.categoryGroup || it.categoryGroup;
        }
        if (el.qualityInput) it.quality = normalizeQuality(el.qualityInput.value);
        if (el.tradeTimeStart) c.tradeTimeStart = el.tradeTimeStart.value || '20:00';
        if (el.tradeTimeEnd) c.tradeTimeEnd = el.tradeTimeEnd.value || '21:00';
        if (el.itemInfoInput) c.itemInfo = el.itemInfoInput.value.trim();
        if (el.contactInput) c.contact = el.contactInput.value.trim();
        if (c.tradeType === 'barter') {
            var want = currentWantItem();
            if (el.wantItemInput) want.name = el.wantItemInput.value.trim();
            if (el.wantQtyInput) want.quantity = Math.max(1, parseInt(el.wantQtyInput.value, 10) || 1);
            if (el.wantCategorySelect) {
                c.barterWantCategoryGroup = el.wantCategorySelect.value || '';
                want.categoryGroup = c.barterWantCategoryGroup || want.categoryGroup;
            }
            if (el.wantQualityInput) want.quality = normalizeQuality(el.wantQualityInput.value);
        }
        syncLocationFromInput();
    }

    function syncLocationFromInput() {
        if (!el.locInput) return;
        var q = el.locInput.value.trim();
        if (!q) {
            state.create.location = null;
            return;
        }
        if (state.create.location && state.create.location.name === q) return;
        state.create.location = {
            id: null,
            name: q,
            system: null,
            custom: true,
        };
    }

    function hideSuggest(node) {
        if (!node) return;
        node.hidden = true;
        node.innerHTML = '';
        if (node === el.itemSuggest && el.itemInput) {
            el.itemInput.setAttribute('aria-expanded', 'false');
        }
        if (node === el.wantItemSuggest && el.wantItemInput) {
            el.wantItemInput.setAttribute('aria-expanded', 'false');
        }
    }

    async function suggestItems(q, cb) {
        if (itemSuggestController) itemSuggestController.abort();
        itemSuggestController = new AbortController();
        try {
            var params = new URLSearchParams();
            params.set('q', q);
            params.set('limit', '24');
            var r = await fetch(joinUrl('/api/sc/components/suggest?' + params.toString()), {
                signal: itemSuggestController.signal,
            });
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok || data.ok === false) return cb(withHqPointsSuggest(q, []));
            cb(withHqPointsSuggest(q, Array.isArray(data.items) ? data.items : []));
        } catch (e) {
            if (e && e.name === 'AbortError') return;
            cb(withHqPointsSuggest(q, []));
        } finally {
            itemSuggestController = null;
        }
    }

    function renderWantItemSuggestList(items) {
        if (!el.wantItemSuggest) return;
        if (!items.length) {
            el.wantItemSuggest.innerHTML = '<p class="market-item-suggest__label">无匹配结果</p>';
            el.wantItemSuggest.hidden = false;
            if (el.wantItemInput) el.wantItemInput.setAttribute('aria-expanded', 'true');
            return;
        }
        el.wantItemSuggest.innerHTML =
            '<p class="market-item-suggest__label">匹配结果</p>' +
            items.map(function (it, i) {
                return (
                    '<button type="button" class="market-item-suggest__item' + (i === 0 ? ' is-active' : '') + '" data-idx="' + i + '" role="option">' +
                    '<span class="market-item-suggest__name">' + escapeHtml(itemDisplayName(it) || it.id_item || '') + '</span>' +
                    '<span class="market-item-suggest__type">' + escapeHtml(itemTypeLabel(it)) + '</span>' +
                    '</button>'
                );
            }).join('');
        el.wantItemSuggest.hidden = false;
        if (el.wantItemInput) el.wantItemInput.setAttribute('aria-expanded', 'true');
        el.wantItemSuggest.querySelectorAll('.market-item-suggest__item').forEach(function (btn) {
            btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
            btn.addEventListener('click', function () {
                applyWantItemPick(items[Number(btn.getAttribute('data-idx'))]);
            });
        });
    }

    async function suggestWantItems(q, cb) {
        if (wantItemSuggestController) wantItemSuggestController.abort();
        wantItemSuggestController = new AbortController();
        try {
            var params = new URLSearchParams();
            params.set('q', q);
            params.set('limit', '24');
            var r = await fetch(joinUrl('/api/sc/components/suggest?' + params.toString()), {
                signal: wantItemSuggestController.signal,
            });
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok || data.ok === false) return cb(withHqPointsSuggest(q, []));
            cb(withHqPointsSuggest(q, Array.isArray(data.items) ? data.items : []));
        } catch (e) {
            if (e && e.name === 'AbortError') return;
            cb(withHqPointsSuggest(q, []));
        } finally {
            wantItemSuggestController = null;
        }
    }

    function renderItemSuggestList(items) {
        if (!el.itemSuggest) return;
        if (!items.length) {
            el.itemSuggest.innerHTML = '<p class="market-item-suggest__label">无匹配结果</p>';
            el.itemSuggest.hidden = false;
            if (el.itemInput) el.itemInput.setAttribute('aria-expanded', 'true');
            return;
        }
        el.itemSuggest.innerHTML =
            '<p class="market-item-suggest__label">匹配结果</p>' +
            items.map(function (it, i) {
                return (
                    '<button type="button" class="market-item-suggest__item' + (i === 0 ? ' is-active' : '') + '" data-idx="' + i + '" role="option">' +
                    '<span class="market-item-suggest__name">' + escapeHtml(itemDisplayName(it) || it.id_item || '') + '</span>' +
                    '<span class="market-item-suggest__type">' + escapeHtml(itemTypeLabel(it)) + '</span>' +
                    '</button>'
                );
            }).join('');
        el.itemSuggest.hidden = false;
        if (el.itemInput) el.itemInput.setAttribute('aria-expanded', 'true');
        el.itemSuggest.querySelectorAll('.market-item-suggest__item').forEach(function (btn) {
            btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
            btn.addEventListener('click', function () {
                applyItemPick(items[Number(btn.getAttribute('data-idx'))]);
            });
        });
    }

    function filterMajorStations(q) {
        var needle = String(q || '').trim().toLowerCase();
        if (!needle) return MAJOR_STATIONS.slice();
        return MAJOR_STATIONS.filter(function (s) {
            return (
                String(s.name || '').indexOf(q) !== -1 ||
                String(s.nameEn || '').toLowerCase().indexOf(needle) !== -1 ||
                String(SYSTEM_ZH[s.system] || s.system || '').indexOf(q) !== -1
            );
        });
    }

    async function suggestLocations(q, cb) {
        var local = filterMajorStations(q).map(function (s) {
            return {
                name: s.name,
                nameEn: s.nameEn,
                system: s.system,
                type: 'Space Station',
                source: 'local',
            };
        });
        var query = String(q || '').trim();
        if (!query) {
            cb(local);
            return;
        }
        try {
            var params = new URLSearchParams();
            params.set('q', query);
            params.set('limit', '24');
            var r = await fetch(joinUrl('/api/celestial/search?' + params.toString()));
            var data = await r.json();
            var apiItems = (Array.isArray(data.items) ? data.items : []).filter(function (it) {
                return String(it.type || '') === 'Space Station';
            });
            var merged = local.slice();
            apiItems.forEach(function (it) {
                var zh = STATION_ZH[it.name] || it.name;
                if (!merged.some(function (m) {
                    return m.nameEn === it.name || m.name === zh;
                })) {
                    merged.push({
                        name: zh,
                        nameEn: it.name,
                        system: it.system,
                        type: it.type,
                        source: 'api',
                    });
                }
            });
            cb(merged);
        } catch (e) {
            cb(local);
        }
    }

    function locationLabel(it) {
        var zh = it.name || STATION_ZH[it.nameEn || it.name] || it.nameEn || '';
        var sys = it.system ? (SYSTEM_ZH[it.system] || it.system) : '';
        return sys ? zh + ' · ' + sys : zh;
    }

    function renderSuggestList(node, items, renderItem, onPick) {
        if (!node) return;
        if (!items.length) {
            node.innerHTML = '<div class="market-suggest__item" tabindex="-1">无匹配结果</div>';
            node.hidden = false;
            return;
        }
        node.innerHTML = items.map(function (it, i) {
            return '<button type="button" class="market-suggest__item' + (i === 0 ? ' is-active' : '') + '" data-idx="' + i + '">' + renderItem(it) + '</button>';
        }).join('');
        node.hidden = false;
        node.querySelectorAll('.market-suggest__item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                onPick(items[Number(btn.getAttribute('data-idx'))]);
                hideSuggest(node);
            });
        });
    }

    function buildPayloadItems() {
        var c = state.create;
        var it = coerceTypedHqPoints(currentItem());
        var offerPts = isHqPointsItem(it);
        var offerAmount = Math.max(1, parseInt(it.quantity, 10) || 1);
        var row = {
            componentId: it.componentId,
            name: it.name,
            nameZh: it.nameZh,
            categoryGroup: offerPts ? 'hq_points' : (c.categoryGroup || it.categoryGroup),
            quantity: offerPts ? 1 : it.quantity,
            quality: itemQuality(it),
        };
        if (offerPts) row.hqPointsAmount = offerAmount;
        if (c.tradeType === 'currency') {
            var priceRaw = it.pricePerUnit;
            if (priceRaw === '' || priceRaw == null) {
                row.pricePerUnit = null;
            } else {
                var p = Number(priceRaw);
                row.pricePerUnit = Number.isFinite(p) && p >= 0 ? Math.round(p) : null;
            }
            return [row];
        }
        var want = coerceTypedHqPoints(currentWantItem());
        var wantPts = isHqPointsItem(want);
        var wantAmount = Math.max(1, parseInt(want.quantity, 10) || 1);
        var wantRow = {
            componentId: want.componentId,
            name: want.name,
            nameZh: want.nameZh,
            categoryGroup: wantPts ? 'hq_points' : (c.barterWantCategoryGroup || want.categoryGroup),
            quantity: wantPts ? wantAmount : want.quantity,
            quality: itemQuality(want),
        };
        if (wantPts) wantRow.hqPointsAmount = wantAmount;
        return [row, wantRow];
    }

    async function submitOrder() {
        if (el.formError) el.formError.hidden = true;
        if (!state.editingOrderId && (!el.listingTermsChk || !el.listingTermsChk.checked)) {
            showListingTermsHint();
            return;
        }
        if (!el.formError) return;
        readFormIntoState();
        var c = state.create;
        if (!c.location || !c.location.name) {
            el.formError.textContent = '请填写交易位置';
            el.formError.hidden = false;
            return;
        }
        if (!c.categoryGroup && !isHqPointsItem(currentItem())) {
            el.formError.textContent = '请选择物品分类';
            el.formError.hidden = false;
            return;
        }
        var startMin = parseTimeMinutes(c.tradeTimeStart);
        var endMin = parseTimeMinutes(c.tradeTimeEnd);
        if (startMin == null || endMin == null) {
            el.formError.textContent = '请填写有效的交易时段';
            el.formError.hidden = false;
            return;
        }
        if (endMin <= startMin) {
            el.formError.textContent = '结束时间须晚于开始时间';
            el.formError.hidden = false;
            return;
        }
        var items = buildPayloadItems();
        if (!items.length || !items[0].name) {
            el.formError.textContent = '请搜索选择我方物品';
            el.formError.hidden = false;
            return;
        }
        if (c.tradeType === 'barter') {
            var offerPts = isHqPointsItem(items[0]);
            var wantPts = isHqPointsItem(items[1]);
            if (offerPts && wantPts) {
                el.formError.textContent = '积分只能填写在互换的一侧';
                el.formError.hidden = false;
                return;
            }
            if (!isSuperAdminSession() && (offerPts || wantPts)) {
                el.formError.textContent = '仅超级管理员可发布积分互换';
                el.formError.hidden = false;
                return;
            }
            if (!wantPts && !c.barterWantCategoryGroup && !items[1].categoryGroup) {
                el.formError.textContent = '请选择换取物品分类';
                el.formError.hidden = false;
                return;
            }
            if (!items[1].name) {
                el.formError.textContent = '请搜索选择期望换取的物品';
                el.formError.hidden = false;
                return;
            }
        }
        if (c.tradeType === 'currency') {
            for (var i = 0; i < items.length; i++) {
                if (!Number.isFinite(items[i].pricePerUnit) || items[i].pricePerUnit < 0) {
                    el.formError.textContent = '请填写有效的单件报价（可为 0 aUEC）';
                    el.formError.hidden = false;
                    return;
                }
            }
        }
        var payload = {
            tradeType: c.tradeType,
            orderType: c.tradeType === 'barter' ? 'sell' : c.orderType,
            visibility: 'visible',
            createMode: 'single',
            expireDays: c.expireDays,
            tradeTimeStart: c.tradeTimeStart,
            tradeTimeEnd: c.tradeTimeEnd,
            location: c.location,
            items: items,
            images: submitImages(),
            note: c.itemInfo || '',
            contact: c.contact || '',
        };
        if (el.btnSubmit) {
            el.btnSubmit.disabled = true;
            el.btnSubmit.classList.add('is-locked');
        }
        try {
            if (state.editingOrderId) {
                var patchBody = {
                    expireDays: payload.expireDays,
                    tradeTimeStart: payload.tradeTimeStart,
                    tradeTimeEnd: payload.tradeTimeEnd,
                    location: payload.location,
                    items: payload.items,
                    images: payload.images,
                    note: payload.note,
                    contact: payload.contact,
                };
                var patchRes = await fetch(joinUrl('/api/market/orders/' + encodeURIComponent(state.editingOrderId)), {
                    method: 'PATCH',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders()),
                    body: JSON.stringify(patchBody),
                });
                var patchData = await patchRes.json().catch(function () { return {}; });
                if (!patchRes.ok) throw new Error((patchData && patchData.message) || '保存失败');
                closeModal();
                if (typeof window.USS_MARKET_ON_ORDER_SAVED === 'function') {
                    window.USS_MARKET_ON_ORDER_SAVED();
                } else {
                    await fetchOrders();
                }
                return;
            }
            var r = await fetch(joinUrl('/api/market/orders'), {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders()),
                body: JSON.stringify(payload),
            });
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok) {
                if (data && data.code === 'MKT_042') {
                    closeModal();
                    ensureRsiBindThen(function () {});
                    return;
                }
                throw new Error(apiErrorText(data, '生成单据失败'));
            }
            closeModal();
            state.tab = c.orderType === 'buy' ? 'buy' : 'sell';
            syncTabs();
            await fetchOrders();
        } catch (e) {
            el.formError.textContent = (e && e.message) || '生成单据失败，稍后再试';
            el.formError.hidden = false;
        } finally {
            syncListingSubmitEnabled();
        }
    }

    function wireEvents() {
        if (el.searchInput) {
            el.searchInput.addEventListener('input', function () {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function () {
                    state.searchQ = el.searchInput.value.trim();
                    fetchOrders();
                }, 280);
            });
        }
        if (el.tabSell) {
            el.tabSell.addEventListener('click', function () {
                state.tab = 'sell';
                syncTabs();
                fetchOrders();
            });
        }
        if (el.tabBuy) {
            el.tabBuy.addEventListener('click', function () {
                state.tab = 'buy';
                syncTabs();
                fetchOrders();
            });
        }
        if (el.cats) {
            el.cats.addEventListener('click', function (ev) {
                var btn = ev.target.closest('.market-cat');
                if (!btn) return;
                state.categoryGroup = btn.getAttribute('data-cat') || '';
                renderCategoryChips();
                fetchOrders();
            });
        }
        if (el.grid) {
            el.grid.addEventListener('click', function (ev) {
                var card = ev.target.closest('.market-card');
                if (!card) return;
                var id = card.getAttribute('data-order-id');
                if (id) openOrderDetail(id);
            });
        }
        if (el.pager) {
            el.pager.addEventListener('click', function (ev) {
                var btn = ev.target.closest('[data-page]');
                if (!btn || btn.disabled) return;
                var raw = btn.getAttribute('data-page');
                var size = PAGE_SIZES.indexOf(state.pageSize) >= 0 ? state.pageSize : 20;
                var pages = Math.max(1, Math.ceil(state.orders.length / size) || 1);
                var next = state.page;
                if (raw === 'prev') next -= 1;
                else if (raw === 'next') next += 1;
                else next = Number(raw) || 1;
                if (next < 1) next = 1;
                if (next > pages) next = pages;
                if (next === state.page) return;
                state.page = next;
                renderGrid();
            });
            el.pager.addEventListener('change', function (ev) {
                var sel = ev.target.closest('#marketPageSize');
                if (!sel) return;
                var n = Number(sel.value);
                if (PAGE_SIZES.indexOf(n) < 0) return;
                state.pageSize = n;
                state.page = 1;
                try { localStorage.setItem(PAGE_SIZE_KEY, String(n)); } catch (e) { /* ignore */ }
                renderGrid();
            });
        }
        if (el.termsGuideBtn) {
            el.termsGuideBtn.addEventListener('click', openTermsGuide);
        }
        if (el.flowGuideBtn) {
            el.flowGuideBtn.addEventListener('click', openFlowGuide);
        }
        if (el.detailClose) el.detailClose.addEventListener('click', closeOrderDetail);
        if (el.detailBackdrop) {
            el.detailBackdrop.addEventListener('click', function (ev) {
                if (ev.target === el.detailBackdrop) closeOrderDetail();
            });
        }
        if (el.flowClose) el.flowClose.addEventListener('click', function () {
            closeFlowGuide(false);
        });
        if (el.termsClose) el.termsClose.addEventListener('click', function () {
            closeTermsGuide(false);
        });
        if (el.termsAckBtn) {
            el.termsAckBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                ackForcedTerms();
            });
        }
        if (el.termsChk) {
            el.termsChk.addEventListener('change', syncTermsAckBtn);
        }
        if (el.termsBackdrop) {
            el.termsBackdrop.addEventListener('click', function (ev) {
                if (ev.target !== el.termsBackdrop) return;
                if (isTermsForced()) return;
                closeTermsGuide(false);
            });
        }
        if (el.flowAckBtn) {
            el.flowAckBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                ackForcedFlow();
            });
        }
        if (el.flowBackdrop) {
            el.flowBackdrop.addEventListener('click', function (ev) {
                if (ev.target !== el.flowBackdrop) return;
                if (isFlowForced()) return;
                closeFlowGuide(false);
            });
        }
        document.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Escape') return;
            var lb = document.getElementById('communityImageLightbox');
            if (lb && lb.classList.contains('is-open')) return;
            if (el.confirmBackdrop && !el.confirmBackdrop.hidden) {
                ev.preventDefault();
                closeConfirmModal(false);
                return;
            }
            if (el.termsBackdrop && !el.termsBackdrop.hidden) {
                ev.preventDefault();
                closeTermsGuide(false);
                return;
            }
            if (el.flowBackdrop && !el.flowBackdrop.hidden) {
                closeFlowGuide(false);
                return;
            }
            if (el.detailBackdrop && !el.detailBackdrop.hidden) closeOrderDetail();
            else if (el.modalBackdrop && !el.modalBackdrop.hidden) closeModal();
        });
        if (!document.body.classList.contains('market-trades-body')) {
            if (el.confirmClose) el.confirmClose.addEventListener('click', function () { closeConfirmModal(false); });
            if (el.confirmCancel) el.confirmCancel.addEventListener('click', function () { closeConfirmModal(false); });
            if (el.confirmOk) el.confirmOk.addEventListener('click', submitConfirmModal);
            if (el.confirmPromptInput) {
                el.confirmPromptInput.addEventListener('input', function () {
                    el.confirmPromptInput.removeAttribute('aria-invalid');
                    if (el.confirmPromptError) {
                        el.confirmPromptError.hidden = true;
                        el.confirmPromptError.textContent = '';
                    }
                });
                el.confirmPromptInput.addEventListener('keydown', function (ev) {
                    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
                        ev.preventDefault();
                        submitConfirmModal();
                    }
                });
            }
            if (el.confirmBackdrop) {
                el.confirmBackdrop.addEventListener('click', function (ev) {
                    if (ev.target === el.confirmBackdrop) closeConfirmModal(false);
                });
            }
        }
        if (el.btnCreate) el.btnCreate.addEventListener('click', openModal);
        if (el.modalClose) el.modalClose.addEventListener('click', closeModal);
        if (el.modalCancel) el.modalCancel.addEventListener('click', closeModal);
        if (el.modalBackdrop) {
            el.modalBackdrop.addEventListener('click', function (ev) {
                if (ev.target === el.modalBackdrop) closeModal();
            });
        }
        if (el.btnSubmit) el.btnSubmit.addEventListener('click', submitOrder);
        if (el.listingTermsChk) {
            el.listingTermsChk.addEventListener('change', syncListingSubmitEnabled);
        }
        if (el.listingTermsLink) {
            el.listingTermsLink.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                openTermsGuide();
            });
        }

        function bindSeg(container, key, attr) {
            if (!container) return;
            container.addEventListener('click', function (ev) {
                var btn = ev.target.closest('button[data-' + attr + ']');
                if (!btn || btn.disabled || state.editingOrderId) return;
                var val = btn.getAttribute('data-' + attr);
                state.create[key] = key === 'expireDays' ? Number(val) : val;
                if (key === 'tradeType' && val === 'barter') {
                    state.create.orderType = 'sell';
                }
                syncCreateFormUi();
            });
        }
        bindSeg(el.segTradeType, 'tradeType', 'trade-type');
        bindSeg(el.segOrderType, 'orderType', 'order-type');
        bindSeg(el.segExpireDays, 'expireDays', 'expire-days');

        if (el.categorySelect) {
            el.categorySelect.addEventListener('change', function () {
                state.create.categoryGroup = el.categorySelect.value || '';
                var it = currentItem();
                if (state.create.categoryGroup) it.categoryGroup = state.create.categoryGroup;
            });
        }

        if (el.tradeTimeStart) {
            el.tradeTimeStart.addEventListener('change', function () {
                state.create.tradeTimeStart = el.tradeTimeStart.value || '20:00';
                var start = parseTimeMinutes(state.create.tradeTimeStart);
                var end = parseTimeMinutes(el.tradeTimeEnd && el.tradeTimeEnd.value);
                if (start != null && (end == null || end <= start) && el.tradeTimeEnd) {
                    el.tradeTimeEnd.value = formatTimeMinutes(Math.min(start + 60, 23 * 60 + 59));
                    state.create.tradeTimeEnd = el.tradeTimeEnd.value;
                }
            });
        }
        if (el.tradeTimeEnd) {
            el.tradeTimeEnd.addEventListener('change', function () {
                state.create.tradeTimeEnd = el.tradeTimeEnd.value || '21:00';
            });
        }

        function wireImageInput(inputEl, onLoad) {
            if (!inputEl) return;
            inputEl.addEventListener('change', function () {
                var file = inputEl.files && inputEl.files[0];
                if (!file) return;
                if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
                    if (el.formError) {
                        el.formError.textContent = '仅支持 JPG / PNG / WebP / GIF 图片';
                        el.formError.hidden = false;
                    }
                    inputEl.value = '';
                    return;
                }
                if (file.size > 4 * 1024 * 1024) {
                    if (el.formError) {
                        el.formError.textContent = '图片不能超过 4MB';
                        el.formError.hidden = false;
                    }
                    inputEl.value = '';
                    return;
                }
                var reader = new FileReader();
                reader.onload = function () {
                    onLoad(String(reader.result || ''));
                    if (el.formError) el.formError.hidden = true;
                };
                reader.readAsDataURL(file);
            });
        }

        wireImageInput(el.imageInput, function (dataUrl) {
            state.create.userImage = dataUrl;
            renderProductImage(currentItem());
        });

        if (el.imageRemove) {
            el.imageRemove.addEventListener('click', function () {
                state.create.userImage = null;
                state.create.existingImage = null;
                if (el.imageInput) el.imageInput.value = '';
                renderProductImage(currentItem());
            });
        }

        wireImageInput(el.wantImageInput, function (dataUrl) {
            state.create.barterWantUserImage = dataUrl;
            renderWantProductImage(currentWantItem());
        });

        if (el.wantImageRemove) {
            el.wantImageRemove.addEventListener('click', function () {
                state.create.barterWantUserImage = null;
                state.create.barterWantExistingImage = null;
                if (el.wantImageInput) el.wantImageInput.value = '';
                renderWantProductImage(currentWantItem());
            });
        }

        if (el.wantCategorySelect) {
            el.wantCategorySelect.addEventListener('change', function () {
                state.create.barterWantCategoryGroup = el.wantCategorySelect.value || '';
                var want = currentWantItem();
                if (state.create.barterWantCategoryGroup) want.categoryGroup = state.create.barterWantCategoryGroup;
            });
        }

        function scheduleItemSuggest(inputEl, suggestNode, onRender, timerKey, controllerKey, onInputChange) {
            if (!inputEl) return;
            var composing = false;
            inputEl.addEventListener('compositionstart', function () { composing = true; });
            inputEl.addEventListener('compositionend', function () {
                composing = false;
                inputEl.dispatchEvent(new Event('input'));
            });
            inputEl.addEventListener('input', function (ev) {
                if (ev.isComposing || composing) return;
                if (typeof onInputChange === 'function') onInputChange();
                clearTimeout(timerKey === 'want' ? wantItemSuggestTimer : itemSuggestTimer);
                var q = inputEl.value.trim();
                if (q.length < 1) {
                    hideSuggest(suggestNode);
                    return;
                }
                var timer = setTimeout(function () {
                    var fn = timerKey === 'want' ? suggestWantItems : suggestItems;
                    fn(q, onRender);
                }, 180);
                if (timerKey === 'want') wantItemSuggestTimer = timer;
                else itemSuggestTimer = timer;
            });
            inputEl.addEventListener('focus', function () {
                var q = inputEl.value.trim();
                if (q) {
                    var fn = timerKey === 'want' ? suggestWantItems : suggestItems;
                    fn(q, onRender);
                }
            });
            inputEl.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') hideSuggest(suggestNode);
            });
        }

        scheduleItemSuggest(el.wantItemInput, el.wantItemSuggest, renderWantItemSuggestList, 'want', null, function () {
            var want = currentWantItem();
            want.name = el.wantItemInput.value.trim();
            clearWantItemPick();
        });

        scheduleItemSuggest(el.itemInput, el.itemSuggest, renderItemSuggestList, 'offer', null, function () {
            var it = currentItem();
            it.name = el.itemInput.value.trim();
            clearItemPick();
        });

        if (el.modalBackdrop) {
            el.modalBackdrop.addEventListener('mousedown', function (ev) {
                if (el.itemSuggest && !ev.target.closest('.market-suggest-wrap')) {
                    hideSuggest(el.itemSuggest);
                }
                if (el.wantItemSuggest && !ev.target.closest('.market-suggest-wrap')) {
                    hideSuggest(el.wantItemSuggest);
                }
            });
        }

        if (el.locInput) {
            el.locInput.addEventListener('input', function () {
                state.create.location = null;
                clearTimeout(locSuggestTimer);
                var q = el.locInput.value.trim();
                if (q.length < 1) { hideSuggest(el.locSuggest); return; }
                locSuggestTimer = setTimeout(function () {
                    suggestLocations(q, function (items) {
                        var list = items.slice();
                        if (!list.some(function (it) { return it.name === q; })) {
                            list.push({
                                name: q,
                                system: null,
                                type: 'Custom',
                                custom: true,
                            });
                        }
                        renderSuggestList(el.locSuggest, list, function (it) {
                            if (it.custom) return escapeHtml('使用自定义：' + it.name);
                            return escapeHtml(locationLabel(it));
                        }, function (picked) {
                            state.create.location = {
                                id: picked.nameEn || picked.name || null,
                                name: picked.name || q,
                                system: picked.system || null,
                                custom: !!picked.custom,
                            };
                            el.locInput.value = state.create.location.name;
                        });
                    });
                }, 180);
            });
            el.locInput.addEventListener('blur', function () {
                syncLocationFromInput();
            });
            el.locInput.addEventListener('focus', function () {
                var q = el.locInput.value.trim();
                if (q.length >= 1) {
                    el.locInput.dispatchEvent(new Event('input'));
                } else {
                    suggestLocations('', function (items) {
                        renderSuggestList(el.locSuggest, items, function (it) {
                            return escapeHtml(locationLabel(it));
                        }, function (picked) {
                            state.create.location = {
                                id: picked.nameEn || picked.name || null,
                                name: picked.name,
                                system: picked.system || null,
                                custom: false,
                            };
                            el.locInput.value = state.create.location.name;
                        });
                    });
                }
            });
        }
    }

    function cacheElements() {
        el.gate = $('marketGate');
        el.content = $('marketContent');
        el.searchInput = $('marketSearch');
        el.tabSell = $('marketTabSell');
        el.tabBuy = $('marketTabBuy');
        el.cats = $('marketCats');
        el.grid = $('marketGrid');
        el.gridEmpty = $('marketGridEmpty');
        el.pager = $('marketPager');
        el.btnCreate = $('marketBtnCreate');
        el.modalBackdrop = $('marketModalBackdrop');
        el.modal = el.modalBackdrop ? el.modalBackdrop.querySelector('.market-modal') : null;
        el.formRoot = document.querySelector('.market-form');
        el.modalTitle = $('marketModalTitle');
        el.detailBackdrop = $('marketDetailBackdrop');
        el.detailModal = el.detailBackdrop ? el.detailBackdrop.querySelector('.market-detail') : null;
        el.detailBody = $('marketDetailBody');
        el.detailClose = $('marketDetailClose');
        el.confirmBackdrop = $('marketConfirmBackdrop');
        el.confirmModal = el.confirmBackdrop ? el.confirmBackdrop.querySelector('.market-confirm') : null;
        el.confirmTitle = $('marketConfirmTitle');
        el.confirmMessage = $('marketConfirmMessage');
        el.confirmClose = $('marketConfirmClose');
        el.confirmCancel = $('marketConfirmCancel');
        el.confirmOk = $('marketConfirmOk');
        el.confirmPromptWrap = $('marketConfirmPromptWrap');
        el.confirmPromptLabel = $('marketConfirmPromptLabel');
        el.confirmPromptInput = $('marketConfirmPromptInput');
        el.confirmPromptHint = $('marketConfirmPromptHint');
        el.confirmPromptError = $('marketConfirmPromptError');
        el.termsBackdrop = $('marketTermsBackdrop');
        el.termsClose = $('marketTermsClose');
        el.termsBody = $('marketTermsBody');
        el.termsForceFoot = $('marketTermsForceFoot');
        el.termsAckBtn = $('marketTermsAckBtn');
        el.termsChk = $('marketTermsChk');
        el.termsGuideBtn = $('marketTermsGuideBtn');
        el.flowBackdrop = $('marketFlowBackdrop');
        el.flowClose = $('marketFlowClose');
        el.flowGuideBtn = $('marketFlowGuideBtn');
        el.flowForceFoot = $('marketFlowForceFoot');
        el.flowForceHint = $('marketFlowForceHint');
        el.flowAckBtn = $('marketFlowAckBtn');
        el.flowMuteChk = $('marketFlowMuteChk');
        el.modalClose = $('marketModalClose');
        el.modalCancel = $('marketModalCancel');
        el.segTradeType = $('marketSegTradeType');
        el.segOrderType = $('marketSegOrderType');
        el.tradeTypeField = $('marketTradeTypeField');
        el.orderTypeField = $('marketOrderTypeField');
        el.segExpireDays = $('marketSegExpireDays');
        el.offerLabel = $('marketOfferLabel');
        el.barterWantSection = $('marketBarterWantSection');
        el.locInput = $('marketLocInput');
        el.locSuggest = $('marketLocSuggest');
        el.categorySelect = $('marketCategorySelect');
        el.qualityInput = $('marketQualityInput');
        el.tradeTimeStart = $('marketTradeTimeStart');
        el.tradeTimeEnd = $('marketTradeTimeEnd');
        el.itemInfoInput = $('marketItemInfoInput');
        el.contactInput = $('marketContactInput');
        el.itemInput = $('marketItemInput');
        el.itemSuggest = $('marketItemSuggest');
        el.itemPreviewType = $('marketItemPreviewType');
        el.imageInput = $('marketImageInput');
        el.imagePreview = $('marketImagePreview');
        el.imagePreviewImg = $('marketImagePreviewImg');
        el.imagePlaceholder = $('marketImagePlaceholder');
        el.imageRemove = $('marketImageRemove');
        el.qtyInput = $('marketQtyInput');
        el.qtyLabel = $('marketQtyLabel');
        el.priceInput = $('marketPriceInput');
        el.priceField = $('marketPriceField');
        el.hqPointsHint = $('marketHqPointsHint');
        el.wantItemInput = $('marketWantItemInput');
        el.wantItemSuggest = $('marketWantItemSuggest');
        el.wantCategorySelect = $('marketWantCategorySelect');
        el.wantQualityInput = $('marketWantQualityInput');
        el.wantQtyInput = $('marketWantQtyInput');
        el.wantQtyLabel = $('marketWantQtyLabel');
        el.wantImageInput = $('marketWantImageInput');
        el.wantImagePreview = $('marketWantImagePreview');
        el.wantImagePreviewImg = $('marketWantImagePreviewImg');
        el.wantImagePlaceholder = $('marketWantImagePlaceholder');
        el.wantImageRemove = $('marketWantImageRemove');
        el.wantItemPreviewType = $('marketWantItemPreviewType');
        el.btnSubmit = $('marketBtnSubmit');
        el.listingTermsWrap = $('marketListingTermsWrap');
        el.listingTermsChk = $('marketListingTermsChk');
        el.listingTermsLink = $('marketListingTermsLink');
        el.listingTermsHint = $('marketListingTermsHint');
        el.formError = $('marketFormError');
    }

    function init() {
        cacheElements();
        state.pageSize = readPageSize();
        wireEvents();
        initHeroParallax();
        window.UssMarket = {
            openEditModal: openEditModal,
            renderManageOrderCardHtml: renderManageOrderCardHtml,
            openListingDetail: openListingDetail,
            cardMediaHtml: cardMediaHtml,
            primaryCategory: primaryCategory,
            formatQualityBrief: formatQualityBrief,
            primaryItemName: primaryItemName,
            formatPrice: formatPrice,
            formatDateMinute: formatDateMinute,
            formatDateShort: formatDateShort,
            formatDateYmd: formatDateYmd,
            dateTimeHtml: dateTimeHtml,
            timeLineHtml: timeLineHtml,
        };
        if (document.body.classList.contains('market-trades-body')) {
            return;
        }
        refreshNavLoginState();
        window.addEventListener('storage', refreshNavLoginState);
        renderCategoryChips();
        syncTabs();
        hideGate();
        fetchOrders();
        if (isLoggedIn() && window.UssMarketNotify && typeof window.UssMarketNotify.init === 'function') {
            window.UssMarketNotify.init();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
