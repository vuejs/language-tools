import { petiteVueParser } from '../formats/petiteVue';
import { sfcParser } from '../formats/sfc';
import { vitePressParser } from '../formats/vitepress';
import { loadIRPlugins } from '../options/plugins';
import { compileScript } from '../script/compileScript';
import { compileStyle } from '../style/compileStyle';
import { compileTemplateHTML } from '../template/compileTemplateHTML';
import { htmlTemplateCompiler } from '../template/htmlTemplateCompiler';
import type { IRPipeline, TemplateCompiler, TypeScript, VueCompilerOptions, VueFormat, VuePluginError } from '../types';

const builtInFormats: Record<string, VueFormat> = {
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
		const toHTML = plugins.templateCompilers[lang]!;
		templateCompilers[lang] = {
			compile(template, options) {
				const converted = toHTML(template);
				if (converted) {
					return { ast: compileTemplateHTML(converted, options) };
				}
			},
		};
	}
	const format = builtInFormats[vueCompilerOptions.format] ?? plugins.formats[vueCompilerOptions.format];
	if (!format) {
		errors.push({
			message: `No format '${vueCompilerOptions.format}' is built in or provided by a plugin; no file is read.`,
		});
	}

	return {
		errors,
		parse(fileName, content) {
			if (!format) {
				return;
			}
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
