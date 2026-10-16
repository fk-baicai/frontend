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
            ? window.matchMedia('(max-width: 600px)')
            : null;
    var originals = Array.prototype.slice.call(track.querySelectorAll('.hero-tool'));
    var count = originals.length;
    if (count < 2) return;

    var index = 0;
    var hovering = false;
    var dragging = false;
    var focused = false;
    var suppressClick = false;
    var animating = false;
    var raf = 0;
    var last = 0;
    var acc = 0;
    var STEP_MS = 1500;
    var ANIM_MS = 380;

    function visibleCount() {
        return 3;
    }

    function sliding() {
        return visibleCount() < count;
    }

    function itemGap() {
        var style = window.getComputedStyle(track);
        var gap = parseFloat(style.columnGap || style.gap || '0');
        return isFinite(gap) ? gap : 0;
    }

    function itemWidth() {
        var style = window.getComputedStyle(viewport);
        var pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
        var width = viewport.clientWidth - pad;
        if (!width) return 0;
        var visible = visibleCount();
        return (width - itemGap() * (visible - 1)) / visible;
    }

    function stepSize() {
        return itemWidth() + itemGap();
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

    function clearSize(node) {
        node.style.flex = '';
        node.style.maxWidth = '';
        node.style.width = '';
    }

    function rebuild() {
        root.classList.add('is-ready');
        root.classList.toggle('is-static', !sliding());
        for (var i = 0; i < originals.length; i++) {
            if (originals[i].parentNode) originals[i].parentNode.removeChild(originals[i]);
        }
        track.textContent = '';
        var slide = sliding();
        for (var n = 0; n < count; n++) {
            if (slide) sizeTool(originals[n]);
            else clearSize(originals[n]);
            track.appendChild(originals[n]);
        }
        if (slide) {
            var visible = visibleCount();
            for (var c = 0; c < visible; c++) {
                var clone = makeClone(originals[c]);
                sizeTool(clone);
                track.appendChild(clone);
            }
        }
        viewport.style.height = '';
    }

    function paint(animate) {
        if (!sliding()) {
            animating = false;
            track.style.transition = 'none';
            track.style.transform = 'none';
            return;
        }
        var step = stepSize();
        animating = !!animate;
        track.style.transition = animate ? 'transform ' + ANIM_MS + 'ms ease' : 'none';
        track.style.transform = 'translate3d(' + -index * step + 'px, 0, 0)';
    }

    track.addEventListener('transitionend', function (ev) {
        if (ev.target !== track || ev.propertyName !== 'transform') return;
        animating = false;
        if (index >= count) {
            index = 0;
            paint(false);
        }
    });

    function tick(now) {
        if (!last) last = now;
        var dt = now - last;
        last = now;
        if (dt > 200) dt = 0;
        if (!sliding() || hovering || dragging || focused || document.hidden) return raf = window.requestAnimationFrame(tick);
        acc += dt;
        if (!animating && acc >= STEP_MS) {
            acc -= STEP_MS;
            index += 1;
            paint(true);
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
        if (idx < 0) return;
        var start = ((index % count) + count) % count;
        var visible = visibleCount();
        for (var n = 0; n < visible; n++) {
            if ((start + n) % count === idx) return;
        }
        index = idx;
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
        var dx = ev.clientX - drag.x;
        drag.moved = dx;
        if (Math.abs(dx) <= 6) return;
        var step = stepSize();
        if (!step) return;
        if (!dragging) {
            dragging = true;
            suppressClick = true;
            root.classList.add('is-dragging');
        }
        var loop = count * step;
        var offset = drag.base - dx;
        offset = ((offset % loop) + loop) % loop;
        drag.offset = offset;
        animating = false;
        track.style.transition = 'none';
        track.style.transform = 'translate3d(' + -offset + 'px, 0, 0)';
    }
    function onPointerUp(ev) {
        if (!drag || (ev && ev.pointerId !== drag.id)) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        if (dragging) {
            var step = stepSize() || 1;
            index = Math.round((drag.offset || 0) / step) % count;
            if (index < 0) index += count;
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
        if (!sliding()) return;
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        if (ev.button != null && ev.button !== 0) return;
        var step = stepSize() || 0;
        drag = { id: ev.pointerId, x: ev.clientX, base: index * step, offset: index * step, moved: 0 };
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
        var logical = ((index % count) + count) % count;
        rebuild();
        index = logical;
        acc = 0;
        paint(false);
    }

    rebuild();
    index = 0;
    paint(false);
    raf = window.requestAnimationFrame(tick);

    window.addEventListener('resize', relayout);
    if (narrowQuery && typeof narrowQuery.addEventListener === 'function') {
        narrowQuery.addEventListener('change', relayout);
    }
})();
