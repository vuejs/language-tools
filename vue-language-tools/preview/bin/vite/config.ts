// @ts-nocheck
import config from {CONFIG_PATH};

if (!config.plugins)
	config.plugins = [];

const installCode = `
function __createAppProxy(...args) {

    const app = createApp(...args);

    const ws = new WebSocket('ws://localhost:56789');
    const finderApis = installGoToCode();
    const highlightApis = installSelectionHighlight();

    app.config.globalProperties.$volar = {
        ...finderApis,
        ...highlightApis,
    };

    var href = '';
    setInterval(function () {
        if (href !== location.href) {
            href = location.href;
            parent.postMessage({ command: 'urlChanged', data: href }, '*');
        }
    }, 200);

    return app;

    function installSelectionHighlight() {

        let selection;
        let updateTimeout;
        const nodes = new Map();
        const cursorInOverlays = new Map();
        const rangeCoverOverlays = new Map();
		const cursorInResizeObserver = new ResizeObserver(scheduleUpdate);
		const rangeCoverResizeObserver = new ResizeObserver(scheduleUpdate);

        window.addEventListener('scroll', scheduleUpdate);

        ws.addEventListener('message', event => {
            const data = JSON.parse(event.data);
            if (data?.command === 'highlightSelections') {
                selection = data.data;
                updateHighlights();
            }
        });

        return {
            vnodeMounted,
            vnodeUnmounted,
        };

        function vnodeMounted(node, fileName, range) {
            if (node instanceof Element) {
                nodes.set(node, {
                    fileName,
                    range,
                });
				scheduleUpdate();
            }
        }
        function vnodeUnmounted(node) {
            if (node instanceof Element) {
                nodes.delete(node);
				scheduleUpdate();
            }
        }
        function scheduleUpdate() {
            if (updateTimeout === undefined) {
                updateTimeout = setTimeout(() => {
                    updateHighlights();
                    updateTimeout = undefined;
                }, 0);
            }
        }
        function updateHighlights() {

            if (selection?.isDirty) {
                for (const [_, overlay] of cursorInOverlays) {
                    overlay.style.opacity = '0.5';
                }
                for (const [_, overlay] of rangeCoverOverlays) {
                    overlay.style.opacity = '0.5';
                }
                return;
            }
            else {
                for (const [_, overlay] of cursorInOverlays) {
                    overlay.style.opacity = '1';
                }
                for (const [_, overlay] of rangeCoverOverlays) {
                    overlay.style.opacity = '1';
                }
            }

            const cursorIn = new Set();
            const rangeConver = new Set();

            if (selection) {
                for (const range of selection.ranges) {
                    for (const [el, loc] of nodes) {
                        if (loc.fileName === selection.fileName) {
                            if (range.start <= loc.range[0] && range.end >= loc.range[1]) {
                                rangeConver.add(el);
                            }
                            else if (
                                range.start >= loc.range[0] && range.start <= loc.range[1]
                                || range.end >= loc.range[0] && range.end <= loc.range[1]
                            ) {
                                cursorIn.add(el);
                            }
                        }
                    }
                }
            }

            for (const [el, overlay] of [...cursorInOverlays]) {
                if (!cursorIn.has(el)) {
                    overlay.remove();
                    cursorInOverlays.delete(el);
					cursorInResizeObserver.disconnect(el);
                }
            }
            for (const [el, overlay] of [...rangeCoverOverlays]) {
                if (!rangeConver.has(el)) {
                    overlay.remove();
                    rangeCoverOverlays.delete(el);
					rangeCoverResizeObserver.disconnect(el);
                }
            }

            for (const el of cursorIn) {
                let overlay = cursorInOverlays.get(el);
                if (!overlay) {
                    overlay = createCursorInOverlay();
                    cursorInOverlays.set(el, overlay);
					cursorInResizeObserver.observe(el);
                }
                const rect = el.getBoundingClientRect();
                overlay.style.width = ~~rect.width + 'px';
                overlay.style.height = ~~rect.height + 'px';
                overlay.style.top = ~~rect.top + 'px';
                overlay.style.left = ~~rect.left + 'px';
            }
            for (const el of rangeConver) {
                let overlay = rangeCoverOverlays.get(el);
                if (!overlay) {
                    overlay = createRangeCoverOverlay();
                    rangeCoverOverlays.set(el, overlay);
					rangeCoverResizeObserver.observe(el);
                }
                const rect = el.getBoundingClientRect();
                overlay.style.width = ~~rect.width + 'px';
                overlay.style.height = ~~rect.height + 'px';
                overlay.style.top = ~~rect.top + 'px';
                overlay.style.left = ~~rect.left + 'px';
            }
        }
        function createCursorInOverlay() {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.zIndex = '99999999999999';
            overlay.style.pointerEvents = 'none';
            overlay.style.borderRadius = '3px';
            overlay.style.borderStyle = 'dashed';
            overlay.style.borderColor = 'rgb(196, 105, 183)';
            overlay.style.borderWidth = '1px';
            overlay.style.boxSizing = 'border-box';
            document.body.appendChild(overlay);
            return overlay;
        }
        function createRangeCoverOverlay() {
            const overlay = createCursorInOverlay();
            overlay.style.backgroundColor = 'rgba(196, 105, 183, 0.1)';
            return overlay;
        }
    }
    function installGoToCode() {
        window.addEventListener('scroll', updateOverlay);
        window.addEventListener('pointerdown', function (ev) {
            disable(true);
        });
        window.addEventListener('keydown', event => {
            if (event.key === 'Alt') {
                enable();
            }
        });
        window.addEventListener('keyup', event => {
            if (event.key === 'Alt') {
                disable(false);
            }
        });

        ws.addEventListener('message', event => {
            const data = JSON.parse(event.data);
            if (data?.command === 'openFile') {
                window.open(data.data);
            }
        });

        var overlay = createOverlay();
        var clickMask = createClickMask();
        var highlightNodes = [];
        var enabled = false;
        var lastCodeLoc;

        return {
            highlight,
            unHighlight,
        };

        function enable() {
            enabled = true;
            clickMask.style.pointerEvents = 'none';
            document.body.appendChild(clickMask);
            updateOverlay();
        }
        function disable(openEditor) {
            if (enabled) {
                enabled = false;
                clickMask.style.pointerEvents = '';
                highlightNodes = [];
                updateOverlay();
                if (lastCodeLoc) {
                    ws.send(JSON.stringify(lastCodeLoc));
                    if (openEditor) {
                        ws.send(JSON.stringify({
                            command: 'requestOpenFile',
                            data: lastCodeLoc.data,
                        }));
                    }
                    lastCodeLoc = undefined;
                }
            }
        }
        function goToTemplate(fileName, range) {
            if (!enabled)
                return;
            lastCodeLoc = {
                command: 'goToTemplate',
                data: {
                    fileName: fileName,
                    range,
                },
            };
            ws.send(JSON.stringify(lastCodeLoc));
        }
        function highlight(node, fileName, range) {
            if (node instanceof Element) {
                highlightNodes.push([node, fileName, range]);
            }
            updateOverlay();
        }
        function unHighlight(node) {
            highlightNodes = highlightNodes.filter(function (hNode) { return hNode[0] !== node; });
            updateOverlay();
        }
        function createOverlay() {
            var overlay = document.createElement('div');
            overlay.style.backgroundColor = 'rgba(65, 184, 131, 0.35)';
            overlay.style.position = 'fixed';
            overlay.style.zIndex = '99999999999999';
            overlay.style.pointerEvents = 'none';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.borderRadius = '3px';
            return overlay;
        }
        function createClickMask() {
            var overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.zIndex = '99999999999999';
            overlay.style.pointerEvents = 'none';
            overlay.style.display = 'flex';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.top = '0';
            overlay.style.bottom = '0';
            overlay.addEventListener('pointerup', function () {
                var _a;
                if (overlay.parentNode) {
                    (_a = overlay.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(overlay);
                }
            });
            return overlay;
        }
        function updateOverlay() {
            if (enabled && highlightNodes.length) {
                document.body.appendChild(overlay);
                var highlight_1 = highlightNodes[highlightNodes.length - 1];
                var highlightNode = highlight_1[0];
                var rect = highlightNode.getBoundingClientRect();
                overlay.style.width = ~~rect.width + 'px';
                overlay.style.height = ~~rect.height + 'px';
                overlay.style.top = ~~rect.top + 'px';
                overlay.style.left = ~~rect.left + 'px';
                goToTemplate(highlight_1[1], highlight_1[2]);
            }
            else if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }
    }
}
`;

config.plugins.push({
	name: '__volar_preview',
	transform(this, code, id, options?) {
		const createAppText = 'createApp,';
		if (id.indexOf('/vue.js?') >= 0 && code.indexOf(createAppText) >= 0 && code.indexOf('__createAppProxy') === -1) {
			const createAppOffset = code.lastIndexOf(createAppText);
			code =
				code.substring(0, createAppOffset)
				+ '__createAppProxy as createApp,'
				+ code.substring(createAppOffset + createAppText.length)
				+ `${installCode}`;
		}
		return code;
	},
});

export default config;
