import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import {
	asType,
	endOfLine,
	generateSfcBlockSection,
	generateTypeAlias,
	generateTypedVar,
	getRefBrandArgument,
	newLine,
} from '../utils';
import { generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenOptions } from './index';

export function* generateTemplate(
	options: ScriptCodegenOptions,
	selfType?: string,
): Generator<Code> {
	yield* generateTemplateCtx(options, selfType);
	yield* generateTemplateComponents(options);
	yield* generateTemplateDirectives(options);

	yield `void ${names.ctx}, ${names.components}, ${names.intrinsics}, ${names.directives}${endOfLine}`;

	for (const name of options.dotValueBindings) {
		yield `// @ts-ignore${newLine}`;
		yield `${names.withDotValue}(${name}, ${
			getRefBrandArgument(options.vueCompilerOptions, options.scriptLang)
		})${endOfLine}`;
	}

	if (options.templateAndStyleCodes.length) {
		yield* options.templateAndStyleCodes;
	}
}

function* generateTemplateCtx(
	{ vueCompilerOptions, templateAndStyleTypes, scriptSetupRanges, fileName, scriptLang }: ScriptCodegenOptions,
	selfType: string | undefined,
): Generator<Code> {
	const exps: Code[] = [];
	const emitTypes: string[] = [];
	const propTypes: string[] = [];

	if (vueCompilerOptions.petiteVueExtensions.some(ext => fileName.endsWith(ext))) {
		exps.push(`globalThis`);
	}
	if (selfType) {
		exps.push(asType('{}', `InstanceType<${names.PickNotAny}<typeof ${selfType}, new () => {}>>`, scriptLang));
	}
	else {
		exps.push(asType('{}', `import('${vueCompilerOptions.lib}').ComponentPublicInstance`, scriptLang));
	}
	if (templateAndStyleTypes.has(names.StyleModules)) {
		exps.push(asType('{}', names.StyleModules, scriptLang));
	}

	if (scriptSetupRanges?.defineEmits) {
		emitTypes.push(`typeof ${scriptSetupRanges.defineEmits.name ?? names.emit}`);
	}
	if (scriptSetupRanges?.defineModel.length) {
		emitTypes.push(`typeof ${names.modelEmit}`);
	}
	if (emitTypes.length) {
		yield* generateTypeAlias(names.EmitProps, scriptLang, function*() {
			yield `${names.EmitsToProps}<${names.NormalizeEmits}<${emitTypes.join(` & `)}>>`;
		});
		exps.push(asType('{}', `{ $emit: ${emitTypes.join(` & `)} }`, scriptLang));
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
		exps.push(asType('{}', `{ $props: ${propTypes.join(` & `)} }`, scriptLang));
		exps.push(asType('{}', propTypes.join(` & `), scriptLang));
	}

	yield `const ${names.ctx} = `;
	yield* generateSpreadMerge(...exps);
	yield endOfLine;
}

function* generateTemplateComponents(
	{ vueCompilerOptions, script, scriptRanges, localComponents, scriptLang }: ScriptCodegenOptions,
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

	yield* generateTypeAlias(names.LocalComponents, scriptLang, function*() {
		yield types.length ? types.join(` & `) : `{}`;
	});
	yield* generateTypeAlias(names.GlobalComponents, scriptLang, function*() {
		yield vueCompilerOptions.target >= 3.5
			? `import('${vueCompilerOptions.lib}').GlobalComponents`
			: `import('${vueCompilerOptions.lib}').GlobalComponents & Pick<typeof import('${vueCompilerOptions.lib}'), 'Transition' | 'TransitionGroup' | 'KeepAlive' | 'Suspense' | 'Teleport'>`;
	});
	yield* generateTypedVar('let', names.components, scriptLang, function*() {
		yield `${names.LocalComponents} & ${names.GlobalComponents}`;
	});
	yield* generateTypedVar('let', names.intrinsics, scriptLang, function*() {
		yield vueCompilerOptions.target >= 3.3
			? `import('${vueCompilerOptions.lib}/jsx-runtime').JSX.IntrinsicElements`
			: `globalThis.JSX.IntrinsicElements`;
	});
}

function* generateTemplateDirectives(
	{ vueCompilerOptions, script, scriptRanges, localDirectives, scriptLang }: ScriptCodegenOptions,
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

	yield* generateTypeAlias(names.LocalDirectives, scriptLang, function*() {
		yield types.length ? types.join(` & `) : `{}`;
	});
	yield* generateTypedVar('let', names.directives, scriptLang, function*() {
		yield `${names.LocalDirectives} & import('${vueCompilerOptions.lib}').GlobalDirectives`;
	});
}

function generateExposedType(lib: string, bindings: Set<string>): string {
	return `import('${lib}').ShallowUnwrapRef<{\n${[...bindings].map(name => `${name}: typeof ${name};`).join(`\n`)}\n}>`;
}
