import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
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
		exps.push([`{} as InstanceType<${names.PickNotAny}<typeof ${selfType}, new () => {}>>`]);
	}
	else {
		exps.push([`{} as import('${vueCompilerOptions.lib}').ComponentPublicInstance`]);
	}
	if (templateAndStyleTypes.has(names.StyleModules)) {
		exps.push([`{} as ${names.StyleModules}`]);
	}

	if (scriptSetupRanges?.defineEmits) {
		emitTypes.push(`typeof ${scriptSetupRanges.defineEmits.name ?? names.emit}`);
	}
	if (scriptSetupRanges?.defineModel.length) {
		emitTypes.push(`typeof ${names.modelEmit}`);
	}
	if (emitTypes.length) {
		yield `type ${names.EmitProps} = ${names.EmitsToProps}<${names.NormalizeEmits}<${
			emitTypes.join(` & `)
		}>>${endOfLine}`;
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
		exps.push([`{} as { $props: ${propTypes.join(` & `)} }`]);
		exps.push([`{} as ${propTypes.join(` & `)}`]);
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
	if (script && scriptRanges?.exportDefault?.options?.components) {
		const { components } = scriptRanges.exportDefault.options;
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

	yield `type ${names.LocalComponents} = ${types.length ? types.join(` & `) : `{}`}${endOfLine}`;
	yield `type ${names.GlobalComponents} = ${
		vueCompilerOptions.target >= 3.5
			? `import('${vueCompilerOptions.lib}').GlobalComponents`
			: `import('${vueCompilerOptions.lib}').GlobalComponents & Pick<typeof import('${vueCompilerOptions.lib}'), 'Transition' | 'TransitionGroup' | 'KeepAlive' | 'Suspense' | 'Teleport'>`
	}${endOfLine}`;
	yield `let ${names.components}!: ${names.LocalComponents} & ${names.GlobalComponents}${endOfLine}`;
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
	if (script && scriptRanges?.exportDefault?.options?.directives) {
		const { directives } = scriptRanges.exportDefault.options;
		yield `const __VLS_directivesOption = `;
		yield* generateSfcBlockSection(
			script,
			directives.start,
			directives.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`${names.ResolveDirectives}<typeof __VLS_directivesOption>`);
	}

	yield `type ${names.LocalDirectives} = ${types.length ? types.join(` & `) : `{}`}${endOfLine}`;
	yield `let ${names.directives}!: ${names.LocalDirectives} & import('${vueCompilerOptions.lib}').GlobalDirectives${endOfLine}`;
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
