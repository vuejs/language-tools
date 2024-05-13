import vueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import vueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import vueSfcStyles from './plugins/vue-sfc-styles';
import vueSfcTemplate from './plugins/vue-sfc-template';
import vueScriptJsPlugin from './plugins/vue-script-js';
import vueTemplateHtmlPlugin from './plugins/vue-template-html';
import vueTemplateInlineCssPlugin from './plugins/vue-template-inline-css';
import vueTemplateInlineTsPlugin from './plugins/vue-template-inline-ts';
import vueTsx from './plugins/vue-tsx';
import { pluginVersion, type VueLanguagePlugin } from './types';

export * from './plugins/shared'

export function getBasePlugins(pluginContext: Parameters<VueLanguagePlugin>[0]) {

	const plugins: VueLanguagePlugin[] = [
		vueScriptJsPlugin,
		vueTemplateHtmlPlugin,
		vueTemplateInlineCssPlugin,
		vueTemplateInlineTsPlugin,
		vueSfcStyles,
		vueSfcCustomBlocks,
		vueSfcScriptsFormat,
		vueSfcTemplate,
		vueTsx,
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
