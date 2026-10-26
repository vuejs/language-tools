import * as CompilerDOM from '@vue/compiler-dom';
import * as LanguageCore from '../index';
import { createPlugins } from './plugins';
import { compileScript } from './plugins/vue-script-js';
import { compileStyle } from './plugins/vue-style-css';
import { htmlTemplateCompiler } from './plugins/vue-template-html';
import type {
	IRPipeline,
	TemplateCompiler,
	TypeScript,
	VueCompilerOptions,
	VueFormat,
	VueLanguagePluginReturn,
} from './types';
import { petiteVueParser } from './virtualCode/parsers/petiteVue';
import { sfcParser } from './virtualCode/parsers/sfc';
import { vitePressParser } from './virtualCode/parsers/vitepress';

const builtInFormats: Record<VueCompilerOptions['format'], VueFormat> = {
	sfc: sfcParser,
	vitepress: vitePressParser,
	'petite-vue': petiteVueParser,
};

const builtInTemplateCompilers: Record<string, TemplateCompiler> = {
	html: htmlTemplateCompiler,
	md: htmlTemplateCompiler,
};

/**
 * How the IR of the Vue files of `vueCompilerOptions` is built: the format of `vueCompilerOptions.format`, the
 * built-in compilers of the template, script and style languages, and the plugins of `vueCompilerOptions.plugins`.
 */
export function createIRPipeline(ts: TypeScript, vueCompilerOptions: VueCompilerOptions): IRPipeline {
	const plugins = createPlugins({
		modules: {
			'@vue/compiler-dom': CompilerDOM,
			'@vue/language-core': LanguageCore,
			typescript: ts,
		},
		vueCompilerOptions,
		config: {},
	});
	const format = builtInFormats[vueCompilerOptions.format] ?? sfcParser;

	return {
		parse(fileName, content) {
			for (const plugin of plugins) {
				const result = plugin.parseSFC?.(fileName, content);
				if (result) {
					return { result, format: asFormat(plugin) };
				}
			}
			const result = format.parse(fileName, content);
			if (result) {
				return { result, format };
			}
		},
		compileTemplate(lang, template, options) {
			for (const plugin of plugins) {
				if (plugin.resolveTemplateCompilerOptions) {
					options = plugin.resolveTemplateCompilerOptions(options);
				}
			}
			const builtIn = builtInTemplateCompilers[lang];
			if (builtIn) {
				const result = builtIn.compile(template, options);
				if (result) {
					return { result, compiler: builtIn };
				}
			}
			for (const plugin of plugins) {
				const result = plugin.compileSFCTemplate?.(lang, template, options);
				if (result) {
					return { result, compiler: asTemplateCompiler(plugin, lang) };
				}
			}
		},
		compileScript(lang, script) {
			const builtIn = compileScript(ts, lang, script);
			if (builtIn) {
				return builtIn;
			}
			for (const plugin of plugins) {
				const ast = plugin.compileSFCScript?.(lang, script);
				if (ast) {
					return ast;
				}
			}
		},
		compileStyle(_lang, style) {
			return compileStyle(style);
		},
	};
}

function asFormat(plugin: VueLanguagePluginReturn): VueFormat {
	return {
		parse: (fileName, content) => plugin.parseSFC?.(fileName, content),
		update: plugin.updateSFC && ((old, change) => plugin.updateSFC!(old, change)),
	};
}

function asTemplateCompiler(plugin: VueLanguagePluginReturn, lang: string): TemplateCompiler {
	return {
		compile: (template, options) => plugin.compileSFCTemplate?.(lang, template, options),
		update: plugin.updateSFCTemplate && ((old, change) => plugin.updateSFCTemplate!(old, change)),
	};
}
