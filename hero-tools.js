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

    var pos = 0;
    var hovering = false;
    var dragging = false;
    var focused = false;
    var suppressClick = false;
    var raf = 0;
    var last = 0;
    var STEP_MS = 4800;

    function visibleCount() {
        return narrowQuery && narrowQuery.matches ? 2 : 4;
    }

    function itemWidth() {
        return viewport.clientWidth / visibleCount();
    }

    function makeClone(source) {
        var clone = source.cloneNode(true);
        clone.setAttribute('draggable', 'false');
        clone.setAttribute('data-hero-tool-clone', '1');
        clone.setAttribute('tabindex', '-1');
        clone.setAttribute('aria-hidden', 'true');
        return clone;
    }

    function rebuild() {
        var old = track.querySelectorAll('[data-hero-tool-clone]');
        for (var i = 0; i < old.length; i++) old[i].remove();
        var visible = visibleCount();
        var width = itemWidth();
        var lead = document.createDocumentFragment();
        for (var n = 0; n < visible; n++) {
            lead.appendChild(makeClone(originals[(count - visible + n) % count]));
        }
        track.insertBefore(lead, track.firstChild);
        for (var t = 0; t < visible; t++) {
            track.appendChild(makeClone(originals[t % count]));
        }
        var all = track.children;
        for (var c = 0; c < all.length; c++) {
            all[c].style.flex = '0 0 ' + width + 'px';
            all[c].style.maxWidth = width + 'px';
            all[c].style.width = width + 'px';
        }
        root.classList.add('is-ready');
    }

    function wrapPos() {
        var width = itemWidth();
        var loop = count * width;
        if (!loop) return;
        var max = visibleCount() * width + loop;
        while (pos >= max) pos -= loop;
        while (pos < 0) pos += loop;
    }

    function paint() {
        wrapPos();
        track.style.transition = 'none';
        track.style.transform = 'translate3d(' + -pos + 'px, 0, 0)';
    }

    function tick(now) {
        if (!last) last = now;
        var dt = now - last;
        last = now;
        if (dt > 48) dt = 48;
        if (!hovering && !dragging && !focused && !document.hidden) {
            pos += itemWidth() * dt / STEP_MS;
            paint();
        }
        raf = window.requestAnimationFrame(tick);
    }

    root.addEventListener('mouseenter', function () {
        hovering = true;
    });
    root.addEventListener('mouseleave', function () {
        hovering = false;
    });
    root.addEventListener('focusin', function (ev) {
        focused = true;
        var link = ev.target.closest('.hero-tool');
        if (!link || link.hasAttribute('data-hero-tool-clone')) return;
        var idx = originals.indexOf(link);
        if (idx < 0) return;
        var width = itemWidth();
        var lead = visibleCount();
        var left = ((pos / width - lead) % count + count) % count;
        var seen = false;
        for (var i = 0; i < lead; i++) {
            if ((Math.round(left) + i) % count === idx) seen = true;
        }
        if (!seen) {
            pos = (lead + idx) * width;
            paint();
        }
    });
    root.addEventListener('focusout', function (ev) {
        if (root.contains(ev.relatedTarget)) return;
        focused = false;
    });

    var drag = null;
    function onPointerMove(ev) {
        if (!drag || ev.pointerId !== drag.id) return;
        drag.moved = ev.clientX - drag.x;
        if (Math.abs(drag.moved) <= 6) return;
        suppressClick = true;
        pos = drag.base - drag.moved;
        paint();
    }
    function onPointerUp(ev) {
        if (!drag || (ev && ev.pointerId !== drag.id)) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        drag = null;
        dragging = false;
        root.classList.remove('is-dragging');
        paint();
    }
    viewport.addEventListener('dragstart', function (ev) {
        ev.preventDefault();
    });
    viewport.addEventListener('pointerdown', function (ev) {
        if (ev.button != null && ev.button !== 0) return;
        dragging = true;
        drag = { id: ev.pointerId, x: ev.clientX, base: pos, moved: 0 };
        root.classList.add('is-dragging');
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
        var width = itemWidth() || 1;
        var logical = ((pos / width - visibleCount()) % count + count) % count;
        rebuild();
        pos = (visibleCount() + logical) * itemWidth();
        paint();
    }

    rebuild();
    pos = visibleCount() * itemWidth();
    paint();
    raf = window.requestAnimationFrame(tick);

    window.addEventListener('resize', relayout);
    if (narrowQuery && typeof narrowQuery.addEventListener === 'function') {
        narrowQuery.addEventListener('change', relayout);
    }
})();
