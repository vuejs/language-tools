import { type IRScriptSetup, scriptFeatures, type ScriptSetupRanges, type TextRange } from '@vue/language-core';
import { names } from '../names';
import { type BlockRewrite, type BlockSlice, type BlockWriter, generateBlockAnchor } from '../rewrite/blockRewrite';
import { Boundary, mapped, type TsCode } from '../tsCode';
import {
	asType,
	endOfLine,
	generateTypeAlias,
	identifierRE,
	intersectTypes,
	isTsLang,
	newLine,
	typeAliasRef,
} from '../writers';
import { generateSpreadMerge } from '../writers/merge';
import { generateComponent } from './component';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

/** The slots of `<script setup>`. */
export interface ScriptSetupSlots {
	/** Statements in the setup function, after the user's code. */
	setupBody: TsCode[];
	/** The props of the component, each with its type, its runtime option, or both. */
	props: PropsDeclaration[];
	/** The emits of the component, each with its type, its emit function, or both. */
	emits: EmitsDeclaration[];
	/** Object types intersected into what the component exposes, in `defineExpose` form. */
	expose: (readonly TsCode[])[];
	/** Object types intersected into what a generic component exposes, after the types of its `defineExpose`. */
	exposedInstanceTypes: (readonly TsCode[])[];
	/** Type parameters of the component, after those of its `generic` attribute; with one, the component is generic. */
	generic: (readonly TsCode[])[];
	/** Object types intersected into the slots of the component, e.g. what `defineSlots` declares; else any slot. */
	componentSlots: string[];
}

export interface PropsDeclaration {
	/** An object type of the props in `defineProps<…>` form; a string as text. */
	type: string | readonly TsCode[] | undefined;
	/** The type of the props that the template reads in place of `type`. */
	local: string | undefined;
	/** An expression of the runtime option of the props. */
	runtime: readonly TsCode[] | undefined;
	/** The type of an object whose properties are the `default` options of props, which `type` or else `local` take. */
	defaults: string | undefined;
}

export interface EmitsDeclaration {
	/** An object type of the emits in `defineEmits<…>` form, or `{ event: [args] }` without `emit`; a string as text. */
	type: string | readonly TsCode[] | undefined;
	/** The type of the emit function; with one, `type` is text. */
	emit: string | undefined;
}

/** The copies of the user's code of `<script setup>`: its imports at module scope, and its body in the setup function. */
export interface ScriptSetupCopies {
	generateImports(): Generator<TsCode>;
	generateBody(): Generator<TsCode>;
}

/**
 * The copies of `<script setup>` of `blockRewrite`, with the transforms of Vue. With `bodyAtRoot`, the body follows
 * the imports and the macros at module scope, so one cut copies the whole block, with the macros inserted after the
 * imports, and the imports render it all. Otherwise the imports and the body are top-level cuts of one rewrite; an
 * empty block has a zero-width body, which renders its inserts.
 */
export function createScriptSetupCopies(
	options: ScriptCodegenOptions,
	blockRewrite: BlockRewrite,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
	bodyAtRoot: boolean,
): ScriptSetupCopies {
	const rewrite = blockRewrite.rewrite;
	const importSectionEnd = getImportSectionEnd(scriptSetupRanges);
	const { length } = scriptSetup.content;
	if (bodyAtRoot) {
		const whole = rewrite.cut(0, length, { data: { features: scriptFeatures } });
		addTransforms(options, blockRewrite, scriptSetupRanges);
		const macros = [...generateMacros(options)];
		if (macros.length) {
			blockRewrite.insertAfter(importSectionEnd, macros);
		}
		return {
			*generateImports() {
				yield generateBlockAnchor(scriptSetup);
				yield* blockRewrite.render(whole);
			},
			*generateBody() {},
		};
	}
	const imports = importSectionEnd > 0
		? rewrite.cut(0, importSectionEnd, { data: { features: scriptFeatures } })
		: undefined;
	const body = importSectionEnd < length || !length
		? rewrite.cut(importSectionEnd, length, { data: { features: scriptFeatures } })
		: undefined;
	addTransforms(options, blockRewrite, scriptSetupRanges);
	return {
		*generateImports() {
			yield generateBlockAnchor(scriptSetup);
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

/** Whether the component of `scriptSetup` is generic, by its `generic` attribute or the codegen plugins. */
export function isGeneric(options: ScriptCodegenOptions, scriptSetup: IRScriptSetup): boolean {
	return !!scriptSetup.generic || !!options.slots.generic.length;
}

function* generatePluginTypeParameters(options: ScriptCodegenOptions): Generator<TsCode> {
	for (const parameter of options.slots.generic) {
		yield* parameter;
		yield `,`;
	}
}

export function* generateGeneric(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
	body: Iterable<TsCode>,
): Generator<TsCode> {
	const { generic } = scriptSetup;
	yield `(`;
	if (typeof generic === 'object') {
		const boundary = yield* Boundary.start(
			options.ir,
			generic.offset,
			generic.offset + generic.text.length,
			{ features: 0 },
		);
		yield `<`;
		yield mapped(generic.text, options.ir, generic.offset, { features: scriptFeatures });
		if (!generic.text.trimEnd().endsWith(`,`)) {
			yield `,`;
		}
		yield* generatePluginTypeParameters(options);
		yield `>`;
		yield boundary.end();
	}
	else if (options.slots.generic.length) {
		yield `<`;
		yield* generatePluginTypeParameters(options);
		yield `>`;
	}
	// not a name of the generated code: the code of setup may declare its own, which shadows it
	yield `(${newLine}`
		+ `	__VLS_props: NonNullable<Awaited<typeof ${names.setup}>>['props'],${newLine}`
		+ `	${names.ctx}?: ${
			ctx.localTypes.PrettifyLocal(`Pick<NonNullable<Awaited<typeof ${names.setup}>>, 'attrs' | 'emit' | 'slots'>`)
		},${newLine}`
		+ `	${names.exposed}?: NonNullable<Awaited<typeof ${names.setup}>>['expose'],${newLine}`
		+ `	${names.setup} = (async () => {${newLine}`;

	yield* body;

	const propTypes: string[] = [];
	const emitTypes = getComponentEmits(options).functions;
	const { vueCompilerOptions, scriptLang } = options;

	if (ctx.generatedTypes.has(names.PublicProps)) {
		propTypes.push(typeAliasRef(names.PublicProps, scriptLang));
	}
	const { runtime } = getComponentProps(options);
	if (runtime.length) {
		yield `const ${names.propsOption} = `;
		yield* generateSpreadMerge(...runtime);
		yield endOfLine;
		propTypes.push(
			`import('${vueCompilerOptions.lib}').ExtractPublicPropTypes<typeof ${names.propsOption}>`,
		);
	}
	const emitProps = emitTypes.length ? typeAliasRef(names.EmitProps, scriptLang) : undefined;
	if (emitProps) {
		propTypes.push(emitProps);
	}
	for (const type of options.slots.fallthroughProps) {
		propTypes.push(emitProps ? `Omit<${type}, keyof ${emitProps}>` : type);
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
	for (const type of options.slots.exposedInstanceTypes) {
		yield ` & `;
		yield* type;
	}
	yield `) => void${endOfLine}`;
	yield `	attrs: any${endOfLine}`;
	yield `	slots: ${getSlotsType(options) ?? `Record<string, any>`}${endOfLine}`;
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
	yield* options.slots.setupBody;
	yield* generatePluginTypes(options);
	yield* generatePublicProps(options, ctx, scriptSetup);
	yield* body;

	if (output) {
		const slotsType = getSlotsType(options);
		if (slotsType) {
			yield `const ${names.base} = `;
			yield* generateComponent(options, ctx, scriptSetupRanges);
			yield endOfLine;
			yield* output;
			yield asType(
				ctx.localTypes.WithSlots(`typeof ${names.base}`, slotsType),
				options.scriptLang,
			);
			yield endOfLine;
		}
		else {
			yield* output;
			yield* generateComponent(options, ctx, scriptSetupRanges);
			yield endOfLine;
		}
	}
}

// An `import` (rather than `declare const`) keeps the macros resolvable in JS
// virtual files, where type-only declarations are syntax errors. Imports hoist,
// so this can be emitted after all user content: leading directives stay ahead
// of any statement, and the import-section/content junction stays intact.
export function* generateMacros(options: ScriptCodegenOptions): Generator<string> {
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
	writer: BlockWriter,
	scriptSetupRanges: ScriptSetupRanges,
) {
	if (scriptSetupRanges.defineExpose) {
		const { callExp, arg, typeArg } = scriptSetupRanges.defineExpose;
		if (typeArg) {
			const type = cutScriptCode(writer, typeArg, `typeof ${names.exposed}`);
			writer.insertBefore(callExp.start, [`let ${names.exposed}!: `, type, endOfLine]);
		}
		else if (arg) {
			const value = cutScriptCode(writer, arg, names.exposed);
			writer.insertBefore(callExp.start, [`const ${names.exposed} = `, value, endOfLine]);
		}
		else {
			writer.insertBefore(callExp.start, `const ${names.exposed} = {}${endOfLine}`);
		}
	}
	const { inferTemplateDollarAttrs, inferTemplateDollarSlots } = options.vueCompilerOptions;
	const isTs = isTsLang(options.scriptLang);
	for (
		const [{ callExp }, name] of [
			...inferTemplateDollarAttrs ? scriptSetupRanges.useAttrs.map(call => [call, '$attrs'] as const) : [],
			...inferTemplateDollarSlots ? scriptSetupRanges.useSlots.map(call => [call, '$slots'] as const) : [],
		]
	) {
		const type = `typeof ${names.dollars}.${name}`;
		writer.insertBefore(callExp.start, isTs ? `(` : `/** @type {${type}} */ (`);
		writer.insertAfter(callExp.end, isTs ? ` as ${type})` : `)`);
	}
}

/** The user's code at `range`, which `placeholder` takes the place of; it maps as script code where it is placed. */
function cutScriptCode(writer: BlockWriter, range: TextRange, placeholder: string) {
	return writer.cut(range.node, { data: { features: scriptFeatures }, placeholder });
}

/**
 * Hoists the type argument of a macro into the alias `typeName`, and an unnamed or destructured call into the variable
 * `defaultName`, which the statement then reads: a call after the start of its statement is cut and placed before the
 * statement, with the alias, and a call that starts its statement is declared in place.
 */
export function addDefineWithTypeTransforms(
	writer: BlockWriter,
	statement: TextRange,
	callExp: TextRange,
	typeArg: TextRange | undefined,
	name: string | undefined,
	defaultName: string,
	typeName: string,
) {
	const alias: (string | BlockSlice)[] = typeArg
		? [`type ${typeName} = `, cutScriptCode(writer, typeArg, typeName), endOfLine]
		: [];
	if (name && identifierRE.test(name)) {
		if (alias.length) {
			writer.insertBefore(statement.start, alias);
		}
		return;
	}
	const declaration = [...alias, `const ${defaultName} = `];
	if (!name && statement.start === callExp.start && statement.end === callExp.end) {
		writer.insertBefore(statement.start, declaration);
		return;
	}
	if (statement.start < callExp.start) {
		writer.insertBefore(statement.start, [...declaration, cutScriptCode(writer, callExp, defaultName), endOfLine]);
		return;
	}
	writer.insertBefore(statement.start, declaration);
	writer.insertAfter(name ? statement.end : callExp.end, [endOfLine, defaultName]);
}

/**
 * The types of the props and the emits that the codegen plugins declare by code that is not text, each as one alias,
 * which places their code once for the component and the template to read.
 */
function* generatePluginTypes(options: ScriptCodegenOptions): Generator<TsCode> {
	const { scriptLang } = options;
	const propTypes = getPluginPropTypes(options);
	if (propTypes.length) {
		yield* generateTypeAlias(names.PluginProps, scriptLang, function*() {
			yield* intersectTypes(propTypes);
		});
	}
	const emitTypes = getPluginEmitTypes(options);
	if (emitTypes.length) {
		yield* generateTypeAlias(names.PluginEmits, scriptLang, function*() {
			yield* intersectTypes(emitTypes);
		});
	}
}

/** The props of a script setup component, which the codegen plugins declare. */
export interface ComponentProps {
	/** The types of the props in `defineProps<…>` form. */
	types: string[];
	/** The types of the props that the template reads. */
	templateTypes: string[];
	/** The expressions of the runtime options of the props. */
	runtime: (readonly TsCode[])[];
	/** The types of the props that take defaults, and of the objects of their `default` options. */
	defaults: { props: string[]; defaults: string[] } | undefined;
}

/**
 * The props of a script setup component, those whose type is not text as the alias of all of them, where the first of
 * them is.
 */
export function getComponentProps({ scriptSetupRanges, slots, scriptLang }: ScriptCodegenOptions): ComponentProps {
	const props: ComponentProps = { types: [], templateTypes: [], runtime: [], defaults: undefined };
	if (!scriptSetupRanges) {
		return props;
	}
	const pluginProps = typeAliasRef(names.PluginProps, scriptLang);
	let hasPluginProps = false;
	const defaultProps: string[] = [];
	const defaults: string[] = [];
	for (const declaration of slots.props) {
		let type: string | undefined;
		if (typeof declaration.type !== 'object') {
			type = declaration.type;
		}
		else if (!hasPluginProps) {
			hasPluginProps = true;
			type = pluginProps;
		}
		if (type !== undefined) {
			props.types.push(type);
		}
		const own = declaration.local ?? type;
		if (own !== undefined) {
			props.templateTypes.push(own);
		}
		const defaultsOf = type ?? declaration.local;
		if (defaultsOf !== undefined) {
			defaultProps.push(defaultsOf);
		}
		if (declaration.defaults !== undefined) {
			defaults.push(declaration.defaults);
		}
		if (declaration.runtime) {
			props.runtime.push(declaration.runtime);
		}
	}
	if (defaults.length) {
		props.defaults = { props: defaultProps, defaults };
	}
	return props;
}

/** The emits of a script setup component, which the codegen plugins declare. */
export interface ComponentEmits {
	/** The types of the emits in `defineEmits<…>` form, when each declaration has one. */
	types: string[] | undefined;
	/** The types of the emit functions. */
	functions: string[];
}

/**
 * The emits of a script setup component, those whose type is not text as the alias of all of them, where the first of
 * them is.
 */
export function getComponentEmits({ scriptSetupRanges, slots, scriptLang }: ScriptCodegenOptions): ComponentEmits {
	const emits: ComponentEmits = { types: [], functions: [] };
	if (!scriptSetupRanges) {
		return emits;
	}
	const pluginEmits = typeAliasRef(names.PluginEmits, scriptLang);
	let hasPluginEmits = false;
	for (const { type, emit } of slots.emits) {
		if (typeof type === 'object') {
			if (!hasPluginEmits) {
				hasPluginEmits = true;
				emits.types?.push(pluginEmits);
				emits.functions.push(`${names.ShortEmits}<${pluginEmits}>`);
			}
		}
		else {
			if (type === undefined) {
				emits.types = undefined;
			}
			else {
				emits.types?.push(type);
			}
			emits.functions.push(emit ?? `${names.ShortEmits}<${type}>`);
		}
	}
	return emits;
}

/** The types of the emits that the codegen plugins declare by types that are not text, which one alias places. */
function getPluginEmitTypes({ slots }: ScriptCodegenOptions): (readonly TsCode[])[] {
	return slots.emits.flatMap(({ type }) => typeof type === 'object' ? [type] : []);
}

/** The types of the props that the codegen plugins declare by types that are not text, which one alias places. */
function getPluginPropTypes({ slots }: ScriptCodegenOptions): (readonly TsCode[])[] {
	return slots.props.flatMap(({ type }) => typeof type === 'object' ? [type] : []);
}

function* generatePublicProps(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
): Generator<TsCode> {
	const { types, runtime } = getComponentProps(options);
	const propTypes: string[] = [];
	const slotsType = getSlotsType(options);
	if (options.vueCompilerOptions.jsxSlots && slotsType) {
		propTypes.push(ctx.localTypes.PropsChildren(slotsType));
	}
	propTypes.push(...types);
	// a runtime option alone types the props of a 3.6 component that is not generic
	const used = isGeneric(options, scriptSetup)
		|| options.vueCompilerOptions.target < 3.6
		|| !runtime.length
		|| !!types.length;
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
): (string | readonly TsCode[])[] {
	return [
		...scriptSetupRanges.defineExpose ? [`typeof ${names.exposed}`] : [],
		...options.slots.expose,
	];
}

function getSlotsType(options: ScriptCodegenOptions): string | undefined {
	return options.slots.componentSlots.join(` & `) || undefined;
}

function getRangeText(
	scriptSetup: IRScriptSetup,
	range: TextRange,
) {
	return scriptSetup.content.slice(range.start, range.end);
}
