import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import * as names from '../names';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateTemplate(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	selfType?: string,
): Generator<Code> {
	yield* generateSetupExposed(options, ctx);
	yield* generateTemplateCtx(options, ctx, selfType);
	yield* generateTemplateComponents(options, ctx);
	yield* generateTemplateDirectives(options, ctx);

	if (options.templateAndStyleCodes.length) {
		yield* options.templateAndStyleCodes;
	}
}

function* generateTemplateCtx(
	{ vueCompilerOptions, templateAndStyleTypes, scriptSetupRanges, fileName }: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	selfType: string | undefined,
): Generator<Code> {
	const exps: Iterable<Code>[] = [];
	const emitTypes: string[] = [];
	const propTypes: string[] = [];

	if (vueCompilerOptions.petiteVueExtensions.some(ext => fileName.endsWith(ext))) {
		exps.push([`globalThis`]);
	}
	if (selfType) {
		exps.push([`{} as InstanceType<__VLS_PickNotAny<typeof ${selfType}, new () => {}>>`]);
	}
	else {
		exps.push([`{} as import('${vueCompilerOptions.lib}').ComponentPublicInstance`]);
	}
	if (templateAndStyleTypes.has(names.StyleModules)) {
		exps.push([`{} as ${names.StyleModules}`]);
	}

	if (scriptSetupRanges?.defineEmits) {
		const { defineEmits } = scriptSetupRanges;
		emitTypes.push(`typeof ${defineEmits.name ?? names.emit}`);
	}
	if (scriptSetupRanges?.defineModel.length) {
		emitTypes.push(`typeof ${names.modelEmit}`);
	}
	if (emitTypes.length) {
		yield `type ${names.EmitProps} = __VLS_EmitsToProps<__VLS_NormalizeEmits<${emitTypes.join(` & `)}>>${endOfLine}`;
		exps.push([`{} as { $emit: ${emitTypes.join(` & `)} }`]);
	}

	if (scriptSetupRanges?.defineProps) {
		propTypes.push(`typeof ${scriptSetupRanges.defineProps.name ?? names.props}`);
	}
	if (scriptSetupRanges?.defineModel.length) {
		propTypes.push(names.ModelProps);
	}
	if (emitTypes.length) {
		propTypes.push(names.EmitProps);
	}
	if (propTypes.length) {
		yield `type ${names.InternalProps} = ${propTypes.join(` & `)}${endOfLine}`;
		exps.push([`{} as { $props: ${names.InternalProps} }`]);
		exps.push([`{} as ${names.InternalProps}`]);
	}

	if (ctx.generatedTypes.has(names.SetupExposed)) {
		exps.push([`{} as ${names.SetupExposed}`]);
	}

	yield `const ${names.ctx} = `;
	yield* generateSpreadMerge(exps);
	yield endOfLine;
}

function* generateTemplateComponents(
	{ vueCompilerOptions, script, scriptRanges }: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	const types: string[] = [];

	if (ctx.generatedTypes.has(names.SetupExposed)) {
		types.push(names.SetupExposed);
	}
	if (script && scriptRanges?.componentOptions?.components) {
		const { components } = scriptRanges.componentOptions;
		yield `const __VLS_componentsOption = `;
		yield* generateSfcBlockSection(
			script,
			components.start,
			components.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`typeof __VLS_componentsOption`);
	}

	yield `type __VLS_LocalComponents = ${types.length ? types.join(` & `) : `{}`}${endOfLine}`;
	yield `type __VLS_GlobalComponents = ${
		vueCompilerOptions.target >= 3.5
			? `import('${vueCompilerOptions.lib}').GlobalComponents`
			: `import('${vueCompilerOptions.lib}').GlobalComponents & Pick<typeof import('${vueCompilerOptions.lib}'), 'Transition' | 'TransitionGroup' | 'KeepAlive' | 'Suspense' | 'Teleport'>`
	}${endOfLine}`;
	yield `let ${names.components}!: __VLS_LocalComponents & __VLS_GlobalComponents${endOfLine}`;
	yield `let ${names.intrinsics}!: ${
		vueCompilerOptions.target >= 3.3
			? `import('${vueCompilerOptions.lib}/jsx-runtime').JSX.IntrinsicElements`
			: `globalThis.JSX.IntrinsicElements`
	}${endOfLine}`;
}

function* generateTemplateDirectives(
	{ vueCompilerOptions, script, scriptRanges }: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	const types: string[] = [];

	if (ctx.generatedTypes.has(names.SetupExposed)) {
		types.push(names.SetupExposed);
	}
	if (script && scriptRanges?.componentOptions?.directives) {
		const { directives } = scriptRanges.componentOptions;
		yield `const __VLS_directivesOption = `;
		yield* generateSfcBlockSection(
			script,
			directives.start,
			directives.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`__VLS_ResolveDirectives<typeof __VLS_directivesOption>`);
	}

	yield `type __VLS_LocalDirectives = ${types.length ? types.join(` & `) : `{}`}${endOfLine}`;
	yield `let ${names.directives}!: __VLS_LocalDirectives & import('${vueCompilerOptions.lib}').GlobalDirectives${endOfLine}`;
}

function* generateSetupExposed(
	{ vueCompilerOptions, exposed }: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	if (!exposed.size) {
		return;
	}
	ctx.generatedTypes.add(names.SetupExposed);

	yield `type ${names.SetupExposed} = import('${vueCompilerOptions.lib}').ShallowUnwrapRef<{${newLine}`;
	for (const bindingName of exposed) {
		const token = Symbol(bindingName.length);
		yield ['', undefined, 0, { __linkedToken: token }];
		yield `${bindingName}: typeof `;
		yield ['', undefined, 0, { __linkedToken: token }];
		yield bindingName;
		yield endOfLine;
	}
	yield `}>${endOfLine}`;
}
