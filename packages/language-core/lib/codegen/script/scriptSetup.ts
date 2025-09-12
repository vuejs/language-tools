import { camelize } from '@vue/shared';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, TextRange } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateCamelized } from '../utils/camelized';
import { wrapWith } from '../utils/wrapWith';
import { generateComponent, generateEmitsOption } from './component';
import { generateComponentSelf } from './componentSelf';
import type { ScriptCodegenContext } from './context';
import { generateScriptSectionPartiallyEnding, type ScriptCodegenOptions } from './index';
import { generateTemplate } from './template';

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

export function* generateScriptSetup(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	if (scriptSetup.generic) {
		if (!options.scriptRanges?.exportDefault) {
			// #4569
			yield ['', 'scriptSetup', 0, codeFeatures.verification];
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
		if (scriptSetupRanges.defineModel.length) {
			emitTypes.push(`typeof __VLS_modelEmit`);
		}

		yield `return {} as {${newLine}`
			+ `	props: ${ctx.localTypes.PrettifyLocal}<__VLS_OwnProps & __VLS_PublicProps & __VLS_InheritedAttrs> & __VLS_BuiltInPublicProps,${newLine}`
			+ `	expose(exposed: import('${options.vueCompilerOptions.lib}').ShallowUnwrapRef<${
				scriptSetupRanges.defineExpose ? 'typeof __VLS_exposed' : '{}'
			}>): void,${newLine}`
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
	syntax: 'return' | 'export default' | undefined,
): Generator<Code> {
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
			`__VLS_Props`,
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
			`__VLS_Emit`,
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
			`__VLS_Slots`,
		));
	}
	if (scriptSetupRanges.defineExpose) {
		const { callExp, arg, typeArg } = scriptSetupRanges.defineExpose;
		if (typeArg) {
			setupCodeModifies.push([
				[
					`let __VLS_exposed!: `,
					generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.all),
					endOfLine,
				],
				callExp.start,
				callExp.start,
			], [
				[`typeof __VLS_exposed`],
				typeArg.start,
				typeArg.end,
			]);
		}
		else if (arg) {
			setupCodeModifies.push([
				[
					`const __VLS_exposed = `,
					generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.all),
					endOfLine,
				],
				callExp.start,
				callExp.start,
			], [
				[`__VLS_exposed`],
				arg.start,
				arg.end,
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
				callExp.start,
			], [
				[` as typeof __VLS_dollars.$attrs)`],
				callExp.end,
				callExp.end,
			]);
		}
	}
	for (const { callExp, exp, arg } of scriptSetupRanges.useCssModule) {
		setupCodeModifies.push([
			[`(`],
			callExp.start,
			callExp.start,
		], [
			arg
				? [
					` as Omit<__VLS_StyleModules, '$style'>[`,
					generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.withoutSemantic),
					`])`,
				]
				: [
					` as __VLS_StyleModules[`,
					...wrapWith(
						exp.start,
						exp.end,
						scriptSetup.name,
						codeFeatures.verification,
						`'$style'`,
					),
					`])`,
				],
			callExp.end,
			callExp.end,
		]);
		if (arg) {
			setupCodeModifies.push([
				[`__VLS_placeholder`],
				arg.start,
				arg.end,
			]);
		}
	}
	if (options.vueCompilerOptions.inferTemplateDollarSlots) {
		for (const { callExp } of scriptSetupRanges.useSlots) {
			setupCodeModifies.push([
				[`(`],
				callExp.start,
				callExp.start,
			], [
				[` as typeof __VLS_dollars.$slots)`],
				callExp.end,
				callExp.end,
			]);
		}
	}
	const isTs = options.lang !== 'js' && options.lang !== 'jsx';
	for (const { callExp, exp, arg } of scriptSetupRanges.useTemplateRef) {
		const templateRefType = arg
			? [
				`__VLS_TemplateRefs[`,
				generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.withoutSemantic),
				`]`,
			]
			: [`unknown`];
		if (isTs) {
			setupCodeModifies.push([
				[
					`<`,
					...templateRefType,
					`>`,
				],
				exp.end,
				exp.end,
			]);
		}
		else {
			setupCodeModifies.push([
				[`(`],
				callExp.start,
				callExp.start,
			], [
				[
					` as __VLS_UseTemplateRef<`,
					...templateRefType,
					`>)`,
				],
				callExp.end,
				callExp.end,
			]);
		}
		if (arg) {
			setupCodeModifies.push([
				[`__VLS_placeholder`],
				arg.start,
				arg.end,
			]);
		}
	}
	setupCodeModifies = setupCodeModifies.sort((a, b) => a[1] - b[1]);

	let nextStart = Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset);
	for (const [codes, start, end] of setupCodeModifies) {
		yield generateSfcBlockSection(scriptSetup, nextStart, start, codeFeatures.all);
		yield* codes;
		nextStart = end;
	}
	yield generateSfcBlockSection(scriptSetup, nextStart, scriptSetup.content.length, codeFeatures.all);

	yield* generateScriptSectionPartiallyEnding(scriptSetup.name, scriptSetup.content.length, '#3632/scriptSetup.vue');
	yield* generateMacros(options, ctx);

	if (scriptSetupRanges.defineProps?.typeArg && scriptSetupRanges.withDefaults?.arg) {
		// fix https://github.com/vuejs/language-tools/issues/1187
		yield `const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`;
		yield generateSfcBlockSection(
			scriptSetup,
			scriptSetupRanges.withDefaults.arg.start,
			scriptSetupRanges.withDefaults.arg.end,
			codeFeatures.navigation,
		);
		yield `)${endOfLine}`;
	}

	yield* generateComponentProps(options, ctx, scriptSetup, scriptSetupRanges);
	yield* generateModelEmit(scriptSetup, scriptSetupRanges);
	const templateCodegenCtx = yield* generateTemplate(options, ctx);
	yield* generateComponentSelf(options, ctx, templateCodegenCtx);

	if (syntax) {
		if (
			scriptSetupRanges.defineSlots
			|| options.templateCodegen?.slots.length
			|| options.templateCodegen?.dynamicSlots.length
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
	ctx: ScriptCodegenContext,
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

function* generateDefineWithType(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	statement: TextRange,
	callExp: TextRange,
	typeArg: TextRange | undefined,
	name: string | undefined,
	defaultName: string,
	typeName: string,
): Generator<[Code[], number, number]> {
	if (typeArg) {
		yield [
			[
				`type ${typeName} = `,
				generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.all),
				endOfLine,
			],
			statement.start,
			statement.start,
		];
		yield [[typeName], typeArg.start, typeArg.end];
	}
	if (!name) {
		if (statement.start === callExp.start && statement.end === callExp.end) {
			yield [[`const ${defaultName} = `], callExp.start, callExp.start];
		}
		else if (typeArg) {
			yield [
				[
					`const ${defaultName} = `,
					generateSfcBlockSection(scriptSetup, callExp.start, typeArg.start, codeFeatures.all),
				],
				statement.start,
				typeArg.start,
			];
			yield [
				[
					generateSfcBlockSection(scriptSetup, typeArg.end, callExp.end, codeFeatures.all),
					endOfLine,
					generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all),
					defaultName,
				],
				typeArg.end,
				callExp.end,
			];
		}
		else {
			yield [
				[
					`const ${defaultName} = `,
					generateSfcBlockSection(scriptSetup, callExp.start, callExp.end, codeFeatures.all),
					endOfLine,
					generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all),
					defaultName,
				],
				statement.start,
				callExp.end,
			];
		}
	}
}

function* generateComponentProps(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	if (scriptSetup.generic) {
		yield `const __VLS_fnComponent = (await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;

		if (scriptSetupRanges.defineProps?.arg) {
			yield `props: `;
			yield generateSfcBlockSection(
				scriptSetup,
				scriptSetupRanges.defineProps.arg.start,
				scriptSetupRanges.defineProps.arg.end,
				codeFeatures.navigation,
			);
			yield `,${newLine}`;
		}

		yield* generateEmitsOption(options, scriptSetupRanges);

		yield `})${endOfLine}`;

		yield `type __VLS_BuiltInPublicProps = ${
			options.vueCompilerOptions.target >= 3.4
				? `import('${options.vueCompilerOptions.lib}').PublicProps`
				: options.vueCompilerOptions.target >= 3
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

	if (scriptSetupRanges.defineModel.length) {
		yield `const __VLS_defaults = {${newLine}`;
		for (const defineModel of scriptSetupRanges.defineModel) {
			if (!defineModel.defaultValue) {
				continue;
			}
			const [propName] = getPropAndLocalName(scriptSetup, defineModel);

			yield `'${propName}': `;
			yield getRangeText(scriptSetup, defineModel.defaultValue);
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
	if (scriptSetupRanges.defineProps?.typeArg) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `__VLS_Props`;
	}
	if (scriptSetupRanges.defineModel.length) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `{${newLine}`;
		for (const defineModel of scriptSetupRanges.defineModel) {
			const [propName, localName] = getPropAndLocalName(scriptSetup, defineModel);

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
			yield* generateDefineModelType(scriptSetup, propName, localName, defineModel);
			yield `,${newLine}`;

			if (defineModel.modifierType) {
				const modifierName = `${propName === 'modelValue' ? 'model' : propName}Modifiers`;
				const modifierType = getRangeText(scriptSetup, defineModel.modifierType);
				yield `'${modifierName}'?: Partial<Record<${modifierType}, true>>,${newLine}`;
			}
		}
		yield `}`;
	}
	if (!ctx.generatedPropsType) {
		yield `{}`;
	}
	yield endOfLine;
}

function* generateModelEmit(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	if (scriptSetupRanges.defineModel.length) {
		yield `type __VLS_ModelEmit = {${newLine}`;
		for (const defineModel of scriptSetupRanges.defineModel) {
			const [propName, localName] = getPropAndLocalName(scriptSetup, defineModel);
			yield `'update:${propName}': [value: `;
			yield* generateDefineModelType(scriptSetup, propName, localName, defineModel);
			if (!defineModel.required && !defineModel.defaultValue) {
				yield ` | undefined`;
			}
			yield `]${endOfLine}`;
		}
		yield `}${endOfLine}`;
		yield `const __VLS_modelEmit = defineEmits<__VLS_ModelEmit>()${endOfLine}`;
	}
}

function* generateDefineModelType(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	propName: string | undefined,
	localName: string | undefined,
	defineModel: ScriptSetupRanges['defineModel'][number],
) {
	if (defineModel.type) {
		// Infer from defineModel<T>
		yield getRangeText(scriptSetup, defineModel.type);
	}
	else if (defineModel.runtimeType && localName) {
		// Infer from actual prop declaration code
		yield `typeof ${localName}['value']`;
	}
	else if (defineModel.defaultValue && propName) {
		// Infer from defineModel({default: T})
		yield `typeof __VLS_defaults['${propName}']`;
	}
	else {
		yield `any`;
	}
}

function getPropAndLocalName(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	defineModel: ScriptSetupRanges['defineModel'][number],
) {
	const localName = defineModel.localName
		? getRangeText(scriptSetup, defineModel.localName)
		: undefined;
	const propName = defineModel.name
		? camelize(getRangeText(scriptSetup, defineModel.name).slice(1, -1))
		: 'modelValue';
	return [propName, localName] as const;
}

function getRangeText(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	range: TextRange,
) {
	return scriptSetup.content.slice(range.start, range.end);
}
