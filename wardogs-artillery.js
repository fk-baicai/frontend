(function () {
    'use strict';

    var METERS_PER_COORD = 100;
    var MAP_COORDS = 160;
    var STORAGE_KEY = 'ussWardogsArty';

    var MORTAR_SINGLE = [
        [80, 950], [87, 940], [93, 930], [99, 920], [105, 910], [110, 900], [115, 890], [118, 880],
        [122, 870], [127, 860], [132, 850], [140, 840], [151, 830], [163, 820], [175, 810], [187, 800],
        [198, 790], [208, 780], [219, 770], [229, 760], [239, 750], [250, 740], [260, 730], [270, 720],
        [280, 710], [290, 700], [300, 690], [310, 680], [319, 670], [329, 660], [339, 650], [348, 640],
        [358, 630], [367, 620], [376, 610], [385, 600], [394, 590], [403, 580], [412, 570], [420, 560],
        [429, 550], [437, 540], [446, 530], [454, 520], [462, 510], [470, 500], [478, 490], [486, 480],
        [494, 470], [501, 460], [509, 450], [516, 440], [524, 430], [531, 420], [538, 410], [545, 400],
        [552, 390], [559, 380], [565, 370], [572, 360], [578, 350], [585, 340], [591, 330], [597, 320],
        [603, 310], [609, 300], [615, 290], [620, 280], [626, 270], [631, 260], [636, 250], [641, 240],
        [646, 230], [651, 220], [656, 210], [661, 200], [666, 190], [670, 180], [675, 170], [680, 160],
        [684, 150], [688, 140], [693, 130], [697, 120]
    ];

    var SPH_LOW = [
        [1181, 20], [1232, 30], [1283, 40], [1334, 50], [1384, 60], [1433, 70], [1482, 80], [1529, 90],
        [1576, 100], [1622, 110], [1666, 120], [1709, 130], [1751, 140], [1792, 150], [1832, 160], [1870, 170],
        [1907, 180], [1944, 190], [1979, 200], [2014, 210], [2046, 220], [2079, 230], [2110, 240], [2139, 250],
        [2168, 260], [2196, 270], [2223, 280], [2249, 290], [2273, 300], [2296, 310], [2319, 320], [2341, 330],
        [2362, 340], [2383, 350], [2403, 360], [2422, 370], [2439, 380], [2456, 390], [2471, 400], [2485, 410],
        [2499, 420], [2513, 430], [2526, 440], [2538, 450], [2550, 460], [2561, 470], [2570, 480], [2579, 490],
        [2586, 500], [2593, 510], [2599, 520], [2605, 530], [2610, 540], [2615, 550], [2620, 560], [2623, 570],
        [2626, 580], [2628, 590], [2629, 600]
    ];

    var SPH_HIGH = [
        [2629, 610], [2629, 620], [2628, 630], [2626, 640], [2624, 650], [2621, 660], [2617, 670], [2613, 680],
        [2609, 690], [2604, 700], [2599, 710], [2592, 720], [2584, 730], [2576, 740], [2567, 750], [2557, 760],
        [2546, 770], [2536, 780], [2524, 790], [2513, 800], [2501, 810], [2488, 820], [2474, 830], [2460, 840],
        [2444, 850], [2429, 860], [2412, 870], [2395, 880], [2378, 890], [2360, 900], [2342, 910], [2323, 920],
        [2303, 930], [2282, 940], [2261, 950], [2239, 960], [2217, 970], [2194, 980], [2171, 990], [2147, 1000],
        [2123, 1010], [2098, 1020], [2072, 1030], [2046, 1040], [2019, 1050], [1991, 1060], [1963, 1070], [1934, 1080],
        [1905, 1090], [1875, 1100], [1844, 1110], [1813, 1120], [1782, 1130], [1750, 1140], [1717, 1150], [1684, 1160],
        [1650, 1170], [1616, 1180], [1582, 1190], [1547, 1200], [1512, 1210], [1475, 1220], [1438, 1230], [1401, 1240],
        [1363, 1250], [1324, 1260], [1285, 1270], [1245, 1280], [1205, 1290], [1165, 1300], [1124, 1310], [1083, 1320],
        [1041, 1330], [999, 1340], [956, 1350], [913, 1360], [869, 1370], [825, 1380], [780, 1390], [735, 1400]
    ];

    var WEAPONS = {
        mortar: {
            id: 'mortar',
            label: 'L81 迫击炮',
            minRange: 0.132,
            maxRange: 0.684,
            ballistics: { single: MORTAR_SINGLE, low: [], high: [] }
        },
        spg: {
            id: 'spg',
            label: 'SPH-2 自行火炮',
            minRange: 0.78,
            maxRange: 2.629,
            ballistics: { single: [], low: SPH_LOW, high: SPH_HIGH }
        }
    };

    var MAP_SIZE = 163.84;
    var TILE_PX = 256;
    var MAX_TILE_Z = 6;
    var VENDOR_ICONS = { weapons_vendor: 1, garage_vendor: 1, spawn_board: 1 };
    var MARKER_SRC = 'wardogs-maps/markers/';

    var MAPS = {
        bakurani: {
            cdn: 'https://wardogs.t0ki.cn/maps/tiles/bakurani',
            tileMin: { x: 0, y: 0 },
            tileMax: { x: 163.84, y: 163.84 },
            markers: [
                { icon: 'tower', x: 80.52, y: 69.85, label: 'T1' },
                { icon: 'tower', x: 77.19, y: 70.00, label: 'T2' },
                { icon: 'tower', x: 77.19, y: 73.44, label: 'T3' },
                { icon: 'tower', x: 83.64, y: 72.85, label: 'T4' },
                { icon: 'tower', x: 82.22, y: 68.41, label: 'T5' },
                { icon: 'valkyra', x: 118.75, y: 70.93, label: 'Valkyra' },
                { icon: 'weapons_vendor', x: 118.30, y: 70.73, label: '武器商人' },
                { icon: 'garage_vendor', x: 118.14, y: 70.45, label: '车库' },
                { icon: 'spawn_board', x: 118.37, y: 70.49, label: '出生板' },
                { icon: 'manticore', x: 40.09, y: 77.52, label: 'Manticore' },
                { icon: 'weapons_vendor', x: 39.77, y: 77.65, label: '武器商人' },
                { icon: 'garage_vendor', x: 40.10, y: 77.31, label: '车库' },
                { icon: 'spawn_board', x: 39.68, y: 77.48, label: '出生板' },
                { icon: 'lonestar', x: 87.46, y: 32.50, label: 'Lonestar' },
                { icon: 'weapons_vendor', x: 87.20, y: 32.68, label: '武器商人' },
                { icon: 'garage_vendor', x: 86.84, y: 32.64, label: '车库' },
                { icon: 'spawn_board', x: 87.06, y: 32.72, label: '出生板' }
            ],
            zones: [
                { label: 'MANTICORE', color: '#82c596', points: [[38.68, 79.88], [43.39, 78.85], [42.35, 74.15], [37.65, 75.18]] },
                { label: 'LONESTAR', color: '#5fa8d3', points: [[83.08, 35.27], [87.72, 36.51], [88.97, 31.86], [84.32, 30.62]] },
                { label: 'VALKYRA', color: '#d86666', points: [[117.50, 73.76], [121.22, 70.71], [118.18, 66.99], [114.45, 70.04]] }
            ]
        },
        ozeti: {
            cdn: 'https://wardogs.t0ki.cn/maps/tiles/ozeti',
            tileMin: { x: 0, y: 0 },
            tileMax: { x: 163.84, y: 163.84 },
            markers: [
                { icon: 'tower', x: 95.80, y: 62.82, label: 'T1' },
                { icon: 'tower', x: 100.37, y: 59.23, label: 'T2' },
                { icon: 'tower', x: 104.49, y: 63.71, label: 'T3' },
                { icon: 'tower', x: 100.62, y: 67.64, label: 'T4' },
                { icon: 'valkyra', x: 136.73, y: 66.91, label: 'Valkyra' },
                { icon: 'weapons_vendor', x: 138.03, y: 67.33, label: '武器商人' },
                { icon: 'garage_vendor', x: 137.90, y: 67.07, label: '车库' },
                { icon: 'spawn_board', x: 137.88, y: 67.26, label: '出生板' },
                { icon: 'manticore', x: 68.28, y: 88.03, label: 'Manticore' },
                { icon: 'weapons_vendor', x: 68.54, y: 88.16, label: '武器商人' },
                { icon: 'garage_vendor', x: 68.66, y: 87.92, label: '车库' },
                { icon: 'spawn_board', x: 68.42, y: 87.86, label: '出生板' },
                { icon: 'lonestar', x: 83.73, y: 30.69, label: 'Lonestar' },
                { icon: 'weapons_vendor', x: 83.85, y: 30.88, label: '武器商人' },
                { icon: 'garage_vendor', x: 83.73, y: 31.17, label: '车库' },
                { icon: 'spawn_board', x: 83.68, y: 31.04, label: '出生板' }
            ],
            zones: [
                { label: 'MANTICORE', color: '#82c596', points: [[69.22, 90.85], [73.09, 87.98], [70.22, 84.12], [66.36, 86.99]] },
                { label: 'LONESTAR', color: '#5fa8d3', points: [[81.52, 34.03], [86.33, 34.03], [86.33, 29.21], [81.53, 29.22]] },
                { label: 'VALKYRA', color: '#d86666', points: [[133.98, 68.51], [138.58, 69.92], [139.99, 65.32], [135.39, 63.91]] }
            ]
        }
    };

    var TILE_CACHE = {};
    var ICONS = {};
    var MIN_SCALE = 1.2;
    var MAX_SCALE = 400;

    var state = {
        weapon: 'mortar',
        place: 'gun',
        map: 'bakurani',
        gun: null,
        tgt: null,
        missions: [{ id: 'm1', weapon: 'mortar', gun: null, tgt: null, lockGun: false, lockTgt: false }],
        activeId: 'm1',
        lockGun: false,
        lockTgt: false,
        view: { scale: 0, ox: 0, oy: 0 }
    };

    function $(id) {
        return document.getElementById(id);
    }

    function parseNum(value) {
        if (typeof value !== 'string') return Number(value);
        var n = Number(String(value).trim().replace(',', '.'));
        return Number.isFinite(n) ? n : NaN;
    }

    function newMissionId() {
        return 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
    }

    function activeMission() {
        var i;
        for (i = 0; i < state.missions.length; i++) {
            if (state.missions[i].id === state.activeId) return state.missions[i];
        }
        return state.missions[0];
    }

    function commitActive() {
        var m = activeMission();
        if (!m) return;
        m.weapon = state.weapon;
        m.gun = state.gun ? { x: state.gun.x, y: state.gun.y } : null;
        m.tgt = state.tgt ? { x: state.tgt.x, y: state.tgt.y } : null;
        m.lockGun = !!state.lockGun;
        m.lockTgt = !!state.lockTgt;
        delete m.locked;
    }

    function pointLocked(kind, mission) {
        var m = mission || null;
        if (m) {
            if (m.lockGun == null && m.lockTgt == null) return !!m.locked;
            return kind === 'tgt' ? !!m.lockTgt : !!m.lockGun;
        }
        return kind === 'tgt' ? !!state.lockTgt : !!state.lockGun;
    }

    function applyMission(m) {
        if (!m) return;
        state.activeId = m.id;
        state.weapon = WEAPONS[m.weapon] ? m.weapon : 'mortar';
        state.gun = m.gun ? { x: m.gun.x, y: m.gun.y } : null;
        state.tgt = m.tgt ? { x: m.tgt.x, y: m.tgt.y } : null;
        if (m.lockGun == null && m.lockTgt == null) {
            state.lockGun = !!m.locked;
            state.lockTgt = !!m.locked;
        } else {
            state.lockGun = !!m.lockGun;
            state.lockTgt = !!m.lockTgt;
        }
        if (!state.gun) state.lockGun = false;
        if (!state.tgt) state.lockTgt = false;
        writeInputs();
        syncLockUi();
        preferPlaceMode();
        document.querySelectorAll('[data-wd-weapon]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-wd-weapon') === state.weapon);
        });
    }

    function selectMission(id) {
        if (id === state.activeId) return;
        commitActive();
        var m = null;
        var i;
        for (i = 0; i < state.missions.length; i++) {
            if (state.missions[i].id === id) m = state.missions[i];
        }
        if (!m) return;
        applyMission(m);
        update();
    }

    function addMission() {
        if (state.missions.length >= 12) return;
        commitActive();
        var m = { id: newMissionId(), weapon: state.weapon, gun: null, tgt: null, lockGun: false, lockTgt: false };
        state.missions.push(m);
        applyMission(m);
        setPlace('gun');
        update();
    }

    function removeMission(id) {
        if (state.missions.length <= 1) {
            state.missions[0].gun = null;
            state.missions[0].tgt = null;
            state.missions[0].lockGun = false;
            state.missions[0].lockTgt = false;
            applyMission(state.missions[0]);
            update();
            return;
        }
        state.missions = state.missions.filter(function (m) { return m.id !== id; });
        if (state.activeId === id) applyMission(state.missions[0]);
        update();
    }

    function weaponShort(id) {
        return id === 'spg' ? 'SPH-2' : 'L81';
    }

    function missionLine(m) {
        if (!m.gun || !m.tgt) return weaponShort(m.weapon) + ' · 未完成';
        var dx = (m.tgt.x - m.gun.x) * METERS_PER_COORD;
        var dy = (m.tgt.y - m.gun.y) * METERS_PER_COORD;
        var dist = Math.hypot(dx, dy);
        var deg = (Math.atan2(dx, dy) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        var weapon = WEAPONS[m.weapon] || WEAPONS.mortar;
        var sol = getSolutions(weapon, dist);
        var mil = '—';
        if (sol.inRange) {
            if (sol.single) mil = formatMil(sol.single);
            else if (sol.high) mil = formatMil(sol.high);
            else if (sol.low) mil = formatMil(sol.low);
        }
        return weaponShort(m.weapon) + ' · ' + deg.toFixed(1) + '° · ' + mil + ' mil · ' + dist.toFixed(0) + ' m';
    }

    function renderMissionList() {
        var host = $('wdMissions');
        if (!host) return;
        host.innerHTML = '';
        state.missions.forEach(function (m, index) {
            var row = document.createElement('div');
            row.className = 'wd-arty-mission' + (m.id === state.activeId ? ' is-active' : '');
            var pick = document.createElement('button');
            pick.type = 'button';
            pick.className = 'wd-arty-mission-pick';
            pick.innerHTML = '<strong>#' + (index + 1) + '</strong><span>' + missionLine(m) + '</span>';
            pick.addEventListener('click', function () { selectMission(m.id); });
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'wd-arty-mission-del';
            del.setAttribute('aria-label', '删除诸元');
            del.textContent = '×';
            del.addEventListener('click', function (ev) {
                ev.stopPropagation();
                removeMission(m.id);
            });
            row.appendChild(pick);
            row.appendChild(del);
            host.appendChild(row);
        });
    }

    function groupBallisticTable(table) {
        var grouped = [];
        table.slice().sort(function (a, b) {
            return a[0] - b[0] || a[1] - b[1];
        }).forEach(function (pair) {
            var distance = pair[0];
            var mil = pair[1];
            var previous = grouped[grouped.length - 1];
            if (previous && previous.distance === distance) {
                previous.mils.push(mil);
                return;
            }
            grouped.push({ distance: distance, mils: [mil] });
        });
        return grouped;
    }

    function closestMil(values, target) {
        return values.reduce(function (best, value) {
            return Math.abs(value - target) < Math.abs(best - target) ? value : best;
        }, values[0]);
    }

    function interpolateBallisticTable(table, distanceMeters) {
        if (!Array.isArray(table) || !table.length || !Number.isFinite(distanceMeters)) return null;
        var groups = groupBallisticTable(table);
        var epsilon = 1e-6;
        var exact = groups.find(function (group) {
            return Math.abs(group.distance - distanceMeters) <= epsilon;
        });
        if (exact) {
            var minMil = Math.min.apply(null, exact.mils);
            var maxMil = Math.max.apply(null, exact.mils);
            return {
                mil: exact.mils.length === 1 ? exact.mils[0] : null,
                minMil: minMil,
                maxMil: maxMil
            };
        }
        var left = null;
        var right = null;
        for (var i = 0; i < groups.length - 1; i++) {
            if (distanceMeters > groups[i].distance && distanceMeters < groups[i + 1].distance) {
                left = groups[i];
                right = groups[i + 1];
                break;
            }
        }
        if (!left || !right) return null;
        var rightAverage = right.mils.reduce(function (sum, value) {
            return sum + value;
        }, 0) / right.mils.length;
        var leftMil = closestMil(left.mils, rightAverage);
        var rightMil = closestMil(right.mils, leftMil);
        var factor = (distanceMeters - left.distance) / (right.distance - left.distance);
        var mil = leftMil + factor * (rightMil - leftMil);
        return { mil: mil, minMil: mil, maxMil: mil };
    }

    function getSolutions(weapon, distanceMeters) {
        var minMeters = (weapon.minRange || 0) * 1000;
        var maxMeters = (weapon.maxRange || 0) * 1000;
        var inRange = distanceMeters + 1e-6 >= minMeters && distanceMeters <= maxMeters + 1e-6;
        if (!inRange) {
            return { inRange: false, single: null, low: null, high: null };
        }
        return {
            inRange: true,
            single: interpolateBallisticTable(weapon.ballistics.single, distanceMeters),
            low: interpolateBallisticTable(weapon.ballistics.low, distanceMeters),
            high: interpolateBallisticTable(weapon.ballistics.high, distanceMeters)
        };
    }

    function geometry() {
        var dx = (state.tgt.x - state.gun.x) * METERS_PER_COORD;
        var dy = (state.tgt.y - state.gun.y) * METERS_PER_COORD;
        var dist = Math.hypot(dx, dy);
        var deg = (Math.atan2(dx, dy) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        var milsAz = (deg * 6400) / 360;
        return { dx: dx, dy: dy, dist: dist, deg: deg, milsAz: milsAz };
    }

    function formatMil(sol) {
        if (!sol) return '—';
        if (sol.mil == null) return Math.round(sol.minMil) + '–' + Math.round(sol.maxMil);
        return String(Math.round(sol.mil));
    }

    function readPoint(xId, yId) {
        var xs = $(xId).value.trim();
        var ys = $(yId).value.trim();
        if (!xs && !ys) return null;
        var x = parseNum(xs);
        var y = parseNum(ys);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        return { x: x, y: y };
    }

    function readInputs() {
        var gun;
        var tgt;
        if (!state.lockGun) {
            gun = readPoint('wdGunX', 'wdGunY');
            if (gun === false) return false;
            state.gun = gun;
        }
        if (!state.lockTgt) {
            tgt = readPoint('wdTgtX', 'wdTgtY');
            if (tgt === false) return false;
            state.tgt = tgt;
        }
        return true;
    }

    function syncLockBtn(btn, locked, label) {
        if (!btn) return;
        btn.classList.toggle('is-locked', !!locked);
        btn.setAttribute('aria-pressed', locked ? 'true' : 'false');
        btn.setAttribute('aria-label', locked ? '解锁' + label : '锁定' + label);
        btn.title = locked ? label + '已锁定' : '锁定' + label;
    }

    function syncLockUi() {
        syncLockBtn(document.querySelector('[data-wd-lock="gun"]'), state.lockGun, '炮位 A');
        syncLockBtn(document.querySelector('[data-wd-lock="tgt"]'), state.lockTgt, '目标 B');
        var gx = $('wdGunX');
        var gy = $('wdGunY');
        var tx = $('wdTgtX');
        var ty = $('wdTgtY');
        if (gx) gx.readOnly = !!state.lockGun;
        if (gy) gy.readOnly = !!state.lockGun;
        if (tx) tx.readOnly = !!state.lockTgt;
        if (ty) ty.readOnly = !!state.lockTgt;
    }

    /** 点位已空时自动解锁，避免「炮删了锁还在」。 */
    function releaseOrphanLocks() {
        var changed = false;
        if (!state.gun && state.lockGun) {
            state.lockGun = false;
            changed = true;
        }
        if (!state.tgt && state.lockTgt) {
            state.lockTgt = false;
            changed = true;
        }
        if (changed) syncLockUi();
        return changed;
    }

    function toggleLock(kind) {
        if (kind === 'tgt') {
            if (!state.tgt && !state.lockTgt) return;
            state.lockTgt = !state.lockTgt;
        } else {
            if (!state.gun && !state.lockGun) return;
            state.lockGun = !state.lockGun;
        }
        syncLockUi();
        commitActive();
        save();
        draw();
    }

    function writeInputs() {
        $('wdGunX').value = state.gun ? String(roundCoord(state.gun.x)) : '';
        $('wdGunY').value = state.gun ? String(roundCoord(state.gun.y)) : '';
        $('wdTgtX').value = state.tgt ? String(roundCoord(state.tgt.x)) : '';
        $('wdTgtY').value = state.tgt ? String(roundCoord(state.tgt.y)) : '';
    }

    function roundCoord(n) {
        return Math.round(n * 100) / 100;
    }

    function save() {
        try {
            commitActive();
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                weapon: state.weapon,
                place: state.place,
                map: state.map,
                gun: state.gun,
                tgt: state.tgt,
                missions: state.missions,
                activeId: state.activeId
            }));
        } catch (e) { /* ignore */ }
    }

    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            var parsed = JSON.parse(raw);
            if (parsed && WEAPONS[parsed.weapon]) state.weapon = parsed.weapon;
            if (parsed && MAPS[parsed.map]) state.map = parsed.map;
            if (parsed && parsed.gun && Number.isFinite(parsed.gun.x)) state.gun = parsed.gun;
            if (parsed && parsed.tgt && Number.isFinite(parsed.tgt.x)) state.tgt = parsed.tgt;
            if (parsed && parsed.place) state.place = parsed.place;
            if (parsed && Array.isArray(parsed.missions) && parsed.missions.length) {
                state.missions = parsed.missions.filter(function (m) {
                    return m && m.id && WEAPONS[m.weapon];
                }).slice(0, 12);
            } else {
                state.missions = [{
                    id: 'm1',
                    weapon: state.weapon,
                    gun: state.gun,
                    tgt: state.tgt
                }];
            }
            if (!state.missions.length) {
                state.missions = [{ id: 'm1', weapon: 'mortar', gun: null, tgt: null }];
            }
            state.activeId = parsed.activeId;
            if (!activeMission()) state.activeId = state.missions[0].id;
            applyMission(activeMission());
        } catch (e) { /* ignore */ }
    }

    function setMetric(id, text) {
        var el = $(id);
        if (el) el.textContent = text;
    }

    function setStatus(text, kind) {
        var el = $('wdStatus');
        el.textContent = text;
        el.className = 'wd-arty-status' + (kind ? ' ' + kind : '');
        var box = $('wdResult');
        if (box) {
            box.classList.toggle('is-bad', kind === 'is-bad');
            box.classList.toggle('is-ok', kind === 'is-ok');
        }
    }

    function clearMetrics() {
        setMetric('wdDist', '—');
        setMetric('wdAz', '—');
        setMetric('wdAzMil', '—');
        setMetric('wdDelta', '—');
        setMetric('wdMil', '—');
    }

    function update() {
        if (!readInputs()) {
            setStatus('坐标无效', 'is-bad');
            clearMetrics();
            releaseOrphanLocks();
            commitActive();
            save();
            renderMissionList();
            clearBroadcastSolution();
            draw();
            return;
        }
        releaseOrphanLocks();
        preferPlaceMode();
        if (!state.gun || !state.tgt) {
            setStatus('等待设置点位', '');
            clearMetrics();
            commitActive();
            save();
            renderMissionList();
            clearBroadcastSolution();
            draw();
            return;
        }
        var geo = geometry();
        var weapon = WEAPONS[state.weapon];
        var sol = getSolutions(weapon, geo.dist);
        setMetric('wdDist', geo.dist.toFixed(1) + ' m');
        setMetric('wdAzMil', Math.round(geo.milsAz) + ' mil');
        setMetric('wdAz', geo.deg.toFixed(1) + '°');
        setMetric(
            'wdDelta',
            (geo.dx >= 0 ? '+' : '') + geo.dx.toFixed(1) + ' / ' + (geo.dy >= 0 ? '+' : '') + geo.dy.toFixed(1) + ' m'
        );

        var milLine = '—';
        if (sol.inRange) {
            if (sol.single) milLine = formatMil(sol.single) + ' mil';
            else {
                var parts = [];
                if (sol.low) parts.push('低 ' + formatMil(sol.low));
                if (sol.high) parts.push('高 ' + formatMil(sol.high));
                milLine = parts.length ? parts.join(' / ') + ' mil' : '射表无解';
            }
            setStatus('射程内', 'is-ok');
        } else {
            var tooShort = geo.dist < weapon.minRange * 1000;
            setStatus(tooShort ? '过近' : '超程', 'is-bad');
        }
        setMetric('wdMil', milLine);
        commitActive();
        save();
        renderMissionList();
        syncBroadcastSolution(geo, sol);
        draw();
    }

    function currentMap() {
        return MAPS[state.map] || MAPS.bakurani;
    }

    function clampCoord(v) {
        return Math.min(MAP_COORDS, Math.max(0, v));
    }

    function ensureCanvas(canvas) {
        var host = canvas.parentElement || canvas;
        var hostRect = host.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.max(160, Math.floor(hostRect.width));
        var h = Math.max(160, Math.floor(hostRect.height));
        var bw = Math.max(1, Math.round(w * dpr));
        var bh = Math.max(1, Math.round(h * dpr));
        if (canvas.style.width !== w + 'px' || canvas.style.height !== h + 'px') {
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
        }
        if (canvas.width !== bw || canvas.height !== bh) {
            canvas.width = bw;
            canvas.height = bh;
        }
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w: w, h: h, dpr: dpr, ctx: ctx };
    }

    function worldToPx(pt) {
        return {
            px: pt.x * state.view.scale + state.view.ox,
            py: -pt.y * state.view.scale + state.view.oy
        };
    }

    function pxToWorld(px, py) {
        return {
            x: (px - state.view.ox) / state.view.scale,
            y: (state.view.oy - py) / state.view.scale
        };
    }

    function localPoint(ev, canvas) {
        var rect = canvas.getBoundingClientRect();
        var src = ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0] : (ev.touches && ev.touches[0] ? ev.touches[0] : ev);
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    }

    function tileCandidates(mapId, z, tx, ty) {
        return [MAPS[mapId].cdn + '/zoom_' + z + '/' + tx + '_' + ty + '.webp'];
    }

    function getTile(mapId, z, tx, ty) {
        var n = 1 << z;
        if (tx < 0 || ty < 0 || tx >= n || ty >= n) return null;
        var key = mapId + ':' + z + ':' + tx + ':' + ty;
        if (TILE_CACHE[key]) return TILE_CACHE[key];
        var urls = tileCandidates(mapId, z, tx, ty);
        var img = new Image();
        var entry = { img: img, try: 0, urls: urls };
        img.decoding = 'async';
        img.onload = function () {
            draw();
        };
        img.onerror = function () {
            entry.try += 1;
            if (entry.try < urls.length) img.src = urls[entry.try];
        };
        img.src = urls[0];
        TILE_CACHE[key] = img;
        return img;
    }

    function loadIcons() {
        ['tower', 'valkyra', 'manticore', 'lonestar', 'weapons_vendor', 'garage_vendor', 'spawn_board'].forEach(function (name) {
            var img = new Image();
            img.decoding = 'async';
            img.onload = function () {
                ICONS[name] = img;
                draw();
            };
            img.src = MARKER_SRC + name + '.webp';
        });
    }

    function chooseTileZoom() {
        var z = Math.ceil(Math.log((state.view.scale * MAP_SIZE) / TILE_PX) / Math.log(2));
        if (!Number.isFinite(z)) z = 1;
        return Math.max(0, Math.min(MAX_TILE_Z, z));
    }

    function mapScreenRect() {
        var map = currentMap();
        var nw = worldToPx({ x: map.tileMin.x, y: map.tileMax.y });
        var se = worldToPx({ x: map.tileMax.x, y: map.tileMin.y });
        return {
            left: nw.px,
            top: nw.py,
            right: se.px,
            bottom: se.py
        };
    }

    function drawTiles(ctx, cssW, cssH, map, z) {
        var a = pxToWorld(0, 0);
        var b = pxToWorld(cssW, cssH);
        var left = Math.min(a.x, b.x);
        var right = Math.max(a.x, b.x);
        var top = Math.max(a.y, b.y);
        var bottom = Math.min(a.y, b.y);
        var minX = map.tileMin.x;
        var maxX = map.tileMax.x;
        var minY = map.tileMin.y;
        var maxY = map.tileMax.y;
        var worldW = maxX - minX;
        var worldH = maxY - minY;
        var n = 1 << z;
        var tx0 = Math.floor((left - minX) / worldW * n);
        var tx1 = Math.floor((right - minX) / worldW * n);
        var ty0 = Math.floor((maxY - top) / worldH * n);
        var ty1 = Math.floor((maxY - bottom) / worldH * n);
        var tx;
        var ty;
        for (tx = tx0; tx <= tx1; tx++) {
            for (ty = ty0; ty <= ty1; ty++) {
                var img = getTile(state.map, z, tx, ty);
                if (!img || !img.complete || !img.naturalWidth) continue;
                var tileLeft = minX + (tx / n) * worldW;
                var tileRight = minX + ((tx + 1) / n) * worldW;
                var tileNorth = maxY - (ty / n) * worldH;
                var tileSouth = maxY - ((ty + 1) / n) * worldH;
                var nw = worldToPx({ x: tileLeft, y: tileNorth });
                var se = worldToPx({ x: tileRight, y: tileSouth });
                var dw = se.px - nw.px;
                ctx.imageSmoothingEnabled = dw < img.naturalWidth - 0.5;
                ctx.drawImage(img, nw.px, nw.py, dw, se.py - nw.py);
            }
        }
    }

    function gridStep() {
        var units = [1, 2, 5, 10, 20, 50, 100];
        var i;
        for (i = 0; i < units.length; i++) {
            if (units[i] * state.view.scale >= 18) return units[i];
        }
        return units[units.length - 1];
    }

    function niceDistance(meters) {
        var pow = Math.pow(10, Math.floor(Math.log10(Math.max(meters, 1))));
        var cand = [1, 2, 5, 10].map(function (k) { return k * pow; });
        var i;
        for (i = 0; i < cand.length; i++) {
            if (cand[i] >= meters) return cand[i];
        }
        return cand[3];
    }

    function drawGrid(ctx, cssW, cssH) {
        var rect = mapScreenRect();
        var visL = Math.max(0, rect.left);
        var visT = Math.max(0, rect.top);
        var visR = Math.min(cssW, rect.right);
        var visB = Math.min(cssH, rect.bottom);
        var step = gridStep();
        var major = step * 5;
        var xmin = 0;
        var xmax = MAP_COORDS;
        var ymin = 0;
        var ymax = MAP_COORDS;
        var x;
        var y;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
        ctx.clip();
        ctx.lineWidth = 1;
        for (x = xmin; x <= xmax; x += step) {
            var sx = worldToPx({ x: x, y: 0 }).px;
            var isMajor = Math.abs(x % major) < 1e-6 || Math.abs((x % major) - major) < 1e-6;
            ctx.strokeStyle = isMajor ? 'rgba(235,232,218,0.22)' : 'rgba(235,232,218,0.08)';
            ctx.beginPath();
            ctx.moveTo(sx + 0.5, rect.top);
            ctx.lineTo(sx + 0.5, rect.bottom);
            ctx.stroke();
        }
        for (y = ymin; y <= ymax; y += step) {
            var sy = worldToPx({ x: 0, y: y }).py;
            var yMajor = Math.abs(y % major) < 1e-6 || Math.abs((y % major) - major) < 1e-6;
            ctx.strokeStyle = yMajor ? 'rgba(235,232,218,0.22)' : 'rgba(235,232,218,0.08)';
            ctx.beginPath();
            ctx.moveTo(rect.left, sy + 0.5);
            ctx.lineTo(rect.right, sy + 0.5);
            ctx.stroke();
        }
        ctx.restore();

        ctx.font = '10px Arial, sans-serif';
        ctx.fillStyle = 'rgba(225,222,209,0.92)';
        for (x = xmin; x <= xmax; x += major) {
            sx = worldToPx({ x: x, y: 0 }).px;
            if (sx < visL - 2 || sx > visR + 2) continue;
            var xLabel = 'X' + String(Math.round(x));
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(xLabel, sx, visT + 3);
            ctx.textBaseline = 'bottom';
            ctx.fillText(xLabel, sx, visB - 3);
        }
        for (y = ymin; y <= ymax; y += major) {
            sy = worldToPx({ x: 0, y: y }).py;
            if (sy < visT - 2 || sy > visB + 2) continue;
            var yLabel = 'Y' + String(Math.round(y));
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(yLabel, visL + 5, sy);
            ctx.textAlign = 'right';
            ctx.fillText(yLabel, visR - 5, sy);
        }
    }

    function drawZones(ctx, map) {
        map.zones.forEach(function (zone) {
            ctx.beginPath();
            zone.points.forEach(function (pt, i) {
                var p = worldToPx({ x: pt[0], y: pt[1] });
                if (i === 0) ctx.moveTo(p.px, p.py);
                else ctx.lineTo(p.px, p.py);
            });
            ctx.closePath();
            ctx.fillStyle = zone.color;
            ctx.globalAlpha = 0.12;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = zone.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }

    function drawMarkers(ctx, cssW, cssH, map) {
        var pxPerMeter = state.view.scale / METERS_PER_COORD;
        (map.markers || []).forEach(function (m) {
            if (VENDOR_ICONS[m.icon] && pxPerMeter < 0.06) return;
            var s = worldToPx(m);
            if (s.px < -30 || s.px > cssW + 30 || s.py < -30 || s.py > cssH + 30) return;
            var img = ICONS[m.icon];
            var size = m.icon === 'tower' ? 26 : 20;
            if (m.icon === 'tower') {
                var labelH = 13;
                var top = s.py - size / 2 - 2;
                var bottom = s.py + size / 2 + 4 + labelH + 2;
                var cy = (top + bottom) / 2 - 4;
                var ring = (bottom - top) / 2;
                ctx.save();
                ctx.setLineDash([3, 3]);
                ctx.lineWidth = 1.2;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(s.px, cy, ring, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            if (img) {
                ctx.drawImage(img, s.px - size / 2, s.py - size / 2, size, size);
            } else {
                ctx.fillStyle = '#f78f1e';
                ctx.beginPath();
                ctx.arc(s.px, s.py, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            if (m.icon === 'tower' && m.label) {
                ctx.fillStyle = 'rgba(233,233,228,0.92)';
                ctx.font = 'bold 11px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(m.label, s.px, s.py + size / 2 + 4);
            }
        });
    }

    function drawPoint(ctx, p, label, faded) {
        var s = worldToPx(p);
        ctx.save();
        if (faded) ctx.globalAlpha = 0.42;
        ctx.beginPath();
        ctx.arc(s.px, s.py, 8, 0, Math.PI * 2);
        ctx.fillStyle = label.charAt(0) === 'O' ? '#5fa8d3' : '#d86666';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = label.length > 2 ? 'bold 8px Arial, sans-serif' : 'bold 10px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, s.px, s.py + 4);
        ctx.restore();
    }

    function updateScaleBar() {
        var scaleEl = $('wdScale');
        if (!scaleEl || !state.view.scale) return;
        var targetPx = 90;
        var meters = niceDistance(targetPx / (state.view.scale / METERS_PER_COORD));
        var px = meters * (state.view.scale / METERS_PER_COORD);
        var bar = scaleEl.querySelector('span');
        if (bar) bar.style.width = Math.max(24, Math.min(160, px)) + 'px';
        var label = meters >= 1000
            ? ((meters / 1000) % 1 === 0 ? (meters / 1000) + ' km' : (meters / 1000).toFixed(1) + ' km')
            : meters + ' m';
        var text = scaleEl.querySelector('em');
        if (text) text.textContent = label;
        else scaleEl.lastChild && (scaleEl.lastChild.textContent = label);
    }

    function draw() {
        var canvas = $('wdCanvas');
        if (!canvas) return;
        var size = ensureCanvas(canvas);
        if (!state.view.scale) {
            fitView(size.w, size.h);
        }
        var ctx = size.ctx;
        var w = size.w;
        var h = size.h;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#050d18';
        ctx.fillRect(0, 0, w, h);

        var map = currentMap();
        // 圈外底图稍暗，突出射程内
        ctx.filter = 'brightness(0.92) contrast(1.06) saturate(0.92)';
        ctx.imageSmoothingQuality = 'high';
        ctx.imageSmoothingEnabled = true;
        drawTiles(ctx, w, h, map, 0);
        var hiZ = chooseTileZoom();
        if (hiZ > 0) drawTiles(ctx, w, h, map, hiZ);
        ctx.filter = 'none';

        // 主动诸元：最大射程圈内（扣除过近死区）提亮 + 提高对比，看起来更清晰
        var active = activeMission();
        if (active && active.gun) {
            var boostWeapon = WEAPONS[active.weapon] || WEAPONS.mortar;
            var boostGun = worldToPx(active.gun);
            var metersToPxBoost = state.view.scale / METERS_PER_COORD;
            var boostMin = Math.max(0, boostWeapon.minRange * 1000 * metersToPxBoost);
            var boostMax = Math.max(boostMin, boostWeapon.maxRange * 1000 * metersToPxBoost);
            if (boostMax > 2) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(boostGun.px, boostGun.py, boostMax, 0, Math.PI * 2);
                if (boostMin > 1) ctx.arc(boostGun.px, boostGun.py, boostMin, 0, Math.PI * 2, true);
                ctx.clip('evenodd');
                ctx.filter = 'brightness(1.22) contrast(1.28) saturate(1.06)';
                ctx.imageSmoothingQuality = 'high';
                ctx.imageSmoothingEnabled = true;
                drawTiles(ctx, w, h, map, 0);
                if (hiZ > 0) drawTiles(ctx, w, h, map, hiZ);
                ctx.filter = 'none';
                // 轻量白色提亮罩，避免瓦片边界发灰
                ctx.fillStyle = 'rgba(255, 255, 255, 0.048)';
                ctx.fillRect(0, 0, w, h);
                ctx.restore();
            }
        }

        drawGrid(ctx, w, h);
        drawZones(ctx, map);
        drawMarkers(ctx, w, h, map);

        var metersToPx = state.view.scale / METERS_PER_COORD;
        function drawMission(m, index, faded) {
            var weapon = WEAPONS[m.weapon] || WEAPONS.mortar;
            var n = index + 1;
            if (m.gun) {
                var gun = worldToPx(m.gun);
                var rMin = Math.max(0, weapon.minRange * 1000 * metersToPx);
                var rMax = Math.max(rMin, weapon.maxRange * 1000 * metersToPx);
                ctx.save();
                if (faded) ctx.globalAlpha = 0.28;
                ctx.beginPath();
                ctx.arc(gun.px, gun.py, rMax, 0, Math.PI * 2);
                if (rMin > 1) ctx.arc(gun.px, gun.py, rMin, 0, Math.PI * 2, true);
                ctx.fillStyle = faded ? 'rgba(255, 255, 255, 0.016)' : 'rgba(255, 255, 255, 0.032)';
                ctx.fill('evenodd');
                ctx.setLineDash([6, 5]);
                ctx.lineWidth = faded ? 1.1 : 1.6;
                ctx.strokeStyle = 'rgba(247, 143, 30, 0.88)';
                ctx.beginPath();
                ctx.arc(gun.px, gun.py, rMax, 0, Math.PI * 2);
                ctx.stroke();
                if (rMin > 1) {
                    ctx.strokeStyle = 'rgba(232, 120, 128, 0.9)';
                    ctx.beginPath();
                    ctx.arc(gun.px, gun.py, rMin, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.restore();
                if (m.tgt) {
                    var tgt = worldToPx(m.tgt);
                    ctx.save();
                    ctx.globalAlpha = faded ? 0.28 : 1;
                    ctx.strokeStyle = 'rgba(247,143,30,0.7)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(gun.px, gun.py);
                    ctx.lineTo(tgt.px, tgt.py);
                    ctx.stroke();
                    ctx.restore();
                }
                drawPoint(ctx, m.gun, 'O' + n, faded);
            }
            if (m.tgt) drawPoint(ctx, m.tgt, 'T' + n, faded);
        }
        state.missions.forEach(function (m, i) {
            if (m.id !== state.activeId) drawMission(m, i, true);
        });
        state.missions.forEach(function (m, i) {
            if (m.id === state.activeId) drawMission(m, i, false);
        });
        updateScaleBar();
    }

    function eventToWorld(ev, canvas, clamp) {
        var p = localPoint(ev, canvas);
        var world = pxToWorld(p.x, p.y);
        if (clamp) {
            return { x: clampCoord(world.x), y: clampCoord(world.y) };
        }
        return world;
    }

    function fitView(cssW, cssH) {
        var w = cssW;
        var h = cssH;
        if (!w || !h) {
            var canvas = $('wdCanvas');
            if (!canvas) return;
            var size = ensureCanvas(canvas);
            w = size.w;
            h = size.h;
        }
        state.view.scale = Math.min(w - 36, h - 36) / MAP_SIZE * 0.96;
        if (state.view.scale < 0.2) state.view.scale = 0.2;
        state.view.ox = w / 2 - (MAP_SIZE / 2) * state.view.scale;
        state.view.oy = h / 2 + (MAP_SIZE / 2) * state.view.scale;
    }

    function zoomAtScreen(sx, sy, factor) {
        var ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.view.scale * factor));
        var wx = (sx - state.view.ox) / state.view.scale;
        var wy = (state.view.oy - sy) / state.view.scale;
        state.view.scale = ns;
        state.view.ox = sx - wx * ns;
        state.view.oy = sy + wy * ns;
        draw();
    }

    function movePoint(kind, world, opts) {
        if (pointLocked(kind)) return;
        var p = { x: clampCoord(world.x), y: clampCoord(world.y) };
        if (kind === 'gun') state.gun = p;
        else state.tgt = p;
        if (!opts || !opts.silentPlace) setPlace(kind === 'gun' ? 'gun' : 'tgt');
        writeInputs();
        update();
    }

    function findHitAtScreen(sx, sy) {
        var thresh = 28;
        var best = null;
        var bestD = thresh;
        var bestId = null;
        state.missions.forEach(function (m) {
            [['gun', m.gun], ['tgt', m.tgt]].forEach(function (pair) {
                if (!pair[1]) return;
                var s = worldToPx(pair[1]);
                var d = Math.hypot(s.px - sx, s.py - sy);
                if (d <= bestD) {
                    best = pair[0];
                    bestD = d;
                    bestId = m.id;
                }
            });
        });
        if (!best) return null;
        return { kind: best, missionId: bestId };
    }

    function activateHitMission(hit) {
        if (!hit || hit.missionId === state.activeId) return hit.kind;
        commitActive();
        var i;
        for (i = 0; i < state.missions.length; i++) {
            if (state.missions[i].id === hit.missionId) {
                applyMission(state.missions[i]);
                renderMissionList();
                break;
            }
        }
        return hit.kind;
    }

    function hitPointAtScreen(sx, sy) {
        var hit = findHitAtScreen(sx, sy);
        return hit ? hit.kind : null;
    }

    function deleteNearest(wx, wy) {
        if (pointLocked('gun') && pointLocked('tgt')) return;
        var thresh = 14 / state.view.scale;
        var best = null;
        var bestD = Infinity;
        [['gun', state.gun], ['tgt', state.tgt]].forEach(function (pair) {
            if (!pair[1] || pointLocked(pair[0])) return;
            var d = Math.hypot(pair[1].x - wx, pair[1].y - wy);
            if (d < thresh && d < bestD) {
                best = pair[0];
                bestD = d;
            }
        });
        if (best === 'gun') state.gun = null;
        else if (best === 'tgt') state.tgt = null;
        else return;
        writeInputs();
        update();
    }

    function bindHints() {
        document.querySelectorAll('.wd-arty-hint').forEach(function (btn) {
            var pop = btn.querySelector('.wd-arty-hint-pop');
            if (!pop) return;
            function place() {
                if (pop.parentNode !== document.body) document.body.appendChild(pop);
                pop.classList.add('is-open');
                var r = btn.getBoundingClientRect();
                var w = pop.offsetWidth;
                var h = pop.offsetHeight;
                var left = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w));
                var top = r.bottom + 8;
                if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
                pop.style.left = left + 'px';
                pop.style.top = top + 'px';
            }
            function hide() {
                pop.classList.remove('is-open');
                if (pop.parentNode === document.body) btn.appendChild(pop);
            }
            btn.addEventListener('mouseenter', place);
            btn.addEventListener('mouseleave', hide);
            btn.addEventListener('focus', place);
            btn.addEventListener('blur', hide);
            btn.addEventListener('click', function (ev) { ev.preventDefault(); });
        });
    }

    function bindCanvas() {
        var canvas = $('wdCanvas');
        var pan = null;
        var pointDrag = null;
        var pinch = null;
        var pendingDrag = null;
        var dragRaf = 0;
        var pendingWorld = null;

        function setCursor(kind) {
            canvas.classList.toggle('is-panning', kind === 'pan');
            canvas.classList.toggle('is-dragging-point', kind === 'point');
            canvas.classList.toggle('is-over-point', kind === 'hover');
        }

        function endAllDrags() {
            if (dragRaf) {
                cancelAnimationFrame(dragRaf);
                dragRaf = 0;
            }
            pendingWorld = null;
            pendingDrag = null;
            pan = null;
            pointDrag = null;
            pinch = null;
            setCursor('');
        }

        function flushPointDrag() {
            dragRaf = 0;
            if (!pointDrag || !pendingWorld) return;
            movePoint(pointDrag, pendingWorld, { silentPlace: true });
            pendingWorld = null;
        }

        function queuePointDrag(kind, p) {
            pointDrag = kind;
            pendingDrag = null;
            pan = null;
            pendingWorld = pxToWorld(p.x, p.y);
            setCursor('point');
            if (!dragRaf) dragRaf = requestAnimationFrame(flushPointDrag);
        }

        function pointerOnCanvas(p) {
            var rect = canvas.getBoundingClientRect();
            return p.x >= 0 && p.y >= 0 && p.x <= rect.width && p.y <= rect.height;
        }

        canvas.addEventListener('contextmenu', function (ev) {
            ev.preventDefault();
        });
        canvas.addEventListener('mousedown', function (ev) {
            var p = localPoint(ev, canvas);
            if (ev.button === 2 || ev.button === 1) {
                pan = { x: p.x, y: p.y, ox: state.view.ox, oy: state.view.oy };
                pendingDrag = null;
                pointDrag = null;
                setCursor('pan');
                ev.preventDefault();
                return;
            }
            if (ev.button !== 0) return;
            var hit = findHitAtScreen(p.x, p.y);
            if (hit) {
                activateHitMission(hit);
                if (!pointLocked(hit.kind)) queuePointDrag(hit.kind, p);
                return;
            }
            var kind = state.place === 'tgt' ? 'tgt' : 'gun';
            if (pointLocked(kind)) return;
            if ((kind === 'gun' && !state.gun) || (kind === 'tgt' && !state.tgt)) {
                queuePointDrag(kind, p);
                return;
            }
            pendingDrag = { kind: kind, x: p.x, y: p.y };
        });
        window.addEventListener('mousemove', function (ev) {
            var rect = canvas.getBoundingClientRect();
            var p = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
            if (pointerOnCanvas(p)) {
                var world = pxToWorld(p.x, p.y);
                var cursor = $('wdCursor');
                if (cursor) {
                    cursor.textContent = 'X ' + clampCoord(world.x).toFixed(2) + ' / Y ' + clampCoord(world.y).toFixed(2);
                }
                if (!pan && !pointDrag && !pendingDrag) {
                    var hover = findHitAtScreen(p.x, p.y);
                    var hoverLocked = false;
                    if (hover) {
                        var hm = null;
                        var mi = 0;
                        for (mi = 0; mi < state.missions.length; mi++) {
                            if (state.missions[mi].id === hover.missionId) {
                                hm = state.missions[mi];
                                break;
                            }
                        }
                        hoverLocked = pointLocked(hover.kind, hm && hm.id === state.activeId ? null : hm);
                    }
                    setCursor(hover && !hoverLocked ? 'hover' : '');
                }
            }
            if (pointDrag && !(ev.buttons & 1)) {
                endAllDrags();
                return;
            }
            if (pan && !(ev.buttons & 2) && !(ev.buttons & 4)) {
                pan = null;
                setCursor('');
            }
            if (pendingDrag && (ev.buttons & 1)) {
                if (!pointLocked(pendingDrag.kind) && Math.hypot(p.x - pendingDrag.x, p.y - pendingDrag.y) > 4) {
                    queuePointDrag(pendingDrag.kind, p);
                }
                return;
            }
            if (pointDrag && (ev.buttons & 1)) {
                pendingWorld = pxToWorld(p.x, p.y);
                if (!dragRaf) dragRaf = requestAnimationFrame(flushPointDrag);
                return;
            }
            if (!pan) return;
            var dx = p.x - pan.x;
            var dy = p.y - pan.y;
            state.view.ox = pan.ox + dx;
            state.view.oy = pan.oy + dy;
            draw();
        });
        window.addEventListener('mouseup', function (ev) {
            var kind = pointDrag;
            if (kind && pendingWorld) movePoint(kind, pendingWorld, { silentPlace: true });
            if (ev.button === 0 && kind === 'gun' && !state.tgt) setPlace('tgt');
            else if (kind) setPlace(kind);
            pendingDrag = null;
            pan = null;
            pointDrag = null;
            pendingWorld = null;
            if (dragRaf) {
                cancelAnimationFrame(dragRaf);
                dragRaf = 0;
            }
            setCursor('');
        });
        canvas.addEventListener('wheel', function (ev) {
            ev.preventDefault();
            var p = localPoint(ev, canvas);
            zoomAtScreen(p.x, p.y, ev.deltaY < 0 ? 1.2 : 1 / 1.2);
        }, { passive: false });

        canvas.addEventListener('touchstart', function (ev) {
            ev.preventDefault();
            if (ev.touches.length === 1) {
                var p = localPoint(ev, canvas);
                var hit = findHitAtScreen(p.x, p.y);
                if (hit) {
                    activateHitMission(hit);
                    if (!pointLocked(hit.kind)) queuePointDrag(hit.kind, p);
                    return;
                }
                var kind = state.place === 'tgt' ? 'tgt' : 'gun';
                if (pointLocked(kind)) {
                    pan = { x: p.x, y: p.y, ox: state.view.ox, oy: state.view.oy };
                    setCursor('pan');
                    return;
                }
                if ((kind === 'gun' && !state.gun) || (kind === 'tgt' && !state.tgt)) {
                    queuePointDrag(kind, p);
                    return;
                }
                pan = { x: p.x, y: p.y, ox: state.view.ox, oy: state.view.oy };
                setCursor('pan');
            } else if (ev.touches.length === 2) {
                var pa = localPoint({ clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY }, canvas);
                var pb = localPoint({ clientX: ev.touches[1].clientX, clientY: ev.touches[1].clientY }, canvas);
                pinch = {
                    d: Math.hypot(pa.x - pb.x, pa.y - pb.y),
                    mx: (pa.x + pb.x) / 2,
                    my: (pa.y + pb.y) / 2,
                    scale: state.view.scale,
                    ox: state.view.ox,
                    oy: state.view.oy
                };
                pan = null;
                pointDrag = null;
                pendingDrag = null;
            }
        }, { passive: false });
        canvas.addEventListener('touchmove', function (ev) {
            ev.preventDefault();
            if (ev.touches.length === 1 && pointDrag) {
                var p = localPoint(ev, canvas);
                pendingWorld = pxToWorld(p.x, p.y);
                if (!dragRaf) dragRaf = requestAnimationFrame(flushPointDrag);
                return;
            }
            if (ev.touches.length === 1 && pan) {
                var p = localPoint(ev, canvas);
                var dx = p.x - pan.x;
                var dy = p.y - pan.y;
                state.view.ox = pan.ox + dx;
                state.view.oy = pan.oy + dy;
                draw();
            } else if (ev.touches.length === 2 && pinch) {
                var pa = localPoint({ clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY }, canvas);
                var pb = localPoint({ clientX: ev.touches[1].clientX, clientY: ev.touches[1].clientY }, canvas);
                var nd = Math.hypot(pa.x - pb.x, pa.y - pb.y);
                var ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinch.scale * (nd / pinch.d)));
                var wx = (pinch.mx - pinch.ox) / pinch.scale;
                var wy = (pinch.oy - pinch.my) / pinch.scale;
                state.view.scale = ns;
                state.view.ox = pinch.mx - wx * ns;
                state.view.oy = pinch.my + wy * ns;
                draw();
            }
        }, { passive: false });
        canvas.addEventListener('touchend', function () {
            if (pointDrag === 'gun' && !state.tgt) setPlace('tgt');
            else if (pointDrag) setPlace(pointDrag);
            endAllDrags();
            update();
        });
        window.addEventListener('blur', endAllDrags);
    }

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var HOTKEY_CFG_NAME = 'uss-artillery-hotkey.json';
    var broadcastState = {
        ready: false,
        loggedIn: false,
        isSuperAdmin: false,
        announceEnabled: false,
        enabled: false,
        azDeg: null,
        mil: null,
        distMeters: null,
        syncTimer: 0,
        fireBusy: false,
        lastFireAt: 0,
        countdownTimer: 0,
        speakPrefs: { voiceId: '', rate: '', volume: '', addressAs: '' },
        speakOptions: { voices: [], rates: [], volumes: [] },
        settingsOpen: false,
        settingsSaving: false
    };

    function loadAuthSession() {
        try {
            if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.loadAuthSession === 'function') {
                var synced = window.UssAuthSessionSync.loadAuthSession();
                if (synced && synced.token) return synced;
            }
            var raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function loadAuthToken() {
        var sess = loadAuthSession();
        return sess && sess.token ? String(sess.token) : '';
    }

    function pickElevationMil(sol) {
        if (!sol || !sol.inRange) return null;
        function fromBranch(branch) {
            if (!branch) return null;
            if (branch.mil != null && Number.isFinite(branch.mil)) return Math.round(branch.mil);
            if (branch.minMil != null && Number.isFinite(branch.minMil)) return Math.round(branch.minMil);
            return null;
        }
        return fromBranch(sol.single) || fromBranch(sol.high) || fromBranch(sol.low);
    }

    function clearBroadcastSolution() {
        broadcastState.azDeg = null;
        broadcastState.mil = null;
        broadcastState.distMeters = null;
        refreshBroadcastUi();
    }

    function syncBroadcastSolution(geo, sol) {
        var mil = pickElevationMil(sol);
        if (!geo || !Number.isFinite(geo.deg) || mil == null) {
            clearBroadcastSolution();
            return;
        }
        broadcastState.azDeg = Math.round(geo.deg * 10) / 10;
        broadcastState.mil = mil;
        broadcastState.distMeters = Number.isFinite(geo.dist) ? Math.round(geo.dist) : null;
        refreshBroadcastUi();
        scheduleSolutionUpload();
    }

    function setBroadcastHint(text) {
        var el = $('wdBroadcastHint');
        if (!el) return;
        var t = text == null ? '' : String(text);
        el.textContent = t;
        el.hidden = !t;
    }

    function setBroadcastSettingsMsg(text) {
        var el = $('wdBroadcastSettingsMsg');
        if (el) el.textContent = text || '';
    }

    function fillSelectOptions(selectEl, options, selected, emptyLabel) {
        if (!selectEl) return;
        var list = Array.isArray(options) ? options : [];
        var html = '';
        if (emptyLabel != null) {
            html += '<option value="">' + String(emptyLabel).replace(/</g, '&lt;') + '</option>';
        }
        var groups = {};
        list.forEach(function (item) {
            if (!item) return;
            var value = String(item.value != null ? item.value : item.id || '').trim();
            var label = String(item.label || value || '').trim() || value;
            if (!value && emptyLabel != null) return;
            var group = String(item.group || '').trim();
            if (!groups[group]) groups[group] = [];
            groups[group].push({ value: value, label: label });
        });
        Object.keys(groups).forEach(function (group) {
            var rows = groups[group];
            if (group) html += '<optgroup label="' + group.replace(/"/g, '&quot;') + '">';
            rows.forEach(function (row) {
                html +=
                    '<option value="' +
                    row.value.replace(/"/g, '&quot;') +
                    '"' +
                    (selected === row.value ? ' selected' : '') +
                    '>' +
                    row.label.replace(/</g, '&lt;') +
                    '</option>';
            });
            if (group) html += '</optgroup>';
        });
        selectEl.innerHTML = html;
        if (selected != null) selectEl.value = selected;
    }

    function applySpeakOptionsToForm() {
        var prefs = broadcastState.speakPrefs || {};
        var opts = broadcastState.speakOptions || {};
        var addressEl = $('wdBroadcastAddress');
        if (addressEl) addressEl.value = prefs.addressAs || '';
        fillSelectOptions(
            $('wdBroadcastVoice'),
            opts.voices || [],
            prefs.voiceId || '',
            '跟随默认'
        );
        fillSelectOptions($('wdBroadcastRate'), opts.rates || [], prefs.rate || '');
        fillSelectOptions($('wdBroadcastVolume'), opts.volumes || [], prefs.volume || '');
    }

    function syncSpeakPrefsFromData(data) {
        var prefs = (data && data.artillerySpeakPrefs) || {};
        var options = (data && data.artillerySpeakOptions) || {};
        var voices = Array.isArray(options.voices) ? options.voices : [];
        voices = voices.filter(function (v) {
            if (!v) return false;
            if (v.engine === 'clone') return false;
            if (String(v.group || '') === '克隆音色') return false;
            var id = String(v.id || v.value || '');
            if (/^yise_/i.test(id) || /^clone:/i.test(id)) return false;
            return true;
        });
        var prefsVoice = String(prefs.voiceId || '').trim();
        if (/^yise_/i.test(prefsVoice) || /^clone:/i.test(prefsVoice)) prefsVoice = '';
        broadcastState.speakPrefs = {
            voiceId: prefsVoice,
            rate: String(prefs.rate || '').trim(),
            volume: String(prefs.volume || '').trim(),
            addressAs: String(prefs.addressAs || '').trim()
        };
        broadcastState.speakOptions = {
            voices: voices,
            rates: Array.isArray(options.rates) ? options.rates : [
                { value: '', label: '跟随默认' },
                { value: '-10%', label: '较慢' },
                { value: '+0%', label: '正常' },
                { value: '+10%', label: '较快' }
            ],
            volumes: Array.isArray(options.volumes) ? options.volumes : [
                { value: '', label: '跟随默认' },
                { value: '+0%', label: '正常' },
                { value: '+20%', label: '较大' },
                { value: '+50%', label: '最大' }
            ]
        };
        applySpeakOptionsToForm();
    }

    function setBroadcastSettingsOpen(open) {
        broadcastState.settingsOpen = !!open;
        var panel = $('wdBroadcastSettings');
        var gear = $('wdBroadcastSettingsBtn');
        if (panel) panel.hidden = !broadcastState.settingsOpen;
        if (gear) gear.setAttribute('aria-expanded', broadcastState.settingsOpen ? 'true' : 'false');
        if (broadcastState.settingsOpen) {
            applySpeakOptionsToForm();
            setBroadcastSettingsMsg('');
        }
    }

    function refreshBroadcastUi() {
        var box = $('wdBroadcastBox');
        var toggle = $('wdBroadcastToggle');
        var btn = $('wdBroadcastNow');
        var gear = $('wdBroadcastSettingsBtn');
        var artyMenuItem = $('wdHelperMenuArty');
        if (!box || !toggle || !btn) return;
        var canUse = broadcastState.loggedIn && broadcastState.announceEnabled;
        box.hidden = !canUse;
        toggle.disabled = !canUse;
        toggle.checked = !!(canUse && broadcastState.enabled);
        if (gear) gear.disabled = !canUse;
        if (artyMenuItem) artyMenuItem.hidden = !broadcastState.isSuperAdmin;
        if (!canUse) setBroadcastSettingsOpen(false);
        var hasSol = Number.isFinite(broadcastState.azDeg) && Number.isFinite(broadcastState.mil);
        btn.disabled = !(canUse && broadcastState.enabled && hasSol) || broadcastState.fireBusy;
        if (!broadcastState.loggedIn) {
            setBroadcastHint('登录舰队账号后可开启射击播报。');
        } else if (!broadcastState.announceEnabled) {
            setBroadcastHint('请先在首页 OOPZ 设置开启「语音提示」。');
        } else if (!broadcastState.enabled) {
            setBroadcastHint('开启射击播报后，可下载「语音助手」用 F2 播报。');
        } else if (!hasSol) {
            setBroadcastHint('已开启射击播报。下载「语音助手」后游戏内按 F2。');
        } else {
            setBroadcastHint('');
        }
    }

    function writeHotkeyConfig(token) {
        try {
            var cfg = {
                apiBase: (window.UssAuthApi && window.UssAuthApi.base) || (window.USS_AUTH_API_BASE || ''),
                token: token || '',
                enabled: !!broadcastState.enabled,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(HOTKEY_CFG_NAME, JSON.stringify(cfg));
            return cfg;
        } catch (e) {
            return null;
        }
    }

    function appendCfgToExe(buf, cfg) {
        var marker = new TextEncoder().encode('\n__USS_ARTY_CFG_V1__\n');
        var cfgBytes = new TextEncoder().encode(JSON.stringify(cfg));
        var out = new Uint8Array(buf.byteLength + marker.length + cfgBytes.length);
        out.set(new Uint8Array(buf), 0);
        out.set(marker, buf.byteLength);
        out.set(cfgBytes, buf.byteLength + marker.length);
        return out.buffer;
    }

    function triggerExeDownload(buf, filename) {
        return new Promise(function (resolve) {
            var blob = new Blob([buf], { type: 'application/octet-stream' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            // Delay revoke/remove — immediate revoke often cancels the download
            setTimeout(function () {
                try {
                    a.remove();
                } catch (e) { /* ignore */ }
                try {
                    URL.revokeObjectURL(url);
                } catch (e2) { /* ignore */ }
                resolve();
            }, 1500);
        });
    }

    function formatDownloadProgress(loaded, total, label) {
        var mb = (loaded / (1024 * 1024)).toFixed(1);
        if (total > 0) {
            var pct = Math.min(99, Math.round((loaded / total) * 100));
            var totalMb = (total / (1024 * 1024)).toFixed(1);
            return label + ' ' + pct + '%（' + mb + '/' + totalMb + ' MB）';
        }
        return label + '… ' + mb + ' MB';
    }

    function setHelperDownloadUi(btn, text) {
        if (btn) btn.textContent = text;
        setBroadcastHint(text);
    }

    function fetchArrayBufferWithProgress(url, options, onProgress) {
        options = options || {};
        return fetch(url, options).then(function (r) {
            if (!r.ok) {
                return r.text().then(function (t) {
                    var err = new Error('HTTP ' + r.status);
                    err.status = r.status;
                    err.body = t;
                    throw err;
                });
            }
            var total = Number(r.headers.get('Content-Length') || 0);
            if (!r.body || typeof r.body.getReader !== 'function') {
                return r.arrayBuffer().then(function (buf) {
                    if (onProgress) onProgress(buf.byteLength, buf.byteLength || total);
                    return buf;
                });
            }
            var reader = r.body.getReader();
            var chunks = [];
            var loaded = 0;
            function pump() {
                return reader.read().then(function (result) {
                    if (result.done) {
                        var out = new Uint8Array(loaded);
                        var offset = 0;
                        for (var i = 0; i < chunks.length; i++) {
                            out.set(chunks[i], offset);
                            offset += chunks[i].length;
                        }
                        if (onProgress) onProgress(loaded, total || loaded);
                        return out.buffer;
                    }
                    var value = result.value;
                    chunks.push(value);
                    loaded += value.length;
                    if (onProgress) onProgress(loaded, total);
                    return pump();
                });
            }
            return pump();
        });
    }

    function fetchVoiceHelperBuf(cfg, onProgress) {
        var withCfg = !!(cfg && cfg.token && cfg.enabled);
        return fetchArrayBufferWithProgress(
            'wardogs-voice-assist/uss-voice-helper.exe?v=2',
            { cache: 'no-store' },
            onProgress
        ).then(function (buf) {
            return withCfg ? appendCfgToExe(buf, cfg) : buf;
        }, function (err) {
            if (err && err.status) {
                throw new Error(
                    '语音助手文件不存在（HTTP ' +
                        err.status +
                        '）。请把 frontend/wardogs-voice-assist/uss-voice-helper.exe 上传到网站。'
                );
            }
            throw err;
        });
    }

    function fetchArtyHelperBuf(token, cfg, onProgress) {
        var apiBase = (window.UssAuthApi && window.UssAuthApi.base) || (window.USS_AUTH_API_BASE || '');
        if (!apiBase) {
            return Promise.reject(new Error('接口地址未配置，无法下载炮兵助手。'));
        }
        return fetchArrayBufferWithProgress(
            String(apiBase).replace(/\/$/, '') + '/api/me/arty/helper-exe',
            {
                cache: 'no-store',
                headers: { Authorization: 'Bearer ' + token }
            },
            onProgress
        ).then(function (buf) {
            return appendCfgToExe(buf, cfg);
        }, function (err) {
            var msg = '炮兵助手下载失败' + (err && err.status ? ' HTTP ' + err.status : '');
            if (err && err.body) {
                try {
                    var j = JSON.parse(err.body);
                    if (j && (j.error || j.message)) msg = j.error || j.message;
                } catch (e) { /* ignore */ }
            } else if (err && err.message && !err.status) {
                msg = err.message;
            }
            throw new Error(msg);
        });
    }

    function beginHelperDownload(btn, defaultLabel) {
        if (!btn || btn.disabled) return null;
        btn.disabled = true;
        btn.dataset.prevText = btn.textContent || defaultLabel;
        return btn;
    }

    function endHelperDownload(btn, defaultLabel) {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = btn.dataset.prevText || defaultLabel;
    }

    function setHelperMenuOpen(open) {
        var menu = $('wdHelperMenu');
        var btn = $('wdHelperExe');
        if (!menu) return;
        menu.hidden = !open;
        if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function downloadVoiceHelper() {
        var token = loadAuthToken();
        var cfg = writeHotkeyConfig(token);
        var btn = beginHelperDownload($('wdHelperExe'), '下载助手');
        if (!btn) return;
        setHelperMenuOpen(false);
        setHelperDownloadUi(btn, '下载语音助手…');
        fetchVoiceHelperBuf(cfg, function (loaded, total) {
            setHelperDownloadUi(btn, formatDownloadProgress(loaded, total, '语音助手'));
        })
            .then(function (buf) {
                setHelperDownloadUi(btn, '保存语音助手…');
                return triggerExeDownload(buf, 'uss-voice-helper.exe').then(function () {
                    setBroadcastHint(
                        cfg && cfg.enabled
                            ? '已下载语音助手（F2）'
                            : '已下载语音助手（未写入播报配置）'
                    );
                });
            })
            .catch(function (err) {
                var msg = (err && err.message) || '语音助手下载失败';
                setBroadcastHint(msg);
                window.alert(msg);
            })
            .finally(function () {
                endHelperDownload(btn, '下载助手');
            });
    }

    function downloadArtyHelper() {
        if (!broadcastState.isSuperAdmin) {
            window.alert('仅超级管理员可下载炮兵助手。');
            return;
        }
        var token = loadAuthToken();
        if (!token || !window.UssAuthApi) {
            window.alert('请先登录超级管理员账号后再下炮兵助手。');
            return;
        }
        var btn = beginHelperDownload($('wdHelperExe'), '下载助手');
        if (!btn) return;
        setHelperMenuOpen(false);
        var cfg = {
            apiBase: (window.UssAuthApi && window.UssAuthApi.base) || (window.USS_AUTH_API_BASE || ''),
            token: token,
            enabled: !!broadcastState.enabled,
            updatedAt: new Date().toISOString()
        };
        setHelperDownloadUi(btn, '下载炮兵助手…');
        fetchArtyHelperBuf(token, cfg, function (loaded, total) {
            setHelperDownloadUi(btn, formatDownloadProgress(loaded, total, '炮兵助手'));
        })
            .then(function (buf) {
                setHelperDownloadUi(btn, '保存炮兵助手…');
                return triggerExeDownload(buf, 'uss-arty-helper.exe').then(function () {
                    setBroadcastHint('已下载炮兵助手（F1/F3/F4/F5）');
                });
            })
            .catch(function (err) {
                var msg = (err && err.message) || '炮兵助手下载失败';
                setBroadcastHint(msg);
                window.alert(msg);
            })
            .finally(function () {
                endHelperDownload(btn, '下载助手');
            });
    }

    function onHelperMenuPick(kind) {
        if (kind === 'arty') downloadArtyHelper();
        else downloadVoiceHelper();
    }

    function saveBroadcastSpeakPrefs() {
        var token = loadAuthToken();
        if (!token || !window.UssAuthApi || broadcastState.settingsSaving) return;
        var addressEl = $('wdBroadcastAddress');
        var voiceEl = $('wdBroadcastVoice');
        var rateEl = $('wdBroadcastRate');
        var volumeEl = $('wdBroadcastVolume');
        var payload = {
            addressAs: addressEl ? String(addressEl.value || '').trim() : '',
            voiceId: voiceEl ? String(voiceEl.value || '').trim() : '',
            rate: rateEl ? String(rateEl.value || '').trim() : '',
            volume: volumeEl ? String(volumeEl.value || '').trim() : ''
        };
        broadcastState.settingsSaving = true;
        setBroadcastSettingsMsg('保存中…');
        var saveBtn = $('wdBroadcastSettingsSave');
        if (saveBtn) saveBtn.disabled = true;
        window.UssAuthApi.setOopzArtillerySpeakPrefs(token, payload)
            .then(function (data) {
                syncSpeakPrefsFromData({
                    artillerySpeakPrefs: (data && data.artillerySpeakPrefs) || payload,
                    artillerySpeakOptions: broadcastState.speakOptions
                });
                setBroadcastSettingsMsg('已保存');
                refreshBroadcastUi();
                if (broadcastState.enabled) scheduleSolutionUpload();
            })
            .catch(function (err) {
                var msg = (window.UssApiError && window.UssApiError.sanitizeUserMessage)
                    ? window.UssApiError.sanitizeUserMessage(err)
                    : ((err && err.message) || '保存失败');
                setBroadcastSettingsMsg(msg);
            })
            .finally(function () {
                broadcastState.settingsSaving = false;
                if (saveBtn) saveBtn.disabled = false;
            });
    }

    function scheduleSolutionUpload() {
        if (!broadcastState.enabled || !broadcastState.loggedIn) return;
        if (!Number.isFinite(broadcastState.azDeg) || !Number.isFinite(broadcastState.mil)) return;
        if (broadcastState.syncTimer) clearTimeout(broadcastState.syncTimer);
        broadcastState.syncTimer = setTimeout(function () {
            broadcastState.syncTimer = 0;
            uploadBroadcastSolution();
        }, 280);
    }

    function broadcastSolutionPayload(extra) {
        var payload = {
            azDeg: broadcastState.azDeg,
            mil: broadcastState.mil
        };
        if (Number.isFinite(broadcastState.distMeters)) payload.distMeters = broadcastState.distMeters;
        if (extra && typeof extra === 'object') {
            Object.keys(extra).forEach(function (key) {
                payload[key] = extra[key];
            });
        }
        return payload;
    }

    function uploadBroadcastSolution() {
        var token = loadAuthToken();
        if (!token || !window.UssAuthApi || !broadcastState.enabled) return;
        window.UssAuthApi.setOopzArtillerySolution(token, broadcastSolutionPayload()).catch(function () { /* ignore */ });
    }

    function doFireBroadcast(opts) {
        opts = opts || {};
        var token = loadAuthToken();
        if (!token || !window.UssAuthApi) {
            broadcastState.fireBusy = false;
            setBroadcastHint('登录已失效，请重新登录。');
            refreshBroadcastUi();
            return;
        }
        var btn = $('wdBroadcastNow');
        if (btn) btn.textContent = '立即播报';
        setBroadcastHint('正在发送播报…');
        window.UssAuthApi.fireOopzArtillery(token, broadcastSolutionPayload({ repeat: 1 })).then(function (data) {
            broadcastState.lastFireAt = Date.now();
            var fallback = broadcastState.azDeg + '° / ' + broadcastState.mil + ' mil';
            if (Number.isFinite(broadcastState.distMeters)) fallback += ' / ' + broadcastState.distMeters + ' m';
            setBroadcastHint('已排队播报：' + ((data && data.text) || fallback));
        }).catch(function (err) {
            var msg = (window.UssApiError && window.UssApiError.sanitizeUserMessage)
                ? window.UssApiError.sanitizeUserMessage(err)
                : ((err && err.message) || '播报失败');
            setBroadcastHint(msg);
        }).then(function () {
            broadcastState.fireBusy = false;
            refreshBroadcastUi();
        });
    }

    function startFireCountdown() {
        var btn = $('wdBroadcastNow');
        var left = 2;
        if (broadcastState.countdownTimer) {
            clearTimeout(broadcastState.countdownTimer);
            broadcastState.countdownTimer = 0;
        }
        function tick() {
            if (left <= 0) {
                broadcastState.countdownTimer = 0;
                doFireBroadcast();
                return;
            }
            setBroadcastHint(left + ' 秒后播报，请切回游戏…');
            if (btn) btn.textContent = left + '…';
            left -= 1;
            broadcastState.countdownTimer = setTimeout(tick, 1000);
        }
        tick();
    }

    function fireBroadcast(opts) {
        opts = opts || {};
        if (broadcastState.fireBusy) return;
        if (!broadcastState.enabled || !broadcastState.loggedIn || !broadcastState.announceEnabled) return;
        if (!Number.isFinite(broadcastState.azDeg) || !Number.isFinite(broadcastState.mil)) {
            setBroadcastHint('暂无有效诸元，先在地图摆好 O/T。');
            return;
        }
        var now = Date.now();
        if (now - broadcastState.lastFireAt < 3000) {
            var wait = Math.ceil((3000 - (now - broadcastState.lastFireAt)) / 1000);
            setBroadcastHint('冷却中，' + wait + ' 秒后再试。');
            return;
        }
        var token = loadAuthToken();
        if (!token || !window.UssAuthApi) {
            setBroadcastHint('登录已失效，请重新登录。');
            return;
        }
        broadcastState.fireBusy = true;
        refreshBroadcastUi();
        if (opts.countdown) {
            startFireCountdown();
            return;
        }
        doFireBroadcast();
    }

    function onBroadcastToggleChange() {
        var toggle = $('wdBroadcastToggle');
        if (!toggle) return;
        var want = !!toggle.checked;
        var token = loadAuthToken();
        if (!token || !window.UssAuthApi) {
            toggle.checked = false;
            broadcastState.enabled = false;
            refreshBroadcastUi();
            return;
        }
        window.UssAuthApi.setOopzArtilleryBroadcast(token, want).then(function (data) {
            broadcastState.enabled = !!(data && data.artilleryBroadcastEnabled);
            writeHotkeyConfig(token);
            if (broadcastState.enabled) scheduleSolutionUpload();
            refreshBroadcastUi();
        }).catch(function (err) {
            toggle.checked = false;
            broadcastState.enabled = false;
            var msg = (window.UssApiError && window.UssApiError.sanitizeUserMessage)
                ? window.UssApiError.sanitizeUserMessage(err)
                : ((err && err.message) || '无法开启射击播报');
            setBroadcastHint(msg);
            refreshBroadcastUi();
        });
    }

    function refreshBroadcastAuth() {
        var token = loadAuthToken();
        var sess = loadAuthSession();
        broadcastState.loggedIn = !!token;
        broadcastState.isSuperAdmin = !!(sess && sess.isSuperAdmin);
        if (!token || !window.UssAuthApi) {
            broadcastState.announceEnabled = false;
            broadcastState.enabled = false;
            refreshBroadcastUi();
            return Promise.resolve();
        }
        return window.UssAuthApi.getOopzBinding(token).then(function (data) {
            broadcastState.announceEnabled = !!(data && data.oopzAnnounceEnabled && data.oopzId);
            broadcastState.enabled = !!(data && data.artilleryBroadcastEnabled);
            syncSpeakPrefsFromData(data || {});
            writeHotkeyConfig(token);
            refreshBroadcastUi();
            if (broadcastState.enabled) scheduleSolutionUpload();
        }).catch(function () {
            broadcastState.announceEnabled = false;
            broadcastState.enabled = false;
            refreshBroadcastUi();
        });
    }

    function bindBroadcastUi() {
        var toggle = $('wdBroadcastToggle');
        var btn = $('wdBroadcastNow');
        var helperBtn = $('wdHelperExe');
        var helperMenu = $('wdHelperMenu');
        var gear = $('wdBroadcastSettingsBtn');
        var saveBtn = $('wdBroadcastSettingsSave');
        if (toggle) toggle.addEventListener('change', onBroadcastToggleChange);
        if (btn) btn.addEventListener('click', function () { fireBroadcast({ countdown: true }); });
        if (helperBtn) {
            helperBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (helperBtn.disabled) return;
                var menu = $('wdHelperMenu');
                setHelperMenuOpen(!(menu && !menu.hidden));
            });
        }
        if (helperMenu) {
            helperMenu.addEventListener('click', function (ev) {
                var item = ev.target && ev.target.closest ? ev.target.closest('[data-helper]') : null;
                if (!item) return;
                ev.stopPropagation();
                onHelperMenuPick(item.getAttribute('data-helper'));
            });
        }
        document.addEventListener('click', function () {
            setHelperMenuOpen(false);
        });
        if (gear) {
            gear.addEventListener('click', function () {
                setBroadcastSettingsOpen(!broadcastState.settingsOpen);
            });
        }
        if (saveBtn) saveBtn.addEventListener('click', saveBroadcastSpeakPrefs);
        window.addEventListener('keydown', function (ev) {
            if (ev.key !== 'F2' && ev.code !== 'F2') return;
            if (ev.repeat) return;
            if (!broadcastState.enabled) return;
            ev.preventDefault();
            fireBroadcast();
        });
        refreshBroadcastAuth();
        window.addEventListener('storage', function (ev) {
            if (ev.key === AUTH_KEY || ev.key === null) refreshBroadcastAuth();
        });
    }

    function setWeapon(id) {
        state.weapon = id;
        document.querySelectorAll('[data-wd-weapon]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-wd-weapon') === id);
        });
        update();
    }

    function setPlace(id) {
        state.place = id === 'tgt' ? 'tgt' : 'gun';
        document.querySelectorAll('[data-wd-place]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-wd-place') === state.place);
        });
        save();
    }

    /** 缺炮位时默认回到「放置炮位」。 */
    function preferPlaceMode() {
        if (!state.gun && state.place !== 'gun') setPlace('gun');
        else if (!state.gun) {
            document.querySelectorAll('[data-wd-place]').forEach(function (btn) {
                btn.classList.toggle('is-active', btn.getAttribute('data-wd-place') === 'gun');
            });
        }
    }

    function setMap(id) {
        if (!MAPS[id]) return;
        state.map = id;
        document.querySelectorAll('[data-wd-map]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-wd-map') === id);
        });
        save();
        resetView();
    }

    function resetView() {
        var canvas = $('wdCanvas');
        if (canvas) {
            var size = ensureCanvas(canvas);
            fitView(size.w, size.h);
        } else {
            state.view.scale = 0;
        }
        draw();
    }

    function clearPoints() {
        // 清除会删掉点位；已锁的一并解除，避免「炮没了锁还在」
        state.gun = null;
        state.tgt = null;
        state.lockGun = false;
        state.lockTgt = false;
        writeInputs();
        syncLockUi();
        setPlace('gun');
        update();
    }

    function parsePaste(raw) {
        var t = String(raw || '').replace(/，/g, ',').toLowerCase();
        var labeled = t.match(/x\s*[:=]?\s*(-?\d+(?:[.,]\d+)?).*?y\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/);
        if (labeled) return { x: parseNum(labeled[1]), y: parseNum(labeled[2]) };
        var nums = t.match(/-?\d+(?:[.,]\d+)?/g);
        if (nums && nums.length >= 2) return { x: parseNum(nums[0]), y: parseNum(nums[1]) };
        return null;
    }

    window.UssWardogsBallistics = {
        interpolateBallisticTable: interpolateBallisticTable,
        getSolutions: getSolutions,
        WEAPONS: WEAPONS,
        getView: function () {
            return { scale: state.view.scale, ox: state.view.ox, oy: state.view.oy };
        },
        geometryFor: function (gun, tgt) {
            var dx = (tgt.x - gun.x) * METERS_PER_COORD;
            var dy = (tgt.y - gun.y) * METERS_PER_COORD;
            return { dx: dx, dy: dy, dist: Math.hypot(dx, dy) };
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register('wardogs-artillery-sw.js').catch(function () { /* ignore */ });
        }
        load();
        writeInputs();
        syncLockUi();
        setWeapon(state.weapon);
        setPlace(state.place || 'gun');
        preferPlaceMode();
        bindCanvas();
        bindHints();
        bindBroadcastUi();
        loadIcons();
        ['bakurani', 'ozeti'].forEach(function (id) {
            getTile(id, 0, 0, 0);
            var x;
            var y;
            for (x = 0; x < 4; x++) {
                for (y = 0; y < 4; y++) getTile(id, 2, x, y);
            }
        });
        ['wdGunX', 'wdGunY', 'wdTgtX', 'wdTgtY'].forEach(function (id) {
            $(id).addEventListener('input', update);
        });
        document.querySelectorAll('[data-wd-weapon]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setWeapon(btn.getAttribute('data-wd-weapon'));
            });
        });
        document.querySelectorAll('[data-wd-place]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setPlace(btn.getAttribute('data-wd-place'));
            });
        });
        document.querySelectorAll('[data-wd-map]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setMap(btn.getAttribute('data-wd-map'));
            });
        });
        ['wdGunX', 'wdGunY'].forEach(function (id) {
            $(id).addEventListener('focus', function () { setPlace('gun'); });
        });
        ['wdTgtX', 'wdTgtY'].forEach(function (id) {
            $(id).addEventListener('focus', function () { setPlace('tgt'); });
        });
        $('wdClear').addEventListener('click', clearPoints);
        $('wdReset').addEventListener('click', resetView);
        $('wdAddMission').addEventListener('click', addMission);
        document.querySelectorAll('[data-wd-lock]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                toggleLock(btn.getAttribute('data-wd-lock'));
            });
        });
        setMap(state.map || 'bakurani');
        window.addEventListener('resize', draw);
        update();
    });
})();
