import type * as ts from 'typescript/lib/tsserverlibrary';
import * as useHtmlFilePlugin from './plugins/file-html';
import * as useMdFilePlugin from './plugins/file-md';
import * as useVueFilePlugin from './plugins/file-vue';
import * as useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import * as useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import * as useVueSfcStyles from './plugins/vue-sfc-styles';
import * as useVueSfcTemplate from './plugins/vue-sfc-template';
import * as useHtmlPlugin from './plugins/vue-template-html';
import useVueTsx from './plugins/vue-tsx';
import { VueLanguagePlugin } from './types';
import { VueCompilerOptions } from './types';
import { resolveVueCompilerOptions } from './utils/ts';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from './utils/vue2TemplateCompiler';

export function getDefaultVueLanguagePlugins(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	rootDir: string,
	compilerOptions: ts.CompilerOptions,
	_vueCompilerOptions: VueCompilerOptions,
	extraPlugins: VueLanguagePlugin[] = [],
	pluginOptions: Record<string, Record<string, unknown>> = {},
) {

	const _plugins: VueLanguagePlugin[] = [
		useVueFilePlugin,
		useMdFilePlugin,
		useHtmlFilePlugin,
		useHtmlPlugin,
		useVueSfcStyles,
		useVueSfcCustomBlocks,
		useVueSfcScriptsFormat,
		useVueSfcTemplate,
		useVueTsx,
		...extraPlugins,
	];
	const pluginPaths = new Map<number, string>();
	const vueCompilerOptions = resolveVueCompilerOptions(_vueCompilerOptions);
	if (typeof require?.resolve === 'function') {
		for (const pluginPath of vueCompilerOptions.plugins) {
			try {
				const importPath = require.resolve(pluginPath, { paths: [rootDir] });
				const plugin = require(importPath);
				pluginPaths.set(_plugins.length, pluginPath);
				_plugins.push(plugin);
			}
			catch (error) {
				console.log('Load plugin failed', pluginPath, error);
			}
		}
	}
	else {
		console.log('vueCompilerOptions.plugins is not available in Web.');
	}
	const pluginCtx: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			'@vue/compiler-dom': vueCompilerOptions.target < 3 ? CompilerVue2 : CompilerDOM,
			typescript: ts,
		},
		compilerOptions,
		vueCompilerOptions,
		pluginOptions
	};
	const plugins = _plugins.map(plugin => plugin(pluginCtx)).sort((a, b) => {
		const aOrder = a.order ?? 0;
		const bOrder = b.order ?? 0;
		return aOrder - bOrder;
	});

	return plugins.filter((plugin, i) => {
		const valid = plugin.version >= 1 && plugin.version < 2;
		if (!valid) {
			console.warn(`Plugin ${JSON.stringify(pluginPaths.get(i) ?? plugin.name)} API version incompatible, expected 1.x but got ${JSON.stringify(plugin.version)}`);
		}
		return valid;
	});
}
