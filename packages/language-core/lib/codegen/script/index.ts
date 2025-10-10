import * as path from 'path-browserify';
import type * as ts from 'typescript';
import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, SfcBlock, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, generatePartiallyEnding, generateSfcBlockSection, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';
import { createScriptCodegenContext, type ScriptCodegenContext } from './context';
import { generateScriptSetup, generateScriptSetupImports } from './scriptSetup';
import { generateSrc } from './src';
import { generateTemplate } from './template';

export interface ScriptCodegenOptions {
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	sfc: Sfc;
	fileName: string;
	lang: string;
	scriptRanges: ScriptRanges | undefined;
	scriptSetupRanges: ScriptSetupRanges | undefined;
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

	if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		yield* generateScriptSetupImports(options.sfc.scriptSetup, options.scriptSetupRanges);
	}
	if (options.sfc.script && options.scriptRanges) {
		const { exportDefault, componentOptions } = options.scriptRanges;
		if (options.sfc.scriptSetup && options.scriptSetupRanges) {
			if (exportDefault) {
				yield generateSfcBlockSection(options.sfc.script, 0, exportDefault.start, codeFeatures.all);
				yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
			}
			else {
				yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
				yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
			}
		}
		else if (exportDefault) {
			const { expression } = componentOptions ?? exportDefault;

			let wrapLeft: string | undefined;
			let wrapRight: string | undefined;
			if (
				options.sfc.script.content[expression.start] === '{'
				&& options.vueCompilerOptions.optionsWrapper.length
			) {
				[wrapLeft, wrapRight] = options.vueCompilerOptions.optionsWrapper;
				ctx.inlayHints.push({
					blockName: options.sfc.script.name,
					offset: expression.start,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapLeft || '[Missing optionsWrapper[0]]',
					tooltip: [
						'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
						'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
					].join('\n\n'),
				}, {
					blockName: options.sfc.script.name,
					offset: expression.end,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapRight || '[Missing optionsWrapper[1]]',
				});
			}

			yield generateSfcBlockSection(options.sfc.script, 0, exportDefault.start, codeFeatures.all);
			yield* generateConstExport(options, options.sfc.script);
			if (wrapLeft) {
				yield wrapLeft;
			}
			yield generateSfcBlockSection(options.sfc.script, expression.start, expression.end, codeFeatures.all);
			if (wrapRight) {
				yield wrapRight;
			}
			yield endOfLine;
		}
		else {
			yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
			yield* generateConstExport(options, options.sfc.script);
			yield `(await import('${options.vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
		}
	}
	else if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
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
	if (options.sfc.script) {
		yield* generatePartiallyEnding(
			options.sfc.script.name,
			options.scriptRanges?.exportDefault?.start ?? options.sfc.script.content.length,
			'#3632/script.vue',
		);
	}
	yield `const `;
	yield* wrapWith(
		0,
		block.content.length,
		block.name,
		codeFeatures.doNotReportTs6133,
		`__VLS_export`,
	);
	yield ` = `;
}

function* generateExportDefault(options: ScriptCodegenOptions): Generator<Code> {
	if (options.sfc.script?.src) {
		yield* generateSrc(options.sfc.script.src);
		return;
	}

	let prefix: Code;
	let suffix: Code;
	if (options.sfc.script && options.scriptRanges?.exportDefault) {
		const { exportDefault, componentOptions } = options.scriptRanges;
		prefix = generateSfcBlockSection(
			options.sfc.script,
			exportDefault.start,
			(componentOptions ?? exportDefault).expression.start,
			codeFeatures.all,
		);
		suffix = generateSfcBlockSection(
			options.sfc.script,
			(componentOptions ?? exportDefault).expression.end,
			options.sfc.script.content.length,
			codeFeatures.all,
		);
	}
	else {
		prefix = `export default `;
		suffix = endOfLine;
	}
	yield prefix;
	yield `{} as typeof __VLS_export`;
	yield suffix;
}
