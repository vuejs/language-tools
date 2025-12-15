import * as path from 'path-browserify';
import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, SfcBlock, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import * as names from '../names';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { createScriptCodegenContext, type ScriptCodegenContext } from './context';
import { generateGeneric, generateScriptSetupImports, generateSetupFunction } from './scriptSetup';
import { generateTemplate } from './template';

const exportExpression = `{} as typeof ${names._export}`;

export interface ScriptCodegenOptions {
	vueCompilerOptions: VueCompilerOptions;
	script: Sfc['script'];
	scriptSetup: Sfc['scriptSetup'];
	fileName: string;
	scriptRanges: ScriptRanges | undefined;
	scriptSetupRanges: ScriptSetupRanges | undefined;
	templateAndStyleTypes: Set<string>;
	templateAndStyleCodes: Code[];
	exposed: Set<string>;
}

export { generate as generateScript };

function generate(options: ScriptCodegenOptions) {
	const ctx = createScriptCodegenContext(options);
	const codeGenerator = generateWorker(options, ctx);
	return { ...ctx, codes: [...codeGenerator] };
}

function* generateWorker(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	const { script, scriptRanges, scriptSetup, scriptSetupRanges, vueCompilerOptions, fileName } = options;

	yield* generateGlobalTypesReference(vueCompilerOptions, fileName);

	// <script src="">
	if (typeof script?.src === 'object') {
		let src = script.src.text;
		if (src.endsWith('.ts') && !src.endsWith('.d.ts')) {
			src = src.slice(0, -'.ts'.length) + '.js';
		}
		else if (src.endsWith('.tsx')) {
			src = src.slice(0, -'.tsx'.length) + '.jsx';
		}

		yield `import __VLS_default from `;
		const token = yield* startBoundary('main', script.src.offset, {
			...codeFeatures.all,
			...src !== script.src.text ? codeFeatures.navigationWithoutRename : {},
		});
		yield `'`;
		yield [src.slice(0, script.src.text.length), 'main', script.src.offset, { __combineToken: token }];
		yield src.slice(script.src.text.length);
		yield `'`;
		yield endBoundary(token, script.src.offset + script.src.text.length);
		yield endOfLine;
		yield `export default __VLS_default;${endOfLine}`;

		yield* generateTemplate(options, ctx, '__VLS_default');
	}
	// <script> + <script setup>
	else if (script && scriptRanges && scriptSetup && scriptSetupRanges) {
		yield* generateScriptSetupImports(scriptSetup, scriptSetupRanges);

		// <script>
		let selfType: string | undefined;
		const exportDefault = scriptRanges.exports.default;
		if (exportDefault) {
			yield* generateScriptWithExportDefault(
				ctx,
				script,
				scriptRanges,
				exportDefault,
				vueCompilerOptions,
				selfType = '__VLS_self',
			);
		}
		else {
			yield* generateSfcBlockSection(script, 0, script.content.length, codeFeatures.all);
			yield `export default ${exportExpression}${endOfLine}`;
		}

		// <script setup>
		yield* generateExportDeclareEqual(scriptSetup, names._export);
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
					generateTemplate(options, ctx, selfType),
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
				generateTemplate(options, ctx, selfType),
				[`return `],
			);
			yield `})()${endOfLine}`;
		}
	}
	// only <script setup>
	else if (scriptSetup && scriptSetupRanges) {
		yield* generateScriptSetupImports(scriptSetup, scriptSetupRanges);

		if (scriptSetup.generic) {
			yield* generateExportDeclareEqual(scriptSetup, names._export);
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
				generateExportDeclareEqual(scriptSetup, names._export),
			);
		}
		yield `export default ${exportExpression}${endOfLine}`;
	}
	// only <script>
	else if (script && scriptRanges) {
		const exportDefault = scriptRanges.exports.default;
		if (exportDefault) {
			yield* generateScriptWithExportDefault(
				ctx,
				script,
				scriptRanges,
				exportDefault,
				vueCompilerOptions,
				names._export,
				generateTemplate(options, ctx, names._export),
			);
		}
		else {
			yield* generateSfcBlockSection(script, 0, script.content.length, codeFeatures.all);
			yield* generateExportDeclareEqual(script, names._export);
			yield `(await import('${vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
			yield* generateTemplate(options, ctx, names._export);
			yield `export default ${exportExpression}${endOfLine}`;
		}
	}

	yield* ctx.localTypes.generate();
}

function* generateScriptWithExportDefault(
	ctx: ScriptCodegenContext,
	script: NonNullable<Sfc['script']>,
	scriptRanges: ScriptRanges,
	exportDefault: NonNullable<ScriptRanges['exports'][string]>,
	vueCompilerOptions: VueCompilerOptions,
	varName: string,
	templateGenerator?: Generator<Code>,
): Generator<Code> {
	const componentOptions = scriptRanges.exports.default?.options;
	const { expression, isObjectLiteral } = componentOptions ?? exportDefault;

	let wrapLeft: string | undefined;
	let wrapRight: string | undefined;
	if (
		isObjectLiteral
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

	yield* generateSfcBlockSection(script, 0, expression.start, codeFeatures.all);
	yield exportExpression;
	yield* generateSfcBlockSection(script, expression.end, exportDefault.end, codeFeatures.all);
	yield endOfLine;
	if (templateGenerator) {
		yield* templateGenerator;
	}
	yield* generateExportDeclareEqual(script, varName);
	if (wrapLeft && wrapRight) {
		yield wrapLeft;
		yield* generateSfcBlockSection(script, expression.start, expression.end, codeFeatures.all);
		yield wrapRight;
	}
	else {
		yield* generateSfcBlockSection(script, expression.start, expression.end, codeFeatures.all);
	}
	yield endOfLine;
	yield* generateSfcBlockSection(script, exportDefault.end, script.content.length, codeFeatures.all);
}

function* generateGlobalTypesReference(
	{ typesRoot, lib, target, checkUnknownProps }: VueCompilerOptions,
	fileName: string,
): Generator<Code> {
	let typesPath: string;
	if (path.isAbsolute(typesRoot)) {
		let relativePath = path.relative(path.dirname(fileName), typesRoot);
		if (
			relativePath !== typesRoot
			&& !relativePath.startsWith('./')
			&& !relativePath.startsWith('../')
		) {
			relativePath = './' + relativePath;
		}
		typesPath = relativePath;
	}
	else {
		typesPath = typesRoot;
	}
	yield `/// <reference types=${JSON.stringify(typesPath + '/template-helpers.d.ts')} />${newLine}`;
	if (!checkUnknownProps) {
		yield `/// <reference types=${JSON.stringify(typesPath + '/props-fallback.d.ts')} />${newLine}`;
	}
	if (lib === 'vue' && target < 3.5) {
		yield `/// <reference types=${JSON.stringify(typesPath + '/vue-3.4-shims.d.ts')} />${newLine}`;
	}
}

function* generateExportDeclareEqual(block: SfcBlock, name: string): Generator<Code> {
	yield `const `;
	const token = yield* startBoundary(block.name, 0, codeFeatures.doNotReportTs6133);
	yield name;
	yield endBoundary(token, block.content.length);
	yield ` = `;
}
