/**
 * 货物网格初稿：按舱的长宽高，用大箱子优先铺满，并画成等轴测货舱。
 */
(function (root) {
    var BOX_DIMS = {
        1: { l: 1, w: 1, h: 1 },
        2: { l: 2, w: 1, h: 1 },
        4: { l: 2, w: 2, h: 1 },
        8: { l: 2, w: 2, h: 2 },
        16: { l: 4, w: 2, h: 2 },
        24: { l: 6, w: 2, h: 2 },
        32: { l: 8, w: 2, h: 2 },
    };
    var BOX_ORDER = [32, 24, 16, 8, 4, 2, 1];

    function orientations(scu) {
        var d = BOX_DIMS[scu];
        var axes = [d.l, d.w, d.h];
        var seen = {};
        var out = [];
        var i;
        var j;
        var k;
        for (i = 0; i < 3; i++) {
            for (j = 0; j < 3; j++) {
                if (j === i) continue;
                for (k = 0; k < 3; k++) {
                    if (k === i || k === j) continue;
                    var key = axes[i] + 'x' + axes[j] + 'x' + axes[k];
                    if (seen[key]) continue;
                    seen[key] = true;
                    out.push({ l: axes[i], w: axes[j], h: axes[k] });
                }
            }
        }
        return out;
    }

    function packBay(bay) {
        var w = bay.w;
        var h = bay.h;
        var l = bay.l;
        var occ = [];
        var x;
        var y;
        var z;
        for (x = 0; x < w; x++) {
            occ[x] = [];
            for (y = 0; y < h; y++) {
                occ[x][y] = [];
                for (z = 0; z < l; z++) occ[x][y][z] = false;
            }
        }

        function fits(ox, oy, oz, dim) {
            var dx;
            var dy;
            var dz;
            if (ox + dim.w > w || oy + dim.h > h || oz + dim.l > l) return false;
            for (dx = 0; dx < dim.w; dx++) {
                for (dy = 0; dy < dim.h; dy++) {
                    for (dz = 0; dz < dim.l; dz++) {
                        if (occ[ox + dx][oy + dy][oz + dz]) return false;
                    }
                }
            }
            if (oy > 0) {
                for (dx = 0; dx < dim.w; dx++) {
                    for (dz = 0; dz < dim.l; dz++) {
                        if (!occ[ox + dx][oy - 1][oz + dz]) return false;
                    }
                }
            }
            return true;
        }

        function mark(ox, oy, oz, dim) {
            var dx;
            var dy;
            var dz;
            for (dx = 0; dx < dim.w; dx++) {
                for (dy = 0; dy < dim.h; dy++) {
                    for (dz = 0; dz < dim.l; dz++) occ[ox + dx][oy + dy][oz + dz] = true;
                }
            }
        }

        var placed = [];
        var sizes = BOX_ORDER.filter(function (scu) {
            return scu <= (bay.maxBox || 32);
        });
        var guard = w * h * l + 2;
        var progress = true;
        while (progress && guard-- > 0) {
            progress = false;
            var si;
            for (si = 0; si < sizes.length && !progress; si++) {
                var scu = sizes[si];
                var dims = orientations(scu);
                var yy;
                var zz;
                var xx;
                var di;
                for (yy = 0; yy < h && !progress; yy++) {
                    for (zz = 0; zz < l && !progress; zz++) {
                        for (xx = 0; xx < w && !progress; xx++) {
                            for (di = 0; di < dims.length; di++) {
                                if (!fits(xx, yy, zz, dims[di])) continue;
                                mark(xx, yy, zz, dims[di]);
                                placed.push({
                                    x: xx,
                                    y: yy,
                                    z: zz,
                                    w: dims[di].w,
                                    h: dims[di].h,
                                    l: dims[di].l,
                                    scu: scu,
                                });
                                progress = true;
                            }
                        }
                    }
                }
            }
        }

        var filled = 0;
        placed.forEach(function (box) {
            filled += box.scu;
        });
        return {
            boxes: placed,
            capacity: w * h * l,
            filled: filled,
        };
    }

    function bayCapacity(bay) {
        if (Array.isArray(bay.boxes)) {
            return bay.boxes.reduce(function (sum, box) {
                return sum + box.scu;
            }, 0);
        }
        return bay.w * bay.h * bay.l;
    }

    function shipCapacity(ship) {
        return ship.bays.reduce(function (sum, bay) {
            return sum + bayCapacity(bay);
        }, 0);
    }

    function countBoxes(boxes) {
        var counts = {};
        BOX_ORDER.forEach(function (scu) {
            counts[scu] = 0;
        });
        boxes.forEach(function (box) {
            counts[box.scu] = (counts[box.scu] || 0) + 1;
        });
        return counts;
    }

    var api = {
        BOX_ORDER: BOX_ORDER,
        BOX_DIMS: BOX_DIMS,
        packBay: packBay,
        bayCapacity: bayCapacity,
        shipCapacity: shipCapacity,
        countBoxes: countBoxes,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.CargoGridPack = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    var pack = window.CargoGridPack;
    var ships = window.CARGO_GRID_SHIPS || [];

    function listedScu(ship) {
        if (typeof ship.wikiScu === 'number') return ship.wikiScu;
        return pack.shipCapacity(ship);
    }
    var listEl = document.getElementById('cgShipList');
    var viewEl = document.getElementById('cgView');
    var selectedId = '';
    var listCollapsed = false;
    var rotX = -32;
    var rotY = 42;
    var zoom = 1;
    var panX = 0;
    var panY = 0;
    var panZ = 0;
    var drag = null;
    var scene = null;
    var layoutAnchor = null;

    var SCU_COLOR = {
        1: [0.725, 0.741, 0.741],
        2: [0.659, 0.533, 0.596],
        4: [0.584, 0.518, 0.639],
        8: [0.631, 0.518, 0.506],
        16: [0.518, 0.647, 0.616],
        24: [0.69, 0.682, 0.592],
        32: [0.663, 0.733, 0.8],
    };

    var canvas = document.createElement('canvas');
    canvas.className = 'cg-canvas';
    viewEl.appendChild(canvas);
    var gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
        viewEl.textContent = '当前浏览器无法显示立体货箱';
        return;
    }

    var boxProg = program(
        [
            'attribute vec3 aPos;',
            'attribute vec3 aNormal;',
            'attribute vec2 aUv;',
            'attribute vec2 aFace;',
            'attribute vec3 aColor;',
            'uniform mat4 uMvp;',
            'varying vec3 vN;',
            'varying vec2 vUv;',
            'varying vec2 vFace;',
            'varying vec3 vColor;',
            'void main(){',
            '  vN = aNormal;',
            '  vUv = aUv;',
            '  vFace = aFace;',
            '  vColor = aColor;',
            '  gl_Position = uMvp * vec4(aPos, 1.0);',
            '}',
        ].join('\n'),
        [
            'precision mediump float;',
            'varying vec3 vN;',
            'varying vec2 vUv;',
            'varying vec2 vFace;',
            'varying vec3 vColor;',
            'uniform sampler2D uLabel;',
            'void main(){',
            '  vec3 n = normalize(vN);',
            '  if (!gl_FrontFacing) n = -n;',
            '  float light = 0.82 + 0.18 * max(dot(n, normalize(vec3(0.35, 0.86, 0.32))), 0.0);',
            '  vec3 col = vColor * light;',
            '  vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);',
            '  vec2 centered = (uv - 0.5) * vFace;',
            '  if (abs(centered.x) < 0.36 && abs(centered.y) < 0.36) {',
            '    float a = texture2D(uLabel, centered / 0.72 + 0.5).a;',
            '    col = mix(col, vec3(1.0), a);',
            '  }',
            '  gl_FragColor = vec4(col, 1.0);',
            '}',
        ].join('\n')
    );
    var plaqueProg = program(
        [
            'attribute vec3 aPos;',
            'attribute vec2 aUv;',
            'uniform mat4 uMvp;',
            'varying vec2 vUv;',
            'void main(){',
            '  vUv = aUv;',
            '  gl_Position = uMvp * vec4(aPos, 1.0);',
            '}',
        ].join('\n'),
        [
            'precision mediump float;',
            'varying vec2 vUv;',
            'uniform sampler2D uTex;',
            'void main(){',
            '  vec4 c = texture2D(uTex, vUv);',
            '  if (c.a < 0.05) discard;',
            '  gl_FragColor = c;',
            '}',
        ].join('\n')
    );
    var lineProg = program(
        [
            'attribute vec3 aPos;',
            'uniform mat4 uMvp;',
            'void main(){ gl_Position = uMvp * vec4(aPos, 1.0); }',
        ].join('\n'),
        [
            'precision mediump float;',
            'uniform vec4 uColor;',
            'void main(){ gl_FragColor = uColor; }',
        ].join('\n')
    );
    var labels = {};
    Object.keys(SCU_COLOR).forEach(function (scu) {
        labels[scu] = labelTexture(scu);
    });

    function readHash() {
        return decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
    }

    function makerGroups() {
        var order = [];
        var map = {};
        ships.forEach(function (ship) {
            var key = ship.makerZh || '其他';
            if (!map[key]) {
                map[key] = { zh: key, en: ship.makerEn || '', ships: [] };
                order.push(map[key]);
            }
            map[key].ships.push(ship);
        });
        return order;
    }

    function activeMaker() {
        var i;
        for (i = 0; i < ships.length; i++) {
            if (ships[i].id === selectedId) return ships[i].makerZh || '其他';
        }
        return ships[0] ? ships[0].makerZh || '其他' : '';
    }

    function renderList() {
        var groups = makerGroups();
        var maker = activeMaker();
        listEl.innerHTML = groups
            .map(function (group) {
                var on = group.zh === maker;
                var open = on && !listCollapsed;
                var shipsHtml = '';
                if (open) {
                    shipsHtml =
                        '<div class="cg-ships" role="listbox" aria-label="' +
                        escapeHtml(group.zh) +
                        '">' +
                        group.ships
                            .slice()
                            .sort(function (a, b) {
                                return (a.nameEn || a.nameZh).localeCompare(b.nameEn || b.nameZh, 'en', {
                                    numeric: true,
                                    sensitivity: 'base',
                                });
                            })
                            .map(function (ship) {
                                return (
                                    '<button type="button" class="cg-ship' +
                                    (ship.id === selectedId ? ' is-selected' : '') +
                                    '" role="option" aria-selected="' +
                                    (ship.id === selectedId ? 'true' : 'false') +
                                    '" data-ship="' +
                                    ship.id +
                                    '"><span class="cg-ship-copy"><span class="cg-ship-zh">' +
                                    escapeHtml(shipLabel(ship)) +
                                    '</span><span class="cg-ship-en">' +
                                    escapeHtml(ship.nameEn) +
                                    '</span></span><span class="cg-ship-scu">' +
                                    listedScu(ship) +
                                    '</span></button>'
                                );
                            })
                            .join('') +
                        '</div>';
                }
                return (
                    '<section class="cg-group">' +
                    '<button type="button" class="cg-maker' +
                    (on ? ' is-selected' : '') +
                    '" aria-expanded="' +
                    (open ? 'true' : 'false') +
                    '" data-maker="' +
                    escapeHtml(group.zh) +
                    '"><span class="cg-maker-logo">' +
                    makerLogo(group.zh) +
                    '</span><span class="cg-maker-copy"><span class="cg-maker-name">' +
                    escapeHtml(group.zh) +
                    '</span><span class="cg-maker-en">' +
                    escapeHtml(group.en) +
                    '</span></span><span class="cg-maker-chevron" aria-hidden="true"></span></button>' +
                    shipsHtml +
                    '</section>'
                );
            })
            .join('');
        var selected = listEl.querySelector('.cg-ship.is-selected');
        if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: 'nearest' });
    }

    function makerLogo(name) {
        var file = {
            十字军工业: 'assets/makers/crusader.png',
            德雷克星际: 'assets/makers/drake.png',
            罗伯茨太空工业: 'assets/makers/rsi.png',
            武藏工业与星航: 'assets/makers/musashi.png',
            铁砧航天: 'assets/makers/anvil.png',
            圣盾动力: 'assets/makers/aegis.png',
            起源跃迁: 'assets/makers/origin.png',
            南船座: 'assets/makers/argo.png',
            联合外域: 'assets/makers/cnou.png',
            盖塔克: 'assets/makers/gatac.png',
            埃斯佩里亚: 'assets/makers/esperia.png',
            灰猫工业: 'assets/makers/greycat.png',
            盾博尔: 'assets/makers/tumbril.png',
            格雷黑市: 'assets/makers/grey.png',
        }[name];
        if (!file) return '';
        return '<img src="' + file + '" alt="" decoding="async">';
    }

    function shipLabel(ship) {
        var prefix = {
            德雷克星际: '德雷克',
            十字军工业: '十字军',
            罗伯茨太空工业: 'RSI',
            武藏工业与星航: '武藏',
            铁砧航天: '铁砧',
            圣盾动力: '圣盾',
            起源跃迁: '起源',
            南船座: '南船座',
            联合外域: '联合外域',
            盖塔克: '盖塔克',
            埃斯佩里亚: '埃斯佩里亚',
            灰猫工业: '灰猫',
            盾博尔: '盾博尔',
            格雷黑市: '格雷',
        }[ship.makerZh];
        var zh = ship.nameZh || '';
        if (!prefix || zh.indexOf(prefix) !== 0) return zh;
        var rest = zh.slice(prefix.length).replace(/^[\s·\-]+/, '');
        return rest || zh;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function selectShip(id, pushHash) {
        var ship = ships.filter(function (item) {
            return item.id === id;
        })[0];
        if (!ship) return;
        selectedId = ship.id;
        listCollapsed = false;
        panX = 0;
        panY = 0;
        panZ = 0;
        zoom = 1;
        rotX = -32;
        rotY = 42;
        layoutAnchor = null;
        if (pushHash) {
            if (history.replaceState) history.replaceState(null, '', '#' + ship.id);
            else location.hash = ship.id;
        }
        renderList();
        if (scene && scene.plaqueTex) gl.deleteTexture(scene.plaqueTex);
        scene = buildScene(ship);
        viewEl.setAttribute(
            'aria-label',
            ship.nameZh +
                ' ' +
                ship.nameEn +
                '，左键旋转，中键或 Shift 加左键移动物体，滚轮缩放。手机单指旋转，双指拖动移动，捏合缩放'
        );
        draw();
        if (window.CargoGrid && window.CargoGrid.onShip) window.CargoGrid.onShip(ship);
    }

    function buildScene(ship) {
        var gap = 2;
        var cursor = 0;
        var maxD = 1;
        var maxH = 1;
        var placed = [];
        var highlight = [];
        ship.bays.forEach(function (bay) {
            var result = Array.isArray(bay.boxes) ? { boxes: bay.boxes } : pack.packBay(bay);
            var ox = cursor;
            cursor += bay.w + gap;
            if (bay.l > maxD) maxD = bay.l;
            if (bay.h > maxH) maxH = bay.h;
            result.boxes.forEach(function (box) {
                placed.push({ ox: ox, box: box, bay: bay });
            });
        });
        var totalW = Math.max(1, cursor - gap);
        if (!layoutAnchor) layoutAnchor = { totalW: totalW, maxD: maxD };
        var placeW = layoutAnchor.totalW;
        var placeD = layoutAnchor.maxD;
        var verts = [];
        verts.scu = [];
        var edges = [];
        var counts = {};
        var front = null;
        placed.forEach(function (item) {
            addBox(verts, edges, highlight, item.ox, item.box, placeW, placeD);
            counts[item.box.scu] = (counts[item.box.scu] || 0) + 1;
            var bounds = boxWorld(item.ox, item.box, placeW, placeD);
            if (!front) front = { minX: bounds.min[0], maxX: bounds.max[0], maxZ: bounds.max[2] };
            if (bounds.min[0] < front.minX) front.minX = bounds.min[0];
            if (bounds.max[0] > front.maxX) front.maxX = bounds.max[0];
            if (bounds.max[2] > front.maxZ) front.maxZ = bounds.max[2];
        });
        var plaque = buildPlaque(ship, counts, placeW, placeD, front);
        return {
            boxes: groupBoxes(verts),
            edges: lineBuffer(edges),
            edgeCount: edges.length / 3,
            selEdges: lineBuffer(highlight),
            selEdgeCount: highlight.length / 3,
            hits: placed.map(function (item) {
                var bounds = boxWorld(item.ox, item.box, placeW, placeD);
                return { box: item.box, bay: item.bay, ox: item.ox, min: bounds.min, max: bounds.max };
            }),
            grid: lineBuffer(gridLines(Math.max(placeW, totalW), Math.max(placeD, maxD), placeW, placeD)),
            gridCount: gridLines(Math.max(placeW, totalW), Math.max(placeD, maxD), placeW, placeD).length / 3,
            focusY: maxH / 2,
            totalW: placeW,
            maxD: placeD,
            maxH: maxH,
            span: Math.max(totalW, maxD, maxH, 4),
            plaque: plaque.points,
            plaqueBuf: plaque.buf,
            plaqueTex: plaque.tex,
        };
    }

    function gridCellsForAspect(aspect, limit) {
        var maxCell = Math.max(1, Math.round(limit));
        var target = Math.min(4, maxCell);
        var best = null;
        var w;
        var d;
        for (w = 1; w <= maxCell; w++) {
            for (d = 1; d <= maxCell; d++) {
                var err = Math.abs(w / d - aspect) / aspect;
                var score = err + Math.abs(w - target) * 0.03;
                if (!best || score < best.score) best = { w: w, d: d, score: score };
            }
        }
        return best;
    }

    function measurePlaque(ship, sizes, counts, pad, titleH, enH, rowH, chip) {
        var probe = document.createElement('canvas').getContext('2d');
        probe.font = '700 64px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        var titleW = probe.measureText(ship.nameZh).width;
        probe.font = '600 36px "Segoe UI", "Noto Sans SC", sans-serif';
        var enW = probe.measureText(ship.nameEn).width;
        var rowW = 0;
        sizes.forEach(function (scu) {
            probe.font = '700 42px "Noto Sans SC", "Microsoft YaHei", sans-serif';
            var countW = probe.measureText(counts[scu] + ' 个').width;
            probe.font = '600 42px "Segoe UI", sans-serif';
            var scuW = probe.measureText(scu + ' SCU').width;
            rowW = Math.max(rowW, chip + 18 + countW + 28 + scuW);
        });
        return {
            w: pad * 2 + Math.max(titleW, enW, rowW),
            h: pad + titleH + enH + 12 + sizes.length * rowH + pad,
        };
    }

    function paintPlaque(ctx, ship, sizes, counts, pad, titleH, enH, rowH, chip, ox, oy, fit) {
        function u(value) {
            return value * fit;
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#102033';
        ctx.font = '700 ' + u(64) + 'px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(ship.nameZh, ox + u(pad), oy + u(pad + titleH / 2));
        ctx.fillStyle = '#15608f';
        ctx.font = '600 ' + u(36) + 'px "Segoe UI", "Noto Sans SC", sans-serif';
        ctx.fillText(ship.nameEn, ox + u(pad), oy + u(pad + titleH + enH / 2));
        sizes.forEach(function (scu, index) {
            var y = oy + u(pad + titleH + enH + 12 + index * rowH + rowH / 2);
            var color = SCU_COLOR[scu] || [1, 1, 1];
            ctx.fillStyle = 'rgb(' + Math.round(color[0] * 255) + ',' + Math.round(color[1] * 255) + ',' + Math.round(color[2] * 255) + ')';
            ctx.fillRect(ox + u(pad), y - u(chip / 2), u(chip), u(chip));
            var countLabel = counts[scu] + ' 个';
            ctx.fillStyle = '#102033';
            ctx.font = '700 ' + u(42) + 'px "Noto Sans SC", "Microsoft YaHei", sans-serif';
            var countW = ctx.measureText(countLabel).width;
            ctx.fillText(countLabel, ox + u(pad + chip + 18), y);
            ctx.fillStyle = '#3d5568';
            ctx.font = '600 ' + u(42) + 'px "Segoe UI", sans-serif';
            ctx.fillText(scu + ' SCU', ox + u(pad + chip + 18) + countW + u(28), y);
        });
    }

    function buildPlaque(ship, counts, totalW, maxD, front) {
        var sizes = [32, 24, 16, 8, 4, 2, 1].filter(function (scu) {
            return counts[scu];
        });
        var pad = 36;
        var titleH = 76;
        var enH = 48;
        var rowH = 64;
        var chip = 32;
        var layout = measurePlaque(ship, sizes, counts, pad, titleH, enH, rowH, chip);
        var cells = gridCellsForAspect(layout.w / layout.h, Math.max(totalW, maxD));
        var px = 160;
        var texW = cells.w * px;
        var texH = cells.d * px;
        var el = document.createElement('canvas');
        el.width = texW;
        el.height = texH;
        var ctx = el.getContext('2d');
        ctx.clearRect(0, 0, texW, texH);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(0, 0, texW, texH);
        var fit = Math.min(texW / layout.w, texH / layout.h);
        paintPlaque(ctx, ship, sizes, counts, pad, titleH, enH, rowH, chip, (texW - layout.w * fit) / 2, (texH - layout.h * fit) / 2, fit);
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var x0 = front
            ? Math.round((front.minX + front.maxX - cells.w) / 2)
            : -totalW / 2 + Math.round((totalW - cells.w) / 2);
        var x1 = x0 + cells.w;
        var z0 = front ? front.maxZ + 2 : maxD / 2 + 2;
        var z1 = z0 + cells.d;
        var y = 0.04;
        var data = new Float32Array([
            x0, y, z0, 0, 1,
            x1, y, z0, 1, 1,
            x1, y, z1, 1, 0,
            x0, y, z0, 0, 1,
            x1, y, z1, 1, 0,
            x0, y, z1, 0, 0,
        ]);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return {
            buf: buf,
            tex: tex,
            points: [
                [x0, y, z0],
                [x1, y, z0],
                [x0, y, z1],
                [x1, y, z1],
            ],
        };
    }

    function boxWorld(ox, box, totalW, maxD) {
        var w = box.w;
        var h = box.h;
        var d = box.l;
        var cx = ox + box.x + w / 2 - totalW / 2;
        var cy = box.y + h / 2;
        var cz = box.z + d / 2 - maxD / 2;
        return {
            min: [cx - w / 2, cy - h / 2, cz - d / 2],
            max: [cx + w / 2, cy + h / 2, cz + d / 2],
        };
    }

    function addBox(verts, edges, highlight, ox, box, totalW, maxD) {
        var w = box.w;
        var h = box.h;
        var d = box.l;
        var cx = ox + box.x + w / 2 - totalW / 2;
        var cy = box.y + h / 2;
        var cz = box.z + d / 2 - maxD / 2;
        var color = SCU_COLOR[box.scu] || SCU_COLOR[1];
        if (box._sel) {
            color = [color[0] * 0.25 + 0.72, color[1] * 0.25 + 0.9, color[2] * 0.25 + 1];
        }
        face(verts, [cx, cy + h / 2, cz], [w, 0, 0], [0, 0, d], [0, 1, 0], w, d, color);
        face(verts, [cx, cy - h / 2, cz], [w, 0, 0], [0, 0, -d], [0, -1, 0], w, d, color);
        face(verts, [cx, cy, cz + d / 2], [w, 0, 0], [0, h, 0], [0, 0, 1], w, h, color);
        face(verts, [cx, cy, cz - d / 2], [-w, 0, 0], [0, h, 0], [0, 0, -1], w, h, color);
        face(verts, [cx + w / 2, cy, cz], [0, 0, -d], [0, h, 0], [1, 0, 0], d, h, color);
        face(verts, [cx - w / 2, cy, cz], [0, 0, d], [0, h, 0], [-1, 0, 0], d, h, color);
        var x0 = cx - w / 2;
        var x1 = cx + w / 2;
        var y0 = cy - h / 2;
        var y1 = cy + h / 2;
        var z0 = cz - d / 2;
        var z1 = cz + d / 2;
        var corners = [
            [x0, y0, z0],
            [x1, y0, z0],
            [x1, y1, z0],
            [x0, y1, z0],
            [x0, y0, z1],
            [x1, y0, z1],
            [x1, y1, z1],
            [x0, y1, z1],
        ];
        [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 0],
            [4, 5],
            [5, 6],
            [6, 7],
            [7, 4],
            [0, 4],
            [1, 5],
            [2, 6],
            [3, 7],
        ].forEach(function (pair) {
            edges.push.apply(edges, corners[pair[0]]);
            edges.push.apply(edges, corners[pair[1]]);
            if (box._sel && highlight) {
                var grow = 1.06;
                var a = corners[pair[0]];
                var b = corners[pair[1]];
                highlight.push(
                    cx + (a[0] - cx) * grow,
                    cy + (a[1] - cy) * grow,
                    cz + (a[2] - cz) * grow,
                    cx + (b[0] - cx) * grow,
                    cy + (b[1] - cy) * grow,
                    cz + (b[2] - cz) * grow
                );
            }
        });
        verts.scu = verts.scu || [];
        var count = 36;
        for (var i = 0; i < count; i++) verts.scu.push(box.scu);
    }

    function face(verts, center, u, v, normal, su, sv, color) {
        var p = [0, 1, 2, 3].map(function (i) {
            var suv = i === 1 || i === 2 ? 0.5 : -0.5;
            var svv = i === 2 || i === 3 ? 0.5 : -0.5;
            return [
                center[0] + u[0] * suv + v[0] * svv,
                center[1] + u[1] * suv + v[1] * svv,
                center[2] + u[2] * suv + v[2] * svv,
            ];
        });
        var uv = [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ];
        [0, 1, 2, 0, 2, 3].forEach(function (index) {
            verts.push(
                p[index][0],
                p[index][1],
                p[index][2],
                normal[0],
                normal[1],
                normal[2],
                uv[index][0],
                uv[index][1],
                su,
                sv,
                color[0],
                color[1],
                color[2]
            );
        });
    }

    function groupBoxes(flat) {
        var stride = 13;
        var by = {};
        var i;
        var scus = (flat && flat.scu) || [];
        for (i = 0; i < scus.length; i++) {
            var scu = scus[i];
            if (!by[scu]) by[scu] = [];
            var start = i * stride;
            for (var k = 0; k < stride; k++) by[scu].push(flat[start + k]);
        }
        return Object.keys(by).map(function (scu) {
            var data = new Float32Array(by[scu]);
            var buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            return { scu: scu, buf: buf, count: by[scu].length / stride };
        });
    }

    function gridLines(totalW, maxD, originW, originD) {
        var pad = 28;
        var lines = [];
        var x0 = -(originW == null ? totalW : originW) / 2;
        var z0 = -(originD == null ? maxD : originD) / 2;
        var i;
        for (i = -pad; i <= totalW + pad; i++) {
            lines.push(x0 + i, -0.012, z0 - pad, x0 + i, -0.012, z0 + maxD + pad);
        }
        for (i = -pad; i <= maxD + pad; i++) {
            lines.push(x0 - pad, -0.012, z0 + i, x0 + totalW + pad, -0.012, z0 + i);
        }
        return lines;
    }

    function lineBuffer(lines) {
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
        return buf;
    }

    function cargoCorners() {
        var corners = [];
        if (scene.hits && scene.hits.length) {
            scene.hits.forEach(function (hit) {
                var a = hit.min;
                var b = hit.max;
                corners.push(
                    [a[0], a[1], a[2]],
                    [b[0], a[1], a[2]],
                    [a[0], b[1], a[2]],
                    [b[0], b[1], a[2]],
                    [a[0], a[1], b[2]],
                    [b[0], a[1], b[2]],
                    [a[0], b[1], b[2]],
                    [b[0], b[1], b[2]]
                );
            });
        } else {
            var hx = scene.totalW / 2;
            var hz = scene.maxD / 2;
            var hy = scene.maxH;
            corners = [
                [-hx, 0, -hz],
                [-hx, 0, hz],
                [hx, 0, -hz],
                [hx, 0, hz],
                [-hx, hy, -hz],
                [-hx, hy, hz],
                [hx, hy, -hz],
                [hx, hy, hz],
            ];
        }
        if (scene.plaque) {
            scene.plaque.forEach(function (point) {
                corners.push(point);
            });
        }
        return corners;
    }

    function projectBounds(eye, target, fovY, aspect, corners) {
        var mvp = multiply(perspective(fovY, aspect, 0.08, 400), lookAt(eye, target, [0, 1, 0]));
        var minX = 1;
        var maxX = -1;
        var minY = 1;
        var maxY = -1;
        corners.forEach(function (p) {
            var clipX = mvp[0] * p[0] + mvp[4] * p[1] + mvp[8] * p[2] + mvp[12];
            var clipY = mvp[1] * p[0] + mvp[5] * p[1] + mvp[9] * p[2] + mvp[13];
            var clipW = mvp[3] * p[0] + mvp[7] * p[1] + mvp[11] * p[2] + mvp[15];
            var nx = clipX / clipW;
            var ny = clipY / clipW;
            if (nx < minX) minX = nx;
            if (nx > maxX) maxX = nx;
            if (ny < minY) minY = ny;
            if (ny > maxY) maxY = ny;
        });
        return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
    }

    function ensureOrbit() {
        if (canvas.width < 64 || canvas.height < 64) {
            return scene.orbit || { aspectKey: '0', dist: 24, sx: 0, sy: 0, sz: 0 };
        }
        var aspect = canvas.width / canvas.height;
        var aspectKey = aspect.toFixed(3);
        if (scene.orbit && scene.orbit.aspectKey === aspectKey) return scene.orbit;
        var corners = cargoCorners();
        var cx = 0;
        var cy = 0;
        var cz = 0;
        var i;
        for (i = 0; i < corners.length; i++) {
            cx += corners[i][0];
            cy += corners[i][1];
            cz += corners[i][2];
        }
        cx /= corners.length;
        cy /= corners.length;
        cz /= corners.length;
        var pitch = (32 * Math.PI) / 180;
        var yaw = (42 * Math.PI) / 180;
        var cp = Math.cos(pitch);
        var sp = Math.sin(pitch);
        var sinYaw = Math.sin(yaw);
        var cosYaw = Math.cos(yaw);
        var dir = [cp * sinYaw, sp, cp * cosYaw];
        var xaxis = norm(cross([0, 1, 0], dir));
        var yaxis = cross(dir, xaxis);
        var fovY = (40 * Math.PI) / 180;
        var margin = 0.88;
        var target = [cx, cy, cz];
        function boundsAt(dist, tgt) {
            return projectBounds(
                [tgt[0] + dist * dir[0], tgt[1] + dist * dir[1], tgt[2] + dist * dir[2]],
                tgt,
                fovY,
                aspect,
                corners
            );
        }
        var dist = 40;
        var iter;
        for (iter = 0; iter < 6; iter++) {
            var lo = 1;
            var hi = 400;
            var n;
            for (n = 0; n < 24; n++) {
                var mid = (lo + hi) / 2;
                var trial = boundsAt(mid, target);
                var limit = Math.max(
                    Math.abs(trial.minX),
                    Math.abs(trial.maxX),
                    Math.abs(trial.minY),
                    Math.abs(trial.maxY)
                );
                if (limit > margin) lo = mid;
                else hi = mid;
            }
            dist = (lo + hi) / 2;
            var fitted = boundsAt(dist, target);
            var ndcX = (fitted.minX + fitted.maxX) / 2;
            var ndcY = (fitted.minY + fitted.maxY) / 2;
            var halfH = Math.tan(fovY / 2) * dist;
            var halfW = halfH * aspect;
            target = [
                target[0] + ndcX * halfW * xaxis[0] + ndcY * halfH * yaxis[0],
                target[1] + ndcX * halfW * xaxis[1] + ndcY * halfH * yaxis[1],
                target[2] + ndcX * halfW * xaxis[2] + ndcY * halfH * yaxis[2],
            ];
        }
        scene.orbit = {
            aspectKey: aspectKey,
            dist: dist,
            sx: target[0],
            sy: target[1] - scene.focusY,
            sz: target[2],
        };
        return scene.orbit;
    }

    function camera() {
        var orbit = scene ? ensureOrbit() : { dist: 16, sx: 0, sy: 0, sz: 0 };
        var pitch = (-rotX * Math.PI) / 180;
        var yaw = (rotY * Math.PI) / 180;
        var cp = Math.cos(pitch);
        var sp = Math.sin(pitch);
        var sinYaw = Math.sin(yaw);
        var cosYaw = Math.cos(yaw);
        var focusY = scene ? scene.focusY : 1;
        var dist = orbit.dist / zoom;
        var sx = orbit.sx;
        var sy = orbit.sy;
        var sz = orbit.sz;
        var eye = [
            panX + sx + dist * cp * sinYaw,
            focusY + panY + sy + dist * sp,
            panZ + sz + dist * cp * cosYaw,
        ];
        var target = [panX + sx, focusY + panY + sy, panZ + sz];
        return { eye: eye, target: target, dist: dist };
    }

    function basis(cam) {
        var forward = norm([
            cam.target[0] - cam.eye[0],
            cam.target[1] - cam.eye[1],
            cam.target[2] - cam.eye[2],
        ]);
        var right = norm(cross(forward, [0, 1, 0]));
        var up = norm(cross(right, forward));
        return { right: right, up: up };
    }

    function draw() {
        if (!scene) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var rect = viewEl.getBoundingClientRect();
        var width = Math.max(1, viewEl.clientWidth, rect.width);
        var height = Math.max(1, viewEl.clientHeight, rect.height);
        var pw = Math.round(width * dpr);
        var ph = Math.round(height * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.086, 0.188, 0.282, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        var cam = camera();
        var proj = perspective((40 * Math.PI) / 180, canvas.width / canvas.height, 0.08, 400);
        var view = lookAt(cam.eye, cam.target, [0, 1, 0]);
        var mvp = multiply(proj, view);
        scene.mvp = mvp;

        gl.useProgram(lineProg.program);
        gl.uniformMatrix4fv(lineProg.uMvp, false, mvp);
        gl.uniform4f(lineProg.uColor, 0.73, 0.8, 0.85, 0.28);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        bindLine(scene.grid);
        gl.drawArrays(gl.LINES, 0, scene.gridCount);
        gl.disable(gl.BLEND);

        gl.useProgram(boxProg.program);
        gl.uniformMatrix4fv(boxProg.uMvp, false, mvp);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);
        scene.boxes.forEach(function (group) {
            gl.bindBuffer(gl.ARRAY_BUFFER, group.buf);
            enableBoxAttribs(boxProg);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, labels[group.scu]);
            gl.uniform1i(boxProg.uLabel, 0);
            gl.drawArrays(gl.TRIANGLES, 0, group.count);
        });
        gl.disable(gl.POLYGON_OFFSET_FILL);

        gl.useProgram(lineProg.program);
        gl.uniformMatrix4fv(lineProg.uMvp, false, mvp);
        gl.uniform4f(lineProg.uColor, 1, 1, 1, 1);
        bindLine(scene.edges);
        gl.drawArrays(gl.LINES, 0, scene.edgeCount);
        if (scene.selEdgeCount) {
            gl.disable(gl.DEPTH_TEST);
            gl.uniform4f(lineProg.uColor, 0.62, 0.96, 1, 1);
            bindLine(scene.selEdges);
            gl.drawArrays(gl.LINES, 0, scene.selEdgeCount);
            gl.enable(gl.DEPTH_TEST);
        }

        if (scene.plaqueBuf) {
            gl.useProgram(plaqueProg.program);
            gl.uniformMatrix4fv(plaqueProg.uMvp, false, mvp);
            gl.bindBuffer(gl.ARRAY_BUFFER, scene.plaqueBuf);
            attrib(plaqueProg.aPos, 3, 20, 0);
            attrib(plaqueProg.aUv, 2, 20, 12);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, scene.plaqueTex);
            gl.uniform1i(plaqueProg.uTex, 0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.disable(gl.BLEND);
        }
    }

    function enableBoxAttribs(prog) {
        var stride = 13 * 4;
        attrib(prog.aPos, 3, stride, 0);
        attrib(prog.aNormal, 3, stride, 12);
        attrib(prog.aUv, 2, stride, 24);
        attrib(prog.aFace, 2, stride, 32);
        attrib(prog.aColor, 3, stride, 40);
    }

    function bindLine(buf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        attrib(lineProg.aPos, 3, 0, 0);
    }

    function attrib(loc, size, stride, offset) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    }

    listEl.addEventListener('click', function (event) {
        var makerBtn = event.target.closest('.cg-maker');
        if (makerBtn) {
            var name = makerBtn.getAttribute('data-maker');
            if (name === activeMaker()) {
                listCollapsed = !listCollapsed;
                renderList();
                return;
            }
            listCollapsed = false;
            var i;
            for (i = 0; i < ships.length; i++) {
                if ((ships[i].makerZh || '其他') === name) {
                    selectShip(ships[i].id, true);
                    return;
                }
            }
            return;
        }
        var btn = event.target.closest('.cg-ship');
        if (!btn) return;
        selectShip(btn.getAttribute('data-ship'), true);
    });

    var pointers = new Map();

    function pointerSnapshot(event) {
        return {
            x: event.clientX,
            y: event.clientY,
            button: event.button,
            shiftKey: event.shiftKey,
            pointerType: event.pointerType || 'mouse',
        };
    }

    function beginGesture() {
        var pts = Array.from(pointers.values());
        viewEl.classList.remove('is-drag');
        viewEl.classList.remove('is-pan');
        if (!pts.length) {
            drag = null;
            return;
        }
        var cam = camera();
        var axes = basis(cam);
        var two = pts.length >= 2;
        var mousePan = !two && (pts[0].button === 1 || (pts[0].button === 0 && pts[0].shiftKey));
        var mode = two || mousePan ? 'pan' : 'rotate';
        var a = pts[0];
        var b = pts[1] || a;
        drag = {
            mode: mode,
            two: two,
            ax: a.x,
            ay: a.y,
            bx: b.x,
            by: b.y,
            pinch: Math.hypot(b.x - a.x, b.y - a.y) || 1,
            rotX: rotX,
            rotY: rotY,
            zoom: zoom,
            panX: panX,
            panY: panY,
            panZ: panZ,
            right: axes.right,
            up: axes.up,
            scale: cam.dist / Math.max(1, viewEl.clientHeight),
        };
        viewEl.classList.add(mode === 'pan' ? 'is-pan' : 'is-drag');
    }

    function applyPan(dx, dy) {
        var limit = scene ? scene.span * 1.6 : 12;
        panX = clamp(drag.panX + (-drag.right[0] * dx + drag.up[0] * dy) * drag.scale, limit);
        panY = clamp(drag.panY + (-drag.right[1] * dx + drag.up[1] * dy) * drag.scale, limit);
        panZ = clamp(drag.panZ + (-drag.right[2] * dx + drag.up[2] * dy) * drag.scale, limit);
    }

    viewEl.addEventListener('pointerdown', function (event) {
        if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
        if (event.button === 1) event.preventDefault();
        pointers.set(event.pointerId, pointerSnapshot(event));
        try {
            viewEl.setPointerCapture(event.pointerId);
        } catch (e) {
            /* pointer already gone */
        }
        beginGesture();
    });

    viewEl.addEventListener('pointermove', function (event) {
        if (!pointers.has(event.pointerId) || !drag) return;
        var prev = pointers.get(event.pointerId);
        pointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
            button: prev.button,
            shiftKey: event.shiftKey,
            pointerType: prev.pointerType,
        });
        var pts = Array.from(pointers.values());
        if (drag.two && pts.length >= 2) {
            var a = pts[0];
            var b = pts[1];
            var dx = (a.x + b.x) / 2 - (drag.ax + drag.bx) / 2;
            var dy = (a.y + b.y) / 2 - (drag.ay + drag.by) / 2;
            applyPan(dx, dy);
            var dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            zoom = Math.min(2.8, Math.max(0.45, drag.zoom * (dist / drag.pinch)));
        } else if (drag.mode === 'pan') {
            applyPan(pts[0].x - drag.ax, pts[0].y - drag.ay);
        } else {
            rotY = drag.rotY - (pts[0].x - drag.ax) * 0.45;
            rotX = Math.max(-80, Math.min(80, drag.rotX - (pts[0].y - drag.ay) * 0.35));
        }
        draw();
    });

    viewEl.addEventListener('mousedown', function (event) {
        if (event.button === 1) event.preventDefault();
    });

    function endDrag(event) {
        if (!event || !pointers.has(event.pointerId)) return;
        pointers.delete(event.pointerId);
        try {
            viewEl.releasePointerCapture(event.pointerId);
        } catch (e) {
            /* already released */
        }
        beginGesture();
    }

    viewEl.addEventListener('pointerup', endDrag);
    viewEl.addEventListener('pointercancel', endDrag);

    viewEl.addEventListener(
        'wheel',
        function (event) {
            event.preventDefault();
            zoom = Math.min(2.8, Math.max(0.45, zoom * (event.deltaY > 0 ? 0.92 : 1.08)));
            draw();
        },
        { passive: false }
    );

    viewEl.addEventListener('keydown', function (event) {
        var step = event.shiftKey ? 8 : 4;
        if (event.shiftKey) {
            var axes = basis(camera());
            var dir = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
            var lift = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
            if (!dir && !lift) return;
            panX += -axes.right[0] * dir * 0.35 + axes.up[0] * lift * 0.35;
            panY += -axes.right[1] * dir * 0.35 + axes.up[1] * lift * 0.35;
            panZ += -axes.right[2] * dir * 0.35 + axes.up[2] * lift * 0.35;
        } else if (event.key === 'ArrowLeft') rotY += step;
        else if (event.key === 'ArrowRight') rotY -= step;
        else if (event.key === 'ArrowUp') rotX = Math.min(80, rotX + step);
        else if (event.key === 'ArrowDown') rotX = Math.max(-80, rotX - step);
        else return;
        event.preventDefault();
        draw();
    });

    if (window.ResizeObserver) new ResizeObserver(draw).observe(viewEl);
    else window.addEventListener('resize', draw);

    var initial = readHash();
    var start = ships.filter(function (ship) {
        return ship.id === initial;
    })[0];
    selectShip(start ? start.id : ships[0] ? ships[0].id : '', false);

    function clamp(value, limit) {
        return Math.max(-limit, Math.min(limit, value));
    }

    function cross(a, b) {
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }

    function norm(v) {
        var len = Math.hypot(v[0], v[1], v[2]) || 1;
        return [v[0] / len, v[1] / len, v[2] / len];
    }

    function perspective(fovy, aspect, near, far) {
        var f = 1 / Math.tan(fovy / 2);
        var nf = 1 / (near - far);
        return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    }

    function lookAt(eye, center, up) {
        var z = norm([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
        var x = norm(cross(up, z));
        var y = cross(z, x);
        return [
            x[0], y[0], z[0], 0,
            x[1], y[1], z[1], 0,
            x[2], y[2], z[2], 0,
            -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
            -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
            -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
            1,
        ];
    }

    function multiply(a, b) {
        var out = new Float32Array(16);
        var c;
        var r;
        for (c = 0; c < 4; c++) {
            for (r = 0; r < 4; r++) {
                out[c * 4 + r] =
                    a[r] * b[c * 4] +
                    a[4 + r] * b[c * 4 + 1] +
                    a[8 + r] * b[c * 4 + 2] +
                    a[12 + r] * b[c * 4 + 3];
            }
        }
        return out;
    }

    function program(vs, fs) {
        var prog = gl.createProgram();
        gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        return {
            program: prog,
            aPos: gl.getAttribLocation(prog, 'aPos'),
            aNormal: gl.getAttribLocation(prog, 'aNormal'),
            aUv: gl.getAttribLocation(prog, 'aUv'),
            aFace: gl.getAttribLocation(prog, 'aFace'),
            aColor: gl.getAttribLocation(prog, 'aColor'),
            uMvp: gl.getUniformLocation(prog, 'uMvp'),
            uColor: gl.getUniformLocation(prog, 'uColor'),
            uLabel: gl.getUniformLocation(prog, 'uLabel'),
            uTex: gl.getUniformLocation(prog, 'uTex'),
        };
    }

    function shader(type, source) {
        var sh = gl.createShader(type);
        gl.shaderSource(sh, source);
        gl.compileShader(sh);
        return sh;
    }

    function labelTexture(text) {
        var el = document.createElement('canvas');
        el.width = 256;
        el.height = 256;
        var ctx = el.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 148px Segoe UI, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(text), 128, 136);
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    function invertMat(m) {
        var a = m;
        var out = new Float32Array(16);
        var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        var b00 = a00 * a11 - a01 * a10;
        var b01 = a00 * a12 - a02 * a10;
        var b02 = a00 * a13 - a03 * a10;
        var b03 = a01 * a12 - a02 * a11;
        var b04 = a01 * a13 - a03 * a11;
        var b05 = a02 * a13 - a03 * a12;
        var b06 = a20 * a31 - a21 * a30;
        var b07 = a20 * a32 - a22 * a30;
        var b08 = a20 * a33 - a23 * a30;
        var b09 = a21 * a32 - a22 * a31;
        var b10 = a21 * a33 - a23 * a31;
        var b11 = a22 * a33 - a23 * a32;
        var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (!det) return null;
        det = 1 / det;
        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
        return out;
    }

    function mulVec(m, v) {
        var x = v[0], y = v[1], z = v[2], w = v[3];
        var r = [
            m[0] * x + m[4] * y + m[8] * z + m[12] * w,
            m[1] * x + m[5] * y + m[9] * z + m[13] * w,
            m[2] * x + m[6] * y + m[10] * z + m[14] * w,
            m[3] * x + m[7] * y + m[11] * z + m[15] * w,
        ];
        return r;
    }

    function pointerRay(clientX, clientY) {
        if (!scene || !scene.mvp) return null;
        var rect = canvas.getBoundingClientRect();
        var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
        var ny = 1 - ((clientY - rect.top) / rect.height) * 2;
        var inv = invertMat(scene.mvp);
        if (!inv) return null;
        function unproject(z) {
            var p = mulVec(inv, [nx, ny, z, 1]);
            var w = p[3] || 1;
            return [p[0] / w, p[1] / w, p[2] / w];
        }
        var a = unproject(-1);
        var b = unproject(1);
        var dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        var len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
        return { origin: a, dir: [dir[0] / len, dir[1] / len, dir[2] / len] };
    }

    function rayAabb(origin, dir, min, max) {
        var tMin = -Infinity;
        var tMax = Infinity;
        var i;
        for (i = 0; i < 3; i++) {
            if (Math.abs(dir[i]) < 1e-8) {
                if (origin[i] < min[i] || origin[i] > max[i]) return null;
                continue;
            }
            var t1 = (min[i] - origin[i]) / dir[i];
            var t2 = (max[i] - origin[i]) / dir[i];
            if (t1 > t2) {
                var swap = t1;
                t1 = t2;
                t2 = swap;
            }
            if (t1 > tMin) tMin = t1;
            if (t2 < tMax) tMax = t2;
            if (tMax < tMin) return null;
        }
        var t = tMin >= 0 ? tMin : tMax;
        if (t < 0) return null;
        return t;
    }

    function currentShip() {
        var i;
        for (i = 0; i < ships.length; i++) {
            if (ships[i].id === selectedId) return ships[i];
        }
        return null;
    }

    window.CargoGrid = {
        viewEl: viewEl,
        colors: SCU_COLOR,
        dims: pack.BOX_DIMS,
        onShip: null,
        current: currentShip,
        ships: function () {
            return ships;
        },
        select: function (id) {
            selectShip(id, true);
        },
        frame: function () {
            if (!scene) return null;
            return { totalW: scene.totalW, maxD: scene.maxD };
        },
        growAnchor: function (shiftX, shiftZ) {
            if (!layoutAnchor) return;
            layoutAnchor.totalW += shiftX * 2;
            layoutAnchor.maxD += shiftZ * 2;
        },
        resetAnchor: function () {
            layoutAnchor = null;
        },
        refresh: function (refit) {
            var ship = currentShip();
            renderList();
            if (!ship) return;
            var orbit = !refit && scene && scene.orbit;
            if (scene && scene.plaqueTex) gl.deleteTexture(scene.plaqueTex);
            scene = buildScene(ship);
            if (orbit) scene.orbit = orbit;
            draw();
        },
        materialize: function (ship) {
            var changed = false;
            ship.bays.forEach(function (bay) {
                if (Array.isArray(bay.boxes)) return;
                bay.boxes = pack.packBay(bay).boxes.map(function (box) {
                    return { x: box.x, y: box.y, z: box.z, w: box.w, h: box.h, l: box.l, scu: box.scu };
                });
                changed = true;
            });
            return changed;
        },
        ray: pointerRay,
        pick: function (clientX, clientY) {
            var ray = pointerRay(clientX, clientY);
            if (!ray || !scene || !scene.hits) return null;
            var best = null;
            var bestT = Infinity;
            scene.hits.forEach(function (hit) {
                var t = rayAabb(ray.origin, ray.dir, hit.min, hit.max);
                if (t != null && t < bestT) {
                    bestT = t;
                    best = hit;
                }
            });
            if (!best) return null;
            return {
                box: best.box,
                bay: best.bay,
                ox: best.ox,
                point: [
                    ray.origin[0] + ray.dir[0] * bestT,
                    ray.origin[1] + ray.dir[1] * bestT,
                    ray.origin[2] + ray.dir[2] * bestT,
                ],
            };
        },
        ground: function (clientX, clientY, planeY) {
            var ray = pointerRay(clientX, clientY);
            if (!ray || Math.abs(ray.dir[1]) < 1e-6) return null;
            var t = (planeY - ray.origin[1]) / ray.dir[1];
            if (t < 0) return null;
            return [
                ray.origin[0] + ray.dir[0] * t,
                planeY,
                ray.origin[2] + ray.dir[2] * t,
            ];
        },
        project: function (world) {
            if (!scene || !scene.mvp) return null;
            var p = mulVec(scene.mvp, [world[0], world[1], world[2], 1]);
            if (!p[3]) return null;
            var rect = canvas.getBoundingClientRect();
            var nx = p[0] / p[3];
            var ny = p[1] / p[3];
            return [
                (nx * 0.5 + 0.5) * rect.width + rect.left,
                (1 - (ny * 0.5 + 0.5)) * rect.height + rect.top,
            ];
        },
        toLocal: function (world, ox) {
            if (!scene) return null;
            return [world[0] - ox + scene.totalW / 2, world[1], world[2] + scene.maxD / 2];
        },
    };
})();
