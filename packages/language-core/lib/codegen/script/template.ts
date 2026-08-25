import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine, generateSfcBlockSection, getRefBrandArgument } from '../utils';
import { generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenOptions } from './index';

export function* generateTemplate(
	options: ScriptCodegenOptions,
	selfType?: string,
): Generator<Code> {
	yield* generateTemplateCtx(options, selfType);
	yield* generateTemplateComponents(options);
	yield* generateTemplateDirectives(options);

	for (const name of options.withDotValueBindings) {
		yield `${names.withDotValue}(${name}, ${getRefBrandArgument(options.vueCompilerOptions)})${endOfLine}`;
	}

	if (options.templateAndStyleCodes.length) {
		yield* options.templateAndStyleCodes;
	}
}

function* generateTemplateCtx(
	{ vueCompilerOptions, templateAndStyleTypes, scriptSetupRanges, fileName }: ScriptCodegenOptions,
	selfType: string | undefined,
): Generator<Code> {
	const exps: Code[] = [];
	const emitTypes: string[] = [];
	const propTypes: string[] = [];

	if (vueCompilerOptions.petiteVueExtensions.some(ext => fileName.endsWith(ext))) {
		exps.push(`globalThis`);
	}
	if (selfType) {
		exps.push(`{} as InstanceType<${names.PickNotAny}<typeof ${selfType}, new () => {}>>`);
	}
	else {
		exps.push(`{} as import('${vueCompilerOptions.lib}').ComponentPublicInstance`);
	}
	if (templateAndStyleTypes.has(names.StyleModules)) {
		exps.push(`{} as ${names.StyleModules}`);
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
		exps.push(`{} as { $emit: ${emitTypes.join(` & `)} }`);
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
		exps.push(`{} as { $props: ${propTypes.join(` & `)} }`);
		exps.push(`{} as ${propTypes.join(` & `)}`);
	}

	yield `const ${names.ctx} = `;
	yield* generateSpreadMerge(...exps);
	yield endOfLine;
}

function* generateTemplateComponents(
	{ vueCompilerOptions, script, scriptRanges, localComponents }: ScriptCodegenOptions,
): Generator<Code> {
	const types: string[] = [];

	if (localComponents.size) {
		types.push(generateExposedType(vueCompilerOptions.lib, localComponents));
	}
	if (script && scriptRanges?.exportDefault?.options?.components) {
		const { components } = scriptRanges.exportDefault.options;
		yield `const ${names.componentsOption} = `;
		yield* generateSfcBlockSection(
			script,
			components.start,
			components.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`typeof ${names.componentsOption}`);
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
	{ vueCompilerOptions, script, scriptRanges, localDirectives }: ScriptCodegenOptions,
): Generator<Code> {
	const types: string[] = [];

	if (localDirectives.size) {
		types.push(generateExposedType(vueCompilerOptions.lib, localDirectives));
	}
	if (script && scriptRanges?.exportDefault?.options?.directives) {
		const { directives } = scriptRanges.exportDefault.options;
		yield `const ${names.directivesOption} = `;
		yield* generateSfcBlockSection(
			script,
			directives.start,
			directives.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`${names.ResolveDirectives}<typeof ${names.directivesOption}>`);
	}

	yield `type ${names.LocalDirectives} = ${types.length ? types.join(` & `) : `{}`}${endOfLine}`;
	yield `let ${names.directives}!: ${names.LocalDirectives} & import('${vueCompilerOptions.lib}').GlobalDirectives${endOfLine}`;
}

function generateExposedType(lib: string, bindings: Set<string>): string {
	return `import('${lib}').ShallowUnwrapRef<{\n${[...bindings].map(name => `${name}: typeof ${name};`).join(`\n`)}\n}>`;
}
