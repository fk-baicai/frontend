
(function (global) {
    'use strict';

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var API_BASE = (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
    var POLL_MS = 4000;
    var MAX_TEXT = 400;

    var dock = null;
    var pollTimer = null;
    var state = {
        purchaseId: '',
        itemName: '',
        peerName: '',
        myRole: '',
        maxSeq: 0,
        sending: false,
        canSend: true,
    };

    function joinUrl(path) {
        return String(API_BASE).replace(/\/$/, '') + path;
    }

    function loadSession() {
        if (window.UssAuthSessionSync && typeof window.UssAuthSessionSync.loadAuthSession === 'function') {
            return window.UssAuthSessionSync.loadAuthSession();
        }
        try {
            var raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            return null;
        }
        return null;
    }

    function authHeaders() {
        var s = loadSession();
        if (!s || !s.token) return {};
        return { Authorization: 'Bearer ' + s.token };
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatTime(iso) {
        if (!iso) return '';
        var t = Date.parse(String(iso));
        if (!Number.isFinite(t)) return '';
        var d = new Date(t);
        function pad(n) { return n < 10 ? '0' + n : String(n); }
        return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function ensureDock() {
        if (dock) return dock;
        dock = document.createElement('div');
        dock.id = 'marketChatDock';
        dock.className = 'market-chat-dock';
        dock.hidden = true;
        dock.innerHTML =
            '<div class="market-chat-panel" role="dialog" aria-label="临时交易聊天">' +
            '<header class="market-chat-head">' +
            '<div class="market-chat-head__text">' +
            '<p class="market-chat-head__item" id="marketChatItem"></p>' +
            '<p class="market-chat-head__peer" id="marketChatPeer"></p>' +
            '</div>' +
            '<button type="button" class="market-chat-delete" id="marketChatDelete" hidden>删除</button>' +
            '<button type="button" class="market-chat-close" id="marketChatClose" aria-label="关闭聊天">×</button>' +
            '</header>' +
            '<div class="market-chat-log" id="marketChatLog" aria-live="polite"></div>' +
            '<p class="market-chat-readonly" id="marketChatReadonly" hidden>交易已结束，仅保留聊天快照，双方无法继续发送。</p>' +
            '<form class="market-chat-composer" id="marketChatForm">' +
            '<input class="market-chat-input" id="marketChatInput" maxlength="' + MAX_TEXT + '" autocomplete="off" placeholder="输入消息…">' +
            '<button type="submit" class="market-btn market-btn--accent market-chat-send" id="marketChatSend">发送</button>' +
            '</form>' +
            '</div>';
        document.body.appendChild(dock);
        dock.querySelector('#marketChatClose').addEventListener('click', close);
        dock.querySelector('#marketChatDelete').addEventListener('click', deleteSnapshot);
        dock.querySelector('#marketChatForm').addEventListener('submit', function (ev) {
            ev.preventDefault();
            sendCurrent();
        });
        return dock;
    }

    function stopPoll() {
        if (pollTimer) {
            window.clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function close() {
        stopPoll();
        state.purchaseId = '';
        state.maxSeq = 0;
        if (dock) dock.hidden = true;
    }

    function appendRows(rows, reset) {
        var log = document.getElementById('marketChatLog');
        if (!log) return;
        if (reset) log.innerHTML = '';
        var sess = loadSession() || {};
        var myBid = String(sess.bindingId || '').toLowerCase();
        (rows || []).forEach(function (m) {
            if (!m || !m.id) return;
            if (log.querySelector('[data-msg-id="' + m.id + '"]')) return;
            var mine = String(m.fromBindingId || '').toLowerCase() === myBid;
            var div = document.createElement('div');
            div.className = 'market-chat-msg' + (mine ? ' is-mine' : '');
            div.setAttribute('data-msg-id', m.id);
            div.innerHTML =
                '<p class="market-chat-msg__text">' + escapeHtml(m.text) + '</p>' +
                '<time class="market-chat-msg__time">' + escapeHtml(formatTime(m.createdAt)) + '</time>';
            log.appendChild(div);
            if (m.seq > state.maxSeq) state.maxSeq = m.seq;
        });
        if (rows && rows.length) log.scrollTop = log.scrollHeight;
        if (reset && (!rows || !rows.length)) {
            log.innerHTML = '<p class="market-chat-empty">' +
                (state.canSend ? '还没有消息，直接打个招呼即可。' : '没有可保留的聊天记录。') +
                '</p>';
        }
    }

    function setSendEnabled(canSend) {
        state.canSend = !!canSend;
        var form = document.getElementById('marketChatForm');
        var hint = document.getElementById('marketChatReadonly');
        var del = document.getElementById('marketChatDelete');
        if (form) form.hidden = !state.canSend;
        if (hint) hint.hidden = state.canSend;
        if (del) del.hidden = false;
        if (!state.canSend) stopPoll();
        else if (!pollTimer) startPoll();
    }

    async function deleteSnapshot() {
        if (!state.purchaseId) return;
        if (!window.confirm('删除后你将不再看到这条聊天快照，对方仍可查看。确定删除？')) return;
        try {
            var r = await fetch(joinUrl('/api/market/chat/threads/' + encodeURIComponent(state.purchaseId)), {
                method: 'DELETE',
                headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
            });
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok) throw new Error((data && data.message) || '删除失败');
            close();
            try {
                window.dispatchEvent(new CustomEvent('uss-market-chat-deleted'));
            } catch (e2) { /* ignore */ }
        } catch (e) {
            window.alert((e && e.message) || '删除失败');
        }
    }

    async function fetchMessages(reset) {
        if (!state.purchaseId) return;
        var qs = reset ? '' : (state.maxSeq ? '?afterSeq=' + encodeURIComponent(String(state.maxSeq)) : '');
        var r = await fetch(joinUrl('/api/market/chat/threads/' + encodeURIComponent(state.purchaseId) + qs), {
            headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
        });
        var data = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((data && data.message) || '加载聊天失败');
        if (data.itemName) {
            state.itemName = data.itemName;
            var itemEl = document.getElementById('marketChatItem');
            if (itemEl) itemEl.textContent = data.itemName;
        }
        if (data.peerBindingId && !state.peerName) {
            state.peerName = data.peerBindingId;
            var peerEl = document.getElementById('marketChatPeer');
            if (peerEl) peerEl.textContent = (data.myRole === 'buyer' ? '卖家 ' : '买家 ') + data.peerBindingId;
        }
        var rows = Array.isArray(data.messages) ? data.messages : [];
        if (typeof data.canSend === 'boolean') setSendEnabled(data.canSend);
        appendRows(rows, !!reset);
        if (typeof data.maxSeq === 'number' && data.maxSeq > state.maxSeq) state.maxSeq = data.maxSeq;
    }

    async function sendCurrent() {
        var input = document.getElementById('marketChatInput');
        var text = input ? String(input.value || '').trim() : '';
        if (!text || !state.purchaseId || state.sending || !state.canSend) return;
        state.sending = true;
        var sendBtn = document.getElementById('marketChatSend');
        if (sendBtn) sendBtn.disabled = true;
        try {
            var r = await fetch(joinUrl('/api/market/chat/threads/' + encodeURIComponent(state.purchaseId)), {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders()),
                body: JSON.stringify({ text: text }),
            });
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok) {
                var hinted = data && data.code && window.UssApiError && window.UssApiError.formatUserError
                    ? window.UssApiError.formatUserError(data.code)
                    : '';
                throw new Error(hinted || (data && data.message) || '发送失败');
            }
            if (input) input.value = '';
            var empty = document.querySelector('#marketChatLog .market-chat-empty');
            if (empty) empty.remove();
            if (data.message) appendRows([data.message], false);
        } catch (e) {
            window.alert((e && e.message) || '发送失败');
        } finally {
            state.sending = false;
            if (sendBtn) sendBtn.disabled = false;
            if (input) input.focus();
        }
    }

    function startPoll() {
        stopPoll();
        pollTimer = window.setInterval(function () {
            fetchMessages(false).catch(function () { /* ignore poll errors */ });
        }, POLL_MS);
    }

    function open(opts) {
        opts = opts || {};
        var purchaseId = String(opts.purchaseId || '').trim();
        if (!purchaseId) {
            window.alert('暂无进行中的交易，提交购买后即可联系对方。');
            return;
        }
        var sess = loadSession();
        if (!sess || !sess.token) {
            window.alert('请先登录后再联系对方。');
            return;
        }
        ensureDock();
        state.purchaseId = purchaseId;
        state.itemName = String(opts.itemName || '交易沟通').trim() || '交易沟通';
        state.peerName = String(opts.peerName || '').trim();
        state.myRole = String(opts.myRole || '').trim();
        state.maxSeq = 0;
        state.canSend = opts.canSend !== false && !opts.snapshot;
        var itemEl = document.getElementById('marketChatItem');
        var peerEl = document.getElementById('marketChatPeer');
        if (itemEl) itemEl.textContent = state.itemName;
        if (peerEl) {
            peerEl.textContent = state.peerName
                ? ((state.myRole === 'seller' ? '买家 ' : '卖家 ') + state.peerName)
                : '临时交易聊天';
        }
        dock.hidden = false;
        setSendEnabled(state.canSend);
        var log = document.getElementById('marketChatLog');
        if (log) log.innerHTML = '<p class="market-chat-empty">加载中…</p>';
        var input = document.getElementById('marketChatInput');
        if (input && state.canSend) input.focus();
        fetchMessages(true).catch(function (e) {
            if (log) log.innerHTML = '<p class="market-chat-empty">' + escapeHtml((e && e.message) || '加载失败') + '</p>';
        });
        if (state.canSend) startPoll();
        else stopPoll();
    }

    global.UssMarketChat = {
        open: open,
        close: close,
    };
})(typeof window !== 'undefined' ? window : this);
