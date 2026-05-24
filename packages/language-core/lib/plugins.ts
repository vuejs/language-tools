import useHtmlFilePlugin from './plugins/file-html';
import useMdFilePlugin from './plugins/file-md';
import useVueFilePlugin from './plugins/file-vue';
import vueRootTagsPlugin from './plugins/vue-root-tags';
import vueScriptJsPlugin from './plugins/vue-script-js';
import vueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import vueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import vueSfcStyles from './plugins/vue-sfc-styles';
import vueSfcTemplate from './plugins/vue-sfc-template';
import vueStyleCss from './plugins/vue-style-css';
import vueTemplateHtmlPlugin from './plugins/vue-template-html';
import vueTemplateInlineCssPlugin from './plugins/vue-template-inline-css';
import vueTemplateInlineTsPlugin from './plugins/vue-template-inline-ts';
import vueTsx from './plugins/vue-tsx';
import { validVersions, type VueLanguagePlugin } from './types';

export * from './plugins/shared';

export function createPlugins(pluginContext: Parameters<VueLanguagePlugin>[0]) {
	const plugins: VueLanguagePlugin[] = [
		useVueFilePlugin,
		useMdFilePlugin,
		useHtmlFilePlugin,
		vueRootTagsPlugin,
		vueTsx,
		vueScriptJsPlugin,
		vueStyleCss,
		vueTemplateHtmlPlugin,
		vueTemplateInlineCssPlugin,
		vueTemplateInlineTsPlugin,
		vueSfcStyles,
		vueSfcCustomBlocks,
		vueSfcScriptsFormat,
		vueSfcTemplate,
		...pluginContext.vueCompilerOptions.plugins,
	];

	const pluginInstances = plugins
		.flatMap(plugin => {
			try {
				const moduleConfig = (plugin as any).__moduleConfig ?? {};
				const instance = plugin({ ...pluginContext, config: moduleConfig });
				if (Array.isArray(instance)) {
					for (let i = 0; i < instance.length; i++) {
						instance[i]!.name ??= `${moduleConfig.name} (${i})`;
					}
				}
				else {
					instance.name ??= moduleConfig.name;
				}
				return instance;
			}
			catch (err) {
				console.warn('[Vue] Failed to create plugin', err);
			}
		})
		.filter(plugin => !!plugin)
		.sort((a, b) => {
			const aOrder = a.order ?? 0;
			const bOrder = b.order ?? 0;
			return aOrder - bOrder;
		});

	return pluginInstances.filter(plugin => {
		if (!validVersions.includes(plugin.version)) {
			console.warn(
				`[Vue] Plugin ${plugin.name} is not compatible with the current Vue language tools version. (version: ${plugin.version}, supported versions: ${
					JSON.stringify(validVersions)
				})`,
			);
			return false;
		}
		return true;
	});
}
