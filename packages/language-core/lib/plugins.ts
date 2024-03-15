import useHtmlFilePlugin from './plugins/file-html';
import useMdFilePlugin from './plugins/file-md';
import useVueFilePlugin from './plugins/file-vue';
import useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import useVueSfcStyles from './plugins/vue-sfc-styles';
import useVueSfcTemplate from './plugins/vue-sfc-template';
import useHtmlTemplatePlugin from './plugins/vue-template-html';
import useVueTsx from './plugins/vue-tsx';
import { pluginVersion, type VueLanguagePlugin } from './types';

export function getDefaultVueLanguagePlugins(pluginContext: Parameters<VueLanguagePlugin>[0]) {

	const plugins: VueLanguagePlugin[] = [
		useMdFilePlugin, // .md for VitePress
		useHtmlFilePlugin, // .html for PetiteVue
		useVueFilePlugin, // .vue and others for Vue
		useHtmlTemplatePlugin,
		useVueSfcStyles,
		useVueSfcCustomBlocks,
		useVueSfcScriptsFormat,
		useVueSfcTemplate,
		useVueTsx,
		...pluginContext.vueCompilerOptions.plugins,
	];

	const pluginInstances = plugins
		.map(plugin => {
			try {
				return plugin(pluginContext);
			} catch (err) {
				console.warn('[Vue] Failed to create plugin', err);
			}
		})
		.filter((plugin): plugin is ReturnType<VueLanguagePlugin> => !!plugin)
		.sort((a, b) => {
			const aOrder = a.order ?? 0;
			const bOrder = b.order ?? 0;
			return aOrder - bOrder;
		});

	return pluginInstances.filter(plugin => {
		const valid = plugin.version === pluginVersion;
		if (!valid) {
			console.warn(`[Vue] Plugin ${JSON.stringify(plugin.name)} API version incompatible, expected ${JSON.stringify(pluginVersion)} but got ${JSON.stringify(plugin.version)}`);
		}
		return valid;
	});
}
