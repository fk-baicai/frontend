(function () {
    if (typeof window === 'undefined') return;

    var API_BASE = (
        window.USS_SC_COMPONENTS_API_BASE || window.USS_AUTH_API_BASE || window.USS_REGISTER_API_BASE || ''
    ).replace(/\/$/, '');

    var listCache = Object.create(null);
    var detailCache = Object.create(null);
    var craftBlueprintCache = Object.create(null);
    var DETAIL_SCHEMA_VERSION = 17;

    var GROUP_TO_SECTOR = {
        component: 'ship',
        weapon: 'ship',
        mining: 'ship',
        salvage: 'ship',
        fuel_nozzle: 'ship',
        fps_weapon: 'equipment',
        fps_magazine: 'equipment',
        fps_armor: 'equipment',
    };

    function missionBriefingZh(detail, summary) {
        var zh = detail && detail.description_zh ? String(detail.description_zh).trim() : '';
        if (zh) return zh;
        if (summary && summary.description_zh) return String(summary.description_zh).trim();
        return '';
    }

    function isUsableMissionDetail(detail) {
        if (!detail || detail.__detailSchemaVersion !== DETAIL_SCHEMA_VERSION) return false;
        if (Array.isArray(detail.blueprint_pools) && detail.blueprint_pools.length) return true;
        return !!(
            (detail.description_zh && String(detail.description_zh).trim()) ||
            (detail.fields && detail.fields.length)
        );
    }

    function apiUrl(path) {
        return API_BASE + path;
    }

    function looksLikeGzipBody(text) {
        return text && text.length >= 2 && text.charCodeAt(0) === 0x1f && text.charCodeAt(1) === 0x8b;
    }

    function looksLikeHtmlBody(text) {
        const t = String(text || '').trim().slice(0, 32).toLowerCase();
        return t.indexOf('<!doctype') === 0 || t.indexOf('<html') === 0;
    }

    function isJsonParseFailureMessage(message) {
        return /json|非 JSON|解析失败|Unexpected token|api\.ussxc\.org/i.test(String(message || ''));
    }

    async function parseJsonResponse(res, fallbackMessage) {
        var text = await res.text();
        try {
            return JSON.parse(text);
        } catch (parseErr) {
            if (looksLikeGzipBody(text)) {
                throw new Error('蓝图任务响应异常（网络缓存损坏），请强制刷新页面后重试');
            }
            if (looksLikeHtmlBody(text)) {
                throw new Error(
                    '蓝图任务接口返回了网页而非 JSON，请确认站点 API 可用或稍后重试（可强制刷新页面）'
                );
            }
            var preview = String(text || '').replace(/\s+/g, ' ').trim();
            if (preview.length > 60) preview = preview.slice(0, 60) + '…';
            var msg = fallbackMessage || '响应解析失败';
            if (preview) msg += '（收到非 JSON 内容: ' + preview + '）';
            msg += '。若持续出现，请强制刷新页面或清除浏览器缓存。';
            throw new Error(msg);
        }
    }

    function itemHasBlueprintHints(item) {
        if (!item) return false;
        if (Number(item.unlocking_missions_count) > 0) return true;
        if (Array.isArray(item.unlocking_missions) && item.unlocking_missions.length) return true;
        var wf = item.wiki_fields;
        if (wf && Array.isArray(wf.blueprint_refs) && wf.blueprint_refs.length) return true;
        if (wf && Array.isArray(wf.blueprint_unlock_missions) && wf.blueprint_unlock_missions.length) return true;
        return false;
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatBlueprintDropLabel(chance) {
        if (chance == null || !Number.isFinite(Number(chance))) return '';
        var pct = Number(chance) * 100;
        if (pct >= 99.9) return '';
        var f = window.ScDisplayFormat;
        var pctText = f && f.formatFixedDecimal2 ? f.formatFixedDecimal2(pct) : pct.toFixed(2);
        if (pctText == null) return '';
        return '蓝图掉落 ' + pctText + '%';
    }

    function cssEscape(value) {
        if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
        return String(value || '').replace(/["\\]/g, '\\$&');
    }

    function stripMissionPlaceholders(text) {
        if (!text) return '';
        var raw = String(text).replace(/\\n/g, '\n');
        raw = raw.replace(/~mission\([^)]*\)/gi, '');
        raw = raw.replace(/<\/?EM4>/gi, '');
        raw = raw.replace(/<\/?EM>/gi, '');
        raw = raw.replace(/<\/?BR\s*\/?>/gi, '\n');
        raw = raw.replace(/<[^>]+>/g, '');
        raw = raw.replace(/[ \t]+/g, ' ');
        raw = raw.replace(/\n{3,}/g, '\n\n');
        return raw.trim();
    }

    function formatMissionBody(text) {
        var cleaned = stripMissionPlaceholders(text);
        if (!cleaned) return '';
        var parts = cleaned.split(/\n+/).map(function (p) {
            return p.trim();
        }).filter(Boolean);
        if (parts.length <= 1) {
            return '<p class="sc-mission-para">' + escapeHtml(cleaned) + '</p>';
        }
        return parts
            .map(function (p) {
                return '<p class="sc-mission-para">' + escapeHtml(p) + '</p>';
            })
            .join('');
    }

    var MISSION_FIELD_GROUPS = [
        {
            id: 'prerequisites',
            title: '接取条件',
            labels: ['前置任务', '需要标签', '排除标签'],
            wideLabels: ['前置任务', '需要标签', '排除标签'],
        },
        {
            id: 'location',
            title: '区域地点',
            labels: ['相关星系', '任务地点'],
            wideLabels: ['任务地点'],
        },
        {
            id: 'rewards',
            title: '报酬奖励',
            labels: ['蓝图掉落', '接取费用', '声望扣除'],
            wideLabels: ['蓝图掉落'],
        },
    ];

    var SUPPRESSED_DETAIL_LABELS = ['护送方向'];

    var MISSION_SUMMARY_GROUPS = [
        {
            id: 'overview',
            title: '任务概况',
            labels: ['任务类型', '发布方', '派系', '合法性', '等级要求', '运送货物', '不同处'],
        },
        {
            id: 'combat',
            title: '作战',
            labels: ['预计时长', '敌人数量', '战斗任务', '防守目标', '实例人数'],
        },
        {
            id: 'rewards',
            title: '报酬',
            labels: ['aUEC 奖励', '物品奖励', '声望报酬'],
        },
        {
            id: 'rules',
            title: '接取规则',
            labels: [
                '可共享',
                '一次性',
                '冷却',
                '有效期',
                '失败可重接',
                '放弃可重接',
                '犯罪即失败',
                '监狱可接',
            ],
        },
    ];

    function fieldsByLabel(fields) {
        var map = Object.create(null);
        (fields || []).forEach(function (row) {
            if (row && row.label) map[row.label] = row;
        });
        return map;
    }

    function shouldSkipHighlight(label, value) {
        if (!value) return true;
        if (label === '战斗任务' && value === '否') return true;
        if (label === '防守目标' && value !== '是') return true;
        if (label === '可共享' && value !== '是') return true;
        if (label === '合法性' && value === '合法') return false;
        if (
            label === '一次性' ||
            label === '失败可重接' ||
            label === '放弃可重接' ||
            label === '犯罪即失败' ||
            label === '监狱可接'
        ) {
            return value !== '是';
        }
        return false;
    }

    function summaryItemKind(label) {
        if (label === 'aUEC 奖励' || label === '声望报酬' || label === '物品奖励' || label === '蓝图掉落') {
            return 'reward';
        }
        if (
            label === '预计时长' ||
            label === '敌人数量' ||
            label === '战斗任务' ||
            label === '防守目标' ||
            label === '实例人数'
        ) {
            return 'combat';
        }
        if (
            label === '可共享' ||
            label === '冷却' ||
            label === '有效期' ||
            label === '一次性' ||
            label === '失败可重接' ||
            label === '放弃可重接' ||
            label === '犯罪即失败' ||
            label === '监狱可接'
        ) {
            return 'rule';
        }
        if (label === '合法性') return 'warn';
        return 'meta';
    }

    function collectSummaryItems(fields, detail) {
        var byLabel = fieldsByLabel(fields);
        var groups = [];

        MISSION_SUMMARY_GROUPS.forEach(function (group) {
            var items = [];
            group.labels.forEach(function (label) {
                var row = byLabel[label];
                if (!row || shouldSkipHighlight(label, row.value)) return;
                if (label === '派系' && byLabel['发布方'] && byLabel['发布方'].value === row.value) return;
                items.push({
                    label: label,
                    value: row.value,
                    kind: summaryItemKind(label),
                });
            });
            if (group.id === 'rewards' && detail && Array.isArray(detail.blueprint_pools) && detail.blueprint_pools.length) {
                var pool = detail.blueprint_pools[0];
                var dropValue =
                    (pool.drop_chance_percent != null ? pool.drop_chance_percent + '%' : '');
                items.push({ label: '蓝图掉落', value: dropValue, kind: 'reward' });
            }
            if (items.length) groups.push({ id: group.id, title: group.title, items: items });
        });

        return groups;
    }

    function parseRepFieldAmount(value) {
        var match = String(value || '')
            .replace(/,/g, '')
            .match(/([+-]?\d+(?:\.\d+)?)/);
        if (!match) return null;
        var n = Number(match[1]);
        return Number.isFinite(n) ? n : null;
    }

    function renderSummaryValueTag(item) {
        if (!item) return '';
        if (item.label === '任务类型') {
            return renderMissionTypeCell({ mission_type_zh: item.value });
        }
        if (item.label === '发布方') {
            return renderMissionGiverCell({ mission_giver_zh: item.value });
        }
        if (item.label === '合法性') {
            return renderMissionLegalityCell({ legality_zh: item.value });
        }
        if (item.label === '声望报酬') {
            var amount = parseRepFieldAmount(item.value);
            if (amount != null) {
                return renderMissionRepCell({
                    reputation_amount: amount,
                    reputation_min: amount,
                    reputation_max: amount,
                });
            }
        }
        if (item.label === 'aUEC 奖励') {
            return (
                '<span class="sc-blueprint-mission-reward sc-price">' +
                escapeHtml(item.value) +
                '</span>'
            );
        }
        return escapeHtml(item.value || '');
    }

    function renderSummaryGroupSection(group) {
        if (!group || !group.items || !group.items.length) return '';
        var html =
            '<section class="sc-blueprint-mission-section sc-blueprint-mission-section--' +
            group.id +
            '">';
        html += '<h4 class="sc-blueprint-mission-section-title">' + escapeHtml(group.title) + '</h4>';
        html += '<dl class="sc-mission-summary-grid">';
        group.items.forEach(function (item) {
            html +=
                '<div class="sc-mission-summary-item sc-mission-summary-item--' +
                escapeHtml(item.kind) +
                '">' +
                '<dt class="sc-mission-summary-label">' +
                escapeHtml(item.label) +
                '</dt>' +
                '<dd class="sc-mission-summary-value sc-mission-summary-value--tag">' +
                renderSummaryValueTag(item) +
                '</dd></div>';
        });
        html += '</dl></section>';
        return html;
    }

    var MISSION_SUMMARY_DEFERRED_IDS = ['combat', 'rewards', 'rules'];

    function renderMissionSummarySections(fields, detail, groupIds) {
        var groups = collectSummaryItems(fields, detail);
        if (groupIds && groupIds.length) {
            var allow = Object.create(null);
            groupIds.forEach(function (id) {
                allow[id] = true;
            });
            groups = groups.filter(function (group) {
                return allow[group.id];
            });
        }
        if (!groups.length) return '';

        var sectionClass = 'sc-blueprint-mission-sections sc-blueprint-mission-sections--summary';
        if (groupIds && groupIds.length === 1 && groupIds[0] === 'overview') {
            sectionClass += ' sc-blueprint-mission-sections--summary-top';
        }
        if (
            groupIds &&
            groupIds.length === MISSION_SUMMARY_DEFERRED_IDS.length &&
            groupIds.every(function (id) {
                return MISSION_SUMMARY_DEFERRED_IDS.indexOf(id) >= 0;
            })
        ) {
            sectionClass += ' sc-blueprint-mission-sections--summary-bottom';
        }

        var html = '<div class="' + sectionClass + '">';
        groups.forEach(function (group) {
            html += renderSummaryGroupSection(group);
        });
        html += '</div>';
        return html;
    }

    function formatRepXp(value) {
        if (value == null || !Number.isFinite(Number(value))) return '—';
        var f = window.ScDisplayFormat;
        var hit = f && f.formatFixedDecimal2 ? f.formatFixedDecimal2(value) : null;
        return hit != null ? hit : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderReputationLadder(ladder) {
        if (!ladder || !Array.isArray(ladder.tiers) || !ladder.tiers.length) return '';

        var html = '<div class="sc-rep-ladder">';
        html +=
            '<div class="sc-rep-ladder-head">' +
            '<span class="sc-rep-ladder-faction">' +
            escapeHtml(ladder.faction || '') +
            '</span>';
        if (ladder.has_requirement) {
            html += '<span class="sc-rep-ladder-range">';
            if (ladder.min_reputation != null && ladder.max_reputation != null) {
                html +=
                    '需声望 ' +
                    escapeHtml(formatRepXp(ladder.min_reputation)) +
                    ' – ' +
                    escapeHtml(formatRepXp(ladder.max_reputation));
            } else if (ladder.min_reputation != null) {
                html += '需声望 ≥ ' + escapeHtml(formatRepXp(ladder.min_reputation));
            } else if (ladder.max_reputation != null) {
                html += '需声望 ≤ ' + escapeHtml(formatRepXp(ladder.max_reputation));
            }
            html += '</span>';
        } else {
            html += '<span class="sc-rep-ladder-range sc-rep-ladder-range--info">声望等级参考</span>';
        }
        html += '</div>';

        html += '<ul class="sc-rep-ladder-list" role="list">';
        ladder.tiers.forEach(function (tier) {
            var cls = 'sc-rep-tier';
            if (tier.required) cls += ' sc-rep-tier--required';

            html += '<li class="' + cls + '">';
            html += '<span class="sc-rep-tier-check" aria-hidden="true"></span>';
            html += '<span class="sc-rep-tier-name">' + escapeHtml(tier.standing_zh || tier.display_name_en || '—') + '</span>';
            html += '<span class="sc-rep-tier-xp">' + escapeHtml(formatRepXp(tier.min_reputation)) + '</span>';
            html += '</li>';
        });
        html += '</ul>';

        if (ladder.hostile && ladder.hostile.standing_zh) {
            html +=
                '<p class="sc-rep-ladder-hostile">' +
                escapeHtml(ladder.hostile.standing_zh) +
                '</p>';
        }
        html += '</div>';
        return html;
    }

    function detailPagePathname() {
        var p = window.location.pathname || '';
        if (/ship-component-detail(\.html)?$/i.test(p)) return p;
        if (/ship-components(\.html)?$/i.test(p)) {
            return p.replace(/ship-components(\.html)?$/i, function (_m, ext) {
                return 'ship-component-detail' + (ext || '');
            });
        }
        try {
            var stored = sessionStorage.getItem('scComponentListReturnPathname') || '';
            if (/ship-components(\.html)?$/i.test(stored)) {
                return stored.replace(/ship-components(\.html)?$/i, function (_m, ext) {
                    return 'ship-component-detail' + (ext || '');
                });
            }
        } catch (e) {
            /* ignore */
        }
        return '/ship-component-detail';
    }

    function readNavContext(container) {
        var panel = container && container.closest('[data-blueprint-panel]');
        var group = (panel && panel.dataset.navGroup) || '';
        var type = (panel && panel.dataset.navType) || '';
        if (!group || !type) {
            try {
                var params = new URLSearchParams(window.location.search || '');
                if (!group) group = params.get('group') || '';
                if (!type) type = params.get('type') || '';
            } catch (e) {
                /* ignore */
            }
        }
        return {
            group: group || 'component',
            type: type || '',
        };
    }

    function componentDetailHref(item, navContext) {
        var id = item && (item.component_id || item.uuid);
        if (!id) return '';
        var ctx = navContext || readNavContext();
        var group = (item && item.component_group) || ctx.group || 'component';
        var type = (item && item.component_type) || ctx.type || '';
        try {
            var url = new URL(detailPagePathname(), window.location.href);
            url.searchParams.set('id', String(id));
            url.searchParams.set('group', group);
            if (type) url.searchParams.set('type', type);
            return url.pathname + url.search;
        } catch (e) {
            var href =
                detailPagePathname() +
                '?id=' +
                encodeURIComponent(String(id)) +
                '&group=' +
                encodeURIComponent(group);
            if (type) href += '&type=' + encodeURIComponent(type);
            return href;
        }
    }

    function rememberComponentDetailId(id) {
        var cid = String(id || '').trim();
        if (!cid) return;
        try {
            sessionStorage.setItem('scComponentDetailId', cid);
        } catch (e) {
            /* ignore */
        }
    }

    function isDetailReturnFromBlueprintCrafting() {
        try {
            if (sessionStorage.getItem('scDetailReturnSource') === 'blueprint-crafting') return true;
            var params = new URLSearchParams(window.location.search || '');
            return params.get('from') === 'blueprint-crafting';
        } catch (e) {
            return false;
        }
    }

    function stashListReturnForDetailNav() {
        if (isDetailReturnFromBlueprintCrafting()) return;
        if (
            window.UssScComponentsListNav &&
            typeof window.UssScComponentsListNav.rememberListReturnState === 'function'
        ) {
            window.UssScComponentsListNav.rememberListReturnState();
        }
    }

    function formatDropPercent(value) {
        if (value == null || !Number.isFinite(Number(value))) return '';
        var n = Number(value);
        var text = n % 1 === 0 ? String(n) : String(Math.round(n * 100) / 100);
        return text + '%';
    }

    function renderBlueprintPoolChip(item, navContext) {
        var label = (item && (item.name_zh || item.name_en)) || '';
        if (!label) return '';
        var pct = formatDropPercent(item && item.drop_chance_percent);
        var text = escapeHtml(label) + (pct ? '<span class="sc-mission-chip-pct">' + escapeHtml(pct) + '</span>' : '');
        var craftHref = buildBlueprintCraftHref({
            uuid: (item && (item.blueprint_uuid || item.uuid)) || '',
            nav_group: item && (item.nav_group || item.component_group),
            nav_type: item && (item.nav_type || item.component_type),
            component_id: item && item.component_id,
        });
        if (craftHref) {
            return (
                '<a class="sc-mission-chip sc-mission-chip--link" href="' +
                escapeHtml(craftHref) +
                '" target="_blank" rel="noopener noreferrer">' +
                text +
                '</a>'
            );
        }
        var href = componentDetailHref(item, navContext);
        if (href) {
            return (
                '<a class="sc-mission-chip sc-mission-chip--link" href="' +
                escapeHtml(href) +
                '" data-component-id="' +
                escapeHtml(item.component_id || item.uuid || '') +
                '">' +
                text +
                '</a>'
            );
        }
        var ref = (item && (item.name_zh || item.name_en || item.uuid)) || '';
        if (ref) {
            return (
                '<button type="button" class="sc-mission-chip sc-mission-chip--link sc-mission-chip--resolve" data-pool-item-ref="' +
                escapeHtml(ref) +
                '">' +
                text +
                '</button>'
            );
        }
        return '<span class="sc-mission-chip">' + text + '</span>';
    }

    async function navigatePoolItemRef(ref, navContext) {
        var key = String(ref || '').trim();
        if (!key) return;
        try {
            var res = await fetch(apiUrl('/api/sc/components/' + encodeURIComponent(key)));
            var data = await res.json();
            if (res.ok && data.ok && data.item) {
                var href = componentDetailHref(
                    {
                        component_id: data.item.id_item || data.item.uuid,
                        component_type: data.item.type,
                        component_group: inferNavGroupFromItemType(data.item.type),
                    },
                    navContext
                );
                if (href) {
                    rememberComponentDetailId(data.item.id_item || data.item.uuid);
                    stashListReturnForDetailNav();
                    window.location.href = href;
                    return;
                }
            }
        } catch (e) {
            /* fall through */
        }
        try {
            var sugRes = await fetch(apiUrl('/api/sc/components/suggest?q=' + encodeURIComponent(key) + '&limit=12'));
            var sugData = await sugRes.json();
            var items = (sugData && sugData.items) || [];
            var lower = key.toLowerCase();
            var exact = items.find(function (it) {
                return (
                    String(it.name_en || '')
                        .trim()
                        .toLowerCase() === lower ||
                    String(it.name_zh || '')
                        .trim()
                        .toLowerCase() === lower
                );
            });
            if (exact && exact.id_item != null) {
                var hrefExact = componentDetailHref(
                    {
                        component_id: exact.id_item,
                        component_type: exact.type,
                        component_group: inferNavGroupFromItemType(exact.type),
                    },
                    navContext
                );
                if (hrefExact) {
                    rememberComponentDetailId(exact.id_item);
                    stashListReturnForDetailNav();
                    window.location.href = hrefExact;
                }
            }
        } catch (e2) {
            /* ignore */
        }
    }

    function renderBlueprintPools(value, pools, navContext) {
        if (Array.isArray(pools) && pools.length) {
            var html = '<div class="sc-mission-pool-list">';
            pools.forEach(function (pool) {
                html += '<div class="sc-mission-pool">';
                html += '<div class="sc-mission-chips">';
                (pool.items || []).forEach(function (item) {
                    html += renderBlueprintPoolChip(item, navContext);
                });
                html += '</div></div>';
            });
            html += '</div>';
            return html;
        }

        var raw = String(value || '').trim();
        if (!raw) return '';
        var poolStrings = raw.split('；').filter(Boolean);
        if (!poolStrings.length) return escapeHtml(raw);
        var htmlLegacy = '<div class="sc-mission-pool-list">';
        poolStrings.forEach(function (pool) {
            var match = pool.match(/^([\d.]+%\s*掉落池)\s*[：:]\s*(.+)$/);
            htmlLegacy += '<div class="sc-mission-pool">';
            if (match) {
                htmlLegacy += '<div class="sc-mission-pool-head">' + escapeHtml(match[1]) + '</div>';
                htmlLegacy += '<div class="sc-mission-chips">';
                match[2].split('、').forEach(function (item) {
                    var t = item.trim();
                    if (!t) return;
                    htmlLegacy += renderBlueprintPoolChip({ name_zh: t }, navContext);
                });
                htmlLegacy += '</div>';
            } else {
                htmlLegacy += '<div class="sc-mission-pool-plain">' + escapeHtml(pool) + '</div>';
            }
            htmlLegacy += '</div>';
        });
        htmlLegacy += '</div>';
        return htmlLegacy;
    }

    function splitLocationNameToParts(name) {
        var text = String(name || '').trim();
        if (!text) return [];
        var parts = text
            .split(/\s*[·•|]\s*/)
            .map(function (seg) {
                return seg.trim();
            })
            .filter(Boolean);
        return parts.length > 1 ? parts : [text];
    }

    function renderLocationPartsHtml(parts) {
        if (!parts || !parts.length) return escapeHtml('—');
        return (
            '<span class="sc-loc-path">' +
            parts
                .map(function (part, i) {
                    var level = Math.min(i, 4);
                    return (
                        '<span class="sc-loc-level sc-loc-level--' +
                        level +
                        '">' +
                        escapeHtml(part) +
                        '</span>'
                    );
                })
                .join('') +
            '</span>'
        );
    }

    function renderLocationNamesRow(names) {
        var list = (names || []).filter(Boolean);
        if (!list.length) return '';
        var html = '<div class="sc-mission-loc-list">';
        list.forEach(function (name) {
            html +=
                '<span class="sc-mission-loc-item">' +
                renderLocationPartsHtml(splitLocationNameToParts(name)) +
                '</span>';
        });
        html += '</div>';
        return html;
    }

    function parseLocationValueString(value) {
        var groups = [];
        String(value || '')
            .split('；')
            .forEach(function (chunk) {
                var text = chunk.trim();
                if (!text) return;
                var idx = text.search(/[：:]/);
                if (idx < 0) return;
                var purpose = text.slice(0, idx).trim();
                var body = text.slice(idx + 1).trim();
                if (!purpose || !body) return;
                groups.push({
                    purpose_zh: purpose,
                    names: body
                        .split('、')
                        .map(function (seg) {
                            return seg.trim();
                        })
                        .filter(Boolean),
                });
            });
        return groups;
    }

    function getMissionLocationGroups(detail, byLabel) {
        if (detail && Array.isArray(detail.location_groups) && detail.location_groups.length) {
            return detail.location_groups;
        }
        var groups = [];
        if (byLabel['相关星系'] && byLabel['相关星系'].value) {
            groups.push({
                purpose_zh: '相关星系',
                names: String(byLabel['相关星系'].value)
                    .split('、')
                    .map(function (seg) {
                        return seg.trim();
                    })
                    .filter(Boolean),
            });
        }
        if (byLabel['任务地点'] && byLabel['任务地点'].value) {
            var parsed = parseLocationValueString(byLabel['任务地点'].value);
            if (parsed.length) groups.push.apply(groups, parsed);
        }
        return groups;
    }

    function renderMissionLocationGroups(groups) {
        if (!groups || !groups.length) return '';
        var html = '<div class="sc-mission-loc-groups">';
        groups.forEach(function (group) {
            if (!group || !group.names || !group.names.length) return;
            html += '<div class="sc-mission-loc-group">';
            html += '<div class="sc-mission-loc-group-label">' + escapeHtml(group.purpose_zh || '地点') + '</div>';
            html += renderLocationNamesRow(group.names);
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderMissionFieldValue(row, wide, detail, valueClass, navContext) {
        var cls = valueClass || 'sc-mission-field-value';
        if (row.label === '蓝图掉落') {
            return renderBlueprintPools(row.value, detail && detail.blueprint_pools, navContext).replace(
                /sc-mission-field-value/g,
                cls
            );
        }
        if (row.label === '接取费用') {
            return '<span class="' + cls + ' sc-mission-kv-value--cost">' + escapeHtml(row.value) + '</span>';
        }
        if (wide) {
            return '<div class="' + cls + ' ' + cls + '--wide">' + escapeHtml(row.value) + '</div>';
        }
        return '<span class="' + cls + '">' + escapeHtml(row.value) + '</span>';
    }

    function renderMissionFieldRow(row, wide, detail, navContext) {
        var valueHtml = renderMissionFieldValue(row, wide, detail, 'sc-mission-kv-value', navContext);
        var highlight =
            row.label === 'aUEC 奖励' ||
            row.label === '声望报酬' ||
            row.label === '物品奖励' ||
            row.label === '蓝图掉落' ||
            row.label === '接取费用' ||
            row.label === '运送货物' ||
            row.label === '不同处';
        return (
            '<div class="sc-mission-kv' +
            (wide ? ' sc-mission-kv--wide' : '') +
            (highlight ? ' sc-mission-kv--emphasis' : '') +
            '">' +
            '<span class="sc-mission-kv-label">' +
            escapeHtml(row.label) +
            '</span>' +
            valueHtml +
            '</div>'
        );
    }

    function missionHasPrerequisites(detail, rows) {
        if (rows && rows.length) return true;
        var ladder = detail && detail.reputation_ladder;
        return !!(
            ladder &&
            ladder.has_requirement &&
            Array.isArray(ladder.tiers) &&
            ladder.tiers.length
        );
    }

    function renderMissionFieldSections(fields, detail, navContext) {
        if (!fields || !fields.length) {
            if (!(detail && detail.reputation_ladder && detail.reputation_ladder.has_requirement)) return '';
        }
        var byLabel = Object.create(null);
        (fields || []).forEach(function (row) {
            if (row && row.label) byLabel[row.label] = row;
        });
        var html = '<div class="sc-blueprint-mission-sections">';
        MISSION_FIELD_GROUPS.forEach(function (group) {
            var rows = [];
            group.labels.forEach(function (label) {
                if (byLabel[label]) rows.push(byLabel[label]);
            });
            var hasRepLadder =
                group.id === 'prerequisites' &&
                detail &&
                detail.reputation_ladder &&
                detail.reputation_ladder.has_requirement &&
                Array.isArray(detail.reputation_ladder.tiers) &&
                detail.reputation_ladder.tiers.length;
            if (group.id === 'prerequisites' && !missionHasPrerequisites(detail, rows)) return;
            if (group.id === 'location') {
                var locGroups = getMissionLocationGroups(detail, byLabel);
                if (!locGroups.length && !rows.length) return;
            } else if (!rows.length && !hasRepLadder) return;
            var wideSet = Object.create(null);
            (group.wideLabels || []).forEach(function (l) {
                wideSet[l] = true;
            });
            html += '<section class="sc-blueprint-mission-section sc-blueprint-mission-section--' + group.id + '">';
            html += '<h4 class="sc-blueprint-mission-section-title">' + escapeHtml(group.title) + '</h4>';
            if (hasRepLadder) {
                html += renderReputationLadder(detail.reputation_ladder);
            }
            if (group.id === 'location') {
                var locationGroups = getMissionLocationGroups(detail, byLabel);
                if (locationGroups.length) {
                    html += renderMissionLocationGroups(locationGroups);
                } else if (rows.length) {
                    html += '<div class="sc-blueprint-mission-section-grid">';
                    rows.forEach(function (row) {
                        html += renderMissionFieldRow(row, !!wideSet[row.label], detail, navContext);
                    });
                    html += '</div>';
                }
            } else if (rows.length) {
                html += '<div class="sc-blueprint-mission-section-grid">';
                rows.forEach(function (row) {
                    html += renderMissionFieldRow(row, !!wideSet[row.label], detail, navContext);
                });
                html += '</div>';
            }
            html += '</section>';
        });
        var used = Object.create(null);
        MISSION_FIELD_GROUPS.forEach(function (group) {
            group.labels.forEach(function (label) {
                used[label] = true;
            });
        });
        MISSION_SUMMARY_GROUPS.forEach(function (group) {
            group.labels.forEach(function (label) {
                used[label] = true;
            });
        });
        used['蓝图掉落'] = true;
        SUPPRESSED_DETAIL_LABELS.forEach(function (label) {
            used[label] = true;
        });
        var extra = (fields || []).filter(function (row) {
            return row && row.label && !used[row.label] && SUPPRESSED_DETAIL_LABELS.indexOf(row.label) < 0;
        });
        if (extra.length) {
            html += '<section class="sc-blueprint-mission-section sc-blueprint-mission-section--extra">';
            html += '<h4 class="sc-blueprint-mission-section-title">其他</h4>';
            html += '<div class="sc-blueprint-mission-section-grid">';
            extra.forEach(function (row) {
                html += renderMissionFieldRow(row, String(row.value || '').length > 48, detail, navContext);
            });
            html += '</div></section>';
        }
        html += '</div>';
        return html;
    }

    function stripMissionFlowTitleSuffix(text) {
        return String(text || '')
            .replace(/\s*[·•]\s*(驶向|离开)\s*$/, '')
            .trim();
    }

    function looksChineseMissionText(text) {
        return /[\u4e00-\u9fff]/.test(String(text || ''));
    }

    function missionDisplayTitle(m) {
        var zh = m && m.title_zh;
        if (zh && looksChineseMissionText(zh)) {
            return stripMissionFlowTitleSuffix(stripMissionPlaceholders(zh)) || '—';
        }
        var raw = (m && (m.title_en || m.title)) || '';
        var cleaned = stripMissionPlaceholders(raw);
        return stripMissionFlowTitleSuffix(cleaned || raw) || '—';
    }

    function missionRef(m) {
        if (!m) return '';
        if (m.uuid) return String(m.uuid);
        var url = String(m.web_url || '');
        var match = url.match(/\/missions\/([^/?#]+)/i);
        if (match) return decodeURIComponent(match[1]);
        if (m.debug_name) return String(m.debug_name).trim();
        return '';
    }

    function missionListCacheKey(item) {
        item = item || {};
        var blueprintUuid = String(item.blueprint_uuid || '').trim();
        var useComponent = item.use_component_missions === true;
        var id = item.id_item || item.uuid;
        if (useComponent && id) return 'c:' + String(id);
        if (blueprintUuid) return 'b:' + blueprintUuid;
        if (id) return 'c:' + String(id);
        return '';
    }

    function missionsForContainer(container) {
        var panelRoot = container.closest('[data-blueprint-panel]') || container;
        var cacheKey =
            container.dataset.missionsCacheKey || panelRoot.dataset.missionsCacheKey || '';
        if (cacheKey && listCache[cacheKey]) return listCache[cacheKey];
        if (container._bpMissions && container._bpMissions.length) return container._bpMissions;
        if (panelRoot._bpMissions && panelRoot._bpMissions.length) return panelRoot._bpMissions;
        return [];
    }

    function rememberMissionsOnPanel(container, item, missions) {
        var panelRoot = container.closest('[data-blueprint-panel]') || container;
        var cacheKey = missionListCacheKey(item);
        var list = missions || [];
        container._bpMissions = list;
        if (panelRoot !== container) panelRoot._bpMissions = list;
        if (cacheKey) {
            listCache[cacheKey] = list;
            container.dataset.missionsCacheKey = cacheKey;
            panelRoot.dataset.missionsCacheKey = cacheKey;
        }
    }

    function renderMetaRow(label, value) {
        if (!value) return '';
        return (
            '<div class="sc-blueprint-meta-row">' +
            '<span class="sc-blueprint-meta-label">' +
            escapeHtml(label) +
            '</span>' +
            '<span class="sc-blueprint-meta-value">' +
            escapeHtml(value) +
            '</span></div>'
        );
    }

    var MISSION_TYPE_ZH_FALLBACK = {
        Refueling: '加油',
        'Ship Mining': '飞船采矿',
        'Hand Mining': '手持采矿',
        Salvage: '打捞',
    };

    var MISSION_GIVER_ZH_FALLBACK = {
        'United Wayfarers Club': '旅者联合俱乐部',
        'Adagio Holdings': '阿德吉奥集团',
        'Greycat Industrial': '灰猫工业',
    };

    function missionTypeLabel(m) {
        var zh = m && m.mission_type_zh;
        if (zh && looksChineseMissionText(zh)) return zh;
        var raw = (m && m.mission_type) || '';
        if (raw && MISSION_TYPE_ZH_FALLBACK[raw]) return MISSION_TYPE_ZH_FALLBACK[raw];
        return raw;
    }

    function missionGiverLabel(m) {
        var zh = m && m.mission_giver_zh;
        if (zh && looksChineseMissionText(zh)) return zh;
        var raw = (m && m.mission_giver) || '';
        if (raw && MISSION_GIVER_ZH_FALLBACK[raw]) return MISSION_GIVER_ZH_FALLBACK[raw];
        return raw;
    }

    function missionAuecLabel(m) {
        var label = m && (m.reward_auec_label || '');
        if (!label && m && m.reward_min != null && Number(m.reward_min) > 0) {
            var f = window.ScDisplayFormat;
            label = f && f.formatDisplayPrice ? f.formatDisplayPrice(m.reward_min) : Number(m.reward_min).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' aUEC';
        }
        return label || '';
    }

    function missionLegalityLabel(m) {
        if (m && m.legality_zh) return m.legality_zh;
        if (m && m.illegal === true) return '非法';
        if (m && m.legality_label === 'Legal') return '合法';
        if (m && m.legality_label === 'Illegal') return '非法';
        return (m && m.legality_label) || '';
    }

    function renderMissionTypeCell(m) {
        var typeLabel = missionTypeLabel(m);
        if (!typeLabel) {
            return '<span class="sc-blueprint-mission-type sc-blueprint-mission-type--empty">—</span>';
        }
        return '<span class="sc-blueprint-mission-type" data-mission-type="' + escapeHtml(typeLabel) + '">' + escapeHtml(typeLabel) + '</span>';
    }

    function renderMissionGiverCell(m) {
        var giver = missionGiverLabel(m);
        if (!giver) {
            return '<span class="sc-blueprint-mission-giver sc-blueprint-mission-giver--empty">—</span>';
        }
        return '<span class="sc-blueprint-mission-giver" title="' + escapeHtml(giver) + '">' + escapeHtml(giver) + '</span>';
    }

    function renderMissionLegalityCell(m) {
        var legality = missionLegalityLabel(m);
        if (!legality) {
            return '<span class="sc-blueprint-mission-legality sc-blueprint-mission-legality--empty">—</span>';
        }
        var cls = 'sc-blueprint-mission-legality';
        if (legality === '非法') cls += ' sc-blueprint-mission-legality--illegal';
        else if (legality === '合法') cls += ' sc-blueprint-mission-legality--legal';
        return '<span class="' + cls + '">' + escapeHtml(legality) + '</span>';
    }

    function renderMissionBlueprintCell(m) {
        if (!m || !m.has_blueprint) return '';
        var label = String(m.blueprint_tag_zh || '').trim();
        if (!label) return '';
        return '<span class="sc-blueprint-mission-blueprint">' + escapeHtml(label) + '</span>';
    }

    function renderMissionMetaGroup(m) {
        return (
            '<span class="sc-blueprint-mission-meta">' +
            renderMissionTypeCell(m) +
            renderMissionRepCell(m) +
            renderMissionGiverCell(m) +
            renderMissionLegalityCell(m) +
            '</span>'
        );
    }

    function variantMetaForTags(summary, variant) {
        var amount = Number(variant && variant.reputation_amount);
        var hasAmount = Number.isFinite(amount);
        var min = hasAmount
            ? amount
            : variant && variant.reputation_min != null
              ? Number(variant.reputation_min)
              : null;
        var max = hasAmount
            ? amount
            : variant && variant.reputation_max != null
              ? Number(variant.reputation_max)
              : min;
        return Object.assign({}, summary || {}, {
            mission_type_zh: (variant && variant.mission_type_zh) || (summary && summary.mission_type_zh),
            mission_type: (variant && variant.mission_type) || (summary && summary.mission_type),
            mission_giver_zh: (variant && variant.mission_giver_zh) || (summary && summary.mission_giver_zh),
            legality_zh: (variant && variant.legality_zh) || (summary && summary.legality_zh),
            reputation_amount: hasAmount ? amount : null,
            reputation_min: Number.isFinite(min) ? min : null,
            reputation_max: Number.isFinite(max) ? max : null,
        });
    }

    function formatMissionRepAmount(amount) {
        var n = Number(amount);
        if (!Number.isFinite(n)) return '';
        return (n > 0 ? '+' : '') + n.toLocaleString('zh-CN');
    }

    function renderMissionRepCell(m) {
        var min = m && m.reputation_min != null ? Number(m.reputation_min) : Number(m && m.reputation_amount);
        var max = m && m.reputation_max != null ? Number(m.reputation_max) : min;
        if (!Number.isFinite(min) || min === 0) {
            return '<span class="sc-blueprint-mission-rep sc-blueprint-mission-rep--empty">—</span>';
        }
        var text = '声望' + formatMissionRepAmount(min);
        if (Number.isFinite(max) && max !== min) text += '–' + formatMissionRepAmount(max);
        return '<span class="sc-blueprint-mission-rep">' + escapeHtml(text) + '</span>';
    }

    function renderMissionRewardCell(m) {
        var costLabel = m && m.cost_auec_label;
        var auecLabel = missionAuecLabel(m);
        var html = '';
        if (costLabel && !auecLabel) {
            html = '<span class="sc-blueprint-mission-reward sc-blueprint-mission-reward--cost">' + escapeHtml(costLabel) + '</span>';
        } else if (!auecLabel) {
            html = '<span class="sc-blueprint-mission-reward sc-blueprint-mission-reward--empty">—</span>';
        } else {
            html = '<span class="sc-blueprint-mission-reward sc-price">' + escapeHtml(auecLabel) + '</span>';
            if (costLabel) {
                html += '<span class="sc-blueprint-mission-reward sc-blueprint-mission-reward--cost">' + escapeHtml(costLabel) + '</span>';
            }
        }
        return '<span class="sc-blueprint-mission-pay">' + html + '</span>';
    }

    function renderMissionTableHeadHtml() {
        return (
            '<div class="sc-blueprint-mission-table-head" aria-hidden="true">' +
            '<span class="sc-bp-mission-th sc-bp-mission-th--name">任务</span>' +
            '<span class="sc-bp-mission-th sc-bp-mission-th--meta">类型 / 声望报酬 / 发布方 / 合法性</span>' +
            '<span class="sc-bp-mission-th sc-bp-mission-th--reward">aUEC</span>' +
            '<span class="sc-bp-mission-th sc-bp-mission-th--exp"></span>' +
            '</div>'
        );
    }

    function missionEnglishTitle(m) {
        var en = stripMissionPlaceholders((m && (m.title_en || m.title)) || '');
        var shown = missionDisplayTitle(m);
        if (!en || en === shown) return '';
        return en;
    }

    function renderMissionItem(m, expandedId) {
        var ref = missionRef(m);
        var isOpen = ref && splitOpenRefs(expandedId).indexOf(ref) >= 0;
        var titleSuffix = renderMissionBlueprintCell(m);
        var dropLabel = formatBlueprintDropLabel(m.chance);
        if (dropLabel) {
            titleSuffix += ' <span class="sc-blueprint-mission-scope">' + escapeHtml(dropLabel) + '</span>';
        }
        if (m.variant_count != null && Number(m.variant_count) > 1) {
            titleSuffix +=
                ' <span class="sc-blueprint-mission-variants">' +
                escapeHtml(String(m.variant_count) + ' 个方案') +
                '</span>';
        }

        var html =
            '<li class="sc-blueprint-mission-item' +
            (isOpen ? ' is-open' : '') +
            '">' +
            '<button type="button" class="sc-blueprint-mission-toggle" data-mission-ref="' +
            escapeHtml(ref) +
            '" aria-expanded="' +
            (isOpen ? 'true' : 'false') +
            '">' +
            (ref
                ? '<span class="sc-mission-note" role="button" tabindex="0" data-mission-note="' +
                  escapeHtml(ref) +
                  '" data-label="' +
                  escapeHtml(missionDisplayTitle(m)) +
                  '" aria-label="查看' +
                  escapeHtml(missionDisplayTitle(m)) +
                  '的留言"></span>'
                : '') +
            '<span class="sc-blueprint-mission-title">' +
            '<span class="sc-blueprint-mission-title-line">' +
            '<span class="sc-blueprint-mission-title-text">' +
            escapeHtml(missionDisplayTitle(m)) +
            '</span>' +
            titleSuffix +
            '</span>' +
            (missionEnglishTitle(m)
                ? '<span class="sc-blueprint-mission-title-en">' +
                  escapeHtml(missionEnglishTitle(m)) +
                  '</span>'
                : '') +
            '</span>' +
            renderMissionMetaGroup(m) +
            renderMissionRewardCell(m) +
            '<span class="sc-blueprint-mission-chevron" aria-hidden="true"></span>' +
            '</button>';

        var manyVariants = variantList(m).length > 1;
        if (isOpen && manyVariants) html += renderVariantPicker(m, '');

        html +=
            '<div class="sc-blueprint-mission-detail" id="sc-mission-detail-' +
            escapeHtml(ref) +
            '" data-mission-detail="' +
            escapeHtml(ref) +
            '"' +
            (isOpen && !manyVariants ? '' : ' hidden') +
            '>';
        html += '<div class="sc-blueprint-mission-detail-body">';
        if (isOpen && !manyVariants && detailCache[ref] && isUsableMissionDetail(detailCache[ref])) {
            html += renderMissionDetailBody(detailCache[ref], readNavContext(), m);
        } else if (isOpen && !manyVariants) {
            html += '<p class="sc-acquire-loading">加载任务详情…</p>';
        }
        html += '</div></div></li>';
        return html;
    }

    function sameContractTitle(summary, variant) {
        var parentEn = String((summary && summary.title_en) || '').trim().toLowerCase();
        var variantEn = String((variant && variant.title_en) || '').trim().toLowerCase();
        return !!(parentEn && variantEn && parentEn === variantEn);
    }

    function variantDisplayTitle(summary, variant) {
        var parent = missionDisplayTitle(summary);
        if (sameContractTitle(summary, variant) && looksChineseMissionText(parent)) return parent;
        return (variant && variant.label) || missionDisplayTitle(variant);
    }

    function variantEnglishTitle(summary, variant) {
        if (sameContractTitle(summary, variant)) return '';
        return missionEnglishTitle(variant);
    }

    function variantList(summary) {
        var list = summary && summary.variants;
        return Array.isArray(list) ? list.filter(Boolean) : [];
    }

    function sortedVariantList(summary) {
        return variantList(summary).slice().sort(function (a, b) {
            var ar = Number(a && a.reward_min) || 0;
            var br = Number(b && b.reward_min) || 0;
            if (ar !== br) return ar - br;
            return String((a && a.cargo_zh) || '').localeCompare(String((b && b.cargo_zh) || ''), 'zh');
        });
    }

    function selectedVariant(summary, selectedRef) {
        var list = sortedVariantList(summary);
        if (!list.length) return null;
        var hit = list.find(function (v) {
            return String(v.uuid || v.debug_name || '') === String(selectedRef || '');
        });
        return hit || list[0];
    }

    function inheritedTagValues(summary) {
        return [missionTypeLabel(summary), missionGiverLabel(summary), missionLegalityLabel(summary)]
            .map(function (value) {
                return String(value || '').trim();
            })
            .filter(Boolean);
    }

    function renderVariantDiffMarks(marks) {
        if (!marks.length) return '';
        return (
            '<span class="sc-mission-variant-diff">' +
            marks
                .map(function (mark) {
                    return (
                        '<span class="sc-mission-variant-cargo sc-mission-variant-cargo--diff"><span class="sc-mission-variant-mark-k">' +
                        escapeHtml(mark.label || '') +
                        '</span>' +
                        escapeHtml(mark.value) +
                        '</span>'
                    );
                })
                .join('') +
            '</span>'
        );
    }

    function renderVariantPicker(summary, selectedRef) {
        var list = sortedVariantList(summary);
        if (list.length < 2) return '';
        var current = selectedRef ? selectedVariant(summary, selectedRef) : null;
        var inheritedValues = inheritedTagValues(summary);
        var html = '<div class="sc-mission-variant-bar" role="menu" aria-label="任务方案">';
        list.forEach(function (v, i) {
            var id = String(v.uuid || v.debug_name || i);
            var on = current && String(current.uuid || current.debug_name || '') === id;
            var reward = missionAuecLabel(v);
            var marks = Array.isArray(v.marks) ? v.marks.filter(function (mark) {
                return mark && String(mark.value || '').trim();
            }) : [];
            if (!marks.length && v.cargo_zh) marks = [{ label: '运送货物', value: v.cargo_zh }];
            var diffMarks = marks.filter(function (mark) {
                return inheritedValues.indexOf(String(mark.value || '').trim()) < 0;
            });
            html +=
                '<button type="button" class="sc-mission-variant-btn' +
                (on ? ' is-active' : '') +
                '" role="menuitem" aria-selected="' +
                (on ? 'true' : 'false') +
                '" data-variant-ref="' +
                escapeHtml(id) +
                '"><span class="sc-mission-variant-branch" aria-hidden="true"></span>' +
                '<span class="sc-mission-variant-name">' +
                escapeHtml(variantDisplayTitle(summary, v)) +
                (variantEnglishTitle(summary, v)
                    ? '<span class="sc-blueprint-mission-title-en">' +
                      escapeHtml(variantEnglishTitle(summary, v)) +
                      '</span>'
                    : '') +
                '</span>' +
                '<span class="sc-mission-variant-tags">' +
                '<span class="sc-mission-variant-inherited">' +
                renderMissionMetaGroup(variantMetaForTags(summary, v)) +
                '</span>' +
                renderVariantDiffMarks(diffMarks) +
                '</span>' +
                (reward
                    ? '<span class="sc-mission-variant-reward">' + escapeHtml(reward) + '</span>'
                    : '<span class="sc-mission-variant-reward"></span>') +
                '</button>';
        });
        html += '</div>';
        return html;
    }

    function anchorVariantDetail(detailEl, variant) {
        if (!detailEl || !variant) return;
        var id = String(variant.uuid || variant.debug_name || '');
        var item = detailEl.closest('.sc-blueprint-mission-item');
        if (!item || !id) return;
        var btn = item.querySelector('.sc-mission-variant-btn[data-variant-ref="' + cssEscape(id) + '"]');
        if (btn) btn.insertAdjacentElement('afterend', detailEl);
    }

    function renderMissionDetailBody(detail, navContext, summary, variantSource) {
        if (!detail) return '<p class="sc-acquire-empty">暂无任务详情</p>';
        var ctx = navContext || readNavContext();
        var body = missionBriefingZh(detail, summary);
        var html = '<div class="sc-blueprint-mission-detail-inner">';
        html += renderMissionSummarySections(detail.fields, detail, ['overview']);
        if (body) {
            html +=
                '<section class="sc-blueprint-mission-section sc-blueprint-mission-section--briefing">' +
                '<h4 class="sc-blueprint-mission-section-title">任务简报</h4>' +
                '<div class="sc-blueprint-mission-desc">' +
                formatMissionBody(body) +
                '</div></section>';
        } else if (detail.description_en) {
            html +=
                '<section class="sc-blueprint-mission-section sc-blueprint-mission-section--briefing">' +
                '<h4 class="sc-blueprint-mission-section-title">任务简报</h4>' +
                '<p class="sc-acquire-empty">任务简报暂未汉化</p></section>';
        }
        html += renderMissionFieldSections(detail.fields, detail, ctx);
        html += renderMissionSummarySections(detail.fields, detail, MISSION_SUMMARY_DEFERRED_IDS);
        if (!detail.loc_matched && detail.description_en && !detail.description_zh) {
            html += '<p class="sc-blueprint-mission-loc-note">该任务暂未匹配到完整译文</p>';
        }
        html += '</div>';
        return html;
    }

    function flattenUnlockingMissionGroups(groups) {
        if (!Array.isArray(groups) || !groups.length) return [];
        var out = [];
        groups.forEach(function (group) {
            (group.missions || []).forEach(function (m) {
                if (!m || typeof m !== 'object') return;
                var title = m.title || m.debug_name || '';
                var stub = { web_url: m.web_url || null, uuid: m.uuid || null };
                out.push({
                    uuid: m.uuid || missionRef(stub) || null,
                    title_en: title || '未命名任务',
                    title_zh: m.title_zh || null,
                    debug_name: m.debug_name || null,
                    web_url: m.web_url || null,
                    chance: m.chance != null ? m.chance : null,
                    reward_scope: m.reward_scope || null,
                    mission_type: m.mission_type || null,
                    mission_type_zh: m.mission_type_zh || null,
                    mission_giver: m.mission_giver || null,
                    mission_giver_zh: m.mission_giver_zh || null,
                    legality_label: m.legality_label || null,
                    illegal: m.illegal === true,
                    legality_zh: m.legality_zh || null,
                    reward_auec_label: m.reward_auec_label || null,
                    reward_min: m.reward_min != null ? m.reward_min : null,
                });
            });
        });
        return out;
    }

    function embeddedBlueprintMissions(item) {
        return flattenUnlockingMissionGroups(item && item.unlocking_missions);
    }

    function renderMissionListHtml(missions, expandedId) {
        if (!missions || !missions.length) {
            return '<p class="sc-acquire-empty">暂无蓝图解锁任务</p>';
        }
        var html = '<div class="sc-blueprint-mission-table-wrap">';
        html += renderMissionTableHeadHtml();
        html += '<ul class="sc-blueprint-mission-list">';
        missions.forEach(function (m) {
            html += renderMissionItem(m, expandedId);
        });
        html += '</ul></div>';
        return html;
    }

    function buildBlueprintCraftHref(blueprint) {
        if (!blueprint || !blueprint.uuid) return '';
        try {
            var url = new URL('blueprint-crafting.html', window.location.href);
            url.searchParams.set('blueprint', blueprint.uuid);
            if (blueprint.nav_group) url.searchParams.set('group', blueprint.nav_group);
            if (blueprint.nav_type) url.searchParams.set('type', blueprint.nav_type);
            if (blueprint.component_id) {
                url.searchParams.set('component', blueprint.component_id);
            }
            url.searchParams.set('sector', GROUP_TO_SECTOR[blueprint.nav_group] || 'ship');
            return url.pathname + url.search;
        } catch (e) {
            var fallback =
                'blueprint-crafting.html?blueprint=' + encodeURIComponent(String(blueprint.uuid));
            if (blueprint.component_id) {
                fallback += '&component=' + encodeURIComponent(String(blueprint.component_id));
            }
            return fallback;
        }
    }

    function stashDetailReturnForCraft(linkEl) {
        try {
            sessionStorage.setItem('scBlueprintCraftReturnUrl', window.location.pathname + window.location.search);
            sessionStorage.setItem('scBlueprintCraftRestorePending', '1');
            var href = linkEl && (linkEl.getAttribute('href') || linkEl.href);
            if (!href) return;
            var url = new URL(href, window.location.href);
            var bp = url.searchParams.get('blueprint');
            var group = url.searchParams.get('group');
            var type = url.searchParams.get('type');
            if (bp) sessionStorage.setItem('scBlueprintCraftPendingBlueprint', bp);
            if (group) sessionStorage.setItem('scBlueprintCraftPendingGroup', group);
            if (type) sessionStorage.setItem('scBlueprintCraftPendingType', type);
        } catch (e) {
            /* ignore */
        }
    }

    function isBlueprintCraftingPage() {
        if (typeof document !== 'undefined' && document.body && document.body.classList.contains('bp-craft-body')) {
            return true;
        }
        try {
            return /\/blueprint-crafting(?:\.html)?$/i.test(String(window.location.pathname || ''));
        } catch (e) {
            return false;
        }
    }

    function shouldShowCraftBlueprintBanner(options) {
        if (options && options.hideCraftBanner) return false;
        if (isBlueprintCraftingPage()) return false;
        return true;
    }

    function renderCraftBlueprintBanner(blueprint) {
        if (!blueprint || !blueprint.uuid) return '';
        var href = buildBlueprintCraftHref(blueprint);
        if (!href) return '';
        var label = blueprint.name_zh || blueprint.name_en || '此物品';
        return (
            '<div class="sc-detail-craft-blueprint">' +
            '<a class="sc-detail-craft-blueprint-link" href="' +
            escapeHtml(href) +
            '" data-craft-blueprint-link="1">' +
            '<span class="sc-detail-craft-blueprint-kicker">蓝图制造</span>' +
            '<span class="sc-detail-craft-blueprint-text">前往模拟制造 · ' +
            escapeHtml(label) +
            '</span>' +
            '<span class="sc-detail-craft-blueprint-arrow" aria-hidden="true">→</span>' +
            '</a></div>'
        );
    }

    function wrapBlueprintPanelHtml(craftBanner, missionsHtml) {
        if (craftBanner && missionsHtml && missionsHtml.indexOf('sc-blueprint-mission-table-wrap') >= 0) {
            return missionsHtml.replace(
                '<div class="sc-blueprint-mission-table-wrap">',
                '<div class="sc-blueprint-mission-table-wrap">' + craftBanner
            );
        }
        return (craftBanner || '') + (missionsHtml || '');
    }

    async function fetchCraftBlueprint(item) {
        item = item || {};
        var id = item.id_item || item.uuid;
        if (!id) return null;
        var key = String(id);
        if (Object.prototype.hasOwnProperty.call(craftBlueprintCache, key)) {
            return craftBlueprintCache[key];
        }
        try {
            var res = await fetch(
                apiUrl('/api/sc/components/' + encodeURIComponent(key) + '/craft-blueprint') +
                    '?_=' +
                    Date.now(),
                { cache: 'no-store' }
            );
            var data = await parseJsonResponse(res, '制造蓝图响应解析失败');
            if (!res.ok || !data.ok) throw new Error((data && data.message) || '制造蓝图查询失败');
            var bp = data.blueprint || null;
            craftBlueprintCache[key] = bp;
            return bp;
        } catch (e) {
            craftBlueprintCache[key] = null;
            return null;
        }
    }

    async function fetchBlueprintMissions(item) {
        item = item || {};
        var blueprintUuid = String(item.blueprint_uuid || '').trim();
        var useComponent = item.use_component_missions === true;
        var id = item.id_item || item.uuid;
        var cacheKey;
        var url;
        if (useComponent && id) {
            cacheKey = 'c:' + String(id);
            url = apiUrl('/api/sc/components/' + encodeURIComponent(id) + '/blueprint-missions');
        } else if (blueprintUuid) {
            cacheKey = 'b:' + blueprintUuid;
            url = apiUrl('/api/sc/blueprints/' + encodeURIComponent(blueprintUuid) + '/missions');
        } else if (id) {
            cacheKey = 'c:' + String(id);
            url = apiUrl('/api/sc/components/' + encodeURIComponent(id) + '/blueprint-missions');
        } else {
            return [];
        }
        if (listCache[cacheKey]) {
            var cachedList = listCache[cacheKey];
            var cachedIncomplete =
                Array.isArray(cachedList) &&
                cachedList.length > 0 &&
                cachedList.some(function (m) {
                    return m && !m.mission_type && !m.mission_type_zh && !m.mission_giver && !m.mission_giver_zh;
                });
            if (!cachedIncomplete) return listCache[cacheKey];
            delete listCache[cacheKey];
        }

        var embedded = embeddedBlueprintMissions(item);
        try {
            var res = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' });
            var data = await parseJsonResponse(res, '蓝图任务响应解析失败');
            if (!res.ok || !data.ok) throw new Error((data && data.message) || '蓝图任务加载失败');
            var missions = data.missions || [];
            if (!missions.length && embedded.length) {
                listCache[cacheKey] = embedded;
                return embedded;
            }
            listCache[cacheKey] = missions;
            prefetchMissionDetails(missions);
            return missions;
        } catch (e) {
            if (embedded.length) {
                listCache[cacheKey] = embedded;
                return embedded;
            }
            throw e;
        }
    }

    var prefetchSerial = 0;
    var wikiPauseUntil = 0;

    function noteWikiUnavailable() {
        wikiPauseUntil = Date.now() + 60000;
    }

    function prefetchMissionDetails(missions, options) {
        if (Date.now() < wikiPauseUntil) return;
        var opts = options || {};
        var limit = Math.max(1, Number(opts.limit) || 12);
        var concurrency = Math.max(1, Math.min(2, Number(opts.concurrency) || 2));
        var serial = ++prefetchSerial;
        var queue = [];
        var seen = Object.create(null);
        (missions || []).forEach(function (m) {
            var variants = variantList(m);
            if (variants.length > 1) {
                variants.slice(0, 3).forEach(function (v) {
                    if (!v || !v.uuid) return;
                    var id = String(v.uuid);
                    if (seen[id]) return;
                    seen[id] = true;
                    queue.push({ id: id, debug: v.debug_name || '' });
                });
                return;
            }
            var id = missionRef(m);
            if (!id || seen[id]) return;
            seen[id] = true;
            queue.push({ id: id, debug: (m && m.debug_name) || '' });
        });
        queue = queue.slice(0, limit);
        var index = 0;
        var running = 0;
        function pump() {
            if (serial !== prefetchSerial) return;
            if (Date.now() < wikiPauseUntil) return;
            while (running < concurrency && index < queue.length) {
                var job = queue[index++];
                if (detailCache[job.id] && isUsableMissionDetail(detailCache[job.id])) continue;
                running += 1;
                fetchMissionDetail(job.id, job.debug, { prefetch: true })
                    .catch(function () {})
                    .finally(function () {
                        running -= 1;
                        pump();
                    });
            }
        }
        pump();
    }

    async function fetchMissionDetail(ref, debugName, opts) {
        var id = String(ref || '').trim();
        if (!id) throw new Error('缺少任务 ID');
        var cacheKey = id + '|' + String(debugName || '') + '|v' + DETAIL_SCHEMA_VERSION;
        if (detailCache[cacheKey] && isUsableMissionDetail(detailCache[cacheKey])) {
            return detailCache[cacheKey];
        }

        var url =
            apiUrl('/api/sc/missions/' + encodeURIComponent(id) + '/detail') +
            '?_sc_detail_v=' +
            DETAIL_SCHEMA_VERSION;
        if (debugName) {
            url += '&debug_name=' + encodeURIComponent(String(debugName));
        }
        if (opts && opts.prefetch) url += '&prefetch=1';
        var res = await fetch(url, { cache: 'no-store' });
        var data = await parseJsonResponse(res, '任务详情响应解析失败');
        if (!res.ok || !data.ok || !data.mission) {
            if (res.status === 503 || (data && /暂时拉不到|Wiki 暂时不可用/.test(String(data.message || '')))) {
                noteWikiUnavailable();
            }
            throw new Error((data && data.message) || '任务详情加载失败');
        }
        var mission = data.mission;
        if (!Array.isArray(mission.blueprint_pools)) mission.blueprint_pools = [];
        mission.__detailSchemaVersion = DETAIL_SCHEMA_VERSION;
        detailCache[cacheKey] = mission;
        detailCache[id] = mission;
        return detailCache[cacheKey];
    }

    function findMissionInList(missions, ref) {
        return (missions || []).find(function (m) {
            return missionRef(m) === ref;
        });
    }

    async function loadMissionDetail(container, ref) {
        var panelRoot = container.closest('[data-blueprint-panel]') || container;
        var missions = missionsForContainer(container);
        var detailEl = container.querySelector('[data-mission-detail="' + cssEscape(ref) + '"]');
        if (!detailEl) return;

        var summary = findMissionInList(missions, ref);
        var variant = selectedVariant(summary, variantRefFor(panelRoot, ref));
        var fetchRef = (variant && variant.uuid) || ref;
        var debugName =
            (variant && variant.debug_name) || (summary && summary.debug_name ? summary.debug_name : '');
        var bodyEl = detailEl.querySelector('.sc-blueprint-mission-detail-body') || detailEl;
        var briefingSource = variant || summary;

        if (detailCache[fetchRef] && isUsableMissionDetail(detailCache[fetchRef])) {
            detailEl.hidden = false;
            bodyEl.innerHTML = renderMissionDetailBody(detailCache[fetchRef], readNavContext(container), briefingSource, summary);
            anchorVariantDetail(detailEl, variant);
            return;
        }

        detailEl.hidden = false;
        if (!bodyEl.textContent.trim()) {
            bodyEl.innerHTML = '<p class="sc-acquire-loading">加载任务详情…</p>';
        }
        try {
            var detail = await fetchMissionDetail(fetchRef, debugName);
            if (!String(detail.description_zh || '').trim() && briefingSource && briefingSource.description_zh) {
                detail.description_zh = briefingSource.description_zh;
            }
            if (splitOpenRefs(panelRoot.dataset.expandedMission).indexOf(ref) < 0) return;
            if (variantList(summary).length > 1 && String(variantRefFor(panelRoot, ref) || '') !== String(fetchRef)) return;
            bodyEl.innerHTML = renderMissionDetailBody(detail, readNavContext(container), briefingSource, summary);
            anchorVariantDetail(detailEl, variant);
            if (summary && detail.title_zh && variantList(summary).length < 2) {
                summary.title_zh = stripMissionFlowTitleSuffix(detail.title_zh);
                summary.description_zh = detail.description_zh;
                summary.loc_matched = detail.loc_matched;
            }
        } catch (e) {
            if (splitOpenRefs(panelRoot.dataset.expandedMission).indexOf(ref) < 0) return;
            detailEl.innerHTML =
                '<p class="sc-acquire-empty">' + escapeHtml((e && e.message) || '任务详情加载失败') + '</p>';
        }
    }

    function splitOpenRefs(value) {
        return String(value || '')
            .split('|')
            .map(function (part) { return part.trim(); })
            .filter(Boolean);
    }

    function readVariantMap(panelRoot) {
        try {
            var parsed = JSON.parse((panelRoot && panelRoot.dataset.variantRefs) || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function writeVariantMap(panelRoot, map) {
        if (!panelRoot) return;
        panelRoot.dataset.variantRefs = JSON.stringify(map || {});
    }

    function variantRefFor(panelRoot, ref) {
        var map = readVariantMap(panelRoot);
        return map[ref] || '';
    }

    async function loadOpenMissionDetails(container, expandedValue) {
        var panelRoot = container.closest('[data-blueprint-panel]') || container;
        var refs = splitOpenRefs(expandedValue);
        for (var i = 0; i < refs.length; i++) {
            var opened = findMissionInList(missionsForContainer(container), refs[i]);
            if (variantList(opened).length > 1 && !variantRefFor(panelRoot, refs[i])) continue;
            await loadMissionDetail(container, refs[i]);
        }
    }

    async function toggleMissionDetail(container, ref) {
        var panelRoot = container.closest('[data-blueprint-panel]') || container;
        var toggle = container.querySelector('.sc-blueprint-mission-toggle[data-mission-ref="' + cssEscape(ref) + '"]');
        var item = toggle && toggle.closest('.sc-blueprint-mission-item');
        if (!item) return;
        var open = splitOpenRefs(panelRoot.dataset.expandedMission);
        var at = open.indexOf(ref);
        var detailEl = item.querySelector('[data-mission-detail]');
        var map = readVariantMap(panelRoot);
        if (at >= 0) {
            open.splice(at, 1);
            delete map[ref];
            writeVariantMap(panelRoot, map);
            item.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            var bar = item.querySelector('.sc-mission-variant-bar');
            if (bar) bar.remove();
            if (detailEl) detailEl.hidden = true;
        } else {
            open.push(ref);
            item.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            var summary = findMissionInList(missionsForContainer(container), ref);
            if (variantList(summary).length > 1) {
                if (!item.querySelector('.sc-mission-variant-bar')) {
                    toggle.insertAdjacentHTML('afterend', renderVariantPicker(summary, variantRefFor(panelRoot, ref)));
                }
            } else if (detailEl) {
                detailEl.hidden = false;
            }
        }
        var next = open.join('|');
        panelRoot.dataset.expandedMission = next;
        if (typeof container._bpOnExpandedChange === 'function') {
            container._bpOnExpandedChange(next);
        }
        if (at < 0 && detailEl && !detailEl.hidden) await loadMissionDetail(container, ref);
    }

    function wirePanel(container) {
        if (!container || container.dataset.blueprintWired === '1') return;
        container.dataset.blueprintWired = '1';
        container.addEventListener('mousedown', function (ev) {
            var craftLink = ev.target.closest('[data-craft-blueprint-link]');
            if (craftLink && container.contains(craftLink)) stashDetailReturnForCraft(craftLink);
            var chipLink = ev.target.closest('.sc-mission-chip--link[href]');
            if (chipLink && container.contains(chipLink)) stashListReturnForDetailNav();
        });
        container.addEventListener('click', function (ev) {
            var chipLink = ev.target.closest('.sc-mission-chip--link[href]');
            if (chipLink && container.contains(chipLink)) {
                var href = chipLink.getAttribute('href') || '';
                if (href.indexOf('blueprint-crafting') >= 0) {
                    ev.preventDefault();
                    window.open(chipLink.href, '_blank', 'noopener,noreferrer');
                    return;
                }
                var cid = chipLink.getAttribute('data-component-id');
                if (cid) rememberComponentDetailId(cid);
                stashListReturnForDetailNav();
                return;
            }
            var chipResolve = ev.target.closest('.sc-mission-chip--resolve[data-pool-item-ref]');
            if (chipResolve && container.contains(chipResolve)) {
                ev.preventDefault();
                navigatePoolItemRef(chipResolve.getAttribute('data-pool-item-ref'), readNavContext(container));
                return;
            }
            var variantBtn = ev.target.closest('.sc-mission-variant-btn');
            if (variantBtn && container.contains(variantBtn)) {
                ev.preventDefault();
                var panelRoot = container.closest('[data-blueprint-panel]') || container;
                var parentBtn = variantBtn.closest('.sc-blueprint-mission-item');
                parentBtn = parentBtn && parentBtn.querySelector('.sc-blueprint-mission-toggle');
                var parentRef = (parentBtn && parentBtn.getAttribute('data-mission-ref')) || '';
                var nextVariant = variantBtn.getAttribute('data-variant-ref') || '';
                if (!parentRef || !nextVariant) return;
                var detailEl = variantBtn.closest('.sc-blueprint-mission-item');
                detailEl = detailEl && detailEl.querySelector('[data-mission-detail]');
                var variantMap = readVariantMap(panelRoot);
                if (variantMap[parentRef] === nextVariant && detailEl && !detailEl.hidden) {
                    detailEl.hidden = true;
                    variantBtn.classList.remove('is-active');
                    variantBtn.setAttribute('aria-selected', 'false');
                    delete variantMap[parentRef];
                    writeVariantMap(panelRoot, variantMap);
                    return;
                }
                var openRefs = splitOpenRefs(panelRoot.dataset.expandedMission);
                if (openRefs.indexOf(parentRef) < 0) openRefs.push(parentRef);
                panelRoot.dataset.expandedMission = openRefs.join('|');
                variantMap[parentRef] = nextVariant;
                writeVariantMap(panelRoot, variantMap);
                if (detailEl) {
                    detailEl.hidden = false;
                    variantBtn.insertAdjacentElement('afterend', detailEl);
                }
                var bar = variantBtn.closest('.sc-mission-variant-bar');
                if (bar) bar.querySelectorAll('.sc-mission-variant-btn').forEach(function (el) {
                    var on = el === variantBtn;
                    el.classList.toggle('is-active', on);
                    el.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                loadMissionDetail(container, parentRef);
                return;
            }
            var btn = ev.target.closest('.sc-blueprint-mission-toggle');
            if (!btn || !container.contains(btn)) return;
            var ref = btn.getAttribute('data-mission-ref');
            if (!ref) return;
            ev.preventDefault();
            toggleMissionDetail(container, ref);
        });
    }

    function inferNavGroupFromItemType(typeKey) {
        var key = String(typeKey || '').trim();
        if (!key) return 'component';
        if (key === 'ship_weapon' || key === 'ship_turret' || key === 'ship_missile' || key === 'missile_rack') {
            return 'weapon';
        }
        if (key === 'mining_laser' || key === 'ship_module') return 'mining';
        if (key === 'personal_weapon' || key.indexOf('weapon_') === 0) return 'fps_weapon';
        if (key === 'personal_armor' || key.indexOf('armor_') === 0) return 'fps_armor';
        if (key === 'magazine' || key.indexOf('attachment_') === 0) return 'fps_magazine';
        return 'component';
    }

    async function mount(container, item, options) {
        if (!container || !item) return;
        options = options || {};
        var itemId = String(item.id_item || item.uuid || '');
        container.dataset.itemId = itemId;
        container._bpOnExpandedChange = options.onExpandedChange || null;
        var panelRoot = container.closest('[data-blueprint-panel]') || container;
        panelRoot.dataset.navGroup = inferNavGroupFromItemType(item.type);
        panelRoot.dataset.navType = String(item.type || '');
        container.innerHTML = '<p class="sc-acquire-loading">加载蓝图任务…</p>';
        wirePanel(container);
        var showCraftBanner = shouldShowCraftBlueprintBanner(options);

        try {
            var craftPromise = fetchCraftBlueprint(item);
            var missionsPromise = fetchBlueprintMissions(item);
            var craftBlueprint = await craftPromise;
            if (!container.isConnected) return;
            var craftBanner = showCraftBanner ? renderCraftBlueprintBanner(craftBlueprint) : '';
            container._bpCraftBanner = craftBanner;
            var missions = await missionsPromise;
            rememberMissionsOnPanel(container, item, missions);
            if (!container.isConnected) return;
            var expandedId = options.expandedId || container.dataset.expandedMission || '';
            if (expandedId) panelRoot.dataset.expandedMission = expandedId;
            container.innerHTML = wrapBlueprintPanelHtml(
                craftBanner,
                renderMissionListHtml(missions, expandedId)
            );
            if (expandedId) {
                panelRoot.dataset.expandedMission = expandedId;
                await loadOpenMissionDetails(container, expandedId);
            }
        } catch (e) {
            if (!container.isConnected) return;
            var craftBlueprintFallback = craftBlueprintCache[String(item.id_item || item.uuid || '')];
            if (craftBlueprintFallback === undefined) {
                craftBlueprintFallback = await fetchCraftBlueprint(item);
            }
            var craftBannerFallback = showCraftBanner ? renderCraftBlueprintBanner(craftBlueprintFallback) : '';
            container._bpCraftBanner = craftBannerFallback;
            var embedded = embeddedBlueprintMissions(item);
            if (embedded.length) {
                rememberMissionsOnPanel(container, item, embedded);
                var expandedEmbedded = options.expandedId || container.dataset.expandedMission || '';
                if (expandedEmbedded) panelRoot.dataset.expandedMission = expandedEmbedded;
                container.innerHTML = wrapBlueprintPanelHtml(
                    craftBannerFallback,
                    renderMissionListHtml(embedded, expandedEmbedded)
                );
                if (expandedEmbedded) {
                    panelRoot.dataset.expandedMission = expandedEmbedded;
                    await loadOpenMissionDetails(container, expandedEmbedded);
                }
                return;
            }
            var expandedId = options.expandedId || container.dataset.expandedMission || '';
            if (!itemHasBlueprintHints(item) && isJsonParseFailureMessage(e && e.message)) {
                container.innerHTML = wrapBlueprintPanelHtml(craftBannerFallback, renderMissionListHtml([], expandedId));
                return;
            }
            if (!itemHasBlueprintHints(item) && e && /Wiki API|蓝图任务加载失败|配件不存在|404/i.test(String(e.message || ''))) {
                container.innerHTML = wrapBlueprintPanelHtml(craftBannerFallback, renderMissionListHtml([], expandedId));
                return;
            }
            if (craftBannerFallback) {
                container.innerHTML =
                    craftBannerFallback +
                    '<p class="sc-acquire-empty">' +
                    escapeHtml((e && e.message) || '蓝图任务加载失败') +
                    '</p>';
                return;
            }
            container.innerHTML =
                '<p class="sc-acquire-empty">' + escapeHtml((e && e.message) || '蓝图任务加载失败') + '</p>';
        }
    }

    window.ShipComponentBlueprints = {
        mount: mount,
        wirePanel: wirePanel,
        missionListCacheKey: missionListCacheKey,
        rememberMissionsOnPanel: rememberMissionsOnPanel,
        fetchBlueprintMissions: fetchBlueprintMissions,
        fetchCraftBlueprint: fetchCraftBlueprint,
        buildBlueprintCraftHref: buildBlueprintCraftHref,
        stashDetailReturnForCraft: stashDetailReturnForCraft,
        fetchMissionDetail: fetchMissionDetail,
        prefetchMissionDetails: prefetchMissionDetails,
        renderMissionListHtml: renderMissionListHtml,
        clearCache: function () {
            prefetchSerial += 1;
            listCache = Object.create(null);
            detailCache = Object.create(null);
            craftBlueprintCache = Object.create(null);
        },
    };
})();
