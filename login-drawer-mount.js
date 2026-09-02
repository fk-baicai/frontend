
(function () {
    'use strict';
    if (document.getElementById('loginDrawer')) return;
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'login-drawer-snippet.html', false);
        xhr.send(null);
        if (xhr.status !== 200 || !xhr.responseText) return;
        var tpl = document.createElement('template');
        tpl.innerHTML = xhr.responseText.trim();
        document.body.appendChild(tpl.content);
    } catch (e) {
        /* ignore */
    }
})();
