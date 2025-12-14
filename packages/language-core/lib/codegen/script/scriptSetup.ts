import { camelize } from '@vue/shared';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, TextRange } from '../../types';
import { codeFeatures } from '../codeFeatures';
import * as names from '../names';
import { endOfLine, generateSfcBlockSection, identifierRegex, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { type CodeTransform, generateCodeWithTransforms, insert, replace } from '../utils/transform';
import { generateComponent } from './component';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateScriptSetupImports(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	yield [
		scriptSetup.content.slice(
			0,
			Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset),
		),
		'scriptSetup',
		0,
		codeFeatures.all,
	];
}

export function* generateGeneric(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	generic: NonNullable<NonNullable<Sfc['scriptSetup']>['generic']>,
	body: Iterable<Code>,
): Generator<Code> {
	yield `(`;
	if (typeof generic === 'object') {
		yield `<`;
		yield [generic.text, 'main', generic.offset, codeFeatures.all];
		if (!generic.text.endsWith(`,`)) {
			yield `,`;
		}
		yield `>`;
	}
	yield `(${newLine}`
		+ `	${names.props}: NonNullable<Awaited<typeof ${names.setup}>>['props'],${newLine}`
		+ `	${names.ctx}?: ${ctx.localTypes.PrettifyLocal}<Pick<NonNullable<Awaited<typeof ${names.setup}>>, 'attrs' | 'emit' | 'slots'>>,${newLine}` // use __VLS_Prettify for less dts code
		+ `	${names.exposed}?: NonNullable<Awaited<typeof ${names.setup}>>['expose'],${newLine}`
		+ `	${names.setup} = (async () => {${newLine}`;

	yield* body;

	const propTypes: string[] = [];
	const emitTypes: string[] = [];
	const { vueCompilerOptions } = options;

	if (ctx.generatedTypes.has(names.PublicProps)) {
		propTypes.push(names.PublicProps);
	}
	if (scriptSetupRanges.defineProps?.arg) {
		yield `const __VLS_propsOption = `;
		yield* generateSfcBlockSection(
			scriptSetup,
			scriptSetupRanges.defineProps.arg.start,
			scriptSetupRanges.defineProps.arg.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		propTypes.push(
			`import('${vueCompilerOptions.lib}').${
				vueCompilerOptions.target >= 3.3 ? `ExtractPublicPropTypes` : `ExtractPropTypes`
			}<typeof __VLS_propsOption>`,
		);
	}
	if (scriptSetupRanges.defineEmits || scriptSetupRanges.defineModel.length) {
		propTypes.push(names.EmitProps);
	}
	if (options.templateCodegen?.generatedTypes.has(names.InheritedAttrs)) {
		propTypes.push(names.InheritedAttrs);
	}
	if (scriptSetupRanges.defineEmits) {
		emitTypes.push(`typeof ${scriptSetupRanges.defineEmits.name ?? names.emit}`);
	}
	if (scriptSetupRanges.defineModel.length) {
		emitTypes.push(`typeof ${names.modelEmit}`);
	}

	yield `return {} as {${newLine}`;
	yield `	props: `;
	yield vueCompilerOptions.target >= 3.4
		? `import('${vueCompilerOptions.lib}').PublicProps`
		: vueCompilerOptions.target >= 3
		? `import('${vueCompilerOptions.lib}').VNodeProps`
			+ ` & import('${vueCompilerOptions.lib}').AllowedComponentProps`
			+ ` & import('${vueCompilerOptions.lib}').ComponentCustomProps`
		: `globalThis.JSX.IntrinsicAttributes`;
	if (propTypes.length) {
		yield ` & ${ctx.localTypes.PrettifyLocal}<${propTypes.join(` & `)}>`;
	}
	if (!vueCompilerOptions.checkUnknownProps) {
		yield ` & (typeof globalThis extends { ${names.PROPS_FALLBACK}: infer P } ? P : {})`;
	}
	yield endOfLine;
	yield `	expose: (exposed: `;
	yield scriptSetupRanges.defineExpose
		? `import('${vueCompilerOptions.lib}').ShallowUnwrapRef<typeof ${names.exposed}>`
		: `{}`;
	if (
		options.vueCompilerOptions.inferComponentDollarRefs
		&& options.templateCodegen?.generatedTypes.has(names.TemplateRefs)
	) {
		yield ` & { $refs: ${names.TemplateRefs}; }`;
	}
	if (
		options.vueCompilerOptions.inferComponentDollarEl
		&& options.templateCodegen?.generatedTypes.has(names.RootEl)
	) {
		yield ` & { $el: ${names.RootEl}; }`;
	}
	yield `) => void${endOfLine}`;
	yield `	attrs: any${endOfLine}`;
	yield `	slots: ${hasSlotsType(options) ? names.Slots : `{}`}${endOfLine}`;
	yield `	emit: ${emitTypes.length ? emitTypes.join(` & `) : `{}`}${endOfLine}`;
	yield `}${endOfLine}`;
	yield `})(),${newLine}`; // __VLS_setup = (async () => {
	yield `) => ({} as import('${vueCompilerOptions.lib}').VNode & { __ctx?: Awaited<typeof ${names.setup}> }))${endOfLine}`;
}

export function* generateSetupFunction(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	body: Iterable<Code>,
	output?: Iterable<Code>,
): Generator<Code> {
	const transforms: CodeTransform[] = [];

	if (scriptSetupRanges.defineProps) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineProps;
		const _callExp = scriptSetupRanges.withDefaults?.callExp ?? callExp;
		transforms.push(
			...generateDefineWithTypeTransforms(scriptSetup, statement, _callExp, typeArg, name, names.props, names.Props),
		);
	}
	if (scriptSetupRanges.defineEmits) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineEmits;
		transforms.push(
			...generateDefineWithTypeTransforms(scriptSetup, statement, callExp, typeArg, name, names.emit, names.Emit),
		);
	}
	if (scriptSetupRanges.defineSlots) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineSlots;
		transforms.push(
			...generateDefineWithTypeTransforms(scriptSetup, statement, callExp, typeArg, name, names.slots, names.Slots),
		);
	}
	if (scriptSetupRanges.defineExpose) {
		const { callExp, arg, typeArg } = scriptSetupRanges.defineExpose;
		if (typeArg) {
			transforms.push(
				insert(callExp.start, function*() {
					yield `let ${names.exposed}!: `;
					yield* generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.all);
					yield endOfLine;
				}),
				replace(typeArg.start, typeArg.end, function*() {
					yield `typeof ${names.exposed}`;
				}),
			);
		}
		else if (arg) {
			transforms.push(
				insert(callExp.start, function*() {
					yield `const ${names.exposed} = `;
					yield* generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.all);
					yield endOfLine;
				}),
				replace(arg.start, arg.end, function*() {
					yield `${names.exposed}`;
				}),
			);
		}
		else {
			transforms.push(
				insert(callExp.start, function*() {
					yield `const ${names.exposed} = {}${endOfLine}`;
				}),
			);
		}
	}
	if (options.vueCompilerOptions.inferTemplateDollarAttrs) {
		for (const { callExp } of scriptSetupRanges.useAttrs) {
			transforms.push(
				insert(callExp.start, function*() {
					yield `(`;
				}),
				insert(callExp.end, function*() {
					yield ` as typeof ${names.dollars}.$attrs)`;
				}),
			);
		}
	}
	for (const { callExp, exp, arg } of scriptSetupRanges.useCssModule) {
		transforms.push(
			insert(callExp.start, function*() {
				yield `(`;
			}),
		);
		const type = options.styleCodegen?.generatedTypes.has(names.StyleModules)
			? names.StyleModules
			: `{}`;
		if (arg) {
			transforms.push(
				insert(callExp.end, function*() {
					yield ` as Omit<${type}, '$style'>[`;
					yield* generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.withoutSemantic);
					yield `])`;
				}),
				replace(arg.start, arg.end, function*() {
					yield names.placeholder;
				}),
			);
		}
		else {
			transforms.push(
				insert(callExp.end, function*() {
					yield ` as ${type}[`;
					const token = yield* startBoundary(scriptSetup.name, exp.start, codeFeatures.verification);
					yield `'$style'`;
					yield endBoundary(token, exp.end);
					yield `])`;
				}),
			);
		}
	}
	if (options.vueCompilerOptions.inferTemplateDollarSlots) {
		for (const { callExp } of scriptSetupRanges.useSlots) {
			transforms.push(
				insert(callExp.start, function*() {
					yield `(`;
				}),
				insert(callExp.end, function*() {
					yield ` as typeof ${names.dollars}.$slots)`;
				}),
			);
		}
	}
	for (const { callExp, arg } of scriptSetupRanges.useTemplateRef) {
		transforms.push(
			insert(callExp.start, function*() {
				yield `(`;
			}),
			insert(callExp.end, function*() {
				yield ` as __VLS_UseTemplateRef<`;
				if (arg) {
					yield names.TemplateRefs;
					yield `[`;
					yield* generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.withoutSemantic);
					yield `]`;
				}
				else {
					yield `unknown`;
				}
				yield `>)`;
			}),
		);
		if (arg) {
			transforms.push(
				replace(arg.start, arg.end, function*() {
					yield names.placeholder;
				}),
			);
		}
	}

	yield* generateCodeWithTransforms(
		Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset),
		scriptSetup.content.length,
		transforms,
		(start, end) => generateSfcBlockSection(scriptSetup, start, end, codeFeatures.all),
	);
	yield* generateMacros(options);
	yield* generateModels(scriptSetup, scriptSetupRanges);
	yield* generatePublicProps(options, ctx, scriptSetup, scriptSetupRanges);
	yield* body;

	if (output) {
		if (hasSlotsType(options)) {
			yield `const __VLS_base = `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
			yield* output;
			yield `{} as ${ctx.localTypes.WithSlots}<typeof __VLS_base, ${names.Slots}>${endOfLine}`;
		}
		else {
			yield* output;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
		}
	}
}

function* generateMacros(options: ScriptCodegenOptions): Generator<Code> {
	if (options.vueCompilerOptions.target >= 3.3) {
		yield `// @ts-ignore${newLine}`;
		yield `declare const { `;
		for (const macro of Object.keys(options.vueCompilerOptions.macros)) {
			if (!options.setupExposed.has(macro)) {
				yield `${macro}, `;
			}
		}
		yield `}: typeof import('${options.vueCompilerOptions.lib}')${endOfLine}`;
	}
}

function* generateDefineWithTypeTransforms(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	statement: TextRange,
	callExp: TextRange,
	typeArg: TextRange | undefined,
	name: string | undefined,
	defaultName: string,
	typeName: string,
): Generator<CodeTransform> {
	if (typeArg) {
		yield insert(statement.start, function*() {
			yield `type ${typeName} = `;
			yield* generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.all);
			yield endOfLine;
		});
		yield replace(typeArg.start, typeArg.end, function*() {
			yield typeName;
		});
	}
	if (!name) {
		if (statement.start === callExp.start && statement.end === callExp.end) {
			yield insert(callExp.start, function*() {
				yield `const ${defaultName} = `;
			});
		}
		else if (typeArg) {
			yield replace(statement.start, typeArg.start, function*() {
				yield `const ${defaultName} = `;
				yield* generateSfcBlockSection(scriptSetup, callExp.start, typeArg.start, codeFeatures.all);
			});
			yield replace(typeArg.end, callExp.end, function*() {
				yield* generateSfcBlockSection(scriptSetup, typeArg.end, callExp.end, codeFeatures.all);
				yield endOfLine;
				yield* generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all);
				yield defaultName;
			});
		}
		else {
			yield replace(statement.start, callExp.end, function*() {
				yield `const ${defaultName} = `;
				yield* generateSfcBlockSection(scriptSetup, callExp.start, callExp.end, codeFeatures.all);
				yield endOfLine;
				yield* generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all);
				yield defaultName;
			});
		}
	}
	else if (!identifierRegex.test(name)) {
		yield replace(statement.start, callExp.start, function*() {
			yield `const ${defaultName} = `;
		});
		yield insert(statement.end, function*() {
			yield endOfLine;
			yield* generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all);
			yield defaultName;
		});
	}
}

function* generatePublicProps(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	if (scriptSetupRanges.defineProps?.typeArg && scriptSetupRanges.withDefaults?.arg) {
		yield `const ${names.defaults} = `;
		yield* generateSfcBlockSection(
			scriptSetup,
			scriptSetupRanges.withDefaults.arg.start,
			scriptSetupRanges.withDefaults.arg.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
	}

	const propTypes: string[] = [];
	if (options.vueCompilerOptions.jsxSlots && hasSlotsType(options)) {
		propTypes.push(`${ctx.localTypes.PropsChildren}<${names.Slots}>`);
	}
	if (scriptSetupRanges.defineProps?.typeArg) {
		propTypes.push(names.Props);
	}
	if (scriptSetupRanges.defineModel.length) {
		propTypes.push(names.ModelProps);
	}
	if (propTypes.length) {
		yield `type ${names.PublicProps} = ${propTypes.join(` & `)}${endOfLine}`;
		ctx.generatedTypes.add(names.PublicProps);
	}
}

function hasSlotsType(options: ScriptCodegenOptions): boolean {
	return !!(
		options.scriptSetupRanges?.defineSlots
		|| options.templateCodegen?.generatedTypes.has(names.Slots)
	);
}

function* generateModels(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	if (!scriptSetupRanges.defineModel.length) {
		return;
	}

	const defaultCodes: string[] = [];
	const propCodes: Generator<Code>[] = [];
	const emitCodes: Generator<Code>[] = [];

	for (const defineModel of scriptSetupRanges.defineModel) {
		const propName = defineModel.name
			? camelize(getRangeText(scriptSetup, defineModel.name).slice(1, -1))
			: 'modelValue';

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

		propCodes.push(generateModelProp(scriptSetup, defineModel, propName, modelType));
		emitCodes.push(generateModelEmit(defineModel, propName, modelType));
	}

	if (defaultCodes.length) {
		yield `const ${names.defaultModels} = {${newLine}`;
		yield* defaultCodes;
		yield `}${endOfLine}`;
	}

	yield `type ${names.ModelProps} = {${newLine}`;
	for (const codes of propCodes) {
		yield* codes;
	}
	yield `}${endOfLine}`;

	yield `type ${names.ModelEmit} = {${newLine}`;
	for (const codes of emitCodes) {
		yield* codes;
	}
	yield `}${endOfLine}`;
	yield `const ${names.modelEmit} = defineEmits<${names.ModelEmit}>()${endOfLine}`;
}

function* generateModelProp(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	defineModel: ScriptSetupRanges['defineModel'][number],
	propName: string,
	modelType: string,
): Generator<Code> {
	if (defineModel.comments) {
		yield scriptSetup.content.slice(defineModel.comments.start, defineModel.comments.end);
		yield newLine;
	}

	if (defineModel.name) {
		yield* generateCamelized(
			getRangeText(scriptSetup, defineModel.name),
			scriptSetup.name,
			defineModel.name.start,
			codeFeatures.navigation,
		);
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
): Generator<Code> {
	yield `'update:${propName}': [value: `;
	yield modelType;
	if (!defineModel.required && !defineModel.defaultValue) {
		yield ` | undefined`;
	}
	yield `]${endOfLine}`;
}

function getRangeText(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	range: TextRange,
) {
	return scriptSetup.content.slice(range.start, range.end);
}
