import type { Plugin, App } from '@vue/runtime-core';
import { defineComponent, defineAsyncComponent, h, ref, computed } from 'vue';

export const vuePlugin: Plugin = app => {
	installFinder(app);
	installPreview(app);
};

function installFinder(app: App) {

	window.addEventListener('scroll', updateOverlay);
	window.addEventListener('message', event => {
		if (event.data?.command === 'selectElement') {
			enabled = true;
		}
	});
	window.addEventListener('click', (ev) => {
		if (enabled) {
			ev.preventDefault(); // TODO: not working
			enabled = false;
			unHighlight();
			if (lastGotoData) {
				parent.postMessage(lastGotoData, '*');
				lastGotoData = undefined;
			}
		}
	});

	const overlay = createOverlay();
	let highlightNode: HTMLElement | undefined;
	let enabled = false;
	let lastGotoData: any | undefined;

	app.config.globalProperties.$volar = {
		goToTemplate,
		highlight,
		unHighlight,
	};

	function goToTemplate(fileName: string, range: string) {
		if (!enabled) return;
		lastGotoData = {
			command: 'goToTemplate',
			data: {
				fileName,
				range: JSON.parse(range),
			},
		};
		parent.postMessage(lastGotoData, '*');
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

function installPreview(app: App) {
	if (location.pathname === '/__preview') {
		const preview = defineComponent({
			setup() {
				window.addEventListener('message', event => {
					if (event.data?.command === 'updateUrl') {
						url.value = new URL(event.data.data);
						file.value = url.value.hash.substr(1);
					}
				});
				const url = ref(new URL(location.href));
				const file = ref(url.value.hash.substr(1));
				const target = computed(() => defineAsyncComponent(() => import(file.value))); // TODO: responsive not working
				const props = computed(() => {
					const _props: Record<string, any> = {};
					url.value.searchParams.forEach((value, key) => {
						_props[key] = JSON.parse(value);
					});
					return _props;
				});
				return () => h(target.value, props.value);
			},
		});
		// TODO: fix preview not working is preview component is root component
		(app._component as any).setup = preview.setup;

		app.config.warnHandler = (msg) => {
			window.parent.postMessage({
				command: 'warn',
				data: msg,
			}, '*');
			console.warn(msg);
		};
		app.config.errorHandler = (msg) => {
			window.parent.postMessage({
				command: 'error',
				data: msg,
			}, '*');
			console.error(msg);
		};
		// TODO: post emit
	}
}
