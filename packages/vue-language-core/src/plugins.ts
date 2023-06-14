import type * as ts from 'typescript/lib/tsserverlibrary';
import * as useHtmlFilePlugin from './plugins/file-html';
import * as useMdFilePlugin from './plugins/file-md';
import * as useVueFilePlugin from './plugins/file-vue';
import * as useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import * as useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import * as useVueSfcStyles from './plugins/vue-sfc-styles';
import * as useVueSfcTemplate from './plugins/vue-sfc-template';
import * as useHtmlTemplatePlugin from './plugins/vue-template-html';
import useVueTsx from './plugins/vue-tsx';
import { VueCompilerOptions, VueLanguagePlugin } from './types';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from './utils/vue2TemplateCompiler';

export function getDefaultVueLanguagePlugins(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	codegenStack: boolean,
) {

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
		...vueCompilerOptions.plugins,
	];
	const pluginCtx: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			'@vue/compiler-dom': vueCompilerOptions.target < 3 ? CompilerVue2 : CompilerDOM,
			typescript: ts,
		},
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
	};
	const pluginInstances = plugins
		.map(plugin => plugin(pluginCtx))
		.sort((a, b) => {
			const aOrder = a.order ?? 0;
			const bOrder = b.order ?? 0;
			return aOrder - bOrder;
		});

	return pluginInstances.filter((plugin) => {
		const valid = plugin.version >= 1 && plugin.version < 2;
		if (!valid) {
			console.warn(`Plugin ${JSON.stringify(plugin.name)} API version incompatible, expected 1.x but got ${JSON.stringify(plugin.version)}`);
		}
		return valid;
	});
}
