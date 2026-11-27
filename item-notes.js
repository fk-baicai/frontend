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
                rankIcon: sess.rsiRankIconUrl || ""
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

    function paintNotes(list, notes, onReply) {
        list.textContent = "";
        if (!notes.length) {
            list.appendChild(el("p", "min-empty", "还没有留言。"));
            return;
        }
        notes.slice().reverse().forEach(function (note) {
            var item = el("article", "min-note-item");
            item.appendChild(personRow(note, true));
            item.appendChild(el("p", "min-note-text", note.text));
            var reply = el("button", "min-note-reply", "");
            reply.type = "button";
            reply.setAttribute("aria-label", "回复");
            reply.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>';
            reply.addEventListener("click", function () { onReply(note); });
            item.appendChild(reply);
            var replies = note.replies || [];
            if (replies.length) {
                var box = el("div", "min-note-replies");
                replies.forEach(function (child) {
                    var row = el("div", "min-note-reply-item");
                    row.appendChild(personRow(child, true));
                    row.appendChild(el("p", "min-note-text", child.text));
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
        form.addEventListener("submit", function (ev) {
            ev.preventDefault();
            send.disabled = true;
            var headers = { "Content-Type": "application/json" };
            if (viewer) headers.Authorization = "Bearer " + viewer.token;
            var payload = { name: viewer ? viewer.name : name.value, text: text.value };
            if (parent && parent.id) payload.parent = parent.id;
            fetch(noteUrl(id, kind), {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload)
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
                clearReply();
                paintNotes(list, result.body.notes || [], setReply);
                markCount(id, noteTotal(result.body.notes));
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
        fetch(noteUrl(id, kind))
            .then(function (res) { if (!res.ok) throw new Error("bad"); return res.json(); })
            .then(function (body) { paintNotes(list, body.notes || [], setReply); })
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
