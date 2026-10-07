// ==UserScript==
// @name        ChatGPT 降智检测
// @namespace   https://github.com/EpochTX/OpenAIsm
// @version     1.4
// @description ChatGPT 降智一键检测脚本
// @author      epochtx
// @match       https://chatgpt.com/*
// @match       https://chat.openai.com/*
// @grant       none
// ==/UserScript==

(() => {
    "use strict";

    const VERSION = "1.4";

    if (window.__CHATGPT_ROUTE_CHECKER_V6__) {
        return;
    }
    window.__CHATGPT_ROUTE_CHECKER_V6__ = true;

    const nativeFetch = window.fetch.bind(window);
    const NativeXHR = window.XMLHttpRequest;
    const nativeXHROpen = NativeXHR.prototype.open;
    const nativeXHRSend = NativeXHR.prototype.send;
    const nativeBeacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
    const NativeWebSocket = window.WebSocket;

    const state = {
        active: false,
        turnKey: null,
        requestModel: null,
        thinkingEffort: null,
        serverModel: null,
        isCollapsed: false
    };

    const oldPanel = document.getElementById("__chatgpt_route_checker_panel__");
    if (oldPanel) oldPanel.remove();

    const oldStyle = document.getElementById("__chatgpt_route_checker_style__");
    if (oldStyle) oldStyle.remove();

    const styleEl = document.createElement("style");
    styleEl.id = "__chatgpt_route_checker_style__";
    styleEl.textContent = `
        #__chatgpt_route_checker_panel__ {
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 2147483647;
            width: 320px;
            background: rgba(20, 20, 25, 0.85);
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            color: #f4f4f5;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            overflow: hidden;
            user-select: none;
            touch-action: none;
            cursor: grab;
        }
        #__chatgpt_route_checker_panel__.collapsed {
            width: auto;
            border-radius: 28px;
            cursor: grab;
        }
        #__chatgpt_route_checker_panel__.dragging {
            transition: none !important;
            cursor: grabbing !important;
        }
        .cg-rc-body {
            padding: 14px;
        }
        .cg-rc-verdict {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .cg-rc-collapse-mini {
            background: transparent;
            border: none;
            color: inherit;
            cursor: pointer;
            font-size: 12px;
            opacity: 0.7;
            padding: 0;
            line-height: 1;
            transition: opacity 0.15s;
        }
        .cg-rc-collapse-mini:hover {
            opacity: 1;
        }
        .cg-rc-card {
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 10px;
            background: rgba(255, 255, 255, 0.025);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .cg-rc-label {
            font-size: 10.5px;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .cg-rc-main-model {
            font-size: 15px;
            font-weight: 700;
            color: #fff;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            word-break: break-all;
        }
        .cg-rc-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .cg-rc-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 8px;
            background: rgba(255, 255, 255, 0.015);
            border-radius: 6px;
        }
        .cg-rc-row-key {
            color: #9ca3af;
            font-family: ui-monospace, Menlo, Consolas, monospace;
            font-size: 11px;
        }
        .cg-rc-row-val {
            font-family: ui-monospace, Menlo, Consolas, monospace;
            font-size: 11.5px;
            color: #f3f4f6;
            max-width: 170px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: right;
        }
        .cg-rc-status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            font-size: 12px;
            font-weight: 600;
        }
    `;
    document.head.appendChild(styleEl);

    const panel = document.createElement("div");
    panel.id = "__chatgpt_route_checker_panel__";
    document.documentElement.appendChild(panel);

    const POSITION_STORAGE_KEY = "__chatgpt_route_checker_position_v1__";
    const dragState = {
        active: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        originLeft: 0,
        originTop: 0,
        moved: false,
        suppressClick: false
    };

    function clampPanelPosition(left, top) {
        const gap = 8;
        const width = panel.offsetWidth || 0;
        const height = panel.offsetHeight || 0;
        const maxLeft = Math.max(gap, window.innerWidth - width - gap);
        const maxTop = Math.max(gap, window.innerHeight - height - gap);
        return {
            left: Math.min(Math.max(left, gap), maxLeft),
            top: Math.min(Math.max(top, gap), maxTop)
        };
    }

    function setPanelPosition(left, top, persist = false) {
        const next = clampPanelPosition(left, top);
        panel.style.left = `${next.left}px`;
        panel.style.top = `${next.top}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";

        if (persist) {
            try {
                localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(next));
            } catch {}
        }
    }

    function restorePanelPosition() {
        try {
            const saved = JSON.parse(localStorage.getItem(POSITION_STORAGE_KEY) || "null");
            if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
                setPanelPosition(saved.left, saved.top);
            }
        } catch {}
    }

    function keepPanelInViewport() {
        if (!panel.style.left && !panel.style.top) return;
        const rect = panel.getBoundingClientRect();
        setPanelPosition(rect.left, rect.top);
    }

    panel.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (event.target.closest("button")) return;

        const rect = panel.getBoundingClientRect();
        dragState.active = true;
        dragState.pointerId = event.pointerId;
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;
        dragState.originLeft = rect.left;
        dragState.originTop = rect.top;
        dragState.moved = false;

        panel.classList.add("dragging");
        try { panel.setPointerCapture(event.pointerId); } catch {}
    });

    panel.addEventListener("pointermove", event => {
        if (!dragState.active || event.pointerId !== dragState.pointerId) return;

        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;

        if (!dragState.moved && Math.hypot(dx, dy) < 4) return;
        dragState.moved = true;
        event.preventDefault();
        setPanelPosition(dragState.originLeft + dx, dragState.originTop + dy);
    });

    function finishDrag(event) {
        if (!dragState.active || event.pointerId !== dragState.pointerId) return;

        if (dragState.moved) {
            const rect = panel.getBoundingClientRect();
            setPanelPosition(rect.left, rect.top, true);
            dragState.suppressClick = true;
            setTimeout(() => { dragState.suppressClick = false; }, 0);
        }

        dragState.active = false;
        dragState.pointerId = null;
        panel.classList.remove("dragging");
        try { panel.releasePointerCapture(event.pointerId); } catch {}
    }

    panel.addEventListener("pointerup", finishDrag);
    panel.addEventListener("pointercancel", finishDrag);
    window.addEventListener("resize", () => requestAnimationFrame(keepPanelInViewport));

    function esc(val) {
        return String(val).replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[c]);
    }

    function pending(val) {
        return val ? `<span style="color:#60a5fa">${esc(val)}</span>` : '<span style="color:#6b7280">-</span>';
    }

    function modelFamily(slug) {
        const m = String(slug || "").match(/^gpt-(\d+)-(\d+)/i);
        return m ? `gpt-${m[1]}-${m[2]}` : null;
    }

    function verdictInfo() {
        if (!state.active) {
            return { text: "等待发送新消息…", icon: "⏳", color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)" };
        }
        if (!state.requestModel) {
            return { text: "读取请求中…", icon: "🔎", color: "#38bdf8", bg: "rgba(56,189,248,0.08)", border: "rgba(56,189,248,0.2)" };
        }
        if (!state.serverModel) {
            return { text: "等待服务端响应…", icon: "🧠", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" };
        }
        if (state.requestModel === state.serverModel) {
            return { text: "模型一致 (未降智)", icon: "✅", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" };
        }

        const reqFam = modelFamily(state.requestModel);
        const srvFam = modelFamily(state.serverModel);
        if (reqFam && srvFam && reqFam === srvFam) {
            return { text: "同系列但具体模型不同", icon: "⚠️", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)" };
        }

        return { text: "模型不一致 (疑似降智)", icon: "🚨", color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" };
    }

    function render() {
        const v = verdictInfo();

        if (state.isCollapsed) {
            panel.classList.add("collapsed");
            panel.innerHTML = `
                <div class="cg-rc-status-pill" title="点击展开">
                    <span>${v.icon}</span>
                    <span style="color:${v.color}; font-family: ui-monospace, monospace;">${esc(state.serverModel || state.requestModel || v.text)}</span>
                </div>
            `;
            panel.onclick = () => {
                if (dragState.suppressClick) {
                    dragState.suppressClick = false;
                    return;
                }
                state.isCollapsed = false;
                render();
            };
            requestAnimationFrame(keepPanelInViewport);
            return;
        }

        panel.classList.remove("collapsed");
        panel.onclick = null;
        panel.innerHTML = `
            <div class="cg-rc-body">
                <div class="cg-rc-verdict" style="color: ${v.color}; background: ${v.bg}; border: 1px solid ${v.border};">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>${v.icon}</span>
                        <span>${v.text}</span>
                    </div>
                    <button class="cg-rc-collapse-mini" id="__cg_rc_collapse_btn__" title="收起">✕</button>
                </div>

                <div class="cg-rc-card">
                    <div class="cg-rc-label">server_ste_metadata.model_slug</div>
                    <div class="cg-rc-main-model">
                        ${state.serverModel ? `<span style="color:#4ade80">${esc(state.serverModel)}</span>` : '<span style="color:#6b7280; font-size:13px; font-weight:normal;">等待捕获…</span>'}
                    </div>
                </div>

                <div class="cg-rc-list">
                    <div class="cg-rc-row">
                        <span class="cg-rc-row-key">request.model</span>
                        <span class="cg-rc-row-val">${pending(state.requestModel)}</span>
                    </div>
                    <div class="cg-rc-row">
                        <span class="cg-rc-row-key">request.thinking_effort</span>
                        <span class="cg-rc-row-val">${pending(state.thinkingEffort)}</span>
                    </div>
                </div>
            </div>
        `;

        const btn = panel.querySelector("#__cg_rc_collapse_btn__");
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                state.isCollapsed = true;
                render();
            };
        }

        requestAnimationFrame(keepPanelInViewport);
    }

    function extractTurnKey(req) {
        try {
            const msgs = Array.isArray(req?.messages) ? req.messages : [];
            for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i]?.author?.role === "user" && msgs[i]?.id) return msgs[i].id;
            }
            if (req?.message?.author?.role === "user") return req.message.id || null;
        } catch {}
        return null;
    }

    function resetTurn(key) {
        state.active = true;
        state.turnKey = key || `turn-${Date.now()}`;
        state.serverModel = null;
    }

    function beginOrUpdateTurn(req) {
        const newKey = extractTurnKey(req);
        if (!state.active || (newKey && newKey !== state.turnKey)) {
            resetTurn(newKey);
        }
        if (typeof req?.model === "string") state.requestModel = req.model;
        if (typeof req?.thinking_effort === "string") state.thinkingEffort = req.thinking_effort;
        render();
    }

    function applyServerMetadata(meta) {
        if (!meta || typeof meta !== "object") return;
        if (typeof meta.model_slug === "string") {
            state.serverModel = meta.model_slug;
            render();
        }
    }

    function scanObject(obj, depth = 0, seen = new WeakSet()) {
        if (obj == null || depth > 16) return;
        if (typeof obj === "string") {
            const t = obj.trim();
            if ((t.startsWith("{") || t.startsWith("[")) && (t.includes("model_slug") || t.includes("server_ste_metadata"))) {
                try { scanObject(JSON.parse(t), depth + 1, seen); } catch {}
            }
            return;
        }
        if (typeof obj !== "object" || seen.has(obj)) return;
        seen.add(obj);

        if (obj.type === "server_ste_metadata" && obj.metadata) applyServerMetadata(obj.metadata);
        if (obj.server_ste_metadata && typeof obj.server_ste_metadata === "object") applyServerMetadata(obj.server_ste_metadata);
        if (obj.turn_analytics?.server_ste_metadata) applyServerMetadata(obj.turn_analytics.server_ste_metadata);

        for (const val of Object.values(obj)) {
            scanObject(val, depth + 1, seen);
        }
    }

    function parseJSONCandidate(text) {
        if (!text) return;
        const val = text.trim();
        if (!val || val === "[DONE]") return;
        try { scanObject(JSON.parse(val)); } catch {}
    }

    function scanWholeText(text) {
        if (!text || typeof text !== "string") return;
        try { scanObject(JSON.parse(text)); } catch {}
        for (let line of text.split(/\r?\n/)) {
            line = line.trim();
            if (line.startsWith("data:")) line = line.slice(5).trim();
            parseJSONCandidate(line);
        }
    }

    async function watchStream(response) {
        if (!response?.body) {
            try { scanWholeText(await response.text()); } catch {}
            return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventData = [];

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buffer.indexOf("\n")) !== -1) {
                    let line = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 1);
                    if (line.endsWith("\r")) line = line.slice(0, -1);
                    if (line === "") {
                        if (eventData.length) {
                            parseJSONCandidate(eventData.join("\n"));
                            eventData = [];
                        }
                        continue;
                    }
                    if (line.startsWith("data:")) {
                        eventData.push(line.slice(5).trimStart());
                        continue;
                    }
                    const trimmed = line.trim();
                    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                        parseJSONCandidate(trimmed);
                    }
                }
            }
        } catch {}
    }

    async function bodyToText(body) {
        try {
            if (body == null) return "";
            if (typeof body === "string") return body;
            if (body instanceof Blob) return await body.text();
            if (body instanceof URLSearchParams) return body.toString();
            if (body instanceof FormData) {
                const values = [];
                for (const [key, value] of body.entries()) {
                    values.push(`${key}=${typeof value === "string" ? value : "[blob]"}`);
                }
                return values.join("&");
            }
            if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
            if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body);
        } catch {}
        return "";
    }

    async function getRequestText(input, init) {
        if (init?.body != null) return await bodyToText(init.body);
        if (input instanceof Request) {
            try { return await input.clone().text(); } catch {}
        }
        return "";
    }

    function urlPath(url) {
        try { return new URL(String(url || ""), location.href).pathname; } catch { return String(url || "").split("?")[0]; }
    }

    const isConversation = (u, m) => {
        if (m !== "POST") return false;
        const path = urlPath(u);
        return /\/backend-api\/(?:f\/)?conversation(?:\/|$)/.test(path)
            || /\/conversation(?:\/|$)/.test(path);
    };

    const isTelemetry = (u, m) => {
        if (m !== "POST") return false;
        const path = urlPath(u);
        return /\/ces\/v\d+\/telemetry\/intake(?:\/|$)/.test(path)
            || /\/telemetry\/intake(?:\/|$)/.test(path);
    };

    window.fetch = async function(input, init = {}) {
        const url = typeof input === "string" ? input : input?.url || "";
        const method = String(init.method || input?.method || "GET").toUpperCase();

        if (isConversation(url, method) || isTelemetry(url, method)) {
            const text = await getRequestText(input, init);
            if (isConversation(url, method)) {
                try { beginOrUpdateTurn(JSON.parse(text)); } catch {}
            } else {
                scanWholeText(text);
            }
        }

        const response = await nativeFetch(input, init);

        if (isConversation(url, method)) {
            try { watchStream(response.clone()); } catch {}
        }

        return response;
    };

    NativeXHR.prototype.open = function(method, url, ...rest) {
        this.__rcMethod = String(method || "GET").toUpperCase();
        this.__rcUrl = String(url || "");
        return nativeXHROpen.call(this, method, url, ...rest);
    };

    NativeXHR.prototype.send = function(body) {
        const url = this.__rcUrl || "";
        const method = this.__rcMethod || "GET";

        bodyToText(body).then(text => {
            if (isConversation(url, method)) {
                try { beginOrUpdateTurn(JSON.parse(text)); } catch {}
            } else if (isTelemetry(url, method)) {
                scanWholeText(text);
            }
        });

        if (isConversation(url, method) || isTelemetry(url, method)) {
            this.addEventListener("load", () => {
                try {
                    if (!this.responseType || this.responseType === "text") scanWholeText(this.responseText);
                    else if (this.responseType === "json") scanObject(this.response);
                } catch {}
            });
        }

        return nativeXHRSend.call(this, body);
    };

    if (nativeBeacon) {
        try {
            navigator.sendBeacon = function(url, data) {
                const method = "POST";
                if (isConversation(url, method) || isTelemetry(url, method)) {
                    bodyToText(data).then(text => {
                        if (isConversation(url, method)) {
                            try { beginOrUpdateTurn(JSON.parse(text)); } catch { scanWholeText(text); }
                        } else {
                            scanWholeText(text);
                        }
                    });
                }
                return nativeBeacon(url, data);
            };
        } catch {}
    }

    if (NativeWebSocket) {
        try {
            window.WebSocket = class RouteCheckerWebSocket extends NativeWebSocket {
                constructor(...args) {
                    super(...args);
                    this.addEventListener("message", event => {
                        bodyToText(event.data).then(scanWholeText);
                    });
                }

                send(data) {
                    bodyToText(data).then(scanWholeText);
                    return super.send(data);
                }
            };
        } catch {}
    }

    render();
    requestAnimationFrame(restorePanelPosition);
    console.log(`ChatGPT Route Checker v${VERSION} 已启动`);
})();
