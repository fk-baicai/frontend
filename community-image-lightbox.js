/**
 * 社区图片灯箱：滚轮缩放、按住拖动平移。
 * 首页聊天区与帖子详情页共用。
 */
(function (global) {
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 8;
    const ZOOM_STEP = 0.12;

    const state = {
        scale: 1,
        tx: 0,
        ty: 0,
        dragging: false,
        dragMoved: false,
        lastX: 0,
        lastY: 0,
        wired: false,
        keyHandler: null,
        pointers: {},
        pinchDist: 0,
        pinchScale: 1,
    };

    function getOverlay() {
        return document.getElementById('communityImageLightbox');
    }

    function getImg(overlay) {
        const root = overlay || getOverlay();
        return root ? root.querySelector('.community-image-lightbox-img') : null;
    }

    function getCreditEl(overlay) {
        const root = overlay || getOverlay();
        return root ? root.querySelector('.community-image-lightbox-by') : null;
    }

    function setCredit(overlay, by) {
        const el = getCreditEl(overlay);
        if (!el) return;
        const name = String(by || '').trim();
        if (!name) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = 'by:' + name;
    }

    function notifyChange() {
        try {
            document.dispatchEvent(new CustomEvent('uss-community-lightbox-change'));
        } catch (e) {
            /* ignore */
        }
    }

    function getFrame(overlay) {
        const root = overlay || getOverlay();
        return root ? root.querySelector('.community-image-lightbox-frame') : null;
    }

    function applyTransform(img) {
        const frame = getFrame() || (img && img.closest && img.closest('.community-image-lightbox-frame'));
        const el = frame || img;
        if (!el) return;
        el.style.transform = 'translate(' + state.tx + 'px, ' + state.ty + 'px) scale(' + state.scale + ')';
    }

    function resetTransform(img) {
        state.scale = 1;
        state.tx = 0;
        state.ty = 0;
        state.dragging = false;
        state.dragMoved = false;
        state.pointers = {};
        state.pinchDist = 0;
        state.pinchScale = 1;
        const frame = getFrame() || (img && img.closest && img.closest('.community-image-lightbox-frame'));
        if (frame) frame.style.transform = '';
        if (img) {
            img.style.transform = '';
            img.classList.remove('is-dragging');
        }
    }

    function pointerList() {
        return Object.keys(state.pointers).map(function (id) {
            return state.pointers[id];
        });
    }

    function pointerDist(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function pointerMid(a, b) {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function wireIfNeeded(overlay) {
        if (state.wired || !overlay) return;
        const img = getImg(overlay);
        if (!img) return;
        state.wired = true;

        overlay.addEventListener('click', function (ev) {
            if (ev.target === overlay) close();
        });

        img.addEventListener('click', function (ev) {
            ev.stopPropagation();
            if (!state.dragMoved && state.scale <= 1) close();
        });

        overlay.addEventListener(
            'pointerdown',
            function (ev) {
                if (!overlay.classList.contains('is-open')) return;
                if (ev.target !== overlay && ev.target !== img && !img.contains(ev.target)) return;
                state.pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
                const pts = pointerList();
                if (pts.length >= 2) {
                    state.dragging = false;
                    state.pinchDist = pointerDist(pts[0], pts[1]);
                    state.pinchScale = state.scale;
                    state.dragMoved = true;
                    try {
                        overlay.setPointerCapture(ev.pointerId);
                    } catch (e) {
                        /* ignore */
                    }
                    return;
                }
                if (ev.pointerType === 'mouse' && ev.button !== 0) return;
                ev.preventDefault();
                state.dragging = true;
                state.dragMoved = false;
                state.lastX = ev.clientX;
                state.lastY = ev.clientY;
                img.classList.add('is-dragging');
                try {
                    overlay.setPointerCapture(ev.pointerId);
                } catch (e2) {
                    /* ignore */
                }
            },
            { passive: false }
        );

        overlay.addEventListener(
            'pointermove',
            function (ev) {
                if (!overlay.classList.contains('is-open')) return;
                if (!state.pointers[ev.pointerId]) return;
                state.pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
                const pts = pointerList();
                if (pts.length >= 2 && state.pinchDist > 0) {
                    ev.preventDefault();
                    const d = pointerDist(pts[0], pts[1]);
                    const mid = pointerMid(pts[0], pts[1]);
                    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.pinchScale * (d / state.pinchDist)));
                    const rect = img.getBoundingClientRect();
                    const offsetX = mid.x - rect.left - rect.width / 2;
                    const offsetY = mid.y - rect.top - rect.height / 2;
                    const ratio = newScale / state.scale;
                    state.tx -= offsetX * (ratio - 1);
                    state.ty -= offsetY * (ratio - 1);
                    state.scale = newScale;
                    applyTransform(img);
                    return;
                }
                if (!state.dragging) return;
                ev.preventDefault();
                const dx = ev.clientX - state.lastX;
                const dy = ev.clientY - state.lastY;
                if (dx !== 0 || dy !== 0) state.dragMoved = true;
                state.tx += dx;
                state.ty += dy;
                state.lastX = ev.clientX;
                state.lastY = ev.clientY;
                applyTransform(img);
            },
            { passive: false }
        );

        function endPointer(ev) {
            delete state.pointers[ev.pointerId];
            const pts = pointerList();
            if (pts.length === 1) {
                state.dragging = true;
                state.lastX = pts[0].x;
                state.lastY = pts[0].y;
                state.pinchDist = 0;
                return;
            }
            state.dragging = false;
            state.pinchDist = 0;
            img.classList.remove('is-dragging');
        }

        overlay.addEventListener('pointerup', endPointer);
        overlay.addEventListener('pointercancel', endPointer);

        overlay.addEventListener(
            'wheel',
            function (ev) {
                if (!overlay.classList.contains('is-open')) return;
                ev.preventDefault();
                const delta = ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
                const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale * (1 + delta)));
                const rect = img.getBoundingClientRect();
                const offsetX = ev.clientX - rect.left - rect.width / 2;
                const offsetY = ev.clientY - rect.top - rect.height / 2;
                const ratio = newScale / state.scale;
                state.tx -= offsetX * (ratio - 1);
                state.ty -= offsetY * (ratio - 1);
                state.scale = newScale;
                applyTransform(img);
            },
            { passive: false }
        );
    }

    function ensureOverlay() {
        let overlay = getOverlay();
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'communityImageLightbox';
            overlay.className = 'community-image-lightbox';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-hidden', 'true');
            const img = document.createElement('img');
            img.className = 'community-image-lightbox-img';
            img.alt = '';
            img.decoding = 'async';
            img.draggable = false;
            const frame = document.createElement('div');
            frame.className = 'community-image-lightbox-frame';
            const credit = document.createElement('p');
            credit.className = 'community-image-lightbox-by';
            credit.hidden = true;
            frame.appendChild(img);
            frame.appendChild(credit);
            overlay.appendChild(frame);
            document.body.appendChild(overlay);
        } else if (!overlay.querySelector('.community-image-lightbox-frame')) {
            const img = overlay.querySelector('.community-image-lightbox-img');
            const frame = document.createElement('div');
            frame.className = 'community-image-lightbox-frame';
            const credit = document.createElement('p');
            credit.className = 'community-image-lightbox-by';
            credit.hidden = true;
            if (img) frame.appendChild(img);
            frame.appendChild(credit);
            overlay.appendChild(frame);
        }
        wireIfNeeded(overlay);
        return overlay;
    }

    function open(src, opts) {
        if (!src) return;
        const overlay = ensureOverlay();
        const img = getImg(overlay);
        if (!img) return;
        resetTransform(img);
        img.src = src;
        img.alt = '放大预览';
        const by = typeof opts === 'string' ? opts : opts && opts.by;
        setCredit(overlay, by);
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        notifyChange();
        if (state.keyHandler) document.removeEventListener('keydown', state.keyHandler);
        state.keyHandler = function (ev) {
            if (ev.key === 'Escape') close();
        };
        document.addEventListener('keydown', state.keyHandler);
    }

    function close() {
        const overlay = getOverlay();
        if (!overlay) return;
        const img = getImg(overlay);
        resetTransform(img);
        if (img) {
            img.removeAttribute('src');
            img.alt = '';
        }
        setCredit(overlay, '');
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        notifyChange();
        if (state.keyHandler) {
            document.removeEventListener('keydown', state.keyHandler);
            state.keyHandler = null;
        }
    }

    global.UssCommunityImageLightbox = {
        open: open,
        close: close,
        ensureOverlay: ensureOverlay,
    };
})(typeof window !== 'undefined' ? window : globalThis);
