import {
	type CodeSource,
	completionFeatures,
	getDefineModelPropName,
	type IRScriptSetup,
	navigationFeatures,
	scriptFeatures,
	type ScriptSetupRanges,
	type TextRange,
} from '@vue/language-core';
import type { CoreRewriteWriter, RewriteSlice } from 'muggle-string';
import { names } from '../names';
import type { TsCodeData } from '../piece';
import { createBlockRewrite, generateBlockAnchor } from '../rewrite/blockRewrite';
import { Boundary, synthesizedIgnore, type TsCode } from '../tsCode';
import {
	asType,
	endOfLine,
	generateSfcBlockSection,
	generateTypeAlias,
	generateTypedVar,
	identifierRE,
	intersectTypes,
	isTsLang,
	newLine,
	typeAliasRef,
} from '../writers';
import { generateCamelized } from '../writers/camelized';
import { generateComponent } from './component';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';
import { getEmitTypes } from './template';

/** The slots of `<script setup>`. */
export interface ScriptSetupSlots {
	/** Object types intersected into what a generic component exposes, after the types of its `defineExpose`. */
	exposedInstanceTypes: string[];
}

/** The hooks of `<script setup>`. */
export interface ScriptSetupHooks {
	/** Edits the user's code of `<script setup>`, after the transforms of the macros, with the core writer. */
	rewriteScriptSetup?(core: CoreRewriteWriter<CodeSource, TsCodeData>, scriptSetup: IRScriptSetup): void;
}

/** The copies of the user's code of `<script setup>`: its imports at module scope, and its body in the setup function. */
export interface ScriptSetupCopies {
	generateImports(): Generator<TsCode>;
	generateBody(): Generator<TsCode>;
}

/**
 * The copies of `<script setup>`, with the transforms of Vue and the script edits of the codegen plugins. The imports
 * and the body are top-level cuts of one rewrite; an empty block has a zero-width body, which renders its inserts.
 */
export function createScriptSetupCopies(
	options: ScriptCodegenOptions,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
): ScriptSetupCopies {
	const blockRewrite = createBlockRewrite(scriptSetup, options.scriptEdits);
	const { core } = blockRewrite.rewrite;
	const importSectionEnd = getImportSectionEnd(scriptSetupRanges);
	const { length } = scriptSetup.content;
	const imports = importSectionEnd > 0
		? core.cut(0, importSectionEnd, { data: { features: scriptFeatures } })
		: undefined;
	const body = importSectionEnd < length || !length
		? core.cut(importSectionEnd, length, { data: { features: scriptFeatures } })
		: undefined;
	addTransforms(options, core, scriptSetupRanges);
	for (const rewrite of options.rewriteScriptSetup) {
		rewrite(core, scriptSetup);
	}
	return {
		*generateImports() {
			yield* generateBlockAnchor(scriptSetup);
			if (imports) {
				yield* blockRewrite.render(imports, false);
			}
		},
		*generateBody() {
			if (body) {
				yield* blockRewrite.render(body);
			}
		},
	};
}

function getImportSectionEnd(scriptSetupRanges: ScriptSetupRanges) {
	return Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset);
}

export function* generateGeneric(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
	generic: NonNullable<IRScriptSetup['generic']>,
	body: Iterable<TsCode>,
): Generator<TsCode> {
	yield `(`;
	if (typeof generic === 'object') {
		const boundary = yield* Boundary.start(
			undefined,
			generic.offset,
			generic.offset + generic.text.length,
			{ features: 0 },
		);
		yield `<`;
		yield [generic.text, undefined, generic.offset, { features: scriptFeatures }];
		if (!generic.text.trimEnd().endsWith(`,`)) {
			yield `,`;
		}
		yield `>`;
		yield boundary.end();
	}
	yield `(${newLine}`
		+ `	${names.props}: NonNullable<Awaited<typeof ${names.setup}>>['props'],${newLine}`
		+ `	${names.ctx}?: ${
			ctx.localTypes.PrettifyLocal(`Pick<NonNullable<Awaited<typeof ${names.setup}>>, 'attrs' | 'emit' | 'slots'>`)
		},${newLine}`
		+ `	${names.exposed}?: NonNullable<Awaited<typeof ${names.setup}>>['expose'],${newLine}`
		+ `	${names.setup} = (async () => {${newLine}`;

	yield* body;

	const propTypes: string[] = [];
	const emitTypes = getEmitTypes(options);
	const { vueCompilerOptions, scriptLang } = options;

	if (ctx.generatedTypes.has(names.PublicProps)) {
		propTypes.push(typeAliasRef(names.PublicProps, scriptLang));
	}
	if (scriptSetupRanges.defineProps?.arg) {
		yield `const ${names.propsOption} = `;
		yield* generateSfcBlockSection(
			scriptSetup,
			scriptSetupRanges.defineProps.arg.start,
			scriptSetupRanges.defineProps.arg.end,
			{ features: navigationFeatures },
			true,
		);
		yield endOfLine;
		propTypes.push(
			`import('${vueCompilerOptions.lib}').ExtractPublicPropTypes<typeof ${names.propsOption}>`,
		);
	}
	const emitProps = emitTypes.length ? typeAliasRef(names.EmitProps, scriptLang) : undefined;
	if (emitProps) {
		propTypes.push(emitProps);
	}
	if (options.templateTypes.has(names.InheritedAttrs)) {
		const inheritedAttrs = typeAliasRef(names.InheritedAttrs, scriptLang);
		propTypes.push(emitProps ? `Omit<${inheritedAttrs}, keyof ${emitProps}>` : inheritedAttrs);
	}

	yield `return {} as {${newLine}`;
	yield `	props: `;
	yield vueCompilerOptions.target >= 3.4
		? `import('${vueCompilerOptions.lib}').PublicProps`
		: `import('${vueCompilerOptions.lib}').VNodeProps`
			+ ` & import('${vueCompilerOptions.lib}').AllowedComponentProps`
			+ ` & import('${vueCompilerOptions.lib}').ComponentCustomProps`;
	if (propTypes.length) {
		yield ` & ${ctx.localTypes.PrettifyLocal(propTypes.join(` & `))}`;
	}
	yield endOfLine;
	yield `	expose: (exposed: `;
	const exposeTypes = getExposeTypes(options, scriptSetupRanges);
	if (exposeTypes.length) {
		yield `import('${vueCompilerOptions.lib}').ShallowUnwrapRef<`;
		yield* intersectTypes(exposeTypes);
		yield `>`;
	}
	else {
		yield `{}`;
	}
	if (
		options.vueCompilerOptions.inferComponentDollarRefs
		&& options.templateTypes.has(names.TemplateRefs)
	) {
		yield ` & { $refs: ${typeAliasRef(names.TemplateRefs, scriptLang)}; }`;
	}
	for (const type of options.slots.exposedInstanceTypes) {
		yield ` & ${type}`;
	}
	yield `) => void${endOfLine}`;
	yield `	attrs: any${endOfLine}`;
	yield `	slots: ${hasSlotsType(options) ? typeAliasRef(names.Slots, scriptLang) : `{}`}${endOfLine}`;
	yield `	emit: `;
	yield* emitTypes.length ? intersectTypes(emitTypes) : [`{}`];
	yield endOfLine;
	yield `}${endOfLine}`;
	yield `})(),${newLine}`; // __VLS_setup = (async () => {
	yield `) => ({} as import('${vueCompilerOptions.lib}').VNode & { __ctx?: NonNullable<Awaited<typeof ${names.setup}>> }))${endOfLine}`;
}

export function* generateSetupFunction(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
	copies: ScriptSetupCopies,
	body: Iterable<TsCode>,
	output?: Iterable<TsCode>,
): Generator<TsCode> {
	yield* copies.generateBody();
	yield* generateModels(options, scriptSetup, scriptSetupRanges);
	yield* generatePublicProps(options, ctx, scriptSetup, scriptSetupRanges);
	yield* body;

	if (output) {
		if (hasSlotsType(options)) {
			yield `const ${names.base} = `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
			yield* output;
			yield asType(
				ctx.localTypes.WithSlots(`typeof ${names.base}`, typeAliasRef(names.Slots, options.scriptLang)),
				options.scriptLang,
			);
			yield endOfLine;
		}
		else {
			yield* output;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
		}
	}
}

// An `import` (rather than `declare const`) keeps the macros resolvable in JS
// virtual files, where type-only declarations are syntax errors. Imports hoist,
// so this can be emitted after all user content: leading directives stay ahead
// of any statement, and the import-section/content junction stays intact.
export function* generateMacros(options: ScriptCodegenOptions): Generator<TsCode> {
	if (options.vueCompilerOptions.target >= 3.3) {
		const scriptSetup = options.scriptSetup;
		const scriptSetupRanges = options.scriptSetupRanges;
		if (!scriptSetup || !scriptSetupRanges) {
			return;
		}

		const usedMacros: { canonical: string; alias: string }[] = [];
		const add = (canonical: string, exp: TextRange | undefined) => {
			if (exp) {
				usedMacros.push({ canonical, alias: getRangeText(scriptSetup, exp) });
			}
		};
		add('defineProps', scriptSetupRanges.defineProps?.exp);
		add('defineEmits', scriptSetupRanges.defineEmits?.exp);
		add('defineSlots', scriptSetupRanges.defineSlots?.exp);
		add('defineExpose', scriptSetupRanges.defineExpose?.exp);
		add('withDefaults', scriptSetupRanges.withDefaults?.exp);
		if (scriptSetupRanges.defineModel.length) {
			usedMacros.push({ canonical: 'defineModel', alias: 'defineModel' });
		}
		if (scriptSetupRanges.defineOptions) {
			usedMacros.push({ canonical: 'defineOptions', alias: 'defineOptions' });
		}

		const toImport = usedMacros.filter(({ alias }) => !options.setupBindings.has(alias));

		if (toImport.length) {
			yield `${newLine}const { `;
			for (const { canonical, alias } of toImport) {
				yield alias === canonical ? `${canonical}, ` : `${canonical}: ${alias}, `;
			}
			yield `} = `;
			yield asType(`typeof import('${options.vueCompilerOptions.lib}')`, options.scriptLang);
			yield endOfLine;
		}
	}
}

function addTransforms(
	options: ScriptCodegenOptions,
	core: CoreRewriteWriter<CodeSource, TsCodeData>,
	scriptSetupRanges: ScriptSetupRanges,
) {
	const runtimeDefineProps = scriptSetupRanges.defineProps?.typeArg ? undefined : scriptSetupRanges.defineProps;
	if (runtimeDefineProps && scriptSetupRanges.defineModel.some(({ defaultPropsArg }) => defaultPropsArg)) {
		// the parameter of `default` may have the name of the props, which `typeof` in its own annotation would refer to
		core.insertAfter(runtimeDefineProps.statement.end, function*() {
			yield newLine;
			yield* generateTypeAlias(names.RuntimeProps, options.scriptLang, function*() {
				yield `typeof ${runtimeDefineProps.name ?? names.props}`;
			});
		});
	}
	const defaultPropsType = scriptSetupRanges.defineProps?.typeArg
		? names.Props
		: runtimeDefineProps
		? typeAliasRef(names.RuntimeProps, options.scriptLang)
		: `typeof ${names.props}`;
	for (const { defaultPropsArg } of scriptSetupRanges.defineModel) {
		if (!defaultPropsArg) {
			continue;
		}
		if (isTsLang(options.scriptLang)) {
			core.insertAfter(defaultPropsArg.end, `: ${defaultPropsType}`);
		}
		else {
			core.insertBefore(defaultPropsArg.start, `/** @type {${defaultPropsType}} */ `);
		}
	}
	if (scriptSetupRanges.defineProps) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineProps;
		const _callExp = scriptSetupRanges.withDefaults?.callExp ?? callExp;
		addDefineWithTypeTransforms(core, statement, _callExp, typeArg, name, names.props, names.Props);
	}
	if (scriptSetupRanges.defineEmits) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineEmits;
		addDefineWithTypeTransforms(core, statement, callExp, typeArg, name, names.emit, names.Emit);
	}
	if (scriptSetupRanges.defineSlots) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineSlots;
		addDefineWithTypeTransforms(core, statement, callExp, typeArg, name, names.slots, names.Slots);
		if (!name) {
			core.insertAfter(statement.end, `${newLine}void ${names.slots}${endOfLine}`);
		}
	}
	if (scriptSetupRanges.defineExpose) {
		const { callExp, arg, typeArg } = scriptSetupRanges.defineExpose;
		if (typeArg) {
			const type = cutScriptCode(core, typeArg, `typeof ${names.exposed}`);
			core.insertBefore(callExp.start, () => [`let ${names.exposed}!: `, type, endOfLine]);
		}
		else if (arg) {
			const value = cutScriptCode(core, arg, names.exposed);
			core.insertBefore(callExp.start, () => [`const ${names.exposed} = `, value, endOfLine]);
		}
		else {
			core.insertBefore(callExp.start, `const ${names.exposed} = {}${endOfLine}`);
		}
	}
	for (const { callExp, arg } of scriptSetupRanges.useTemplateRef) {
		// the argument is copied as a reference into the cast, and is `any` at the call
		const name = arg && cutReference(core, arg, asType('any', options.scriptLang));
		const refType = name
			? [typeAliasRef(names.TemplateRefs, options.scriptLang), `[`, name, `]`]
			: [`unknown`];
		const shallowRef = `Readonly<import('${options.vueCompilerOptions.lib}').ShallowRef<`;
		if (isTsLang(options.scriptLang)) {
			core.insertBefore(callExp.start, `(`);
			core.insertAfter(callExp.end, () => [` as ${shallowRef}`, ...refType, ` | null>>)`]);
		}
		else {
			core.insertBefore(callExp.start, () => [`/** @type {${shallowRef}`, ...refType, ` | null>>} */ (`]);
			core.insertAfter(callExp.end, `)`);
		}
	}
}

/** The user's code at `range`, which `placeholder` takes the place of; it maps as script code where it is placed. */
function cutScriptCode(core: CoreRewriteWriter<CodeSource, TsCodeData>, range: TextRange, placeholder: string) {
	return core.cut(range.start, range.end, { data: { features: scriptFeatures }, placeholder });
}

/** The user's code at `range`, which `placeholder` takes the place of; it maps as a reference where it is placed. */
function cutReference(core: CoreRewriteWriter<CodeSource, TsCodeData>, range: TextRange, placeholder: string) {
	return core.cut(range.start, range.end, { data: { features: navigationFeatures | completionFeatures }, placeholder });
}

/**
 * Hoists the type argument of a macro into the alias `typeName`, and an unnamed or destructured call into the variable
 * `defaultName`, which the statement then reads: the statement up to the call is cut and placed after the call (or
 * after the statement, for a name that is not an identifier), and the alias goes with what takes its place.
 */
function addDefineWithTypeTransforms(
	core: CoreRewriteWriter<CodeSource, TsCodeData>,
	statement: TextRange,
	callExp: TextRange,
	typeArg: TextRange | undefined,
	name: string | undefined,
	defaultName: string,
	typeName: string,
) {
	const alias: (string | RewriteSlice<CodeSource, TsCodeData>)[] = typeArg
		? [`type ${typeName} = `, cutScriptCode(core, typeArg, typeName), endOfLine]
		: [];
	if (name && identifierRE.test(name)) {
		if (alias.length) {
			core.insertBefore(statement.start, () => alias);
		}
		return;
	}
	const declaration = [...alias, `const ${defaultName} = `];
	if (!name && statement.start === callExp.start && statement.end === callExp.end) {
		core.insertBefore(statement.start, () => declaration);
		return;
	}
	let prefix: RewriteSlice<CodeSource, TsCodeData> | undefined;
	if (statement.start < callExp.start) {
		prefix = core.cut(statement.start, callExp.start, {
			data: { features: scriptFeatures },
			placeholder: () => declaration,
		});
	}
	else {
		core.insertBefore(statement.start, () => declaration);
	}
	core.insertAfter(name ? statement.end : callExp.end, () => [endOfLine, ...prefix ? [prefix] : [], defaultName]);
}

function* generatePublicProps(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<TsCode> {
	const { defineProps, withDefaults, defineModel } = scriptSetupRanges;
	const defaults: string[] = [];
	if (defineProps?.typeArg && withDefaults?.arg) {
		yield `const ${names.defaults} = `;
		yield* generateSfcBlockSection(
			scriptSetup,
			withDefaults.arg.start,
			withDefaults.arg.end,
			{ features: navigationFeatures },
			true,
		);
		yield endOfLine;
		yield `void ${names.defaults}${endOfLine}`;
		defaults.push(`typeof ${names.defaults}`);
	}
	// Vue applies the defaults of a destructure from 3.5, unless `withDefaults` is used
	else if (
		options.vueCompilerOptions.target >= 3.5
		&& !withDefaults
		&& defineProps?.destructuredDefaults?.length
	) {
		yield `const ${names.defaults} = {${newLine}`;
		for (const { key, value } of defineProps.destructuredDefaults) {
			// a destructure default is the value, which the `default` option of a prop gives through a factory
			yield `${key}: () => (${getRangeText(scriptSetup, value)}),${newLine}`;
		}
		yield `}${endOfLine}`;
		yield `void ${names.defaults}${endOfLine}`;
		defaults.push(`typeof ${names.defaults}`);
	}
	if (defineModel.some(model => model.defaultValue)) {
		defaults.push(`typeof ${names.defaultModels}`);
	}
	if (defaults.length) {
		const props: string[] = [];
		if (defineProps) {
			props.push(
				defineProps.typeArg
					? names.Props
					: `typeof ${defineProps.name && identifierRE.test(defineProps.name) ? defineProps.name : names.props}`,
			);
		}
		if (defineModel.length) {
			props.push(typeAliasRef(names.ModelProps, options.scriptLang));
		}
		ctx.propDefaults = { props, defaults };
	}

	const propTypes: (string | TsCode[])[] = [];
	if (options.vueCompilerOptions.jsxSlots && hasSlotsType(options)) {
		propTypes.push(ctx.localTypes.PropsChildren(typeAliasRef(names.Slots, options.scriptLang)));
	}
	if (scriptSetupRanges.defineProps?.typeArg) {
		propTypes.push(names.Props);
	}
	if (scriptSetupRanges.defineModel.length) {
		propTypes.push(typeAliasRef(names.ModelProps, options.scriptLang));
	}
	propTypes.push(...options.props);
	const target = options.vueCompilerOptions.target;
	const used = !!scriptSetup.generic
		|| target < 3.6
		|| (target >= 3.5 && !scriptSetupRanges.defineProps?.arg)
		|| !!options.props.length
		|| !!scriptSetupRanges.defineModel.length;
	if (propTypes.length && used) {
		yield* generateTypeAlias(names.PublicProps, options.scriptLang, function*() {
			yield* intersectTypes(propTypes);
		});
		ctx.generatedTypes.add(names.PublicProps);
	}
}

/** The types of what a script setup component exposes, which the codegen plugins add to. */
export function getExposeTypes(
	options: ScriptCodegenOptions,
	scriptSetupRanges: ScriptSetupRanges,
): (string | TsCode[])[] {
	return [
		...scriptSetupRanges.defineExpose ? [`typeof ${names.exposed}`] : [],
		...options.expose,
	];
}

function hasSlotsType(options: ScriptCodegenOptions): boolean {
	return !!(
		options.scriptSetupRanges?.defineSlots
		|| options.templateTypes.has(names.Slots)
	);
}

function* generateModels(
	options: ScriptCodegenOptions,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<TsCode> {
	if (!scriptSetupRanges.defineModel.length) {
		return;
	}

	const defaultCodes: string[] = [];
	const propCodes: Generator<TsCode>[] = [];
	const emitCodes: Generator<TsCode>[] = [];

	for (const defineModel of scriptSetupRanges.defineModel) {
		const propName = getDefineModelPropName(scriptSetup, defineModel);

		let modelType: string;
		if (defineModel.type) {
			// Infer from defineModel<T>
			modelType = getRangeText(scriptSetup, defineModel.type);
		}
		else if (defineModel.runtimeType && defineModel.localName) {
			// Infer from actual prop declaration code
			modelType = `typeof ${getRangeText(scriptSetup, defineModel.localName)}['value']`;
		}
		else if (defineModel.defaultValue && propName) {
			// Infer from defineModel({ default: T })
			modelType = `typeof ${names.defaultModels}['${propName}']`;
		}
		else {
			modelType = `any`;
		}

		if (defineModel.defaultValue) {
			defaultCodes.push(
				`'${propName}': ${getRangeText(scriptSetup, defineModel.defaultValue)},${newLine}`,
			);
		}

		propCodes.push(generateModelProp(options, scriptSetup, defineModel, propName, modelType));
		emitCodes.push(generateModelEmit(defineModel, propName, modelType));
	}

	if (defaultCodes.length) {
		yield `const ${names.defaultModels} = {${newLine}`;
		yield* defaultCodes;
		yield `}${endOfLine}`;
		yield `void ${names.defaultModels}${endOfLine}`;
	}

	yield* generateTypeAlias(names.ModelProps, options.scriptLang, function*() {
		yield `{${newLine}`;
		for (const codes of propCodes) {
			yield* codes;
		}
		yield `}`;
	});

	yield* generateTypeAlias(names.ModelEmit, options.scriptLang, function*() {
		yield `{${newLine}`;
		for (const codes of emitCodes) {
			yield* codes;
		}
		yield `}`;
	});

	// avoid `defineModel<...>()` to prevent JS AST issues
	yield* generateTypedVar('let', names.modelEmit, options.scriptLang, function*() {
		yield `${names.ShortEmits}<${typeAliasRef(names.ModelEmit, options.scriptLang)}>`;
	});
}

function* generateModelProp(
	options: ScriptCodegenOptions,
	scriptSetup: IRScriptSetup,
	defineModel: ScriptSetupRanges['defineModel'][number],
	propName: string,
	modelType: string,
): Generator<TsCode> {
	// In JS the alias body lives inside a JSDoc comment; user comments could
	// contain `*/` and terminate it early, so they are dropped.
	if (defineModel.comments && isTsLang(options.scriptLang)) {
		yield scriptSetup.content.slice(defineModel.comments.start, defineModel.comments.end);
		yield newLine;
	}

	if (defineModel.name) {
		const ignore = yield* Boundary.start(scriptSetup, 0, 0, synthesizedIgnore);
		yield* generateCamelized(
			getRangeText(scriptSetup, defineModel.name),
			scriptSetup,
			defineModel.name.start,
			{ features: navigationFeatures },
		);
		yield ignore.end();
	}
	else {
		yield propName;
	}

	yield defineModel.required ? `: ` : `?: `;
	yield modelType;
	yield endOfLine;

	if (defineModel.modifierType) {
		const modifierName = `${propName === 'modelValue' ? 'model' : propName}Modifiers`;
		const modifierType = getRangeText(scriptSetup, defineModel.modifierType);
		yield `'${modifierName}'?: Partial<Record<${modifierType}, true>>${endOfLine}`;
	}
}

function* generateModelEmit(
	defineModel: ScriptSetupRanges['defineModel'][number],
	propName: string,
	modelType: string,
): Generator<TsCode> {
	yield `'update:${propName}': [value: `;
	yield modelType;
	if (!defineModel.required && !defineModel.defaultValue) {
		yield ` | undefined`;
	}
	yield `]${endOfLine}`;
}

function getRangeText(
	scriptSetup: IRScriptSetup,
	range: TextRange,
) {
	return scriptSetup.content.slice(range.start, range.end);
}
