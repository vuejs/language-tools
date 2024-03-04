import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import useHtmlFilePlugin from './plugins/file-html';
import useMdFilePlugin from './plugins/file-md';
import useVueFilePlugin from './plugins/file-vue';
import useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import useVueSfcStyles from './plugins/vue-sfc-styles';
import useVueSfcTemplate from './plugins/vue-sfc-template';
import useHtmlTemplatePlugin from './plugins/vue-template-html';
import useVueTsx from './plugins/vue-tsx';
import { pluginVersion, type VueCompilerOptions, type VueLanguagePlugin } from './types';
import * as CompilerVue2 from './utils/vue2TemplateCompiler';

export function createPluginContext(
	ts: typeof import('typescript'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	codegenStack: boolean,
	globalTypesHolder: string | undefined,
) {
	const pluginCtx: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			'@vue/compiler-dom': vueCompilerOptions.target < 3
				? {
					...CompilerDOM,
					compile: CompilerVue2.compile,
				}
				: CompilerDOM,
			typescript: ts,
		},
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
		globalTypesHolder,
	};
	return pluginCtx;
}

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
		.map(plugin => plugin(pluginContext))
		.sort((a, b) => {
			const aOrder = a.order ?? 0;
			const bOrder = b.order ?? 0;
			return aOrder - bOrder;
		});

	return pluginInstances.filter((plugin) => {
		const valid = plugin.version === pluginVersion;
		if (!valid) {
			console.warn(`Plugin ${JSON.stringify(plugin.name)} API version incompatible, expected ${JSON.stringify(pluginVersion)} but got ${JSON.stringify(plugin.version)}`);
		}
		return valid;
	});
}
