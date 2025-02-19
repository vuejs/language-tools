import type { Mapping } from '@volar/language-core';
import * as path from 'path-browserify';
import type * as ts from 'typescript';
import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { generateGlobalTypes, getGlobalTypesFileName } from '../globalTypes';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateComponentSelf } from './componentSelf';
import { createScriptCodegenContext, ScriptCodegenContext } from './context';
import { generateScriptSetup, generateScriptSetupImports } from './scriptSetup';
import { generateSrc } from './src';
import { generateTemplate } from './template';

export interface ScriptCodegenOptions {
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	sfc: Sfc;
	edited: boolean;
	fileName: string;
	lang: string;
	scriptRanges: ScriptRanges | undefined;
	scriptSetupRanges: ScriptSetupRanges | undefined;
	templateCodegen: TemplateCodegenContext & { codes: Code[]; } | undefined;
	destructuredPropNames: Set<string>;
	templateRefNames: Set<string>;
	getGeneratedLength: () => number;
	linkedCodeMappings: Mapping[];
	appendGlobalTypes: boolean;
}

export function* generateScript(options: ScriptCodegenOptions): Generator<Code, ScriptCodegenContext> {
	const ctx = createScriptCodegenContext(options);

	if (options.vueCompilerOptions.__setupedGlobalTypes) {
		const globalTypes = options.vueCompilerOptions.__setupedGlobalTypes;
		if (typeof globalTypes === 'object') {
			let relativePath = path.relative(path.dirname(options.fileName), globalTypes.absolutePath);
			if (relativePath !== globalTypes.absolutePath && !relativePath.startsWith('./') && !relativePath.startsWith('../')) {
				relativePath = './' + relativePath;
			}
			yield `/// <reference types="${relativePath}" />${newLine}`;
		}
		else {
			yield `/// <reference types=".vue-global-types/${getGlobalTypesFileName(options.vueCompilerOptions)}" />${newLine}`;
		}
	}
	else {
		yield `/* placeholder */`;
	}

	if (options.sfc.script?.src) {
		yield* generateSrc(options.sfc.script.src);
	}
	if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		yield* generateScriptSetupImports(options.sfc.scriptSetup, options.scriptSetupRanges);
	}
	if (options.sfc.script && options.scriptRanges) {
		const { exportDefault, classBlockEnd } = options.scriptRanges;
		const isExportRawObject = exportDefault
			&& options.sfc.script.content[exportDefault.expression.start] === '{';
		if (options.sfc.scriptSetup && options.scriptSetupRanges) {
			if (exportDefault) {
				yield generateSfcBlockSection(options.sfc.script, 0, exportDefault.expression.start, codeFeatures.all);
				yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
				yield generateSfcBlockSection(options.sfc.script, exportDefault.expression.end, options.sfc.script.content.length, codeFeatures.all);
			}
			else {
				yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
				yield* generateScriptSectionPartiallyEnding(options.sfc.script.name, options.sfc.script.content.length, '#3632/both.vue');
				yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
			}
		}
		else if (exportDefault && isExportRawObject && options.vueCompilerOptions.optionsWrapper.length) {
			ctx.inlayHints.push({
				blockName: options.sfc.script.name,
				offset: exportDefault.expression.start,
				setting: 'vue.inlayHints.optionsWrapper',
				label: options.vueCompilerOptions.optionsWrapper.length
					? options.vueCompilerOptions.optionsWrapper[0]
					: '[Missing optionsWrapper[0]]',
				tooltip: [
					'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
					'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
				].join('\n\n'),
			}, {
				blockName: options.sfc.script.name,
				offset: exportDefault.expression.end,
				setting: 'vue.inlayHints.optionsWrapper',
				label: options.vueCompilerOptions.optionsWrapper.length >= 2
					? options.vueCompilerOptions.optionsWrapper[1]
					: '[Missing optionsWrapper[1]]',
			});
			yield generateSfcBlockSection(options.sfc.script, 0, exportDefault.expression.start, codeFeatures.all);
			yield options.vueCompilerOptions.optionsWrapper[0];
			yield generateSfcBlockSection(options.sfc.script, exportDefault.expression.start, exportDefault.expression.end, codeFeatures.all);
			yield options.vueCompilerOptions.optionsWrapper[1];
			yield generateSfcBlockSection(options.sfc.script, exportDefault.expression.end, options.sfc.script.content.length, codeFeatures.all);
		}
		else if (classBlockEnd !== undefined) {
			if (options.vueCompilerOptions.skipTemplateCodegen) {
				yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
			}
			else {
				yield generateSfcBlockSection(options.sfc.script, 0, classBlockEnd, codeFeatures.all);
				yield `__VLS_template = () => {${newLine}`;
				const templateCodegenCtx = yield* generateTemplate(options, ctx);
				yield* generateComponentSelf(options, ctx, templateCodegenCtx);
				yield `}${endOfLine}`;
				yield generateSfcBlockSection(options.sfc.script, classBlockEnd, options.sfc.script.content.length, codeFeatures.all);
			}
		}
		else {
			yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
		}
	}
	else if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
	}

	if (options.sfc.script) {
		yield* generateScriptSectionPartiallyEnding(options.sfc.script.name, options.sfc.script.content.length, '#3632/script.vue');
	}
	if (options.sfc.scriptSetup) {
		yield* generateScriptSectionPartiallyEnding(options.sfc.scriptSetup.name, options.sfc.scriptSetup.content.length, '#4569/main.vue');
	}

	if (!ctx.generatedTemplate) {
		const templateCodegenCtx = yield* generateTemplate(options, ctx);
		yield* generateComponentSelf(options, ctx, templateCodegenCtx);
	}

	if (options.edited) {
		yield `type __VLS_IntrinsicElementsCompletion = __VLS_IntrinsicElements${endOfLine}`;
	}
	yield* ctx.localTypes.generate([...ctx.localTypes.getUsedNames()]);
	if (options.appendGlobalTypes) {
		yield generateGlobalTypes(options.vueCompilerOptions);
	}

	if (options.sfc.scriptSetup) {
		yield ['', 'scriptSetup', options.sfc.scriptSetup.content.length, codeFeatures.verification];
	}

	return ctx;
}

export function* generateScriptSectionPartiallyEnding(source: string, end: number, mark: string): Generator<Code> {
	yield `;`;
	yield ['', source, end, codeFeatures.verification];
	yield `/* PartiallyEnd: ${mark} */${newLine}`;
}
