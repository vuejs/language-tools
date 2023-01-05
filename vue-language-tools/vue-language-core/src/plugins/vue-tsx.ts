import { computed } from '@vue/reactivity';
import { generate as genScript } from '../generators/script';
import * as templateGen from '../generators/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { Sfc, VueLanguagePlugin } from '../types';
import { FileKind } from '@volar/language-core';
import { TextRange } from '../types';
import { parseCssClassNames } from '../utils/parseCssClassNames';
import { parseCssVars } from '../utils/parseCssVars';

const plugin: VueLanguagePlugin = ({ modules, vueCompilerOptions, compilerOptions }) => {

	const ts = modules.typescript;
	const instances = new WeakMap<Sfc, ReturnType<typeof createTsx>>();

	return {

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {

			const tsx = useTsx(fileName, sfc);
			const fileNames: string[] = [];

			if (['js', 'ts', 'jsx', 'tsx'].includes(tsx.lang.value)) {
				fileNames.push(fileName + '.' + tsx.lang.value);
			}

			if (sfc.template) {
				fileNames.push(fileName + '.__VLS_template_format.ts');
				fileNames.push(fileName + '.__VLS_template_style.css');
			}

			return fileNames;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {

			const _tsx = useTsx(fileName, sfc);
			const suffix = embeddedFile.fileName.replace(fileName, '');

			if (suffix === '.' + _tsx.lang.value) {
				embeddedFile.kind = FileKind.TypeScriptHostFile;
				embeddedFile.capabilities = {
					diagnostic: true,
					foldingRange: false,
					documentFormatting: false,
					documentSymbol: false,
					codeAction: true,
					inlayHint: true,
				};
				const tsx = _tsx.tsxGen.value;
				if (tsx) {
					embeddedFile.content = [...tsx.codeGen];
					embeddedFile.extraMappings = [...tsx.extraMappings];
					embeddedFile.mirrorBehaviorMappings = [...tsx.mirrorBehaviorMappings];
				}
			}
			else if (suffix.match(/^\.__VLS_template_format\.ts$/)) {

				embeddedFile.parentFileName = fileName + '.template.' + sfc.template?.lang;
				embeddedFile.capabilities = {
					diagnostic: false,
					foldingRange: false,
					documentFormatting: true,
					documentSymbol: true,
					codeAction: false,
					inlayHint: false,
				};

				if (_tsx.htmlGen.value) {
					embeddedFile.content = [..._tsx.htmlGen.value.formatCodeGen];
				}

				for (const cssVar of _tsx.cssVars.value) {
					embeddedFile.content.push('\n\n');
					for (const range of cssVar.ranges) {
						embeddedFile.content.push('(');
						embeddedFile.content.push([
							cssVar.style.content.substring(range.start, range.end),
							cssVar.style.name,
							range.start,
							{},
						]);
						embeddedFile.content.push(');\n');
					}
				}
			}
			else if (suffix.match(/^\.__VLS_template_style\.css$/)) {

				embeddedFile.parentFileName = fileName + '.template.' + sfc.template?.lang;

				if (_tsx.htmlGen.value) {
					embeddedFile.content = [..._tsx.htmlGen.value.cssCodeGen];
				}
			}
		},
	};

	function useTsx(fileName: string, sfc: Sfc) {
		if (!instances.has(sfc)) {
			instances.set(sfc, createTsx(fileName, sfc));
		}
		return instances.get(sfc)!;
	}

	function createTsx(fileName: string, _sfc: Sfc) {

		const lang = computed(() => {
			let lang = !_sfc.script && !_sfc.scriptSetup ? 'ts'
				: _sfc.scriptSetup && _sfc.scriptSetup.lang !== 'js' ? _sfc.scriptSetup.lang
					: _sfc.script && _sfc.script.lang !== 'js' ? _sfc.script.lang
						: 'js';
			if (vueCompilerOptions.jsxTemplates) {
				if (lang === 'js') {
					lang = 'jsx';
				}
				else if (lang === 'ts') {
					lang = 'tsx';
				}
			}
			return lang;
		});
		const cssVars = computed(() => collectCssVars(_sfc));
		const scriptRanges = computed(() =>
			_sfc.scriptAst
				? parseScriptRanges(ts, _sfc.scriptAst, !!_sfc.scriptSetup, false)
				: undefined
		);
		const scriptSetupRanges = computed(() =>
			_sfc.scriptSetupAst
				? parseScriptSetupRanges(ts, _sfc.scriptSetupAst, vueCompilerOptions)
				: undefined
		);
		const cssModuleClasses = computed(() => collectStyleCssClasses(_sfc, style => !!style.module));
		const cssScopedClasses = computed(() => collectStyleCssClasses(_sfc, style => {
			const setting = vueCompilerOptions.experimentalResolveStyleCssClasses;
			return (setting === 'scoped' && style.scoped) || setting === 'always';
		}));
		const htmlGen = computed(() => {

			const templateAst = _sfc.templateAst;

			if (!templateAst)
				return;

			return templateGen.generate(
				ts,
				compilerOptions,
				vueCompilerOptions,
				_sfc.template?.content ?? '',
				_sfc.template?.lang ?? 'html',
				templateAst,
				!!_sfc.scriptSetup,
				Object.values(cssScopedClasses.value).map(style => style.classNames).flat(),
			);
		});
		const tsxGen = computed(() => genScript(
			ts,
			fileName,
			_sfc,
			lang.value,
			scriptRanges.value,
			scriptSetupRanges.value,
			cssVars.value,
			cssModuleClasses.value,
			cssScopedClasses.value,
			htmlGen.value,
			compilerOptions,
			vueCompilerOptions,
		));

		return {
			lang,
			tsxGen,
			htmlGen,
			cssVars,
		};
	}
};
export default plugin;

export function collectStyleCssClasses(sfc: Sfc, condition: (style: Sfc['styles'][number]) => boolean) {
	const result: {
		style: typeof sfc.styles[number],
		index: number,
		classNameRanges: TextRange[],
		classNames: string[],
	}[] = [];
	for (let i = 0; i < sfc.styles.length; i++) {
		const style = sfc.styles[i];
		if (condition(style)) {
			const classNameRanges = [...parseCssClassNames(style.content)];
			result.push({
				style: style,
				index: i,
				classNameRanges: classNameRanges,
				classNames: classNameRanges.map(range => style.content.substring(range.start + 1, range.end)),
			});
		}
	}
	return result;
}

export function collectCssVars(sfc: Sfc) {
	const result: { style: typeof sfc.styles[number], ranges: TextRange[]; }[] = [];
	for (let i = 0; i < sfc.styles.length; i++) {
		const style = sfc.styles[i];
		result.push({
			style,
			ranges: [...parseCssVars(style.content)],
		});
	}
	return result;
}
