import useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import useVueSfcStyles from './plugins/vue-sfc-styles';
import useVueSfcTemplate from './plugins/vue-sfc-template';
import useVueTemplateHtmlPlugin from './plugins/vue-template-html';
import useVueTemplateInlineCssPlugin from './plugins/vue-template-inline-css';
import useVueTemplateInlineTsPlugin from './plugins/vue-template-inline-ts';
import useVueTsx from './plugins/vue-tsx';
import { pluginVersion, type VueLanguagePlugin } from './types';

export * from './plugins/shared'

export function getBasePlugins(pluginContext: Parameters<VueLanguagePlugin>[0]) {

	const plugins: VueLanguagePlugin[] = [
		useVueTemplateHtmlPlugin,
		useVueTemplateInlineCssPlugin,
		useVueTemplateInlineTsPlugin,
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
				const instance = plugin(pluginContext);
				instance.name ??= (plugin as any).__moduleName;
				return instance;
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
			console.warn(`[Vue] Plugin ${JSON.stringify(plugin.name)} API version incompatible, expected "${pluginVersion}" but got "${plugin.version}".`);
		}
		return valid;
	});
}
