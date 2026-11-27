(function () {
    var ICON = "<svg viewBox=\"0 0 1024 1024\" aria-hidden=\"true\"><path d=\"M777.6 829.6c0 14.2-11.9 25.8-26.6 25.8H198.7c-14.7 0-26.6-11.6-26.6-25.8V284.3c0-14.2 11.9-25.8 26.6-25.8h354.7v-68H198.7c-52.2 0-94.6 42.1-94.6 93.8v545.3c0 51.7 42.4 93.8 94.6 93.8H751c52.2 0 94.6-42.1 94.6-93.8V478.2h-68v351.4z\"></path><path d=\"M914.4 216.3L864.2 165l-21.1-21.6-29.1-29.8c-6.4-6.5-15.2-10.2-24.3-10.2-9.2 0-17.9 3.7-24.3 10.3l-27.8 28.5-2.5 2.6-304.8 312.7c-0.4 0.4-0.8 0.8-1.2 1.3-0.4 0.5-0.8 0.9-1.2 1.4-0.1 0.1-0.1 0.2-0.2 0.3-0.3 0.4-0.6 0.8-0.9 1.3-0.1 0.1-0.1 0.2-0.2 0.3-0.3 0.5-0.6 0.9-0.9 1.4 0 0.1-0.1 0.1-0.1 0.2l-1.2 2.1-117.3 222.8c-7 13.3-4.4 29.6 6.3 40.1 6.5 6.4 15.1 9.7 23.8 9.7 5.6 0 11.3-1.4 16.5-4.3l217.7-120.5c0.1-0.1 0.3-0.2 0.4-0.2 0.4-0.2 0.7-0.4 1.1-0.7 0.2-0.1 0.4-0.3 0.6-0.4 0.3-0.2 0.6-0.4 1-0.6 0.2-0.1 0.4-0.3 0.6-0.4 0.3-0.2 0.6-0.4 0.9-0.7 0.2-0.2 0.4-0.3 0.6-0.5 0.3-0.2 0.6-0.5 0.9-0.7 0.2-0.2 0.4-0.3 0.5-0.5l0.9-0.9 0.4-0.4L870.4 309l16.3-16.7 27.8-28.5c12.8-13.2 12.8-34.3-0.1-47.5z m-92.7 45.3c-0.3 0.3-1.2 1.1-2.9 1.1-1.1 0-3.2-0.3-5.3-2.5l-42.1-43.1c-3.4-3.5-3.5-8.5-1.3-10.8l16.3-16.7c0.3-0.3 1.1-1.2 2.9-1.2 1.1 0 3.2 0.3 5.3 2.5l42.1 43.1c3.4 3.5 3.5 8.5 1.3 10.8l-1.6 1.6-14.7 15.2z m-103.5-2c1.4 1.7 2.9 3.5 4.5 5.1l42.1 43.1c2 2 4.1 3.9 6.2 5.7L554.9 535.2l-52.8-54 216.1-221.6z m-298 360l42.7-81.2 36.5 37.4-79.2 43.8z\"></path></svg>";
    var counts = {};

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
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
                rankIcon: sess.rsiRankIconUrl || "",
                isSuperAdmin: !!sess.isSuperAdmin
            };
        } catch (e) {
            return null;
        }
    }

    function personRow(note, withTime) {
        var row = el("div", "min-note-person");
        var avatar = document.createElement("img");
        avatar.className = "min-note-avatar";
        avatar.alt = "";
        avatar.referrerPolicy = "no-referrer";
        avatar.src = assetUrl(note.avatarUrl) || (window.USS_DEFAULT_AVATAR || "default-avatar.webp");
        avatar.setAttribute("data-avatar-handle", String(note.name || "").trim().toLowerCase());
        if (note.avatarFrame) avatar.setAttribute("data-avatar-frame", "1");
        else avatar.removeAttribute("data-avatar-frame");
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

    function noteTotal(notes) {
        return (notes || []).reduce(function (sum, note) {
            return sum + 1 + ((note.replies && note.replies.length) || 0);
        }, 0);
    }

    function paintNotes(list, notes, onReply, onDelete) {
        list.textContent = "";
        if (!notes.length) {
            list.appendChild(el("p", "min-empty", "还没有留言。"));
            return;
        }
        notes.slice().reverse().forEach(function (note) {
            var item = el("article", "min-note-item");
            if (note.id) item.setAttribute("data-note-id", String(note.id));
            item.appendChild(personRow(note, true));
            item.appendChild(el("p", "min-note-text", note.text));
            var actions = el("div", "min-note-actions");
            var reply = el("button", "min-note-reply", "");
            reply.type = "button";
            reply.setAttribute("aria-label", "回复");
            reply.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>';
            reply.addEventListener("click", function () { onReply(note); });
            actions.appendChild(reply);
            if (onDelete && note.id) {
                var del = el("button", "min-note-delete", "删除");
                del.type = "button";
                del.addEventListener("click", function () { onDelete(note.id); });
                actions.appendChild(del);
            }
            item.appendChild(actions);
            var replies = note.replies || [];
            if (replies.length) {
                var box = el("div", "min-note-replies");
                replies.forEach(function (child) {
                    var row = el("div", "min-note-reply-item");
                    if (child && child.id) row.setAttribute("data-note-id", String(child.id));
                    row.appendChild(personRow(child, true));
                    row.appendChild(el("p", "min-note-text", child.text));
                    if (onDelete && child && child.id) {
                        var replyDel = el("button", "min-note-delete", "删除");
                        replyDel.type = "button";
                        replyDel.addEventListener("click", function () { onDelete(child.id); });
                        row.appendChild(replyDel);
                    }
                    box.appendChild(row);
                });
                item.appendChild(box);
            }
            list.appendChild(item);
        });
        if (window.UssAvatarFrame && typeof window.UssAvatarFrame.paintAll === "function") {
            window.UssAvatarFrame.paintAll();
        }
    }

    function noteKind(btn) {
        return btn && btn.hasAttribute("data-site-note") ? "site" : "mission";
    }

    function noteId(btn) {
        if (!btn) return "";
        return btn.getAttribute("data-site-note") || btn.getAttribute("data-mission-note") || "";
    }

    function noteUrl(id, kind) {
        var base = String(window.USS_AUTH_API_BASE || "").replace(/\/$/, "");
        if (kind === "site") return base + "/api/site/notes/" + encodeURIComponent(id);
        return base + "/api/missions/" + encodeURIComponent(id) + "/notes";
    }

    function noteButtons(id) {
        return document.querySelectorAll(
            '[data-mission-note="' + CSS.escape(id) + '"], [data-site-note="' + CSS.escape(id) + '"]'
        );
    }

    function markCount(id, count) {
        counts[id] = count;
        Array.prototype.forEach.call(noteButtons(id), function (btn) {
            if (!btn.querySelector("svg") && !String(btn.textContent || "").trim()) btn.innerHTML = ICON;
            if (count) btn.setAttribute("data-count", String(count));
            else btn.removeAttribute("data-count");
        });
    }

    function paintAll() {
        Array.prototype.forEach.call(document.querySelectorAll("[data-mission-note], [data-site-note]"), function (btn) {
            if (!btn.querySelector("svg") && !String(btn.textContent || "").trim()) btn.innerHTML = ICON;
            var id = noteId(btn);
            var count = counts[id];
            if (count) btn.setAttribute("data-count", String(count));
        });
    }

    function closeNotes() {
        var mask = document.getElementById("missionNoteMask");
        if (mask) mask.remove();
    }

    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && document.getElementById("missionNoteMask")) {
            ev.stopPropagation();
            closeNotes();
        }
    }, true);

    function open(id, title, kind) {
        if (!id) return;
        kind = kind === "site" ? "site" : "mission";
        closeNotes();
        var mask = el("div", "min-note-mask");
        mask.id = "missionNoteMask";
        var panel = el("div", "min-note-panel");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        var head = el("div", "min-note-head");
        head.appendChild(el("h3", "min-note-title", (title || "任务") + " · 留言"));
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
        var idlePlaceholder = viewer ? "以 " + viewer.name + " 的身份留言" : "写一条留言，所有人都能看到";
        text.placeholder = idlePlaceholder;
        text.setAttribute("aria-label", "留言");
        var parent = null;
        var hint = el("p", "min-note-replying");
        hint.hidden = true;
        function clearReply() {
            parent = null;
            hint.hidden = true;
            hint.textContent = "";
            text.placeholder = idlePlaceholder;
        }
        function setReply(note) {
            parent = note;
            hint.hidden = false;
            hint.textContent = "";
            hint.appendChild(document.createTextNode("回复 " + (note.name || "访客")));
            var cancel = el("button", "min-note-reply-cancel", "取消");
            cancel.type = "button";
            cancel.addEventListener("click", clearReply);
            hint.appendChild(cancel);
            text.placeholder = "回复 " + (note.name || "访客");
            text.focus();
        }
        var send = el("button", "min-note-send", "发布");
        send.type = "submit";
        if (viewer) form.appendChild(personRow(viewer, false));
        else form.appendChild(name);
        form.appendChild(hint);
        form.appendChild(text);
        form.appendChild(send);
        function paint() {
            paintNotes(list, lastNotes, setReply, viewer && viewer.isSuperAdmin ? deleteNote : null);
        }
        var lastNotes = [];
        function deleteNote(noteId) {
            if (!viewer || !viewer.token || !noteId) return;
            if (!window.confirm("确定删除这条留言？")) return;
            var node = list.querySelector('[data-note-id="' + noteId + '"]');
            if (node) node.remove();
            fetch(noteUrl(id, kind) + "/" + encodeURIComponent(noteId), {
                method: "DELETE",
                headers: { Authorization: "Bearer " + viewer.token }
            }).then(function (res) {
                return res.json().then(function (body) { return { ok: res.ok, body: body }; });
            }).then(function (result) {
                if (!result.ok || !result.body || !result.body.ok) {
                    list.appendChild(el("p", "min-empty", (result.body && result.body.message) || "留言没有删除。"));
                    fetch(noteUrl(id, kind))
                        .then(function (res) { if (!res.ok) throw new Error("bad"); return res.json(); })
                        .then(function (body) {
                            lastNotes = body.notes || [];
                            paint();
                            markCount(id, noteTotal(lastNotes));
                        })
                        .catch(function () { /* keep optimistic removal */ });
                    return;
                }
                lastNotes = result.body.notes || [];
                paint();
                markCount(id, noteTotal(lastNotes));
            }).catch(function () {
                list.appendChild(el("p", "min-empty", "留言没有删除。"));
            });
        }
        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            var payload = { name: viewer ? viewer.name : name.value, text: text.value };
            if (parent && parent.id) payload.parent = parent.id;
            var bodyText = String(text.value || "").trim();
            if (!bodyText) return;
            if (!viewer && !String(name.value || "").trim()) return;
            var optimistic = {
                id: "pending-" + Date.now(),
                name: payload.name,
                text: bodyText,
                at: new Date().toISOString(),
                replies: [],
                avatarUrl: viewer ? viewer.avatarUrl : "",
                rankLabel: viewer ? viewer.rankLabel : "",
                rankIcon: viewer ? viewer.rankIcon : "",
                avatarFrame: false
            };
            var parentId = parent && parent.id ? parent.id : "";
            if (!viewer) localStorage.setItem("min-note-name", String(name.value || "").trim());
            text.value = "";
            clearReply();
            var empty = list.querySelector(".min-empty");
            if (empty) empty.remove();
            if (parentId) {
                var article = list.querySelector('.min-note-item[data-note-id="' + parentId + '"]');
                if (article) {
                    var replies = article.querySelector(".min-note-replies");
                    if (!replies) {
                        replies = el("div", "min-note-replies");
                        article.appendChild(replies);
                    }
                    var row = el("article", "min-note-reply-item");
                    row.setAttribute("data-pending", optimistic.id);
                    row.appendChild(personRow(optimistic, true));
                    row.appendChild(el("p", "min-note-text", optimistic.text));
                    replies.appendChild(row);
                }
            } else {
                var wrap = el("article", "min-note-item");
                wrap.setAttribute("data-pending", optimistic.id);
                wrap.appendChild(personRow(optimistic, true));
                wrap.appendChild(el("p", "min-note-text", optimistic.text));
                if (list.firstChild) list.insertBefore(wrap, list.firstChild);
                else list.appendChild(wrap);
            }
            var headers = { "Content-Type": "application/json" };
            if (viewer) headers.Authorization = "Bearer " + viewer.token;
            fetch(noteUrl(id, kind), {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload)
            }).then(function (res) {
                return res.json().then(function (body) { return { ok: res.ok, body: body }; });
            }).then(function (result) {
                if (!result.ok || !result.body || !result.body.ok) {
                    var pending = list.querySelector('[data-pending="' + optimistic.id + '"]');
                    if (pending) pending.remove();
                    list.appendChild(el("p", "min-empty", (result.body && result.body.message) || "留言没有保存。"));
                    return;
                }
                lastNotes = result.body.notes || [];
                paint();
                markCount(id, noteTotal(lastNotes));
            }).catch(function () {
                var pending = list.querySelector('[data-pending="' + optimistic.id + '"]');
                if (pending) pending.remove();
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
        fetch(noteUrl(id, kind))
            .then(function (res) { if (!res.ok) throw new Error("bad"); return res.json(); })
            .then(function (body) { lastNotes = body.notes || []; paint(); })
            .catch(function () { list.textContent = ""; list.appendChild(el("p", "min-empty", "留言没有读到。")); });
    }

    document.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-mission-note], [data-site-note]");
        if (!btn) return;
        ev.preventDefault();
        ev.stopPropagation();
        open(noteId(btn), btn.getAttribute("data-label"), noteKind(btn));
    }, true);

    var base = String(window.USS_AUTH_API_BASE || "").replace(/\/$/, "");
    Promise.all([
        fetch(base + "/api/missions/notes/summary").then(function (res) { return res.json(); }).catch(function () { return {}; }),
        fetch(base + "/api/site/notes/summary").then(function (res) { return res.json(); }).catch(function () { return {}; })
    ]).then(function (parts) {
        counts = Object.assign({}, (parts[0] && parts[0].counts) || {}, (parts[1] && parts[1].counts) || {});
        paintAll();
    }).catch(function () { paintAll(); });

    if (document.body) {
        new MutationObserver(paintAll).observe(document.body, { childList: true, subtree: true });
    }
    window.ItemNotes = { open: open, paint: paintAll };
})();
