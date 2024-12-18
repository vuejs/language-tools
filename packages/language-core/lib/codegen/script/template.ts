import * as path from 'path-browserify';
import type { Code } from '../../types';
import { getSlotsPropertyName, hyphenateTag } from '../../utils/shared';
import { TemplateCodegenContext, createTemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { generateStyleScopedClassReferences } from '../template/styleScopedClasses';
import { endOfLine, newLine } from '../utils';
import type { ScriptCodegenContext } from './context';
import { codeFeatures, type ScriptCodegenOptions } from './index';

export function* generateTemplate(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext
): Generator<Code, TemplateCodegenContext> {
	ctx.generatedTemplate = true;

	const templateCodegenCtx = createTemplateCodegenContext({
		scriptSetupBindingNames: new Set(),
		edited: options.edited,
	});
	yield* generateTemplateCtx(options);
	yield* generateTemplateComponents(options);
	yield* generateTemplateDirectives(options);
	yield* generateTemplateBody(options, templateCodegenCtx);
	return templateCodegenCtx;
}

function* generateTemplateCtx(options: ScriptCodegenOptions): Generator<Code> {
	const exps = [];

	exps.push(`{} as InstanceType<__VLS_PickNotAny<typeof __VLS_self, new () => {}>>`);

	if (options.vueCompilerOptions.petiteVueExtensions.some(ext => options.fileName.endsWith(ext))) {
		exps.push(`globalThis`);
	}
	if (options.sfc.styles.some(style => style.module)) {
		exps.push(`{} as __VLS_StyleModules`);
	}

	yield `const __VLS_ctx = `;
	if (exps.length === 1) {
		yield exps[0];
		yield `${endOfLine}`;
	}
	else {
		yield `{${newLine}`;
		for (const exp of exps) {
			yield `...`;
			yield exp;
			yield `,${newLine}`;
		}
		yield `}${endOfLine}`;
	}
}

function* generateTemplateComponents(options: ScriptCodegenOptions): Generator<Code> {
	const exps: Code[] = [];

	if (options.sfc.script && options.scriptRanges?.exportDefault?.componentsOption) {
		const { componentsOption } = options.scriptRanges.exportDefault;
		exps.push([
			options.sfc.script.content.slice(componentsOption.start, componentsOption.end),
			'script',
			componentsOption.start,
			codeFeatures.navigation,
		]);
	}

	let nameType: Code | undefined;
	if (options.sfc.script && options.scriptRanges?.exportDefault?.nameOption) {
		const { nameOption } = options.scriptRanges.exportDefault;
		nameType = options.sfc.script.content.slice(nameOption.start, nameOption.end);
	}
	else if (options.sfc.scriptSetup) {
		const baseName = path.basename(options.fileName);
		nameType = `'${options.scriptSetupRanges?.defineOptions?.name ?? baseName.slice(0, baseName.lastIndexOf('.'))}'`;
	}
	if (nameType) {
		exps.push(
			`{} as { [K in ${nameType}]: typeof __VLS_self & (new () => { `
			+ getSlotsPropertyName(options.vueCompilerOptions.target)
			+ `: typeof ${options.scriptSetupRanges?.defineSlots?.name ?? `__VLS_slots`} }) }`
		);
	}

	exps.push(`{} as NonNullable<typeof __VLS_self extends { components: infer C } ? C : {}>`);
	exps.push(`__VLS_ctx`);

	yield `const __VLS_localComponents = {${newLine}`;
	for (const type of exps) {
		yield `...`;
		yield type;
		yield `,${newLine}`;
	}
	yield `}${endOfLine}`;

	yield `let __VLS_components!: typeof __VLS_localComponents & __VLS_GlobalComponents${endOfLine}`;
}

export function* generateTemplateDirectives(options: ScriptCodegenOptions): Generator<Code> {
	const exps: Code[] = [];

	if (options.sfc.script && options.scriptRanges?.exportDefault?.directivesOption) {
		const { directivesOption } = options.scriptRanges.exportDefault;
		exps.push([
			options.sfc.script.content.slice(directivesOption.start, directivesOption.end),
			'script',
			directivesOption.start,
			codeFeatures.navigation,
		]);
	}

	exps.push(`{} as NonNullable<typeof __VLS_self extends { directives: infer D } ? D : {}>`);
	exps.push(`__VLS_ctx`);

	yield `const __VLS_localDirectives = {${newLine}`;
	for (const type of exps) {
		yield `...`;
		yield type;
		yield `,${newLine}`;
	}
	yield `}${endOfLine}`;

	yield `let __VLS_directives!: typeof __VLS_localDirectives & __VLS_GlobalDirectives${endOfLine}`;
}

function* generateTemplateBody(
	options: ScriptCodegenOptions,
	templateCodegenCtx: TemplateCodegenContext
): Generator<Code> {
	yield* generateStyleScopedClasses(options, templateCodegenCtx);
	yield* generateStyleScopedClassReferences(templateCodegenCtx, true);
	yield* generateCssVars(options, templateCodegenCtx);

	if (options.templateCodegen) {
		for (const code of options.templateCodegen.codes) {
			yield code;
		}
	}
	else {
		yield `// no template${newLine}`;
		if (!options.scriptSetupRanges?.defineSlots) {
			yield `const __VLS_slots = {}${endOfLine}`;
		}
		yield `const __VLS_inheritedAttrs = {}${endOfLine}`;
		yield `const $refs = {}${endOfLine}`;
		yield `const $el = {} as any${endOfLine}`;
	}

	yield `return {${newLine}`;
	yield `	attrs: {} as Partial<typeof __VLS_inheritedAttrs>,${newLine}`;
	yield `	slots: ${options.scriptSetupRanges?.defineSlots?.name ?? '__VLS_slots'},${newLine}`;
	yield `	refs: $refs,${newLine}`;
	yield `	rootEl: $el,${newLine}`;
	yield `}${endOfLine}`;
}

function* generateStyleScopedClasses(
	options: ScriptCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	const firstClasses = new Set<string>();
	yield `type __VLS_StyleScopedClasses = {}`;
	for (let i = 0; i < options.sfc.styles.length; i++) {
		const style = options.sfc.styles[i];
		const option = options.vueCompilerOptions.experimentalResolveStyleCssClasses;
		if (option === 'always' || (option === 'scoped' && style.scoped)) {
			for (const className of style.classNames) {
				if (firstClasses.has(className.text)) {
					ctx.scopedClasses.push({
						source: 'style_' + i,
						className: className.text.slice(1),
						offset: className.offset + 1
					});
					continue;
				}
				firstClasses.add(className.text);
				yield* generateCssClassProperty(
					i,
					className.text,
					className.offset,
					'boolean',
					true
				);
			}
		}
	}
	yield endOfLine;
}

export function* generateCssClassProperty(
	styleIndex: number,
	classNameWithDot: string,
	offset: number,
	propertyType: string,
	optional: boolean
): Generator<Code> {
	yield `${newLine} & { `;
	yield [
		'',
		'style_' + styleIndex,
		offset,
		codeFeatures.navigation,
	];
	yield `'`;
	yield [
		classNameWithDot.slice(1),
		'style_' + styleIndex,
		offset + 1,
		codeFeatures.navigation,
	];
	yield `'`;
	yield [
		'',
		'style_' + styleIndex,
		offset + classNameWithDot.length,
		codeFeatures.navigationWithoutRename,
	];
	yield `${optional ? '?' : ''}: ${propertyType}`;
	yield ` }`;
}

function* generateCssVars(options: ScriptCodegenOptions, ctx: TemplateCodegenContext): Generator<Code> {
	if (!options.sfc.styles.length) {
		return;
	}
	yield `// CSS variable injection ${newLine}`;
	for (const style of options.sfc.styles) {
		for (const cssBind of style.cssVars) {
			yield* generateInterpolation(
				options,
				ctx,
				style.name,
				codeFeatures.all,
				cssBind.text,
				cssBind.offset
			);
			yield endOfLine;
		}
	}
	yield `// CSS variable injection end ${newLine}`;
}

export function getTemplateUsageVars(options: ScriptCodegenOptions, ctx: ScriptCodegenContext) {

	const usageVars = new Set<string>();
	const components = new Set(options.sfc.template?.ast?.components);

	if (options.templateCodegen) {
		// fix import components unused report
		for (const varName of ctx.bindingNames) {
			if (components.has(varName) || components.has(hyphenateTag(varName))) {
				usageVars.add(varName);
			}
		}
		for (const component of components) {
			if (component.includes('.')) {
				usageVars.add(component.split('.')[0]);
			}
		}
		for (const [varName] of options.templateCodegen.accessExternalVariables) {
			usageVars.add(varName);
		}
	}

	return usageVars;
}
