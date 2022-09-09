import type * as ts from 'typescript/lib/tsserverlibrary';
import * as useHtmlFilePlugin from './plugins/file-html';
import * as useMdFilePlugin from './plugins/file-md';
import * as useVueFilePlugin from './plugins/file-vue';
import * as useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import * as useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import * as useVueSfcStyles from './plugins/vue-sfc-styles';
import * as useVueSfcTemplate from './plugins/vue-sfc-template';
import * as useHtmlPlugin from './plugins/vue-template-html';
import * as usePugPlugin from './plugins/vue-template-pug';
import useVueTsx from './plugins/vue-tsx';
import { VueLanguagePlugin } from './types';
import { VueCompilerOptions } from './types';
import { getVueCompilerOptions } from './utils/ts';

export function getDefaultVueLanguagePlugins(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	rootDir: string,
	compilerOptions: ts.CompilerOptions,
	_vueCompilerOptions: VueCompilerOptions,
	extraPlugins: VueLanguagePlugin[] = [],
) {

	const _plugins: VueLanguagePlugin[] = [
		useVueFilePlugin,
		useMdFilePlugin,
		useHtmlFilePlugin,
		useHtmlPlugin,
		usePugPlugin,
		useVueSfcStyles,
		useVueSfcCustomBlocks,
		useVueSfcScriptsFormat,
		useVueSfcTemplate,
		useVueTsx,
		...extraPlugins,
	];
	const vueCompilerOptions = getVueCompilerOptions(_vueCompilerOptions);
	if (typeof require?.resolve === 'function') {
		for (const pluginPath of vueCompilerOptions.plugins) {
			try {
				const importPath = require.resolve(pluginPath, { paths: [rootDir] });
				const plugin = require(importPath);
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
			typescript: ts,
		},
		compilerOptions,
		vueCompilerOptions: vueCompilerOptions,
	};
	const plugins = _plugins.map(plugin => plugin(pluginCtx)).sort((a, b) => {
		const aOrder = a.order ?? 0;
		const bOrder = b.order ?? 0;
		return aOrder - bOrder;
	});

	return plugins;
}
