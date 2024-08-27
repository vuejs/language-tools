import type * as ts from 'typescript';
import type { Code } from '../../types';
import { getSlotsPropertyName, hyphenateTag } from '../../utils/shared';
import { endOfLine, newLine } from '../common';
import { TemplateCodegenContext, createTemplateCodegenContext } from '../template/context';
import { forEachInterpolationSegment } from '../template/interpolation';
import { generateStyleScopedClasses } from '../template/styleScopedClasses';
import type { ScriptCodegenContext } from './context';
import { codeFeatures, type ScriptCodegenOptions } from './index';
import { generateInternalComponent } from './internalComponent';

export function* generateTemplateCtx(options: ScriptCodegenOptions, isClassComponent: boolean): Generator<Code> {
	const types = [];
	if (isClassComponent) {
		types.push(`typeof this`);
	}
	else {
		types.push(`InstanceType<__VLS_PickNotAny<typeof __VLS_internalComponent, new () => {}>>`);
	}
	if (options.vueCompilerOptions.petiteVueExtensions.some(ext => options.fileBaseName.endsWith(ext))) {
		types.push(`typeof globalThis`);
	}
	if (options.sfc.styles.some(style => style.module)) {
		types.push(`__VLS_StyleModules`);
	}
	yield `let __VLS_ctx!: ${types.join(' & ')}${endOfLine}`;
}

export function* generateTemplateComponents(options: ScriptCodegenOptions): Generator<Code> {
	const exps: Code[] = [];

	if (options.sfc.script && options.scriptRanges?.exportDefault?.componentsOption) {
		const { componentsOption } = options.scriptRanges.exportDefault;
		exps.push([
			options.sfc.script.content.substring(componentsOption.start, componentsOption.end),
			'script',
			componentsOption.start,
			codeFeatures.navigation,
		]);
	}

	let nameType: Code | undefined;
	if (options.sfc.script && options.scriptRanges?.exportDefault?.nameOption) {
		const { nameOption } = options.scriptRanges.exportDefault;
		nameType = options.sfc.script.content.substring(nameOption.start, nameOption.end);
	}
	else if (options.sfc.scriptSetup) {
		yield `let __VLS_name!: '${options.scriptSetupRanges?.options.name ?? options.fileBaseName.substring(0, options.fileBaseName.lastIndexOf('.'))}'${endOfLine}`;
		nameType = 'typeof __VLS_name';
	}
	if (nameType) {
		exps.push(`{} as {
			[K in ${nameType}]: typeof __VLS_internalComponent
				& (new () => {
					${getSlotsPropertyName(options.vueCompilerOptions.target)}: typeof ${options.scriptSetupRanges?.slots?.name ?? '__VLS_slots'}
				})
		}`);
	}

	exps.push(`{} as NonNullable<typeof __VLS_internalComponent extends { components: infer C } ? C : {}>`);
	exps.push(`{} as __VLS_GlobalComponents`);
	exps.push(`{} as typeof __VLS_ctx`);

	yield `const __VLS_components = {${newLine}`;
	for (const type of exps) {
		yield `...`;
		yield type;
		yield `,${newLine}`;
	}
	yield `}${endOfLine}`;
}

export function* generateTemplate(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	isClassComponent: boolean
): Generator<Code> {
	ctx.generatedTemplate = true;

	if (!options.vueCompilerOptions.skipTemplateCodegen) {
		const templateCodegenCtx = createTemplateCodegenContext({ scriptSetupBindingNames: new Set(), edited: options.edited });
		yield* generateTemplateCtx(options, isClassComponent);
		yield* generateTemplateComponents(options);
		yield* generateTemplateBody(options, templateCodegenCtx);
		yield* generateInternalComponent(options, ctx, templateCodegenCtx);
	}
	else {
		const templateUsageVars = [...getTemplateUsageVars(options, ctx)];
		yield `// @ts-ignore${newLine}`;
		yield `[${templateUsageVars.join(', ')}]${newLine}`;
		yield `const __VLS_templateResult { slots: {}, refs: {}, attrs: {} }${endOfLine}`;
	}
}

function* generateTemplateBody(
	options: ScriptCodegenOptions,
	templateCodegenCtx: TemplateCodegenContext
): Generator<Code> {
	const firstClasses = new Set<string>();
	yield `let __VLS_styleScopedClasses!: {}`;
	for (let i = 0; i < options.sfc.styles.length; i++) {
		const style = options.sfc.styles[i];
		const option = options.vueCompilerOptions.experimentalResolveStyleCssClasses;
		if (option === 'always' || (option === 'scoped' && style.scoped)) {
			for (const className of style.classNames) {
				if (firstClasses.has(className.text)) {
					templateCodegenCtx.scopedClasses.push({
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
	yield* generateStyleScopedClasses(templateCodegenCtx, true);
	yield* generateCssVars(options, templateCodegenCtx);

	if (options.templateCodegen) {
		for (const code of options.templateCodegen.codes) {
			yield code;
		}
	}
	else {
		yield `// no template${newLine}`;
		if (!options.scriptSetupRanges?.slots.define) {
			yield `const __VLS_slots = {}${endOfLine}`;
			yield `const __VLS_refs = {}${endOfLine}`;
			yield `const __VLS_inheritedAttrs = {}${endOfLine}`;
		}
	}

	yield `const __VLS_templateResult = {`;
	yield `slots: ${options.scriptSetupRanges?.slots.name ?? '__VLS_slots'},${newLine}`;
	yield `refs: __VLS_refs as __VLS_PickRefsExpose<typeof __VLS_refs>,${newLine}`;
	yield `attrs: {} as Partial<typeof __VLS_inheritedAttrs>,${newLine}`;
	yield `}${endOfLine}`;
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
		classNameWithDot.substring(1),
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
			for (const [segment, offset, onlyError] of forEachInterpolationSegment(
				options.ts,
				ctx,
				cssBind.text,
				cssBind.offset,
				options.ts.createSourceFile('/a.txt', cssBind.text, 99 satisfies ts.ScriptTarget.ESNext)
			)) {
				if (offset === undefined) {
					yield segment;
				}
				else {
					yield [
						segment,
						style.name,
						cssBind.offset + offset,
						onlyError
							? codeFeatures.navigation
							: codeFeatures.all,
					];
				}
			}
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
			if (component.indexOf('.') >= 0) {
				usageVars.add(component.split('.')[0]);
			}
		}
		for (const [varName] of options.templateCodegen.accessExternalVariables) {
			usageVars.add(varName);
		}
	}

	return usageVars;
}
