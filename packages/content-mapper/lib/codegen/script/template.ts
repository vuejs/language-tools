import { navigationFeatures } from '@vue/language-core';
import { names } from '../names';
import type { TsCode } from '../tsCode';
import {
	asType,
	asTypeCode,
	endOfLine,
	generateSfcBlockSection,
	generateTypeAlias,
	generateTypedVar,
	getDotValueBindingName,
	getRefBrandArgument,
	intersectTypes,
	isTsLang,
	newLine,
	typeAliasRef,
} from '../writers';
import { generateSpreadMerge } from '../writers/merge';
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

	// The template renders after setup, so it runs in its own function: the bindings
	// it reads take their render-time types, not the narrowing at the end of setup.
	// The types setup and the export need from it are passed out through its return type.
	const { scriptLang } = options;
	const exportedTypes = [names.Slots, names.InheritedAttrs, names.TemplateRefs, names.RootEl, names.StyleModules]
		.filter(name =>
			options.templateAndStyleTypes.has(name) && !(name === names.Slots && options.scriptSetupRanges?.defineSlots)
		);
	yield `const ${names.template} = () => {${newLine}`;

	for (const name of options.dotValueBindings) {
		yield `const ${getDotValueBindingName(name)} = ${names.withDotValue}(${name}, ${
			getRefBrandArgument(options.vueCompilerOptions, scriptLang)
		})${endOfLine}`;
	}

	if (options.templateAndStyleCodes.length) {
		yield* options.templateAndStyleCodes;
	}

	yield `return {${newLine}`;
	for (const name of exportedTypes) {
		yield `${name}: ${asType(typeAliasRef(name, scriptLang), scriptLang)},${newLine}`;
	}
	if (options.templateAndStyleTypes.has(names.dollars)) {
		yield `${names.dollars},${newLine}`;
	}
	yield `}${endOfLine}`;
	yield `}${endOfLine}`;

	// Consumed only by the parts of setup and the export that apply.
	const used = [names.template];
	const returnType = `ReturnType<typeof ${names.template}>`;
	for (const name of exportedTypes) {
		yield* generateTypeAlias(name, scriptLang, function*() {
			yield `${returnType}['${name}']`;
		});
	}
	if (exportedTypes.length) {
		if (isTsLang(scriptLang)) {
			used.push(asType(`[${exportedTypes.join(`, `)}]`, scriptLang));
		}
		else {
			used.push(...exportedTypes);
		}
	}
	if (options.templateAndStyleTypes.has(names.dollars)) {
		yield* generateTypedVar('let', names.dollars, scriptLang, function*() {
			yield `${returnType}['${names.dollars}']`;
		});
		used.push(names.dollars);
	}
	yield `void [${used.join(`, `)}]${endOfLine}`;
}

function* generateTemplateCtx(
	options: ScriptCodegenOptions,
	selfType: string | undefined,
): Generator<TsCode> {
	const { vueCompilerOptions, templateAndStyleTypes, scriptSetupRanges, scriptLang, templateContext } = options;
	const exps: (string | TsCode[])[] = [];
	const emitTypes = getEmitTypes(options);
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

	if (emitTypes.length) {
		yield* generateTypeAlias(names.EmitProps, scriptLang, function*() {
			yield `${names.EmitsToProps}<${names.NormalizeEmits}<`;
			yield* intersectTypes(emitTypes);
			yield `>>`;
		});
		exps.push(asTypeCode([`{ $emit: `, ...intersectTypes(emitTypes), ` }`], scriptLang));
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
	for (const type of templateContext) {
		exps.push(asTypeCode(type, scriptLang));
	}

	yield `const ${names.ctx} = `;
	yield* generateSpreadMerge(...exps);
	yield endOfLine;
}

/** The types of the emit functions of a script setup component, which the codegen plugins add events to. */
export function getEmitTypes(
	{ scriptSetupRanges, emits }: ScriptCodegenOptions,
): (string | TsCode[])[] {
	const emitTypes: (string | TsCode[])[] = [];
	if (!scriptSetupRanges) {
		return emitTypes;
	}
	if (scriptSetupRanges.defineEmits) {
		emitTypes.push(`typeof ${scriptSetupRanges.defineEmits.name ?? names.emit}`);
	}
	if (scriptSetupRanges.defineModel.length) {
		emitTypes.push(`typeof ${names.modelEmit}`);
	}
	for (const type of emits) {
		emitTypes.push([`${names.ShortEmits}<`, ...type, `>`]);
	}
	return emitTypes;
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
	{ vueCompilerOptions, script, scriptRanges, localDirectives, unlistedOptionDirectives, scriptLang }:
		ScriptCodegenOptions,
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
		// The template reads the directives that resolve to a listed key of the option by that key; only those whose key
		// the syntax of the option does not show are resolved by its type, from the keys that the template searches.
		// Interim: those resolve to the right type but link no declaration, because the type has to rename the keys of
		// the option to the names of the directives, and TypeScript links no declaration to the properties of a
		// key-remapping mapped type. The right fix is in TypeScript, linking such a property to the declaration of the
		// key it maps from; then these resolve through `[K in keyof T as <name of K>]` over the option and the spread
		// link test in lsp.spec.ts passes.
		if (unlistedOptionDirectives.size) {
			const searched = [...unlistedOptionDirectives].map(([name, keys]) =>
				`'${name}': [${keys.map(key => `'${key}'`).join(', ')}]`
			);
			types.push(`${names.ResolveAssets}<typeof ${names.directivesOption}, { ${searched.join(', ')} }>`);
		}
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
