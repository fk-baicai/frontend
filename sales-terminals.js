(function () {
    var data = null;
    var shipArt = {};
    var catById = {};
    var pickedKey = '';
    var pendingScroll = false;
    var catalog = [];
    var hits = [];
    var hitIndex = -1;
    var hitSystem = '';
    var state = { side: 'buy', group: '', system: '', planet: '', moon: '', place: '', shop: '', cat: '' };
    var openSections = {};
    var els = {
        systems: document.getElementById('stSystem'),
        planets: document.getElementById('stPlanet'),
        moons: document.getElementById('stMoon'),
        places: document.getElementById('stPlace'),
        terminals: document.getElementById('stTerminal'),
        status: document.getElementById('stStatus'),
        title: document.getElementById('stTitle'),
        shopName: document.getElementById('stShopName'),
        shopPath: document.getElementById('stShopPath'),
        shopCount: document.getElementById('stShopCount'),
        superInput: document.getElementById('stSuper'),
        results: document.getElementById('stSuperResults'),
        cats: document.getElementById('stCats'),
        list: document.getElementById('stList'),
        detail: document.getElementById('stDetail'),
    };

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function scuCat(id) {
        return id >= 9101 && id <= 9105;
    }
    function money(n, item) {
        var unit = item && scuCat(item[2]) ? ' / SCU' : '';
        return Number(n).toLocaleString('zh-CN') + ' aUEC' + unit;
    }
    function listings(shop) {
        if (!shop) return null;
        var key = state.side === 'sell' ? 'sells' : 'items';
        var countKey = state.side === 'sell' ? 'sellCount' : 'itemCount';
        var stock = shop[key];
        if (Array.isArray(stock)) {
            if (!stock.length && Number(shop[countKey]) > 0) return null;
            return stock;
        }
        if (Number(shop[countKey]) > 0) return null;
        return null;
    }
    function offers(shop) {
        if (state.side === 'sell') return Number(shop.sellCount) > 0 || (Array.isArray(shop.sells) && shop.sells.length > 0);
        return Number(shop.itemCount) > 0 || (Array.isArray(shop.items) && shop.items.length > 0);
    }
    function priceWord() {
        return state.side === 'sell' ? '出售价' : '买入价';
    }
    function qtyWord() {
        return state.side === 'sell' ? '收购' : '可买';
    }
    function syncSideButtons() {
        document.querySelectorAll('[data-side]').forEach(function (btn) {
            var on = btn.getAttribute('data-side') === state.side;
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (els.superInput) {
            els.superInput.placeholder = state.side === 'sell' ? '输入物品名称，查找哪台终端收购' : '输入物品名称，查找哪台终端在售';
        }
    }
    function groupLabel(id) {
        var hit = (data.groups || []).filter(function (g) { return g.id === id; })[0];
        return hit ? hit.label : '终端';
    }
    var codeUses = {};
    function shopToken(shop) {
        if (!shop) return '';
        return codeUses[shop.code] > 1 ? shop.code + ':' + shop.id : shop.code;
    }
    function shopByCode(code) {
        if (!code) return null;
        var raw = String(code);
        var i;
        for (i = 0; i < data.shops.length; i++) {
            if (shopToken(data.shops[i]) === raw) return data.shops[i];
        }
        for (i = 0; i < data.shops.length; i++) {
            if (data.shops[i].code === raw) return data.shops[i];
        }
        return null;
    }
    function planetKey(shop) {
        return shop.planet || '__stations__';
    }
    var parents = { zh: {}, places: {} };
    function applyParents() {
        normalizeShopLocations();
        (data.shops || []).forEach(function (shop) {
            var moon = parents.places[shop.place] || (shop.planet ? '__surface__' : '');
            shop.moon = moon;
            shop.moonZh = (parents.zh && parents.zh[moon]) || '';
        });
        applyTerminalBrands();
    }
    function moonLabel(key) {
        if (key === '__surface__') return '行星表面';
        if (key === '__lagrange__') return '拉格朗日点';
        return bi((parents.zh && parents.zh[key]) || '', key);
    }
    function bi(zh, en) {
        var z = String(zh || '').trim();
        var e = String(en || '').trim();
        if (!z || z === e) return e;
        return z + ' ' + e;
    }
    function biHtml(zh, en) {
        var z = String(zh || '').trim();
        var e = String(en || '').trim();
        if (!z || z === e) return escapeHtml(e);
        return escapeHtml(z) + '<span class="st-bi-en">' + escapeHtml(e) + '</span>';
    }
    var PLACE_ZH_FALLBACK = {
        'Green Imperial Housing Exchange': '六角湾',
        'Green Imperial': '六角湾',
        'Grim HEX': '六角湾',
        GrimHEX: '六角湾',
        Levski: '列夫斯基',
        'Pyro Gateway (Nyx)': '派罗星门',
        'Stanton Gateway (Nyx)': '斯坦顿星门',
        "People's Service Station Alpha": '人民服务空间站 阿尔法',
        "People's Service Station Delta": '人民服务空间站 德尔塔',
        "People's Service Station Lambda": '人民服务空间站 拉姆达',
        "People's Service Station Theta": '人民服务空间站 西塔',
    };
    var FIELD_ZH_OFFICIAL = {
        Stanton: '斯坦顿',
        Pyro: '派罗',
        Nyx: '尼克斯',
        Delamar: '德拉玛',
        Levski: '列夫斯基',
    };
    function hasCjk(s) {
        return /[\u4e00-\u9fff]/.test(String(s || ''));
    }
    function stripLocParen(zh) {
        return String(zh || '').replace(/\s*[（(][^）)]*[）)]\s*/g, '').trim();
    }
    function normalizeShopLocations() {
        (data.shops || []).forEach(function (shop) {
            if (shop.system === 'Nyx' && shop.place === 'Levski' && !String(shop.planet || '').trim()) {
                shop.planet = 'Delamar';
                if (!hasCjk(shop.planetZh)) shop.planetZh = FIELD_ZH_OFFICIAL.Delamar;
            }
        });
    }
    function applyTerminalBrands() {
        var brands = (typeof window !== 'undefined' && window.USS_TERMINAL_BRANDS) || {};
        var byName = {};
        (data.shops || []).forEach(function (shop) {
            var nz = stripLocParen(shop.nameZh);
            if (hasCjk(nz) && shop.name) byName[shop.name] = nz;
        });
        (data.shops || []).forEach(function (shop) {
            var fromCode = brands[shop.code];
            if (fromCode && hasCjk(fromCode)) shop.nameZh = fromCode;
            else if (!hasCjk(stripLocParen(shop.nameZh)) && byName[shop.name]) shop.nameZh = byName[shop.name];
            ['system', 'planet', 'place'].forEach(function (field) {
                var en = String(shop[field] || '').trim();
                if (!en) return;
                var zhField = field + 'Zh';
                var cur = stripLocParen(shop[zhField]);
                if (hasCjk(cur)) {
                    shop[zhField] = cur;
                    return;
                }
                if (FIELD_ZH_OFFICIAL[en]) shop[zhField] = FIELD_ZH_OFFICIAL[en];
            });
            if (shop.place && PLACE_ZH_FALLBACK[shop.place] && !hasCjk(stripLocParen(shop.placeZh))) {
                shop.placeZh = PLACE_ZH_FALLBACK[shop.place];
            }
            if (hasCjk(stripLocParen(shop.nameZh))) shop.nameZh = stripLocParen(shop.nameZh);
        });
    }
    function fieldZh(field, en) {
        var i;
        var hit;
        for (i = 0; i < data.shops.length; i++) {
            if (data.shops[i][field] === en) {
                hit = data.shops[i][field + 'Zh'] || '';
                if (hit) return hit;
            }
        }
        if (field === 'place') return PLACE_ZH_FALLBACK[en] || '';
        if (FIELD_ZH_OFFICIAL[en]) return FIELD_ZH_OFFICIAL[en];
        return '';
    }
    var ICO = {
        system: '<svg class="st-ico st-ico-lg" viewBox="0 0 1024 1024" aria-hidden="true"><path fill="currentColor" d="M530.3 940.5c-63.3 0-126-15.7-181.3-45.5l13.4-24.9c51.3 27.6 109.3 42.2 168 42.2 195.7 0 354.9-159.2 354.9-354.9s-159.2-354.9-354.9-354.9-354.9 159.2-354.9 354.9c0 86.5 31.5 169.9 88.7 234.7l-21.2 18.7c-61.7-70-95.7-160-95.7-253.4 0-51.7 10.1-101.9 30.1-149.2 19.3-45.6 46.9-86.6 82.1-121.8 35.2-35.2 76.2-62.8 121.8-82.1 47.3-20 97.4-30.1 149.2-30.1s101.9 10.1 149.2 30.1c45.6 19.3 86.6 46.9 121.8 82.1 35.2 35.2 62.8 76.2 82.1 121.8 20 47.3 30.1 97.4 30.1 149.2s-10.1 101.9-30.1 149.2c-19.3 45.6-46.9 86.6-82.1 121.8-35.2 35.2-76.2 62.8-121.8 82.1-47.3 20-97.4 30.1-149.2 30.1z"/><path fill="currentColor" d="M530.3 819.4c-70 0-135.8-27.3-185.3-76.8-49.5-49.5-76.8-115.3-76.8-185.3s27.3-135.8 76.8-185.3 115.3-76.8 185.3-76.8c13.4 0 26.8 1 39.9 3l-4.3 27.9a236.7 236.7 0 0 0-35.6-2.7c-128.9 0-233.8 104.9-233.8 233.8s104.9 233.8 233.8 233.8 233.8-104.9 233.8-233.8c0-83.7-45.2-161.5-117.9-203.1l14-24.5c39.4 22.5 72.5 55.1 95.7 94.2 23.9 40.3 36.5 86.4 36.5 133.5 0 70-27.3 135.8-76.8 185.3-49.5 49.5-115.3 76.8-185.3 76.8z"/><path fill="currentColor" d="M530.3 691.1c-73.7 0-133.7-60-133.7-133.7s60-133.8 133.7-133.8 133.7 60 133.7 133.7-60 133.8-133.7 133.8zm0-239.2c-58.2 0-105.5 47.3-105.5 105.5s47.3 105.5 105.5 105.5 105.5-47.3 105.5-105.5-47.3-105.5-105.5-105.5zM613.2 383.3c-29.6 0-53.8-24.1-53.8-53.8s24.1-53.8 53.8-53.8 53.8 24.1 53.8 53.8-24.1 53.8-53.8 53.8zm0-88.7c-19.3 0-34.9 15.7-34.9 34.9s15.7 34.9 34.9 34.9 34.9-15.7 34.9-34.9-15.6-34.9-34.9-34.9zM302.8 917.9c-41.8 0-75.9-34-75.9-75.9s34-75.9 75.9-75.9 75.9 34 75.9 75.9-34 75.9-75.9 75.9zm0-132.9c-31.4 0-57 25.6-57 57s25.6 57 57 57 57-25.6 57-57-25.6-57-57-57z"/></svg>',
        planet: '<svg class="st-ico" viewBox="0 0 1075 1024" aria-hidden="true"><path fill="currentColor" d="M189.3 647.8c3.1 0 6.2-.5 9.3-1.5 15-5.1 22.9-21.3 17.8-36.2-11.2-32.7-16.9-67-16.9-101.9 0-173.7 141.9-315 316.3-315 162.9 0 298.2 121.6 314.6 282.8 1.6 15.7 15.7 27.1 31.4 25.5 15.7-1.6 27.2-15.6 25.6-31.3-19.4-190.4-179.2-334-371.6-334-206 0-373.5 166.9-373.5 372.1 0 41.2 6.7 81.7 20 120.3 4 11.9 15.2 19.3 27 19.3z"/><path fill="currentColor" d="M694 323.5c-10-9.2-25.5-8.5-34.7 1.4-9.2 9.9-8.5 25.4 1.4 34.6 21.6 19.8 38.5 43.3 50.5 69.8 8.4 18.7 13.6 30.2 13.6 40.9 2.5 11.4 12.7 19.2 23.9 19.2 1.8 0 3.5-.2 5.3-.6 13.2-2.9 21.6-16 18.7-29.1a260.8 260.8 0 0 0-16.7-50.4c-14.7-32.6-35.5-61.4-62-85.8zM552.1 256.7c-13.5-1.9-25.8 7.5-27.7 20.9-1.9 13.4 7.5 25.7 20.9 27.6a213.2 213.2 0 0 1 53.7 14.7 24.5 24.5 0 0 0 9.6 1.9c9.6 0 18.6-5.6 22.6-14.9 5.3-12.4-.6-26.8-13-32a262.1 262.1 0 0 0-66.1-18.2z"/><path fill="currentColor" d="M1010.1 438.3c-5.4-28.9-29.1-51.5-70.4-67.2-12.6-4.8-26.8 1.5-31.7 14.1-4.8 12.6 1.5 26.7 14.2 31.6 23.3 8.8 37.7 20 39.7 30.5 8.4 45.2-154.6 143.3-429.1 194.1-124.4 23-243.6 30.9-335.7 22.2-88.3-8.3-131.3-31-134.8-49.8-2.1-11.1 8.4-27.5 28.7-45 10.3-8.8 11.4-24.3 2.5-34.5-8.9-10.2-24.4-11.3-34.6-2.5-35.4 30.4-50.5 61-44.9 90.9 9 48.4 70.7 79.4 178.4 89.6 4 .4 8.1.7 12.1 1 .6 1.3 1.3 2.7 2.2 4 69.7 102.1 185.3 163.1 309.1 163.1 174.7 0 324.4-118.3 363.8-287.6.7-3 .8-6 .5-9 86.1-43.5 139.6-94 130-145.4zm-494.3 384.9c-91.8 0-178.2-39.6-237.9-107.4 79.7-.2 170.5-9.2 263.8-26.4 97-17.9 192.7-44.4 272.3-76.1-44 125.2-162.1 210-298.2 209.9z"/></svg>',
        station: '<svg class="st-ico" viewBox="0 0 1024 1024" aria-hidden="true"><path fill="currentColor" d="M832 192c-34.1-34.1-72.5-51.2-119.5-51.2s-85.3 17.1-119.5 51.2L320 465.1c-17.1 17.1-17.1 42.7 0 59.7l179.2 179.2c17.1 17.1 42.7 17.1 59.7 0l273.1-273.1c34.1-34.1 51.2-72.5 51.2-119.5-4.3-42.7-21.3-85.3-51.2-119.4zm-59.7 183.5L529.1 618.7 409.6 499.2 652.8 256c17.1-17.1 38.4-25.6 59.7-25.6 25.6 0 42.7 8.5 59.7 25.6 17.1 17.1 25.6 38.4 25.6 59.7-4.2 21.4-12.8 42.7-25.6 59.8zM409.6 315.7 285.9 192l59.7-59.7L469.3 251.7l59.7-59.7L379.7 42.7c-17.1-17.1-42.7-17.1-59.7 0L196.3 162.1c-17.1 17.1-17.1 42.7 0 59.7l149.3 149.4 64-55.5zM832 738.1 712.5 618.7l-59.7 59.7 149.3 149.3c17.1 17.1 42.7 17.1 59.7 0l119.5-119.5c17.1-17.1 17.1-42.7 0-59.7L832 499.2l-59.7 55.5L891.9 674l-59.9 64.1zM294.4 584.5c8.5 34.1 29.9 64 55.5 89.6s55.5 42.7 89.6 55.5c12.8 4.3 17.1 12.8 17.1 25.6l-8.5 42.7c-4.3 12.8-12.8 21.3-25.6 17.1-51.2-12.8-93.9-38.4-132.3-76.8-38.4-38.4-64-81.1-76.8-132.3-4.3-12.8 4.3-21.3 17.1-25.6l42.7-8.5c8.5-4.3 17 4.2 21.3 12.8z"/><path fill="currentColor" d="M324.3 960c51.2 21.3 102.4 29.9 153.6 34.1 12.8 0 21.3-8.5 21.3-21.3v-42.7c0-12.8-8.5-21.3-21.3-21.3-42.7-4.3-85.3-12.8-123.7-25.6-46.9-21.3-89.6-46.9-128-85.3-38.4-38.4-64-81.1-85.3-128-17.1-38.4-25.6-81.1-25.6-123.7 0-12.8-8.5-21.3-21.3-21.3H51.2c-12.8 0-21.3 8.5-21.3 21.3 4.3 55.5 12.8 106.7 34.1 153.6 25.6 59.7 59.7 110.9 102.4 153.6 46.9 46.9 98.1 81.1 157.9 106.6z"/></svg>',
        shop: '<svg class="st-ico" viewBox="0 0 1024 1024" aria-hidden="true"><path fill="currentColor" d="M19.5 78v682.7h985V78H19.5zm887.5 585.1H117V175.5h789.9v487.6zM204.8 848.5h619.3v97.5H204.8z"/><path fill="currentColor" d="M287.7 609.5 477.9 419.3 287.7 229.2l-68.3 68.3L341.3 419.4 219.4 541.3zM536.4 463.2h268.2v97.5H536.4z"/></svg>',
    };
    function locStack(zh, en, icon) {
        var z = String(zh || '').trim();
        var e = String(en || '').trim();
        var text = '';
        if (z && e && z !== e) {
            text = '<span class="st-detail-loc-zh">' + escapeHtml(z) + '</span><span class="st-detail-loc-en">' + escapeHtml(e) + '</span>';
        } else {
            var only = z || e;
            if (!only) return '';
            text = '<span class="st-detail-loc-zh">' + escapeHtml(only) + '</span>';
        }
        return '<span class="st-detail-loc-line">' + icon + '<span class="st-detail-loc-text">' + text + '</span></span>';
    }
    function locationLines(shop) {
        var deep = planetKey(shop) === '__stations__';
        var moon = shop.moon || '';
        var moonLine = '';
        if (!deep && moon && moon !== '__surface__') moonLine = locStack(moon === '__lagrange__' ? '拉格朗日点' : shop.moonZh, moon === '__lagrange__' ? '' : moon, ICO.planet);
        return [
            locStack(shop.systemZh, shop.system, ICO.system),
            deep ? locStack('深空站点', '', ICO.station) : locStack(shop.planetZh, shop.planet, ICO.planet),
            moonLine,
            locStack(shop.placeZh, shop.place, ICO.station),
        ].join('');
    }
    function planetLabel(key) {
        if (key === '__stations__') return '深空站点';
        return bi(fieldZh('planet', key), key);
    }
    function inGroup(shop) {
        return !state.group || shop.group === state.group;
    }
    function scoped(level) {
        return data.shops.filter(function (shop) {
            if (!inGroup(shop) || !offers(shop)) return false;
            if (level === 'group') return true;
            if (shop.system !== state.system) return false;
            if (level === 'system') return true;
            if (planetKey(shop) !== state.planet) return false;
            if (level === 'planet') return true;
            if (state.planet !== '__stations__' && (shop.moon || '__surface__') !== state.moon) return false;
            if (level === 'moon') return true;
            if (shop.place !== state.place) return false;
            return true;
        });
    }
    var SYSTEM_ORDER = { Stanton: 0, Pyro: 1, Nyx: 2 };
    function uniqueSorted(list) {
        return list.filter(function (name, index) { return name && list.indexOf(name) === index; })
            .sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
    }
    function sortPlanets(list) {
        var named = uniqueSorted(list.filter(function (key) { return key && key !== '__stations__'; }));
        if (list.indexOf('__stations__') >= 0) named.push('__stations__');
        return named;
    }
    function sortMoons(list) {
        var rank = { __surface__: 50, __lagrange__: 60 };
        return uniqueSorted(list).sort(function (a, b) {
            var ar = Object.prototype.hasOwnProperty.call(rank, a) ? rank[a] : 0;
            var br = Object.prototype.hasOwnProperty.call(rank, b) ? rank[b] : 0;
            if (ar !== br) return ar - br;
            return moonLabel(a).localeCompare(moonLabel(b), 'zh-CN');
        });
    }
    function sortSystems(list) {
        return uniqueSorted(list).sort(function (a, b) {
            var ai = Object.prototype.hasOwnProperty.call(SYSTEM_ORDER, a) ? SYSTEM_ORDER[a] : 100;
            var bi = Object.prototype.hasOwnProperty.call(SYSTEM_ORDER, b) ? SYSTEM_ORDER[b] : 100;
            if (ai !== bi) return ai - bi;
            return a.localeCompare(b, 'zh-CN');
        });
    }
    function fillSelect(el, placeholder, entries, current, enabled) {
        var seen = {};
        var list = [];
        entries.forEach(function (entry) {
            if (!entry || !entry.value || seen[entry.value]) return;
            seen[entry.value] = true;
            list.push(entry);
        });
        var html = '<option value="" hidden>' + escapeHtml(placeholder) + '</option>';
        list.forEach(function (entry) {
            html += '<option value="' + escapeHtml(entry.value) + '"' + (entry.value === current ? ' selected' : '') + '>' + escapeHtml(entry.label) + '</option>';
        });
        el.innerHTML = html;
        el.disabled = !enabled;
        el.value = current && list.some(function (entry) { return entry.value === current; }) ? current : '';
    }
    function readQuery() {
        var q = new URLSearchParams(window.location.search);
        state.side = q.get('side') === 'sell' ? 'sell' : 'buy';
        state.group = q.get('group') || '';
        state.system = q.get('system') || '';
        state.planet = q.get('planet') || '';
        state.moon = q.get('moon') || '';
        state.place = q.get('place') || '';
        state.shop = q.get('shop') || '';
        state.cat = q.get('cat') || '';
        var linked = shopByCode(state.shop);
        if (linked) {
            state.system = linked.system;
            state.planet = planetKey(linked);
            state.moon = linked.moon || '';
            state.place = linked.place;
            if (state.group && linked.group !== state.group) state.group = '';
        }
        if (!state.moon && state.place) {
            var found = null;
            var i;
            for (i = 0; i < data.shops.length; i++) {
                var shop = data.shops[i];
                if (shop.place !== state.place) continue;
                if (state.system && shop.system !== state.system) continue;
                if (state.planet && planetKey(shop) !== state.planet) continue;
                found = shop;
                break;
            }
            if (found) {
                state.system = found.system;
                state.planet = planetKey(found);
                state.moon = found.moon || '';
            }
        }
    }
    function writeQuery() {
        var q = new URLSearchParams();
        if (state.side === 'sell') q.set('side', 'sell');
        if (state.group) q.set('group', state.group);
        if (state.system) q.set('system', state.system);
        if (state.planet) q.set('planet', state.planet);
        if (state.moon) q.set('moon', state.moon);
        if (state.place) q.set('place', state.place);
        if (state.shop) q.set('shop', state.shop);
        if (state.cat) q.set('cat', state.cat);
        var next = q.toString();
        history.replaceState(null, '', next ? '?' + next : location.pathname);
    }
    function renderLocate() {
        var systems = sortSystems(data.shops.filter(function (shop) { return inGroup(shop) && offers(shop); }).map(function (shop) { return shop.system; }));
        fillSelect(els.systems, '选择星系', systems.map(function (name) { return { value: name, label: bi(fieldZh('system', name), name) }; }), state.system, true);
        if (!state.system || systems.indexOf(state.system) < 0) {
            state.system = '';
            state.planet = '';
            state.moon = '';
            state.place = '';
            state.shop = '';
        }
        var planetKeys = sortPlanets(scoped('system').map(planetKey));
        fillSelect(els.planets, '选择星球', planetKeys.map(function (name) {
            return { value: name, label: planetLabel(name) };
        }), state.planet, !!state.system);
        if (!state.planet || planetKeys.indexOf(state.planet) < 0) {
            state.planet = '';
            state.moon = '';
            state.place = '';
            state.shop = '';
        }
        if (state.planet === '__stations__') {
            state.moon = '';
            fillSelect(els.moons, '深空没有卫星', [], '', false);
        } else if (state.planet) {
            var moonKeys = sortMoons(scoped('planet').map(function (shop) { return shop.moon || '__surface__'; }));
            if (!state.moon || moonKeys.indexOf(state.moon) < 0) state.moon = moonKeys.length === 1 ? moonKeys[0] : '';
            fillSelect(els.moons, '选择卫星', moonKeys.map(function (name) {
                return { value: name, label: moonLabel(name) };
            }), state.moon, true);
            if (!state.moon) {
                state.place = '';
                state.shop = '';
            }
        } else {
            fillSelect(els.moons, '选择卫星', [], '', false);
        }
        var placeReady = state.planet === '__stations__' || !!state.moon;
        var places = placeReady ? uniqueSorted(scoped(state.planet === '__stations__' ? 'planet' : 'moon').map(function (shop) { return shop.place; })) : [];
        fillSelect(els.places, '选择站点', places.map(function (name) { return { value: name, label: bi(fieldZh('place', name), name) }; }), state.place, placeReady);
        if (!state.place || places.indexOf(state.place) < 0) {
            state.place = '';
            state.shop = '';
        }
        var seenShopId = {};
        var shopsHere = state.place
            ? scoped('place').filter(function (shop) {
                if (seenShopId[shop.id]) return false;
                seenShopId[shop.id] = true;
                return true;
            }).slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); })
            : [];
        var terminalPlaceholder = state.place && !shopsHere.length ? '此站点没有这类终端' : '选择终端';
        var names = {};
        var labels = {};
        shopsHere.forEach(function (shop) {
            names[shop.name] = (names[shop.name] || 0) + 1;
            var lab = bi(shop.nameZh, shop.name);
            labels[lab] = (labels[lab] || 0) + 1;
        });
        fillSelect(
            els.terminals,
            terminalPlaceholder,
            shopsHere.map(function (shop) {
                var label = bi(shop.nameZh, shop.name);
                if (names[shop.name] > 1 || labels[label] > 1) {
                    var branch = bi(shop.branchZh, shop.branch);
                    label += ' · ' + (branch || shop.code);
                }
                return { value: shopToken(shop), label: label };
            }),
            state.shop,
            !!state.place && shopsHere.length > 0
        );
        if (!shopByCode(state.shop) || !shopsHere.some(function (shop) { return shopToken(shop) === state.shop || shop.code === state.shop; })) state.shop = '';
    }
    function sectionsFor(shop) {
        var ids = {};
        var stock = listings(shop);
        if (!stock) return [];
        stock.forEach(function (item) { ids[item[2]] = true; });
        var sections = [];
        var map = {};
        data.categories.forEach(function (cat) {
            if (!ids[cat.id]) return;
            if (!map[cat.section]) {
                map[cat.section] = { section: cat.section, sectionZh: cat.sectionZh, cats: [] };
                sections.push(map[cat.section]);
            }
            map[cat.section].cats.push(cat);
        });
        sections.forEach(function (section) {
            section.cats.sort(function (a, b) { return a.nameZh.localeCompare(b.nameZh, 'zh-CN'); });
        });
        sections.sort(function (a, b) { return a.sectionZh.localeCompare(b.sectionZh, 'zh-CN'); });
        return sections;
    }
    var MAKERS = {
        Aegis: '圣盾动力',
        Anvil: '铁砧航天',
        Aopoa: '奥波亚',
        Argo: '南船座宇航',
        Banu: '巴努',
        'C.O.': '联合外域',
        Crusader: '十字军工业',
        Drake: '德雷克星际',
        Esperia: '埃斯佩里亚',
        Gatac: '盖塔克制造',
        "Grey's": '格雷',
        Greycat: '灰猫工业',
        Kruger: '克鲁格星际',
        MISC: '武藏工业与星航',
        Mirai: '未来科技',
        Origin: '起源跃迁',
        RSI: '罗伯茨太空工业',
        Tumbril: '盾博尔陆地系统',
    };
    function isShipItem(item) {
        return item[2] === 102 || item[2] === 9001;
    }
    function makerKey(item) {
        var hit = shipCardHit(item);
        if (hit && hit.maker) return hit.maker;
        var name = String(item[0] || '').replace(/（租赁）$/, '').trim();
        if (name.indexOf('C.O.') === 0) return 'C.O.';
        if (name.indexOf("Grey's") === 0) return "Grey's";
        return name.split(/\s+/)[0] || '';
    }
    function makerLabel(key) {
        return MAKERS[key] || key || '其他';
    }
    var MAKER_LOGO = {
        Aegis: 'assets/makers/aegis.png',
        Anvil: 'assets/makers/anvil.png',
        Argo: 'assets/makers/argo.png',
        'C.O.': 'assets/makers/cnou.png',
        Crusader: 'assets/makers/crusader.png',
        Drake: 'assets/makers/drake.png',
        Esperia: 'assets/makers/esperia.png',
        Gatac: 'assets/makers/gatac.png',
        "Grey's": 'assets/makers/grey.png',
        Greycat: 'assets/makers/greycat.png',
        MISC: 'assets/makers/musashi.png',
        Mirai: 'assets/makers/mirai.png',
        Origin: 'assets/makers/origin.png',
        RSI: 'assets/makers/rsi.png',
        Tumbril: 'assets/makers/tumbril.png',
        Kruger: 'assets/makers/kruger.png',
        Banu: 'assets/makers/banu.png',
        Aopoa: 'assets/makers/aopoa.png',
        Vanduul: 'assets/makers/vanduul.png',
    };
    var shipMakers = [];
    var shipByModel = {};
    function shipModelKey(name) {
        return String(name || '').replace(/（租赁）$/, '').trim().toLowerCase();
    }
    function makerFromCardKey(full) {
        if (full.indexOf('C.O. ') === 0) return { maker: 'C.O.', model: full.slice(5).trim() };
        if (full.indexOf("Grey's Market ") === 0) return { maker: "Grey's", model: full.slice(14).trim() };
        var parts = full.split(/\s+/);
        return { maker: parts[0] || '', model: parts.slice(1).join(' ') };
    }
    function indexShipCards(map) {
        shipByModel = {};
        var seen = {};
        Object.keys(map || {}).forEach(function (full) {
            var split = makerFromCardKey(String(full).trim());
            var model = shipModelKey(split.model);
            if (split.maker && !seen[split.maker]) seen[split.maker] = true;
            var rec = { maker: split.maker, card: map[full] };
            var fullKey = shipModelKey(full);
            if (fullKey && !shipByModel[fullKey]) shipByModel[fullKey] = rec;
            if (model && !shipByModel[model]) shipByModel[model] = rec;
        });
        shipMakers = Object.keys(seen).sort(function (a, b) {
            return makerLabel(a).localeCompare(makerLabel(b), 'zh-CN');
        });
    }
    function shipCardHit(item) {
        return shipByModel[shipModelKey(item && item[0])] || null;
    }
    function makerLogoHtml(key) {
        var file = MAKER_LOGO[key];
        if (!file) return '';
        return '<img src="' + escapeHtml(file) + '" alt="" decoding="async">';
    }
    function catMatches(item) {
        var cat = catById[item[2]];
        if (state.cat === 's:__maker__') return isShipItem(item);
        if (state.cat.indexOf('m:') === 0) return makerKey(item) === state.cat.slice(2);
        if (state.cat.indexOf('c:') === 0) return String(item[2]) === state.cat.slice(2);
        if (state.cat.indexOf('s:') === 0) return !!(cat && cat.section === state.cat.slice(2));
        return true;
    }
    function visibleItems(shop) {
        var stock = listings(shop) || [];
        return stock.filter(catMatches);
    }
    function itemKey(item) {
        return item[0] + '@' + item[1] + '@' + item[2];
    }
    function detailHref(item) {
        var id = item && item[4] ? String(item[4]).trim() : '';
        if (!id || id.indexOf('term-') === 0) return '';
        return 'ship-component-detail?id=' + encodeURIComponent(id) + '&from=' + encodeURIComponent(location.pathname + location.search);
    }
    function catButton(key, name, count, extra, toggleId, open, logo) {
        var on = key ? state.cat === key : !state.cat;
        var mark = toggleId
            ? '<span class="st-cat-mark" data-toggle="' + escapeHtml(toggleId) + '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-label="' + (open ? '收起子分类' : '展开子分类') + '"></span>'
            : '<span class="st-cat-mark">' + (logo || '') + '</span>';
        return '<button type="button" class="st-cat' + (extra ? ' ' + extra : '') + (on ? ' is-on' : '') + '" data-cat="' + escapeHtml(key) + '">' +
            mark +
            '<span class="st-cat-name">' + escapeHtml(name) + '</span>' +
            '<span class="st-cat-count">' + count + '</span></button>';
    }
    function renderDetail(shop, item) {
        if (!shop) {
            els.detail.innerHTML = '<p class="st-detail-kicker">QUOTE</p><p class="st-detail-empty">接入终端后，点选物品查看' + priceWord() + '。</p>';
            return;
        }
        if (!item) {
            els.detail.innerHTML = '<p class="st-detail-kicker">QUOTE</p><p class="st-detail-empty">点选一件物品，查看分类和' + priceWord() + '。</p>';
            return;
        }
        var cat = catById[item[2]] || { sectionZh: '未分类', nameZh: '—' };
        var href = detailHref(item);
        var jump = href
            ? '<a class="st-detail-jump" href="' + escapeHtml(href) + '" aria-label="打开详细页" title="打开详细页"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>'
            : '';
        var photo = '';
        if (shop.group === 'ship_buy') {
            photo = '';
        } else {
        var wikiPhoto = item[6] && String(item[6]).indexOf('http') === 0 ? String(item[6]) : '';
        var imageId = item[4] ? String(item[4]).trim() : '';
        var localId = imageId && imageId.indexOf('term-') !== 0 && item[2] !== 102 && item[2] !== 9001 && !scuCat(item[2]) ? imageId : '';
        if (localId) {
            var localFull = apiUrl('/api/sc/components/image/' + encodeURIComponent(localId) + '?local=1');
            var localThumb = localFull + '&size=thumb';
            photo = '<button type="button" class="st-detail-photo-btn" data-full="' + escapeHtml(localFull) + '" data-wiki="' + escapeHtml(wikiPhoto) + '">' +
                '<img class="st-detail-photo" src="' + escapeHtml(localThumb) + '" alt="" data-wiki="' + escapeHtml(wikiPhoto) + '" onerror="this.onerror=null;if(this.dataset.wiki){this.src=this.dataset.wiki;var b=this.parentElement;if(b)b.setAttribute(\'data-full\',this.dataset.wiki)}else if(this.parentElement)this.parentElement.remove()">' +
                '</button>';
        } else if (wikiPhoto) {
            photo = '<button type="button" class="st-detail-photo-btn" data-full="' + escapeHtml(wikiPhoto) + '">' +
                '<img class="st-detail-photo" src="' + escapeHtml(wikiPhoto) + '" alt="" onerror="this.parentElement.remove()">' +
                '</button>';
        }
        }
        els.detail.innerHTML =
            jump +
            '<p class="st-detail-kicker">QUOTE</p>' +
            '<h3 class="st-detail-name">' + biHtml(item[3], item[0]) + '</h3>' +
            '<div class="st-detail-row"><span>分类</span><strong>' + escapeHtml(isShipItem(item) ? ('船厂 · ' + makerLabel(makerKey(item))) : (cat.sectionZh + ' · ' + cat.nameZh)) + '</strong></div>' +
            '<div class="st-detail-row"><span>' + priceWord() + '</span><strong class="st-detail-price">' + money(item[1], item) + '</strong></div>' +
            (scuCat(item[2])
                ? '<div class="st-detail-row"><span>' + qtyWord() + '</span><strong>' + (item[5] > 0 ? Number(item[5]).toLocaleString('zh-CN') + ' SCU' : '—') + '</strong></div>'
                : '') +
            '<div class="st-detail-row"><span>终端</span><strong>' + biHtml(shop.nameZh, shop.name) + '</strong></div>' +
            '<div class="st-detail-loc"><span class="st-detail-loc-label">位置</span>' + locationLines(shop) + '</div>' +
            photo;
    }
    function renderKiosk() {
        var shop = shopByCode(state.shop);
        if (shop && listings(shop) === null) {
            els.shopName.innerHTML = biHtml(shop.nameZh, shop.name);
            els.shopPath.hidden = true;
            els.shopCount.textContent = '…';
            els.cats.innerHTML = '';
            els.list.innerHTML = '<p class="st-empty">正在读取这个星系的' + (state.side === 'sell' ? '收购' : '在售') + '物品。</p>';
            renderDetail(null, null);
            ensureSystem(shop.system).then(function () {
                if (shopByCode(state.shop) === shop) renderKiosk();
            }).catch(function () {
                els.list.innerHTML = '<p class="st-empty">这个星系的在售物品没有读到。</p>';
            });
            return;
        }
        if (!shop) {
            els.shopName.textContent = '未接入终端';
            els.shopPath.hidden = false;
            els.shopPath.textContent = '在窗口顶部选择星系、星球、卫星、站点，再选择终端';
            els.shopCount.textContent = 'STANDBY';
            els.cats.innerHTML = '<button type="button" class="st-cat is-on" disabled>全部</button>';
            els.list.innerHTML = '<div class="st-idle"><span class="st-idle-ring" aria-hidden="true"><span class="st-idle-arc"></span><span class="st-idle-arc st-idle-arc-rev"></span><span class="st-idle-core"></span></span><p class="st-empty">终端屏幕已就绪。选定终端后，这里列出' + (state.side === 'sell' ? '可出售的物品。' : '全部在售物品。') + '</p></div>';
            renderDetail(null, null);
            return;
        }
        var stock = listings(shop) || [];
        var sections = sectionsFor(shop);
        var known = { '': true };
        sections.forEach(function (section) {
            if (section.cats.length > 1) known['s:' + section.section] = true;
            section.cats.forEach(function (cat) { known['c:' + cat.id] = true; });
        });
        var makers = [];
        if (shop.group === 'ship_buy' && stock.length && stock.every(isShipItem)) {
            makers = shipMakers.length ? shipMakers.slice() : [];
            if (!makers.length) {
                var makerSeen = {};
                stock.forEach(function (item) {
                    var key = makerKey(item);
                    if (!key || makerSeen[key]) return;
                    makerSeen[key] = true;
                    makers.push(key);
                });
                makers.sort(function (a, b) { return makerLabel(a).localeCompare(makerLabel(b), 'zh-CN'); });
            }
            makers = makers.filter(function (key) {
                return stock.some(function (item) { return makerKey(item) === key; });
            });
            makers.forEach(function (key) { known['m:' + key] = true; });
            known['s:__maker__'] = true;
        }
        if (!known[state.cat]) state.cat = '';
        if (makers.length && !state.cat) state.cat = 's:__maker__';
        var rows = visibleItems(shop);
        if (pickedKey && !rows.some(function (item) { return itemKey(item) === pickedKey; })) pickedKey = '';
        var picked = rows.filter(function (item) { return itemKey(item) === pickedKey; })[0] || null;
        els.shopName.innerHTML = biHtml(shop.nameZh, shop.name);
        els.shopPath.hidden = true;
        els.shopPath.textContent = '';
        els.shopCount.textContent = stock.length + ' ITEMS';
        var catHtml = makers.length ? '' : catButton('', '全部', stock.length, '', '', false);
        if (makers.length) {
            var makerOn = state.cat.indexOf('m:') === 0;
            if ((makerOn || state.cat === 's:__maker__') && openSections.__maker__ !== false) openSections.__maker__ = true;
            var makerOpen = !!openSections.__maker__;
            catHtml += catButton('s:__maker__', '船厂', stock.length, 'st-cat-parent' + (makerOpen ? ' is-open' : ''), '__maker__', makerOpen);
            if (makerOpen) {
                catHtml += '<div class="st-cat-kids">';
                makers.forEach(function (key) {
                    var count = stock.filter(function (item) { return makerKey(item) === key; }).length;
                    catHtml += catButton('m:' + key, makerLabel(key), count, 'st-cat-sub st-cat-maker', '', false, makerLogoHtml(key));
                });
                catHtml += '</div>';
            }
        }
        sections.forEach(function (section) {
            if (makers.length && section.cats.every(function (cat) { return cat.id === 102; })) return;
            if (section.cats.length === 1) {
                var only = section.cats[0];
                var onlyCount = stock.filter(function (item) { return item[2] === only.id; }).length;
                catHtml += catButton('c:' + only.id, only.nameZh, onlyCount, '', '', false);
                return;
            }
            var sectionKey = 's:' + section.section;
            var childOn = section.cats.some(function (cat) { return state.cat === 'c:' + cat.id; });
            if ((childOn || state.cat === sectionKey) && openSections[section.section] !== false) openSections[section.section] = true;
            var open = !!openSections[section.section];
            var sectionCount = stock.filter(function (item) {
                var cat = catById[item[2]];
                return cat && cat.section === section.section;
            }).length;
            catHtml += catButton(sectionKey, section.sectionZh, sectionCount, 'st-cat-parent' + (open ? ' is-open' : ''), section.section, open);
            if (!open) return;
            catHtml += '<div class="st-cat-kids">';
            section.cats.forEach(function (cat) {
                var count = stock.filter(function (item) { return item[2] === cat.id; }).length;
                catHtml += catButton('c:' + cat.id, cat.nameZh, count, 'st-cat-sub', '', false);
            });
            catHtml += '</div>';
        });
        els.cats.innerHTML = catHtml;
        if (!rows.length) {
            els.list.innerHTML = '<p class="st-empty">这个分类里没有匹配的物品。</p>';
        } else if (rows.every(function (item) { return item[2] === 102 || item[2] === 9001; })) {
            els.list.innerHTML = '<div class="st-cards">' + rows.map(function (item) {
                var on = itemKey(item) === pickedKey;
                var hit = shop.group === 'ship_buy' ? shipCardHit(item) : null;
                var src = (hit && hit.card) || shipArt[String(item[0] || '').replace(/（租赁）$/, '').trim()] || '';
                var photo = src
                    ? '<img class="st-card-img" src="' + escapeHtml(shipCardUrl(src)) + '" data-local="' + escapeHtml(src) + '" alt="" width="351" height="210" decoding="async" loading="lazy" onerror="if(this.dataset.local){this.src=this.dataset.local;this.removeAttribute(\'data-local\')}">'
                    : '<span class="st-card-img st-card-img-empty">暂无图片</span>';
                return '<button type="button" class="st-card' + (on ? ' is-on' : '') + '" data-key="' + escapeHtml(itemKey(item)) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + photo + '<span class="st-card-copy"><span class="st-card-name">' + biHtml(item[3], item[0]) + '</span><span class="st-card-price">' + money(item[1], item) + '</span></span></button>';
            }).join('') + '</div>';
        } else {
            els.list.innerHTML =
                '<div class="st-list-head"><span>物品</span><span>分类</span><span>' + priceWord() + '</span></div>' +
                rows.map(function (item) {
                    var cat = catById[item[2]] || { nameZh: '—' };
                    var on = itemKey(item) === pickedKey;
                    return '<button type="button" class="st-row' + (on ? ' is-on' : '') + '" data-key="' + escapeHtml(itemKey(item)) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><span class="st-row-name">' + biHtml(item[3], item[0]) + '</span><span class="st-row-cat">' + escapeHtml(cat.nameZh) + '</span><span class="st-row-price">' + money(item[1], item) + '</span></button>';
                }).join('');
        }
        renderDetail(shop, picked);
        if (pendingScroll) {
            pendingScroll = false;
            var current = els.list.querySelector('.is-on');
            if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
        }
    }
    function render() {
        if (els.title) els.title.textContent = state.group ? groupLabel(state.group) : '终端';
        syncSideButtons();
        renderLocate();
        renderKiosk();
        writeQuery();
    }
    els.systems.addEventListener('change', function () {
        state.system = els.systems.value;
        state.planet = '';
        state.moon = '';
        state.place = '';
        state.shop = '';
        state.cat = '';
        pickedKey = '';
        render();
    });
    els.planets.addEventListener('change', function () {
        state.planet = els.planets.value;
        state.moon = '';
        state.place = '';
        state.shop = '';
        state.cat = '';
        pickedKey = '';
        render();
    });
    els.moons.addEventListener('change', function () {
        state.moon = els.moons.value;
        state.place = '';
        state.shop = '';
        state.cat = '';
        pickedKey = '';
        render();
    });
    els.places.addEventListener('change', function () {
        state.place = els.places.value;
        state.shop = '';
        state.cat = '';
        pickedKey = '';
        render();
    });
    document.querySelectorAll('[data-side]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var next = btn.getAttribute('data-side') === 'sell' ? 'sell' : 'buy';
            if (next === state.side) return;
            state.side = next;
            state.cat = '';
            pickedKey = '';
            hideHits();
            render();
        });
    });
    els.terminals.addEventListener('change', function () {
        state.shop = els.terminals.value;
        state.cat = '';
        pickedKey = '';
        render();
    });
    function hideHits() {
        hits = [];
        hitIndex = -1;
        hitSystem = '';
        els.results.hidden = true;
        els.results.innerHTML = '';
        els.superInput.setAttribute('aria-expanded', 'false');
    }
    function locBit(icon, html) {
        return '<span class="st-hit-bit">' + icon + '<b>' + html + '</b></span>';
    }
    function locLine(row) {
        var regionIcon = row.planetKey === '__stations__' ? ICO.station : ICO.planet;
        return [
            locBit(ICO.system, biHtml(row.systemZh, row.system)),
            locBit(regionIcon, escapeHtml(row.planet)),
            row.moon && row.moon !== '__surface__' ? locBit(ICO.planet, row.moon === '__lagrange__' ? '拉格朗日点' : biHtml(row.moonZh, row.moon)) : '',
            locBit(ICO.station, biHtml(row.placeZh, row.place)),
            locBit(ICO.shop, biHtml(row.shopZh, row.shop)),
        ].filter(Boolean).join('<span class="st-hit-sep">·</span>');
    }
    function queryReady(needle) {
        if (!needle) return false;
        if (/[\u4e00-\u9fff]/.test(needle)) return true;
        return needle.length >= 2;
    }
    function renderHits() {
        var needle = els.superInput.value.trim().toLowerCase();
        if (!queryReady(needle)) {
            hideHits();
            return;
        }
        var pendingSystems = systemsNeeded();
        if (pendingSystems.length && !searchLoad) {
            var nextSystem = state.system && pendingSystems.indexOf(state.system) >= 0 ? state.system : pendingSystems[0];
            searchLoad = ensureSystem(nextSystem).then(function () {
                searchLoad = null;
                if (els.superInput && els.superInput.value.trim().toLowerCase() === needle) renderHits();
            }).catch(function () {
                searchLoad = null;
                if (els.superInput && els.superInput.value.trim().toLowerCase() === needle) renderHits();
            });
        }
        if (!catalog.length) {
            els.results.innerHTML = '<p class="st-hit-empty">' + (pendingSystems.length ? ('正在读取已打开星系的' + (state.side === 'sell' ? '收购' : '在售') + '物品。') : '搜索索引还在准备，稍等一下。') + '</p>';
            els.results.hidden = false;
            els.superInput.setAttribute('aria-expanded', 'true');
            return;
        }
        var found = [];
            catalog.forEach(function (row) {
            if ((row.side || 'buy') !== state.side) return;
            var atName = (row.nameZh || '').toLowerCase().indexOf(needle);
            var atEn = (row.name || '').toLowerCase().indexOf(needle);
            var at = atName >= 0 ? atName : atEn;
            if (at < 0) at = row.blob.indexOf(needle);
            if (at < 0) return;
            var rank = (atName === 0 || atEn === 0) ? 0 : (atName >= 0 || atEn >= 0 ? 1 : 2);
            found.push({ row: row, rank: rank });
        });
        found.sort(function (a, b) {
            if (a.rank !== b.rank) return a.rank - b.rank;
            var byName = a.row.name.localeCompare(b.row.name, 'en');
            if (byName) return byName;
            return a.row.shop.localeCompare(b.row.shop, 'en');
        });
        var systems = sortSystems(found.map(function (entry) { return entry.row.system; }));
        if (hitSystem && systems.indexOf(hitSystem) < 0) hitSystem = '';
        var pool = hitSystem ? found.filter(function (entry) { return entry.row.system === hitSystem; }) : found;
        var extra = 0;
        hits = pool.slice(0, 40).map(function (entry) { return entry.row; });
        extra = pool.length - hits.length;
        hitIndex = hits.length ? 0 : -1;
        var filters = '<div class="st-hit-systems" role="group" aria-label="按星系筛选">' +
            '<button type="button" class="st-hit-sys' + (hitSystem ? '' : ' is-on') + '" data-hit-system="">全部<span class="st-hit-sys-n">' + found.length + '</span></button>' +
            systems.map(function (name) {
                var sample = found.filter(function (entry) { return entry.row.system === name; })[0];
                var count = found.filter(function (entry) { return entry.row.system === name; }).length;
                return '<button type="button" class="st-hit-sys' + (hitSystem === name ? ' is-on' : '') + '" data-hit-system="' + escapeHtml(name) + '">' + biHtml(sample.row.systemZh, name) + '<span class="st-hit-sys-n">' + count + '</span></button>';
            }).join('') +
            '</div>';
        if (!found.length) {
            els.results.innerHTML = '<p class="st-hit-empty">没有找到' + (state.side === 'sell' ? '可出售' : '在售') + '的物品。</p>';
        } else if (!hits.length) {
            els.results.innerHTML = filters + '<p class="st-hit-empty">这个星系里没有找到' + (state.side === 'sell' ? '可出售' : '在售') + '的物品。</p>';
        } else {
            els.results.innerHTML = filters + hits.map(function (row, index) {
                return '<button type="button" class="st-hit' + (index === hitIndex ? ' is-active' : '') + '" role="option" data-hit="' + index + '"><span class="st-hit-top"><span class="st-hit-name">' + biHtml(row.nameZh, row.name) + '</span><span class="st-hit-price">' + money(row.price, row.unit === 'scu' ? [0, 0, 9101] : null) + '</span></span><span class="st-hit-loc">' + locLine(row) + '</span></button>';
            }).join('') + (extra ? '<p class="st-hit-empty">还有 ' + extra + ' 条，继续输入可以缩小范围。</p>' : '') + (pendingSystems.length || indexQueue.length ? '<p class="st-hit-empty">其余星系还在读取，结果会继续补上。</p>' : '');
        }
        els.results.hidden = false;
        els.superInput.setAttribute('aria-expanded', 'true');
    }
    function openHit(row) {
        if (!row) return;
        state.group = '';
        state.system = row.system;
        state.planet = row.planetKey;
        state.moon = row.moonKey || '';
        state.place = row.place;
        state.shop = row.code;
        state.cat = '';
        pickedKey = row.key;
        pendingScroll = true;
        hideHits();
        render();
    }
    var superTimer = 0;
    els.superInput.addEventListener('input', function () {
        clearTimeout(superTimer);
        superTimer = setTimeout(renderHits, 80);
    });
    els.superInput.addEventListener('keydown', function (event) {
        if (els.results.hidden || !hits.length) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            hitIndex = (hitIndex + 1) % hits.length;
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            hitIndex = (hitIndex - 1 + hits.length) % hits.length;
        } else if (event.key === 'Enter') {
            event.preventDefault();
            openHit(hits[hitIndex] || hits[0]);
            return;
        } else if (event.key === 'Escape') {
            hideHits();
            return;
        } else {
            return;
        }
        var buttons = els.results.querySelectorAll('.st-hit');
        buttons.forEach(function (button, index) { button.classList.toggle('is-active', index === hitIndex); });
    });
    els.results.addEventListener('mousedown', function (event) {
        var systemButton = event.target.closest('[data-hit-system]');
        if (systemButton) {
            event.preventDefault();
            hitSystem = systemButton.getAttribute('data-hit-system') || '';
            renderHits();
            return;
        }
        var button = event.target.closest('[data-hit]');
        if (!button) return;
        event.preventDefault();
        openHit(hits[Number(button.getAttribute('data-hit'))]);
    });
    document.addEventListener('click', function (event) {
        if (!event.target.closest('.st-super')) hideHits();
    });
    els.cats.addEventListener('click', function (event) {
        var toggle = event.target.closest('[data-toggle]');
        if (toggle) {
            var sectionId = toggle.getAttribute('data-toggle');
            openSections[sectionId] = !openSections[sectionId];
            renderKiosk();
            return;
        }
        var button = event.target.closest('[data-cat]');
        if (!button || button.disabled) return;
        state.cat = button.getAttribute('data-cat') || '';
        pickedKey = '';
        renderKiosk();
        writeQuery();
    });
    function bindScrollLock(root) {
        if (!root) return;
        root.addEventListener('wheel', function (event) {
            if (!event.deltaY) return;
            var node = event.target;
            var scroller = null;
            while (node && node !== root) {
                if (node.scrollHeight > node.clientHeight + 1) {
                    var overflowY = window.getComputedStyle(node).overflowY;
                    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
                        scroller = node;
                        break;
                    }
                }
                node = node.parentElement;
            }
            if (!scroller) {
                event.preventDefault();
                return;
            }
            var atTop = scroller.scrollTop <= 0;
            var atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
            if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) event.preventDefault();
        }, { passive: false });
    }
    bindScrollLock(document.querySelector('.st-kiosk'));
    bindScrollLock(document.querySelector('.st-super'));
    if (els.detail) {
        els.detail.addEventListener('click', function (event) {
            var btn = event.target.closest('.st-detail-photo-btn');
            if (!btn) return;
            var src = btn.getAttribute('data-full') || '';
            if (!src) return;
            var lb = window.UssCommunityImageLightbox;
            if (lb && typeof lb.open === 'function') lb.open(src, { by: '' });
            else window.open(src, '_blank', 'noopener,noreferrer');
        });
    }
    els.list.addEventListener('click', function (event) {
        var row = event.target.closest('[data-key]');
        if (!row) return;
        var key = row.getAttribute('data-key');
        pickedKey = pickedKey === key ? '' : key;
        renderKiosk();
    });
    function renderSource() {
        var el = document.getElementById('stSource');
        if (!el || !data) return;
        var meta = data.meta || {};
        var parts = [meta.data_source_label_zh || 'UEX'];
        if (meta.game_version) parts.push('游戏版本 ' + meta.game_version);
        if (meta.api_version) parts.push('API v' + meta.api_version);
        el.textContent = parts.join(' · ');
    }
    function apiUrl(path) {
        var base = (window.USS_AUTH_API_BASE || '').replace(/\/$/, '');
        return (base || '') + path;
    }
    function shipCardUrl(src) {
        if (!src) return '';
        return apiUrl('/api/sc/' + String(src).replace(/^\//, ''));
    }
    function fetchJson(primary, fallback) {
        return fetch(primary).then(function (res) {
            if (!res.ok) throw new Error('status');
            return res.json();
        }).catch(function (err) {
            if (!fallback) throw err;
            return fetch(fallback).then(function (res) {
                if (!res.ok) throw err;
                return res.json();
            });
        });
    }
    var indexedShop = {};
    var indexQueue = [];
    var indexTimer = 0;
    var systemLoads = {};
    var searchLoad = null;
    function pushCatalogItem(shop, item, side) {
        catalog.push({
            name: item[0],
            nameZh: item[3] || '',
            price: item[1],
            side: side,
            unit: scuCat(item[2]) ? 'scu' : '',
            key: item[0] + '@' + item[1] + '@' + item[2],
            code: shopToken(shop),
            shop: shop.name,
            shopZh: shop.nameZh || '',
            system: shop.system,
            systemZh: shop.systemZh || '',
            planet: planetLabel(planetKey(shop)),
            planetKey: planetKey(shop),
            moon: shop.moon || '',
            moonZh: shop.moonZh || '',
            moonKey: shop.moon || '',
            place: shop.place,
            placeZh: shop.placeZh || '',
            blob: [item[0], item[3], shop.name, shop.nameZh, shop.system, shop.systemZh, shop.planet, shop.planetZh, shop.moon, shop.moonZh, shop.place, shop.placeZh].filter(Boolean).join(' ').toLowerCase(),
        });
    }
    function drainIndex() {
        var budget = 0;
        while (indexQueue.length && budget < 3000) {
            var shop = indexQueue[0];
            var rows = (shop.items || []).map(function (item) { return { item: item, side: 'buy' }; })
                .concat((shop.sells || []).map(function (item) { return { item: item, side: 'sell' }; }));
            var at = shop._indexAt || 0;
            while (at < rows.length && budget < 3000) {
                pushCatalogItem(shop, rows[at].item, rows[at].side);
                at += 1;
                budget++;
            }
            shop._indexAt = at;
            if (at >= rows.length) indexQueue.shift();
        }
        if (indexQueue.length) {
            indexTimer = setTimeout(drainIndex, 0);
            if (els.superInput && els.superInput.value.trim().length >= 2) renderHits();
            return;
        }
        indexTimer = 0;
        if (els.superInput && els.superInput.value.trim().length >= 2) renderHits();
    }
    function queueIndex(shop) {
        if (!shop || indexedShop[shop.id] || !Array.isArray(shop.items)) return;
        indexedShop[shop.id] = true;
        indexQueue.push(shop);
        if (!indexTimer) indexTimer = setTimeout(drainIndex, 0);
    }
    function systemsNeeded() {
        var names = [];
        (data && data.shops || []).forEach(function (shop) {
            if (!shop.system || Array.isArray(shop.items) || names.indexOf(shop.system) >= 0) return;
            names.push(shop.system);
        });
        return names;
    }
    function catalogSearchReady() {
        return !systemsNeeded().length && !indexQueue.length && !indexTimer;
    }
    function ensureSystem(name) {
        if (!name) return Promise.resolve();
        if (!systemsNeeded().length || systemsNeeded().indexOf(name) < 0) return Promise.resolve();
        if (systemLoads[name]) return systemLoads[name];
        function mergeSystemRows(rows) {
            var byId = {};
            rows.forEach(function (row) {
                if (!row) return;
                byId[row.id] = row;
                byId[String(row.id)] = row;
            });
            (data.shops || []).forEach(function (shop) {
                if (shop.system !== name) return;
                if (Array.isArray(shop.items) && shop.items.length) return;
                var row = byId[shop.id] || byId[String(shop.id)] || {};
                shop.items = Array.isArray(row.items) ? row.items : [];
                shop.sells = Array.isArray(row.sells) ? row.sells : [];
                queueIndex(shop);
            });
        }
        var systemPath = apiUrl('/api/sc/sales-terminals/system/' + encodeURIComponent(name));
        systemLoads[name] = fetchJson(systemPath, 'sales-terminals-data.json?v=31').then(function (json) {
            var rows = [];
            if (json && json.system === name && Array.isArray(json.shops)) {
                rows = json.shops;
            } else if (json && Array.isArray(json.shops)) {
                rows = json.shops.filter(function (shop) { return shop.system === name; });
            }
            mergeSystemRows(rows);
            var pending = (data.shops || []).filter(function (shop) {
                if (shop.system !== name) return false;
                var n = state.side === 'sell' ? shop.sellCount : shop.itemCount;
                var arr = state.side === 'sell' ? shop.sells : shop.items;
                return Number(n) > 0 && (!Array.isArray(arr) || !arr.length);
            });
            if (pending.length) {
                return fetch('sales-terminals-data.json?v=31').then(function (res) {
                    if (!res.ok) return;
                    return res.json();
                }).then(function (full) {
                    if (!full || !Array.isArray(full.shops)) return;
                    mergeSystemRows(full.shops.filter(function (shop) { return shop.system === name; }));
                }).catch(function () {});
            }
        }).catch(function (err) {
            delete systemLoads[name];
            throw err;
        });
        return systemLoads[name];
    }
    fetchJson(apiUrl('/api/sc/ship-card-map'), 'ship-cards.json?v=2')
        .then(function (json) {
            shipArt = json || {};
            indexShipCards(shipArt);
            if (data) renderKiosk();
        })
        .catch(function () {});
    var catalogReady = false;
    Promise.all([
        fetchJson(apiUrl('/api/sc/sales-terminals'), 'sales-terminals-data.json?v=31'),
        fetchJson('sales-place-parents.json?v=3').catch(function () { return { zh: {}, places: {} }; }),
    ])
        .then(function (pair) {
            data = pair[0];
            parents = pair[1] && pair[1].places ? pair[1] : { zh: {}, places: {} };
            applyParents();
            renderSource();
            codeUses = {};
            (data.shops || []).forEach(function (shop) { codeUses[shop.code] = (codeUses[shop.code] || 0) + 1; });
            (data.categories || []).forEach(function (cat) { catById[cat.id] = cat; });
            els.status.hidden = true;
            readQuery();
            (data.shops || []).forEach(function (shop) {
                if (Array.isArray(shop.items)) queueIndex(shop);
            });
            render();
            if (state.system) ensureSystem(state.system).then(render);
        })
        .catch(function () {
            els.status.textContent = '终端数据加载失败。';
        });
})();
