import { loadIRPlugins } from './plugins';
import { compileScript } from './plugins/vue-script-js';
import { compileStyle } from './plugins/vue-style-css';
import { htmlTemplateCompiler } from './plugins/vue-template-html';
import { compileTemplate } from './template/compile';
import type {
	IRPipeline,
	TemplateCompiler,
	TypeScript,
	VueCompilerOptions,
	VueFormat,
	VuePluginError,
	VueTemplateCompilerHost,
} from './types';
import { petiteVueParser } from './virtualCode/parsers/petiteVue';
import { sfcParser } from './virtualCode/parsers/sfc';
import { vitePressParser } from './virtualCode/parsers/vitepress';

const builtInFormats: Record<string, VueFormat> = {
	sfc: sfcParser,
	vitepress: vitePressParser,
	'petite-vue': petiteVueParser,
};

const builtInTemplateCompilers: Record<string, TemplateCompiler> = {
	html: htmlTemplateCompiler,
	md: htmlTemplateCompiler,
};

const templateCompilerHost: VueTemplateCompilerHost = { compileTemplate };

/**
 * How the IR of the Vue files of `vueCompilerOptions` is built: the format of `vueCompilerOptions.format`, the
 * compilers of the template, script and style languages, and the `ir` contributions of `vueCompilerOptions.plugins`.
 * The entries, or the parts of them, that have no effect are in `errors`.
 */
export function createIRPipeline(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
): IRPipeline & { errors: VuePluginError[] } {
	const plugins = loadIRPlugins(vueCompilerOptions, {
		formats: Object.keys(builtInFormats),
		templateCompilers: Object.keys(builtInTemplateCompilers),
	});
	const errors = [...plugins.errors];
	const templateCompilers: Record<string, TemplateCompiler> = { ...builtInTemplateCompilers };
	for (const lang in plugins.templateCompilers) {
		const compile = plugins.templateCompilers[lang]!;
		templateCompilers[lang] = {
			compile: (template, options) => compile(template, options, templateCompilerHost),
		};
	}
	let format = builtInFormats[vueCompilerOptions.format] ?? plugins.formats[vueCompilerOptions.format];
	if (!format) {
		errors.push({
			message: `No format '${vueCompilerOptions.format}' is built in or provided by a plugin; 'sfc' is used instead.`,
		});
		format = sfcParser;
	}

	return {
		errors,
		parse(fileName, content) {
			const result = format.parse(fileName, content);
			if (result) {
				return { result, format };
			}
		},
		compileTemplate(lang, template, options) {
			for (const resolve of plugins.resolveTemplateCompilerOptions) {
				options = resolve(options);
			}
			const compiler = templateCompilers[lang];
			const result = compiler?.compile(template, options);
			if (result) {
				return { result, compiler: compiler! };
			}
		},
		compileScript(lang, script) {
			return compileScript(ts, lang, script);
		},
		compileStyle(_lang, style) {
			return compileStyle(style);
		},
	};
}
