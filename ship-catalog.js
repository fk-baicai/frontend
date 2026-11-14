(function () {
    'use strict';

    var grid = document.getElementById('scatGrid');
    var head = document.getElementById('scatHead');
    var search = document.getElementById('scatSearch');
    var maker = document.getElementById('scatMaker');
    var sheet = document.querySelector('.scat-sheet');
    var ships = [];
    var filter = 'all';
    var columns = 3;

    var FOCUS_ZH = {
        starter: '初学者',
        pathfinder: '探路者',
        'light fighter': '轻型战斗机',
        'medium fighter': '中型战斗机',
        'heavy fighter': '重型战斗机',
        interdiction: '拦截',
        interceptor: '拦截机',
        'light freight': '轻型货运',
        'medium freight': '中型货运',
        'heavy freight': '重型货运',
        expedition: '远征',
        touring: '旅行',
        medical: '医疗',
        mining: '采矿',
        salvage: '打捞',
        exploration: '探索',
        bomber: '轰炸机',
        stealth: '隐身',
        dropship: '空降',
        racing: '竞速',
        snub: '舰载机',
        ground: '地面载具',
        passenger: '客运',
        refueling: '加油',
        refuelling: '加油',
        repair: '维修',
        data: '数据',
        support: '支援',
        gunship: '炮艇',
        reporting: '侦察',
        luxury: '豪华',
        transport: '运输',
        'anti-air': '防空',
        'anti-vehicle': '反载具',
        'light tank': '轻型坦克',
        'heavy tank': '重型坦克',
        cargo: '货运',
        combat: '战斗',
        military: '军用',
        generalist: '多用途',
        modular: '模块',
        'multi-role': '多功能',
        boarding: '登舰',
        corvette: '护卫舰',
        frigate: '护卫舰',
        destroyer: '驱逐舰',
        battlecruiser: '战列巡洋舰',
        'gun ship': '炮艇',
        'heavy gunship': '重型炮艇',
        'heavy bomber': '重型轰炸机',
        'stealth bomber': '隐身轰炸机',
        'stealth fighter': '隐身战斗机',
        'snub fighter': '舰载战斗机',
        'snub carrier': '舰载机母舰',
        'light carrier': '轻型航母',
        'heavy mining': '重型采矿',
        'light mining': '轻型采矿',
        'medium mining': '中型采矿',
        'heavy salvage': '重型打捞',
        'light salvage': '轻型打捞',
        'medium salvage': '中型打捞',
        'heavy science': '重型科研',
        'light science': '轻型科研',
        'medium data': '中型数据',
        'heavy construction': '重型建设',
        'heavy dropship': '重型运兵',
        'heavy refueling': '重型加油',
        'light refueling': '轻型加油',
        'medium refuel': '中型加油',
        'heavy repair': '重型维修',
        'medium repair': '中型维修',
        'luxury touring': '豪华旅行',
        refinery: '精炼',
        refining: '精炼',
        recovery: '回收',
        minelayer: '布雷'
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function apiUrl(path) {
        var base = (window.USS_AUTH_API_BASE || window.USS_API_BASE || '').replace(/\/$/, '');
        return (base || '') + path;
    }

    var MAKER_ZH = {
        GREY: '格雷黑市',
        VNCL: '梵杜尔',
        "Grey's Market": '格雷黑市',
        Vanduul: '梵杜尔'
    };
    var MAKER_LOGO = {
        Kruger: 'assets/makers/kruger.png',
        Banu: 'assets/makers/banu.png',
        Aopoa: 'assets/makers/aopoa.png',
        GREY: 'assets/makers/grey.png',
        VNCL: 'assets/makers/vanduul.png',
        "Grey's Market": 'assets/makers/grey.png',
        Vanduul: 'assets/makers/vanduul.png'
    };
    var ART_NEXT = ['store_large.jpeg', 'store_large.png', 'store_small.jpeg', 'store_small.png'];

    function artUrl(ship) {
        if (ship.card) return apiUrl('/api/sc/' + String(ship.card).replace(/^\//, ''));
        return ship.image || '';
    }

    function onArtError() {
        var img = this;
        var src = img.getAttribute('src') || '';
        var match = src.match(/^(.*\/)([A-Za-z0-9_]+)\.(jpe?g|png)(?:\?.*)?$/i);
        if (!match) {
            img.removeEventListener('error', onArtError);
            img.remove();
            return;
        }
        var tried = (img.getAttribute('data-tried') || '').split(',').filter(Boolean);
        var current = match[2].toLowerCase() + '.' + match[3].toLowerCase();
        if (tried.indexOf(current) < 0) tried.push(current);
        var next = '';
        for (var i = 0; i < ART_NEXT.length; i += 1) {
            if (tried.indexOf(ART_NEXT[i]) < 0) {
                next = ART_NEXT[i];
                break;
            }
        }
        if (!next) {
            img.removeEventListener('error', onArtError);
            img.remove();
            return;
        }
        tried.push(next);
        img.setAttribute('data-tried', tried.join(','));
        img.src = match[1] + next;
    }

    function bindArt() {
        var imgs = grid.querySelectorAll('.scat-art img');
        for (var i = 0; i < imgs.length; i += 1) imgs[i].addEventListener('error', onArtError);
    }

    function isGround(ship) {
        if (ship.ground) return true;
        var who = String(ship.makerEn || '');
        if (who === 'Greycat' || who === 'Tumbril') return true;
        return /\b(ptv|stv|mtc|mdc|utv|roc-ds|roc|pulse|hoverquad|dragonfly|nox|x1|ranger|mule|spartan|ballista|nova|ursa|cyclone|storm|centurion|g12a|g12r|g12)\b/i.test(ship.name || '');
    }

    function sheetTags(ship) {
        var tags = [];
        if (ship.resident) tags.push('常驻');
        if (ship.flyable) tags.push(isGround(ship) ? '可驾驶' : '可飞');
        else tags.push('概念');
        return tags;
    }

    function tagsHtml(tags) {
        var kind = { '常驻': 'is-resident', '可飞': 'is-fly', '可驾驶': 'is-fly', '概念': 'is-concept' };
        return tags.map(function (tag) {
            return '<span class="' + (kind[tag] || '') + '">' + escapeHtml(tag) + '</span>';
        }).join('');
    }

    function roleText(ship) {
        var raw = String(ship.focus || '');
        var text = raw.split(/\s*\/\s*/).map(function (part) {
            var key = part.trim().toLowerCase();
            return FOCUS_ZH[key] || part.trim();
        }).filter(Boolean).join('/');
        if (!text) text = String(ship.focusZh || '').replace(/\s*\/\s*/g, '/');
        if (isGround(ship) && text && text.indexOf('载具') !== 0) text = '载具/' + text;
        return text;
    }

    function makerText(ship) {
        return MAKER_ZH[ship.makerZh] || MAKER_ZH[ship.makerCode] || MAKER_ZH[ship.makerEn] || ship.makerZh || '';
    }

    function makerLogo(ship) {
        var logo = ship.makerLogo || MAKER_LOGO[ship.makerEn] || MAKER_LOGO[ship.makerCode] || '';
        if (/kruger\.png(?:\?|$)/.test(logo)) return logo.split('?')[0] + '?v=3';
        return logo;
    }

    function displayNameZh(ship) {
        var zh = String(ship.nameZh || '').trim();
        if (!zh) return '';
        var maker = makerText(ship);
        var code = String(ship.makerCode || '');
        var en = String(ship.makerEn || '');
        var first = zh.split(/\s+/)[0];
        var hit = first && (
            first === code ||
            first.toLowerCase() === en.toLowerCase() ||
            (maker && (zh.indexOf(maker + ' ') === 0 || (maker.indexOf(first) === 0 && first.length >= 2 && first.length < maker.length)))
        );
        if (!hit) return zh;
        var cut = maker && zh.indexOf(maker + ' ') === 0 ? maker.length : first.length;
        var rest = zh.slice(cut).trim();
        return rest || zh;
    }

    function usdText(ship) {
        var n = Number(ship.usd);
        if (Number.isFinite(n) && n > 0) return '$ ' + n.toFixed(2) + 'USD';
        return '—';
    }

    function auecText(ship) {
        var n = Number(ship.auec);
        if (!Number.isFinite(n) || n <= 0) return '-';
        return (n / 10000).toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + ' WaUEC';
    }

    function visible() {
        var q = String(search.value || '').trim().toLowerCase();
        var who = maker.value;
        return ships.filter(function (ship) {
            var ground = isGround(ship);
            if (who && ship.makerZh !== who && ship.makerEn !== who && makerText(ship) !== who) return false;
            if (filter === 'resident' && !ship.resident) return false;
            if (filter === 'flyable' && (!ship.flyable || ground)) return false;
            if (filter === 'ground' && (!ship.flyable || !ground)) return false;
            if (!q) return true;
            return [ship.name, ship.nameZh, ship.makerZh, ship.makerEn, makerText(ship), roleText(ship), (ship.places || []).join(' ')]
                .join(' ')
                .toLowerCase()
                .indexOf(q) >= 0;
        });
    }

    function readColumns() {
        if (window.matchMedia('(max-width: 1500px)').matches) return 1;
        return 2;
    }

    function renderHead() {
        var labels = ['图鉴', '名称', '船厂', '＄价格', 'auec价格'];
        var html = '';
        for (var i = 0; i < columns; i += 1) {
            html += '<div class="scat-colhead">' + labels.map(function (label) {
                return '<span>' + label + '</span>';
            }).join('') + '</div>';
        }
        head.innerHTML = html;
        if (sheet) sheet.style.setProperty('--scat-cols', String(columns));
    }

    function shipBlock(ship) {
        var tags = sheetTags(ship);
        var img = artUrl(ship);
        var zh = displayNameZh(ship);
        var en = ship.name || '';
        var hasZh = zh && en && zh.toLowerCase() !== en.toLowerCase();
        var nameInner = hasZh
            ? '<span class="scat-zh">' + escapeHtml(zh) + '</span><span class="scat-en">' + escapeHtml(en) + '</span>'
            : '<span class="scat-zh">' + escapeHtml(zh || en) + '</span>';
        var nameHtml = ship.url
            ? '<a href="' + escapeHtml(ship.url) + '" target="_blank" rel="noopener">' + nameInner + '</a>'
            : nameInner;
        var placeList = ship.places || [];
        var places = placeList.map(function (place, index) {
            return '<span class="is-place is-p' + (index % 4) + '"' + (index > 1 ? ' hidden' : '') + '>' + escapeHtml(place) + '</span>';
        }).join('');
        return (
            '<article class="scat-ship">' +
            '<div class="scat-art">' + (img ? '<img src="' + escapeHtml(img) + '" alt="" loading="lazy">' : '') + '</div>' +
            '<div class="scat-name">' + nameHtml + '</div>' +
            '<div class="scat-logo">' + (makerLogo(ship) ? '<img src="' + escapeHtml(makerLogo(ship)) + '" alt="" onerror="this.remove()">' : '') + '</div>' +
            '<div class="scat-usd">' + escapeHtml(usdText(ship)) + '</div>' +
            '<div class="scat-auec">' + escapeHtml(auecText(ship)) + '</div>' +
            '<div class="scat-role">' + escapeHtml(roleText(ship)) + '</div>' +
            '<div class="scat-maker">' + escapeHtml(makerText(ship)) + '</div>' +
            '<div class="scat-tags">' + tagsHtml(tags) + '</div>' +
            '<div class="scat-place" data-places="' + escapeHtml(placeList.join('\n')) + '" title="' + escapeHtml(placeList.join(' / ')) + '">' + places + '</div>' +
            '</article>'
        );
    }

    var placeStep = 0;
    var placeTimer = 0;

    function placeHtml(names, start) {
        if (!names.length) return '';
        var a = ((start % names.length) + names.length) % names.length;
        var html = '<span class="is-place is-p' + (a % 4) + '">' + escapeHtml(names[a]) + '</span>';
        if (names.length < 2) return html;
        var b = (a + 1) % names.length;
        return html +
            '<span class="scat-place-sep"> / </span>' +
            '<span class="is-place is-p' + (b % 4) + '">' + escapeHtml(names[b]) + '</span>';
    }

    function rotatePlaces() {
        placeStep += 1;
        var cells = grid.querySelectorAll('.scat-place');
        for (var i = 0; i < cells.length; i += 1) {
            var names = cells[i]._names || [];
            if (names.length <= 2) continue;
            cells[i].innerHTML = placeHtml(names, ((placeStep + i) * 2) % names.length);
        }
    }

    function startPlaces() {
        if (placeTimer) clearInterval(placeTimer);
        placeTimer = 0;
        var cells = grid.querySelectorAll('.scat-place');
        var needs = false;
        for (var i = 0; i < cells.length; i += 1) {
            var raw = cells[i].getAttribute('data-places') || '';
            var names = raw ? raw.split('\n').filter(Boolean) : [];
            cells[i]._names = names;
            cells[i].innerHTML = placeHtml(names, 0);
            if (names.length > 2) needs = true;
        }
        if (!needs) return;
        placeTimer = setInterval(rotatePlaces, 2200);
    }

    function fitNameLine(selector, base, floor) {
        var nodes = grid.querySelectorAll(selector);
        for (var i = 0; i < nodes.length; i += 1) {
            var el = nodes[i];
            var size = base;
            el.style.fontSize = size + 'rem';
            var guard = 0;
            while (el.scrollWidth > el.clientWidth + 1 && size > floor && guard < 40) {
                size = Math.max(floor, size - 0.03);
                el.style.fontSize = size + 'rem';
                guard += 1;
            }
        }
    }

    function fitNames() {
        var narrow = window.matchMedia('(max-width: 680px)').matches;
        fitNameLine('.scat-zh', narrow ? 1 : 1.35, 0.72);
        fitNameLine('.scat-en', narrow ? 0.72 : 0.82, 0.58);
    }

    // 价格序：先左列从上到下，再右列从上到下（列优先写入行优先网格）
    function columnMajor(list, cols) {
        if (cols <= 1) return list.slice();
        var n = list.length;
        var rowCount = Math.ceil(n / cols) || 1;
        var out = [];
        for (var r = 0; r < rowCount; r += 1) {
            for (var c = 0; c < cols; c += 1) {
                var idx = c * rowCount + r;
                if (idx < n) out.push(list[idx]);
            }
        }
        return out;
    }

    function render() {
        columns = readColumns();
        renderHead();
        var rows = visible();
        var ordered = columnMajor(rows, columns);
        grid.innerHTML = ordered.length ? ordered.map(shipBlock).join('') : '<p class="scat-status">没有符合条件的飞船</p>';
        bindArt();
        startPlaces();
        fitNames();
    }

    function fillMakers() {
        var seen = {};
        ships.forEach(function (ship) {
            var label = makerText(ship);
            if (label) seen[label] = true;
        });
        maker.innerHTML = '<option value="">全部船厂</option>' + Object.keys(seen).sort(function (a, b) {
            return a.localeCompare(b, 'zh-CN');
        }).map(function (name) {
            return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
        }).join('');
    }

    document.getElementById('scatFilters').addEventListener('click', function (event) {
        var button = event.target.closest('[data-filter]');
        if (!button) return;
        filter = button.getAttribute('data-filter');
        document.querySelectorAll('.scat-filter').forEach(function (el) {
            el.classList.toggle('is-on', el === button);
        });
        render();
    });
    search.addEventListener('input', render);
    maker.addEventListener('change', render);
    window.addEventListener('resize', function () {
        var next = readColumns();
        if (next !== columns) render();
        else fitNames();
    });

    function applyNameZh(list, map) {
        var byName = (map && map.byName) || {};
        var byMaker = (map && map.byMakerName) || {};
        list.forEach(function (ship) {
            if (ship.nameZh) return;
            var name = String(ship.name || '').trim();
            ship.nameZh = byMaker[(ship.makerCode || '') + '|' + name] || byName[name] || '';
        });
    }

    Promise.all([
        fetch(apiUrl('/api/ships/catalog')).then(function (res) { return res.json(); }),
        fetch('ship-name-zh.json?v=1').then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; })
    ]).then(function (parts) {
        var data = parts[0] || {};
        ships = data.ships || [];
        applyNameZh(ships, parts[1]);
        fillMakers();
        render();
    }).catch(function () {
        renderHead();
        grid.innerHTML = '<p class="scat-status">飞船表暂时没有拉到</p>';
    });
})();
