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
    var state = { group: '', system: '', planet: '', place: '', shop: '', cat: '' };
    var openSections = {};
    var els = {
        systems: document.getElementById('stSystem'),
        planets: document.getElementById('stPlanet'),
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
    function money(n) {
        return Number(n).toLocaleString('zh-CN') + ' aUEC';
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
    function fieldZh(field, en) {
        var i;
        for (i = 0; i < data.shops.length; i++) {
            if (data.shops[i][field] === en) return data.shops[i][field + 'Zh'] || '';
        }
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
        return [
            locStack(shop.systemZh, shop.system, ICO.system),
            deep ? locStack('深空站点', '', ICO.station) : locStack(shop.planetZh, shop.planet, ICO.planet),
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
            if (!inGroup(shop)) return false;
            if (level === 'group') return true;
            if (shop.system !== state.system) return false;
            if (level === 'system') return true;
            if (planetKey(shop) !== state.planet) return false;
            if (level === 'planet') return true;
            if (shop.place !== state.place) return false;
            return true;
        });
    }
    var SYSTEM_ORDER = { Stanton: 0, Pyro: 1, Nyx: 2 };
    function uniqueSorted(list) {
        return list.filter(function (name, index) { return name && list.indexOf(name) === index; })
            .sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
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
        var html = '<option value="" hidden>' + escapeHtml(placeholder) + '</option>';
        entries.forEach(function (entry) {
            html += '<option value="' + escapeHtml(entry.value) + '"' + (entry.value === current ? ' selected' : '') + '>' + escapeHtml(entry.label) + '</option>';
        });
        el.innerHTML = html;
        el.disabled = !enabled;
        el.value = current && entries.some(function (entry) { return entry.value === current; }) ? current : '';
    }
    function readQuery() {
        var q = new URLSearchParams(window.location.search);
        state.group = q.get('group') || '';
        state.system = q.get('system') || '';
        state.planet = q.get('planet') || '';
        state.place = q.get('place') || '';
        state.shop = q.get('shop') || '';
        state.cat = q.get('cat') || '';
        var linked = shopByCode(state.shop);
        if (linked) {
            state.system = linked.system;
            state.planet = planetKey(linked);
            state.place = linked.place;
            if (state.group && linked.group !== state.group) state.group = '';
        }
    }
    function writeQuery() {
        var q = new URLSearchParams();
        if (state.group) q.set('group', state.group);
        if (state.system) q.set('system', state.system);
        if (state.planet) q.set('planet', state.planet);
        if (state.place) q.set('place', state.place);
        if (state.shop) q.set('shop', state.shop);
        if (state.cat) q.set('cat', state.cat);
        var next = q.toString();
        history.replaceState(null, '', next ? '?' + next : location.pathname);
    }
    function renderLocate() {
        var systems = sortSystems(data.shops.filter(inGroup).map(function (shop) { return shop.system; }));
        fillSelect(els.systems, '选择星系', systems.map(function (name) { return { value: name, label: bi(fieldZh('system', name), name) }; }), state.system, true);
        if (!state.system || systems.indexOf(state.system) < 0) {
            state.system = '';
            state.planet = '';
            state.place = '';
            state.shop = '';
        }
        var planetKeys = uniqueSorted(scoped('system').map(planetKey));
        fillRegion(planetKeys, state.planet, !!state.system);
        if (!state.planet || planetKeys.indexOf(state.planet) < 0) {
            state.planet = '';
            state.place = '';
            state.shop = '';
        }
        var places = uniqueSorted(scoped('planet').map(function (shop) { return shop.place; }));
        fillSelect(els.places, '选择站点', places.map(function (name) { return { value: name, label: bi(fieldZh('place', name), name) }; }), state.place, !!state.planet);
        if (!state.place || places.indexOf(state.place) < 0) {
            state.place = '';
            state.shop = '';
        }
        var shopsHere = state.place ? scoped('place').slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); }) : [];
        var terminalPlaceholder = state.place && !shopsHere.length ? '此站点没有这类终端' : '选择终端';
        var names = {};
        shopsHere.forEach(function (shop) { names[shop.name] = (names[shop.name] || 0) + 1; });
        fillSelect(
            els.terminals,
            terminalPlaceholder,
            shopsHere.map(function (shop) {
                var label = bi(shop.nameZh, shop.name);
                if (names[shop.name] > 1) {
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
    function fillRegion(keys, current, enabled) {
        var groups = [
            ['星球', keys.filter(function (key) { return key !== '__stations__' && key !== 'Delamar'; })],
            ['小行星', keys.filter(function (key) { return key === 'Delamar'; })],
            ['深空', keys.filter(function (key) { return key === '__stations__'; })],
        ];
        var html = '<option value="" hidden>选择区域</option>';
        groups.forEach(function (pair) {
            if (!pair[1].length) return;
            html += '<optgroup label="' + escapeHtml(pair[0]) + '">';
            pair[1].forEach(function (key) {
                html += '<option value="' + escapeHtml(key) + '"' + (key === current ? ' selected' : '') + '>' + escapeHtml(planetLabel(key)) + '</option>';
            });
            html += '</optgroup>';
        });
        els.planets.innerHTML = html;
        els.planets.disabled = !enabled;
        els.planets.value = keys.indexOf(current) >= 0 ? current : '';
    }
    function sectionsFor(shop) {
        var ids = {};
        shop.items.forEach(function (item) { ids[item[2]] = true; });
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
    function catMatches(item) {
        var cat = catById[item[2]];
        if (state.cat.indexOf('c:') === 0) return String(item[2]) === state.cat.slice(2);
        if (state.cat.indexOf('s:') === 0) return !!(cat && cat.section === state.cat.slice(2));
        return true;
    }
    function visibleItems(shop) {
        return shop.items.filter(catMatches);
    }
    function itemKey(item) {
        return item[0] + '@' + item[1] + '@' + item[2];
    }
    function detailHref(item) {
        var id = item && item[4] ? String(item[4]).trim() : '';
        if (!id) return '';
        return 'ship-component-detail?id=' + encodeURIComponent(id);
    }
    function catButton(key, name, count, extra, toggleId, open) {
        var on = key ? state.cat === key : !state.cat;
        var mark = toggleId
            ? '<span class="st-cat-mark" data-toggle="' + escapeHtml(toggleId) + '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-label="' + (open ? '收起子分类' : '展开子分类') + '"></span>'
            : '<span class="st-cat-mark"></span>';
        return '<button type="button" class="st-cat' + (extra ? ' ' + extra : '') + (on ? ' is-on' : '') + '" data-cat="' + escapeHtml(key) + '">' +
            mark +
            '<span class="st-cat-name">' + escapeHtml(name) + '</span>' +
            '<span class="st-cat-count">' + count + '</span></button>';
    }
    function renderDetail(shop, item) {
        if (!shop) {
            els.detail.innerHTML = '<p class="st-detail-kicker">QUOTE</p><p class="st-detail-empty">接入终端后，点选物品查看买入价。</p>';
            return;
        }
        if (!item) {
            els.detail.innerHTML = '<p class="st-detail-kicker">QUOTE</p><p class="st-detail-empty">点选一件物品，查看分类和买入价。</p>';
            return;
        }
        var cat = catById[item[2]] || { sectionZh: '未分类', nameZh: '—' };
        var href = detailHref(item);
        var jump = href
            ? '<a class="st-detail-jump" href="' + escapeHtml(href) + '" aria-label="打开详细页" title="打开详细页"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>'
            : '';
        els.detail.innerHTML =
            jump +
            '<p class="st-detail-kicker">QUOTE</p>' +
            '<h3 class="st-detail-name">' + biHtml(item[3], item[0]) + '</h3>' +
            '<div class="st-detail-row"><span>分类</span><strong>' + escapeHtml(cat.sectionZh + ' · ' + cat.nameZh) + '</strong></div>' +
            '<div class="st-detail-row"><span>买入价</span><strong class="st-detail-price">' + money(item[1]) + '</strong></div>' +
            '<div class="st-detail-row"><span>终端</span><strong>' + biHtml(shop.nameZh, shop.name) + '</strong></div>' +
            '<div class="st-detail-loc"><span class="st-detail-loc-label">位置</span>' + locationLines(shop) + '</div>';
    }
    function renderKiosk() {
        var shop = shopByCode(state.shop);
        if (!shop) {
            els.shopName.textContent = '未接入终端';
            els.shopPath.hidden = false;
            els.shopPath.textContent = '在窗口顶部选择星系、区域、站点，再选择终端';
            els.shopCount.textContent = 'STANDBY';
            els.cats.innerHTML = '<button type="button" class="st-cat is-on" disabled>全部</button>';
            els.list.innerHTML = '<div class="st-idle"><span class="st-idle-ring" aria-hidden="true"><span class="st-idle-arc"></span><span class="st-idle-arc st-idle-arc-rev"></span><span class="st-idle-core"></span></span><p class="st-empty">终端屏幕已就绪。选定终端后，这里列出全部在售物品。</p></div>';
            renderDetail(null, null);
            return;
        }
        var sections = sectionsFor(shop);
        var known = { '': true };
        sections.forEach(function (section) {
            if (section.cats.length > 1) known['s:' + section.section] = true;
            section.cats.forEach(function (cat) { known['c:' + cat.id] = true; });
        });
        if (!known[state.cat]) state.cat = '';
        var rows = visibleItems(shop);
        if (pickedKey && !rows.some(function (item) { return itemKey(item) === pickedKey; })) pickedKey = '';
        var picked = rows.filter(function (item) { return itemKey(item) === pickedKey; })[0] || null;
        els.shopName.innerHTML = biHtml(shop.nameZh, shop.name);
        els.shopPath.hidden = true;
        els.shopPath.textContent = '';
        els.shopCount.textContent = shop.items.length + ' ITEMS';
        var catHtml = catButton('', '全部', shop.items.length, '', '', false);
        sections.forEach(function (section) {
            if (section.cats.length === 1) {
                var only = section.cats[0];
                var onlyCount = shop.items.filter(function (item) { return item[2] === only.id; }).length;
                catHtml += catButton('c:' + only.id, only.nameZh, onlyCount, '', '', false);
                return;
            }
            var sectionKey = 's:' + section.section;
            var childOn = section.cats.some(function (cat) { return state.cat === 'c:' + cat.id; });
            if ((childOn || state.cat === sectionKey) && openSections[section.section] !== false) openSections[section.section] = true;
            var open = !!openSections[section.section];
            var sectionCount = shop.items.filter(function (item) {
                var cat = catById[item[2]];
                return cat && cat.section === section.section;
            }).length;
            catHtml += catButton(sectionKey, section.sectionZh, sectionCount, '', section.section, open);
            if (!open) return;
            section.cats.forEach(function (cat) {
                var count = shop.items.filter(function (item) { return item[2] === cat.id; }).length;
                catHtml += catButton('c:' + cat.id, cat.nameZh, count, 'st-cat-sub', '', false);
            });
        });
        els.cats.innerHTML = catHtml;
        if (!rows.length) {
            els.list.innerHTML = '<p class="st-empty">这个分类里没有匹配的物品。</p>';
        } else if (rows.every(function (item) { return item[2] === 102 || item[2] === 9001; })) {
            els.list.innerHTML = '<div class="st-cards">' + rows.map(function (item) {
                var on = itemKey(item) === pickedKey;
                var src = shipArt[String(item[0] || '').replace(/（租赁）$/, '').trim()] || '';
                var photo = src
                    ? '<img class="st-card-img" src="' + escapeHtml(shipCardUrl(src)) + '" data-local="' + escapeHtml(src) + '" alt="" width="351" height="210" decoding="async" loading="lazy" onerror="if(this.dataset.local){this.src=this.dataset.local;this.removeAttribute(\'data-local\')}">'
                    : '<span class="st-card-img st-card-img-empty">暂无图片</span>';
                return '<button type="button" class="st-card' + (on ? ' is-on' : '') + '" data-key="' + escapeHtml(itemKey(item)) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + photo + '<span class="st-card-copy"><span class="st-card-name">' + biHtml(item[3], item[0]) + '</span><span class="st-card-price">' + money(item[1]) + '</span></span></button>';
            }).join('') + '</div>';
        } else {
            els.list.innerHTML =
                '<div class="st-list-head"><span>物品</span><span>分类</span><span>买入价</span></div>' +
                rows.map(function (item) {
                    var cat = catById[item[2]] || { nameZh: '—' };
                    var on = itemKey(item) === pickedKey;
                    return '<button type="button" class="st-row' + (on ? ' is-on' : '') + '" data-key="' + escapeHtml(itemKey(item)) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><span class="st-row-name">' + biHtml(item[3], item[0]) + '</span><span class="st-row-cat">' + escapeHtml(cat.nameZh) + '</span><span class="st-row-price">' + money(item[1]) + '</span></button>';
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
        renderLocate();
        renderKiosk();
        writeQuery();
    }
    els.systems.addEventListener('change', function () {
        state.system = els.systems.value;
        state.planet = '';
        state.place = '';
        state.shop = '';
        state.cat = '';
        pickedKey = '';
        render();
    });
    els.planets.addEventListener('change', function () {
        state.planet = els.planets.value;
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
            locBit(ICO.station, biHtml(row.placeZh, row.place)),
            locBit(ICO.shop, biHtml(row.shopZh, row.shop)),
        ].join('<span class="st-hit-sep">·</span>');
    }
    function renderHits() {
        var needle = els.superInput.value.trim().toLowerCase();
        if (needle.length < 2) {
            hideHits();
            return;
        }
        var found = [];
        catalog.forEach(function (row) {
            var at = row.blob.indexOf(needle);
            if (at < 0) return;
            found.push({ row: row, rank: at === 0 ? 0 : 1 });
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
        var extra = pool.length > 24 ? pool.length - 24 : 0;
        hits = pool.slice(0, 24).map(function (entry) { return entry.row; });
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
            els.results.innerHTML = '<p class="st-hit-empty">没有找到在售的物品。</p>';
        } else if (!hits.length) {
            els.results.innerHTML = filters + '<p class="st-hit-empty">这个星系里没有找到在售的物品。</p>';
        } else {
            els.results.innerHTML = filters + hits.map(function (row, index) {
                return '<button type="button" class="st-hit' + (index === hitIndex ? ' is-active' : '') + '" role="option" data-hit="' + index + '"><span class="st-hit-top"><span class="st-hit-name">' + biHtml(row.nameZh, row.name) + '</span><span class="st-hit-price">' + money(row.price) + '</span></span><span class="st-hit-loc">' + locLine(row) + '</span></button>';
            }).join('') + (extra ? '<p class="st-hit-empty">还有 ' + extra + ' 条，继续输入可以缩小范围。</p>' : '');
        }
        els.results.hidden = false;
        els.superInput.setAttribute('aria-expanded', 'true');
    }
    function openHit(row) {
        if (!row) return;
        state.group = '';
        state.system = row.system;
        state.planet = row.planetKey;
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
        }).catch(function () {
            return fetch(fallback).then(function (res) { return res.json(); });
        });
    }
    fetchJson(apiUrl('/api/sc/ship-card-map'), 'ship-cards.json?v=2')
        .then(function (json) {
            shipArt = json || {};
            if (data) renderKiosk();
        })
        .catch(function () {});
    fetchJson(apiUrl('/api/sc/sales-terminals'), 'sales-terminals-data.json?v=27')
        .then(function (json) {
            data = json;
            renderSource();
            codeUses = {};
            (data.shops || []).forEach(function (shop) { codeUses[shop.code] = (codeUses[shop.code] || 0) + 1; });
            (data.categories || []).forEach(function (cat) { catById[cat.id] = cat; });
            data.shops.forEach(function (shop) {
                shop.items.forEach(function (item) {
                    catalog.push({
                        name: item[0],
                        nameZh: item[3] || '',
                        price: item[1],
                        key: item[0] + '@' + item[1] + '@' + item[2],
                        code: shopToken(shop),
                        shop: shop.name,
                        shopZh: shop.nameZh || '',
                        system: shop.system,
                        systemZh: shop.systemZh || '',
                        planet: planetLabel(planetKey(shop)),
                        planetKey: planetKey(shop),
                        place: shop.place,
                        placeZh: shop.placeZh || '',
                        blob: [item[0], item[3], shop.name, shop.nameZh, shop.system, shop.systemZh, shop.planet, shop.planetZh, shop.place, shop.placeZh].filter(Boolean).join(' ').toLowerCase(),
                    });
                });
            });
            els.status.hidden = true;
            readQuery();
            render();
        })
        .catch(function () {
            els.status.textContent = '终端数据加载失败。';
        });
})();
