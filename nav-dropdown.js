
(function () {
    if (typeof document === 'undefined') return;

    var header = document.querySelector('.site-header');

    function syncMegaContentLeft() {
        if (!header) return;
        var toggle = header.querySelector('.nav-links .nav-dropdown:first-child .nav-dropdown-toggle');
        if (!toggle) return;

        var headerLeft = header.getBoundingClientRect().left;
        var textNode = null;
        var i;
        for (i = 0; i < toggle.childNodes.length; i++) {
            var node = toggle.childNodes[i];
            if (node.nodeType === 3 && String(node.textContent).trim()) {
                textNode = node;
                break;
            }
        }

        var left;
        if (textNode) {
            var text = textNode.textContent || '';
            var start = 0;
            while (start < text.length && /\s/.test(text.charAt(start))) start += 1;
            var range = document.createRange();
            range.setStart(textNode, start);
            range.setEnd(textNode, Math.min(start + 1, text.length));
            left = range.getBoundingClientRect().left - headerLeft;
        } else {
            var cs = window.getComputedStyle(toggle);
            left =
                toggle.getBoundingClientRect().left -
                headerLeft +
                parseFloat(cs.paddingLeft) +
                parseFloat(cs.borderLeftWidth);
        }

        header.style.setProperty('--nav-mega-content-left', Math.round(left) + 'px');
    }

    function closeAll() {
        document.querySelectorAll('.nav-dropdown.is-open').forEach(function (el) {
            el.classList.remove('is-open');
            var btn = el.querySelector('.nav-dropdown-toggle');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        });
        document.querySelectorAll('.nav-mega-panel').forEach(function (panel) {
            panel.hidden = true;
        });
        if (header) header.classList.remove('is-mega-open');
    }

    function openMega(wrap, panelId) {
        var panel = document.getElementById(panelId);
        if (!panel) return;
        wrap.classList.add('is-open');
        var btn = wrap.querySelector('.nav-dropdown-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        syncMegaContentLeft();
        panel.hidden = false;
        if (header) header.classList.add('is-mega-open');
    }

    document.querySelectorAll('.nav-dropdown').forEach(function (wrap) {
        var btn = wrap.querySelector('.nav-dropdown-toggle');
        if (!btn) return;
        var panelId = btn.getAttribute('data-mega-target') || btn.getAttribute('aria-controls');
        if (!panelId) return;

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var isOpen = wrap.classList.contains('is-open');
            closeAll();
            if (!isOpen) openMega(wrap, panelId);
        });
    });

    document.querySelectorAll('.nav-mega-panel').forEach(function (panel) {
        panel.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    });

    document.addEventListener('click', function () {
        closeAll();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAll();
    });

    syncMegaContentLeft();
    window.addEventListener('resize', syncMegaContentLeft);
    window.addEventListener('load', syncMegaContentLeft);

    function mergeCatalogNav() {
        var shipBtn = document.querySelector('[data-mega-target="navMegaShip"]');
        var equipBtn = document.querySelector('[data-mega-target="navMegaEquipment"]');
        if (!shipBtn) return;
        var wrap = shipBtn.closest('.nav-dropdown');
        if (!wrap || wrap.querySelector('.nav-catalog-link')) {
            placeToolsAfterCatalog();
            return;
        }
        var link = document.createElement('a');
        link.className = 'nav-dropdown-toggle nav-catalog-link';
        link.href = '/ship-components';
        link.style.textDecoration = 'none';
        link.textContent = '组件';
        wrap.replaceChild(link, shipBtn);
        if (equipBtn) {
            var equipWrap = equipBtn.closest('.nav-dropdown');
            if (equipWrap) equipWrap.hidden = true;
        }
        var shipPanel = document.getElementById('navMegaShip');
        var equipPanel = document.getElementById('navMegaEquipment');
        if (shipPanel) shipPanel.hidden = true;
        if (equipPanel) equipPanel.hidden = true;

        var marketBtn = document.querySelector('[data-mega-target="navMegaMarket"]');
        if (marketBtn) {
            var marketWrap = marketBtn.closest('.nav-dropdown');
            if (marketWrap && !marketWrap.querySelector('.nav-market-link')) {
                var marketLink = document.createElement('a');
                marketLink.className = 'nav-dropdown-toggle nav-market-link';
                marketLink.href = '/market.html';
                marketLink.style.textDecoration = 'none';
                marketLink.textContent = '商城';
                marketWrap.replaceChild(marketLink, marketBtn);
            }
        }
        var marketPanel = document.getElementById('navMegaMarket');
        if (marketPanel) marketPanel.hidden = true;

        var salesBtn = document.querySelector('[data-mega-target="navMegaSales"]');
        if (salesBtn) {
            var salesWrap = salesBtn.closest('.nav-dropdown');
            if (salesWrap) salesWrap.hidden = true;
        }
        var salesPanel = document.getElementById('navMegaSales');
        if (salesPanel) salesPanel.hidden = true;
        var toolsList = document.querySelector('#navMegaTools .nav-mega-list');
        if (toolsList && !toolsList.querySelector('[data-nav-sales-in-tools]')) {
            var row = document.createElement('li');
            row.className = 'nav-mega-tools-row';
            row.innerHTML =
                '<a class="nav-mega-link" data-nav-sales-in-tools href="/sales-terminals"><span class="nav-mega-link-title">终端</span><span class="nav-mega-link-desc">星系 · 星球 · 卫星 · 站点 · 在售物品</span></a>';
            toolsList.insertBefore(row, toolsList.firstChild);
        }
        var serverIp = toolsList && toolsList.querySelector('a[href*="server-ip"]');
        var hangar = toolsList && toolsList.querySelector('a[href*="executive-hangar"]');
        if (serverIp && hangar) hangar.insertAdjacentElement('afterend', serverIp);
        decorateToolIcons(toolsList);
        placeToolsAfterCatalog();
    }

    var TOOL_MENU_ICONS = {
        'sales-terminals':
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 4h18v12H3V4zm2 2v8h14V6H5zm3 12h8v2H8v-2z"/></svg>',
        'blueprint-crafting':
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h8l5 5v15H6V2zm7 1.6V8h4.2L13 3.6zM8 12h8v1.6H8V12zm0 3.4h8V17H8v-1.6z"/></svg>',
        'executive-hangar':
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2.2a7.8 7.8 0 110 15.6 7.8 7.8 0 010-15.6zM9.3 7.4h1.7v3.1h2.7V7.4h1.7v9.2h-1.7v-3.6h-2.7v3.6H9.3V7.4z"/></svg>',
        minerals:
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.2 3.2l6.6 6.6-1.6 1.6-2.2-2.2-8.4 8.4-2.3.5.5-2.3 8.4-8.4-2.2-2.2 1.2-2zM4 18.2l2.2-2.2 1.8 1.8-2.2 2.2H4v-1.8z"/></svg>',
        'cargo-grid':
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16v16H4V4zm2 2v5h5V6H6zm7 0v5h5V6h-5zM6 13v5h5v-5H6zm7 0v5h5v-5h-5z"/></svg>',
        'server-ip':
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 3h16v6H4V3zm2 2v2h2V5H6zm8 0v2h4V5h-4zM4 10h16v6H4v-6zm2 2v2h2v-2H6zm8 0v2h4v-2h-4zM4 17h16v4H4v-4zm2 1.2v1.6h2v-1.6H6z"/></svg>',
        missions:
            '<svg viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true"><path d="M971.53 1024H48.71V0h610l312.82 323.99V1024zM161.86 910.85h696.52V369.7l-247.7-256.55H161.86v797.7z"/><path d="M422.1 753.25L257.63 588.78l80.01-80.01 84.46 84.46 223.07-223.07 80.01 80.01z"/></svg>',
    };

    function toolPathKey(value) {
        var raw = String(value || '').split('?')[0].split('#')[0].replace(/\\/g, '/');
        var parts = raw.split('/');
        var last = parts[parts.length - 1] || '';
        return last.replace(/\.html$/i, '');
    }

    function syncToolCurrent(link) {
        var here = toolPathKey(window.location.pathname);
        var there = toolPathKey(link.getAttribute('href'));
        if (here && there && here === there) link.classList.add('is-current');
    }

    function wireToolsPointer(toolsList) {
        if (!toolsList || toolsList.dataset.pointerBound) return;
        toolsList.dataset.pointerBound = '1';
        toolsList.style.position = 'relative';
        var follow = document.createElement('span');
        follow.className = 'nav-mega-follow';
        follow.setAttribute('aria-hidden', 'true');
        follow.style.position = 'absolute';
        follow.style.left = '0';
        follow.style.top = '0';
        follow.style.pointerEvents = 'none';
        follow.style.zIndex = '0';
        toolsList.appendChild(follow);
        var active = null;

        function pad() {
            var root = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
            return { x: 0.48 * root, y: 0.38 * root };
        }

        function place(target, animate) {
            if (!target) return;
            var listRect = toolsList.getBoundingClientRect();
            if (listRect.width < 1) return;
            var rect = target.getBoundingClientRect();
            var inset = pad();
            var motion = animate !== false && toolsList.classList.contains('is-follow');
            if (!motion) follow.style.transition = 'none';
            follow.style.width = rect.width + inset.x * 2 + 'px';
            follow.style.height = rect.height + inset.y * 2 + 'px';
            follow.style.transform =
                'translate(' +
                (rect.left - listRect.left - inset.x) +
                'px,' +
                (rect.top - listRect.top - inset.y) +
                'px)';
            if (!motion) {
                follow.offsetHeight;
                follow.style.transition = '';
            }
            toolsList.classList.add('is-follow');
            active = target;
        }

        toolsList.addEventListener('pointermove', function (event) {
            var node = event.target;
            if (!node || !node.closest) return;
            var link = node.closest('.nav-mega-link');
            if (!link || !toolsList.contains(link)) return;
            if (link === active && toolsList.classList.contains('is-follow')) return;
            place(link);
        });
        toolsList.addEventListener('pointerleave', function () {
            toolsList.classList.remove('is-follow');
            active = null;
        });
        toolsList.addEventListener('focusin', function (event) {
            var node = event.target;
            if (!node || !node.closest) return;
            var link = node.closest('.nav-mega-link');
            if (link && toolsList.contains(link)) place(link);
        });
        toolsList.addEventListener('focusout', function (event) {
            var next = event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest('.nav-mega-link');
            if (next && toolsList.contains(next)) return;
            toolsList.classList.remove('is-follow');
            active = null;
        });
        window.addEventListener('resize', function () {
            if (active && toolsList.classList.contains('is-follow')) place(active, false);
        });
    }

    function decorateToolIcons(toolsList) {
        if (!toolsList) return;
        toolsList.querySelectorAll('.nav-mega-link').forEach(function (link) {
            syncToolCurrent(link);
            if (link.querySelector('.nav-mega-link-icon')) return;
            var href = link.getAttribute('href') || '';
            var key = Object.keys(TOOL_MENU_ICONS).filter(function (name) {
                return href.indexOf(name) !== -1;
            })[0];
            if (!key) return;
            var missions = key === 'missions';
            var icon = document.createElement('span');
            icon.className = 'nav-mega-link-icon' + (missions ? ' nav-mega-link-icon--missions' : '');
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = TOOL_MENU_ICONS[key];
            icon.style.cssText =
                'grid-row:1 / span 2;display:flex;align-items:center;justify-content:center;width:' +
                (missions ? '1rem' : '1.55rem') +
                ';height:' +
                (missions ? '1rem' : '1.55rem') +
                ';' +
                (missions ? 'justify-self:center;align-self:center;' : '');
            var svg = icon.querySelector('svg');
            if (svg) svg.style.cssText = 'width:100%;height:100%;display:block;';
            link.insertBefore(icon, link.firstChild);
            link.style.display = 'grid';
            link.style.gridTemplateColumns = '1.55rem minmax(0,1fr)';
            link.style.columnGap = '0.7rem';
            link.style.alignItems = 'center';
            link.style.minWidth = '0';
            link.style.width = '100%';
            link.style.position = 'relative';
            link.style.zIndex = '1';
            var title = link.querySelector('.nav-mega-link-title');
            if (title) title.style.marginBottom = '0.12rem';
            var desc = link.querySelector('.nav-mega-link-desc');
            if (desc) desc.title = desc.textContent;
        });
        applyToolsMenuLayout(toolsList);
        wireToolsPointer(toolsList);
        if (!toolsList.dataset.layoutBound) {
            toolsList.dataset.layoutBound = '1';
            window.addEventListener('resize', function () {
                applyToolsMenuLayout(toolsList);
            });
        }
    }

    function applyToolsMenuLayout(toolsList) {
        if (!toolsList) return;
        var narrow = window.matchMedia('(max-width: 900px)').matches;
        toolsList.style.gridTemplateColumns = narrow ? 'minmax(0, 1fr)' : 'repeat(4, 13.25rem)';
        toolsList.style.columnGap = narrow ? '0' : '2.25rem';
        toolsList.style.rowGap = '1.25rem';
        toolsList.querySelectorAll('.nav-mega-link-desc').forEach(function (desc) {
            desc.style.overflow = narrow ? 'visible' : 'hidden';
            desc.style.whiteSpace = narrow ? 'normal' : 'nowrap';
            desc.style.textOverflow = narrow ? 'clip' : 'ellipsis';
        });
    }

    function placeToolsAfterCatalog() {
        var catalog = document.querySelector('.nav-catalog-link');
        var tools = document.getElementById('navToolsWrap');
        if (!catalog || !tools) return;
        var catalogWrap = catalog.closest('.nav-dropdown');
        if (!catalogWrap || !catalogWrap.parentNode) return;
        if (catalogWrap.nextElementSibling !== tools) {
            catalogWrap.parentNode.insertBefore(tools, catalogWrap.nextSibling);
        }
    }

    mergeCatalogNav();

    if (!document.querySelector('script[src*="visit-tracker.js"]')) {
        var vs = document.createElement('script');
        vs.src = 'visit-tracker.js?v=2';
        vs.defer = true;
        document.body.appendChild(vs);
    }
})();
