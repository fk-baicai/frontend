/**
 * 货舱布局。所有人都可以摆，只有超级管理员可以保存。
 * 未开布局：左键旋转，Shift 或中键平移，滚轮缩放。
 * 开启布局：左键拖动框选。按住 Alt 拖动旋转视角，中键平移。按住 Shift 框选时，未选中的加选，已选中的减选。
 */
(function () {
    var api = window.CargoGrid;
    var view = document.getElementById('cgView');
    if (!api || !view) return;

    var SIZES = [1, 2, 4, 8, 16, 24, 32];
    var tool = 'select';
    var placeScu = 0;
    var selected = [];
    var clipboard = null;
    var pasteN = 0;
    var undo = [];
    var enabled = false;
    var canSave = false;
    var panelOpen = false;
    var defaults = {};
    var keys = {};
    var gesture = null;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'cgEditorToggle';
    toggle.className = 'cg-editor-toggle';
    toggle.textContent = '布局';
    toggle.hidden = true;
    toggle.setAttribute('aria-pressed', 'false');
    view.appendChild(toggle);

    var root = document.createElement('div');
    root.id = 'cgEditor';
    root.className = 'cg-editor';
    root.hidden = true;
    root.innerHTML =
        '<div class="cg-editor-tools" role="toolbar" aria-label="布局工具">' +
        '<button type="button" data-tool="select" class="is-on">选择</button>' +
        '<button type="button" data-tool="move">移动</button>' +
        '<button type="button" data-tool="rotate">旋转</button>' +
        '<button type="button" data-act="delete">删除</button>' +
        '<button type="button" data-act="copy">复制</button>' +
        '<button type="button" data-act="paste">粘贴</button>' +
        '<button type="button" data-act="undo">撤销</button>' +
        '<button type="button" data-act="restore">恢复默认</button>' +
        '<button type="button" data-act="save" hidden>保存</button>' +
        '<button type="button" data-act="add" hidden>添加飞船</button>' +
        '<span class="cg-editor-readout" id="cgEditorReadout"></span>' +
        '</div>' +
        '<div class="cg-legend" id="cgLegend" aria-label="SCU 图例"></div>' +
        '<p class="cg-editor-hint">左键拖动框选。按住 Alt 拖动旋转视角，中键平移。按住 Shift 再框选：没选中的加选，已选中的减选。移动箱子时拖已选中的箱子。Ctrl+C 复制，Ctrl+V 粘贴。恢复默认回到这艘船原来的摆法。保存仅超级管理员可用。方向键走 1 格，PageUp / PageDown 改高度。按 R 把选中的箱子转 90 度。</p>' +
        '<form class="cg-editor-add" id="cgEditorAdd" hidden>' +
        '<label>中文名<input name="nameZh" required></label>' +
        '<label>英文名<input name="nameEn" required></label>' +
        '<label>船厂<input name="makerZh" required></label>' +
        '<label>船厂英文<input name="makerEn" required></label>' +
        '<button type="submit">加入并读取 Wiki</button>' +
        '</form>';
    view.appendChild(root);

    var marquee = document.createElement('div');
    marquee.className = 'cg-marquee';
    marquee.hidden = true;
    view.appendChild(marquee);

    var legend = root.querySelector('#cgLegend');
    SIZES.forEach(function (scu) {
        var color = api.colors[scu];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cg-legend-item';
        btn.dataset.scu = String(scu);
        btn.innerHTML = '<i></i><span>' + scu + ' SCU</span>';
        btn.querySelector('i').style.background =
            'rgb(' + Math.round(color[0] * 255) + ',' + Math.round(color[1] * 255) + ',' + Math.round(color[2] * 255) + ')';
        btn.title = '放下 ' + scu + ' SCU';
        legend.appendChild(btn);
    });

    function session() {
        try {
            var raw = sessionStorage.getItem('ussHangzhouAuthSession') || localStorage.getItem('ussHangzhouAuthSession');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function setPanel(open, keepTool) {
        panelOpen = !!open;
        root.hidden = !panelOpen;
        toggle.classList.toggle('is-on', panelOpen);
        toggle.setAttribute('aria-pressed', panelOpen ? 'true' : 'false');
        if (panelOpen && !keepTool) setTool('move');
        if (panelOpen) refreshReadout();
    }

    function setEnabled(on) {
        enabled = on;
        toggle.hidden = !on;
        if (!on) {
            panelOpen = false;
            root.hidden = true;
            toggle.classList.remove('is-on');
            clearSelection();
        }
    }

    function rememberDefault(current) {
        if (!current) return;
        defaults[current.id] = JSON.stringify(current.bays);
    }

    function applyAdmin() {
        var sess = session();
        canSave = !!(sess && sess.token && sess.isSuperAdmin);
        var saveBtn = root.querySelector('[data-act="save"]');
        var addBtn = root.querySelector('[data-act="add"]');
        if (saveBtn) saveBtn.hidden = !canSave;
        if (addBtn) addBtn.hidden = !canSave;
        if (!canSave) document.getElementById('cgEditorAdd').hidden = true;
    }

    function boot() {
        api.ships().forEach(function (item) {
            if (!defaults[item.id]) rememberDefault(item);
        });
        setEnabled(true);
        applyAdmin();
        refreshReadout();
    }

    function ship() {
        return api.current();
    }

    function restoreDefault() {
        var current = ship();
        var saved = current && defaults[current.id];
        if (!saved) return;
        current.bays = JSON.parse(saved);
        selected = [];
        undo = [];
        if (api.resetAnchor) api.resetAnchor();
        paintSelection();
        api.refresh(true);
        var el = document.getElementById('cgEditorReadout');
        if (el) el.textContent = '已恢复默认。' + el.textContent;
    }

    function snapshot() {
        var current = ship();
        if (!current) return;
        undo.push(JSON.stringify(current.bays));
        if (undo.length > 40) undo.shift();
    }

    function placedScu(current) {
        var pack = window.CargoGridPack;
        return current.bays.reduce(function (sum, bay) {
            var boxes = Array.isArray(bay.boxes) ? bay.boxes : pack ? pack.packBay(bay).boxes : [];
            return sum + boxes.reduce(function (inner, box) { return inner + box.scu; }, 0);
        }, 0);
    }

    function refreshReadout() {
        var current = ship();
        var el = document.getElementById('cgEditorReadout');
        if (!current || !el) return;
        var placed = placedScu(current);
        var wiki = typeof current.wikiScu === 'number' ? current.wikiScu : '…';
        var mark = typeof current.wikiScu === 'number' && current.wikiScu !== placed ? ' is-short' : '';
        el.className = 'cg-editor-readout' + mark;
        el.textContent = 'Wiki ' + wiki + ' / 已摆 ' + placed + (selected.length ? ' / 选中 ' + selected.length : '');
    }

    function paintSelection() {
        var current = ship();
        if (!current) return;
        current.bays.forEach(function (bay) {
            (bay.boxes || []).forEach(function (box) {
                box._sel = selected.indexOf(box) !== -1;
            });
        });
        api.refresh();
        refreshReadout();
    }

    function clearSelection() {
        selected = [];
        if (enabled) paintSelection();
    }

    function setTool(next) {
        tool = next;
        placeScu = 0;
        legend.querySelectorAll('.cg-legend-item').forEach(function (btn) {
            btn.classList.remove('is-on');
        });
        root.querySelectorAll('[data-tool]').forEach(function (btn) {
            btn.classList.toggle('is-on', btn.getAttribute('data-tool') === tool);
        });
        view.classList.toggle('is-place', false);
        view.classList.toggle('is-select', tool === 'select');
    }

    function ensureBoxes() {
        var current = ship();
        if (!current) return false;
        var needs = current.bays.some(function (bay) { return !Array.isArray(bay.boxes); });
        if (!needs) return false;
        snapshot();
        api.materialize(current);
        api.refresh();
        return true;
    }

    function fitBay(bay) {
        var maxX = 1;
        var maxY = 1;
        var maxZ = 1;
        bay.boxes.forEach(function (box) {
            maxX = Math.max(maxX, box.x + box.w);
            maxY = Math.max(maxY, box.y + box.h);
            maxZ = Math.max(maxZ, box.z + box.l);
        });
        bay.w = maxX;
        bay.h = maxY;
        bay.l = maxZ;
    }

    function settleMove() {
        var current = ship();
        if (!current) return;
        var minX = 0;
        var minY = 0;
        var minZ = 0;
        current.bays.forEach(function (bay) {
            (bay.boxes || []).forEach(function (box) {
                if (box.x < minX) minX = box.x;
                if (box.y < minY) minY = box.y;
                if (box.z < minZ) minZ = box.z;
            });
        });
        var shiftX = minX < 0 ? -minX : 0;
        var shiftY = minY < 0 ? -minY : 0;
        var shiftZ = minZ < 0 ? -minZ : 0;
        if (shiftX || shiftY || shiftZ) {
            current.bays.forEach(function (bay) {
                (bay.boxes || []).forEach(function (box) {
                    box.x += shiftX;
                    box.y += shiftY;
                    box.z += shiftZ;
                });
            });
            if (api.growAnchor) api.growAnchor(shiftX, shiftZ);
        }
        current.bays.forEach(fitBay);
    }

    function activeBay() {
        var current = ship();
        if (!current || !current.bays.length) return null;
        var found = current.bays[0];
        if (selected[0]) {
            current.bays.forEach(function (bay) {
                if (bay.boxes && bay.boxes.indexOf(selected[0]) !== -1) found = bay;
            });
        }
        return found;
    }

    function copySelection() {
        if (!selected.length) return;
        clipboard = selected.map(function (box) {
            return { x: box.x, y: box.y, z: box.z, w: box.w, h: box.h, l: box.l, scu: box.scu };
        });
        pasteN = 0;
        var el = document.getElementById('cgEditorReadout');
        if (el) el.textContent = '已复制 ' + clipboard.length + ' 个。' + el.textContent;
    }

    function pasteSelection() {
        var bay = activeBay();
        if (!clipboard || !clipboard.length || !bay) return;
        ensureBoxes();
        bay = activeBay();
        if (!bay) return;
        if (!Array.isArray(bay.boxes)) bay.boxes = [];
        snapshot();
        pasteN += 1;
        var copies = clipboard.map(function (box) {
            return {
                x: box.x + pasteN,
                y: box.y,
                z: box.z,
                w: box.w,
                h: box.h,
                l: box.l,
                scu: box.scu,
            };
        });
        copies.forEach(function (box) { bay.boxes.push(box); });
        selected = copies;
        settleMove();
        paintSelection();
        var el = document.getElementById('cgEditorReadout');
        if (el) el.textContent = '已粘贴 ' + copies.length + ' 个。' + el.textContent;
    }

    function selectionOverlaps() {
        var current = ship();
        if (!current) return false;
        return current.bays.some(function (bay) {
            return (bay.boxes || []).some(function (box, index) {
                return bay.boxes.slice(index + 1).some(function (other) {
                    return box.x < other.x + other.w && other.x < box.x + box.w &&
                        box.y < other.y + other.h && other.y < box.y + box.h &&
                        box.z < other.z + other.l && other.z < box.z + box.l;
                });
            });
        });
    }

    function nudge(dx, dy, dz) {
        if (!selected.length) return;
        snapshot();
        selected.forEach(function (box) {
            box.x += dx;
            box.y += dy;
            box.z += dz;
        });
        var bays = [];
        selected.forEach(function (box) {
            ship().bays.forEach(function (bay) {
                if (bay.boxes && bay.boxes.indexOf(box) !== -1 && bays.indexOf(bay) === -1) bays.push(bay);
            });
        });
        settleMove();
        paintSelection();
        if (selectionOverlaps()) refreshReadout();
    }

    function rotateSelection() {
        if (selected.length < 1) return;
        snapshot();
        var minX = Infinity;
        var maxX = -Infinity;
        var minZ = Infinity;
        var maxZ = -Infinity;
        selected.forEach(function (box) {
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.w);
            minZ = Math.min(minZ, box.z);
            maxZ = Math.max(maxZ, box.z + box.l);
        });
        var cx = (minX + maxX) / 2;
        var cz = (minZ + maxZ) / 2;
        selected.forEach(function (box) {
            var pcx = box.x + box.w / 2;
            var pcz = box.z + box.l / 2;
            var ndx = -(pcz - cz);
            var ndz = pcx - cx;
            var nextW = box.l;
            var nextL = box.w;
            box.w = nextW;
            box.l = nextL;
            box.x = Math.round(cx + ndx - box.w / 2);
            box.z = Math.round(cz + ndz - box.l / 2);
        });
        var shiftX = 0;
        var shiftZ = 0;
        selected.forEach(function (box) {
            shiftX = Math.min(shiftX, box.x);
            shiftZ = Math.min(shiftZ, box.z);
        });
        if (shiftX < 0 || shiftZ < 0) {
            selected.forEach(function (box) {
                box.x -= Math.min(0, shiftX);
                box.z -= Math.min(0, shiftZ);
            });
        }
        ship().bays.forEach(fitBay);
        paintSelection();
    }

    function removeSelected() {
        if (!selected.length) return;
        snapshot();
        var drop = selected.slice();
        ship().bays.forEach(function (bay) {
            if (!Array.isArray(bay.boxes)) return;
            bay.boxes = bay.boxes.filter(function (box) { return drop.indexOf(box) === -1; });
            if (bay.boxes.length) fitBay(bay);
        });
        selected = [];
        paintSelection();
    }

    function placeAt(clientX, clientY) {
        var current = ship();
        if (!current || !placeScu) return;
        ensureBoxes();
        var dim = api.dims[placeScu];
        var hit = api.pick(clientX, clientY);
        var bay = hit ? hit.bay : current.bays[0];
        var planeY = hit ? hit.box.y + hit.box.h : 0;
        var world = hit ? null : api.ground(clientX, clientY, 0);
        if (hit) {
            world = hit.point;
            planeY = hit.box.y + hit.box.h;
        }
        if (!world && !hit) return;
        var local = api.toLocal(world || hit.point, hit ? hit.ox : 0);
        if (!local) return;
        snapshot();
        var box = {
            x: Math.max(0, Math.floor(local[0])),
            y: planeY,
            z: Math.max(0, Math.floor(local[2])),
            w: dim.w,
            h: dim.h,
            l: dim.l,
            scu: placeScu,
        };
        if (!Array.isArray(bay.boxes)) bay.boxes = [];
        bay.boxes.push(box);
        fitBay(bay);
        selected = [box];
        paintSelection();
    }

    function boxesInRect(x0, y0, x1, y1) {
        var current = ship();
        var found = [];
        if (!current || !api.project) return found;
        var left = Math.min(x0, x1);
        var right = Math.max(x0, x1);
        var top = Math.min(y0, y1);
        var bottom = Math.max(y0, y1);
        var sceneHits = [];
        current.bays.forEach(function (bay) {
            (bay.boxes || []).forEach(function (box) {
                sceneHits.push(box);
            });
        });
        sceneHits.forEach(function (box) {
            var probe = boxScreenRect(box);
            if (!probe) return;
            if (probe.right < left || probe.left > right || probe.bottom < top || probe.top > bottom) return;
            found.push(box);
        });
        return found;
    }

    function boxScreenRect(box) {
        var current = ship();
        var frame = api.frame && api.frame();
        if (!current || !api.project || !frame) return null;
        var maxD = frame.maxD;
        var totalW = frame.totalW;
        var ox = 0;
        var owner = null;
        current.bays.forEach(function (bay) {
            if (bay.boxes && bay.boxes.indexOf(box) !== -1) owner = ox;
            ox += bay.w + 2;
        });
        if (owner == null) return null;
        var x0 = owner + box.x - totalW / 2;
        var x1 = x0 + box.w;
        var y0 = box.y;
        var y1 = y0 + box.h;
        var z0 = box.z - maxD / 2;
        var z1 = z0 + box.l;
        var corners = [
            [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
            [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
        ];
        var left = Infinity;
        var right = -Infinity;
        var top = Infinity;
        var bottom = -Infinity;
        var seen = 0;
        corners.forEach(function (corner) {
            var probe = api.project(corner);
            if (!probe) return;
            seen += 1;
            if (probe[0] < left) left = probe[0];
            if (probe[0] > right) right = probe[0];
            if (probe[1] < top) top = probe[1];
            if (probe[1] > bottom) bottom = probe[1];
        });
        if (!seen) return null;
        return { left: left, right: right, top: top, bottom: bottom };
    }

    function applyMarquee(mode) {
        if (!gesture) return;
        var found = boxesInRect(gesture.x, gesture.y, gesture.cx, gesture.cy);
        if (mode === 'toggle') {
            found.forEach(function (box) {
                var index = selected.indexOf(box);
                if (index === -1) selected.push(box);
                else selected.splice(index, 1);
            });
        } else {
            selected = found.slice();
        }
        paintSelection();
    }

    function viewZoom() {
        var main = view.closest('.cg-main');
        if (!main) return 1;
        var parsed = parseFloat(window.getComputedStyle(main).zoom);
        return parsed || 1;
    }

    function placeMarquee() {
        var rect = view.getBoundingClientRect();
        var zoom = viewZoom();
        marquee.style.left = (Math.min(gesture.x, gesture.cx) - rect.left) / zoom + 'px';
        marquee.style.top = (Math.min(gesture.y, gesture.cy) - rect.top) / zoom + 'px';
        marquee.style.width = Math.abs(gesture.cx - gesture.x) / zoom + 'px';
        marquee.style.height = Math.abs(gesture.cy - gesture.y) / zoom + 'px';
    }

    function onPointerDown(event) {
        if (!enabled || !panelOpen || event.button !== 0) return;
        if (event.target.closest && event.target.closest('.cg-editor, .cg-editor-toggle')) return;
        if (event.altKey) {
            event.preventDefault();
            return;
        }
        event.stopImmediatePropagation();
        if (placeScu && !event.shiftKey) {
            placeAt(event.clientX, event.clientY);
            return;
        }
        ensureBoxes();
        var hit = api.pick(event.clientX, event.clientY);
        if (event.shiftKey) {
            gesture = {
                kind: 'toggle',
                x: event.clientX,
                y: event.clientY,
                cx: event.clientX,
                cy: event.clientY,
                hit: hit ? hit.box : null,
            };
            marquee.hidden = false;
            placeMarquee();
            return;
        }
        if (hit && tool === 'move' && selected.indexOf(hit.box) !== -1) {
            var local = api.toLocal(hit.point, hit.ox);
            gesture = {
                kind: 'move',
                x: event.clientX,
                y: event.clientY,
                ox: hit.ox,
                lx: local ? local[0] : 0,
                lz: local ? local[2] : 0,
                start: selected.map(function (box) { return { box: box, x: box.x, y: box.y, z: box.z }; }),
                snapped: false,
            };
            snapshot();
            return;
        }
        gesture = {
            kind: 'replace',
            x: event.clientX,
            y: event.clientY,
            cx: event.clientX,
            cy: event.clientY,
            hit: hit ? hit.box : null,
        };
        marquee.hidden = false;
        placeMarquee();
    }

    function onPointerMove(event) {
        if (!gesture) return;
        if (gesture.kind === 'move') {
            var world = api.ground(event.clientX, event.clientY, gesture.start[0].y);
            var local = world ? api.toLocal(world, gesture.ox || 0) : null;
            if (!local) return;
            var dx = Math.round(local[0] - gesture.lx);
            var dz = Math.round(local[2] - gesture.lz);
            var dy = 0;
            if (keys.y || keys.Y) {
                dy = Math.round((gesture.y - event.clientY) / 24);
                dx = 0;
                dz = 0;
            } else if (keys.x || keys.X) dz = 0;
            else if (keys.z || keys.Z) dx = 0;
            gesture.start.forEach(function (item) {
                item.box.x = item.x + dx;
                item.box.y = item.y + dy;
                item.box.z = item.z + dz;
            });
            api.refresh();
            refreshReadout();
            return;
        }
        gesture.cx = event.clientX;
        gesture.cy = event.clientY;
        placeMarquee();
    }

    function onPointerUp() {
        if (!gesture) return;
        var dragged = Math.hypot(gesture.cx - gesture.x, gesture.cy - gesture.y);
        if (dragged < 4 && gesture.hit && (gesture.kind === 'toggle' || gesture.kind === 'replace')) {
            if (gesture.kind === 'toggle') {
                var index = selected.indexOf(gesture.hit);
                if (index === -1) selected.push(gesture.hit);
                else selected.splice(index, 1);
            } else {
                selected = [gesture.hit];
            }
            paintSelection();
            if (gesture.kind === 'replace' && tool === 'rotate') rotateSelection();
        } else if (gesture.kind === 'toggle' || gesture.kind === 'replace') applyMarquee(gesture.kind);
        if (gesture.kind === 'move') {
            settleMove();
            paintSelection();
        }
        gesture = null;
        marquee.hidden = true;
    }

    toggle.addEventListener('pointerdown', function (event) {
        event.stopPropagation();
    });
    toggle.addEventListener('click', function () {
        setPanel(!panelOpen);
    });

    root.addEventListener('pointerdown', function (event) {
        event.stopPropagation();
    });

    root.addEventListener('click', function (event) {
        var toolBtn = event.target.closest('[data-tool]');
        if (toolBtn) {
            setTool(toolBtn.getAttribute('data-tool'));
            return;
        }
        var legendBtn = event.target.closest('.cg-legend-item');
        if (legendBtn) {
            var scu = Number(legendBtn.dataset.scu);
            placeScu = placeScu === scu ? 0 : scu;
            legend.querySelectorAll('.cg-legend-item').forEach(function (btn) {
                btn.classList.toggle('is-on', Number(btn.dataset.scu) === placeScu);
            });
            root.querySelectorAll('[data-tool]').forEach(function (btn) {
                btn.classList.remove('is-on');
            });
            tool = placeScu ? 'place' : 'select';
            if (!placeScu) setTool('select');
            view.classList.toggle('is-place', !!placeScu);
            view.classList.toggle('is-select', !placeScu);
            return;
        }
        var act = event.target.closest('[data-act]');
        if (!act) return;
        var name = act.getAttribute('data-act');
        if (name === 'delete') removeSelected();
        else if (name === 'copy') copySelection();
        else if (name === 'paste') pasteSelection();
        else if (name === 'undo') {
            var prev = undo.pop();
            var current = ship();
            if (prev && current) {
                current.bays = JSON.parse(prev);
                selected = [];
                if (api.resetAnchor) api.resetAnchor();
                paintSelection();
            }
        } else if (name === 'restore') restoreDefault();
        else if (name === 'save') save();
        else if (name === 'add' && canSave) {
            var form = document.getElementById('cgEditorAdd');
            form.hidden = !form.hidden;
        }
    });

    document.getElementById('cgEditorAdd').addEventListener('submit', function (event) {
        event.preventDefault();
        addShip(new FormData(event.target));
    });

    view.addEventListener('pointerdown', onPointerDown, true);
    view.addEventListener('pointermove', onPointerMove, true);
    view.addEventListener('pointerup', onPointerUp, true);
    view.addEventListener('pointercancel', onPointerUp, true);

    window.addEventListener('keydown', function (event) {
        keys[event.key] = true;
        if (!enabled) return;
        if (event.target && /INPUT|TEXTAREA/.test(event.target.tagName)) return;
        if (event.key === 'q' || event.key === 'Q') {
            setPanel(true, true);
            setTool('select');
        } else if (event.key === 'w' || event.key === 'W') setPanel(true);
        else if (event.key === 'e' || event.key === 'E') {
            setPanel(true, true);
            setTool('rotate');
        } else if (panelOpen && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'r' || event.key === 'R')) {
            event.preventDefault();
            rotateSelection();
        }
        else if (panelOpen && (event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) {
            event.preventDefault();
            copySelection();
        } else if (panelOpen && (event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V')) {
            event.preventDefault();
            pasteSelection();
        } else if (panelOpen && (event.key === 'Delete' || event.key === 'Backspace')) {
            event.preventDefault();
            removeSelected();
        } else if (panelOpen && (event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z')) {
            event.preventDefault();
            var prev = undo.pop();
            var current = ship();
            if (prev && current) {
                current.bays = JSON.parse(prev);
                selected = [];
                if (api.resetAnchor) api.resetAnchor();
                paintSelection();
            }
        } else if (panelOpen && tool === 'move' && selected.length && !event.shiftKey) {
            var step = { ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], ArrowUp: [0, 0, -1], ArrowDown: [0, 0, 1], PageUp: [0, 1, 0], PageDown: [0, -1, 0] }[event.key];
            if (!step) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            nudge(step[0], step[1], step[2]);
        }
    }, true);

    window.addEventListener('keyup', function (event) {
        keys[event.key] = false;
    });

    api.onShip = function () {
        selected = [];
        undo = [];
        if (enabled) {
            if (canSave) loadWiki();
            paintSelection();
        }
    };

    function token() {
        var sess = session();
        return sess && sess.token;
    }

    function authHeaders() {
        var headers = { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' };
        var step = '';
        try {
            step = localStorage.getItem('ussAdminStepUpToken') || sessionStorage.getItem('ussAdminStepUpToken') || '';
        } catch (e) {
            step = '';
        }
        if (step) headers['X-Admin-Step-Up'] = step;
        return headers;
    }

    function apiBase() {
        return (window.USS_AUTH_API_BASE || 'http://127.0.0.1:3789').replace(/\/$/, '');
    }

    async function loadWiki() {
        var current = ship();
        if (!current || !token()) return;
        try {
            var response = await fetch(apiBase() + '/api/admin/cargo-grid/wiki?name=' + encodeURIComponent(current.nameEn), {
                headers: authHeaders(),
            });
            var data = await response.json();
            if (response.ok && data && typeof data.cargo === 'number') {
                current.wikiScu = data.cargo;
                api.refresh();
                refreshReadout();
            }
        } catch (e) {
            refreshReadout();
        }
    }

    function slug(nameEn, makerEn) {
        var base = (makerEn + ' ' + nameEn).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        var id = base.slice(0, 72) || 'ship';
        var taken = {};
        api.ships().forEach(function (item) { taken[item.id] = true; });
        var next = id;
        var n = 2;
        while (taken[next]) {
            next = id + '-' + n;
            n += 1;
        }
        return next;
    }

    async function addShip(form) {
        var nameEn = String(form.get('nameEn') || '').trim();
        var current = {
            id: slug(nameEn, String(form.get('makerEn') || '')),
            nameZh: String(form.get('nameZh') || '').trim(),
            nameEn: nameEn,
            makerZh: String(form.get('makerZh') || '').trim(),
            makerEn: String(form.get('makerEn') || '').trim(),
            wikiScu: 0,
            bays: [{ name: '货舱', w: 4, h: 2, l: 4, boxes: [] }],
        };
        try {
            var response = await fetch(apiBase() + '/api/admin/cargo-grid/wiki?name=' + encodeURIComponent(nameEn), {
                headers: authHeaders(),
            });
            var data = await response.json();
            if (response.ok && typeof data.cargo === 'number') current.wikiScu = data.cargo;
        } catch (e) {
            /* 先加入，保存前可以再读 */
        }
        api.ships().push(current);
        rememberDefault(current);
        document.getElementById('cgEditorAdd').hidden = true;
        api.select(current.id);
    }

    async function save() {
        var current = ship();
        if (!current || !canSave) return;
        var readout = document.getElementById('cgEditorReadout');
        var body = {
            id: current.id,
            nameZh: current.nameZh,
            nameEn: current.nameEn,
            makerZh: current.makerZh,
            makerEn: current.makerEn,
            wikiScu: typeof current.wikiScu === 'number' ? current.wikiScu : null,
            bays: current.bays.map(function (bay) {
                return {
                    name: bay.name || '货舱',
                    w: bay.w,
                    h: bay.h,
                    l: bay.l,
                    boxes: (bay.boxes || []).map(function (box) {
                        return { x: box.x, y: box.y, z: box.z, w: box.w, h: box.h, l: box.l, scu: box.scu };
                    }),
                };
            }),
        };
        try {
            var response = await fetch(apiBase() + '/api/admin/cargo-grid/ship', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(body),
            });
            var raw = await response.text();
            var data = null;
            try {
                data = raw ? JSON.parse(raw) : null;
            } catch (parseError) {
                data = null;
            }
            if (!response.ok) {
                var code = data && data.code;
                var known = '';
                if (code && window.UssApiError) {
                    var formatted = window.UssApiError.formatUserError(code);
                    if (formatted && formatted !== window.UssApiError.formatUserError('')) known = formatted;
                }
                readout.textContent = (data && data.message) || known || ('保存失败（' + response.status + '）');
                return;
            }
            rememberDefault(current);
            api.refresh(true);
            readout.textContent = '已保存。Wiki ' + data.wikiScu + ' / 已摆 ' + data.placed;
        } catch (e) {
            readout.textContent = '保存失败，本地接口没有连上';
        }
    }

    boot();
    if (enabled) api.onShip();
    window.addEventListener('storage', boot);
})();
