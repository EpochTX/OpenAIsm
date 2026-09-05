// ==UserScript==
// @name         ChatGPT  Checker 
// @namespace    https://chatgpt.com/
// @version      1.0.0
// @description  显示 ChatGPT 请求模型、服务端回复模型标注及路由是否一致
// @author       EpochTX
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// ==/UserScript==

(() => {
    "use strict";

    const VERSION = "v5";

    if (window.__CHATGPT_ROUTE_CHECKER_V5__) {
        console.log(`ChatGPT Route Checker ${VERSION} 已在运行`);
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
        startedAt: null
    };

    const oldPanel = document.getElementById(
        "__chatgpt_route_checker_panel__"
    );

    if (oldPanel) oldPanel.remove();

    const panel = document.createElement("div");
    panel.id = "__chatgpt_route_checker_panel__";

    Object.assign(panel.style, {
        position: "fixed",
        right: "16px",
        bottom: "16px",
        zIndex: "2147483647",
        width: "410px",
        maxWidth: "calc(100vw - 32px)",
        padding: "14px 16px",
        border: "1px solid #444",
        borderRadius: "12px",
        background: "#111",
        color: "#eee",
        font: "13px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
        boxShadow: "0 8px 30px rgba(0,0,0,.4)"
    });

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
            ? esc(value)
            : '<span style="color:#999">搜索中…</span>';
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
        const match = String(slug || "").match(
            /^gpt-(\d+)-(\d+)/i
        );

        return match
            ? `gpt-${match[1]}-${match[2]}`
            : null;
    }

    function verdict() {
        if (!state.active) {
            return "⏳ 等待发送一条新消息";
        }

        if (!state.requestModel) {
            return "🔎 正在读取请求信息…";
        }

        if (!state.serverModel) {
            return "🧠 正在等待服务端模型标注…";
        }

        if (state.requestModel === state.serverModel) {
            return "✅ 请求模型与服务端模型标注一致";
        }

        const requestFamily = modelFamily(state.requestModel);
        const serverFamily = modelFamily(state.serverModel);

        if (
            requestFamily &&
            serverFamily &&
            requestFamily === serverFamily
        ) {
            return "✅ 同一模型系列（内部 slug 不同）";
        }

        return "🚨 请求模型与服务端模型标注不一致";
    }

    function render() {
        refreshDomModel();

        panel.innerHTML = `
            <div style="
                font-weight:700;
                font-size:14px;
                margin-bottom:8px
            ">
                ChatGPT Route Checker ${VERSION}
            </div>

            <div style="margin-bottom:10px">
                ${verdict()}
            </div>

            <div style="
                border-top:1px solid #333;
                border-bottom:1px solid #333;
                padding:10px 0;
                margin-bottom:10px
            ">
                <div style="color:#aaa">
                    服务端回复模型标注
                </div>

                <div style="
                    font-size:18px;
                    font-weight:700;
                    margin-top:2px
                ">
                    ${pending(state.serverModel)}
                </div>

                <div style="
                    color:#777;
                    font-size:11px;
                    margin-top:2px
                ">
                    server_ste_metadata.model_slug
                </div>
            </div>

            <div>
                request.model：
                <b>${pending(state.requestModel)}</b>

                <br>

                request.thinking_effort：
                <b>${pending(state.thinkingEffort)}</b>

                <br><br>

                server_ste_metadata.model_slug：
                <b>${pending(state.serverModel)}</b>

                <br>

                assistant metadata.model_slug：
                <b>${pending(state.assistantModel)}</b>

                <br>

                resolved_model_slug：
                <b>${pending(state.resolvedModel)}</b>

                <br>

                requested_model_experience：
                <b>${pending(state.requestedExperience)}</b>

                <br>

                DOM data-message-model-slug：
                <b>${pending(state.domModel)}</b>
            </div>

            <div style="
                border-top:1px solid #333;
                margin-top:10px;
                padding-top:7px;
                color:#777;
                font-size:11px
            ">
                主判断：server_ste_metadata.model_slug
            </div>
        `;
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

                buffer += decoder.decode(value, {
                    stream: true
                });

                let newlineIndex;

                while (
                    (
                        newlineIndex =
                            buffer.indexOf("\n")
                    ) !== -1
                ) {
                    let line = buffer.slice(
                        0,
                        newlineIndex
                    );

                    buffer = buffer.slice(
                        newlineIndex + 1
                    );

                    if (line.endsWith("\r")) {
                        line = line.slice(0, -1);
                    }

                    if (line === "") {
                        if (eventData.length) {
                            parseJSONCandidate(
                                eventData.join("\n")
                            );

                            eventData = [];
                        }

                        continue;
                    }

                    if (line.startsWith("data:")) {
                        eventData.push(
                            line.slice(5).trimStart()
                        );

                        continue;
                    }

                    const trimmed = line.trim();

                    if (
                        trimmed.startsWith("{") ||
                        trimmed.startsWith("[")
                    ) {
                        parseJSONCandidate(trimmed);
                    }
                }
            }

            buffer += decoder.decode();

            if (buffer.trim()) {
                const rest = buffer.trim();

                if (rest.startsWith("data:")) {
                    eventData.push(
                        rest.slice(5).trimStart()
                    );
                } else {
                    parseJSONCandidate(rest);
                }
            }

            if (eventData.length) {
                parseJSONCandidate(
                    eventData.join("\n")
                );
            }
        } catch (error) {
            console.debug(
                "[Route Checker] stream:",
                error
            );
        }
    }

    async function bodyToText(body) {
        try {
            if (body == null) return "";

            if (typeof body === "string") {
                return body;
            }

            if (body instanceof Blob) {
                return await body.text();
            }

            if (body instanceof URLSearchParams) {
                return body.toString();
            }

            if (body instanceof ArrayBuffer) {
                return new TextDecoder().decode(body);
            }

            if (ArrayBuffer.isView(body)) {
                return new TextDecoder().decode(body);
            }
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
            /\/backend-api\/f\/conversation(?:\?|$)/
                .test(url)
        );
    }

    function isTelemetry(url, method) {
        return (
            method === "POST" &&
            /\/ces\/v1\/telemetry\/intake(?:\?|$)/
                .test(url)
        );
    }

    window.fetch = async function(input, init = {}) {
        const url =
            typeof input === "string"
                ? input
                : input?.url || "";

        const method = String(
            init.method ||
            input?.method ||
            "GET"
        ).toUpperCase();

        let requestText = "";

        if (
            isConversation(url, method) ||
            isTelemetry(url, method)
        ) {
            requestText = await getRequestText(
                input,
                init
            );
        }

        if (isConversation(url, method)) {
            try {
                beginOrUpdateTurn(
                    JSON.parse(requestText)
                );
            } catch {}
        }

        if (isTelemetry(url, method)) {
            scanWholeText(requestText);
        }

        const response = await nativeFetch(
            input,
            init
        );

        if (isConversation(url, method)) {
            try {
                watchStream(response.clone());
            } catch {}
        }

        return response;
    };

    NativeXHR.prototype.open = function(
        method,
        url,
        ...rest
    ) {
        this.__routeCheckerMethod = String(
            method || "GET"
        ).toUpperCase();

        this.__routeCheckerUrl = String(url || "");

        return nativeXHROpen.call(
            this,
            method,
            url,
            ...rest
        );
    };

    NativeXHR.prototype.send = function(body) {
        const url = this.__routeCheckerUrl || "";

        const method =
            this.__routeCheckerMethod || "GET";

        bodyToText(body).then(text => {
            if (isConversation(url, method)) {
                try {
                    beginOrUpdateTurn(
                        JSON.parse(text)
                    );
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
                            scanWholeText(
                                this.responseText
                            );
                        }
                    } catch {}
                },
                {
                    once: true
                }
            );
        }

        return nativeXHRSend.call(this, body);
    };

    if (nativeBeacon) {
        try {
            navigator.sendBeacon = function(
                url,
                data
            ) {
                const target = String(url || "");

                if (
                    /\/ces\/v1\/telemetry\/intake(?:\?|$)/
                        .test(target)
                ) {
                    bodyToText(data).then(
                        scanWholeText
                    );
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
            document.addEventListener(
                "DOMContentLoaded",
                startObserver,
                {
                    once: true
                }
            );

            return;
        }

        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [
                "data-message-model-slug"
            ]
        });
    }

    startObserver();
    render();

    window.__CHATGPT_ROUTE_CHECK_STATE__ =
        state;

    console.log(
        `ChatGPT Route Checker ${VERSION} 已启动`
    );
})();
