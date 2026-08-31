(function (global) {
    if (typeof document === 'undefined') return;

    function apiBase() {
        return (global.USS_AUTH_API_BASE || '').replace(/\/$/, '') || 'http://127.0.0.1:3789';
    }

    function adminHeaders(token, extra) {
        if (global.UssAdminStepUp && global.UssAdminStepUp.getAuthHeaders) {
            return global.UssAdminStepUp.getAuthHeaders(token, extra);
        }
        return Object.assign({}, extra || {}, { Authorization: 'Bearer ' + token });
    }

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function componentDetailHref(idItem) {
        var id = String(idItem || '').trim();
        if (!id || /^demo-/i.test(id)) return '';
        return 'ship-component-detail?id=' + encodeURIComponent(id);
    }

    function bindCardOpenDetail(root, itemId) {
        if (!root || !itemId) return;
        var href = componentDetailHref(itemId);
        if (!href) return;
        root.setAttribute('data-item-id', itemId);
        root.setAttribute('title', '打开配件详情');
        root.style.cursor = 'pointer';
        root.addEventListener('click', function (ev) {
            if (ev.target && ev.target.closest && ev.target.closest('button, textarea, input, label, a, select')) {
                return;
            }
            window.location.href = href;
        });
    }

    function hintFromRes(data, fallback) {
                if (global.UssApiError && typeof global.UssApiError.formatUserError === 'function' && data && data.code) {
            return global.UssApiError.formatUserError(data.code);
        }
        return fallback;
    }

    function formatAt(iso) {
        if (!iso) return '—';
        try {
            return new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(new Date(iso));
        } catch (e) {
            return String(iso);
        }
    }

    function demoThumbDataUrl(title, hue) {
        var t = esc(title || '配件');
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="hsl(' +
            hue +
            ',55%,22%)"/>' +
            '<stop offset="100%" stop-color="hsl(' +
            ((hue + 40) % 360) +
            ',45%,12%)"/>' +
            '</linearGradient></defs>' +
            '<rect width="400" height="300" fill="url(#g)"/>' +
            '<rect x="24" y="24" width="352" height="252" rx="16" fill="none" stroke="rgba(142,224,255,0.35)" stroke-width="2"/>' +
            '<circle cx="200" cy="128" r="46" fill="rgba(95,184,255,0.18)" stroke="rgba(142,224,255,0.55)" stroke-width="2"/>' +
            '<text x="200" y="232" text-anchor="middle" fill="#e8f4ff" font-size="18" font-family="Segoe UI,sans-serif">' +
            t +
            '</text></svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function demoApprovedItems() {
        return [
            {
                id: 'demo-approved-winter',
                demo: true,
                item_name_zh: '寒冬之心 SL',
                item_name_en: 'Winter-Star SL',
                item_type: '散热',
                id_item: 'demo-cool-sl',
                submitter_label: 'fkbaicai',
                submitter_binding: 'fkbaicai',
                reviewed_at: '2026-08-28T10:12:00.000Z',
                thumb: demoThumbDataUrl('寒冬之心 SL', 200),
            },
            {
                id: 'demo-approved-havoc',
                demo: true,
                item_name_zh: '浩劫 实弹霰弹炮',
                item_name_en: 'Havoc Ballistic Scattergun',
                item_type: '舰船武器',
                id_item: 'demo-havoc',
                submitter_label: 'zhe_long',
                submitter_binding: 'zhe_long',
                reviewed_at: '2026-08-27T14:40:00.000Z',
                thumb: demoThumbDataUrl('浩劫', 18),
            },
            {
                id: 'demo-approved-fr66',
                demo: true,
                item_name_zh: 'FR-66 护盾发生器',
                item_name_en: 'FR-66 Shield Generator',
                item_type: '护盾',
                id_item: 'demo-fr66',
                submitter_label: 'papa_216_0',
                submitter_binding: 'papa_216_0',
                reviewed_at: '2026-08-26T09:05:00.000Z',
                thumb: demoThumbDataUrl('FR-66', 210),
            },
            {
                id: 'demo-approved-js400',
                demo: true,
                item_name_zh: 'JS-400 电源',
                item_name_en: 'JS-400 Power Plant',
                item_type: '电源',
                id_item: 'demo-js400',
                submitter_label: 'jehwinna',
                submitter_binding: 'jehwinna',
                reviewed_at: '2026-08-25T18:22:00.000Z',
                thumb: demoThumbDataUrl('JS-400', 160),
            },
            {
                id: 'demo-approved-xl1',
                demo: true,
                item_name_zh: 'XL-1 量子驱动器',
                item_name_en: 'XL-1 Quantum Drive',
                item_type: '量子驱动',
                id_item: 'demo-xl1',
                submitter_label: 'nock727',
                submitter_binding: 'nock727',
                reviewed_at: '2026-08-24T07:48:00.000Z',
                thumb: demoThumbDataUrl('XL-1', 265),
            },
            {
                id: 'demo-approved-scan',
                demo: true,
                item_name_zh: '扫描阵列 MK2',
                item_name_en: 'Scanner Array MK2',
                item_type: '雷达',
                id_item: 'demo-scan',
                submitter_label: 'lovebroin',
                submitter_binding: 'lovebroin',
                reviewed_at: '2026-08-23T12:16:00.000Z',
                thumb: demoThumbDataUrl('扫描阵列', 185),
            },
        ];
    }

    var previewUrlCache = Object.create(null);
    var previewInflight = 0;
    var previewWait = [];

    function loadPreview(token, id, imgEl) {
        if (!id || !imgEl) return Promise.resolve();
        if (previewUrlCache[id]) {
            imgEl.src = previewUrlCache[id];
            return Promise.resolve();
        }
        return new Promise(function (resolve, reject) {
            function pump() {
                if (previewInflight >= 2) {
                    previewWait.push(pump);
                    return;
                }
                previewInflight += 1;
                fetch(
                    apiBase() +
                        '/api/admin/sc/image-submissions/' +
                        encodeURIComponent(id) +
                        '/preview?size=thumb',
                    { headers: adminHeaders(token) }
                )
                    .then(function (res) {
                        if (!res.ok) throw new Error('预览失败');
                        return res.blob();
                    })
                    .then(function (blob) {
                        var url = URL.createObjectURL(blob);
                        previewUrlCache[id] = url;
                        imgEl.src = url;
                        imgEl.loading = 'lazy';
                        imgEl.decoding = 'async';
                        resolve();
                    })
                    .catch(reject)
                    .then(function () {
                        previewInflight -= 1;
                        var next = previewWait.shift();
                        if (next) next();
                    });
            }
            pump();
        });
    }

    function mount(root, token) {
        if (!root || !token) return;
        root.innerHTML =
            '<p class="hint" id="scUserImgReviewMeta">加载待审核图片…</p>' +
            '<div id="scUserImgReviewErr" class="err" hidden></div>' +
            '<h3 class="sc-user-img-review-h">待审核</h3>' +
            '<div id="scUserImgReviewList" class="sc-user-img-review-list"></div>' +
            '<div class="sc-user-img-review-pager" id="scUserImgPendingPager" hidden>' +
            '<button type="button" class="btn-secondary" id="scUserImgPendingPrev">上一页</button>' +
            '<span id="scUserImgPendingPageLabel"></span>' +
            '<button type="button" class="btn-secondary" id="scUserImgPendingNext">下一页</button>' +
            '</div>' +
            '<h3 class="sc-user-img-review-h">已通过记录</h3>' +
            '<div class="sc-user-img-review-toolbar">' +
            '<input type="search" id="scUserImgApprovedSearch" class="sc-user-img-review-search" placeholder="搜索配件中文名、英文名、类型、上传者…" autocomplete="off">' +
            '<label class="sc-user-img-review-pagesize">每页' +
            '<select id="scUserImgApprovedPageSize">' +
            '<option value="12" selected>12</option>' +
            '<option value="24">24</option>' +
            '<option value="48">48</option>' +
            '</select></label>' +
            '</div>' +
            '<p class="hint" id="scUserImgApprovedMeta">加载已通过图片…</p>' +
            '<div id="scUserImgApprovedList" class="sc-user-img-review-list sc-user-img-review-list--compact"></div>' +
            '<div class="sc-user-img-review-pager" id="scUserImgApprovedPager" hidden>' +
            '<button type="button" class="btn-secondary" id="scUserImgApprovedPrev">上一页</button>' +
            '<span id="scUserImgApprovedPageLabel"></span>' +
            '<button type="button" class="btn-secondary" id="scUserImgApprovedNext">下一页</button>' +
            '</div>';

        var metaEl = root.querySelector('#scUserImgReviewMeta');
        var errEl = root.querySelector('#scUserImgReviewErr');
        var listEl = root.querySelector('#scUserImgReviewList');
        var approvedMetaEl = root.querySelector('#scUserImgApprovedMeta');
        var approvedListEl = root.querySelector('#scUserImgApprovedList');
        var approvedSearchEl = root.querySelector('#scUserImgApprovedSearch');
        var approvedPageSizeEl = root.querySelector('#scUserImgApprovedPageSize');
        var approvedPagerEl = root.querySelector('#scUserImgApprovedPager');
        var approvedPrevEl = root.querySelector('#scUserImgApprovedPrev');
        var approvedNextEl = root.querySelector('#scUserImgApprovedNext');
        var approvedPageLabelEl = root.querySelector('#scUserImgApprovedPageLabel');
        var pendingPagerEl = root.querySelector('#scUserImgPendingPager');
        var pendingPrevEl = root.querySelector('#scUserImgPendingPrev');
        var pendingNextEl = root.querySelector('#scUserImgPendingNext');
        var pendingPageLabelEl = root.querySelector('#scUserImgPendingPageLabel');
        var pendingAll = [];
        var pendingPage = 1;
        var PENDING_PAGE_SIZE = 8;
        var approvedAll = [];
        var approvedPage = 1;

        function showErr(msg) {
            if (!errEl) return;
            errEl.hidden = !msg;
            errEl.textContent = msg || '';
        }

        async function review(id, action, reason) {
            showErr('');
            var res = await fetch(apiBase() + '/api/admin/sc/image-submissions/' + encodeURIComponent(id) + '/review', {
                method: 'POST',
                headers: adminHeaders(token, { 'Content-Type': 'application/json' }),
                body: JSON.stringify({ action: action, reject_reason: reason || '' }),
            });
            var data = {};
            try {
                data = await res.json();
            } catch (e) {
                data = {};
            }
            if (!res.ok || data.ok === false) {
                throw new Error(hintFromRes(data, '审核失败'));
            }
        }

        async function removeApproved(id) {
            showErr('');
            var res = await fetch(apiBase() + '/api/admin/sc/image-submissions/' + encodeURIComponent(id), {
                method: 'DELETE',
                headers: adminHeaders(token),
            });
            var data = {};
            try {
                data = await res.json();
            } catch (e) {
                data = {};
            }
            if (!res.ok || data.ok === false) {
                throw new Error(hintFromRes(data, '删除失败'));
            }
        }

        function approvedPageSize() {
            var n = Number(approvedPageSizeEl && approvedPageSizeEl.value);
            if (n === 24 || n === 48) return n;
            return 12;
        }

        function approvedQuery() {
            return String((approvedSearchEl && approvedSearchEl.value) || '')
                .trim()
                .toLowerCase();
        }

        function filterApproved(items) {
            var q = approvedQuery();
            if (!q) return items.slice();
            return items.filter(function (row) {
                var blob = [
                    row.item_name_zh,
                    row.item_name_en,
                    row.item_type,
                    row.id_item,
                    row.submitter_label,
                    row.submitter_binding,
                ]
                    .map(function (x) {
                        return String(x || '').toLowerCase();
                    })
                    .join(' ');
                return blob.indexOf(q) >= 0;
            });
        }

        function renderApprovedPage() {
            if (!approvedListEl) return;
            var filtered = filterApproved(approvedAll);
            var size = approvedPageSize();
            var pages = Math.max(1, Math.ceil(filtered.length / size) || 1);
            if (approvedPage > pages) approvedPage = pages;
            if (approvedPage < 1) approvedPage = 1;
            var start = (approvedPage - 1) * size;
            var slice = filtered.slice(start, start + size);
            if (approvedMetaEl) {
                if (!approvedAll.length) {
                    approvedMetaEl.textContent = '暂无已通过记录';
                } else if (approvedAll.some(function (r) { return r.demo; })) {
                    approvedMetaEl.textContent =
                        '界面样例 ' + approvedAll.length + ' 张（无真实通过记录时用于预览排版）· 本页 ' + slice.length;
                } else if (approvedQuery()) {
                    approvedMetaEl.textContent =
                        '筛选 ' + filtered.length + ' / 共 ' + approvedAll.length + ' 张 · 本页 ' + slice.length;
                } else {
                    approvedMetaEl.textContent =
                        '已通过 ' + approvedAll.length + ' 张 · 本页 ' + slice.length + ' · 可删除展示图';
                }
            }
            if (approvedPagerEl) {
                approvedPagerEl.hidden = !filtered.length && !approvedAll.length;
            }
            if (approvedPageLabelEl) {
                approvedPageLabelEl.textContent = '第 ' + approvedPage + ' / ' + pages + ' 页';
            }
            if (approvedPrevEl) approvedPrevEl.disabled = approvedPage <= 1;
            if (approvedNextEl) approvedNextEl.disabled = approvedPage >= pages;
            if (!slice.length) {
                approvedListEl.innerHTML = approvedAll.length
                    ? '<p class="hint">没有匹配的记录</p>'
                    : '';
                return;
            }
            approvedListEl.innerHTML = slice
                .map(function (row) {
                    return (
                        '<article class="sc-user-img-review-card sc-user-img-review-card--compact" data-id="' +
                        esc(row.id) +
                        '" data-item-id="' +
                        esc(row.id_item || '') +
                        '">' +
                        '<img alt="" class="sc-user-img-review-thumb" data-preview-id="' +
                        esc(row.id) +
                        '">' +
                        '<div class="sc-user-img-review-copy">' +
                        '<p class="sc-user-img-review-name">' +
                        esc(row.item_name_zh || row.item_name_en || row.id_item) +
                        '</p>' +
                        '<p class="hint">' +
                        esc(row.item_name_en || '') +
                        (row.item_type ? ' · ' + esc(row.item_type) : '') +
                        '</p>' +
                        '<p class="hint">上传 ' +
                        esc(row.submitter_label || row.submitter_binding || '用户') +
                        ' · 通过 ' +
                        esc(formatAt(row.reviewed_at || row.created_at)) +
                        '</p>' +
                        '<div class="row sc-user-img-review-actions">' +
                        '<button type="button" class="btn-secondary" data-del-approved="' +
                        esc(row.id) +
                        '">删除</button>' +
                        '</div></div></article>'
                    );
                })
                .join('');
            approvedListEl.querySelectorAll('img[data-preview-id]').forEach(function (img) {
                var id = img.getAttribute('data-preview-id');
                var row = slice.filter(function (r) {
                    return String(r.id) === String(id);
                })[0];
                if (row && row.demo && row.thumb) {
                    img.src = row.thumb;
                    return;
                }
                loadPreview(token, id, img).catch(function () {
                    img.replaceWith(document.createTextNode('无法预览'));
                });
            });
            approvedListEl.querySelectorAll('.sc-user-img-review-card').forEach(function (card) {
                bindCardOpenDetail(card, card.getAttribute('data-item-id'));
            });
            approvedListEl.querySelectorAll('[data-del-approved]').forEach(function (btn) {
                btn.onclick = function () {
                    var id = btn.getAttribute('data-del-approved');
                    var row = approvedAll.filter(function (r) {
                        return String(r.id) === String(id);
                    })[0];
                    if (row && row.demo) {
                        window.alert('这是界面样例，不会写入服务器。有真实通过记录后样例会自动消失。');
                        return;
                    }
                    if (!window.confirm('删除后前台不再展示这张用户图，确定？')) return;
                    btn.disabled = true;
                    removeApproved(id)
                        .then(loadApproved)
                        .catch(function (e) {
                            btn.disabled = false;
                            showErr((e && e.message) || '删除失败');
                        });
                };
            });
        }

        async function loadApproved() {
            if (!approvedListEl) return;
            var res = await fetch(apiBase() + '/api/admin/sc/image-submissions?status=approved', {
                headers: adminHeaders(token),
            });
            var data = {};
            try {
                data = await res.json();
            } catch (e) {
                data = {};
            }
            if (!res.ok) {
                throw new Error(hintFromRes(data, '加载已通过记录失败'));
            }
            approvedAll = data.items || [];
            if (!approvedAll.length) {
                approvedAll = demoApprovedItems();
            }
            renderApprovedPage();
        }

        function dropPending(id) {
            pendingAll = pendingAll.filter(function (r) {
                return String(r.id) !== String(id);
            });
            var pages = Math.max(1, Math.ceil(pendingAll.length / PENDING_PAGE_SIZE) || 1);
            if (pendingPage > pages) pendingPage = pages;
            renderPendingPage();
        }

        function bindPendingActions() {
            if (!listEl) return;
            listEl.querySelectorAll('img[data-preview-id]').forEach(function (img) {
                loadPreview(token, img.getAttribute('data-preview-id'), img).catch(function () {
                    img.replaceWith(document.createTextNode('无法预览'));
                });
            });
            listEl.querySelectorAll('.sc-user-img-review-card').forEach(function (card) {
                bindCardOpenDetail(card, card.getAttribute('data-item-id'));
            });
            listEl.querySelectorAll('[data-approve]').forEach(function (btn) {
                btn.onclick = function () {
                    var id = btn.getAttribute('data-approve');
                    btn.disabled = true;
                    review(id, 'approve')
                        .then(function () {
                            dropPending(id);
                            return loadApproved();
                        })
                        .catch(function (e) {
                            btn.disabled = false;
                            showErr((e && e.message) || '通过失败');
                        });
                };
            });
            listEl.querySelectorAll('[data-reject]').forEach(function (btn) {
                btn.onclick = function () {
                    var id = btn.getAttribute('data-reject');
                    var card = btn.closest('.sc-user-img-review-card');
                    var area = card && card.querySelector('.sc-user-img-review-reason');
                    var reason = area ? String(area.value || '').trim() : '';
                    if (!window.confirm(reason ? '确定驳回？理由将发给上传人。' : '确定驳回这张图片？（未填写理由）')) return;
                    btn.disabled = true;
                    review(id, 'reject', reason)
                        .then(function () {
                            dropPending(id);
                        })
                        .catch(function (e) {
                            btn.disabled = false;
                            showErr((e && e.message) || '驳回失败');
                        });
                };
            });
        }

        function renderPendingPage() {
            if (!listEl) return;
            var pages = Math.max(1, Math.ceil(pendingAll.length / PENDING_PAGE_SIZE) || 1);
            if (pendingPage > pages) pendingPage = pages;
            if (pendingPage < 1) pendingPage = 1;
            var start = (pendingPage - 1) * PENDING_PAGE_SIZE;
            var slice = pendingAll.slice(start, start + PENDING_PAGE_SIZE);
            if (metaEl) {
                metaEl.textContent = pendingAll.length
                    ? '待审核 ' + pendingAll.length + ' 张 · 本页 ' + slice.length
                    : '暂无待审核图片';
            }
            if (pendingPagerEl) pendingPagerEl.hidden = pendingAll.length <= PENDING_PAGE_SIZE;
            if (pendingPageLabelEl) pendingPageLabelEl.textContent = '第 ' + pendingPage + ' / ' + pages + ' 页';
            if (pendingPrevEl) pendingPrevEl.disabled = pendingPage <= 1;
            if (pendingNextEl) pendingNextEl.disabled = pendingPage >= pages;
            if (!slice.length) {
                listEl.innerHTML = '';
                return;
            }
            listEl.innerHTML = slice
                .map(function (row) {
                    return (
                        '<article class="sc-user-img-review-card" data-id="' +
                        esc(row.id) +
                        '" data-item-id="' +
                        esc(row.id_item || '') +
                        '">' +
                        '<img alt="" class="sc-user-img-review-thumb" data-preview-id="' +
                        esc(row.id) +
                        '" loading="lazy" decoding="async">' +
                        '<div class="sc-user-img-review-copy">' +
                        '<p class="sc-user-img-review-name">' +
                        esc(row.item_name_zh || row.item_name_en || row.id_item) +
                        '</p>' +
                        '<p class="hint">' +
                        esc(row.item_name_en || '') +
                        (row.item_type ? ' · ' + esc(row.item_type) : '') +
                        '</p>' +
                        '<p class="hint">上传 ' +
                        esc(row.submitter_label || row.submitter_binding || '用户') +
                        ' · ' +
                        esc(formatAt(row.created_at)) +
                        '</p>' +
                        '<label class="sc-user-img-review-reason-label">驳回理由（可选）' +
                        '<textarea class="sc-user-img-review-reason" maxlength="200" rows="2" placeholder="例如：图不对、有水印、不清晰"></textarea>' +
                        '</label>' +
                        '<div class="row sc-user-img-review-actions">' +
                        '<button type="button" data-approve="' +
                        esc(row.id) +
                        '">通过</button>' +
                        '<button type="button" class="btn-secondary" data-reject="' +
                        esc(row.id) +
                        '">驳回</button>' +
                        '</div></div></article>'
                    );
                })
                .join('');
            bindPendingActions();
        }

        async function load() {
            showErr('');
            var res = await fetch(apiBase() + '/api/admin/sc/image-submissions', {
                headers: adminHeaders(token),
            });
            var data = {};
            try {
                data = await res.json();
            } catch (e) {
                data = {};
            }
            if (!res.ok) {
                throw new Error(hintFromRes(data, '加载失败'));
            }
            pendingAll = data.items || [];
            pendingPage = 1;
            renderPendingPage();
        }

        if (approvedSearchEl) {
            approvedSearchEl.addEventListener('input', function () {
                approvedPage = 1;
                renderApprovedPage();
            });
        }
        if (approvedPageSizeEl) {
            approvedPageSizeEl.addEventListener('change', function () {
                approvedPage = 1;
                renderApprovedPage();
            });
        }
        if (approvedPrevEl) {
            approvedPrevEl.addEventListener('click', function () {
                if (approvedPage > 1) {
                    approvedPage -= 1;
                    renderApprovedPage();
                }
            });
        }
        if (approvedNextEl) {
            approvedNextEl.addEventListener('click', function () {
                approvedPage += 1;
                renderApprovedPage();
            });
        }

        if (pendingPrevEl) {
            pendingPrevEl.addEventListener('click', function () {
                if (pendingPage > 1) {
                    pendingPage -= 1;
                    renderPendingPage();
                }
            });
        }
        if (pendingNextEl) {
            pendingNextEl.addEventListener('click', function () {
                pendingPage += 1;
                renderPendingPage();
            });
        }

        load()
            .then(loadApproved)
            .catch(function (e) {
            showErr((e && e.message) || '加载失败');
        });
        return { reload: load };
    }

    global.UssScUserImageReview = { mount: mount };
})(typeof window !== 'undefined' ? window : this);
