import { navigationFeatures } from '@vue/language-core';
import { BindingFlag } from '@vue/language-core/lib/parsers/utils';
import type { TsCode } from '../../boundary';
import { names } from '../names';
import {
	asType,
	endOfLine,
	generateSfcBlockSection,
	generateTypeAlias,
	generateTypedVar,
	getRefBrandArgument,
	isTsLang,
	typeAliasRef,
} from '../utils';
import { generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenOptions } from './index';

export function* generateTemplate(
	options: ScriptCodegenOptions,
	selfType?: string,
): Generator<TsCode> {
	yield* generateTemplateCtx(options, selfType);
	yield* generateTemplateComponents(options);
	yield* generateTemplateDirectives(options);
	yield* generateTemplateScope(options);

	yield `void ${names.ctx}, ${names.components}, ${names.intrinsics}, ${names.directives}${endOfLine}`;

	for (const name of options.dotValueBindings) {
		const flags = options.scriptSetupRanges?.bindings.get(name) ?? options.scriptRanges?.bindings.get(name) ?? 0;
		// an assignment is not a read, so it cannot raise TS2454; the assertion
		// still narrows `name` through the assignment target. The `unknown` step
		// avoids TS2352 when `typeof name` is `undefined` (an untyped `let`).
		const target = flags & BindingFlag.Uninitialized
			? `${name} = ${
				isTsLang(options.scriptLang)
					? `{} as unknown as typeof ${name}`
					: `/** @type {typeof ${name}} */ (/** @type {unknown} */ ({}))`
			}`
			: name;
		yield `${names.withDotValue}(${target}, ${
			getRefBrandArgument(options.vueCompilerOptions, options.scriptLang)
		})${endOfLine}`;
	}

	if (options.templateAndStyleCodes.length) {
		yield* options.templateAndStyleCodes;
	}
}

function* generateTemplateCtx(
	{ vueCompilerOptions, templateAndStyleTypes, scriptSetupRanges, scriptLang }: ScriptCodegenOptions,
	selfType: string | undefined,
): Generator<TsCode> {
	const exps: string[] = [];
	const emitTypes: string[] = [];
	const propTypes: string[] = [];

	if (vueCompilerOptions.globalTemplateContext) {
		exps.push(`globalThis`);
	}
	if (selfType) {
		exps.push(asType(`InstanceType<${names.PickNotAny}<typeof ${selfType}, new () => {}>>`, scriptLang));
	}
	else {
		exps.push(asType(`import('${vueCompilerOptions.lib}').ComponentPublicInstance`, scriptLang));
	}
	if (templateAndStyleTypes.has(names.StyleModules)) {
		exps.push(asType(typeAliasRef(names.StyleModules, scriptLang), scriptLang));
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
		exps.push(asType(`{ $emit: ${emitTypes.join(` & `)} }`, scriptLang));
	}

	if (scriptSetupRanges?.defineProps) {
		propTypes.push(`typeof ${scriptSetupRanges.defineProps.name ?? names.props}`);
	}
	if (scriptSetupRanges?.defineModel.length) {
		propTypes.push(typeAliasRef(names.ModelProps, scriptLang));
	}
	if (emitTypes.length) {
		propTypes.push(typeAliasRef(names.EmitProps, scriptLang));
	}
	if (propTypes.length) {
		exps.push(asType(`{ $props: ${propTypes.join(` & `)} }`, scriptLang));
		exps.push(asType(propTypes.join(` & `), scriptLang));
	}

	yield `const ${names.ctx} = `;
	yield* generateSpreadMerge(...exps);
	yield endOfLine;
}

function* generateTemplateComponents(
	{ vueCompilerOptions, script, scriptRanges, localComponents, scriptLang }: ScriptCodegenOptions,
): Generator<TsCode> {
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
			{ features: navigationFeatures },
			true,
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
		yield `${typeAliasRef(names.LocalComponents, scriptLang)} & ${typeAliasRef(names.GlobalComponents, scriptLang)}`;
	});
	yield* generateTypedVar('let', names.intrinsics, scriptLang, function*() {
		yield `import('${vueCompilerOptions.lib}/jsx-runtime').JSX.IntrinsicElements`;
	});
}

function* generateTemplateDirectives(
	{ vueCompilerOptions, script, scriptRanges, localDirectives, scriptLang }: ScriptCodegenOptions,
): Generator<TsCode> {
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
			{ features: navigationFeatures },
			true,
		);
		yield endOfLine;
		types.push(`${names.ResolveDirectives}<typeof ${names.directivesOption}>`);
	}

	yield* generateTypeAlias(names.LocalDirectives, scriptLang, function*() {
		yield types.length ? types.join(` & `) : `{}`;
	});
	yield* generateTypedVar('let', names.directives, scriptLang, function*() {
		yield `${
			typeAliasRef(names.LocalDirectives, scriptLang)
		} & ${names.BuiltInDirectives} & import('${vueCompilerOptions.lib}').GlobalDirectives`;
	});
}

function* generateTemplateScope(
	{ vueCompilerOptions, templateAndStyleTypes, scopeBindings, scriptLang }: ScriptCodegenOptions,
): Generator<TsCode> {
	if (!templateAndStyleTypes.has(names.Scope)) {
		return;
	}
	yield* generateTypeAlias(names.Scope, scriptLang, function*() {
		yield `typeof ${names.ctx} & ${names.Globals}`;
		if (scopeBindings.size) {
			yield ` & ${generateExposedType(vueCompilerOptions.lib, scopeBindings)}`;
		}
	});
}

function generateExposedType(lib: string, bindings: Set<string>): string {
	return `import('${lib}').ShallowUnwrapRef<{\n${[...bindings].map(name => `${name}: typeof ${name};`).join(`\n`)}\n}>`;
}
