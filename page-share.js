(function () {
    var HOSTS = [
        { page: 'blueprint', sel: '.bp-detail' },
        { page: 'cargo', sel: '.cg-view' },
        { page: 'detail', sel: '#scDetailArticle' },
        { page: 'catalog', sel: '.sc-view-toggle' }
    ];

    var ALIGN = {
        2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
        7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
        11: [6, 30, 54], 12: [6, 32, 58]
    };
    // ECC M: data codewords, ecc per block, g1 blocks, g1 data, g2 blocks, g2 data, remainder bits
    var SPEC = {
        1: [16, 10, 1, 16, 0, 0, 0],
        2: [28, 16, 1, 28, 0, 0, 7],
        3: [44, 26, 1, 44, 0, 0, 7],
        4: [64, 18, 2, 32, 0, 0, 7],
        5: [86, 24, 2, 43, 0, 0, 7],
        6: [108, 16, 4, 27, 0, 0, 7],
        7: [124, 18, 4, 31, 0, 0, 0],
        8: [154, 22, 2, 38, 2, 39, 0],
        9: [182, 22, 3, 36, 2, 37, 0],
        10: [216, 26, 4, 43, 1, 44, 0],
        11: [254, 30, 1, 50, 4, 51, 0],
        12: [290, 22, 6, 36, 2, 37, 0]
    };

    var GF_EXP = new Uint8Array(512);
    var GF_LOG = new Uint8Array(256);
    (function initGf() {
        var x = 1;
        for (var i = 0; i < 255; i++) {
            GF_EXP[i] = x;
            GF_LOG[x] = i;
            x <<= 1;
            if (x & 0x100) x ^= 0x11d;
        }
        for (var j = 255; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
    })();

    function gfMul(a, b) {
        if (!a || !b) return 0;
        return GF_EXP[GF_LOG[a] + GF_LOG[b]];
    }

    function rsGenerator(nsym) {
        var g = [1];
        for (var i = 0; i < nsym; i++) {
            var next = new Array(g.length + 1);
            for (var k = 0; k < next.length; k++) next[k] = 0;
            for (var j = 0; j < g.length; j++) {
                next[j] ^= g[j];
                next[j + 1] ^= gfMul(g[j], GF_EXP[i]);
            }
            g = next;
        }
        return g;
    }

    function rsEncode(data, nsym) {
        var gen = rsGenerator(nsym);
        var res = new Array(data.length + nsym);
        var i;
        for (i = 0; i < data.length; i++) res[i] = data[i];
        for (; i < res.length; i++) res[i] = 0;
        for (i = 0; i < data.length; i++) {
            var coef = res[i];
            if (!coef) continue;
            for (var j = 0; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef);
        }
        return res.slice(data.length);
    }

    function bitsToBytes(bits) {
        var out = [];
        for (var i = 0; i < bits.length; i += 8) {
            var v = 0;
            for (var b = 0; b < 8; b++) v = (v << 1) | (bits[i + b] || 0);
            out.push(v);
        }
        return out;
    }

    function pushBits(arr, value, len) {
        for (var i = len - 1; i >= 0; i--) arr.push((value >>> i) & 1);
    }

    function chooseVersion(byteLen) {
        for (var v = 1; v <= 12; v++) {
            var dataCw = SPEC[v][0];
            var countBits = v >= 10 ? 16 : 8;
            var capacity = Math.floor((dataCw * 8 - 4 - countBits) / 8);
            if (byteLen <= capacity) return v;
        }
        return 0;
    }

    function bchFormat(data) {
        var g = 0x537;
        var d = data << 10;
        for (var i = 14; i >= 10; i--) if ((d >>> i) & 1) d ^= g << (i - 10);
        return ((data << 10) | d) ^ 0x5412;
    }

    function bchVersion(data) {
        var g = 0x1f25;
        var d = data << 12;
        for (var i = 17; i >= 12; i--) if ((d >>> i) & 1) d ^= g << (i - 12);
        return (data << 12) | d;
    }

    function buildMatrix(text) {
        var bytes = new TextEncoder().encode(text);
        var version = chooseVersion(bytes.length);
        if (!version) throw new Error('链接过长，无法生成二维码');
        var spec = SPEC[version];
        var size = 17 + version * 4;
        var countBits = version >= 10 ? 16 : 8;
        var bits = [];
        pushBits(bits, 0x4, 4);
        pushBits(bits, bytes.length, countBits);
        for (var i = 0; i < bytes.length; i++) pushBits(bits, bytes[i], 8);
        var cap = spec[0] * 8;
        var remain = Math.min(4, cap - bits.length);
        for (var p = 0; p < remain; p++) bits.push(0);
        while (bits.length % 8) bits.push(0);
        var pad = [0xec, 0x11];
        var pi = 0;
        while (bits.length < cap) {
            pushBits(bits, pad[pi & 1], 8);
            pi++;
        }
        var data = bitsToBytes(bits);
        var blocks = [];
        var offset = 0;
        function take(n, dataLen) {
            var chunk = data.slice(offset, offset + dataLen);
            offset += dataLen;
            blocks.push({ data: chunk, ecc: rsEncode(chunk, n) });
        }
        var bi;
        for (bi = 0; bi < spec[2]; bi++) take(spec[1], spec[3]);
        for (bi = 0; bi < spec[4]; bi++) take(spec[1], spec[5]);
        var interleaved = [];
        var maxData = Math.max(spec[3], spec[5] || 0);
        var k;
        for (k = 0; k < maxData; k++) {
            for (bi = 0; bi < blocks.length; bi++) if (k < blocks[bi].data.length) interleaved.push(blocks[bi].data[k]);
        }
        for (k = 0; k < spec[1]; k++) {
            for (bi = 0; bi < blocks.length; bi++) interleaved.push(blocks[bi].ecc[k]);
        }
        var stream = [];
        for (i = 0; i < interleaved.length; i++) pushBits(stream, interleaved[i], 8);
        for (i = 0; i < spec[6]; i++) stream.push(0);

        var dark = [];
        var reserved = [];
        function at(x, y, bit, lock) {
            if (x < 0 || y < 0 || x >= size || y >= size) return;
            var idx = y * size + x;
            if (lock) reserved[idx] = 1;
            if (bit) dark[idx] = 1;
        }
        function finder(x, y) {
            for (var dy = -1; dy <= 7; dy++) {
                for (var dx = -1; dx <= 7; dx++) {
                    var xx = x + dx;
                    var yy = y + dy;
                    if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
                    var on = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
                    at(xx, yy, on, true);
                }
            }
        }
        finder(0, 0);
        finder(size - 7, 0);
        finder(0, size - 7);
        for (i = 8; i < size - 8; i++) {
            at(i, 6, i % 2 === 0, true);
            at(6, i, i % 2 === 0, true);
        }
        var pos = ALIGN[version] || [];
        for (var a = 0; a < pos.length; a++) {
            for (var b = 0; b < pos.length; b++) {
                var cx = pos[a];
                var cy = pos[b];
                if ((cx < 9 && cy < 9) || (cx > size - 10 && cy < 9) || (cx < 9 && cy > size - 10)) continue;
                for (var dy2 = -2; dy2 <= 2; dy2++) {
                    for (var dx2 = -2; dx2 <= 2; dx2++) {
                        var on2 = Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1;
                        at(cx + dx2, cy + dy2, on2, true);
                    }
                }
            }
        }
        at(8, size - 8, 1, true);
        for (i = 0; i < 9; i++) {
            at(i, 8, 0, true);
            at(8, i, 0, true);
        }
        for (i = 0; i < 8; i++) {
            at(size - 1 - i, 8, 0, true);
            at(8, size - 1 - i, 0, true);
        }
        if (version >= 7) {
            for (i = 0; i < 6; i++) {
                for (var j = 0; j < 3; j++) {
                    at(i, size - 11 + j, 0, true);
                    at(size - 11 + j, i, 0, true);
                }
            }
        }

        var si = 0;
        var upward = true;
        for (var col = size - 1; col > 0; col -= 2) {
            if (col === 6) col--;
            for (var rowStep = 0; rowStep < size; rowStep++) {
                var row = upward ? size - 1 - rowStep : rowStep;
                for (var c = 0; c < 2; c++) {
                    var x = col - c;
                    var idx = row * size + x;
                    if (reserved[idx]) continue;
                    dark[idx] = stream[si] ? 1 : 0;
                    si++;
                }
            }
            upward = !upward;
        }
        return { size: size, dark: dark, reserved: reserved, version: version };
    }

    function applyMask(base, maskId) {
        var size = base.size;
        var out = base.dark.slice();
        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                var idx = y * size + x;
                if (base.reserved[idx]) continue;
                var flip = false;
                if (maskId === 0) flip = (x + y) % 2 === 0;
                else if (maskId === 1) flip = y % 2 === 0;
                else if (maskId === 2) flip = x % 3 === 0;
                else if (maskId === 3) flip = (x + y) % 3 === 0;
                else if (maskId === 4) flip = (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
                else if (maskId === 5) flip = ((x * y) % 2) + ((x * y) % 3) === 0;
                else if (maskId === 6) flip = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
                else flip = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
                if (flip) out[idx] = out[idx] ? 0 : 1;
            }
        }
        return out;
    }

    function writeFormat(modules, size, reserved, maskId) {
        var bits = bchFormat((0 << 3) | maskId);
        var seq = [];
        for (var i = 0; i < 15; i++) seq.push((bits >>> (14 - i)) & 1);
        var posA = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
        var posB = [];
        for (i = 0; i < 7; i++) posB.push([8, size - 1 - i]);
        posB.push([8, size - 8], [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8], [size - 3, 8], [size - 2, 8], [size - 1, 8]);
        for (i = 0; i < 15; i++) {
            modules[posA[i][1] * size + posA[i][0]] = seq[i];
            modules[posB[i][1] * size + posB[i][0]] = seq[i];
        }
        if (arguments[4] >= 7) {
            var vb = bchVersion(arguments[4]);
            for (var n = 0; n < 18; n++) {
                var bit = (vb >>> n) & 1;
                var vx = size - 11 + (n % 3);
                var vy = Math.floor(n / 3);
                modules[vy * size + vx] = bit;
                modules[vx * size + vy] = bit;
            }
        }
    }

    function maskPenalty(modules, size) {
        var score = 0;
        var y;
        var x;
        for (y = 0; y < size; y++) {
            var run = 1;
            for (x = 1; x < size; x++) {
                if (modules[y * size + x] === modules[y * size + x - 1]) run++;
                else {
                    if (run >= 5) score += 3 + (run - 5);
                    run = 1;
                }
            }
            if (run >= 5) score += 3 + (run - 5);
        }
        var dark = 0;
        for (var i = 0; i < modules.length; i++) if (modules[i]) dark++;
        score += Math.floor(Math.abs(dark / modules.length * 100 - 50) / 5) * 10;
        return score;
    }

    function qrModules(text) {
        var base = buildMatrix(text);
        var best = null;
        var bestScore = Infinity;
        var bestMask = 0;
        for (var m = 0; m < 8; m++) {
            var mods = applyMask(base, m);
            writeFormat(mods, base.size, base.reserved, m, base.version);
            var score = maskPenalty(mods, base.size);
            if (score < bestScore) {
                bestScore = score;
                best = mods;
                bestMask = m;
            }
        }
        return { size: base.size, modules: best, mask: bestMask };
    }

    function drawQr(ctx, text, x, y, px, bg) {
        var qr = qrModules(text);
        var quiet = 2;
        var full = qr.size + quiet * 2;
        ctx.fillStyle = bg || '#122d48';
        ctx.fillRect(x, y, full * px, full * px);
        ctx.fillStyle = '#d5e8f6';
        for (var row = 0; row < qr.size; row++) {
            for (var col = 0; col < qr.size; col++) {
                if (!qr.modules[row * qr.size + col]) continue;
                ctx.fillRect(x + (col + quiet) * px, y + (row + quiet) * px, px, px);
            }
        }
        return full * px;
    }

    function toast(text) {
        var el = document.querySelector('.uss-share-toast');
        if (!el) {
            el = document.createElement('p');
            el.className = 'uss-share-toast';
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.hidden = false;
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { el.hidden = true; }, 2200);
    }

    var SNAP_STYLE = [
        'color', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align',
        'display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
        'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
        'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
        'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
        'border-radius', 'box-sizing', 'overflow', 'opacity', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
        'align-items', 'justify-content', 'gap', 'column-gap', 'row-gap',
        'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
        'object-fit', 'object-position', 'white-space', 'vertical-align', 'box-shadow', 'transform',
        'fill', 'stroke', 'stroke-width', 'visibility', 'list-style'
    ];

    function visibleKids(el) {
        return Array.prototype.filter.call(el.children || [], function (node) {
            return !(node.classList && node.classList.contains('uss-share-btn'));
        });
    }

    function snapCss(src) {
        var cs = getComputedStyle(src);
        var css = '';
        for (var i = 0; i < SNAP_STYLE.length; i++) {
            var prop = SNAP_STYLE[i];
            if (prop === 'position' || prop === 'top' || prop === 'left' || prop === 'right' || prop === 'bottom' || prop === 'transform' || prop === 'margin-top' || prop === 'margin-left' || prop === 'margin-right' || prop === 'margin-bottom' || prop === 'overflow') continue;
            var value = cs.getPropertyValue(prop);
            if (value) css += prop + ':' + value + ';';
        }
        return css;
    }

    function scaleCssPx(css, scale) {
        if (!css || scale === 1) return css;
        return css.replace(/(-?\d*\.?\d+)px/g, function (_, n) {
            return (parseFloat(n) * scale) + 'px';
        });
    }

    function maskSvgMarkup(maskValue, color) {
        var raw = String(maskValue || '');
        var match = raw.match(/url\((['"]?)(data:image\/svg\+xml[^)'"]+)\1\)/);
        if (!match) return '';
        var data = match[2];
        var xml = '';
        var comma = data.indexOf(',');
        if (comma < 0) return '';
        var body = data.slice(comma + 1);
        try {
            xml = data.indexOf('base64,') >= 0 ? atob(body) : decodeURIComponent(body);
        } catch (e) {
            return '';
        }
        if (xml.indexOf('<svg') < 0) return '';
        var fill = color && color !== 'transparent' ? color : 'currentColor';
        xml = xml.replace(/fill=(['"])[^'"]*\1/gi, 'fill="' + fill + '"');
        xml = xml.replace('<svg ', '<svg width="100%" height="100%" style="display:block" ');
        return xml;
    }

    function paintPseudo(node, copy, pseudo, scale) {
        var pcs;
        try { pcs = getComputedStyle(node, pseudo); } catch (e) { return; }
        if (!pcs) return;
        var content = pcs.getPropertyValue('content');
        var mask = pcs.getPropertyValue('mask-image') || pcs.getPropertyValue('-webkit-mask-image');
        var svg = maskSvgMarkup(mask, pcs.getPropertyValue('background-color') || pcs.getPropertyValue('color'));
        var emptyContent = !content || content === 'none' || content === 'normal' || content === '""' || content === "''";
        var borderW = (parseFloat(pcs.borderTopWidth) || 0) + (parseFloat(pcs.borderRightWidth) || 0) + (parseFloat(pcs.borderBottomWidth) || 0) + (parseFloat(pcs.borderLeftWidth) || 0);
        var bg = pcs.getPropertyValue('background-color');
        var hasBg = bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)';
        if (emptyContent && !svg && !borderW && !hasBg) return;
        var ghost = document.createElement('span');
        var quoted = String(content || '').match(/^["']([\s\S]*)["']$/);
        if (quoted && quoted[1]) ghost.textContent = quoted[1];
        var css = '';
        var props = SNAP_STYLE.concat(['position', 'top', 'right', 'bottom', 'left', 'inset']);
        for (var i = 0; i < props.length; i++) {
            var value = pcs.getPropertyValue(props[i]);
            if (value && value !== 'none' && value !== 'auto' && value !== 'normal') css += props[i] + ':' + value + ';';
        }
        if (svg) {
            css += 'background:none;background-color:transparent;mask:none;-webkit-mask:none;';
            ghost.innerHTML = svg;
        }
        ghost.setAttribute('style', scaleCssPx(css, scale) + 'pointer-events:none;');
        if (copy.firstChild) copy.insertBefore(ghost, copy.firstChild);
        else copy.appendChild(ghost);
    }

    function splitGradientStops(body) {
        var parts = [];
        var depth = 0;
        var cur = '';
        for (var i = 0; i < body.length; i++) {
            var ch = body.charAt(i);
            if (ch === '(') depth += 1;
            else if (ch === ')') depth = Math.max(0, depth - 1);
            if (ch === ',' && depth === 0) {
                parts.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) parts.push(cur.trim());
        return parts.map(function (part) {
            return part.replace(/\s+[\d.]+%$/, '').trim();
        }).filter(Boolean);
    }

    function colorAlpha(color) {
        var match = String(color || '').match(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/i);
        if (match) return parseFloat(match[1]);
        if (/transparent/i.test(color)) return 0;
        return 1;
    }

    function solidFromGradient(bgImage) {
        var raw = String(bgImage || '');
        var match = raw.match(/linear-gradient\(\s*[0-9.]+deg\s*,\s*([\s\S]+)\)\s*$/i);
        if (!match) return '';
        var stops = splitGradientStops(match[1]);
        for (var i = stops.length - 1; i >= 0; i--) {
            var color = stops[i];
            if (!color || colorAlpha(color) < 0.9) continue;
            return color;
        }
        return '';
    }

    function innerRoundedClip(node, base) {
        var el = node.parentElement;
        while (el && el !== document.documentElement) {
            var pcs = getComputedStyle(el);
            var ov = pcs.overflow;
            var radius = parseFloat(pcs.borderTopLeftRadius) || 0;
            if (radius > 0 && (ov === 'hidden' || ov === 'clip' || pcs.overflowX === 'hidden' || pcs.overflowY === 'hidden')) {
                var r = el.getBoundingClientRect();
                var bt = parseFloat(pcs.borderTopWidth) || 0;
                var br = parseFloat(pcs.borderRightWidth) || 0;
                var bb = parseFloat(pcs.borderBottomWidth) || 0;
                var bl = parseFloat(pcs.borderLeftWidth) || 0;
                return {
                    top: r.top - base.top + bt,
                    left: r.left - base.left + bl,
                    w: Math.max(1, r.width - bl - br),
                    h: Math.max(1, r.height - bt - bb),
                    radius: Math.max(0, radius - Math.max(bt, bl))
                };
            }
            el = el.parentElement;
        }
        return null;
    }

    function cardShareBand(el) {
        if (!el.classList || !el.classList.contains('sc-workspace')) return null;
        var grid = el.querySelector('.sc-card-grid');
        if (!grid || grid.hidden) return null;
        var cards = Array.prototype.filter.call(grid.querySelectorAll('.sc-item-card'), function (card) {
            var box = card.getBoundingClientRect();
            return box.width > 2 && box.height > 2;
        });
        if (!cards.length) return null;
        var rows = [];
        cards.forEach(function (card) {
            var box = card.getBoundingClientRect();
            var row = null;
            for (var i = 0; i < rows.length; i++) {
                if (Math.abs(rows[i].top - box.top) < 12) {
                    row = rows[i];
                    break;
                }
            }
            if (!row) {
                row = { top: box.top, bottom: box.bottom, cards: [card] };
                rows.push(row);
            } else {
                row.cards.push(card);
                if (box.bottom > row.bottom) row.bottom = box.bottom;
            }
        });
        rows.sort(function (a, b) { return a.top - b.top; });
        var viewTop = 0;
        var viewBottom = window.innerHeight || document.documentElement.clientHeight;
        var first = -1;
        var last = -1;
        for (var r = 0; r < rows.length; r++) {
            if (rows[r].bottom > viewTop + 1 && rows[r].top < viewBottom - 1) {
                if (first < 0) first = r;
                last = r;
            }
        }
        if (first < 0) {
            first = 0;
            last = 0;
        }
        first = Math.max(0, first - 2);
        last = Math.min(rows.length - 1, last + 2);
        var included = [];
        for (var n = first; n <= last; n++) included = included.concat(rows[n].cards);
        var columns = [];
        included.forEach(function (card) {
            var box = card.getBoundingClientRect();
            var col = null;
            for (var c = 0; c < columns.length; c++) {
                if (Math.abs(columns[c].left - box.left) < 12) {
                    col = columns[c];
                    break;
                }
            }
            if (!col) {
                col = { left: box.left, right: box.right, cards: [card] };
                columns.push(col);
            } else {
                col.cards.push(card);
                if (box.right > col.right) col.right = box.right;
            }
        });
        columns.sort(function (a, b) { return a.left - b.left; });
        if (columns.length > 4) columns = columns.slice(0, 4);
        included = [];
        columns.forEach(function (col) { included = included.concat(col.cards); });
        var top = rows[first].top;
        var bottom = rows[last].bottom;
        var deck = el.querySelector('.sc-filter-deck');
        if (deck) {
            var deckBox = deck.getBoundingClientRect();
            var deckTop = deckBox.top;
            var search = deck.querySelector('.sc-filter-deck__search');
            if (search) {
                var searchBox = search.getBoundingClientRect();
                if (searchBox.height > 2) deckTop = searchBox.bottom;
            }
            if (deckBox.bottom > viewTop && deckTop < viewBottom) top = Math.min(top, deckTop);
        }
        var host = el.getBoundingClientRect();
        var bandTop = Math.max(host.top, top - 8);
        var bandBottom = bottom + 10;
        var bandLeft = columns.length ? Math.max(host.left, columns[0].left - 8) : host.left;
        var bandRight = columns.length ? columns[columns.length - 1].right + 8 : host.right;
        return {
            top: bandTop,
            bottom: bandBottom,
            left: bandLeft,
            right: bandRight,
            width: Math.max(1, bandRight - bandLeft),
            height: Math.max(1, bandBottom - bandTop),
            cards: included
        };
    }

    function qualityRingSvg(score) {
        var pct = Math.max(0, Math.min(100, Number(score) || 0)) / 100;
        var r = 45;
        var circ = 2 * Math.PI * r;
        var dash = (circ * pct).toFixed(2);
        var gap = (circ - circ * pct).toFixed(2);
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' +
            '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="rgba(95,184,255,0.12)" stroke-width="10"/>' +
            '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="#00f0ff" stroke-width="10" stroke-dasharray="' + dash + ' ' + gap + '" transform="rotate(-90 50 50)"/>' +
            '<circle cx="50" cy="50" r="40" fill="#081625"/>' +
            '</svg>';
    }

    function flattenSnap(src, base, scale, band) {
        var layer = document.createElement('div');
        layer.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        function add(node) {
            if (!node || node.nodeType !== 1) return;
            if (node.classList && (node.classList.contains('uss-share-btn') || node.classList.contains('sc-img-hit') || node.classList.contains('sc-filter-deck__search'))) return;
            var tag = node.tagName.toLowerCase();
            if (tag === 'script' || tag === 'style' || tag === 'link') return;
            var cs = getComputedStyle(node);
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            if (node.classList && (node.classList.contains('sc-sr-only') || node.classList.contains('sr-only'))) return;
            var clip = cs.clip || '';
            if (clip.indexOf('rect(0px') === 0 || clip.indexOf('rect(0,') === 0) return;
            var rect = node.getBoundingClientRect();
            var isSvg = tag === 'svg';
            var owner = node.classList && node.classList.contains('sc-item-card') ? node : (node.closest ? node.closest('.sc-item-card') : null);
            if (band && band.cards && owner && band.cards.indexOf(owner) < 0) return;
            if (band && node !== src && !owner && (rect.bottom < band.top - 1 || rect.top > band.bottom + 1 || rect.left > band.right + 1)) return;
            if (rect.width < 0.5 && rect.height < 0.5 && tag !== 'img') {
                if (!isSvg) Array.prototype.forEach.call(node.children, add);
                return;
            }
            var copy;
            if (tag === 'canvas') {
                copy = document.createElement('img');
                try { copy.setAttribute('src', node.toDataURL('image/png')); } catch (e) {}
            } else if (isSvg) {
                copy = node.cloneNode(true);
            } else {
                copy = node.cloneNode(false);
                if (tag === 'img') {
                    var data = imageToData(node);
                    var fitMode = cs.objectFit || 'fill';
                    data = data || node._shareReady || '';
                    if (data && (fitMode === 'cover' || fitMode === 'contain')) {
                        copy = document.createElement('div');
                        copy._shareBg = 'background-image:url("' + data + '");background-size:' + fitMode + ';background-position:' + (cs.objectPosition || 'center center') + ';background-repeat:no-repeat;';
                    } else if (data) {
                        copy.setAttribute('src', data);
                    }
                }
                for (var i = 0; i < node.childNodes.length; i++) {
                    var ch = node.childNodes[i];
                    if (ch.nodeType === 3 && ch.textContent.trim()) copy.appendChild(document.createTextNode(ch.textContent));
                }
            }
            var csTransform = cs.transform && cs.transform !== 'none' ? cs.transform : '';
            var boxW = rect.width;
            var boxH = rect.height;
            var boxTop = rect.top - base.top;
            var boxLeft = rect.left - base.left;
            var clipRadius = '';
            if (tag === 'img') {
                var clip = innerRoundedClip(node, base);
                if (clip) {
                    var t = Math.max(boxTop, clip.top);
                    var l = Math.max(boxLeft, clip.left);
                    var rgt = Math.min(boxLeft + boxW, clip.left + clip.w);
                    var btm = Math.min(boxTop + boxH, clip.top + clip.h);
                    if (rgt - l > 1 && btm - t > 1) {
                        boxTop = t;
                        boxLeft = l;
                        boxW = rgt - l;
                        boxH = btm - t;
                        clipRadius = 'border-radius:' + (clip.radius * scale) + 'px;overflow:hidden;';
                        csTransform = '';
                    }
                }
            }
            if (csTransform) {
                var laidW = parseFloat(cs.width);
                var laidH = parseFloat(cs.height);
                if (laidW > 0 && laidH > 0) {
                    boxW = laidW;
                    boxH = laidH;
                    boxLeft = rect.left - base.left + rect.width / 2 - laidW / 2;
                    boxTop = rect.top - base.top + rect.height / 2 - laidH / 2;
                }
            }
            var fit = 'position:absolute;top:' + (boxTop * scale) + 'px;left:' + (boxLeft * scale) + 'px;width:' + (boxW * scale) + 'px;height:' + (boxH * scale) + 'px;min-height:0;max-height:none;max-width:none;margin:0;transform:' + (csTransform || 'none') + ';transform-origin:center center;overflow:visible;box-sizing:border-box;';
            if (node.classList && node.classList.contains('bp-sim-stat-gain')) {
                var gainRight = (base.right - rect.right) * scale;
                fit = 'position:absolute;top:' + (boxTop * scale) + 'px;right:' + gainRight + 'px;left:auto;width:max-content;height:auto;min-height:0;max-height:none;max-width:none;margin:0;transform:none;transform-origin:center center;overflow:visible;box-sizing:border-box;white-space:nowrap;text-align:right;';
            } else if (node.classList && (node.classList.contains('sc-loc-level') || node.classList.contains('sc-loc-path') || node.classList.contains('bp-tag') || node.classList.contains('bp-sim-stat-value') || node.classList.contains('bp-sim-stat-base') || node.classList.contains('bp-mat__mods-label') || node.classList.contains('bp-mat__mat-label') || node.classList.contains('bp-mat__quality-label'))) {
                fit += 'white-space:nowrap;width:max-content;max-width:none;height:auto;';
            }
            copy.setAttribute('style', scaleCssPx(snapCss(node), scale) + fit + clipRadius + (copy._shareBg || ''));
            if (node.classList && node.classList.contains('bp-sim-stat-gain')) {
                copy.textContent = '';
                Array.prototype.forEach.call(node.childNodes, function (ch) {
                    if (ch.nodeType === 3) {
                        copy.appendChild(document.createTextNode(ch.textContent));
                        return;
                    }
                    if (ch.nodeType !== 1) return;
                    var piece = document.createElement('span');
                    var pieceCs = getComputedStyle(ch);
                    piece.setAttribute('style', 'color:' + pieceCs.color + ';font-weight:' + (pieceCs.fontWeight || '800') + ';');
                    piece.textContent = ch.textContent;
                    copy.appendChild(piece);
                });
                layer.appendChild(copy);
                return;
            }
            var bgImage = cs.getPropertyValue('background-image');
            if (bgImage && bgImage.indexOf('linear-gradient') === 0) {
                var flat = solidFromGradient(bgImage);
                copy.setAttribute('style', (copy.getAttribute('style') || '') + 'background-image:none;' + (flat ? 'background-color:' + flat + ';' : ''));
            }
            if (node.classList && node.classList.contains('bp-meter__ring')) {
                var score = parseFloat(getComputedStyle(node).getPropertyValue('--bp-score'));
                copy.innerHTML = qualityRingSvg(isFinite(score) ? score : 0);
                var ringStyle = copy.getAttribute('style') || '';
                copy.setAttribute('style', ringStyle + 'background:none;background-image:none;overflow:hidden;');
                layer.appendChild(copy);
                return;
            }
            paintPseudo(node, copy, '::before', scale);
            paintPseudo(node, copy, '::after', scale);
            layer.appendChild(copy);
            if (!isSvg && tag !== 'canvas' && tag !== 'img') Array.prototype.forEach.call(node.children, add);
        }
        add(src);
        return layer;
    }

    function shareImageUrl(src) {
        try {
            var url = new URL(src, window.location.href);
            if (url.pathname.indexOf('/api/') === 0) return window.location.origin + url.pathname + url.search;
        } catch (e) {}
        return src;
    }

    function blobToData(blob) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result || ''); };
            reader.onerror = function () { resolve(''); };
            reader.readAsDataURL(blob);
        });
    }

    async function imageToDataAsync(img) {
        var ready = imageToData(img);
        if (ready) return ready;
        var src = (img && (img.currentSrc || img.src)) || '';
        if (!src) return '';
        if (src.indexOf('data:') === 0) return src;
        try {
            var res = await fetch(shareImageUrl(src));
            if (!res.ok) return '';
            return await blobToData(await res.blob());
        } catch (e) {
            return '';
        }
    }

    async function prefetchShareImages(cards) {
        var imgs = [];
        (cards || []).forEach(function (card) {
            Array.prototype.forEach.call(card.querySelectorAll('img'), function (img) { imgs.push(img); });
        });
        await Promise.all(imgs.map(async function (img) {
            var data = await imageToDataAsync(img);
            if (data) img._shareReady = data;
        }));
    }

    function imageToData(img) {
        if (!img || !img.naturalWidth) return '';
        try {
            var c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            return c.toDataURL('image/png');
        } catch (e) {
            return '';
        }
    }

    function embedLiveImages(src, dst) {
        var live = src.querySelectorAll('img');
        var copies = dst.querySelectorAll('img');
        for (var i = 0; i < live.length && i < copies.length; i++) {
            var data = imageToData(live[i]);
            if (data) copies[i].setAttribute('src', data);
        }
        var liveCanvas = src.querySelectorAll('canvas');
        var copyCanvas = dst.querySelectorAll('canvas');
        for (var n = 0; n < liveCanvas.length && n < copyCanvas.length; n++) {
            var shot = document.createElement('img');
            try { shot.setAttribute('src', liveCanvas[n].toDataURL('image/png')); } catch (e) {}
            shot.setAttribute('style', copyCanvas[n].getAttribute('style') || '');
            shot.style.display = 'block';
            shot.style.width = (liveCanvas[n].clientWidth || liveCanvas[n].width) + 'px';
            shot.style.height = (liveCanvas[n].clientHeight || liveCanvas[n].height) + 'px';
            copyCanvas[n].replaceWith(shot);
        }
    }

    function loadSvgImage(svg) {
        var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('生成图片失败')); };
            img.src = url;
        });
    }

    async function raster(el) {
        var band = cardShareBand(el);
        await prefetchShareImages(band && band.cards && band.cards.length ? band.cards : [el]);
        var measured = band || el.getBoundingClientRect();
        var base = {
            top: measured.top,
            left: measured.left,
            right: measured.right,
            bottom: measured.bottom,
            width: measured.width,
            height: measured.height
        };
        if (!band && el.querySelector) {
            var search = el.querySelector('.sc-filter-deck__search');
            if (search) {
                var searchBox = search.getBoundingClientRect();
                if (searchBox.height > 2 && searchBox.bottom > base.top && searchBox.bottom < base.bottom) {
                    base.top = searchBox.bottom;
                    base.height = base.bottom - base.top;
                }
            }
        }
        var clipToHost = !!(band || (el.classList && el.classList.contains('bp-detail')));
        var right = base.right;
        var bottom = base.bottom;
        if (!clipToHost) {
            el.querySelectorAll('*').forEach(function (node) {
                if (node.classList && node.classList.contains('uss-share-btn')) return;
                var box = node.getBoundingClientRect();
                if (box.width < 1 && box.height < 1) return;
                if (box.right > right) right = box.right;
                if (box.bottom > bottom) bottom = box.bottom;
            });
        }
        var w = Math.max(1, Math.ceil(Math.max(right - base.left, clipToHost ? base.width : el.scrollWidth) + 2));
        var h = Math.max(1, Math.ceil(Math.max(bottom - base.top, clipToHost ? base.height : el.scrollHeight) + 2));
        var scale = band ? 2 : 4;
        if (w * scale > 7680) scale = 7680 / w;
        if (h * scale > 16300) scale = 16300 / h;
        var layer = flattenSnap(el, base, scale, band);
        var fullW = Math.max(1, Math.round(w * scale));
        var fullH = Math.max(1, Math.round(h * scale));
        layer.style.cssText = 'position:relative;width:' + fullW + 'px;height:' + fullH + 'px;overflow:' + (clipToHost ? 'hidden' : 'visible') + ';margin:0;background:#122d48;';
        var xhtml = new XMLSerializer().serializeToString(layer);
        var canvas = document.createElement('canvas');
        canvas.width = fullW;
        canvas.height = fullH;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#122d48';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        var sliceH = Math.round(1200 * scale);
        for (var y = 0; y < fullH; y += sliceH) {
            var sh = Math.min(sliceH, fullH - y);
            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + fullW + '" height="' + sh + '">' +
                '<foreignObject x="0" y="0" width="' + fullW + '" height="' + sh + '">' +
                '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + fullW + 'px;height:' + fullH + 'px;transform:translateY(-' + y + 'px)">' +
                xhtml + '</div></foreignObject></svg>';
            var image = await loadSvgImage(svg);
            ctx.drawImage(image, 0, y);
        }
        var note = el.querySelector('.sc-detail-footnote, .sc-footnote');
        var qrTop = null;
        var lineEl = note && note.previousElementSibling;
        if (lineEl) {
            var lr = lineEl.getBoundingClientRect();
            qrTop = (lr.bottom - base.top) * scale + Math.round(10 * scale);
        } else if (note) {
            var nr = note.getBoundingClientRect();
            if (nr.height > 1) qrTop = (nr.bottom - base.top) * scale + Math.round(6 * scale);
        }
        if (qrTop == null && el.classList && el.classList.contains('bp-detail')) {
            qrTop = fullH + Math.round(14 * scale);
        }
        return { canvas: canvas, scale: scale, qrTop: qrTop, mime: band ? 'image/jpeg' : 'image/png' };
    }

    function compose(shot, url) {
        var src = shot.canvas;
        var qrPx = Math.max(2, Math.round(shot.scale || 2));
        var qrBox = (function () {
            var probe = qrModules(url);
            return (probe.size + 4) * qrPx;
        })();
        var pad = Math.round(10 * (shot.scale || 2));
        var y = shot.qrTop != null ? Math.round(shot.qrTop) : Math.max(0, src.height - pad - qrBox);
        var canvas = document.createElement('canvas');
        canvas.width = src.width;
        canvas.height = Math.max(src.height, y + qrBox + pad);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#122d48';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(src, 0, 0);
        var qx = canvas.width - pad - qrBox;
        ctx.fillStyle = 'rgba(186, 214, 232, 0.9)';
        ctx.font = '600 ' + Math.round(12 * (shot.scale || 2)) + 'px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('USSXC.ORG', qx - Math.round(8 * (shot.scale || 2)), y + qrBox);
        drawQr(ctx, url, qx, y, qrPx, '#122d48');
        return canvas;
    }

    async function copyCanvas(canvas, mime) {
        mime = mime || 'image/png';
        var png = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
        if (!png) throw new Error('生成图片失败');
        var copied = false;
        if (navigator.clipboard && window.ClipboardItem) {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
                copied = true;
            } catch (e) { copied = false; }
        }
        if (copied) return;
        var ext = mime === 'image/jpeg' ? 'jpg' : 'png';
        var blob = png;
        if (mime === 'image/jpeg') {
            blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.82); });
            if (!blob) blob = png;
        }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ussxc-share.' + ext;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
        throw new Error('download');
    }

    async function share(host, btn) {
        btn = btn || (host && host.querySelector('.uss-share-btn'));
        if (btn) btn.disabled = true;
        try {
            var url = location.href.split('#')[0];
            var shot = await raster(host);
            var canvas = compose(shot, url);
            await copyCanvas(canvas, shot.mime);
            toast('图片已复制');
        } catch (err) {
            toast(err && err.message === 'download' ? '无法复制，已下载图片' : '生成图片失败');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function mount(host) {
        if (!host || host.querySelector('.uss-share-btn')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'uss-share-btn';
        btn.setAttribute('aria-label', '分享');
        btn.title = '分享';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="6" cy="12" r="2.2"/><circle cx="17" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/><path d="M8 11.2 14.8 8M8 12.8 14.8 16"/></svg>';
        btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            share(btn._shareHost || host, btn);
        });
        if (host.classList && host.classList.contains('rsi-funding-panel')) {
            var bar = host.querySelector('.rsi-funding-panel-bar');
            btn._shareHost = host;
            btn.classList.add('uss-share-btn--bar');
            if (bar) bar.appendChild(btn);
            else host.appendChild(btn);
            return;
        }
        if (host.classList && host.classList.contains('bp-detail')) {
            var actions = host.querySelector('.bp-hero__actions');
            var link = host.querySelector('.bp-hero__link');
            btn._shareHost = host;
            btn.classList.add('uss-share-btn--nav');
            if (actions && link) actions.insertBefore(btn, link);
            else if (actions) actions.insertBefore(btn, actions.firstChild);
            else host.appendChild(btn);
            return;
        }
        if (host.classList && host.classList.contains('cg-view')) {
            var icons = host.querySelector('.cg-view-icons');
            btn._shareHost = host;
            btn.classList.add('cg-view-icon');
            if (icons) icons.appendChild(btn);
            else host.appendChild(btn);
            return;
        }
        if (host.classList && host.classList.contains('sc-view-toggle')) {
            var workspace = document.querySelector('.sc-workspace');
            btn._shareHost = workspace || host;
            btn.classList.add('uss-share-btn--float');
            document.body.appendChild(btn);
            return;
        }
        if (host.id === 'scDetailArticle') {
            var back = document.querySelector('.sc-detail-back');
            var upload = document.getElementById('scDetailImageUpload');
            btn._shareHost = host;
            btn.classList.add('uss-share-btn--nav');
            if (back && upload) back.insertBefore(btn, upload);
            else if (back) back.appendChild(btn);
            else host.appendChild(btn);
            return;
        }
        host.appendChild(btn);
    }

    function boot() {
        HOSTS.forEach(function (item) {
            if (!document.querySelector(item.sel) && item.page !== document.body.dataset.ussShare) return;
            var host = document.querySelector(item.sel);
            if (host) mount(host);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
