import * as path from 'path-browserify';
import type * as ts from 'typescript';
import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, SfcBlock, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';
import type { ScriptCodegenContext } from './context';
import { generateScriptSetup, generateScriptSetupImports } from './scriptSetup';
import { generateSrc } from './src';
import { generateTemplate } from './template';

export * from './context';

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

export function* generateScript(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	yield* generateGlobalTypesReference(options);

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
				yield generateSfcBlockSection(options.sfc.script, 0, exportDefault.start, codeFeatures.all);
				yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
			}
			else {
				yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
				yield* generateScriptSectionPartiallyEnding(
					options.sfc.script.name,
					options.sfc.script.content.length,
					'#3632/both.vue',
				);
				yield* generateScriptSetup(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
			}
		}
		else if (exportDefault) {
			let wrapLeft: string | undefined;
			let wrapRight: string | undefined;
			if (isExportRawObject && options.vueCompilerOptions.optionsWrapper.length) {
				[wrapLeft, wrapRight] = options.vueCompilerOptions.optionsWrapper;
				ctx.inlayHints.push({
					blockName: options.sfc.script.name,
					offset: exportDefault.expression.start,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapLeft || '[Missing optionsWrapper[0]]',
					tooltip: [
						'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
						'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
					].join('\n\n'),
				}, {
					blockName: options.sfc.script.name,
					offset: exportDefault.expression.end,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapRight || '[Missing optionsWrapper[1]]',
				});
			}

			yield generateSfcBlockSection(options.sfc.script, 0, exportDefault.start, codeFeatures.all);
			yield* generateConstExport(options.sfc.script);
			if (wrapLeft) {
				yield wrapLeft;
			}
			yield generateSfcBlockSection(
				options.sfc.script,
				exportDefault.expression.start,
				exportDefault.expression.end,
				codeFeatures.all,
			);
			if (wrapRight) {
				yield wrapRight;
			}
			yield endOfLine;
		}
		else if (classBlockEnd !== undefined) {
			if (options.vueCompilerOptions.skipTemplateCodegen) {
				yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
			}
			else {
				yield generateSfcBlockSection(options.sfc.script, 0, classBlockEnd, codeFeatures.all);
				yield `__VLS_template = () => {${newLine}`;
				yield* generateTemplate(options, ctx);
				yield `}${endOfLine}`;
				yield generateSfcBlockSection(
					options.sfc.script,
					classBlockEnd,
					options.sfc.script.content.length,
					codeFeatures.all,
				);
			}
		}
		else {
			yield generateSfcBlockSection(options.sfc.script, 0, options.sfc.script.content.length, codeFeatures.all);
			yield* generateScriptSectionPartiallyEnding(
				options.sfc.script.name,
				options.sfc.script.content.length,
				'#3632/script.vue',
			);
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

	if (options.sfc.scriptSetup) {
		yield ['', 'scriptSetup', options.sfc.scriptSetup.content.length, codeFeatures.verification];
	}
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

export function* generateConstExport(block: SfcBlock): Generator<Code> {
	yield `const `;
	yield* wrapWith(
		0,
		block.content.length,
		block.name,
		codeFeatures.verification,
		`__VLS_export`,
	);
	yield ` = `;
}

function* generateExportDefault(options: ScriptCodegenOptions): Generator<Code> {
	let prefix: Code;
	let suffix: Code;
	if (options.sfc.script && options.scriptRanges?.exportDefault) {
		const { exportDefault } = options.scriptRanges;
		prefix = generateSfcBlockSection(
			options.sfc.script,
			exportDefault.start,
			exportDefault.expression.start,
			codeFeatures.all,
		);
		suffix = generateSfcBlockSection(
			options.sfc.script,
			exportDefault.expression.end,
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

export function* generateScriptSectionPartiallyEnding(
	source: string,
	end: number,
	mark: string,
	delimiter = 'debugger',
): Generator<Code> {
	yield delimiter;
	yield [``, source, end, codeFeatures.verification];
	yield `/* PartiallyEnd: ${mark} */${newLine}`;
}
