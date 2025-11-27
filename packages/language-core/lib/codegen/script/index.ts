import * as path from 'path-browserify';
import type * as ts from 'typescript';
import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, SfcBlock, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, generatePartiallyEnding, generateSfcBlockSection, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { createScriptCodegenContext, type ScriptCodegenContext } from './context';
import { generateScriptSetup, generateScriptSetupImports } from './scriptSetup';
import { generateSrc } from './src';
import { generateTemplate } from './template';

export interface ScriptCodegenOptions {
	ts: typeof ts;
	vueCompilerOptions: VueCompilerOptions;
	script: Sfc['script'];
	scriptSetup: Sfc['scriptSetup'];
	styles: Sfc['styles'];
	fileName: string;
	lang: string;
	scriptRanges: ScriptRanges | undefined;
	scriptSetupRanges: ScriptSetupRanges | undefined;
	templateComponents: string[];
	templateStartTagOffset: number | undefined;
	// TODO: remove this for better increment ality
	templateCodegen: TemplateCodegenContext & { codes: Code[] } | undefined;
	destructuredPropNames: Set<string>;
	templateRefNames: Set<string>;
}

export { generate as generateScript };

function generate(options: ScriptCodegenOptions) {
	const context = createScriptCodegenContext(options);
	const codegen = generateScript(options, context);

	return {
		...context,
		codes: [...codegen],
	};
}

function* generateScript(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	yield* generateGlobalTypesReference(options);

	if (options.scriptSetup && options.scriptSetupRanges) {
		yield* generateScriptSetupImports(options.scriptSetup, options.scriptSetupRanges);
	}
	if (options.script && options.scriptRanges) {
		const { exportDefault, componentOptions } = options.scriptRanges;
		if (options.scriptSetup && options.scriptSetupRanges) {
			if (exportDefault) {
				yield generateSfcBlockSection(options.script, 0, exportDefault.start, codeFeatures.all);
				yield* generateScriptSetup(options, ctx, options.scriptSetup, options.scriptSetupRanges);
			}
			else {
				yield generateSfcBlockSection(options.script, 0, options.script.content.length, codeFeatures.all);
				yield* generateScriptSetup(options, ctx, options.scriptSetup, options.scriptSetupRanges);
			}
		}
		else if (exportDefault) {
			const { expression } = componentOptions ?? exportDefault;

			let wrapLeft: string | undefined;
			let wrapRight: string | undefined;
			if (
				options.script.content[expression.start] === '{'
				&& options.vueCompilerOptions.optionsWrapper.length
			) {
				[wrapLeft, wrapRight] = options.vueCompilerOptions.optionsWrapper;
				ctx.inlayHints.push({
					blockName: options.script.name,
					offset: expression.start,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapLeft || '[Missing optionsWrapper[0]]',
					tooltip: [
						'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
						'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
					].join('\n\n'),
				}, {
					blockName: options.script.name,
					offset: expression.end,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapRight || '[Missing optionsWrapper[1]]',
				});
			}

			yield generateSfcBlockSection(options.script, 0, exportDefault.start, codeFeatures.all);
			yield* generateConstExport(options, options.script);
			if (wrapLeft) {
				yield wrapLeft;
			}
			yield generateSfcBlockSection(options.script, expression.start, expression.end, codeFeatures.all);
			if (wrapRight) {
				yield wrapRight;
			}
			yield endOfLine;
		}
		else {
			yield generateSfcBlockSection(options.script, 0, options.script.content.length, codeFeatures.all);
			yield* generateConstExport(options, options.script);
			yield `(await import('${options.vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
		}
	}
	else if (options.scriptSetup && options.scriptSetupRanges) {
		yield* generateScriptSetup(options, ctx, options.scriptSetup, options.scriptSetupRanges);
	}

	if (!ctx.generatedTemplate) {
		yield* generateTemplate(options, ctx);
	}

	yield* generateExportDefault(options);
	yield* ctx.localTypes.generate();
}

function* generateGlobalTypesReference(
	options: ScriptCodegenOptions,
): Generator<Code> {
	const globalTypesPath = options.vueCompilerOptions.globalTypesPath(options.fileName);

	if (!globalTypesPath) {
		yield `/* placeholder */${newLine}`;
	}
	else if (path.isAbsolute(globalTypesPath)) {
		let relativePath = path.relative(path.dirname(options.fileName), globalTypesPath);
		if (
			relativePath !== globalTypesPath
			&& !relativePath.startsWith('./')
			&& !relativePath.startsWith('../')
		) {
			relativePath = './' + relativePath;
		}
		yield `/// <reference types="${relativePath}" />${newLine}`;
	}
	else {
		yield `/// <reference types="${globalTypesPath}" />${newLine}`;
	}
}

export function* generateConstExport(
	options: ScriptCodegenOptions,
	block: SfcBlock,
): Generator<Code> {
	if (options.script) {
		// #3632
		yield* generatePartiallyEnding(
			options.script.name,
			options.scriptRanges?.exportDefault?.start ?? options.script.content.length,
		);
	}
	yield `const `;
	const token = yield* startBoundary(block.name, 0, codeFeatures.doNotReportTs6133);
	yield `__VLS_export`;
	yield endBoundary(token, block.content.length);
	yield ` = `;
}

function* generateExportDefault(options: ScriptCodegenOptions): Generator<Code> {
	if (options.script?.src) {
		yield* generateSrc(options.script.src);
		return;
	}

	const expression = `{} as typeof __VLS_export`;

	if (options.script && options.scriptRanges?.exportDefault) {
		const { exportDefault, componentOptions } = options.scriptRanges;
		yield generateSfcBlockSection(
			options.script,
			exportDefault.start,
			(componentOptions ?? exportDefault).expression.start,
			codeFeatures.all,
		);
		yield expression;
		yield generateSfcBlockSection(
			options.script,
			(componentOptions ?? exportDefault).expression.end,
			options.script.content.length,
			codeFeatures.all,
		);
	}
	else {
		yield `export `;
		if (options.templateStartTagOffset !== undefined) {
			const token = Symbol();
			for (let i = 0; i < 'template'.length + 1; i++) {
				yield [
					``,
					'template',
					options.templateStartTagOffset + 1 + i,
					i === 0
						? { ...codeFeatures.navigationWithoutRename, __combineToken: token }
						: { __combineToken: token },
				];
			}
		}
		yield `default ${expression}${endOfLine}`;
	}
}
