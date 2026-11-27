(function () {
    var panel = document.getElementById("homeMissionPanel");
    var countEl = document.getElementById("hmCount");
    var pager = document.getElementById("hmPager");
    var api = window.ShipComponentBlueprints;
    if (!panel || !api) return;

    var state = { q: "", system: "", giver: "", legality: "", type: "", blueprint: false, page: 0, sort: "", dir: "asc", facets: {}, pages: 1 };
    var serial = 0;
    var timer = null;
    var PAGE = 12;

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
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

    function fillSelect(el, items, current, blank) {
        var html = '<option value="">' + esc(blank) + "</option>";
        (items || []).forEach(function (item) {
            html += '<option value="' + esc(item.value) + '"' + (item.value === current ? " selected" : "") + ">" + esc(item.value) + "</option>";
        });
        el.innerHTML = html;
    }

    function renderRail() {
        var facets = state.facets || {};
        fillSelect(document.getElementById("hmSystem"), facets.systems, state.system, "全部星系");
        fillSelect(document.getElementById("hmGiver"), facets.givers, state.giver, "全部委托方");
        document.getElementById("hmLegal").innerHTML = ["", "合法", "非法"].map(function (value) {
            var label = value || "全部";
            return '<button type="button" data-value="' + esc(value) + '"' + (state.legality === value ? ' class="is-on"' : "") + ">" + label + "</button>";
        }).join("");
        var types = [{ value: "", count: facets.type_total != null ? facets.type_total : "" }].concat(facets.types || []);
        document.getElementById("hmTypes").innerHTML = types.map(function (item) {
            var label = item.value || "全部类型";
            return '<button type="button" data-value="' + esc(item.value) + '"' + (state.type === item.value ? ' class="is-on"' : "") + "><span>" + esc(label) + "</span><b>" + (item.count == null ? "" : item.count) + "</b></button>";
        }).join("");
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

    function renderBoard(rows) {
        var slice = rows.map(asMission);
        panel.dataset.expandedMission = "";
        panel.dataset.variantRef = "";
        api.rememberMissionsOnPanel(panel, { id_item: "home-mission-contracts" }, slice);
        if (!slice.length) {
            panel.innerHTML = '<p class="home-mission-status">没有符合条件的合约</p>';
        } else {
            var holder = document.createElement("div");
            holder.innerHTML = api.renderMissionListHtml(slice, "");
            paintSortHead(holder);
            panel.innerHTML = holder.innerHTML;
        }
        var pages = Math.max(1, state.pages || 1);
        var start = 0;
        if (pages > 8) start = Math.max(0, Math.min(state.page - 3, pages - 8));
        var html = "";
        for (var i = start; i < pages && i < start + 8; i++) {
            html += '<button type="button" data-page="' + i + '"' + (i === state.page ? ' class="is-on"' : "") + ">" + (i + 1) + "</button>";
        }
        pager.innerHTML = pages > 1 ? html : "";
    }

    function applyBoard(data) {
        state.facets = data.facets || {};
        state.pages = Number(data.pages) || 1;
        state.page = Number(data.page) || 0;
        if (countEl) countEl.textContent = (data.total || 0) + " 组 · " + (data.contracts || 0) + " 条";
        renderRail();
        renderBoard(data.missions || []);
    }

    function isDefaultView() {
        return !state.q && !state.system && !state.giver && !state.legality && !state.type && !state.blueprint && !state.page && !state.sort;
    }

    function rememberBoard(data) {
        if (!isDefaultView() || !data || !data.ok) return;
        try {
            sessionStorage.setItem("ussHomeMissionsV2", JSON.stringify({ savedAt: Date.now(), data: data }));
        } catch (err) {
            /* 隐私模式写不进缓存时，下次仍走接口 */
        }
    }

    function readBoard() {
        try {
            var raw = sessionStorage.getItem("ussHomeMissionsV2");
            if (!raw) return null;
            var saved = JSON.parse(raw);
            if (!saved || !saved.data || !saved.data.ok) return null;
            if (Date.now() - Number(saved.savedAt) > 10 * 60 * 1000) return null;
            return saved.data;
        } catch (err) {
            return null;
        }
    }

    function load() {
        var id = ++serial;
        var params = new URLSearchParams();
        params.set("page", String(state.page));
        params.set("limit", String(PAGE));
        if (state.q) params.set("q", state.q);
        if (state.system) params.set("system", state.system);
        if (state.giver) params.set("giver", state.giver);
        if (state.legality) params.set("legality", state.legality);
        if (state.type) params.set("type", state.type);
        if (state.blueprint) params.set("blueprint", "1");
        if (state.sort) {
            params.set("sort", state.sort);
            params.set("dir", state.dir === "desc" ? "desc" : "asc");
        }
        var base = (window.USS_AUTH_API_BASE || "").replace(/\/$/, "");
        var request = window.__homeMissionPrefetch;
        if (request && isDefaultView()) window.__homeMissionPrefetch = null;
        else request = fetch(base + "/api/sc/mission-contracts?" + params.toString()).then(function (res) { return res.json(); });
        request
            .then(function (data) {
                if (id !== serial || !data || !data.ok) return;
                applyBoard(data);
                rememberBoard(data);
            })
            .catch(function () {
                if (id !== serial) return;
                panel.innerHTML = '<p class="home-mission-status">合约暂时读不到，可打开完整版查看</p>';
            });
    }

    document.getElementById("hmQuery").addEventListener("input", function (event) {
        state.q = event.target.value.trim();
        state.page = 0;
        clearTimeout(timer);
        timer = setTimeout(load, 220);
    });
    document.getElementById("hmSystem").addEventListener("change", function (event) {
        state.system = event.target.value;
        state.page = 0;
        load();
    });
    document.getElementById("hmGiver").addEventListener("change", function (event) {
        state.giver = event.target.value;
        state.page = 0;
        load();
    });
    document.getElementById("hmLegal").addEventListener("click", function (event) {
        var button = event.target.closest("button");
        if (!button) return;
        state.legality = button.getAttribute("data-value") || "";
        state.type = "";
        state.page = 0;
        load();
    });
    document.getElementById("hmBlueprint").addEventListener("click", function (event) {
        var button = event.currentTarget;
        state.blueprint = !state.blueprint;
        button.classList.toggle("is-on", state.blueprint);
        button.setAttribute("aria-pressed", state.blueprint ? "true" : "false");
        state.page = 0;
        load();
    });
    document.getElementById("hmTypes").addEventListener("click", function (event) {
        var button = event.target.closest("button");
        if (!button) return;
        state.type = button.getAttribute("data-value") || "";
        state.page = 0;
        load();
    });
    pager.addEventListener("click", function (event) {
        var button = event.target.closest("[data-page]");
        if (!button) return;
        state.page = Number(button.getAttribute("data-page")) || 0;
        load();
    });

    panel.addEventListener("click", function (event) {
        var button = event.target.closest("[data-sort]");
        if (!button || !panel.contains(button)) return;
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
        load();
        panel.scrollTop = 0;
    });
    api.wirePanel(panel);
    var cached = readBoard();
    if (cached) applyBoard(cached);
    if (cached && window.UssHomeBoot && typeof window.UssHomeBoot.afterPageReadyIdle === 'function') {
        window.UssHomeBoot.afterPageReadyIdle(load, 500);
    } else {
        load();
    }
})();
