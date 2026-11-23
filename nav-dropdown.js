
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
                '<a class="nav-mega-link" data-nav-sales-in-tools href="/sales-terminals"><span class="nav-mega-link-title">终端</span><span class="nav-mega-link-desc">星系 · 区域 · 站点 · 在售物品</span></a>';
            toolsList.insertBefore(row, toolsList.firstChild);
        }
        var serverIp = toolsList && toolsList.querySelector('a[href*="server-ip"]');
        if (serverIp) toolsList.appendChild(serverIp);
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
    };

    function decorateToolIcons(toolsList) {
        if (!toolsList) return;
        toolsList.querySelectorAll('.nav-mega-link').forEach(function (link) {
            if (link.querySelector('.nav-mega-link-icon')) return;
            var href = link.getAttribute('href') || '';
            var key = Object.keys(TOOL_MENU_ICONS).filter(function (name) {
                return href.indexOf(name) !== -1;
            })[0];
            if (!key) return;
            var icon = document.createElement('span');
            icon.className = 'nav-mega-link-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = TOOL_MENU_ICONS[key];
            icon.style.cssText = 'grid-row:1 / span 2;width:1.55rem;height:1.55rem;color:#8ee0ff;display:flex;';
            var svg = icon.querySelector('svg');
            if (svg) svg.style.cssText = 'width:100%;height:100%;display:block;';
            link.insertBefore(icon, link.firstChild);
            link.style.display = 'grid';
            link.style.gridTemplateColumns = '1.55rem minmax(0,1fr)';
            link.style.columnGap = '0.7rem';
            link.style.alignItems = 'center';
            link.style.minWidth = '0';
            link.style.width = '100%';
            var title = link.querySelector('.nav-mega-link-title');
            if (title) title.style.marginBottom = '0.12rem';
            var desc = link.querySelector('.nav-mega-link-desc');
            if (desc) {
                desc.title = desc.textContent;
                desc.style.overflow = 'hidden';
                desc.style.whiteSpace = 'nowrap';
                desc.style.textOverflow = 'ellipsis';
            }
        });
        toolsList.style.gridTemplateColumns = 'repeat(3, 15.5rem)';
        toolsList.style.columnGap = '2.25rem';
        toolsList.style.rowGap = '1.25rem';
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
