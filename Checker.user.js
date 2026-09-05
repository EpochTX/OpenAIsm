// ==UserScript==
// @name         ChatGPT 降智检测
// @namespace    https://github.com/EpochTX/OpenAIsm
// @version      1.0
// @description  ChatGPT 降智一键检测脚本
// @author       epochtx
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    const VERSION = "1.0";

    if (window.__CHATGPT_ROUTE_CHECKER_V5__) {
        console.log(`ChatGPT Route Checker v${VERSION} 已在运行`);
        return;
    }

    window.__CHATGPT_ROUTE_CHECKER_V5__ = true;

    const nativeFetch = window.fetch.bind(window);
    const NativeXHR = window.XMLHttpRequest;
    const nativeXHROpen = NativeXHR.prototype.open;
    const nativeXHRSend = NativeXHR.prototype.send;

    const nativeBeacon = navigator.sendBeacon
        ? navigator.sendBeacon.bind(navigator)
        : null;

    const state = {
        active: false,
        turnKey: null,
        requestModel: null,
        thinkingEffort: null,
        serverModel: null,
        assistantModel: null,
        resolvedModel: null,
        requestedExperience: null,
        domModel: null,
        startedAt: null,
        isCollapsed: false
    };

    const oldPanel = document.getElementById("__chatgpt_route_checker_panel__");
    if (oldPanel) oldPanel.remove();

    // 注入独立样式表
    const styleEl = document.createElement("style");
    styleEl.id = "__chatgpt_route_checker_style__";
    styleEl.textContent = `
        #__chatgpt_route_checker_panel__ {
            position: fixed;
            right: 18px;
            bottom: 18px;
            z-index: 2147483647;
            width: 390px;
            max-width: calc(100vw - 36px);
            background: rgba(18, 18, 22, 0.88);
            backdrop-filter: blur(14px) saturate(160%);
            -webkit-backdrop-filter: blur(14px) saturate(160%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
            color: #ececed;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", sans-serif;
            box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            overflow: hidden;
            user-select: none;
        }
        #__chatgpt_route_checker_panel__.collapsed {
            width: auto;
            border-radius: 30px;
            cursor: pointer;
        }
        .cg-rc-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            background: rgba(255, 255, 255, 0.02);
        }
        .cg-rc-title {
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.3px;
            display: flex;
            align-items: center;
            gap: 6px;
            color: #f4f4f5;
        }
        .cg-rc-badge {
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            color: #a1a1aa;
            font-family: ui-monospace, Menlo, Consolas, monospace;
        }
        .cg-rc-toggle-btn {
            background: transparent;
            border: none;
            color: #71717a;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            padding: 4px;
            border-radius: 4px;
            transition: color 0.15s, background 0.15s;
        }
        .cg-rc-toggle-btn:hover {
            color: #fafafa;
            background: rgba(255, 255, 255, 0.08);
        }
        .cg-rc-body {
            padding: 12px 14px 14px;
        }
        .cg-rc-card {
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .cg-rc-verdict {
            font-size: 12.5px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 10px;
        }
        .cg-rc-main-model {
            margin-top: 4px;
            font-size: 16px;
            font-weight: 700;
            color: #fff;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            word-break: break-all;
        }
        .cg-rc-label {
            font-size: 11px;
            color: #8e8ea0;
            margin-bottom: 2px;
        }
        .cg-rc-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 11.5px;
        }
        .cg-rc-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 0;
            border-bottom: 1px dashed rgba(255, 255, 255, 0.04);
        }
        .cg-rc-row:last-child {
            border-bottom: none;
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
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: right;
        }
        .cg-rc-status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
        }
    `;
    document.head.appendChild(styleEl);

    const panel = document.createElement("div");
    panel.id = "__chatgpt_route_checker_panel__";
    document.documentElement.appendChild(panel);

    function esc(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function pending(value) {
        return value
            ? `<span style="color:#60a5fa">${esc(value)}</span>`
            : '<span style="color:#6b7280">等待捕获…</span>';
    }

    function refreshDomModel() {
        const nodes = document.querySelectorAll(
            '[data-message-author-role="assistant"]'
        );
        if (!nodes.length) return;

        const slug = nodes[nodes.length - 1].getAttribute(
            "data-message-model-slug"
        );
        if (slug) state.domModel = slug;
    }

    function modelFamily(slug) {
        const match = String(slug || "").match(/^gpt-(\d+)-(\d+)/i);
        return match ? `gpt-${match[1]}-${match[2]}` : null;
    }

    function verdictInfo() {
        if (!state.active) {
            return {
                text: "等待发送新消息…",
                icon: "⏳",
                color: "#9ca3af",
                bg: "rgba(156, 163, 175, 0.08)",
                border: "rgba(156, 163, 175, 0.2)"
            };
        }
        if (!state.requestModel) {
            return {
                text: "正在读取请求信息…",
                icon: "🔎",
                color: "#38bdf8",
                bg: "rgba(56, 189, 248, 0.08)",
                border: "rgba(56, 189, 248, 0.2)"
            };
        }
        if (!state.serverModel) {
            return {
                text: "等待服务端模型标注…",
                icon: "🧠",
                color: "#fbbf24",
                bg: "rgba(251, 191, 36, 0.08)",
                border: "rgba(251, 191, 36, 0.2)"
            };
        }
        if (state.requestModel === state.serverModel) {
            return {
                text: "模型一致（未降智）",
                icon: "✅",
                color: "#34d399",
                bg: "rgba(52, 211, 153, 0.08)",
                border: "rgba(52, 211, 153, 0.2)"
            };
        }

        const requestFamily = modelFamily(state.requestModel);
        const serverFamily = modelFamily(state.serverModel);

        if (
            requestFamily &&
            serverFamily &&
            requestFamily === serverFamily
        ) {
            return {
                text: "同一模型系列（Slug 细分）",
                icon: "✅",
                color: "#34d399",
                bg: "rgba(52, 211, 153, 0.08)",
                border: "rgba(52, 211, 153, 0.2)"
            };
        }

        return {
            text: "模型不一致（疑似降智）",
            icon: "🚨",
            color: "#f87171",
            bg: "rgba(248, 113, 113, 0.12)",
            border: "rgba(248, 113, 113, 0.3)"
        };
    }

    function render() {
        refreshDomModel();
        const v = verdictInfo();

        if (state.isCollapsed) {
            panel.className = "collapsed";
            panel.innerHTML = `
                <div class="cg-rc-status-pill" title="点击展开详细面板">
                    <span>${v.icon}</span>
                    <span style="color:${v.color}; font-family: ui-monospace, monospace;">${esc(state.serverModel || state.requestModel || v.text)}</span>
                </div>
            `;
            panel.onclick = () => {
                state.isCollapsed = false;
                render();
            };
            return;
        }

        panel.className = "";
        panel.onclick = null;
        panel.innerHTML = `
            <div class="cg-rc-header">
                <div class="cg-rc-title">
                    <span>ChatGPT Route Checker</span>
                    <span class="cg-rc-badge">v${VERSION}</span>
                </div>
                <button class="cg-rc-toggle-btn" id="__cg_rc_collapse_btn__" title="收起面板">─</button>
            </div>

            <div class="cg-rc-body">
                <div class="cg-rc-verdict" style="color: ${v.color}; background: ${v.bg}; border: 1px solid ${v.border}; padding: 8px 10px; border-radius: 8px;">
                    <span>${v.icon}</span>
                    <span>${v.text}</span>
                </div>

                <div class="cg-rc-card">
                    <div class="cg-rc-label">服务端回复模型标注 (server_ste_metadata)</div>
                    <div class="cg-rc-main-model">
                        ${state.serverModel ? `<span style="color:#4ade80">${esc(state.serverModel)}</span>` : '<span style="color:#6b7280; font-size:14px;">等待响应…</span>'}
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
                    <div class="cg-rc-row">
                        <span class="cg-rc-row-key">assistant metadata</span>
                        <span class="cg-rc-row-val">${pending(state.assistantModel)}</span>
                    </div>
                    <div class="cg-rc-row">
                        <span class="cg-rc-row-key">resolved_model_slug</span>
                        <span class="cg-rc-row-val">${pending(state.resolvedModel)}</span>
                    </div>
                    <div class="cg-rc-row">
                        <span class="cg-rc-row-key">requested_experience</span>
                        <span class="cg-rc-row-val">${pending(state.requestedExperience)}</span>
                    </div>
                    <div class="cg-rc-row">
                        <span class="cg-rc-row-key">DOM data-slug</span>
                        <span class="cg-rc-row-val">${pending(state.domModel)}</span>
                    </div>
                </div>

                <div style="margin-top: 10px; font-size: 10px; color: #71717a; text-align: right;">
                    判定依据: server_ste_metadata.model_slug
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
    }

    function extractTurnKey(request) {
        try {
            const messages = Array.isArray(request?.messages)
                ? request.messages
                : [];

            for (let index = messages.length - 1; index >= 0; index--) {
                const message = messages[index];
                if (
                    message?.author?.role === "user" &&
                    message?.id
                ) {
                    return message.id;
                }
            }

            if (request?.message?.author?.role === "user") {
                return request.message.id || null;
            }
        } catch {}

        return null;
    }

    function resetTurn(turnKey) {
        state.active = true;
        state.turnKey = turnKey || `turn-${Date.now()}`;
        state.startedAt = Date.now();

        state.serverModel = null;
        state.assistantModel = null;
        state.resolvedModel = null;
        state.requestedExperience = null;
        state.domModel = null;
    }

    function beginOrUpdateTurn(request) {
        const newTurnKey = extractTurnKey(request);

        const isDefinitelyNewTurn =
            newTurnKey &&
            newTurnKey !== state.turnKey;

        if (!state.active) {
            resetTurn(newTurnKey);
        } else if (isDefinitelyNewTurn) {
            resetTurn(newTurnKey);
        }

        if (typeof request?.model === "string") {
            state.requestModel = request.model;
        }

        if (typeof request?.thinking_effort === "string") {
            state.thinkingEffort = request.thinking_effort;
        }

        render();
    }

    function applyServerMetadata(metadata) {
        if (!metadata || typeof metadata !== "object") {
            return;
        }

        if (typeof metadata.model_slug === "string") {
            state.serverModel = metadata.model_slug;
        }

        if (
            typeof metadata.requested_model_experience ===
            "string"
        ) {
            state.requestedExperience =
                metadata.requested_model_experience;
        }

        render();
    }

    function scanObject(
        object,
        depth = 0,
        seen = new WeakSet()
    ) {
        if (object == null || depth > 16) return;

        if (typeof object === "string") {
            const text = object.trim();

            if (
                (
                    text.startsWith("{") ||
                    text.startsWith("[")
                ) &&
                (
                    text.includes("model_slug") ||
                    text.includes("server_ste_metadata") ||
                    text.includes("resolved_model_slug")
                )
            ) {
                try {
                    scanObject(
                        JSON.parse(text),
                        depth + 1,
                        seen
                    );
                } catch {}
            }

            return;
        }

        if (typeof object !== "object") return;
        if (seen.has(object)) return;

        seen.add(object);

        if (
            object.type === "server_ste_metadata" &&
            object.metadata
        ) {
            applyServerMetadata(object.metadata);
        }

        if (
            object.server_ste_metadata &&
            typeof object.server_ste_metadata === "object"
        ) {
            applyServerMetadata(
                object.server_ste_metadata
            );
        }

        if (object.turn_analytics?.server_ste_metadata) {
            applyServerMetadata(
                object.turn_analytics.server_ste_metadata
            );
        }

        if (
            object.author?.role === "assistant" &&
            typeof object.metadata?.model_slug === "string"
        ) {
            state.assistantModel =
                object.metadata.model_slug;
            render();
        }

        if (
            object.message?.author?.role === "assistant" &&
            typeof object.message?.metadata?.model_slug ===
                "string"
        ) {
            state.assistantModel =
                object.message.metadata.model_slug;
            render();
        }

        if (
            typeof object.resolved_model_slug === "string"
        ) {
            state.resolvedModel =
                object.resolved_model_slug;
            render();
        }

        for (const value of Object.values(object)) {
            scanObject(value, depth + 1, seen);
        }
    }

    function parseJSONCandidate(text) {
        if (!text) return;
        const value = text.trim();
        if (!value || value === "[DONE]") return;

        try {
            scanObject(JSON.parse(value));
        } catch {}
    }

    function scanWholeText(text) {
        if (!text || typeof text !== "string") return;

        try {
            scanObject(JSON.parse(text));
        } catch {}

        for (let line of text.split(/\r?\n/)) {
            line = line.trim();
            if (!line) continue;

            if (line.startsWith("data:")) {
                line = line.slice(5).trim();
            }

            parseJSONCandidate(line);
        }
    }

    async function watchStream(response) {
        if (!response?.body) {
            try {
                scanWholeText(await response.text());
            } catch {}
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
                let newlineIndex;

                while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                    let line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);

                    if (line.endsWith("\r")) {
                        line = line.slice(0, -1);
                    }

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

            buffer += decoder.decode();

            if (buffer.trim()) {
                const rest = buffer.trim();
                if (rest.startsWith("data:")) {
                    eventData.push(rest.slice(5).trimStart());
                } else {
                    parseJSONCandidate(rest);
                }
            }

            if (eventData.length) {
                parseJSONCandidate(eventData.join("\n"));
            }
        } catch (error) {
            console.debug("[Route Checker] stream:", error);
        }
    }

    async function bodyToText(body) {
        try {
            if (body == null) return "";
            if (typeof body === "string") return body;
            if (body instanceof Blob) return await body.text();
            if (body instanceof URLSearchParams) return body.toString();
            if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
            if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body);
        } catch {}
        return "";
    }

    async function getRequestText(input, init) {
        if (init?.body != null) {
            return await bodyToText(init.body);
        }

        if (input instanceof Request) {
            try {
                return await input.clone().text();
            } catch {}
        }

        return "";
    }

    function isConversation(url, method) {
        return (
            method === "POST" &&
            /\/backend-api\/f\/conversation(?:\?|$)/.test(url)
        );
    }

    function isTelemetry(url, method) {
        return (
            method === "POST" &&
            /\/ces\/v1\/telemetry\/intake(?:\?|$)/.test(url)
        );
    }

    window.fetch = async function(input, init = {}) {
        const url = typeof input === "string" ? input : input?.url || "";
        const method = String(init.method || input?.method || "GET").toUpperCase();

        let requestText = "";

        if (isConversation(url, method) || isTelemetry(url, method)) {
            requestText = await getRequestText(input, init);
        }

        if (isConversation(url, method)) {
            try {
                beginOrUpdateTurn(JSON.parse(requestText));
            } catch {}
        }

        if (isTelemetry(url, method)) {
            scanWholeText(requestText);
        }

        const response = await nativeFetch(input, init);

        if (isConversation(url, method)) {
            try {
                watchStream(response.clone());
            } catch {}
        }

        return response;
    };

    NativeXHR.prototype.open = function(method, url, ...rest) {
        this.__routeCheckerMethod = String(method || "GET").toUpperCase();
        this.__routeCheckerUrl = String(url || "");
        return nativeXHROpen.call(this, method, url, ...rest);
    };

    NativeXHR.prototype.send = function(body) {
        const url = this.__routeCheckerUrl || "";
        const method = this.__routeCheckerMethod || "GET";

        bodyToText(body).then(text => {
            if (isConversation(url, method)) {
                try {
                    beginOrUpdateTurn(JSON.parse(text));
                } catch {}
            }
            if (isTelemetry(url, method)) {
                scanWholeText(text);
            }
        });

        if (isConversation(url, method)) {
            this.addEventListener(
                "loadend",
                () => {
                    try {
                        if (
                            !this.responseType ||
                            this.responseType === "text"
                        ) {
                            scanWholeText(this.responseText);
                        }
                    } catch {}
                },
                { once: true }
            );
        }

        return nativeXHRSend.call(this, body);
    };

    if (nativeBeacon) {
        try {
            navigator.sendBeacon = function(url, data) {
                const target = String(url || "");
                if (/\/ces\/v1\/telemetry\/intake(?:\?|$)/.test(target)) {
                    bodyToText(data).then(scanWholeText);
                }
                return nativeBeacon(url, data);
            };
        } catch {}
    }

    const observer = new MutationObserver(() => {
        const oldModel = state.domModel;
        refreshDomModel();
        if (oldModel !== state.domModel) {
            render();
        }
    });

    function startObserver() {
        if (!document.body) {
            document.addEventListener("DOMContentLoaded", startObserver, {
                once: true
            });
            return;
        }

        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["data-message-model-slug"]
        });
    }

    startObserver();
    render();

    window.__CHATGPT_ROUTE_CHECK_STATE__ = state;
    console.log(`ChatGPT Route Checker v${VERSION} 已启动`);
})();
