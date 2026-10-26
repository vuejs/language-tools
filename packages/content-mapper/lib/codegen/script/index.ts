import { SpanMapFeature } from '@volar/language-core';
import {
	type IRBlock,
	type IRScript,
	type IRScriptSetup,
	type IRStyle,
	navigationFeatures,
	scriptFeatures,
	type ScriptRanges,
	type ScriptSetupRanges,
	type VueCompilerOptions,
} from '@vue/language-core';
import * as path from 'path-browserify';
import { Boundary, synthesizedIgnore, type TsCode } from '../../boundary';
import { names } from '../names';
import { generateStyleModuleImports } from '../style/modules';
import { asType, endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateCodeWithTransforms } from '../utils/transform';
import { createScriptCodegenContext, type ScriptCodegenContext } from './context';
import { generateGeneric, generateMacros, generateScriptSetupImports, generateSetupFunction } from './scriptSetup';
import { generateTemplate } from './template';

export interface ScriptCodegenOptions {
	vueCompilerOptions: VueCompilerOptions;
	script: IRScript | undefined;
	scriptSetup: IRScriptSetup | undefined;
	styles: readonly IRStyle[];
	fileName: string;
	scriptLang: string;
	scriptRanges: ScriptRanges | undefined;
	scriptSetupRanges: ScriptSetupRanges | undefined;
	templateAndStyleTypes: Set<string>;
	templateAndStyleCodes: TsCode[];
	setupBindings: Set<string>;
	localComponents: Set<string>;
	localDirectives: Set<string>;
	dotValueBindings: Set<string>;
	/** Setup bindings that template and style expressions reference. */
	scopeBindings: Set<string>;
}

export { generate as generateScript };

function* generateSyntheticDefaultExport(exportedExpression: string): Generator<TsCode> {
	// keep the synthetic default export navigable: go-to-definition on
	// `import Foo from './Foo.vue'` targets the whole statement, which maps to the SFC top;
	// a rename reaching it would insert the new name there
	const ignore = yield* Boundary.start('main', 0, 0, synthesizedIgnore);
	const boundary = yield* Boundary.start('main', 0, 0, { features: navigationFeatures & ~SpanMapFeature.Rename });
	yield `export default ${exportedExpression};`;
	yield boundary.end();
	yield ignore.end();
	yield newLine;
}

function generate(options: ScriptCodegenOptions) {
	const ctx = createScriptCodegenContext(options);
	const codeGenerator = generateWorker(options, ctx);
	return { ...ctx, codes: [...codeGenerator] };
}

function* generateWorker(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<TsCode> {
	const { script, scriptRanges, scriptSetup, scriptSetupRanges, vueCompilerOptions, fileName } = options;
	const exportExpression = asType(`typeof ${names.export}`, options.scriptLang);

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

		yield `import ${names.src} from `;
		const boundary = yield* Boundary.start(
			'main',
			script.src.offset,
			script.src.offset + script.src.text.length,
			src !== script.src.text ? { features: scriptFeatures & ~SpanMapFeature.Rename } : { features: scriptFeatures },
		);
		yield `'`;
		yield [src.slice(0, script.src.text.length), 'main', script.src.offset, undefined];
		yield src.slice(script.src.text.length);
		yield `'`;
		yield boundary.end();
		yield endOfLine;
		yield* generateSyntheticDefaultExport(names.src);

		yield* generateTemplate(options, names.src);
	}
	// <script> + <script setup>
	else if (script && scriptRanges && scriptSetup && scriptSetupRanges) {
		yield* generateScriptSetupImports(scriptSetup, scriptSetupRanges);
		yield* generateMacros(options);

		// <script>
		let selfType: string | undefined;
		const { exportDefault } = scriptRanges;
		if (exportDefault) {
			yield* generateScriptWithExportDefault(
				script,
				scriptRanges,
				exportDefault,
				vueCompilerOptions,
				selfType = names.self,
				exportExpression,
			);
		}
		else {
			yield* generateScriptSection(script, 0, script.content.length);
			yield* generateSyntheticDefaultExport(exportExpression);
		}

		// <script setup>
		yield* generateComponentDeclareEqual(scriptSetup, names.export);
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
					generateTemplate(options, selfType),
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
				generateTemplate(options, selfType),
				[`return `],
			);
			yield `})()${endOfLine}`;
		}
	}
	// only <script setup>
	else if (scriptSetup && scriptSetupRanges) {
		yield* generateScriptSetupImports(scriptSetup, scriptSetupRanges);
		yield* generateMacros(options);

		if (scriptSetup.generic) {
			yield* generateComponentDeclareEqual(scriptSetup, names.export);
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
					generateTemplate(options),
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
				generateTemplate(options),
				generateComponentDeclareEqual(scriptSetup, names.export),
			);
		}
		yield* generateSyntheticDefaultExport(exportExpression);
	}
	// only <script>
	else if (script && scriptRanges) {
		const { exportDefault } = scriptRanges;
		if (exportDefault) {
			yield* generateScriptWithExportDefault(
				script,
				scriptRanges,
				exportDefault,
				vueCompilerOptions,
				names.export,
				exportExpression,
				generateTemplate(options, names.export),
			);
		}
		else {
			yield* generateScriptSection(script, 0, script.content.length);
			yield* generateComponentDeclareEqual(script, names.export);
			yield `(await import('${vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
			yield* generateTemplate(options, names.export);
			yield* generateSyntheticDefaultExport(exportExpression);
		}
	}

	yield* ctx.localTypes.generate();
	// after the user's code, which may start with `/// <reference>` or `// @ts-nocheck`
	yield* generateStyleModuleImports(options.styles);
}

function* generateScriptWithExportDefault(
	script: IRScript,
	scriptRanges: ScriptRanges,
	exportDefault: NonNullable<ScriptRanges['exportDefault']>,
	vueCompilerOptions: VueCompilerOptions,
	varName: string,
	exportExpression: string,
	templateGenerator?: Generator<TsCode>,
): Generator<TsCode> {
	const componentOptions = scriptRanges.exportDefault?.options;
	const { expression, isObjectLiteral } = componentOptions ?? exportDefault;

	let wrapLeft: string | undefined;
	let wrapRight: string | undefined;
	if (
		isObjectLiteral
		&& vueCompilerOptions.optionsWrapper.length
	) {
		[wrapLeft, wrapRight] = vueCompilerOptions.optionsWrapper;
	}

	yield* generateScriptSection(script, 0, expression.start);
	yield exportExpression;
	yield* generateScriptSection(script, expression.end, exportDefault.end);
	yield endOfLine;
	if (templateGenerator) {
		yield* templateGenerator;
	}
	yield* generateComponentDeclareEqual(script, varName);
	if (wrapLeft && wrapRight) {
		yield wrapLeft;
		yield* generateScriptSection(script, expression.start, expression.end);
		yield wrapRight;
	}
	else {
		yield* generateScriptSection(script, expression.start, expression.end);
	}
	yield endOfLine;
	yield* generateScriptSection(script, exportDefault.end, script.content.length);
}

/** A copy of the user's code of `<script>`, at `start`..`end` of its content. */
function* generateScriptSection(script: IRScript, start: number, end: number): Generator<TsCode> {
	yield* generateCodeWithTransforms(
		start,
		end,
		[],
		(start, end) => generateSfcBlockSection(script, start, end, { features: scriptFeatures }),
	);
}

function* generateGlobalTypesReference(
	{ typesRoot, lib, target }: VueCompilerOptions,
	fileName: string,
): Generator<TsCode> {
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
	if (lib === 'vue' && target < 3.5) {
		yield `/// <reference types=${JSON.stringify(typesPath + '/vue-3.4-shims.d.ts')} />${newLine}`;
	}
}

// The component declaration has no source of its own: map it to the tag name of its block,
// so that its declaration emit errors (e.g. a private type of a generic component) report there.
function* generateComponentDeclareEqual(block: IRBlock, name: string): Generator<TsCode> {
	const tagNameStart = block.start + 1;
	yield* generateExportDeclareEqual('main', name, tagNameStart, tagNameStart + 'script'.length);
}

export function* generateExportDeclareEqual(
	source: string,
	name: string,
	start: number,
	end: number,
): Generator<TsCode> {
	yield `const `;
	const boundary = yield* Boundary.start(source, start, end, { features: 0 });
	yield name;
	yield boundary.end();
	yield ` = `;
}
