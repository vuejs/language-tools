import type { Plugin } from '@vue/runtime-core';
import type VitePlugin from '@vitejs/plugin-vue';

export const vuePlugin: Plugin = {
    install(app) {

        window.addEventListener('scroll', updateOverlay);
        window.addEventListener('message', event => {
            if (event.data?.command === 'selectElement') {
                enabled = true;
            }
        });
        window.addEventListener('click', () => {
            enabled = false;
            unHighlight();
        });

        const overlay = createOverlay();
        let highlightNode: HTMLElement | undefined;
        let enabled = false;

        app.config.globalProperties.$volar = {
            goToTemplate,
            highlight,
            unHighlight,
        };

        function goToTemplate(fileName: string, range: string) {
            if (!enabled) return;
            parent.postMessage({
                command: 'goToTemplate',
                data: {
                    fileName,
                    range: JSON.parse(range),
                },
            }, '*');
        }
        function highlight(node: HTMLElement) {
            if (!enabled) return;
            highlightNode = node;
            document.body.appendChild(overlay);
            updateOverlay();
        }
        function unHighlight() {
            highlightNode = undefined;
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay)
            }
        }
        function createOverlay() {
            const overlay = document.createElement('div');
            overlay.style.backgroundColor = 'rgba(145, 184, 226, 0.35)';
            overlay.style.position = 'fixed';
            overlay.style.zIndex = '99999999999999';
            overlay.style.pointerEvents = 'none';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.borderRadius = '3px';
            return overlay;
        }
        function updateOverlay() {
            if (!highlightNode) return;
            const rect = highlightNode.getBoundingClientRect();
            overlay.style.width = ~~rect.width + 'px';
            overlay.style.height = ~~rect.height + 'px';
            overlay.style.top = ~~rect.top + 'px';
            overlay.style.left = ~~rect.left + 'px';
        }
    }
};
export const vitePluginOptions: NonNullable<Parameters<typeof VitePlugin>[0]> = {
    template: {
        compilerOptions: {
            nodeTransforms: [
                (node, ctx) => {
                    if (node.type === 1) {
                        const { offset: start } = node.loc.start;
                        const { offset: end } = node.loc.end;
                        (node as any).props.push(
                            {
                                type: 6,
                                name: 'data-loc',
                                value: {
                                    content: `[${start},${end}]`,
                                },
                                loc: node.loc,
                            },
                            {
                                type: 7,
                                name: 'on',
                                exp: {
                                    type: 4,
                                    content: '$volar.goToTemplate($.type.__file, $event.target.dataset.loc); $volar.highlight($event.target);',
                                    isStatic: false,
                                    constType: 0,
                                    loc: node.loc,
                                },
                                arg: {
                                    type: 4,
                                    content: 'mouseenter',
                                    isStatic: true,
                                    constType: 3,
                                    loc: node.loc,
                                },
                                modifiers: [],
                                loc: node.loc,
                            },
                            {
                                type: 7,
                                name: 'on',
                                exp: {
                                    type: 4,
                                    content: '$volar.unHighlight()',
                                    isStatic: false,
                                    constType: 0,
                                    loc: node.loc,
                                },
                                arg: {
                                    type: 4,
                                    content: 'mouseleave',
                                    isStatic: true,
                                    constType: 3,
                                    loc: node.loc,
                                },
                                modifiers: [],
                                loc: node.loc,
                            },
                        );
                    }
                }
            ]
        }
    }
}
