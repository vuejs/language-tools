import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, TextRange } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { combineLastMapping, endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateComponent, generateEmitsOption } from './component';
import { generateComponentSelf } from './componentSelf';
import type { ScriptCodegenContext } from './context';
import { type ScriptCodegenOptions, generateScriptSectionPartiallyEnding } from './index';
import { generateTemplate } from './template';

export function* generateScriptSetupImports(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	yield [
		scriptSetup.content.slice(0, Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset)),
		'scriptSetup',
		0,
		codeFeatures.all,
	];
}

export function* generateScriptSetup(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	if (scriptSetup.generic) {
		if (!options.scriptRanges?.exportDefault) {
			if (options.sfc.scriptSetup) {
				// #4569
				yield [
					'',
					'scriptSetup',
					options.sfc.scriptSetup.content.length,
					codeFeatures.verification,
				];
			}
			yield `export default `;
		}
		yield `(`;
		if (typeof scriptSetup.generic === 'object') {
			yield `<`;
			yield [
				scriptSetup.generic.text,
				'main',
				scriptSetup.generic.offset,
				codeFeatures.all,
			];
			if (!scriptSetup.generic.text.endsWith(`,`)) {
				yield `,`;
			}
			yield `>`;
		}
		yield `(${newLine}`
			+ `	__VLS_props: NonNullable<Awaited<typeof __VLS_setup>>['props'],${newLine}`
			+ `	__VLS_ctx?: ${ctx.localTypes.PrettifyLocal}<Pick<NonNullable<Awaited<typeof __VLS_setup>>, 'attrs' | 'emit' | 'slots'>>,${newLine}` // use __VLS_Prettify for less dts code
			+ `	__VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>['expose'],${newLine}`
			+ `	__VLS_setup = (async () => {${newLine}`;
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, undefined);

		const emitTypes: string[] = [];

		if (scriptSetupRanges.defineEmits) {
			emitTypes.push(`typeof ${scriptSetupRanges.defineEmits.name ?? '__VLS_emit'}`);
		}
		if (scriptSetupRanges.defineProp.some(p => p.isModel)) {
			emitTypes.push(`typeof __VLS_modelEmit`);
		}

		yield `return {} as {${newLine}`
			+ `	props: ${ctx.localTypes.PrettifyLocal}<__VLS_OwnProps & __VLS_PublicProps & Partial<__VLS_InheritedAttrs>> & __VLS_BuiltInPublicProps,${newLine}`
			+ `	expose(exposed: import('${options.vueCompilerOptions.lib}').ShallowUnwrapRef<${scriptSetupRanges.defineExpose ? 'typeof __VLS_exposed' : '{}'}>): void,${newLine}`
			+ `	attrs: any,${newLine}`
			+ `	slots: __VLS_Slots,${newLine}`
			+ `	emit: ${emitTypes.length ? emitTypes.join(' & ') : `{}`},${newLine}`
			+ `}${endOfLine}`;
		yield `})(),${newLine}`; // __VLS_setup = (async () => {
		yield `) => ({} as import('${options.vueCompilerOptions.lib}').VNode & { __ctx?: Awaited<typeof __VLS_setup> }))`;
	}
	else if (!options.sfc.script) {
		// no script block, generate script setup code at root
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, 'export default');
	}
	else {
		if (!options.scriptRanges?.exportDefault) {
			yield `export default `;
		}
		yield `await (async () => {${newLine}`;
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, 'return');
		yield `})()`;
	}
}

function* generateSetupFunction(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	syntax: 'return' | 'export default' | undefined
): Generator<Code> {
	ctx.scriptSetupGeneratedOffset = options.getGeneratedLength() - scriptSetupRanges.importSectionEndOffset;

	let setupCodeModifies: [Code[], number, number][] = [];
	if (scriptSetupRanges.defineProps) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineProps;
		setupCodeModifies.push(...generateDefineWithType(
			scriptSetup,
			statement,
			scriptSetupRanges.withDefaults?.callExp ?? callExp,
			typeArg,
			name,
			`__VLS_props`,
			`__VLS_Props`
		));
	}
	if (scriptSetupRanges.defineEmits) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineEmits;
		setupCodeModifies.push(...generateDefineWithType(
			scriptSetup,
			statement,
			callExp,
			typeArg,
			name,
			`__VLS_emit`,
			`__VLS_Emit`
		));
	}
	if (scriptSetupRanges.defineSlots) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineSlots;
		setupCodeModifies.push(...generateDefineWithType(
			scriptSetup,
			statement,
			callExp,
			typeArg,
			name,
			`__VLS_slots`,
			`__VLS_Slots`
		));
	}
	if (scriptSetupRanges.defineExpose) {
		const { callExp, arg, typeArg } = scriptSetupRanges.defineExpose;
		if (typeArg) {
			setupCodeModifies.push([
				[
					`let __VLS_exposed!: `,
					generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.navigation),
					`${endOfLine}`,
				],
				callExp.start,
				callExp.start,
			]);
		}
		else if (arg) {
			setupCodeModifies.push([
				[
					`const __VLS_exposed = `,
					generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.navigation),
					`${endOfLine}`,
				],
				callExp.start,
				callExp.start,
			]);
		}
		else {
			setupCodeModifies.push([
				[`const __VLS_exposed = {}${endOfLine}`],
				callExp.start,
				callExp.start,
			]);
		}
	}
	if (options.vueCompilerOptions.inferTemplateDollarAttrs) {
		for (const { callExp } of scriptSetupRanges.useAttrs) {
			setupCodeModifies.push([
				[`(`],
				callExp.start,
				callExp.start
			], [
				[` as typeof __VLS_dollars.$attrs)`],
				callExp.end,
				callExp.end
			]);
		}
	}
	for (const { callExp, exp, arg } of scriptSetupRanges.useCssModule) {
		setupCodeModifies.push([
			[`(`],
			callExp.start,
			callExp.start
		], [
			arg ? [
				` as Omit<__VLS_StyleModules, '$style'>[`,
				generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.all),
				`])`
			] : [
				` as __VLS_StyleModules[`,
				['', scriptSetup.name, exp.start, codeFeatures.verification],
				`'$style'`,
				['', scriptSetup.name, exp.end, combineLastMapping],
				`])`
			],
			callExp.end,
			callExp.end
		]);
		if (arg) {
			setupCodeModifies.push([
				[`(__VLS_placeholder)`],
				arg.start,
				arg.end
			]);
		}
	}
	if (options.vueCompilerOptions.inferTemplateDollarSlots) {
		for (const { callExp } of scriptSetupRanges.useSlots) {
			setupCodeModifies.push([
				[`(`],
				callExp.start,
				callExp.start
			], [
				[` as typeof __VLS_dollars.$slots)`],
				callExp.end,
				callExp.end
			]);
		}
	}
	const isTs = options.lang !== 'js' && options.lang !== 'jsx';
	for (const { callExp, exp, arg } of scriptSetupRanges.useTemplateRef) {
		const templateRefType = arg
			? [
				`__VLS_TemplateRefs[`,
				generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.all),
				`]`
			]
			: [`unknown`];
		if (isTs) {
			setupCodeModifies.push([
				[
					`<`,
					...templateRefType,
					`>`
				],
				exp.end,
				exp.end
			]);
		}
		else {
			setupCodeModifies.push([
				[`(`],
				callExp.start,
				callExp.start
			], [
				[
					` as __VLS_UseTemplateRef<`,
					...templateRefType,
					`>)`
				],
				callExp.end,
				callExp.end
			]);
		}
		if (arg) {
			setupCodeModifies.push([
				[`(__VLS_placeholder)`],
				arg.start,
				arg.end
			]);
		}
	}
	setupCodeModifies = setupCodeModifies.sort((a, b) => a[1] - b[1]);

	let nextStart = Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset);
	for (const [codes, start, end] of setupCodeModifies) {
		yield generateSfcBlockSection(scriptSetup, nextStart, start, codeFeatures.all);
		for (const code of codes) {
			yield code;
		}
		nextStart = end;
	}
	yield generateSfcBlockSection(scriptSetup, nextStart, scriptSetup.content.length, codeFeatures.all);

	yield* generateScriptSectionPartiallyEnding(scriptSetup.name, scriptSetup.content.length, '#3632/scriptSetup.vue');
	yield* generateMacros(options, ctx);
	yield* generateDefineProp(options);

	if (scriptSetupRanges.defineProps?.typeArg && scriptSetupRanges.withDefaults?.arg) {
		// fix https://github.com/vuejs/language-tools/issues/1187
		yield `const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`;
		yield generateSfcBlockSection(
			scriptSetup,
			scriptSetupRanges.withDefaults.arg.start,
			scriptSetupRanges.withDefaults.arg.end,
			codeFeatures.navigation
		);
		yield `)${endOfLine}`;
	}

	yield* generateComponentProps(options, ctx, scriptSetup, scriptSetupRanges);
	yield* generateModelEmit(scriptSetup, scriptSetupRanges);
	const templateCodegenCtx = yield* generateTemplate(options, ctx);
	yield* generateComponentSelf(options, ctx, templateCodegenCtx);

	if (syntax) {
		if (
			!options.vueCompilerOptions.skipTemplateCodegen
			&& (
				scriptSetupRanges.defineSlots
				|| options.templateCodegen?.slots.length
				|| options.templateCodegen?.dynamicSlots.length
			)
		) {
			yield `const __VLS_component = `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
			yield `${syntax} `;
			yield `{} as ${ctx.localTypes.WithSlots}<typeof __VLS_component, __VLS_Slots>${endOfLine}`;
		}
		else {
			yield `${syntax} `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
		}
	}
}

function* generateMacros(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext
): Generator<Code> {
	if (options.vueCompilerOptions.target >= 3.3) {
		yield `// @ts-ignore${newLine}`;
		yield `declare const { `;
		for (const macro of Object.keys(options.vueCompilerOptions.macros)) {
			if (!ctx.bindingNames.has(macro)) {
				yield `${macro}, `;
			}
		}
		yield `}: typeof import('${options.vueCompilerOptions.lib}')${endOfLine}`;
	}
}

function* generateDefineProp(options: ScriptCodegenOptions): Generator<Code> {
	const definePropProposalA = options.vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition';
	const definePropProposalB = options.vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition';

	if (definePropProposalA || definePropProposalB) {
		yield `type __VLS_PropOptions<T> = Exclude<import('${options.vueCompilerOptions.lib}').Prop<T>, import('${options.vueCompilerOptions.lib}').PropType<T>>${endOfLine}`;
		if (definePropProposalA) {
			yield `declare function defineProp<T>(name: string, options: ({ required: true } | { default: T }) & __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(name?: string, options?: __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T | undefined>${endOfLine}`;
		}
		if (definePropProposalB) {
			yield `declare function defineProp<T>(value: T | (() => T), required?: boolean, options?: __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(value: T | (() => T) | undefined, required: true, options?: __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(value?: T | (() => T), required?: boolean, options?: __VLS_PropOptions<T>): import('${options.vueCompilerOptions.lib}').ComputedRef<T | undefined>${endOfLine}`;
		}
	}
}

function* generateDefineWithType(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	statement: TextRange,
	callExp: TextRange,
	typeArg: TextRange | undefined,
	name: string | undefined,
	defaultName: string,
	typeName: string
): Generator<[Code[], number, number]> {
	if (typeArg) {
		yield [[
			`type ${typeName} = `,
			generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.all),
			endOfLine,
		], statement.start, statement.start];
		yield [[typeName], typeArg.start, typeArg.end];
	}
	if (!name) {
		if (statement.start === callExp.start && statement.end === callExp.end) {
			yield [[`const ${defaultName} = `], callExp.start, callExp.start];
		}
		else if (typeArg) {
			yield [[
				`const ${defaultName} = `,
				generateSfcBlockSection(scriptSetup, callExp.start, typeArg.start, codeFeatures.all)
			], statement.start, typeArg.start];
			yield [[
				generateSfcBlockSection(scriptSetup, typeArg.end, callExp.end, codeFeatures.all),
				endOfLine,
				generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all),
				defaultName
			], typeArg.end, callExp.end];
		}
		else {
			yield [[
				`const ${defaultName} = `,
				generateSfcBlockSection(scriptSetup, callExp.start, callExp.end, codeFeatures.all),
				endOfLine,
				generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all),
				defaultName
			], statement.start, callExp.end];
		}
	}
}

function* generateComponentProps(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	if (scriptSetup.generic) {
		yield `const __VLS_fnComponent = (await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;

		if (scriptSetupRanges.defineProps?.arg) {
			yield `props: `;
			yield generateSfcBlockSection(
				scriptSetup,
				scriptSetupRanges.defineProps.arg.start,
				scriptSetupRanges.defineProps.arg.end,
				codeFeatures.navigation
			);
			yield `,${newLine}`;
		}

		yield* generateEmitsOption(options, scriptSetupRanges);

		yield `})${endOfLine}`;

		yield `type __VLS_BuiltInPublicProps = ${options.vueCompilerOptions.target >= 3.4
			? `import('${options.vueCompilerOptions.lib}').PublicProps`
			: options.vueCompilerOptions.target >= 3.0
				? `import('${options.vueCompilerOptions.lib}').VNodeProps`
				+ ` & import('${options.vueCompilerOptions.lib}').AllowedComponentProps`
				+ ` & import('${options.vueCompilerOptions.lib}').ComponentCustomProps`
				: `globalThis.JSX.IntrinsicAttributes`
			}`;
		yield endOfLine;

		yield `type __VLS_OwnProps = `;
		yield `${ctx.localTypes.OmitKeepDiscriminatedUnion}<InstanceType<typeof __VLS_fnComponent>['$props'], keyof __VLS_BuiltInPublicProps>`;
		yield endOfLine;
	}

	if (scriptSetupRanges.defineProp.length) {
		yield `const __VLS_defaults = {${newLine}`;
		for (const defineProp of scriptSetupRanges.defineProp) {
			if (!defineProp.defaultValue) {
				continue;
			}

			const [propName, localName] = getPropAndLocalName(scriptSetup, defineProp);

			if (defineProp.name || defineProp.isModel) {
				yield `'${propName}'`;
			}
			else if (defineProp.localName) {
				yield localName!;
			}
			else {
				continue;
			}

			yield `: `;
			yield getRangeName(scriptSetup, defineProp.defaultValue);
			yield `,${newLine}`;
		}
		yield `}${endOfLine}`;
	}

	yield `type __VLS_PublicProps = `;
	if (scriptSetupRanges.defineSlots && options.vueCompilerOptions.jsxSlots) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `${ctx.localTypes.PropsChildren}<__VLS_Slots>`;
	}
	if (scriptSetupRanges.defineProp.length) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `{${newLine}`;
		for (const defineProp of scriptSetupRanges.defineProp) {
			const [propName, localName] = getPropAndLocalName(scriptSetup, defineProp);

			if (defineProp.isModel && !defineProp.name) {
				yield propName!;
			}
			else if (defineProp.name) {
				yield generateSfcBlockSection(scriptSetup, defineProp.name.start, defineProp.name.end, codeFeatures.navigation);
			}
			else if (defineProp.localName) {
				yield generateSfcBlockSection(scriptSetup, defineProp.localName.start, defineProp.localName.end, codeFeatures.navigation);
			}
			else {
				continue;
			}

			yield defineProp.required
				? `: `
				: `?: `;
			yield* generateDefinePropType(scriptSetup, propName, localName, defineProp);
			yield `,${newLine}`;

			if (defineProp.modifierType) {
				const modifierName = `${defineProp.name ? propName : 'model'}Modifiers`;
				const modifierType = getRangeName(scriptSetup, defineProp.modifierType);
				yield `'${modifierName}'?: Partial<Record<${modifierType}, true>>,${newLine}`;
			}
		}
		yield `}`;
	}
	if (scriptSetupRanges.defineProps?.typeArg) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `__VLS_Props`;
	}
	if (!ctx.generatedPropsType) {
		yield `{}`;
	}
	yield endOfLine;
}

function* generateModelEmit(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	const defineModels = scriptSetupRanges.defineProp.filter(p => p.isModel);
	if (defineModels.length) {
		yield `type __VLS_ModelEmit = {${newLine}`;
		for (const defineModel of defineModels) {
			const [propName, localName] = getPropAndLocalName(scriptSetup, defineModel);
			yield `'update:${propName}': [value: `;
			yield* generateDefinePropType(scriptSetup, propName, localName, defineModel);
			if (!defineModel.required && defineModel.defaultValue === undefined) {
				yield ` | undefined`;
			}
			yield `]${endOfLine}`;
		}
		yield `}${endOfLine}`;
		yield `const __VLS_modelEmit = defineEmits<__VLS_ModelEmit>()${endOfLine}`;
	}
}

function* generateDefinePropType(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	propName: string | undefined,
	localName: string | undefined,
	defineProp: ScriptSetupRanges['defineProp'][number]
) {
	if (defineProp.type) {
		// Infer from defineProp<T>
		yield getRangeName(scriptSetup, defineProp.type);
	}
	else if (defineProp.runtimeType && localName) {
		// Infer from actual prop declaration code 
		yield `typeof ${localName}['value']`;
	}
	else if (defineProp.defaultValue && propName) {
		// Infer from defineProp({default: T})
		yield `typeof __VLS_defaults['${propName}']`;
	}
	else {
		yield `any`;
	}
}

function getPropAndLocalName(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	defineProp: ScriptSetupRanges['defineProp'][number]
) {
	const localName = defineProp.localName
		? getRangeName(scriptSetup, defineProp.localName)
		: undefined;
	let propName = defineProp.name
		? getRangeName(scriptSetup, defineProp.name)
		: defineProp.isModel
			? 'modelValue'
			: localName;
	if (defineProp.name) {
		propName = propName!.replace(/['"]+/g, '');
	}
	return [propName, localName] as const;
}

function getRangeName(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	range: TextRange
) {
	return scriptSetup.content.slice(range.start, range.end);
}
