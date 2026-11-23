(function () {
    var METHOD = { Ship: "飞船采矿", "Ground Vehicle": "载具采矿", FPS: "手工采矿" };
    var TYPE = {
        Planet: "行星",
        Moon: "卫星",
        Asteroid: "小行星",
        Outpost: "前哨站",
        Station: "空间站",
        Lagrange: "拉格朗日点",
        "Asteroid Belt": "小行星带",
        Asteroid_ValidQT: "小行星",
        Star: "恒星"
    };
    var LOC = {};
    var data = [];
    var sigRows = [];
    var craftMap = {};
    var craftOpen = "";
    var noteCounts = {};
    var NOTE_ICON = '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M777.6 829.6c0 14.2-11.9 25.8-26.6 25.8H198.7c-14.7 0-26.6-11.6-26.6-25.8V284.3c0-14.2 11.9-25.8 26.6-25.8h354.7v-68H198.7c-52.2 0-94.6 42.1-94.6 93.8v545.3c0 51.7 42.4 93.8 94.6 93.8H751c52.2 0 94.6-42.1 94.6-93.8V478.2h-68v351.4z"></path><path d="M914.4 216.3L864.2 165l-21.1-21.6-29.1-29.8c-6.4-6.5-15.2-10.2-24.3-10.2-9.2 0-17.9 3.7-24.3 10.3l-27.8 28.5-2.5 2.6-304.8 312.7c-0.4 0.4-0.8 0.8-1.2 1.3-0.4 0.5-0.8 0.9-1.2 1.4-0.1 0.1-0.1 0.2-0.2 0.3-0.3 0.4-0.6 0.8-0.9 1.3-0.1 0.1-0.1 0.2-0.2 0.3-0.3 0.5-0.6 0.9-0.9 1.4 0 0.1-0.1 0.1-0.1 0.2l-1.2 2.1-117.3 222.8c-7 13.3-4.4 29.6 6.3 40.1 6.5 6.4 15.1 9.7 23.8 9.7 5.6 0 11.3-1.4 16.5-4.3l217.7-120.5c0.1-0.1 0.3-0.2 0.4-0.2 0.4-0.2 0.7-0.4 1.1-0.7 0.2-0.1 0.4-0.3 0.6-0.4 0.3-0.2 0.6-0.4 1-0.6 0.2-0.1 0.4-0.3 0.6-0.4 0.3-0.2 0.6-0.4 0.9-0.7 0.2-0.2 0.4-0.3 0.6-0.5 0.3-0.2 0.6-0.5 0.9-0.7 0.2-0.2 0.4-0.3 0.5-0.5l0.9-0.9 0.4-0.4L870.4 309l16.3-16.7 27.8-28.5c12.8-13.2 12.8-34.3-0.1-47.5z m-92.7 45.3c-0.3 0.3-1.2 1.1-2.9 1.1-1.1 0-3.2-0.3-5.3-2.5l-42.1-43.1c-3.4-3.5-3.5-8.5-1.3-10.8l16.3-16.7c0.3-0.3 1.1-1.2 2.9-1.2 1.1 0 3.2 0.3 5.3 2.5l42.1 43.1c3.4 3.5 3.5 8.5 1.3 10.8l-1.6 1.6-14.7 15.2z m-103.5-2c1.4 1.7 2.9 3.5 4.5 5.1l42.1 43.1c2 2 4.1 3.9 6.2 5.7L554.9 535.2l-52.8-54 216.1-221.6z m-298 360l42.7-81.2 36.5 37.4-79.2 43.8z"></path></svg>';
    var method = "";
    var selected = "";
    var systemKey = "";
    var listPage = 0;
    var locPage = 0;

    function text(s) { return String(s == null ? "" : s); }
    function craftSpec(craft) {
        var size = text(craft && craft.size).trim();
        var klass = text(craft && craft.class_short_zh).trim();
        var grade = text(craft && craft.grade_letter).trim().toUpperCase();
        var group = text(craft && craft.group_zh).trim();
        var parts = [];
        if (group !== "武器" && group !== "护甲") {
            if (/^\d+$/.test(size)) parts.push("S" + size);
            else if (size) parts.push(size);
        }
        if (group !== "舰船武器" && group !== "护甲" && group !== "武器" && group !== "武器配件") {
            if (klass && /^[A-F]$/.test(grade)) parts.push(klass + grade);
            else if (klass) parts.push(klass);
        }
        return parts.join(" ");
    }
    function el(tag, cls, content) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (content != null) n.textContent = content;
        return n;
    }
    function locZh(name) {
        var raw = text(name).trim();
        if (!raw) return "";
        if (LOC[raw]) return LOC[raw];
        var system = LOC[raw.replace(/ System$/, "")];
        if (system) return system;
        var mine = raw.match(/^Mining Base (#.+)$/);
        if (mine) return "采矿区 " + mine[1];
        if (/^RMB-[A-Z0-9]+$/.test(raw)) return "焰火联合边远采矿基地 " + raw;
        return "";
    }
    function placeOf(name) {
        var raw = text(name);
        var zh = locZh(raw);
        return { zh: zh || raw || "—", en: raw, translated: !!(zh && zh !== raw) };
    }
    function systemOf(name) {
        var raw = text(name).replace(/ System$/, "");
        var zh = locZh(raw);
        return { zh: zh || raw, en: raw };
    }
    function byName(name) {
        return data.filter(function (item) { return item.name === name; })[0];
    }
    function zhName(name) {
        var hit = byName(name);
        return (hit && hit.name_zh) || name;
    }
    var SCAN = {
        "quantainium-raw": 3170,
        "stileron-ore": 3185,
        "savrilium-ore": 3200,
        "raw-ouratite": 3370,
        "riccite-ore": 3385,
        "lindinium-ore": 3400,
        "beryl-raw": 3540,
        "taranite-raw": 3555,
        "borase-ore": 3570,
        "gold-ore": 3585,
        "bexalite-raw": 3600,
        "laranite-raw": 3825,
        "aslarite-raw": 3840,
        "titanium-ore": 3855,
        "tungsten-ore": 3870,
        "agricium-ore": 3885,
        "torite-ore": 3900,
        "hephaestanite-r": 4180,
        "tin-ore": 4195,
        "quartz-raw": 4210,
        "corundum-raw": 4225,
        "copper-ore": 4240,
        "raw-silicon": 4255,
        "iron-ore": 4270,
        "aluminum-ore": 4285,
        "raw-ice": 4300
    };
    function oreKey(name) {
        return text(name).replace(/\s*\(.*\)/, "").replace(/^raw\s+/i, "").trim().toLowerCase();
    }
    function sigRow(item) {
        var key = oreKey(item && item.name);
        for (var i = 0; i < sigRows.length; i++) {
            if (oreKey(sigRows[i].name) === key) return sigRows[i];
        }
        return null;
    }
    function scanBase(item) {
        var row = sigRow(item);
        if (row && row.signals && row.signals.length) return row.signals[0];
        return SCAN[item.slug] || 0;
    }
    function signalsFor(item) {
        var row = sigRow(item);
        if (row && row.signals && row.signals.length) return row.signals;
        var base = SCAN[item.slug] || 0;
        if (!base) return [];
        var list = [];
        for (var i = 1; i <= 6; i++) list.push(base * i);
        return list;
    }
    function formatSig(n) {
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    function signalMatch(item, q) {
        var base = scanBase(item);
        var n = Number(q);
        var list = signalsFor(item);
        for (var i = 0; i < list.length; i++) if (list[i] === n) return i + 1;
        if (!base || !n || n % base !== 0) return 0;
        var count = n / base;
        return count >= 1 && count <= 6 ? count : 0;
    }
    function renderSignals(box, item) {
        var list = signalsFor(item);
        if (!list.length) return;
        var row = el("div", "min-signals");
        list.forEach(function (value, index) {
            var cell = el("div", "min-signal");
            cell.appendChild(el("span", "min-signal-k", "×" + (index + 1)));
            cell.appendChild(el("span", "min-signal-v", formatSig(value)));
            row.appendChild(cell);
        });
        box.appendChild(row);
    }
    function methodLabel(list) {
        return (list || []).map(function (m) { return METHOD[m] || m; }).join(" · ") || "未标注";
    }
    function pct(n) { return n == null ? "—" : n + "%"; }
    function chanceOf(loc) {
        if (loc.spawn == null || loc.occurrence == null) return null;
        return loc.spawn * loc.occurrence / 100;
    }
    function chanceText(n) {
        if (n == null) return "—";
        var rounded = Math.round(n * 10) / 10;
        return (rounded % 1 ? rounded.toFixed(1) : String(rounded)) + "%";
    }
    function matches(item, q) {
        if (method && (item.methods || []).indexOf(method) < 0) return false;
        if (!q) return true;
        if (/^\d+$/.test(q)) return signalMatch(item, q) > 0;
        var bag = (text(item.name_zh) + " " + text(item.name) + " " + text(item.signature)).toLowerCase();
        return bag.indexOf(q.toLowerCase()) >= 0;
    }
    function filtered() {
        var q = document.getElementById("minQuery").value.trim();
        return data.filter(function (item) { return matches(item, q); });
    }
    function groupsOf(item) {
        var groups = {};
        (item.locations || []).forEach(function (loc) {
            var key = loc.system || "未标注星系";
            (groups[key] = groups[key] || []).push(loc);
        });
        return groups;
    }
    function capacity(box, reserve, row) {
        var h = box ? box.clientHeight : 0;
        if (h < 120) h = Math.max(320, window.innerHeight - 280);
        return Math.max(4, Math.floor((h - reserve) / row));
    }
    function pager(parent, page, pages, kind) {
        var bar = el("div", "min-pager");
        if (pages <= 1) return bar;
        var prev = el("button", "min-page", "上一页");
        prev.type = "button";
        prev.disabled = page <= 0;
        prev.setAttribute("data-page-kind", kind);
        prev.setAttribute("data-page-dir", "-1");
        var label = el("span", "min-page-label", (page + 1) + " / " + pages);
        var next = el("button", "min-page", "下一页");
        next.type = "button";
        next.disabled = page >= pages - 1;
        next.setAttribute("data-page-kind", kind);
        next.setAttribute("data-page-dir", "1");
        bar.appendChild(prev);
        bar.appendChild(label);
        bar.appendChild(next);
        return bar;
    }
    function renderGrid() {
        var list = filtered();
        var grid = document.getElementById("minGrid");
        var status = document.getElementById("minStatus");
        var q = document.getElementById("minQuery").value.trim();
        var size = window.innerWidth <= 980 ? 8 : capacity(grid, 40, 46);
        var pages = Math.max(1, Math.ceil(list.length / size));
        if (listPage >= pages) listPage = pages - 1;
        if (listPage < 0) listPage = 0;
        grid.textContent = "";
        if (/^\d+$/.test(q)) {
            var hits = list.map(function (item) {
                return zhName(item.name) + " " + signalMatch(item, q) + " 颗";
            });
            status.textContent = hits.length ? "信号 " + formatSig(Number(q)) + "：" + hits.join("；") : "没有矿的扫描信号是 " + q + "。";
        } else {
            status.innerHTML = "<strong>" + list.length + "</strong> / " + data.length + " 种";
        }
        var slice = list.slice(listPage * size, listPage * size + size);
        var wrap = el("div", "min-list");
        slice.forEach(function (item) {
            var crafts = craftMap[oreKey(item.name)] || [];
            var btn = el("div", "min-row" + (item.slug === selected ? " is-on" : ""));
            btn.setAttribute("role", "button");
            btn.tabIndex = 0;
            btn.setAttribute("data-slug", item.slug);
            var main = el("span", "min-row-main");
            main.appendChild(el("span", "min-zh", item.name_zh || item.name));
            main.appendChild(el("span", "min-en", item.name));
            var craft = el("button", "min-craft" + (craftOpen === item.slug ? " is-on" : ""));
            craft.type = "button";
            craft.setAttribute("data-slug", item.slug);
            craft.disabled = !crafts.length;
            craft.setAttribute("aria-label", crafts.length ? "查看可制造武器" : "暂无用这种矿物制造的武器");
            craft.innerHTML = '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path d="M942.848 203.136a233.152 233.152 0 0 1-49.088 250.304c-72.512 74.88-183.424 85.632-268.8 36.416L563.2 558.336l44.8 44.928 25.6-27.84c12.8-12.8 36.288-12.8 49.088 0l213.312 220.352c12.8 12.8 12.8 36.416 0 49.28l-98.112 100.48c-12.8 12.8-36.288 12.8-49.088 0l-213.312-220.352c-12.8-12.8-12.8-36.352 0-49.216l23.488-25.664-42.688-42.816L224 939.136c-27.776 27.84-70.4 27.84-98.112 0L102.4 913.472a71.104 71.104 0 0 1 0-100.544l337.024-288.832-224-226.816h-70.4L64 162.56 130.112 94.016l134.4 83.456v70.592l226.112 235.392 66.112-55.68c-64-89.856-57.6-216.064 21.376-297.344a221.12 221.12 0 0 1 243.2-49.28L676.16 226.752l121.6 124.096 145.024-147.648zM183.488 840.704c-12.8-12.8-32-12.8-44.8 0-12.8 12.8-12.8 32.128 0 44.928 12.8 12.8 32 12.8 44.8 0 10.624-10.688 10.624-32.064 0-44.928z"></path></svg>';
            var side = el("span", "min-row-side");
            side.appendChild(el("span", "min-sig", scanBase(item) ? formatSig(scanBase(item)) : "—"));
            side.appendChild(el("span", "min-meta", methodLabel(item.methods)));
            btn.appendChild(main);
            btn.appendChild(craft);
            btn.appendChild(side);
            wrap.appendChild(btn);
        });
        grid.appendChild(wrap);
        grid.appendChild(pager(grid, listPage, pages, "list"));
    }
    function renderDetail(item) {
        var box = document.getElementById("minDetail");
        box.hidden = false;
        box.textContent = "";
        var head = el("div", "min-detail-head");
        var titles = el("div");
        titles.appendChild(el("p", "min-kicker", methodLabel(item.methods)));
        var nameLine = el("div", "min-name-line");
        nameLine.appendChild(el("h2", "", item.name_zh || item.name));
        nameLine.appendChild(noteButton(item.slug, item.name_zh || item.name));
        titles.appendChild(nameLine);
        titles.appendChild(el("span", "min-en", item.name));
        var sig = el("div", "min-sig-block");
        sig.appendChild(el("span", "min-sig-label", "单颗信号"));
        sig.appendChild(el("span", "min-sig-num", scanBase(item) ? formatSig(scanBase(item)) : "—"));
        head.appendChild(titles);
        head.appendChild(sig);
        box.appendChild(head);

        renderSignals(box, item);

        var groups = groupsOf(item);
        var keys = Object.keys(groups);
        if (!keys.length) {
            box.appendChild(el("p", "min-empty", "Wiki 没有列出可挖位置。"));
            return;
        }
        if (keys.indexOf(systemKey) < 0) systemKey = keys[0];
        var tabs = el("div", "min-systems");
        keys.forEach(function (key) {
            var sys = systemOf(key);
            var tab = el("button", "min-system" + (key === systemKey ? " is-on" : ""), sys.zh + " " + groups[key].length);
            tab.type = "button";
            tab.title = sys.en;
            tab.setAttribute("data-system", key);
            tabs.appendChild(tab);
        });
        box.appendChild(tabs);

        var locs = groups[systemKey].slice().sort(function (a, b) {
            var diff = (chanceOf(b) || 0) - (chanceOf(a) || 0);
            if (diff) return diff;
            return text(a.name).localeCompare(text(b.name));
        });
        var size = capacity(box, 250, 78) * 2;
        var pages = Math.max(1, Math.ceil(locs.length / size));
        if (locPage >= pages) locPage = pages - 1;
        if (locPage < 0) locPage = 0;
        var grid = el("div", "min-loc-grid");
        locs.slice(locPage * size, locPage * size + size).forEach(function (loc) {
            var place = placeOf(loc.name);
            var parent = placeOf(loc.parent);
            var card = el("article", "min-loc");
            var zhLine = [];
            if (place.translated) zhLine.push(place.zh);
            if (parent.translated) zhLine.push(parent.zh);
            var enLine = [];
            if (place.en) enLine.push(place.en);
            if (loc.parent && parent.en && parent.en !== place.en) enLine.push(parent.en);
            if (zhLine.length) {
                card.appendChild(el("div", "min-place-zh", zhLine.join(" · ")));
                if (enLine.length) card.appendChild(el("div", "min-place-en", enLine.join(" · ")));
            } else {
                card.appendChild(el("div", "min-place-zh", enLine.join(" · ") || "—"));
            }
            var meta = el("div", "min-loc-meta");
            meta.appendChild(el("span", "min-type", TYPE[loc.type] || loc.type || "—"));
            var spawn = el("span", "min-loc-stat");
            spawn.appendChild(el("span", "min-loc-k", "刷新"));
            spawn.appendChild(el("span", "min-spawn", pct(loc.spawn)));
            var occur = el("span", "min-loc-stat");
            occur.appendChild(el("span", "min-loc-k", "出现"));
            occur.appendChild(el("span", "min-occur", pct(loc.occurrence)));
            var chance = el("span", "min-loc-stat is-chance");
            chance.appendChild(el("span", "min-loc-k", "参考"));
            chance.appendChild(el("span", "min-chance", chanceText(chanceOf(loc))));
            meta.appendChild(spawn);
            meta.appendChild(occur);
            meta.appendChild(chance);
            card.appendChild(meta);
            grid.appendChild(card);
        });
        var wrap = el("div", "min-table-wrap");
        wrap.appendChild(grid);
        box.appendChild(wrap);
        box.appendChild(pager(box, locPage, pages, "loc"));
    }
    function select(slug) {
        if (slug !== selected) {
            systemKey = "";
            locPage = 0;
        }
        selected = slug;
        var item = data.filter(function (row) { return row.slug === slug; })[0];
        renderGrid();
        if (item) renderDetail(item);
        else document.getElementById("minDetail").hidden = true;
        if (slug && location.hash !== "#" + slug) history.replaceState(null, "", "#" + slug);
    }
    document.documentElement.classList.add("minerals-lock");
    document.getElementById("minDetail").addEventListener("click", function (ev) {
        var noteBtn = ev.target.closest(".min-note");
        if (!noteBtn) return;
        ev.preventDefault();
        ev.stopPropagation();
        openNotes(noteBtn.getAttribute("data-slug"));
    });
    document.getElementById("minGrid").addEventListener("click", function (ev) {
        var pageBtn = ev.target.closest(".min-page");
        if (pageBtn && pageBtn.getAttribute("data-page-kind") === "list") {
            listPage += Number(pageBtn.getAttribute("data-page-dir"));
            renderGrid();
            return;
        }
        var noteBtn = ev.target.closest(".min-note");
        if (noteBtn) {
            ev.stopPropagation();
            openNotes(noteBtn.getAttribute("data-slug"));
            return;
        }
        var craftBtn = ev.target.closest(".min-craft");
        if (craftBtn) {
            ev.stopPropagation();
            toggleCraft(craftBtn);
            return;
        }
        closeCraft();
        var btn = ev.target.closest(".min-row");
        if (!btn) return;
        select(btn.getAttribute("data-slug"));
    });
    document.getElementById("minGrid").addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        if (ev.target.closest(".min-craft")) return;
        var btn = ev.target.closest(".min-row");
        if (!btn) return;
        ev.preventDefault();
        select(btn.getAttribute("data-slug"));
    });
    document.addEventListener("click", function (ev) {
        if (ev.target.closest(".min-craft") || ev.target.closest(".min-craft-pop")) return;
        closeCraft();
    });
    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
            closeCraft();
            closeNotes();
        }
    });
    document.getElementById("minDetail").addEventListener("click", function (ev) {
        var pageBtn = ev.target.closest(".min-page");
        if (pageBtn && pageBtn.getAttribute("data-page-kind") === "loc") {
            locPage += Number(pageBtn.getAttribute("data-page-dir"));
            var current = data.filter(function (row) { return row.slug === selected; })[0];
            if (current) renderDetail(current);
            return;
        }
        var chip = ev.target.closest(".min-chip");
        if (chip) {
            select(chip.getAttribute("data-slug"));
            return;
        }
        var tab = ev.target.closest(".min-system");
        if (!tab) return;
        systemKey = tab.getAttribute("data-system");
        locPage = 0;
        var item = data.filter(function (row) { return row.slug === selected; })[0];
        if (item) renderDetail(item);
    });
    document.getElementById("minQuery").addEventListener("input", function () {
        listPage = 0;
        renderGrid();
    });
    document.querySelector(".min-filters").addEventListener("click", function (ev) {
        var btn = ev.target.closest(".min-filter");
        if (!btn) return;
        method = btn.getAttribute("data-method") || "";
        listPage = 0;
        Array.prototype.forEach.call(document.querySelectorAll(".min-filter"), function (node) {
            node.classList.toggle("is-on", node === btn);
        });
        renderGrid();
    });
    window.addEventListener("resize", function () {
        renderGrid();
        var item = data.filter(function (row) { return row.slug === selected; })[0];
        if (item) renderDetail(item);
    });
    function closeCraft() {
        craftOpen = "";
        var pop = document.getElementById("minCraftPop");
        if (pop) pop.remove();
        Array.prototype.forEach.call(document.querySelectorAll(".min-craft.is-on"), function (node) {
            node.classList.remove("is-on");
        });
    }
    function toggleCraft(button) {
        var slug = button.getAttribute("data-slug");
        if (craftOpen === slug) {
            closeCraft();
            return;
        }
        closeCraft();
        var item = data.filter(function (row) { return row.slug === slug; })[0];
        var crafts = (item && craftMap[oreKey(item.name)]) || [];
        if (!crafts.length) return;
        craftOpen = slug;
        button.classList.add("is-on");
        var pop = el("div", "min-craft-pop");
        pop.id = "minCraftPop";
        pop.appendChild(el("p", "min-craft-title", (item.name_zh || item.name) + " · 可制造蓝图"));
        var lastGroup = "";
        crafts.forEach(function (craft) {
            var group = craft.group_zh || "其他";
            if (group !== lastGroup) {
                lastGroup = group;
                var count = crafts.filter(function (row) { return (row.group_zh || "其他") === group; }).length;
                pop.appendChild(el("p", "min-craft-group", group + " " + count));
            }
            var link = document.createElement("a");
            link.className = "min-craft-link";
            link.href = "/blueprint-crafting?blueprint=" + encodeURIComponent(craft.uuid);
            var label = el("span", "min-place-zh", craft.name_zh || craft.name_en);
            var specText = craftSpec(craft);
            if (specText) label.appendChild(el("span", "min-craft-spec", specText));
            var sub = el("span", "min-place-en", [craft.type_label_zh, craft.name_en].filter(Boolean).join(" · "));
            link.appendChild(label);
            link.appendChild(sub);
            pop.appendChild(link);
        });
        document.body.appendChild(pop);
        var rect = button.getBoundingClientRect();
        var scrollX = window.scrollX || window.pageXOffset || 0;
        var scrollY = window.scrollY || window.pageYOffset || 0;
        var width = pop.offsetWidth;
        var height = pop.offsetHeight;
        var left = rect.left + scrollX;
        var viewRight = scrollX + window.innerWidth - 12;
        if (left + width > viewRight) left = viewRight - width;
        var top = rect.bottom + scrollY + 6;
        if (rect.bottom + height + 6 > window.innerHeight - 8) top = rect.top + scrollY - height - 6;
        pop.style.position = "absolute";
        pop.style.left = Math.max(scrollX + 8, left) + "px";
        pop.style.top = Math.max(8, top) + "px";
    }
    function noteButton(slug, label) {
        var btn = el("button", "min-craft min-note");
        btn.type = "button";
        btn.setAttribute("data-slug", slug);
        btn.setAttribute("aria-label", "查看" + label + "的留言");
        if (noteCounts[slug]) btn.setAttribute("data-count", String(noteCounts[slug]));
        btn.innerHTML = NOTE_ICON;
        return btn;
    }
    function closeNotes() {
        var mask = document.getElementById("minNoteMask");
        if (mask) mask.remove();
    }
    function assetUrl(rel) {
        if (!rel) return "";
        var value = String(rel);
        if (/^https?:\/\//i.test(value)) return value;
        if (window.UssAuthApi && typeof window.UssAuthApi.resolveAssetUrl === "function") {
            var resolved = window.UssAuthApi.resolveAssetUrl(value);
            if (resolved) return resolved;
        }
        var base = String(window.USS_AUTH_API_BASE || "").replace(/\/$/, "");
        if (!base) return value;
        return base + (value.charAt(0) === "/" ? value : "/" + value);
    }
    function personRow(note, withTime) {
        var row = el("div", "min-note-person");
        var avatar = document.createElement("img");
        avatar.className = "min-note-avatar";
        avatar.alt = "";
        avatar.referrerPolicy = "no-referrer";
        avatar.src = assetUrl(note.avatarUrl) || (window.USS_DEFAULT_AVATAR || "default-avatar.webp");
        var meta = el("div", "min-note-meta");
        var who = el("p", "min-note-who");
        who.appendChild(el("strong", "min-note-name", note.name || "访客"));
        if (withTime) {
            var time = el("time", "min-note-time", "");
            var when = new Date(note.at);
            time.textContent = isNaN(when.getTime()) ? "" : when.toLocaleString("zh-CN", { hour12: false });
            who.appendChild(time);
        }
        meta.appendChild(who);
        if (note.rankLabel || note.rankIcon) {
            var rank = el("p", "min-note-rank");
            if (note.rankIcon) {
                var icon = document.createElement("img");
                icon.className = "min-note-rank-icon";
                icon.alt = "";
                icon.referrerPolicy = "no-referrer";
                icon.src = assetUrl(note.rankIcon);
                rank.appendChild(icon);
            }
            if (note.rankLabel) rank.appendChild(document.createTextNode(note.rankLabel));
            meta.appendChild(rank);
        }
        row.appendChild(avatar);
        row.appendChild(meta);
        return row;
    }
    function paintNotes(list, notes) {
        list.textContent = "";
        if (!notes.length) {
            list.appendChild(el("p", "min-empty", "还没有留言。"));
            return;
        }
        notes.slice().reverse().forEach(function (note) {
            var item = el("article", "min-note-item");
            item.appendChild(personRow(note, true));
            item.appendChild(el("p", "min-note-text", note.text));
            list.appendChild(item);
        });
    }
    function markNoteCount(slug, count) {
        noteCounts[slug] = count;
        Array.prototype.forEach.call(document.querySelectorAll('.min-note[data-slug="' + slug + '"]'), function (btn) {
            if (count) btn.setAttribute("data-count", String(count));
            else btn.removeAttribute("data-count");
        });
    }
    function signedIn() {
        try {
            var raw = sessionStorage.getItem("ussHangzhouAuthSession") || localStorage.getItem("ussHangzhouAuthSession");
            var sess = raw ? JSON.parse(raw) : null;
            if (!sess || !sess.token) return null;
            var name = String(sess.rsiProfileHandle || sess.bindingId || "").trim();
            if (!name) return null;
            return {
                token: sess.token,
                name: name.slice(0, 32),
                avatarUrl: sess.avatarUrl || "",
                rankLabel: sess.rsiRankLabel || "",
                rankIcon: sess.rsiRankIconUrl || ""
            };
        } catch (e) {
            return null;
        }
    }
    function openNotes(slug) {
        var item = data.filter(function (row) { return row.slug === slug; })[0];
        if (!item) return;
        closeNotes();
        closeCraft();
        var mask = el("div", "min-note-mask");
        mask.id = "minNoteMask";
        var panel = el("div", "min-note-panel");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        var head = el("div", "min-note-head");
        head.appendChild(el("h3", "min-note-title", (item.name_zh || item.name) + " · 留言"));
        var close = el("button", "min-note-close", "关闭");
        close.type = "button";
        close.addEventListener("click", closeNotes);
        head.appendChild(close);
        var list = el("div", "min-note-list");
        list.appendChild(el("p", "min-empty", "正在读取留言。"));
        var viewer = signedIn();
        var form = document.createElement("form");
        form.className = "min-note-form";
        var name = document.createElement("input");
        name.maxLength = 16;
        name.required = !viewer;
        name.placeholder = "称呼";
        name.setAttribute("aria-label", "称呼");
        name.value = viewer ? viewer.name : (localStorage.getItem("min-note-name") || "");
        var text = document.createElement("textarea");
        text.maxLength = 120;
        text.required = true;
        text.rows = 3;
        text.placeholder = viewer ? "以 " + viewer.name + " 的身份留言" : "写一条留言，所有人都能看到";
        text.setAttribute("aria-label", "留言");
        var send = el("button", "min-note-send", "发布");
        send.type = "submit";
        if (viewer) {
            form.appendChild(personRow(viewer, false));
        } else {
            form.appendChild(name);
        }
        form.appendChild(text);
        form.appendChild(send);
        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            send.disabled = true;
            var headers = { "Content-Type": "application/json" };
            if (viewer) headers.Authorization = "Bearer " + viewer.token;
            fetch("/api/minerals/" + encodeURIComponent(slug) + "/notes", {
                method: "POST",
                headers: headers,
                body: JSON.stringify({ name: viewer ? viewer.name : name.value, text: text.value })
            }).then(function (res) {
                return res.json().then(function (body) { return { ok: res.ok, body: body }; });
            }).then(function (result) {
                send.disabled = false;
                if (!result.ok || !result.body || !result.body.ok) {
                    list.appendChild(el("p", "min-empty", (result.body && result.body.message) || "留言没有保存。"));
                    return;
                }
                if (!viewer) localStorage.setItem("min-note-name", name.value.trim());
                text.value = "";
                paintNotes(list, result.body.notes || []);
                markNoteCount(slug, (result.body.notes || []).length);
            }).catch(function () {
                send.disabled = false;
                list.appendChild(el("p", "min-empty", "留言没有保存。"));
            });
        });
        panel.appendChild(head);
        panel.appendChild(list);
        panel.appendChild(form);
        mask.appendChild(panel);
        mask.addEventListener("click", function (ev) {
            if (ev.target === mask) closeNotes();
        });
        document.body.appendChild(mask);
        if (viewer) text.focus();
        else name.focus();
        fetch("/api/minerals/" + encodeURIComponent(slug) + "/notes")
            .then(function (res) { if (!res.ok) throw new Error("bad"); return res.json(); })
            .then(function (body) { paintNotes(list, body.notes || []); })
            .catch(function () { list.textContent = ""; list.appendChild(el("p", "min-empty", "留言没有读到。")); });
    }
    function renderChart() {
        var box = document.getElementById("minChart");
        if (!box) return;
        box.textContent = "";
        if (!sigRows.length) {
            box.appendChild(el("p", "min-empty", "信号表还没有同步到。"));
            return;
        }
        var rows = sigRows.slice().sort(function (a, b) {
            return (a.signals[0] || 0) - (b.signals[0] || 0);
        });
        var min = Infinity;
        var max = 0;
        rows.forEach(function (row) {
            (row.signals || []).forEach(function (value) {
                if (value < min) min = value;
                if (value > max) max = value;
            });
        });
        var span = max - min || 1;
        function pos(value) { return 8 + ((value - min) / span) * 84; }
        var chart = el("div", "min-sig-chart");
        var head = el("div", "min-sig-head");
        head.appendChild(el("span", "", "矿物"));
        head.appendChild(el("span", "min-sig-col-rarity", "稀有度"));
        var scale = el("div", "min-sig-track");
        [min, Math.round((min + max) / 2), max].forEach(function (value) {
            var tick = el("span", "min-sig-tick", formatSig(value));
            tick.style.left = pos(value) + "%";
            scale.appendChild(tick);
        });
        head.appendChild(scale);
        head.appendChild(el("span", "", "留言"));
        chart.appendChild(head);
        rows.forEach(function (row) {
            var line = el("div", "min-sig-row");
            line.setAttribute("data-name", row.name);
            var name = el("div", "min-sig-name");
            name.appendChild(el("div", "min-place-zh", row.name_zh || row.name));
            if (row.name_zh) name.appendChild(el("div", "min-place-en", row.name));
            line.appendChild(name);
            line.appendChild(el("div", "min-rarity min-sig-col-rarity min-rarity-" + row.rarity, row.rarity_zh || row.rarity));
            var track = el("div", "min-sig-track");
            var signals = row.signals || [];
            if (signals.length > 1) {
                var bar = el("span", "min-sig-line min-rarity-" + row.rarity);
                bar.style.left = pos(signals[0]) + "%";
                bar.style.width = (pos(signals[signals.length - 1]) - pos(signals[0])) + "%";
                track.appendChild(bar);
            }
            signals.forEach(function (value, index) {
                var pill = document.createElement("button");
                pill.type = "button";
                pill.className = "min-sig-pill min-rarity-" + row.rarity;
                pill.textContent = formatSig(value);
                pill.style.left = pos(value) + "%";
                pill.setAttribute("data-i", String(index));
                pill.setAttribute("aria-label", (row.name_zh || row.name) + " " + (index + 1) + " 颗 " + formatSig(value));
                track.appendChild(pill);
            });
            line.appendChild(track);
            var mineral = data.filter(function (item) { return oreKey(item.name) === oreKey(row.name); })[0];
            if (mineral) line.appendChild(noteButton(mineral.slug, row.name_zh || row.name));
            chart.appendChild(line);
        });
        chart.addEventListener("click", function (ev) {
            var noteBtn = ev.target.closest(".min-note");
            if (noteBtn) {
                openNotes(noteBtn.getAttribute("data-slug"));
                return;
            }
            var row = ev.target.closest(".min-sig-row");
            if (!row) return;
            var pill = ev.target.closest(".min-sig-pill");
            if (pill) {
                var on = !pill.classList.contains("is-on");
                pill.classList.toggle("is-on", on);
                pill.setAttribute("aria-pressed", on ? "true" : "false");
                row.classList.add("is-on");
            } else if (row.classList.contains("is-on") && !row.querySelector(".min-sig-pill.is-on")) {
                row.classList.remove("is-on");
            } else if (!row.classList.contains("is-on")) {
                row.classList.add("is-on");
            } else {
                row.classList.remove("is-on");
                Array.prototype.forEach.call(row.querySelectorAll(".min-sig-pill.is-on"), function (node) {
                    node.classList.remove("is-on");
                    node.setAttribute("aria-pressed", "false");
                });
            }
            chart.classList.toggle("is-picking", !!chart.querySelector(".min-sig-row.is-on"));
        });
        box.appendChild(chart);
    }
    function fetchJson(url, fallback) {
        return fetch(url).then(function (res) {
            if (!res.ok) throw new Error("bad");
            return res.json();
        }).catch(function () {
            if (!fallback) return null;
            return fetch(fallback).then(function (res) { if (!res.ok) throw new Error("bad"); return res.json(); });
        });
    }
    Promise.all([
        fetchJson("/api/minerals/catalog", "minerals-data.json"),
        fetchJson("/api/minerals/locations", "minerals-loc.json"),
        fetchJson("/api/minerals/signatures", "minerals-signatures.json"),
        fetch("/api/minerals/notes/summary").then(function (res) { if (!res.ok) throw new Error("bad"); return res.json(); }).catch(function () { return { counts: {} }; })
    ])
        .then(function (parts) {
            var body = parts[0];
            LOC = (parts[1] && parts[1].names) || {};
            sigRows = (parts[2] && parts[2].minerals) || [];
            noteCounts = (parts[3] && parts[3].counts) || {};
            data = body.minerals || [];
            renderChart();
            var hash = decodeURIComponent(location.hash || "").replace(/^#/, "");
            var hit = data.filter(function (row) { return row.slug === hash; })[0];
            select((hit || data[0] || {}).slug || "");
            fetchJson("/api/minerals/craft", "minerals-craft.json").then(function (craft) {
                craftMap = (craft && craft.ores) || {};
                renderGrid();
            }).catch(function () {});
        })
        .catch(function () {
            document.getElementById("minStatus").textContent = "矿物数据没有读到。";
        });
})();
