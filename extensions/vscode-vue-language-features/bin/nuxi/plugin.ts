export default defineNuxtPlugin(app => {

    if (process.server)
        return;

    const volar = installFinder();

    let href = '';

    setInterval(function () {
        if (href !== location.href) {
            href = location.href;
            parent.postMessage({ command: 'urlChanged', data: href }, '*');
        }
    }, 200);

    return { provide: { volar } };

    function installFinder() {

        window.addEventListener('scroll', updateOverlay);
        window.addEventListener('message', event => {
            if (event.data?.command === 'selectElement') {
                enabled = true;
                clickMask.style.pointerEvents = 'none';
                document.body.appendChild(clickMask);
                updateOverlay();
            }
        });
        window.addEventListener('mousedown', (ev) => {
            if (enabled) {
                enabled = false;
                clickMask.style.pointerEvents = '';
                highlightNodes = [];
                updateOverlay();
                if (lastCodeLoc) {
                    parent.postMessage(lastCodeLoc, '*');
                    lastCodeLoc = undefined;
                }
            }
        });

        const overlay = createOverlay();
        const clickMask = createClickMask();

        let highlightNodes: [HTMLElement, string, string][] = [];
        let enabled = false;
        let lastCodeLoc: any | undefined;

        return {
            highlight,
            unHighlight,
        };

        function goToTemplate(fileName: string, range: string) {
            if (!enabled) return;
            lastCodeLoc = {
                command: 'goToTemplate',
                data: {
                    fileName,
                    range: JSON.parse(range),
                },
            };
            parent.postMessage(lastCodeLoc, '*');
        }
        function highlight(node: HTMLElement, fileName: string, range: string) {
            if (!enabled) return;
            highlightNodes.push([node, fileName, range]);
            updateOverlay();
        }
        function unHighlight(node: HTMLElement) {
            if (!enabled) return;
            highlightNodes = highlightNodes.filter(hNode => hNode[0] !== node);
            updateOverlay();
        }
        function createOverlay() {
            const overlay = document.createElement('div');
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
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.zIndex = '99999999999999';
            overlay.style.pointerEvents = 'none';
            overlay.style.display = 'flex';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.top = '0';
            overlay.style.bottom = '0';
            overlay.addEventListener('mouseup', () => {
                if (overlay.parentNode) {
                    overlay.parentNode?.removeChild(overlay)
                }
            });
            return overlay;
        }
        function updateOverlay() {
            if (highlightNodes.length) {
                document.body.appendChild(overlay);
                const highlight = highlightNodes[highlightNodes.length - 1];
                const highlightNode = highlight[0];
                const rect = highlightNode.getBoundingClientRect();
                overlay.style.width = ~~rect.width + 'px';
                overlay.style.height = ~~rect.height + 'px';
                overlay.style.top = ~~rect.top + 'px';
                overlay.style.left = ~~rect.left + 'px';
                goToTemplate(highlight[1], highlight[2]);
            }
            else if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay)
            }
        }
    }

    // function installPreview() {
    //     if (location.pathname === '/__preview') {
    //         const preview = defineComponent({
    //             setup() {
    //                 window.addEventListener('message', event => {
    //                     if (event.data?.command === 'updateUrl') {
    //                         url.value = new URL(event.data.data);
    //                         _file.value = url.value.hash.slice(1);
    //                     }
    //                 });
    //                 const url = ref(new URL(location.href));
    //                 const _file = ref(url.value.hash.slice(1));
    //                 const file = computed(() => {
    //                     // fix windows path for vite
    //                     let path = _file.value.replace(/\\/g, '/');
    //                     if (path.indexOf(':') >= 0) {
    //                         path = path.split(':')[1];
    //                     }
    //                     return path;
    //                 });
    //                 const target = computed(() => defineAsyncComponent(() => import(file.value))); // TODO: responsive not working
    //                 const props = computed(() => {
    //                     const _props: Record<string, any> = {};
    //                     url.value.searchParams.forEach((value, key) => {
    //                         eval('_props[key] = ' + value);
    //                     });
    //                     return _props;
    //                 });
    //                 return () => h(Suspense, undefined, [
    //                     h(target.value, props.value)
    //                 ]);
    //             },
    //         });
    //         // TODO: fix preview not working if preview component is root component
    //         (app._component as any).setup = preview.setup;

    //         app.config.warnHandler = (msg) => {
    //             window.parent.postMessage({
    //                 command: 'warn',
    //                 data: msg,
    //             }, '*');
    //             console.warn(msg);
    //         };
    //         app.config.errorHandler = (msg) => {
    //             window.parent.postMessage({
    //                 command: 'error',
    //                 data: msg,
    //             }, '*');
    //             console.error(msg);
    //         };
    //         // TODO: post emit
    //     }
    // }
});
