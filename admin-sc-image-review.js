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

    function nameMarkup(row) {
        var label = esc(row.item_name_zh || row.item_name_en || row.id_item);
        var href = componentDetailHref(row.id_item);
        if (!href) {
            return '<p class="sc-user-img-review-name">' + label + '</p>';
        }
        return (
            '<p class="sc-user-img-review-name">' +
            '<a class="sc-user-img-review-name-link" href="' +
            esc(href) +
            '" target="_blank" rel="noopener noreferrer" title="打开配件详情">' +
            label +
            '</a></p>'
        );
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

    var previewUrlCache = Object.create(null);
    var previewInflight = 0;
    var previewWait = [];
    var lightboxEl = null;

    function previewCacheKey(id, size) {
        return String(id || '') + '|' + String(size || 'orig');
    }

    function loadPreviewUrl(token, id, size) {
        if (!id) return Promise.resolve('');
        var key = previewCacheKey(id, size);
        if (previewUrlCache[key]) return Promise.resolve(previewUrlCache[key]);
        return new Promise(function (resolve, reject) {
            function pump() {
                if (previewInflight >= 2) {
                    previewWait.push(pump);
                    return;
                }
                previewInflight += 1;
                var qs = size ? '?size=' + encodeURIComponent(size) : '';
                fetch(
                    apiBase() +
                        '/api/admin/sc/image-submissions/' +
                        encodeURIComponent(id) +
                        '/preview' +
                        qs,
                    { headers: adminHeaders(token) }
                )
                    .then(function (res) {
                        if (!res.ok) throw new Error('missing');
                        return res.blob();
                    })
                    .then(function (blob) {
                        if (!blob || !blob.size) throw new Error('missing');
                        var url = URL.createObjectURL(blob);
                        previewUrlCache[key] = url;
                        resolve(url);
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

    function markThumbMissing(imgEl) {
        if (!imgEl) return;
        var ph = document.createElement('span');
        ph.className = 'sc-user-img-review-thumb-missing';
        ph.textContent = '暂无图片';
        imgEl.replaceWith(ph);
    }

    function loadPreview(token, id, imgEl) {
        if (!id || !imgEl) return Promise.resolve();
        return loadPreviewUrl(token, id, 'thumb')
            .then(function (url) {
                if (!url) {
                    markThumbMissing(imgEl);
                    return;
                }
                imgEl.src = url;
                imgEl.loading = 'lazy';
                imgEl.decoding = 'async';
            })
            .catch(function () {
                markThumbMissing(imgEl);
            });
    }

    function closeReviewLightbox() {
        if (!lightboxEl) return;
        lightboxEl.hidden = true;
        document.body.classList.remove('sc-user-img-review-lightbox-open');
    }

    function ensureReviewLightbox() {
        if (lightboxEl) return lightboxEl;
        lightboxEl = document.createElement('div');
        lightboxEl.id = 'scUserImgReviewLightbox';
        lightboxEl.className = 'sc-user-img-review-lightbox';
        lightboxEl.hidden = true;
        lightboxEl.innerHTML =
            '<button type="button" class="sc-user-img-review-lightbox-close" aria-label="关闭">×</button>' +
            '<p class="sc-user-img-review-lightbox-loading" hidden>正在加载原图…</p>' +
            '<img class="sc-user-img-review-lightbox-img" alt="">';
        document.body.appendChild(lightboxEl);
        lightboxEl.addEventListener('click', function (ev) {
            if (ev.target === lightboxEl || (ev.target && ev.target.classList.contains('sc-user-img-review-lightbox-close'))) {
                closeReviewLightbox();
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeReviewLightbox();
        });
        return lightboxEl;
    }

    function openReviewLightbox(src, alt) {
        var box = ensureReviewLightbox();
        var img = box.querySelector('.sc-user-img-review-lightbox-img');
        var loading = box.querySelector('.sc-user-img-review-lightbox-loading');
        if (img) {
            img.alt = alt || '';
            if (src) {
                img.hidden = false;
                img.src = src;
            } else {
                img.removeAttribute('src');
                img.hidden = true;
            }
        }
        if (loading) loading.hidden = !!src;
        box.hidden = false;
        document.body.classList.add('sc-user-img-review-lightbox-open');
    }

    function bindThumbZoom(img, row, token) {
        if (!img || !row) return;
        img.classList.add('sc-user-img-review-thumb--zoom');
        img.setAttribute('title', '点击查看原图');
        img.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var alt = row.item_name_zh || row.item_name_en || '';
            var orig = previewUrlCache[previewCacheKey(row.id, 'orig')];
            if (orig) {
                openReviewLightbox(orig, alt);
                return;
            }
            openReviewLightbox('', alt);
            loadPreviewUrl(token, row.id, '')
                .then(function (url) {
                    if (url) openReviewLightbox(url, alt);
                    else closeReviewLightbox();
                })
                .catch(function () {
                    closeReviewLightbox();
                });
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
                        nameMarkup(row) +
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
                if (!row) return;
                loadPreview(token, id, img).then(function () {
                    if (img.isConnected) bindThumbZoom(img, row, token);
                });
            });
            approvedListEl.querySelectorAll('[data-del-approved]').forEach(function (btn) {
                btn.onclick = function () {
                    var id = btn.getAttribute('data-del-approved');
                    var row = approvedAll.filter(function (r) {
                        return String(r.id) === String(id);
                    })[0];
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
                var id = img.getAttribute('data-preview-id');
                var card = img.closest('.sc-user-img-review-card');
                var rowId = card && card.getAttribute('data-id');
                var row = pendingAll.filter(function (r) {
                    return String(r.id) === String(rowId || id);
                })[0];
                loadPreview(token, id, img).then(function () {
                    if (img.isConnected && row) bindThumbZoom(img, row, token);
                });
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
                        nameMarkup(row) +
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
