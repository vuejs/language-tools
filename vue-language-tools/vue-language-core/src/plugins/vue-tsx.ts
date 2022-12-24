import { computed, shallowRef as ref } from '@vue/reactivity';
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
	const _fileName = ref('');
	const _sfc = ref<Sfc>({} as any);
	const lang = computed(() => {
		let lang = !_sfc.value.script && !_sfc.value.scriptSetup ? 'ts'
			: _sfc.value.scriptSetup && _sfc.value.scriptSetup.lang !== 'js' ? _sfc.value.scriptSetup.lang
				: _sfc.value.script && _sfc.value.script.lang !== 'js' ? _sfc.value.script.lang
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
	const cssVars = computed(() => collectCssVars(_sfc.value));
	const scriptRanges = computed(() =>
		_sfc.value.scriptAst
			? parseScriptRanges(ts, _sfc.value.scriptAst, !!_sfc.value.scriptSetup, false)
			: undefined
	);
	const scriptSetupRanges = computed(() =>
		_sfc.value.scriptSetupAst
			? parseScriptSetupRanges(ts, _sfc.value.scriptSetupAst)
			: undefined
	);
	const cssModuleClasses = computed(() => collectStyleCssClasses(_sfc.value, style => !!style.module));
	const cssScopedClasses = computed(() => collectStyleCssClasses(_sfc.value, style => {
		const setting = vueCompilerOptions.experimentalResolveStyleCssClasses;
		return (setting === 'scoped' && style.scoped) || setting === 'always';
	}));
	const htmlGen = computed(() => {

		const templateAst = _sfc.value.getTemplateAst();

		if (!templateAst)
			return;

		return templateGen.generate(
			ts,
			vueCompilerOptions,
			_sfc.value.template?.content ?? '',
			_sfc.value.template?.lang ?? 'html',
			templateAst,
			!!_sfc.value.scriptSetup,
			Object.values(cssScopedClasses.value).map(style => style.classNames).flat(),
		);
	});
	const tsxGen = computed(() => genScript(
		ts,
		_fileName.value,
		_sfc.value,
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

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {

			_fileName.value = fileName;
			_sfc.value = sfc;

			const fileNames: string[] = [];

			if (['js', 'ts', 'jsx', 'tsx'].includes(lang.value)) {
				fileNames.push(fileName + '.' + lang.value);
			}

			if (sfc.template) {
				fileNames.push(fileName + '.__VLS_template_format.ts');
				fileNames.push(fileName + '.__VLS_template_style.css');
			}

			return fileNames;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {

			_fileName.value = fileName;
			_sfc.value = sfc;

			const suffix = embeddedFile.fileName.replace(fileName, '');

			if (suffix === '.' + lang.value) {
				embeddedFile.kind = FileKind.TypeScriptHostFile;
				embeddedFile.capabilities = {
					diagnostic: true,
					foldingRange: false,
					documentFormatting: false,
					documentSymbol: false,
					codeAction: true,
					inlayHint: true,
				};
				const tsx = tsxGen.value;
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

				if (htmlGen.value) {
					embeddedFile.content = [...htmlGen.value.formatCodeGen];
				}

				for (const cssVar of cssVars.value) {
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

				if (htmlGen.value) {
					embeddedFile.content = [...htmlGen.value.cssCodeGen];
				}
			}
		},
	};
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
