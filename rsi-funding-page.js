
(function () {
    if (typeof document === 'undefined') return;

    var gateEl = document.getElementById('rsiFundingGate');
    var mainEl = document.getElementById('rsiFundingMain');

    function sync() {
        if (gateEl) gateEl.hidden = true;
        if (mainEl) mainEl.hidden = false;
        if (window.UssNavTools && typeof window.UssNavTools.refresh === 'function') {
            window.UssNavTools.refresh();
        }
    }

    sync();
    window.addEventListener('storage', sync);
    try {
        var obs = new MutationObserver(sync);
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {
        /* ignore */
    }
})();
