/**
 * 首页 Hero — 双图循环 + 缩略图切换条 + 鼠标平移视差
 */
(function () {
    'use strict';

    var hero = document.getElementById('homeHero');
    var layer = document.getElementById('heroMediaLayer');
    var picker = document.getElementById('heroSlidePicker');
    if (!hero || !layer) return;

    var slides = layer.querySelectorAll('.hero-media__img');
    var cards = picker ? picker.querySelectorAll('.hero-slide-card') : [];
    var slideIndex = 0;
    var slideStart = 0;
    var progressRaf = 0;
    var SLIDE_MS = 7000;
    var targetX = 0;
    var targetY = 0;
    var curX = 0;
    var curY = 0;
    var active = false;
    var tickId = 0;
    var MAX_PAN_X = 10;
    var MAX_PAN_Y = 8;
    var reduceMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mobileHero =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 600px)').matches;

    function markLive() {
        if (document.documentElement.classList.contains('hero-video-live')) return;
        document.documentElement.classList.remove('hero-video-pending');
        document.documentElement.classList.add('hero-video-live');
        try {
            window.dispatchEvent(new CustomEvent('uss:hero-live'));
        } catch (e) {
            /* ignore */
        }
    }

    function syncCards() {
        for (var i = 0; i < cards.length; i++) {
            var on = i === slideIndex;
            cards[i].classList.toggle('is-active', on);
            cards[i].setAttribute('aria-current', on ? 'true' : 'false');
        }
    }

    function setChargeProgress(idx, ratio) {
        if (!cards.length) return;
        var clamped = Math.min(1, Math.max(0, ratio));
        for (var i = 0; i < cards.length; i++) {
            var fill = cards[i].querySelector('.hero-slide-card__charge-fill');
            if (!fill) continue;
            if (i === idx) fill.style.transform = 'scaleX(' + clamped + ')';
            else fill.style.transform = 'scaleX(0)';
        }
    }

    function showSlide(nextIdx, resetTimer) {
        if (!slides.length) return;
        var idx = ((nextIdx % slides.length) + slides.length) % slides.length;
        if (idx === slideIndex && resetTimer !== true) return;
        slides[slideIndex].classList.remove('is-active');
        slideIndex = idx;
        slides[slideIndex].classList.add('is-active');
        syncCards();
        if (resetTimer !== false) {
            slideStart = performance.now();
            setChargeProgress(slideIndex, 0);
        }
    }

    function nextSlide() {
        showSlide(slideIndex + 1);
    }

    function progressLoop(now) {
        if (!slideStart) slideStart = now;
        var elapsed = now - slideStart;
        var pct = elapsed / SLIDE_MS;
        if (pct >= 1) {
            nextSlide();
            slideStart = now;
            pct = 0;
        }
        setChargeProgress(slideIndex, pct);
        progressRaf = window.requestAnimationFrame(progressLoop);
    }

    function startSlideshow() {
        if (progressRaf || slides.length < 2 || reduceMotion) {
            setChargeProgress(slideIndex, reduceMotion ? 1 : 0);
            return;
        }
        slideStart = performance.now();
        setChargeProgress(slideIndex, 0);
        progressRaf = window.requestAnimationFrame(progressLoop);
    }

    function onFirstSlideReady() {
        markLive();
        syncCards();
        startSlideshow();
    }

    if (slides.length) {
        var first = slides[0];
        if (first.complete) onFirstSlideReady();
        else {
            first.addEventListener('load', onFirstSlideReady, { once: true });
            first.addEventListener('error', onFirstSlideReady, { once: true });
        }
        for (var i = 1; i < slides.length; i++) {
            var s = slides[i];
            if (s.getAttribute('src')) {
                var pre = new Image();
                pre.src = s.getAttribute('src');
            }
        }
    } else {
        onFirstSlideReady();
    }

    if (picker) {
        picker.addEventListener('click', function (ev) {
            var btn = ev.target.closest('.hero-slide-card');
            if (!btn) return;
            var idx = Number(btn.getAttribute('data-slide'));
            if (!Number.isFinite(idx)) return;
            showSlide(idx);
            slideStart = performance.now();
        });
    }

    function panPx() {
        return {
            x: curX * MAX_PAN_X,
            y: curY * MAX_PAN_Y,
        };
    }

    function applyTransform() {
        if (reduceMotion || mobileHero) {
            layer.style.transform = 'translate3d(0, 0, 0)';
            return;
        }
        var p = panPx();
        layer.style.transform =
            'translate3d(' + p.x.toFixed(2) + 'px, ' + p.y.toFixed(2) + 'px, 0)';
    }

    function tick() {
        tickId = window.requestAnimationFrame(function () {
            var ease = active ? 0.11 : 0.07;
            curX += (targetX - curX) * ease;
            curY += (targetY - curY) * ease;
            applyTransform();
            if (Math.abs(curX - targetX) > 0.0005 || Math.abs(curY - targetY) > 0.0005) {
                tick();
            } else {
                curX = targetX;
                curY = targetY;
                applyTransform();
                tickId = 0;
            }
        });
    }

    function queueTick() {
        if (!tickId) tick();
    }

    function onMove(ev) {
        if (reduceMotion || mobileHero) return;
        var rect = hero.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        targetX = (ev.clientX - rect.left) / rect.width - 0.5;
        targetY = (ev.clientY - rect.top) / rect.height - 0.5;
        active = true;
        queueTick();
    }

    function onLeave() {
        targetX = 0;
        targetY = 0;
        active = false;
        queueTick();
    }

    hero.addEventListener('mousemove', onMove);
    hero.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', applyTransform);

    applyTransform();
})();
