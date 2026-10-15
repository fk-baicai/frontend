(function () {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    var pack = window.CargoGridPack;
    var ships = window.CARGO_GRID_SHIPS || [];
    var listEl = document.getElementById('cgShipList');
    var metaEl = document.getElementById('cgMeta');
    var viewEl = document.getElementById('cgView');
    var selectedId = '';
    var rotX = -32;
    var rotY = 42;
    var zoom = 1;
    var panX = 0;
    var panY = 0;
    var panZ = 0;
    var drag = null;
    var scene = null;

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
            '  float light = 0.82 + 0.18 * max(dot(n, normalize(vec3(0.35, 0.86, 0.32))), 0.0);',
            '  vec3 col = vColor * light;',
            '  vec2 centered = (vUv - 0.5) * vFace;',
            '  if (abs(centered.x) < 0.36 && abs(centered.y) < 0.36) {',
            '    float a = texture2D(uLabel, centered / 0.72 + 0.5).a;',
            '    col = mix(col, vec3(1.0), a);',
            '  }',
            '  gl_FragColor = vec4(col, 1.0);',
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

    function renderList() {
        listEl.innerHTML = ships
            .map(function (ship) {
                return (
                    '<button type="button" class="cg-ship' +
                    (ship.id === selectedId ? ' is-selected' : '') +
                    '" role="option" aria-selected="' +
                    (ship.id === selectedId ? 'true' : 'false') +
                    '" data-ship="' +
                    ship.id +
                    '"><span class="cg-ship-zh">' +
                    escapeHtml(ship.nameZh) +
                    '</span><span class="cg-ship-en">' +
                    escapeHtml(ship.nameEn) +
                    '</span></button>'
                );
            })
            .join('');
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
        panX = 0;
        panY = 0;
        panZ = 0;
        if (pushHash) {
            if (history.replaceState) history.replaceState(null, '', '#' + ship.id);
            else location.hash = ship.id;
        }
        renderList();
        scene = buildScene(ship);
        viewEl.setAttribute('aria-label', ship.nameZh + ' ' + ship.nameEn + '，左键旋转，Shift加左键或中键平移');
        draw();
    }

    function buildScene(ship) {
        var gap = 2;
        var cursor = 0;
        var maxD = 1;
        var maxH = 1;
        var placed = [];
        ship.bays.forEach(function (bay) {
            var result = pack.packBay(bay);
            var ox = cursor;
            cursor += bay.w + gap;
            if (bay.l > maxD) maxD = bay.l;
            if (bay.h > maxH) maxH = bay.h;
            result.boxes.forEach(function (box) {
                placed.push({ ox: ox, box: box });
            });
        });
        var totalW = Math.max(1, cursor - gap);
        var verts = [];
        var edges = [];
        placed.forEach(function (item) {
            addBox(verts, edges, item.ox, item.box, totalW, maxD);
        });
        return {
            boxes: groupBoxes(verts),
            edges: lineBuffer(edges),
            edgeCount: edges.length / 3,
            grid: lineBuffer(gridLines(totalW, maxD)),
            gridCount: gridLines(totalW, maxD).length / 3,
            focusY: maxH / 2,
            span: Math.max(totalW, maxD, maxH, 4),
        };
    }

    function addBox(verts, edges, ox, box, totalW, maxD) {
        var w = box.w;
        var h = box.h;
        var d = box.l;
        var cx = ox + box.x + w / 2 - totalW / 2;
        var cy = box.y + h / 2;
        var cz = box.z + d / 2 - maxD / 2;
        var color = SCU_COLOR[box.scu] || SCU_COLOR[1];
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
        for (i = 0; i < flat.scu.length; i++) {
            var scu = flat.scu[i];
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

    function gridLines(totalW, maxD) {
        var pad = 28;
        var lines = [];
        var x0 = -totalW / 2;
        var z0 = -maxD / 2;
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

    function camera() {
        var pitch = (-rotX * Math.PI) / 180;
        var yaw = (rotY * Math.PI) / 180;
        var dist = (scene ? scene.span * 1.85 : 16) / zoom;
        var cp = Math.cos(pitch);
        var eye = [
            panX + dist * cp * Math.sin(yaw),
            (scene ? scene.focusY : 1) + panY + dist * Math.sin(pitch),
            panZ + dist * cp * Math.cos(yaw),
        ];
        var target = [panX, (scene ? scene.focusY : 1) + panY, panZ];
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
        var width = Math.max(1, viewEl.clientWidth);
        var height = Math.max(1, viewEl.clientHeight);
        var pw = Math.round(width * dpr);
        var ph = Math.round(height * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.024, 0.063, 0.11, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        var cam = camera();
        var proj = perspective((40 * Math.PI) / 180, canvas.width / canvas.height, 0.08, 400);
        var view = lookAt(cam.eye, cam.target, [0, 1, 0]);
        var mvp = multiply(proj, view);

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
        var btn = event.target.closest('.cg-ship');
        if (!btn) return;
        selectShip(btn.getAttribute('data-ship'), true);
    });

    viewEl.addEventListener('pointerdown', function (event) {
        if (drag) return;
        var mode = event.button === 1 || (event.button === 0 && event.shiftKey) ? 'pan' : event.button === 0 ? 'rotate' : '';
        if (!mode) return;
        if (event.button === 1) event.preventDefault();
        var cam = camera();
        var axes = basis(cam);
        drag = {
            mode: mode,
            x: event.clientX,
            y: event.clientY,
            rotX: rotX,
            rotY: rotY,
            panX: panX,
            panY: panY,
            panZ: panZ,
            right: axes.right,
            up: axes.up,
            scale: cam.dist / Math.max(1, viewEl.clientHeight),
        };
        viewEl.classList.add(mode === 'pan' ? 'is-pan' : 'is-drag');
        viewEl.setPointerCapture(event.pointerId);
    });

    viewEl.addEventListener('pointermove', function (event) {
        if (!drag) return;
        var dx = event.clientX - drag.x;
        var dy = event.clientY - drag.y;
        if (drag.mode === 'pan') {
            var limit = scene ? scene.span * 1.6 : 12;
            panX = clamp(drag.panX + (drag.right[0] * dx - drag.up[0] * dy) * drag.scale, limit);
            panY = clamp(drag.panY + (drag.right[1] * dx - drag.up[1] * dy) * drag.scale, limit);
            panZ = clamp(drag.panZ + (drag.right[2] * dx - drag.up[2] * dy) * drag.scale, limit);
        } else {
            rotY = drag.rotY + dx * 0.45;
            rotX = Math.max(-80, Math.min(80, drag.rotX - dy * 0.35));
        }
        draw();
    });

    viewEl.addEventListener('mousedown', function (event) {
        if (event.button === 1) event.preventDefault();
    });

    function endDrag(event) {
        if (!drag) return;
        drag = null;
        viewEl.classList.remove('is-drag');
        viewEl.classList.remove('is-pan');
        if (event && event.pointerId != null) {
            try {
                viewEl.releasePointerCapture(event.pointerId);
            } catch (e) {
                /* already released */
            }
        }
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
            var lift = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
            if (!dir && !lift) return;
            panX += axes.right[0] * dir * 0.35 + axes.up[0] * lift * 0.35;
            panY += axes.right[1] * dir * 0.35 + axes.up[1] * lift * 0.35;
            panZ += axes.right[2] * dir * 0.35 + axes.up[2] * lift * 0.35;
        } else if (event.key === 'ArrowLeft') rotY -= step;
        else if (event.key === 'ArrowRight') rotY += step;
        else if (event.key === 'ArrowUp') rotX = Math.max(-80, rotX - step);
        else if (event.key === 'ArrowDown') rotX = Math.min(80, rotX + step);
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
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            viewEl.appendChild(document.createTextNode(gl.getProgramInfoLog(prog) || 'shader failed'));
        }
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
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }
})();
