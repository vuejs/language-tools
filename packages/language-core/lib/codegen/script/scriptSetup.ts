import { camelize } from '@vue/shared';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, TextRange } from '../../types';
import { codeFeatures } from '../codeFeatures';
import {
	createSfcBlockGenerator,
	endOfLine,
	generatePartiallyEnding,
	generateSfcBlockSection,
	identifierRegex,
	newLine,
} from '../utils';
import { generateCamelized } from '../utils/camelized';
import { wrapWith } from '../utils/wrapWith';
import { generateComponent } from './component';
import type { ScriptCodegenContext } from './context';
import { generateConstExport, type ScriptCodegenOptions } from './index';
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
		yield* generateConstExport(options, scriptSetup);
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

		const propTypes: string[] = [];
		if (ctx.generatedPropsType) {
			propTypes.push(`__VLS_PublicProps`);
		}
		if (scriptSetupRanges.defineProps?.arg) {
			yield `const __VLS_propsOption = `;
			yield generateSfcBlockSection(
				scriptSetup,
				scriptSetupRanges.defineProps.arg.start,
				scriptSetupRanges.defineProps.arg.end,
				codeFeatures.navigation,
			);
			yield endOfLine;
			propTypes.push(
				`import('${options.vueCompilerOptions.lib}').${
					options.vueCompilerOptions.target >= 3.3 ? `ExtractPublicPropTypes` : `ExtractPropTypes`
				}<typeof __VLS_propsOption>`,
			);
		}
		if (scriptSetupRanges.defineEmits || scriptSetupRanges.defineModel.length) {
			propTypes.push(`__VLS_EmitProps`);
		}
		if (options.templateCodegen?.inheritedAttrVars.size) {
			propTypes.push(`__VLS_InheritedAttrs`);
		}

		const emitTypes: string[] = [];
		if (scriptSetupRanges.defineEmits) {
			emitTypes.push(`typeof ${scriptSetupRanges.defineEmits.name ?? '__VLS_emit'}`);
		}
		if (scriptSetupRanges.defineModel.length) {
			emitTypes.push(`typeof __VLS_modelEmit`);
		}

		yield `return {} as {${newLine}`
			+ `	props: ${propTypes.length ? `${ctx.localTypes.PrettifyLocal}<${propTypes.join(` & `)}> & ` : ``}${
				options.vueCompilerOptions.target >= 3.4
					? `import('${options.vueCompilerOptions.lib}').PublicProps`
					: options.vueCompilerOptions.target >= 3
					? `import('${options.vueCompilerOptions.lib}').VNodeProps`
						+ ` & import('${options.vueCompilerOptions.lib}').AllowedComponentProps`
						+ ` & import('${options.vueCompilerOptions.lib}').ComponentCustomProps`
					: `globalThis.JSX.IntrinsicAttributes`
			} & (typeof globalThis extends { __VLS_PROPS_FALLBACK: infer P } ? P : {})${endOfLine}`
			+ `	expose: (exposed: ${
				scriptSetupRanges.defineExpose
					? `import('${options.vueCompilerOptions.lib}').ShallowUnwrapRef<typeof __VLS_exposed>`
					: `{}`
			}) => void${endOfLine}`
			+ `	attrs: any${endOfLine}`
			+ `	slots: __VLS_Slots${endOfLine}`
			+ `	emit: ${emitTypes.length ? emitTypes.join(` & `) : `{}`}${endOfLine}`
			+ `}${endOfLine}`;
		yield `})(),${newLine}`; // __VLS_setup = (async () => {
		yield `) => ({} as import('${options.vueCompilerOptions.lib}').VNode & { __ctx?: Awaited<typeof __VLS_setup> }))${endOfLine}`;
	}
	else if (!options.sfc.script) {
		// no script block, generate script setup code at root
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, 'export default');
	}
	else {
		yield* generateConstExport(options, scriptSetup);
		yield `await (async () => {${newLine}`;
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, 'return');
		yield `})()${endOfLine}`;
	}
}

function* generateSetupFunction(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	syntax: 'return' | 'export default' | undefined,
): Generator<Code> {
	const { replace, generate } = createSfcBlockGenerator(
		scriptSetup,
		Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset),
		scriptSetup.content.length,
		codeFeatures.all,
	);

	if (scriptSetupRanges.defineProps) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineProps;
		for (
			const replacement of generateDefineWithType(
				scriptSetup,
				statement,
				scriptSetupRanges.withDefaults?.callExp ?? callExp,
				typeArg,
				name,
				`__VLS_props`,
				`__VLS_Props`,
			)
		) {
			replace(...replacement);
		}
	}
	if (scriptSetupRanges.defineEmits) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineEmits;
		for (
			const replacement of generateDefineWithType(
				scriptSetup,
				statement,
				callExp,
				typeArg,
				name,
				`__VLS_emit`,
				`__VLS_Emit`,
			)
		) {
			replace(...replacement);
		}
	}
	if (scriptSetupRanges.defineSlots) {
		const { name, statement, callExp, typeArg } = scriptSetupRanges.defineSlots;
		for (
			const replacement of generateDefineWithType(
				scriptSetup,
				statement,
				callExp,
				typeArg,
				name,
				`__VLS_slots`,
				`__VLS_Slots`,
			)
		) {
			replace(...replacement);
		}
	}
	if (scriptSetupRanges.defineExpose) {
		const { callExp, arg, typeArg } = scriptSetupRanges.defineExpose;
		if (typeArg) {
			replace(
				callExp.start,
				callExp.start,
				`let __VLS_exposed!: `,
				generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.all),
				endOfLine,
			);
			replace(typeArg.start, typeArg.end, `typeof __VLS_exposed`);
		}
		else if (arg) {
			replace(
				callExp.start,
				callExp.start,
				`const __VLS_exposed = `,
				generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.all),
				endOfLine,
			);
			replace(arg.start, arg.end, `__VLS_exposed`);
		}
		else {
			replace(callExp.start, callExp.start, `const __VLS_exposed = {}${endOfLine}`);
		}
	}
	if (options.vueCompilerOptions.inferTemplateDollarAttrs) {
		for (const { callExp } of scriptSetupRanges.useAttrs) {
			replace(callExp.start, callExp.start, `(`);
			replace(callExp.end, callExp.end, ` as typeof __VLS_dollars.$attrs)`);
		}
	}
	for (const { callExp, exp, arg } of scriptSetupRanges.useCssModule) {
		replace(callExp.start, callExp.start, `(`);
		replace(
			callExp.end,
			callExp.end,
			...arg
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
		);
		if (arg) {
			replace(arg.start, arg.end, `__VLS_placeholder`);
		}
	}
	if (options.vueCompilerOptions.inferTemplateDollarSlots) {
		for (const { callExp } of scriptSetupRanges.useSlots) {
			replace(callExp.start, callExp.start, `(`);
			replace(callExp.end, callExp.end, ` as typeof __VLS_dollars.$slots)`);
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
			replace(exp.end, exp.end, `<`, ...templateRefType, `>`);
		}
		else {
			replace(callExp.start, callExp.start, `(`);
			replace(callExp.end, callExp.end, ` as __VLS_UseTemplateRef<`, ...templateRefType, `>)`);
		}
		if (arg) {
			replace(arg.start, arg.end, `__VLS_placeholder`);
		}
	}

	yield* generate();
	yield* generatePartiallyEnding(scriptSetup.name, scriptSetup.content.length, '#3632/scriptSetup.vue');
	yield* generateMacros(options, ctx);

	const hasSlots = !!(
		scriptSetupRanges.defineSlots
		|| options.templateCodegen?.slots.length
		|| options.templateCodegen?.dynamicSlots.length
	);

	yield* generateModels(scriptSetup, scriptSetupRanges);
	yield* generatePublicProps(options, ctx, scriptSetup, scriptSetupRanges, hasSlots);
	yield* generateTemplate(options, ctx);

	if (syntax) {
		const prefix = syntax === 'return'
			? [`return `]
			: generateConstExport(options, scriptSetup);
		if (hasSlots) {
			yield `const __VLS_base = `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
			yield* prefix;
			yield `{} as ${ctx.localTypes.WithSlots}<typeof __VLS_base, __VLS_Slots>${endOfLine}`;
		}
		else {
			yield* prefix;
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
): Generator<[number, number, ...Code[]]> {
	if (typeArg) {
		yield [
			statement.start,
			statement.start,
			`type ${typeName} = `,
			generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.all),
			endOfLine,
		];
		yield [typeArg.start, typeArg.end, typeName];
	}
	if (!name) {
		if (statement.start === callExp.start && statement.end === callExp.end) {
			yield [callExp.start, callExp.start, `const ${defaultName} = `];
		}
		else if (typeArg) {
			yield [
				statement.start,
				typeArg.start,
				`const ${defaultName} = `,
				generateSfcBlockSection(scriptSetup, callExp.start, typeArg.start, codeFeatures.all),
			];
			yield [
				typeArg.end,
				callExp.end,
				generateSfcBlockSection(scriptSetup, typeArg.end, callExp.end, codeFeatures.all),
				endOfLine,
				generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all),
				defaultName,
			];
		}
		else {
			yield [
				statement.start,
				callExp.end,
				`const ${defaultName} = `,
				generateSfcBlockSection(scriptSetup, callExp.start, callExp.end, codeFeatures.all),
				endOfLine,
				generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all),
				defaultName,
			];
		}
	}
	else if (!identifierRegex.test(name)) {
		yield [statement.start, callExp.start, `const ${defaultName} = `];
		yield [
			statement.end,
			statement.end,
			endOfLine,
			generateSfcBlockSection(scriptSetup, statement.start, callExp.start, codeFeatures.all),
			defaultName,
		];
	}
}

function* generatePublicProps(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	hasSlots: boolean,
): Generator<Code> {
	if (scriptSetupRanges.defineProps?.typeArg && scriptSetupRanges.withDefaults?.arg) {
		yield `const __VLS_defaults = `;
		yield generateSfcBlockSection(
			scriptSetup,
			scriptSetupRanges.withDefaults.arg.start,
			scriptSetupRanges.withDefaults.arg.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
	}

	const propTypes: string[] = [];
	if (options.vueCompilerOptions.jsxSlots && hasSlots) {
		propTypes.push(`${ctx.localTypes.PropsChildren}<__VLS_Slots>`);
	}
	if (scriptSetupRanges.defineProps?.typeArg) {
		propTypes.push(`__VLS_Props`);
	}
	if (scriptSetupRanges.defineModel.length) {
		propTypes.push(`__VLS_ModelProps`);
	}
	if (propTypes.length) {
		ctx.generatedPropsType = true;
		yield `type __VLS_PublicProps = ${propTypes.join(` & `)}${endOfLine}`;
	}
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
			modelType = `typeof __VLS_defaultModels['${propName}']`;
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
		yield `const __VLS_defaultModels = {${newLine}`;
		yield* defaultCodes;
		yield `}${endOfLine}`;
	}

	yield `type __VLS_ModelProps = {${newLine}`;
	for (const codes of propCodes) {
		yield* codes;
	}
	yield `}${endOfLine}`;

	yield `type __VLS_ModelEmit = {${newLine}`;
	for (const codes of emitCodes) {
		yield* codes;
	}
	yield `}${endOfLine}`;
	yield `const __VLS_modelEmit = defineEmits<__VLS_ModelEmit>()${endOfLine}`;
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
