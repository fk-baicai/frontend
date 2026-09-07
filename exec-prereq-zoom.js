(function () {
    'use strict';

    document.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest && ev.target.closest('[data-exec-zoom]');
        if (!btn) return;
        var src = btn.getAttribute('data-exec-zoom');
        if (!src || !window.UssCommunityImageLightbox) return;
        ev.preventDefault();
        if (src.indexOf('?') >= 0) src += '&v=20260908i';
        else src += '?v=20260908i';
        window.UssCommunityImageLightbox.open(src);
    });
})();
