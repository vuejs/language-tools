import { SpanMapFeature } from '@volar/language-core';
import {
	type CodeSource,
	type IR,
	type IRBlock,
	type IRScript,
	type IRScriptSetup,
	navigationFeatures,
	scriptFeatures,
	type ScriptRanges,
	type ScriptSetupRanges,
	type VueCompilerOptions,
} from '@vue/language-core';
import * as path from 'path-browserify';
import { names } from '../names';
import type { ScriptRewrites } from '../plugin';
import { type BlockRewrite, createBlockRewrite, generateBlockAnchor } from '../rewrite/blockRewrite';
import { Boundary, mapped, synthesizedIgnore, type TsCode } from '../tsCode';
import { asType, endOfLine, isTsLang, newLine } from '../writers';
import type { ComponentSlots } from './component';
import { createScriptCodegenContext, type ScriptCodegenContext } from './context';
import {
	createScriptSetupCopies,
	generateGeneric,
	generateMacros,
	generateSetupFunction,
	type ScriptSetupSlots,
} from './scriptSetup';
import { generateTemplate, type TemplateFunctionSlots } from './template';

export interface ScriptCodegenOptions {
	vueCompilerOptions: VueCompilerOptions;
	ir: IR;
	script: IRScript | undefined;
	scriptSetup: IRScriptSetup | undefined;
	fileName: string;
	scriptLang: string;
	scriptRanges: ScriptRanges | undefined;
	scriptSetupRanges: ScriptSetupRanges | undefined;
	/** The names of the types that the code in the template function declares. */
	templateTypes: Set<string>;
	/** The code of the template, in its scope. */
	templateCodes: readonly TsCode[];
	/** The code that ends the scope of the template. */
	templateScopeEnd: readonly TsCode[];
	/** What the codegen plugins write into the slots of the module, the template function and the component. */
	slots: Readonly<ModuleSlots & Omit<TemplateFunctionSlots, 'templateTypes'> & ComponentSlots & ScriptSetupSlots>;
	setupBindings: Set<string>;
	localComponents: Set<string>;
	localDirectives: Set<string>;
	/** The keys searched for each template directive that the `directives` option resolves only by its type. */
	unlistedOptionDirectives: Map<string, string[]>;
	dotValueBindings: Set<string>;
	/** Setup bindings that template and style expressions reference. */
	scopeBindings: Set<string>;
	/** Runs the rewrites of the codegen plugins on the rewrites of the script blocks. */
	rewriteScripts(rewrites: ScriptRewrites): void;
}

/** The slots of the module. */
export interface ModuleSlots {
	/** Statements at module scope, after the user's code. */
	declarations: (readonly TsCode[])[];
	/** Tag → element type maps of native elements; the first replaces the DOM one in this file. */
	elements: (readonly TsCode[])[];
	/** The exports of the component that each plugin sets. */
	exports: ComponentExports[];
}

/** The exports of the component that a plugin sets. */
export interface ComponentExports {
	/** Named exports of the component. */
	names?: readonly string[];
	/** `false` drops the synthetic default export; the first plugin that sets it decides. */
	default?: boolean;
	/** The text of a doc comment of the component, copied onto its exports; the first plugin that sets it decides. */
	docComment?: string;
}

export { generate as generateScript };

function* generateSyntheticDefaultExport(options: ScriptCodegenOptions, exportedExpression: string): Generator<TsCode> {
	const exports = getExports(options);
	if (!exports.default) {
		return;
	}
	if (exports.docComment !== undefined) {
		yield exports.docComment + newLine;
	}
	yield* generateNavigableExport(options.ir, `export default ${exportedExpression};`);
}

function* generateNamedExports(options: ScriptCodegenOptions, exportedExpression: string): Generator<TsCode> {
	const exports = getExports(options);
	for (const exportName of exports.names) {
		if (exports.docComment !== undefined) {
			yield exports.docComment + newLine;
		}
		// `export { … }` rather than `export const`, so that no emitted `export` line names a `__VLS_` declaration
		yield* generateNavigableExport(
			options.ir,
			`const ${exportName} = ${exportedExpression};${newLine}export { ${exportName} };`,
		);
	}
}

/** The exports of the component that the codegen plugins set, combined in their order. */
function getExports({ slots }: ScriptCodegenOptions) {
	return {
		names: [...new Set(slots.exports.flatMap(exports => exports.names ?? []))],
		default: slots.exports.find(exports => exports.default !== undefined)?.default ?? true,
		docComment: slots.exports.find(exports => exports.docComment !== undefined)?.docComment,
	};
}

function* generateNavigableExport(ir: IR, code: string): Generator<TsCode> {
	// keep the synthetic exports navigable: go-to-definition on
	// `import Foo from './Foo.vue'` targets the whole statement, which maps to the SFC top;
	// a rename reaching it would insert the new name there
	const ignore = yield* Boundary.start(ir, 0, 0, synthesizedIgnore);
	const boundary = yield* Boundary.start(ir, 0, 0, { features: navigationFeatures & ~SpanMapFeature.Rename });
	yield code;
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
	let exportExpression = asType(`typeof ${names.export}`, options.scriptLang);
	const rewrites: ScriptRewrites = {
		script: script && createBlockRewrite(script),
		scriptSetup: scriptSetup && createBlockRewrite(scriptSetup),
	};
	options.rewriteScripts(rewrites);

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
			options.ir,
			script.src.offset,
			script.src.offset + script.src.text.length,
			src !== script.src.text ? { features: scriptFeatures & ~SpanMapFeature.Rename } : { features: scriptFeatures },
		);
		yield `'`;
		yield mapped(src.slice(0, script.src.text.length), options.ir, script.src.offset, undefined);
		yield src.slice(script.src.text.length);
		yield `'`;
		yield boundary.end();
		yield endOfLine;
		exportExpression = names.src;
		yield* generateSyntheticDefaultExport(options, exportExpression);

		yield* generateTemplate(options, names.src);
	}
	// <script> + <script setup>
	else if (script && scriptRanges && scriptSetup && scriptSetupRanges) {
		const copies = createScriptSetupCopies(options, rewrites.scriptSetup!, scriptSetup, scriptSetupRanges);
		yield* copies.generateImports();

		// <script>
		let selfType: string | undefined;
		const { exportDefault } = scriptRanges;
		if (exportDefault) {
			yield* generateScriptWithExportDefault(
				script,
				rewrites.script!,
				scriptRanges,
				exportDefault,
				options,
				selfType = names.self,
				exportExpression,
			);
		}
		else {
			yield* generateWholeScript(script, rewrites.script!);
			yield* generateSyntheticDefaultExport(options, exportExpression);
		}

		// <script setup>
		yield* generateMacros(options);
		yield* generateComponentDeclareEqual(options.ir, scriptSetup, names.export);
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
					copies,
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
				copies,
				generateTemplate(options, selfType),
				[`return `],
			);
			yield `})()${endOfLine}`;
		}
	}
	// only <script setup>
	else if (scriptSetup && scriptSetupRanges) {
		const copies = createScriptSetupCopies(options, rewrites.scriptSetup!, scriptSetup, scriptSetupRanges);
		yield* copies.generateImports();
		yield* generateMacros(options);

		if (scriptSetup.generic) {
			yield* generateComponentDeclareEqual(options.ir, scriptSetup, names.export);
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
					copies,
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
				copies,
				generateTemplate(options),
				generateComponentDeclareEqual(options.ir, scriptSetup, names.export),
			);
		}
		yield* generateSyntheticDefaultExport(options, exportExpression);
	}
	// only <script>
	else if (script && scriptRanges) {
		const { exportDefault } = scriptRanges;
		if (exportDefault) {
			yield* generateScriptWithExportDefault(
				script,
				rewrites.script!,
				scriptRanges,
				exportDefault,
				options,
				names.export,
				exportExpression,
				generateTemplate(options, names.export),
			);
		}
		else {
			yield* generateWholeScript(script, rewrites.script!);
			yield* generateComponentDeclareEqual(options.ir, script, names.export);
			yield `(await import('${vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
			yield* generateTemplate(options, names.export);
			yield* generateSyntheticDefaultExport(options, exportExpression);
		}
	}

	yield* generateNamedExports(options, exportExpression);
	yield* ctx.localTypes.generate();
	// after the user's code, which may start with `/// <reference>` or `// @ts-nocheck`
	yield* generateDeclarations(options);
}

function* generateDeclarations({ slots, scriptLang }: ScriptCodegenOptions): Generator<TsCode> {
	const [elements] = slots.elements;
	// the element types that the template reads by `names.Elements`, as a module type that shadows the global one
	if (elements) {
		if (isTsLang(scriptLang)) {
			yield `type ${names.Elements} = `;
			yield* elements;
			yield endOfLine;
		}
		else {
			yield `/** @typedef {`;
			yield* elements;
			yield `} ${names.Elements} */${newLine}`;
		}
	}
	for (const declaration of slots.declarations) {
		yield* declaration;
		yield newLine;
	}
}

function* generateScriptWithExportDefault(
	script: IRScript,
	blockRewrite: BlockRewrite,
	scriptRanges: ScriptRanges,
	exportDefault: NonNullable<ScriptRanges['exportDefault']>,
	{ ir, vueCompilerOptions }: ScriptCodegenOptions,
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

	// the head is the code up to the end of the default export, with the exported expression cut out of it
	const { core } = blockRewrite.rewrite;
	const head = core.cut(0, exportDefault.end, { data: { features: scriptFeatures } });
	const exported = core.cut(expression.start, expression.end, {
		data: { features: scriptFeatures },
		placeholder: exportExpression,
	});
	const tail = exportDefault.end < script.content.length
		? core.cut(exportDefault.end, script.content.length, { data: { features: scriptFeatures } })
		: undefined;

	yield generateBlockAnchor(script);
	yield* blockRewrite.render(head);
	yield endOfLine;
	if (templateGenerator) {
		yield* templateGenerator;
	}
	yield* generateComponentDeclareEqual(ir, script, varName);
	if (wrapLeft && wrapRight) {
		yield wrapLeft;
		yield* blockRewrite.render(exported);
		yield wrapRight;
	}
	else {
		yield* blockRewrite.render(exported);
	}
	yield endOfLine;
	if (tail) {
		yield* blockRewrite.render(tail);
	}
}

function* generateWholeScript(script: IRScript, blockRewrite: BlockRewrite): Generator<TsCode> {
	const whole = blockRewrite.rewrite.core.cut(0, script.content.length, { data: { features: scriptFeatures } });
	yield generateBlockAnchor(script);
	yield* blockRewrite.render(whole);
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

// The component declaration has no source of its own: map it to the tag name of its block, or to the start of a
// block that is not an element, so that its declaration emit errors (e.g. a private type of a generic component)
// report there.
function* generateComponentDeclareEqual(ir: IR, block: IRBlock, name: string): Generator<TsCode> {
	if (block.element) {
		const tagNameStart = block.element.start + 1;
		yield* generateExportDeclareEqual(ir, name, tagNameStart, tagNameStart + 'script'.length);
	}
	else {
		yield* generateExportDeclareEqual(ir, name, block.offset, block.offset);
	}
}

export function* generateExportDeclareEqual(
	source: CodeSource,
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
