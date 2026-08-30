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

    async function loadPreview(token, id, imgEl) {
        var res = await fetch(apiBase() + '/api/admin/sc/image-submissions/' + encodeURIComponent(id) + '/preview', {
            headers: adminHeaders(token),
        });
        if (!res.ok) throw new Error('预览失败');
        var blob = await res.blob();
        imgEl.src = URL.createObjectURL(blob);
    }

    function mount(root, token) {
        if (!root || !token) return;
        root.innerHTML =
            '<p class="hint" id="scUserImgReviewMeta">加载待审核图片…</p>' +
            '<div id="scUserImgReviewErr" class="err" hidden></div>' +
            '<h3 class="sc-user-img-review-h">待审核</h3>' +
            '<div id="scUserImgReviewList" class="sc-user-img-review-list"></div>' +
            '<h3 class="sc-user-img-review-h">已通过记录</h3>' +
            '<p class="hint" id="scUserImgApprovedMeta">加载已通过图片…</p>' +
            '<div id="scUserImgApprovedList" class="sc-user-img-review-list"></div>';

        var metaEl = root.querySelector('#scUserImgReviewMeta');
        var errEl = root.querySelector('#scUserImgReviewErr');
        var listEl = root.querySelector('#scUserImgReviewList');
        var approvedMetaEl = root.querySelector('#scUserImgApprovedMeta');
        var approvedListEl = root.querySelector('#scUserImgApprovedList');

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
            var items = data.items || [];
            if (approvedMetaEl) {
                approvedMetaEl.textContent = items.length ? '已通过 ' + items.length + ' 张，可删除展示图' : '暂无已通过记录';
            }
            if (!items.length) {
                approvedListEl.innerHTML = '';
                return;
            }
            approvedListEl.innerHTML = items
                .map(function (row) {
                    return (
                        '<article class="sc-user-img-review-card" data-id="' +
                        esc(row.id) +
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
                loadPreview(token, img.getAttribute('data-preview-id'), img).catch(function () {
                    img.replaceWith(document.createTextNode('无法预览'));
                });
            });
            approvedListEl.querySelectorAll('[data-del-approved]').forEach(function (btn) {
                btn.onclick = function () {
                    if (!window.confirm('删除后前台不再展示这张用户图，确定？')) return;
                    btn.disabled = true;
                    removeApproved(btn.getAttribute('data-del-approved'))
                        .then(loadApproved)
                        .catch(function (e) {
                            btn.disabled = false;
                            showErr((e && e.message) || '删除失败');
                        });
                };
            });
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
            var items = data.items || [];
            if (metaEl) metaEl.textContent = items.length ? '待审核 ' + items.length + ' 张' : '暂无待审核图片';
            if (!listEl) return;
            if (!items.length) {
                listEl.innerHTML = '';
                return;
            }
            listEl.innerHTML = items
                .map(function (row) {
                    return (
                        '<article class="sc-user-img-review-card" data-id="' +
                        esc(row.id) +
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
            listEl.querySelectorAll('img[data-preview-id]').forEach(function (img) {
                loadPreview(token, img.getAttribute('data-preview-id'), img).catch(function () {
                    img.replaceWith(document.createTextNode('无法预览'));
                });
            });
            listEl.querySelectorAll('[data-approve]').forEach(function (btn) {
                btn.onclick = function () {
                    var id = btn.getAttribute('data-approve');
                    btn.disabled = true;
                    review(id, 'approve')
                        .then(function () {
                            return Promise.all([load(), loadApproved()]);
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
                        .then(load)
                        .catch(function (e) {
                            btn.disabled = false;
                            showErr((e && e.message) || '驳回失败');
                        });
                };
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
