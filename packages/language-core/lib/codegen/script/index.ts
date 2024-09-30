import type { Mapping } from '@volar/language-core';
import type * as ts from 'typescript';
import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, VueCodeInformation, VueCompilerOptions } from '../../types';
import { endOfLine, generateSfcBlockSection, newLine } from '../common';
import { generateGlobalTypes } from '../globalTypes';
import type { TemplateCodegenContext } from '../template/context';
import { createScriptCodegenContext, ScriptCodegenContext } from './context';
import { generateComponentSelf } from './componentSelf';
import { generateScriptSetup, generateScriptSetupImports } from './scriptSetup';
import { generateSrc } from './src';
import { generateStyleModulesType } from './styleModulesType';
import { generateTemplate } from './template';

export const codeFeatures = {
	all: {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
	} as VueCodeInformation,
	none: {} as VueCodeInformation,
	verification: {
		verification: true,
	} as VueCodeInformation,
	navigation: {
		navigation: true,
	} as VueCodeInformation,
	navigationWithoutRename: {
		navigation: {
			shouldRename() {
				return false;
			},
		},
	} as VueCodeInformation,
};

export interface ScriptCodegenOptions {
	fileBaseName: string;
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	sfc: Sfc;
	lang: string;
	scriptRanges: ScriptRanges | undefined;
	scriptSetupRanges: ScriptSetupRanges | undefined;
	templateCodegen: TemplateCodegenContext & { codes: Code[]; } | undefined;
	edited: boolean;
	appendGlobalTypes: boolean;
	getGeneratedLength: () => number;
	linkedCodeMappings: Mapping[];
}

export function* generateScript(options: ScriptCodegenOptions): Generator<Code, ScriptCodegenContext> {
	const ctx = createScriptCodegenContext(options);

	if (options.vueCompilerOptions.__setupedGlobalTypes) {
		yield `/// <reference types=".vue-global-types/${options.vueCompilerOptions.lib}_${options.vueCompilerOptions.target}_${options.vueCompilerOptions.strictTemplates}.d.ts" />${newLine}`;
	}
	else {
		yield `/* placeholder */`;
	}

	if (options.sfc.script?.src) {
		yield* generateSrc(options.sfc.script, options.sfc.script.src);
	}
	if (options.sfc.script && options.scriptRanges) {
		const { exportDefault, classBlockEnd } = options.scriptRanges;
		const isExportRawObject = exportDefault
			&& options.sfc.script.content[exportDefault.expression.start] === '{';
		if (options.sfc.scriptSetup && options.scriptSetupRanges) {
			yield* generateScriptSetupImports(options.sfc.scriptSetup, options.scriptSetupRanges);
			yield* generateDefineProp(options, options.sfc.scriptSetup);
			if (exportDefault) {
				yield generateSfcBlockSection(options.sfc.script, 0, exportDefault.expression.start, codeFeatures.all);
				yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
				yield generateSfcBlockSection(options.sfc.script, exportDefault.expression.end, options.sfc.script.content.length, codeFeatures.all);
			}
			else {
				yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
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
				yield `},${newLine}`;
				yield generateSfcBlockSection(options.sfc.script, classBlockEnd, options.sfc.script.content.length, codeFeatures.all);
			}
		}
		else {
			yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
		}
	}
	else if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		yield* generateScriptSetupImports(options.sfc.scriptSetup, options.scriptSetupRanges);
		yield* generateDefineProp(options, options.sfc.scriptSetup);
		yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
	}

	yield `;`;
	if (options.sfc.scriptSetup) {
		// #4569
		yield ['', 'scriptSetup', options.sfc.scriptSetup.content.length, codeFeatures.verification];
	}
	yield newLine;

	if (!ctx.generatedTemplate) {
		yield `function __VLS_template() {${newLine}`;
		const templateCodegenCtx = yield* generateTemplate(options, ctx);
		yield `}${endOfLine}`;
		yield* generateComponentSelf(options, ctx, templateCodegenCtx);
	}

	// #4788
	yield* generateStyleModulesType(options, ctx);

	if (options.edited) {
		yield `type __VLS_IntrinsicElementsCompletion = __VLS_IntrinsicElements${endOfLine}`;
	}
	yield* ctx.localTypes.generate([...ctx.localTypes.getUsedNames()]);
	if (options.appendGlobalTypes) {
		yield generateGlobalTypes(options.vueCompilerOptions.lib, options.vueCompilerOptions.target, options.vueCompilerOptions.strictTemplates);
	}

	if (options.sfc.scriptSetup) {
		yield ['', 'scriptSetup', options.sfc.scriptSetup.content.length, codeFeatures.verification];
	}

	return ctx;
}

function* generateDefineProp(
	options: ScriptCodegenOptions,
	scriptSetup: NonNullable<Sfc['scriptSetup']>
): Generator<Code> {
	const definePropProposalA = scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=kevinEdition') || options.vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition';
	const definePropProposalB = scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=johnsonEdition') || options.vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition';

	if (definePropProposalA || definePropProposalB) {
		yield `type __VLS_PropOptions<T> = Exclude<import('${options.vueCompilerOptions.lib}').Prop<T>, import('${options.vueCompilerOptions.lib}').PropType<T>>${endOfLine}`;
		if (definePropProposalA) {
			yield `declare function defineProp<T>(name: string, options: ({ required: true } | { default: T }) & __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(name?: string, options?: __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T | undefined>${endOfLine}`;
		}
		if (definePropProposalB) {
			yield `declare function defineProp<T>(value: T | (() => T), required?: boolean, options?: __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(value: T | (() => T) | undefined, required: true, options?: __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(value?: T | (() => T), required?: boolean, options?: __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T | undefined>${endOfLine}`;
		}
	}
}
