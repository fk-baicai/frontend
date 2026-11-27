(function () {
    var PAGE = 36;
    var state = {
        rows: [],
        facets: null,
        total: 0,
        totalAll: 0,
        contracts: 0,
        pages: 1,
        system: "",
        type: "",
        legality: "",
        blueprint: false,
        giver: "",
        q: "",
        page: 0,
        sort: "",
        dir: "asc",
        dossierOpen: false,
    };
    var requestSerial = 0;
    var tileSerial = 0;
    var searchTimer = null;
    var pageCache = new Map();
    var board = document.getElementById("mcBoard");
    var api = window.ShipComponentBlueprints;

    function text(value) {
        return String(value == null ? "" : value);
    }

    function esc(value) {
        return text(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function apiBase(path) {
        var base = (window.USS_AUTH_API_BASE || "").replace(/\/$/, "");
        return (base || "") + path;
    }

    function asMission(row) {
        return {
            uuid: row.uuid,
            title_zh: row.title_zh,
            title_en: row.title_en,
            debug_name: row.debug_name,
            mission_type: row.mission_type,
            mission_type_zh: row.type_zh,
            reputation_min: row.reputation_min,
            reputation_max: row.reputation_max,
            mission_giver_zh: row.giver_zh,
            legality_zh: row.legality_zh,
            reward_auec_label: row.reward_label,
            cost_auec_label: row.cost_label,
            reward_min: row.reward_min,
            variant_count: row.variant_count,
            has_blueprint: !!row.has_blueprint,
            blueprint_tag_zh: row.blueprint_tag_zh || "",
            variants: (row.variants || []).map(function (v) {
                return {
                    uuid: v.uuid,
                    debug_name: v.debug_name,
                    title_zh: v.title_zh,
                    title_en: v.title_en,
                    label: v.label,
                    marks: v.marks,
                    cargo_zh: v.cargo_zh,
                    reward_auec_label: v.reward_auec_label,
                    cost_auec_label: v.cost_auec_label,
                    reward_min: v.reward_min,
                    reputation_amount: v.reputation_amount,
                    reputation_min: v.reputation_min,
                    reputation_max: v.reputation_max,
                    mission_type_zh: row.type_zh,
                    mission_giver_zh: v.giver_zh || row.giver_zh,
                    legality_zh: v.legality_zh || row.legality_zh,
                };
            }),
        };
    }

    function fillSelect(el, items, current, allLabel) {
        el.innerHTML = '<option value="">' + esc(allLabel) + "</option>" + (items || []).map(function (item) {
            return '<option value="' + esc(item.value) + '">' + esc(item.value) + " " + item.count + "</option>";
        }).join("");
        el.value = current || "";
    }

    function renderRail() {
        var facets = state.facets || {};
        fillSelect(document.getElementById("mcSystem"), facets.systems, state.system, "全部星系");
        fillSelect(document.getElementById("mcGiver"), facets.givers, state.giver, "全部委托方");
        syncGiverMenu();
        document.getElementById("mcLegal").innerHTML = ["", "合法", "非法"].map(function (value) {
            var label = value || "全部";
            return '<button type="button" data-value="' + esc(value) + '"' + (state.legality === value ? ' class="is-on"' : "") + ">" + label + "</button>";
        }).join("");
        var types = [{ value: "", count: facets.type_total != null ? facets.type_total : state.totalAll }].concat(facets.types || []);
        document.getElementById("mcTypes").innerHTML = types.map(function (item) {
            var label = item.value || "全部类型";
            return '<button type="button" data-value="' + esc(item.value) + '" data-mission-type="' + esc(item.value) + '"' + (state.type === item.value ? ' class="is-on"' : "") + '><i data-mission-type="' + esc(item.value) + '"></i><span>' + esc(label) + "</span><b>" + item.count + "</b></button>";
        }).join("");
    }

    var dossierSerial = 0;
    var dossier = document.getElementById("mcDossier");
    var stage = document.querySelector(".mc-stage");
    if (dossier) {
        dossier.addEventListener("click", function (event) {
            var link = event.target.closest("a[href]");
            if (!link || !dossier.contains(link)) return;
            if (link.getAttribute("href").indexOf("blueprint-crafting") < 0) return;
            event.preventDefault();
            event.stopPropagation();
            window.open(link.href, "_blank", "noopener,noreferrer");
        }, true);
    }

    function renderDossier(brief) {
        var mark = brief.logo_url
            ? '<img class="mc-dossier-logo" src="' + esc(brief.logo_url) + '" alt="">'
            : '<span class="mc-dossier-mark">' + esc(String(brief.name_zh || "").slice(0, 1)) + "</span>";
        var meta = [brief.focus_zh, brief.headquarters_zh].filter(Boolean).join(" · ");
        var ladderRanks = brief.ranks || [];
        function repStep(index) {
            return ladderRanks.length < 2 ? 0 : Math.round(index * 6 / (ladderRanks.length - 1));
        }
        var ladder = ladderRanks.map(function (rank, index) {
            var count = (rank.blueprints || []).length;
            return (
                '<div class="mc-ladder-row mc-rep-' + repStep(index) + '"><b>' + esc(rank.name) + "</b><span>" +
                esc(Number(rank.min_reputation).toLocaleString("zh-CN")) +
                "</span><em>" + count + "</em></div>"
            );
        }).join("");
        var groupOrder = ["component", "weapon", "mining", "salvage", "fuel_nozzle", "fps_weapon", "fps_magazine", "fps_armor", "other"];
        var sectorByGroup = {
            component: "ship",
            weapon: "ship",
            mining: "ship",
            salvage: "ship",
            fuel_nozzle: "ship",
            fps_weapon: "equipment",
            fps_magazine: "equipment",
            fps_armor: "equipment"
        };
        function craftHref(item) {
            if (!item.uuid) return "";
            var q = "blueprint-crafting.html?blueprint=" + encodeURIComponent(item.uuid);
            if (item.nav_group) q += "&group=" + encodeURIComponent(item.nav_group);
            if (item.nav_type) q += "&type=" + encodeURIComponent(item.nav_type);
            if (item.component_id) q += "&component=" + encodeURIComponent(item.component_id);
            q += "&sector=" + encodeURIComponent(sectorByGroup[item.nav_group] || "ship");
            return q;
        }
        function renderBlueprintGroups(items) {
            var groups = {};
            items.forEach(function (item) {
                var g = item.nav_group || "other";
                var t = item.nav_type || "other";
                if (!groups[g]) {
                    groups[g] = {
                        label: item.group_label_zh || "其他",
                        types: {}
                    };
                }
                if (!groups[g].types[t]) {
                    groups[g].types[t] = {
                        label: item.type_label_zh || "其他",
                        items: []
                    };
                }
                groups[g].types[t].items.push(item);
            });
            return groupOrder.filter(function (key) { return groups[key]; }).map(function (key) {
                var group = groups[key];
                var types = Object.keys(group.types).map(function (typeKey) {
                    var type = group.types[typeKey];
                    var links = type.items.map(function (item) {
                        var href = craftHref(item);
                        if (!href) return "<span>" + esc(item.name_zh) + "</span>";
                        return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(item.name_zh) + "</a>";
                    }).join("");
                    return '<div class="mc-bp-type"><b>' + esc(type.label) + "</b><div class=\"mc-rank-bps\">" + links + "</div></div>";
                }).join("");
                return '<section class="mc-bp-group"><h3>' + esc(group.label) + "</h3>" + types + "</section>";
            }).join("");
        }
        var ranks = ladderRanks.filter(function (rank) {
            return rank.blueprints && rank.blueprints.length;
        }).map(function (rank) {
            return (
                '<section class="mc-rank mc-rep-' + repStep(ladderRanks.indexOf(rank)) + '">' +
                '<div class="mc-rank-head"><b>' + esc(rank.name) + "</b><span>" +
                esc(Number(rank.min_reputation).toLocaleString("zh-CN")) + "</span></div>" +
                renderBlueprintGroups(rank.blueprints) + "</section>"
            );
        }).join("");
        dossier.innerHTML =
            '<div class="mc-dossier-top">' +
            '<div class="mc-dossier-media">' + mark + "</div>" +
            '<div class="mc-dossier-copy">' +
            "<h2 class=\"mc-dossier-name\">" + esc(brief.name_zh) + "</h2>" +
            (brief.name_en_display && brief.name_en_display !== brief.name_zh
                ? '<p class="mc-dossier-en">' + esc(brief.name_en_display) + "</p>"
                : "") +
            (meta ? '<p class="mc-dossier-meta">' + esc(meta) + "</p>" : "") +
            (brief.description_zh ? '<p class="mc-dossier-desc">' + esc(brief.description_zh) + "</p>" : "") +
            '<p class="mc-dossier-count">可获得蓝图 <b>' + esc(brief.blueprint_count || 0) + "</b></p>" +
            '<div class="mc-ladder"><div class="mc-ladder-key"><span>等级</span><span>声望</span><span>蓝图</span></div>' + ladder + "</div>" +
            "</div></div>" +
            '<div class="mc-dossier-side mc-scroll">' +
            ranks +
            "</div>" +
            '<button type="button" class="mc-dossier-close" aria-label="关闭">×</button>';
        var logo = dossier.querySelector(".mc-dossier-logo");
        if (logo) {
            logo.addEventListener("error", function () {
                var fallback = document.createElement("span");
                fallback.className = "mc-dossier-mark";
                fallback.textContent = String(brief.name_zh || "").slice(0, 1);
                logo.replaceWith(fallback);
            });
        }
    }

    function setDossierOpen(open) {
        state.dossierOpen = !!open && !!state.giver;
        dossier.hidden = !state.dossierOpen;
        if (stage) stage.classList.toggle("is-giver", state.dossierOpen);
    }

    function loadDossier() {
        var serial = ++dossierSerial;
        if (!state.giver || !state.dossierOpen) {
            setDossierOpen(false);
            return;
        }
        setDossierOpen(true);
        dossier.innerHTML = '<div class="mc-dossier-top"><div class="mc-dossier-media"><span class="mc-dossier-mark">…</span></div><div class="mc-dossier-copy"><h2 class="mc-dossier-name">正在读取</h2></div></div><button type="button" class="mc-dossier-close" aria-label="关闭">×</button>';
        fetch(apiBase("/api/sc/mission-givers?name=" + encodeURIComponent(state.giver)))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (serial !== dossierSerial) return;
                if (!data || !data.ok) throw new Error((data && data.message) || "委托方资料加载失败");
                renderDossier(data);
            })
            .catch(function (error) {
                if (serial !== dossierSerial) return;
                dossier.innerHTML = '<p class="mc-dossier-desc">' + esc(error.message || "委托方资料加载失败") + "</p>";
            });
    }

    function listQuery(page) {
        var params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(PAGE));
        if (state.q) params.set("q", state.q);
        if (state.system) params.set("system", state.system);
        if (state.type) params.set("type", state.type);
        if (state.legality) params.set("legality", state.legality);
        if (state.blueprint) params.set("blueprint", "1");
        if (state.giver) params.set("giver", state.giver);
        if (state.sort) {
            params.set("sort", state.sort);
            params.set("dir", state.dir === "desc" ? "desc" : "asc");
        }
        return params.toString();
    }

    function rememberPage(key, data) {
        if (pageCache.has(key)) pageCache.delete(key);
        pageCache.set(key, data);
        while (pageCache.size > 16) {
            pageCache.delete(pageCache.keys().next().value);
        }
    }

    function samePage(a, b) {
        var left = (a && a.missions) || [];
        var right = (b && b.missions) || [];
        if (left.length !== right.length || Number(a.total) !== Number(b.total)) return false;
        if (!left.length) return true;
        return left[0].uuid === right[0].uuid && left[left.length - 1].uuid === right[right.length - 1].uuid;
    }

    function paintSkeleton() {
        tileSerial += 1;
        var html = '<div class="mc-tiles" aria-busy="true" aria-hidden="true">';
        for (var i = 0; i < 10; i++) html += '<div class="mc-tile"></div>';
        board.innerHTML = html + "</div>";
    }

    function renderPager() {
        var pager = document.getElementById("mcPager");
        var pages = Math.max(1, state.pages || 1);
        var start = 0;
        if (pages > 12) start = Math.max(0, Math.min(state.page - 5, pages - 12));
        var html = "";
        for (var i = start; i < pages && i < start + 12; i++) {
            html += '<button type="button" data-page="' + i + '"' + (i === state.page ? ' class="is-on"' : "") + ">" + (i + 1) + "</button>";
        }
        pager.innerHTML = html;
    }

    function renderBoard() {
        var slice = state.rows.map(asMission);
        document.getElementById("mcCount").textContent = state.total + " 组 · " + state.contracts + " 条";
        board.dataset.expandedMission = "";
        board.dataset.variantRef = "";
        api.rememberMissionsOnPanel(board, { id_item: "mission-contracts" }, slice);
        if (api.prefetchMissionDetails) {
            api.prefetchMissionDetails(slice, { limit: slice.length, concurrency: 4 });
        }
        renderPager();
        if (!slice.length) {
            tileSerial += 1;
            board.innerHTML = '<p class="sc-acquire-empty">没有符合条件的合约</p>';
            return;
        }
        var serial = ++tileSerial;
        var holder = document.createElement("div");
        holder.innerHTML = api.renderMissionListHtml(slice, "");
        paintSortHead(holder);
        var list = holder.querySelector(".sc-blueprint-mission-list");
        var items = list ? Array.prototype.slice.call(list.children) : [];
        var rest = items.length > 12 ? items.slice(12) : [];
        rest.forEach(function (el) { el.remove(); });
        board.innerHTML = "";
        while (holder.firstChild) board.appendChild(holder.firstChild);
        if (!rest.length) return;
        function pump() {
            if (serial !== tileSerial) return;
            rest.splice(0, 8).forEach(function (el) { list.appendChild(el); });
            if (rest.length) requestAnimationFrame(pump);
        }
        requestAnimationFrame(pump);
    }

    function sortButton(key, label, extraClass) {
        var on = state.sort === key;
        var mark = on ? (state.dir === "desc" ? " ↓" : " ↑") : "";
        return '<button type="button" class="mc-sort' + (extraClass ? " " + extraClass : "") + (on ? " is-on" : "") + '" data-sort="' + key + '" aria-sort="' + (on ? (state.dir === "desc" ? "descending" : "ascending") : "none") + '">' + esc(label) + mark + "</button>";
    }

    function paintSortHead(root) {
        var head = root.querySelector(".sc-blueprint-mission-table-head");
        if (!head) return;
        head.removeAttribute("aria-hidden");
        head.innerHTML =
            sortButton("title", "任务", "mc-sort--name") +
            '<span class="mc-sort-meta">' +
            sortButton("type", "类型") +
            sortButton("rep", "声望报酬") +
            sortButton("giver", "发布方") +
            sortButton("legal", "合法性", "mc-sort--legal") +
            "</span>" +
            sortButton("auec", "aUEC", "mc-sort--reward") +
            '<span class="sc-bp-mission-th sc-bp-mission-th--exp"></span>';
    }

    function applyList(data) {
        state.rows = data.missions || [];
        state.facets = data.facets || {};
        state.total = Number(data.total) || 0;
        state.totalAll = Number(data.total_all) || state.total;
        state.contracts = Number(data.contracts) || 0;
        state.pages = Number(data.pages) || 1;
        state.page = Number(data.page) || 0;
        renderRail();
        renderBoard();
    }

    function prefetchPage(page) {
        if (page < 0 || page >= state.pages) return;
        var key = listQuery(page);
        if (pageCache.has(key)) return;
        fetch(apiBase("/api/sc/mission-contracts?" + key))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && data.ok) rememberPage(key, data);
            })
            .catch(function () {});
    }

    var lastFilterKey = "";

    function filterKey(query) {
        return String(query || "").replace(/(^|&)page=\d+/, "").replace(/^&/, "");
    }

    function markPager() {
        var pager = document.getElementById("mcPager");
        if (!pager) return;
        pager.querySelectorAll("[data-page]").forEach(function (btn) {
            btn.classList.toggle("is-on", Number(btn.getAttribute("data-page")) === state.page);
        });
    }

    function loadPage() {
        var serial = ++requestSerial;
        var key = listQuery(state.page);
        var cached = pageCache.get(key) || null;
        var turning = filterKey(key) === lastFilterKey && state.rows.length > 0;
        lastFilterKey = filterKey(key);
        if (cached) {
            applyList(cached);
        } else if (turning) {
            markPager();
        } else {
            document.getElementById("mcCount").textContent = "正在读取本页合约…";
            paintSkeleton();
        }
        fetch(apiBase("/api/sc/mission-contracts?" + key))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (serial !== requestSerial) return;
                if (!data || !data.ok) throw new Error((data && data.message) || "加载失败");
                var giverStillThere = !state.giver || ((data.facets && data.facets.givers) || []).some(function (item) {
                    return item.value === state.giver;
                });
                if (!giverStillThere) {
                    state.giver = "";
                    state.dossierOpen = false;
                    state.page = 0;
                    loadPage();
                    return;
                }
                var typeStillThere = !state.type || ((data.facets && data.facets.types) || []).some(function (item) {
                    return item.value === state.type;
                });
                if (!typeStillThere) {
                    state.type = "";
                    state.page = 0;
                    loadPage();
                    return;
                }
                rememberPage(key, data);
                if (!(cached && samePage(cached, data))) applyList(data);
                prefetchPage(state.page + 1);
                prefetchPage(state.page - 1);
                prefetchPage(state.page + 2);
            })
            .catch(function (error) {
                if (serial !== requestSerial) return;
                if (cached) return;
                document.getElementById("mcCount").textContent = error.message || "任务合约加载失败";
            });
    }

    document.getElementById("mcQuery").addEventListener("input", function (event) {
        state.q = event.target.value || "";
        state.page = 0;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadPage, 250);
    });
    document.getElementById("mcSystem").addEventListener("change", function (event) {
        state.system = event.target.value || "";
        state.page = 0;
        loadPage();
    });
    var giverBtn = document.getElementById("mcGiverBtn");
    var giverMenu = document.getElementById("mcGiverMenu");
    function syncGiverMenu() {
        var select = document.getElementById("mcGiver");
        var selected = select.options[select.selectedIndex];
        function giverOptionLabel(text) {
            var raw = String(text || "");
            var match = raw.match(/^(.*)\s+(\d+)$/);
            if (!match) return esc(raw);
            return '<span>' + esc(match[1]) + '</span><b>' + esc(match[2]) + "</b>";
        }
        giverBtn.innerHTML = giverOptionLabel(selected ? selected.textContent : "全部委托方");
        giverMenu.innerHTML = Array.prototype.map.call(select.options, function (opt) {
            return '<button type="button" role="option" data-value="' + esc(opt.value) + '"' +
                (opt.selected ? ' class="is-on" aria-selected="true"' : ' aria-selected="false"') +
                ">" + giverOptionLabel(opt.textContent) + "</button>";
        }).join("");
    }
    function placeGiverMenu() {
        var rect = giverBtn.getBoundingClientRect();
        giverMenu.style.left = rect.left + "px";
        giverMenu.style.top = (rect.bottom + 4) + "px";
        giverMenu.style.width = rect.width + "px";
    }
    function setGiverMenu(open) {
        giverMenu.hidden = !open;
        giverBtn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) placeGiverMenu();
    }
    giverBtn.addEventListener("click", function () {
        setGiverMenu(giverMenu.hidden);
    });
    giverMenu.addEventListener("click", function (event) {
        var option = event.target.closest("button");
        if (!option) return;
        var select = document.getElementById("mcGiver");
        select.value = option.getAttribute("data-value") || "";
        setGiverMenu(false);
        select.dispatchEvent(new Event("change"));
    });
    document.addEventListener("click", function (event) {
        if (event.target.closest(".mc-picker")) return;
        setGiverMenu(false);
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") setGiverMenu(false);
    });
    window.addEventListener("resize", function () {
        if (!giverMenu.hidden) placeGiverMenu();
    });
    document.getElementById("mcGiver").addEventListener("change", function (event) {
        state.giver = event.target.value || "";
        state.page = 0;
        state.dossierOpen = !!state.giver;
        loadPage();
        loadDossier();
    });
    dossier.addEventListener("click", function (event) {
        if (!event.target.closest(".mc-dossier-close")) return;
        setDossierOpen(false);
    });
    document.getElementById("mcLegal").addEventListener("click", function (event) {
        var button = event.target.closest("button");
        if (!button) return;
        state.legality = button.getAttribute("data-value") || "";
        state.page = 0;
        loadPage();
    });
    document.querySelectorAll("[data-blueprint-switch]").forEach(function (button) {
        button.addEventListener("click", function () {
            state.blueprint = !state.blueprint;
            document.querySelectorAll("[data-blueprint-switch]").forEach(function (item) {
                item.classList.toggle("is-on", state.blueprint);
                item.setAttribute("aria-pressed", state.blueprint ? "true" : "false");
            });
            state.page = 0;
            loadPage();
        });
    });
    document.getElementById("mcTypes").addEventListener("click", function (event) {
        var button = event.target.closest("button");
        if (!button) return;
        state.type = button.getAttribute("data-value") || "";
        state.page = 0;
        loadPage();
    });
    board.addEventListener("click", function (event) {
        var button = event.target.closest("[data-sort]");
        if (!button || !board.contains(button)) return;
        event.preventDefault();
        event.stopPropagation();
        var key = button.getAttribute("data-sort") || "";
        if (state.sort === key) {
            state.dir = state.dir === "desc" ? "asc" : "desc";
        } else {
            state.sort = key;
            state.dir = key === "rep" || key === "auec" ? "desc" : "asc";
        }
        state.page = 0;
        loadPage();
        board.scrollTop = 0;
    });
    var pagerEl = document.getElementById("mcPager");
    pagerEl.addEventListener("click", function (event) {
        var button = event.target.closest("[data-page]");
        if (!button) return;
        state.page = Number(button.getAttribute("data-page")) || 0;
        loadPage();
        board.scrollTop = 0;
    });
    pagerEl.addEventListener("pointermove", function (event) {
        var rect = pagerEl.getBoundingClientRect();
        pagerEl.style.setProperty("--mx", event.clientX - rect.left + "px");
        pagerEl.style.setProperty("--my", event.clientY - rect.top + "px");
    });
    pagerEl.addEventListener("pointerenter", function () {
        pagerEl.classList.add("is-hot");
    });
    pagerEl.addEventListener("pointerleave", function () {
        pagerEl.classList.remove("is-hot");
    });

    api.wirePanel(board);
    loadPage();
})();
