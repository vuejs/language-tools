import * as path from 'path-browserify';
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
): Generator<Code> {
	yield* generateSelf(options);
	yield* generateSetupExposed(options, ctx);
	yield* generateTemplateCtx(options, ctx);
	yield* generateTemplateComponents(options);
	yield* generateTemplateDirectives(options);

	if (options.styleCodegen) {
		yield* options.styleCodegen.codes;
	}
	if (options.templateCodegen) {
		yield* options.templateCodegen.codes;
	}
}

function* generateSelf({ script, scriptRanges, vueCompilerOptions, fileName }: ScriptCodegenOptions): Generator<Code> {
	if (script && scriptRanges?.componentOptions) {
		yield `const ${names.self} = (await import('${vueCompilerOptions.lib}')).defineComponent(`;
		const { args } = scriptRanges.componentOptions;
		yield* generateSfcBlockSection(script, args.start, args.end, codeFeatures.all);
		yield `)${endOfLine}`;
	}
	else if (script && scriptRanges?.exportDefault) {
		yield `const ${names.self} = `;
		const { expression } = scriptRanges.exportDefault;
		yield* generateSfcBlockSection(script, expression.start, expression.end, codeFeatures.all);
		yield endOfLine;
	}
	else if (script?.src) {
		yield `let ${names.self}!: typeof import('./${path.basename(fileName)}').default${endOfLine}`;
	}
}

function* generateTemplateCtx(
	{ vueCompilerOptions, script, scriptRanges, styleCodegen, scriptSetupRanges, fileName }: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	const exps: Iterable<Code>[] = [];
	const emitTypes: string[] = [];
	const propTypes: string[] = [];

	if (vueCompilerOptions.petiteVueExtensions.some(ext => fileName.endsWith(ext))) {
		exps.push([`globalThis`]);
	}
	if (script?.src || scriptRanges?.exportDefault) {
		exps.push([`{} as InstanceType<__VLS_PickNotAny<typeof ${names.self}, new () => {}>>`]);
	}
	else {
		exps.push([`{} as import('${vueCompilerOptions.lib}').ComponentPublicInstance`]);
	}
	if (styleCodegen?.generatedTypes.has(names.StyleModules)) {
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

function* generateTemplateComponents(options: ScriptCodegenOptions): Generator<Code> {
	const types: string[] = [`typeof ${names.ctx}`];

	if (options.script && options.scriptRanges?.componentOptions?.components) {
		const { components } = options.scriptRanges.componentOptions;
		yield `const __VLS_componentsOption = `;
		yield* generateSfcBlockSection(
			options.script,
			components.start,
			components.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`typeof __VLS_componentsOption`);
	}

	yield `type __VLS_LocalComponents = ${types.join(` & `)}${endOfLine}`;
	yield `let ${names.components}!: __VLS_LocalComponents & __VLS_GlobalComponents${endOfLine}`;
}

function* generateTemplateDirectives(options: ScriptCodegenOptions): Generator<Code> {
	const types: string[] = [`typeof ${names.ctx}`];

	if (options.script && options.scriptRanges?.componentOptions?.directives) {
		const { directives } = options.scriptRanges.componentOptions;
		yield `const __VLS_directivesOption = `;
		yield* generateSfcBlockSection(
			options.script,
			directives.start,
			directives.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`__VLS_ResolveDirectives<typeof __VLS_directivesOption>`);
	}

	yield `type __VLS_LocalDirectives = ${types.join(` & `)}${endOfLine}`;
	yield `let ${names.directives}!: __VLS_LocalDirectives & __VLS_GlobalDirectives${endOfLine}`;
}

function* generateSetupExposed(
	{ setupExposed }: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	if (!setupExposed.size) {
		return;
	}
	ctx.generatedTypes.add(names.SetupExposed);

	yield `type ${names.SetupExposed} = __VLS_ProxyRefs<{${newLine}`;
	for (const bindingName of setupExposed) {
		const token = Symbol(bindingName.length);
		yield ['', undefined, 0, { __linkedToken: token }];
		yield `${bindingName}: typeof `;
		yield ['', undefined, 0, { __linkedToken: token }];
		yield bindingName;
		yield endOfLine;
	}
	yield `}>${endOfLine}`;
}
