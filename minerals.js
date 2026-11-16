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
    var method = "";
    var selected = "";
    var systemKey = "";
    var listPage = 0;
    var locPage = 0;

    function text(s) { return String(s == null ? "" : s); }
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
    function scanBase(item) {
        return SCAN[item.slug] || 0;
    }
    function formatSig(n) {
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    function signalMatch(item, q) {
        var base = scanBase(item);
        var n = Number(q);
        if (!base || !n || n % base !== 0) return 0;
        var count = n / base;
        return count >= 1 && count <= 6 ? count : 0;
    }
    function renderSignals(box, item) {
        var base = scanBase(item);
        if (!base) return;
        var row = el("div", "min-signals");
        for (var i = 1; i <= 6; i++) {
            var cell = el("div", "min-signal");
            cell.appendChild(el("span", "min-signal-k", "×" + i));
            cell.appendChild(el("span", "min-signal-v", formatSig(base * i)));
            row.appendChild(cell);
        }
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
        var size = capacity(grid, 40, 46);
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
            var btn = el("button", "min-row" + (item.slug === selected ? " is-on" : ""));
            btn.type = "button";
            btn.setAttribute("data-slug", item.slug);
            var main = el("span", "min-row-main");
            main.appendChild(el("span", "min-zh", item.name_zh || item.name));
            main.appendChild(el("span", "min-en", item.name));
            var side = el("span", "min-row-side");
            side.appendChild(el("span", "min-sig", scanBase(item) ? formatSig(scanBase(item)) : "—"));
            side.appendChild(el("span", "min-meta", methodLabel(item.methods)));
            btn.appendChild(main);
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
        titles.appendChild(el("h2", "", item.name_zh || item.name));
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
    document.getElementById("minGrid").addEventListener("click", function (ev) {
        var pageBtn = ev.target.closest(".min-page");
        if (pageBtn && pageBtn.getAttribute("data-page-kind") === "list") {
            listPage += Number(pageBtn.getAttribute("data-page-dir"));
            renderGrid();
            return;
        }
        var btn = ev.target.closest(".min-row");
        if (!btn) return;
        select(btn.getAttribute("data-slug"));
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
    Promise.all([
        fetch("minerals-data.json?v=20261116k").then(function (res) { if (!res.ok) throw new Error("bad"); return res.json(); }),
        fetch("minerals-loc.json?v=20261116l").then(function (res) { if (!res.ok) throw new Error("bad"); return res.json(); })
    ])
        .then(function (parts) {
            var body = parts[0];
            LOC = (parts[1] && parts[1].names) || {};
            data = body.minerals || [];
            var hash = decodeURIComponent(location.hash || "").replace(/^#/, "");
            var hit = data.filter(function (row) { return row.slug === hash; })[0];
            select((hit || data[0] || {}).slug || "");
        })
        .catch(function () {
            document.getElementById("minStatus").textContent = "矿物数据没有读到。";
        });
})();
