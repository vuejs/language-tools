import * as path from 'path-browserify';
import type * as ts from 'typescript';
import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, SfcBlock, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import * as names from '../names';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { createScriptCodegenContext, type ScriptCodegenContext } from './context';
import { generateGeneric, generateScriptSetupImports, generateSetupFunction } from './scriptSetup';
import { generateSrc } from './src';
import { generateTemplate } from './template';

const exportExpression = `{} as typeof ${names._export}`;

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
	const codegen = generateWorker(options, context);

	return {
		...context,
		codes: [...codegen],
	};
}

function* generateWorker(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	yield* generateGlobalTypesReference(options);

	const { script, scriptRanges, scriptSetup, scriptSetupRanges, vueCompilerOptions } = options;

	if (scriptSetup && scriptSetupRanges) {
		yield* generateScriptSetupImports(scriptSetup, scriptSetupRanges);
	}
	if (script?.src) {
		yield* generateSrc(script.src);
	}

	// <script> + <script setup>
	if (script && scriptRanges && scriptSetup && scriptSetupRanges) {
		// <script> head
		const { exportDefault, componentOptions } = scriptRanges;
		if (exportDefault) {
			yield* generateSfcBlockSection(script, 0, exportDefault.start, codeFeatures.all, true);
		}
		else {
			yield* generateSfcBlockSection(script, 0, script.content.length, codeFeatures.all, true);
		}

		// <script setup>
		yield* generateExportDeclareEqual(scriptSetup);
		if (scriptSetup.generic) {
			yield* generateGeneric(
				options,
				ctx,
				scriptSetup,
				scriptSetupRanges,
				scriptSetup.generic,
				generateSetupFunction(
					options,
					ctx,
					scriptSetup,
					scriptSetupRanges,
					generateTemplate(options, ctx),
				),
			);
		}
		else {
			yield `await (async () => {${newLine}`;
			yield* generateSetupFunction(
				options,
				ctx,
				scriptSetup,
				scriptSetupRanges,
				generateTemplate(options, ctx),
				[`return `],
			);
			yield `})()${endOfLine}`;
		}

		// <script> tail
		if (exportDefault) {
			const { expression } = componentOptions ?? exportDefault;
			yield* generateSfcBlockSection(script, exportDefault.start, expression.start, codeFeatures.all);
			yield exportExpression;
			yield* generateSfcBlockSection(script, expression.end, script.content.length, codeFeatures.all);
		}
		else {
			yield `export default ${exportExpression}${endOfLine}`;
		}
	}
	// only <script setup>
	else if (scriptSetup && scriptSetupRanges) {
		if (scriptSetup.generic) {
			yield* generateExportDeclareEqual(scriptSetup);
			yield* generateGeneric(
				options,
				ctx,
				scriptSetup,
				scriptSetupRanges,
				scriptSetup.generic,
				generateSetupFunction(
					options,
					ctx,
					scriptSetup,
					scriptSetupRanges,
					generateTemplate(options, ctx),
				),
			);
		}
		else {
			// no script block, generate script setup code at root
			yield* generateSetupFunction(
				options,
				ctx,
				scriptSetup,
				scriptSetupRanges,
				generateTemplate(options, ctx),
				generateExportDeclareEqual(scriptSetup),
			);
		}
		yield `export default ${exportExpression}${endOfLine}`;
	}
	// only <script>
	else if (script && scriptRanges) {
		const { exportDefault, componentOptions } = scriptRanges;
		if (exportDefault) {
			const { expression } = componentOptions ?? exportDefault;

			let wrapLeft: string | undefined;
			let wrapRight: string | undefined;
			if (
				script.content[expression.start] === '{'
				&& vueCompilerOptions.optionsWrapper.length
			) {
				[wrapLeft, wrapRight] = vueCompilerOptions.optionsWrapper;
				ctx.inlayHints.push({
					blockName: script.name,
					offset: expression.start,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapLeft || '[Missing optionsWrapper[0]]',
					tooltip: [
						'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
						'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
					].join('\n\n'),
				}, {
					blockName: script.name,
					offset: expression.end,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapRight || '[Missing optionsWrapper[1]]',
				});
			}

			yield* generateSfcBlockSection(script, 0, exportDefault.start, codeFeatures.all, true);
			yield* generateExportDeclareEqual(script);
			if (wrapLeft) {
				yield wrapLeft;
			}
			yield* generateSfcBlockSection(script, expression.start, expression.end, codeFeatures.all);
			if (wrapRight) {
				yield wrapRight;
			}
			yield endOfLine;
			yield* generateTemplate(options, ctx);
			yield* generateSfcBlockSection(script, exportDefault.start, expression.start, codeFeatures.all);
			yield exportExpression;
			yield* generateSfcBlockSection(script, expression.end, script.content.length, codeFeatures.all);
		}
		else {
			yield* generateSfcBlockSection(script, 0, script.content.length, codeFeatures.all, true);
			yield* generateExportDeclareEqual(script);
			yield `(await import('${vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
			yield* generateTemplate(options, ctx);
			yield `export default ${exportExpression}${endOfLine}`;
		}
	}

	yield* ctx.localTypes.generate();
}

function* generateGlobalTypesReference(options: ScriptCodegenOptions): Generator<Code> {
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

function* generateExportDeclareEqual(block: SfcBlock): Generator<Code> {
	yield `const `;
	const token = yield* startBoundary(block.name, 0, codeFeatures.doNotReportTs6133);
	yield names._export;
	yield endBoundary(token, block.content.length);
	yield ` = `;
}
