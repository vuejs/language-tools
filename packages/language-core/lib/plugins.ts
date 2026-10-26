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
import { validVersions, type VueLanguagePlugin, type VueLanguagePluginReturn } from './types';

/** The built-in plugins that build the IR. */
const irPlugins: VueLanguagePlugin[] = [
	vueScriptJsPlugin,
	vueStyleCss,
	vueTemplateHtmlPlugin,
];

/** The built-in plugins that contribute the embedded codes of the language service. */
const embeddedCodePlugins: VueLanguagePlugin[] = [
	vueRootTagsPlugin,
	vueTemplateInlineCssPlugin,
	vueTemplateInlineTsPlugin,
	vueSfcStyles,
	vueSfcCustomBlocks,
	vueSfcScriptsFormat,
	vueSfcTemplate,
];

/** Instances of the built-in IR plugins and of `vueCompilerOptions.plugins`, in their order. */
export function createPlugins(pluginContext: Parameters<VueLanguagePlugin>[0]) {
	return instantiatePlugins([...irPlugins, ...pluginContext.vueCompilerOptions.plugins], pluginContext);
}

/** Instances of the built-in embedded-code plugins, in their order. */
export function createEmbeddedCodePlugins(pluginContext: Parameters<VueLanguagePlugin>[0]) {
	return instantiatePlugins(embeddedCodePlugins, pluginContext);
}

/** `plugins` ordered by their `order`, keeping the given order among equal ones. */
export function sortPlugins(plugins: VueLanguagePluginReturn[]) {
	return plugins.sort((a, b) => {
		const aOrder = a.order ?? 0;
		const bOrder = b.order ?? 0;
		return aOrder - bOrder;
	});
}

function instantiatePlugins(plugins: VueLanguagePlugin[], pluginContext: Parameters<VueLanguagePlugin>[0]) {
	const pluginInstances = sortPlugins(
		plugins
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
			.filter(plugin => !!plugin),
	);

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
