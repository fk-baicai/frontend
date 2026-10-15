(function () {
    'use strict';

    var root = document.getElementById('heroTools');
    if (!root) return;
    var viewport = root.querySelector('.hero-tools-viewport');
    var track = root.querySelector('.hero-tools-track');
    if (!viewport || !track) return;

    var reduceMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    var narrowQuery =
        typeof window.matchMedia === 'function'
            ? window.matchMedia('(max-width: 520px)')
            : null;
    var originals = Array.prototype.slice.call(track.querySelectorAll('.hero-tool'));
    var count = originals.length;
    if (count < 2) return;

    var rowIndex = 0;
    var hovering = false;
    var dragging = false;
    var focused = false;
    var suppressClick = false;
    var animating = false;
    var raf = 0;
    var last = 0;
    var acc = 0;
    var STEP_MS = 2000;
    var ANIM_MS = 420;

    function visibleCount() {
        return narrowQuery && narrowQuery.matches ? 2 : 4;
    }

    function itemWidth() {
        var width = viewport.clientWidth;
        if (!width) return 0;
        return width / visibleCount();
    }

    function makeClone(source) {
        var clone = source.cloneNode(true);
        clone.setAttribute('draggable', 'false');
        clone.setAttribute('data-hero-tool-clone', '1');
        clone.setAttribute('tabindex', '-1');
        clone.setAttribute('aria-hidden', 'true');
        return clone;
    }

    function sizeTool(node) {
        var width = itemWidth();
        node.style.flex = '0 0 ' + width + 'px';
        node.style.maxWidth = width + 'px';
        node.style.width = width + 'px';
    }

    function pageCount() {
        return Math.ceil(count / visibleCount());
    }

    function fillRow(page, keepOriginal) {
        var row = document.createElement('div');
        row.className = 'hero-tools-row';
        var visible = visibleCount();
        var start = page * visible;
        var end = Math.min(start + visible, count);
        for (var i = start; i < end; i++) {
            var node = keepOriginal ? originals[i] : makeClone(originals[i]);
            sizeTool(node);
            row.appendChild(node);
        }
        return row;
    }

    function rebuild() {
        for (var i = 0; i < originals.length; i++) {
            if (originals[i].parentNode) originals[i].parentNode.removeChild(originals[i]);
        }
        track.textContent = '';
        var pages = pageCount();
        for (var r = 0; r < pages; r++) track.appendChild(fillRow(r, true));
        track.appendChild(fillRow(0, false));
        var rows = track.children;
        var height = 0;
        for (var h = 0; h < rows.length; h++) height = Math.max(height, rows[h].offsetHeight);
        if (height) {
            for (var s = 0; s < rows.length; s++) rows[s].style.height = height + 'px';
            viewport.style.height = height + 'px';
        }
        root.classList.add('is-ready');
    }

    function rowHeight() {
        var row = track.querySelector('.hero-tools-row');
        return row ? row.offsetHeight : 0;
    }

    function paint(animate) {
        var height = rowHeight();
        if (height) viewport.style.height = height + 'px';
        animating = !!animate;
        track.style.transition = animate ? 'transform ' + ANIM_MS + 'ms ease' : 'none';
        track.style.transform = 'translate3d(0,' + -rowIndex * height + 'px, 0)';
    }

    track.addEventListener('transitionend', function (ev) {
        if (ev.target !== track || ev.propertyName !== 'transform') return;
        animating = false;
        if (rowIndex >= pageCount()) {
            rowIndex = 0;
            paint(false);
        }
    });

    function tick(now) {
        if (!last) last = now;
        var dt = now - last;
        last = now;
        if (dt > 200) dt = 0;
        if (!hovering && !dragging && !focused && !animating && !document.hidden) {
            acc += dt;
            if (acc >= STEP_MS) {
                acc = 0;
                rowIndex += 1;
                paint(true);
            }
        }
        raf = window.requestAnimationFrame(tick);
    }

    root.addEventListener('mouseenter', function () {
        hovering = true;
    });
    root.addEventListener('mouseleave', function () {
        hovering = false;
        acc = 0;
    });
    root.addEventListener('focusin', function (ev) {
        focused = true;
        var link = ev.target.closest('.hero-tool');
        if (!link || link.hasAttribute('data-hero-tool-clone')) return;
        var idx = originals.indexOf(link);
        var page = idx < 0 ? -1 : Math.floor(idx / visibleCount());
        if (page < 0 || page === rowIndex) return;
        rowIndex = page;
        acc = 0;
        paint(false);
    });
    root.addEventListener('focusout', function (ev) {
        if (root.contains(ev.relatedTarget)) return;
        focused = false;
        acc = 0;
    });

    var drag = null;
    function onPointerMove(ev) {
        if (!drag || ev.pointerId !== drag.id) return;
        var dy = ev.clientY - drag.y;
        drag.moved = dy;
        if (Math.abs(dy) <= 6) return;
        var height = rowHeight();
        if (!height) return;
        if (!dragging) {
            dragging = true;
            suppressClick = true;
            root.classList.add('is-dragging');
        }
        var loop = pageCount() * height;
        var offset = drag.base - dy;
        offset = ((offset % loop) + loop) % loop;
        drag.offset = offset;
        animating = false;
        track.style.transition = 'none';
        track.style.transform = 'translate3d(0,' + -offset + 'px, 0)';
    }
    function onPointerUp(ev) {
        if (!drag || (ev && ev.pointerId !== drag.id)) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        if (dragging) {
            var height = rowHeight() || 1;
            var pages = pageCount();
            rowIndex = Math.round((drag.offset || 0) / height) % pages;
            if (rowIndex < 0) rowIndex += pages;
            paint(true);
        }
        drag = null;
        dragging = false;
        acc = 0;
        root.classList.remove('is-dragging');
    }
    viewport.addEventListener('dragstart', function (ev) {
        ev.preventDefault();
    });
    viewport.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        if (ev.button != null && ev.button !== 0) return;
        drag = { id: ev.pointerId, y: ev.clientY, base: rowIndex * (rowHeight() || 0), offset: rowIndex * (rowHeight() || 0), moved: 0 };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    });
    viewport.addEventListener('click', function (ev) {
        if (!suppressClick) return;
        ev.preventDefault();
        ev.stopPropagation();
        suppressClick = false;
    }, true);

    function relayout() {
        var pages = pageCount();
        var logical = ((rowIndex % pages) + pages) % pages;
        rebuild();
        rowIndex = logical % pageCount();
        acc = 0;
        paint(false);
    }

    rebuild();
    rowIndex = 0;
    paint(false);
    raf = window.requestAnimationFrame(tick);

    window.addEventListener('resize', relayout);
    if (narrowQuery && typeof narrowQuery.addEventListener === 'function') {
        narrowQuery.addEventListener('change', relayout);
    }
})();
