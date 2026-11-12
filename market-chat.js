
(function (global) {
    'use strict';

    var AUTH_KEY = 'ussHangzhouAuthSession';
    var API_BASE = (typeof window !== 'undefined' && window.USS_AUTH_API_BASE) || 'http://127.0.0.1:3789';
    var POLL_MS = 4000;
    var MAX_TEXT = 400;
    var RECALL_MS = 3 * 60 * 1000;

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

    function canRecallMessage(m, myBid) {
        if (!m || m.recalled) return false;
        if (String(m.fromBindingId || '').toLowerCase() !== String(myBid || '').toLowerCase()) return false;
        var t = Date.parse(String(m.createdAt || ''));
        if (!Number.isFinite(t)) return false;
        return Date.now() - t <= RECALL_MS;
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
            '<button type="button" class="market-chat-head__item" id="marketChatItem" title="前往商城管理对应订单"></button>' +
            '<p class="market-chat-head__peer" id="marketChatPeer"></p>' +
            '</div>' +
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
        dock.querySelector('#marketChatItem').addEventListener('click', goToTradeManage);
        dock.querySelector('#marketChatForm').addEventListener('submit', function (ev) {
            ev.preventDefault();
            sendCurrent();
        });
        dock.querySelector('#marketChatLog').addEventListener('click', function (ev) {
            var btn = ev.target && ev.target.closest ? ev.target.closest('[data-recall-id]') : null;
            if (!btn) return;
            ev.preventDefault();
            recallMessage(btn.getAttribute('data-recall-id'));
        });
        return dock;
    }

    function goToTradeManage() {
        if (!state.purchaseId) return;
        var tab = state.myRole === 'seller' ? 'incoming' : 'purchases';
        var url = 'market-trades.html?tab=' + encodeURIComponent(tab) +
            '&highlight=' + encodeURIComponent(state.purchaseId);
        window.location.href = url;
    }

    function notifyChatSeen(lastAt) {
        if (window.UssMarketNotify && typeof window.UssMarketNotify.markChatSeen === 'function') {
            window.UssMarketNotify.markChatSeen(state.purchaseId, lastAt || new Date().toISOString());
        }
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

    function messageInnerHtml(m, mine, myBid) {
        if (m.recalled) {
            return (
                '<p class="market-chat-msg__text market-chat-msg__text--recalled">已撤回一条消息</p>' +
                '<time class="market-chat-msg__time">' + escapeHtml(formatTime(m.createdAt)) + '</time>'
            );
        }
        var recall =
            canRecallMessage(m, myBid)
                ? '<button type="button" class="market-chat-msg__recall" data-recall-id="' +
                  escapeHtml(m.id) +
                  '">撤回</button>'
                : '';
        return (
            '<p class="market-chat-msg__text">' + escapeHtml(m.text) + '</p>' +
            '<div class="market-chat-msg__meta">' +
            '<time class="market-chat-msg__time">' + escapeHtml(formatTime(m.createdAt)) + '</time>' +
            recall +
            '</div>'
        );
    }

    function upsertMessage(log, m, myBid) {
        if (!log || !m || !m.id) return;
        var mine = String(m.fromBindingId || '').toLowerCase() === String(myBid || '').toLowerCase();
        var existing = log.querySelector('[data-msg-id="' + m.id + '"]');
        if (existing) {
            existing.className = 'market-chat-msg' + (mine ? ' is-mine' : '') + (m.recalled ? ' is-recalled' : '');
            existing.innerHTML = messageInnerHtml(m, mine, myBid);
            return;
        }
        var empty = log.querySelector('.market-chat-empty');
        if (empty) empty.remove();
        var div = document.createElement('div');
        div.className = 'market-chat-msg' + (mine ? ' is-mine' : '') + (m.recalled ? ' is-recalled' : '');
        div.setAttribute('data-msg-id', m.id);
        div.innerHTML = messageInnerHtml(m, mine, myBid);
        log.appendChild(div);
    }

    function appendRows(rows, reset) {
        var log = document.getElementById('marketChatLog');
        if (!log) return;
        if (reset) log.innerHTML = '';
        var sess = loadSession() || {};
        var myBid = String(sess.bindingId || '').toLowerCase();
        (rows || []).forEach(function (m) {
            if (!m || !m.id) return;
            upsertMessage(log, m, myBid);
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
        if (form) form.hidden = !state.canSend;
        if (hint) hint.hidden = state.canSend;
        if (!state.canSend) stopPoll();
        else if (!pollTimer) startPoll();
    }

    async function recallMessage(messageId) {
        var mid = String(messageId || '').trim();
        if (!mid || !state.purchaseId) return;
        try {
            var r = await fetch(
                joinUrl(
                    '/api/market/chat/threads/' +
                        encodeURIComponent(state.purchaseId) +
                        '/messages/' +
                        encodeURIComponent(mid) +
                        '/recall'
                ),
                {
                    method: 'POST',
                    headers: Object.assign({ Accept: 'application/json' }, authHeaders()),
                }
            );
            var data = await r.json().catch(function () { return {}; });
            if (!r.ok) {
                var hinted =
                    data && data.code && window.UssApiError && window.UssApiError.formatUserError
                        ? window.UssApiError.formatUserError(data.code)
                        : '';
                throw new Error(hinted || (data && data.message) || '撤回失败');
            }
            if (data.message) {
                var log = document.getElementById('marketChatLog');
                var sess = loadSession() || {};
                upsertMessage(log, data.message, String(sess.bindingId || '').toLowerCase());
            }
        } catch (e) {
            window.alert((e && e.message) || '撤回失败');
        }
    }

    async function fetchMessages(reset) {
        if (!state.purchaseId) return;
        // Always load the full thread so peer recalls update existing bubbles.
        var r = await fetch(joinUrl('/api/market/chat/threads/' + encodeURIComponent(state.purchaseId)), {
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
        if (data.myRole) state.myRole = String(data.myRole);
        var rows = Array.isArray(data.messages) ? data.messages : [];
        if (typeof data.canSend === 'boolean') setSendEnabled(data.canSend);
        appendRows(rows, !!reset);
        if (typeof data.maxSeq === 'number' && data.maxSeq > state.maxSeq) state.maxSeq = data.maxSeq;
        var lastAt = data.updatedAt || null;
        for (var i = rows.length - 1; i >= 0; i -= 1) {
            if (rows[i] && rows[i].createdAt && !rows[i].recalled) {
                lastAt = rows[i].createdAt;
                break;
            }
        }
        notifyChatSeen(lastAt || new Date().toISOString());
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
            window.alert('确认购买后即可联系卖家。');
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
        if (itemEl) {
            itemEl.textContent = state.itemName;
            itemEl.title = state.myRole === 'seller'
                ? '前往商城管理 · 收到订单'
                : '前往商城管理 · 我的购买';
        }
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
        notifyChatSeen(new Date().toISOString());
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
