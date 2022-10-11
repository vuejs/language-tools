import { getLength, Segment, toString } from '@volar/source-map';
import type { PositionCapabilities, TeleportMappingData, TextRange } from '@volar/language-core';
import * as SourceMaps from '@volar/source-map';
import { hyphenate } from '@vue/shared';
import { posix as path } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as templateGen from '../generators/template';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { collectCssVars, collectStyleCssClasses } from '../plugins/vue-tsx';
import { Sfc } from '../types';
import type { ResolvedVueCompilerOptions } from '../types';
import { getSlotsPropertyName, getVueLibraryName } from '../utils/shared';
import { walkInterpolationFragment } from '../utils/transform';

export function generate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	fileName: string,
	sfc: Sfc,
	lang: string,
	scriptRanges: ScriptRanges | undefined,
	scriptSetupRanges: ScriptSetupRanges | undefined,
	cssVars: ReturnType<typeof collectCssVars>,
	cssModuleClasses: ReturnType<typeof collectStyleCssClasses>,
	cssScopedClasses: ReturnType<typeof collectStyleCssClasses>,
	htmlGen: ReturnType<typeof templateGen['generate']> | undefined,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: ResolvedVueCompilerOptions,
	codeGen: Segment<PositionCapabilities>[] = [],
	teleports: SourceMaps.Mapping<TeleportMappingData>[] = [],
) {

	const bypassDefineComponent = vueCompilerOptions.bypassDefineComponentToExposePropsAndEmitsForJsScriptSetupComponents && lang === 'js' || lang === 'jsx';
	const vueVersion = vueCompilerOptions.target ?? 3;
	const vueLibName = getVueLibraryName(vueVersion);
	const usedTypes = {
		DefinePropsToOptions: false,
		mergePropDefaults: false,
		ConstructorOverloads: false,
	};

	writeScriptSrc();
	writeScriptSetupImportsSegment();
	writeScriptContentBeforeExportDefault();
	writeScriptSetupAndTemplate();
	writeScriptSetupTypes();
	writeScriptContentAfterExportDefault();
	writeTemplateIfNoScriptSetup();

	if (!sfc.script && !sfc.scriptSetup) {
		codeGen.push([
			'export default {} as any',
			undefined,
			[0, 0],
			{},
		]);
	}

	if (sfc.scriptSetup) {
		// for code action edits
		codeGen.push([
			'',
			'scriptSetup',
			sfc.scriptSetup.content.length,
			{},
		]);
	}

	// fix https://github.com/johnsoncodehk/volar/issues/1048
	// fix https://github.com/johnsoncodehk/volar/issues/435
	const text = toString(codeGen);
	const start = text.length - text.trimStart().length;
	const end = text.trimEnd().length;
	const extraMappings: SourceMaps.Mapping[] = [
		{
			sourceRange: [0, 0],
			generatedRange: [start, start],
			data: {},
		},
		{
			sourceRange: [0, 0],
			generatedRange: [end, end],
			data: {},
		},
	];

	return {
		codeGen,
		extraMappings,
		teleports,
	};

	function writeScriptSetupTypes() {
		if (usedTypes.DefinePropsToOptions) {
			if (compilerOptions.exactOptionalPropertyTypes) {
				codeGen.push(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueLibName}').PropType<T[K]> } : { type: import('${vueLibName}').PropType<T[K]>, required: true } };\n`);
			}
			else {
				codeGen.push(`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;\n`);
				codeGen.push(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueLibName}').PropType<__VLS_NonUndefinedable<T[K]>> } : { type: import('${vueLibName}').PropType<T[K]>, required: true } };\n`);
			}
		}
		if (usedTypes.mergePropDefaults) {
			codeGen.push(`type __VLS_WithDefaults<P, D> = {
					// use 'keyof Pick<P, keyof P>' instead of 'keyof P' to keep props jsdoc
					[K in keyof Pick<P, keyof P>]: K extends keyof D ? P[K] & {
						default: D[K]
					} : P[K]
				};\n`);
		}
		if (usedTypes.ConstructorOverloads) {
			// fix https://github.com/johnsoncodehk/volar/issues/926
			codeGen.push('type __VLS_UnionToIntersection<U> = (U extends unknown ? (arg: U) => unknown : never) extends ((arg: infer P) => unknown) ? P : never;\n');
			if (scriptSetupRanges && scriptSetupRanges.emitsTypeNums !== -1) {
				codeGen.push(genConstructorOverloads('__VLS_ConstructorOverloads', scriptSetupRanges.emitsTypeNums));
			}
			else {
				codeGen.push(genConstructorOverloads('__VLS_ConstructorOverloads'));
			}
		}
	}
	function writeScriptSrc() {
		if (!sfc.script?.src)
			return;

		let src = sfc.script.src;

		if (src.endsWith('.d.ts')) src = src.substring(0, src.length - '.d.ts'.length);
		else if (src.endsWith('.ts')) src = src.substring(0, src.length - '.ts'.length);
		else if (src.endsWith('.tsx')) src = src.substring(0, src.length - '.tsx'.length) + '.jsx';

		if (!src.endsWith('.js') && !src.endsWith('.jsx')) src = src + '.js';

		codeGen.push(`export * from '${src}';\n`);
		codeGen.push(`export { default } from '${src}';\n`);
	}
	function writeScriptContentBeforeExportDefault() {
		if (!sfc.script)
			return;

		if (!!sfc.scriptSetup && scriptRanges?.exportDefault) {
			// fix https://github.com/johnsoncodehk/volar/issues/1127
			codeGen.push([
				'',
				'scriptSetup',
				0,
				{ diagnostic: true },
			]);
			addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
		}
		else {
			let isExportRawObject = false;
			if (scriptRanges?.exportDefault) {
				isExportRawObject = sfc.script.content.substring(scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end).startsWith('{');
			}
			if (isExportRawObject && vueCompilerOptions.optionsWrapper.length && scriptRanges?.exportDefault) {
				addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
				codeGen.push(vueCompilerOptions.optionsWrapper[0]);
				addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end);
				codeGen.push(vueCompilerOptions.optionsWrapper[1]);
				addVirtualCode('script', scriptRanges.exportDefault.expression.end, sfc.script.content.length);
			}
			else {
				addVirtualCode('script', 0, sfc.script.content.length);
			}
		}
	}
	function writeScriptContentAfterExportDefault() {
		if (!sfc.script)
			return;

		if (!!sfc.scriptSetup && scriptRanges?.exportDefault) {
			addVirtualCode('script', scriptRanges.exportDefault.end, sfc.script.content.length);
		}
	}
	function addVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end?: number) {
		codeGen.push([
			sfc[vueTag]!.content.substring(start, end),
			vueTag,
			start,
			{
				hover: true,
				references: true,
				definition: true,
				rename: true,
				diagnostic: true, // also working for setup() returns unused in template checking
				completion: true,
				semanticTokens: true,
			},
		]);
	}
	function addExtraReferenceVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
		codeGen.push([
			sfc[vueTag]!.content.substring(start, end),
			vueTag,
			start,
			{
				references: true,
				definition: true,
				rename: true,
			},
		]);
	}
	function writeScriptSetupImportsSegment() {

		if (!sfc.scriptSetup)
			return;

		if (!scriptSetupRanges)
			return;

		codeGen.push([
			sfc.scriptSetup.content.substring(0, scriptSetupRanges.importSectionEndOffset),
			'scriptSetup',
			0,
			{
				hover: true,
				references: true,
				definition: true,
				diagnostic: true,
				rename: true,
				completion: true,
				semanticTokens: true,
			},
		]);
	}
	function writeTemplateIfNoScriptSetup() {

		if (!sfc.scriptSetup) {
			writeTemplate();
		}
	}
	function writeScriptSetupAndTemplate() {

		if (sfc.scriptSetup && scriptSetupRanges) {

			if (!scriptRanges?.exportDefault) {
				// fix https://github.com/johnsoncodehk/volar/issues/1127
				codeGen.push([
					'',
					'scriptSetup',
					0,
					{ diagnostic: true },
				]);
				codeGen.push('export default (');
			}
			if (vueCompilerOptions.experimentalRfc436 && sfc.scriptSetup.generic) {
				codeGen.push(`<${sfc.scriptSetup.generic}>`);
			}
			codeGen.push('(');
			if (scriptSetupRanges.propsTypeArg) {
				codeGen.push('__VLS_props: ');
				addVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
			}
			codeGen.push(') => {\n');
			codeGen.push('const __VLS_setup = async () => {\n');
			if (scriptSetupRanges.propsTypeArg) {
				addVirtualCode('scriptSetup', scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.propsTypeArg.start);
				codeGen.push('typeof __VLS_props');
				addVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.end);
			}
			else {
				addVirtualCode('scriptSetup', scriptSetupRanges.importSectionEndOffset);
			}

			if (scriptSetupRanges.propsTypeArg && scriptSetupRanges.withDefaultsArg) {
				// fix https://github.com/johnsoncodehk/volar/issues/1187
				codeGen.push(`const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
				codeGen.push(`);\n`);
			}

			if (scriptRanges?.exportDefault && scriptRanges.exportDefault.expression.start !== scriptRanges.exportDefault.args.start) {
				// use defineComponent() from user space code if it exist
				codeGen.push(`const __VLS_Component = `);
				addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.args.start);
				codeGen.push(`{\n`);
			}
			else {
				codeGen.push(`const __VLS_Component = (await import('${vueLibName}')).defineComponent({\n`);
			}

			if (!bypassDefineComponent) {
				if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg) {
					codeGen.push(`props: (`);
					if (scriptSetupRanges.propsTypeArg) {

						usedTypes.DefinePropsToOptions = true;
						codeGen.push(`{} as `);

						if (scriptSetupRanges.withDefaultsArg) {
							usedTypes.mergePropDefaults = true;
							codeGen.push(`__VLS_WithDefaults<`);
						}

						codeGen.push(`__VLS_TypePropsToRuntimeProps<typeof __VLS_props>`);

						if (scriptSetupRanges.withDefaultsArg) {
							codeGen.push(`, typeof __VLS_withDefaultsArg`);
							codeGen.push(`>`);
						}
					}
					else if (scriptSetupRanges.propsRuntimeArg) {
						addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					}
					codeGen.push(`),\n`);
				}
				if (scriptSetupRanges.emitsTypeArg) {
					usedTypes.ConstructorOverloads = true;
					codeGen.push(`emits: ({} as __VLS_UnionToIntersection<__VLS_ConstructorOverloads<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
					codeGen.push(`>>),\n`);
				}
				else if (scriptSetupRanges.emitsRuntimeArg) {
					codeGen.push(`emits: (`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
					codeGen.push(`),\n`);
				}
			}

			codeGen.push(`setup() {\n`);
			codeGen.push(`return {\n`);

			if (bypassDefineComponent) {
				// fill $props
				if (scriptSetupRanges.propsTypeArg) {
					// NOTE: defineProps is inaccurate for $props
					codeGen.push(`$props: (await import('./__VLS_types.js')).makeOptional(defineProps<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.push(`>()),\n`);
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					// NOTE: defineProps is inaccurate for $props
					codeGen.push(`$props: (await import('./__VLS_types.js')).makeOptional(defineProps(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					codeGen.push(`)),\n`);
				}
				// fill $emit
				if (scriptSetupRanges.emitsAssignName) {
					codeGen.push(`$emit: ${scriptSetupRanges.emitsAssignName},\n`);
				}
				else if (scriptSetupRanges.emitsTypeArg) {
					codeGen.push(`$emit: defineEmits<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
					codeGen.push(`>(),\n`);
				}
				else if (scriptSetupRanges.emitsRuntimeArg) {
					codeGen.push(`$emit: defineEmits(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
					codeGen.push(`),\n`);
				}
			}

			if (scriptSetupRanges.exposeTypeArg) {
				codeGen.push(`...({} as `);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeTypeArg.start, scriptSetupRanges.exposeTypeArg.end);
				codeGen.push(`),\n`);
			}
			else if (scriptSetupRanges.exposeRuntimeArg) {
				codeGen.push(`...(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeRuntimeArg.start, scriptSetupRanges.exposeRuntimeArg.end);
				codeGen.push(`),\n`);
			}

			codeGen.push(`};\n`);
			codeGen.push(`},\n`);

			if (scriptRanges?.exportDefault?.args) {
				addVirtualCode('script', scriptRanges.exportDefault.args.start + 1, scriptRanges.exportDefault.args.end - 1);
			}

			codeGen.push(`});\n`);

			writeTemplate();

			if (vueCompilerOptions.experimentalRfc436) {
				codeGen.push(`return {} as Omit<JSX.Element, 'props' | 'children'> & Omit<InstanceType<typeof __VLS_Component>, '$slots' | '$emit'>`);
				codeGen.push(` & {\n`);
				if (scriptSetupRanges.propsTypeArg) {
					codeGen.push(`props: typeof __VLS_props,\n`);
				}
				else {
					codeGen.push(`props: InstanceType<typeof __VLS_Component>['$props'],\n`);
				}
				codeGen.push(`$emit: `);
				if (scriptSetupRanges.emitsTypeArg) {
					addVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
				}
				else {
					codeGen.push(`InstanceType<typeof __VLS_Component>['$emit']`);
				}
				codeGen.push(`,\n`);
				if (htmlGen?.slotsNum) {
					codeGen.push(`children: ReturnType<typeof __VLS_template>,\n`);
				}
				codeGen.push(`};\n`);
			}
			else {
				codeGen.push(`return {} as typeof __VLS_Component`);
				if (htmlGen?.slotsNum) {
					codeGen.push(` & { new (): { $slots: ReturnType<typeof __VLS_template> }`);
				}
				codeGen.push(`;\n`);
				codeGen.push(`};\n`);
			}
			codeGen.push(`};\n`);
			codeGen.push(`return {} as unknown as Awaited<ReturnType<typeof __VLS_setup>>;\n`);
			codeGen.push(`})`);
			if (!vueCompilerOptions.experimentalRfc436) {
				codeGen.push(`({} as any)`);
			}
			if (scriptRanges?.exportDefault && scriptRanges.exportDefault.expression.end !== scriptRanges.exportDefault.end) {
				addVirtualCode('script', scriptRanges.exportDefault.expression.end, scriptRanges.exportDefault.end);
			}
			codeGen.push(`;`);
			// fix https://github.com/johnsoncodehk/volar/issues/1127
			codeGen.push([
				'',
				'scriptSetup',
				sfc.scriptSetup.content.length,
				{ diagnostic: true },
			]);

			codeGen.push(`\n`);
		}
	}
	function writeTemplate() {

		if (!vueCompilerOptions.skipTemplateCodegen) {

			writeExportOptions();
			writeConstNameOption();

			codeGen.push(`function __VLS_template() {\n`);

			const templateGened = writeTemplateContext();

			codeGen.push(`}\n`);

			writeComponentForTemplateUsage(templateGened.cssIds);
		}
		else {
			codeGen.push(`function __VLS_template() {\n`);
			const templateUsageVars = [...getTemplateUsageVars()];
			codeGen.push(`// @ts-ignore\n`);
			codeGen.push(`[${templateUsageVars.join(', ')}]\n`);
			codeGen.push(`return {};\n`);
			codeGen.push(`}\n`);
		}
	}
	function writeComponentForTemplateUsage(cssIds: Set<string>) {

		if (sfc.scriptSetup && scriptSetupRanges) {

			codeGen.push(`const __VLS_component = (await import('${vueLibName}')).defineComponent({\n`);
			codeGen.push(`setup() {\n`);
			codeGen.push(`return {\n`);
			// fill ctx from props
			if (bypassDefineComponent) {
				if (scriptSetupRanges.propsAssignName) {
					codeGen.push(`...${scriptSetupRanges.propsAssignName},\n`);
				}
				else if (scriptSetupRanges.withDefaultsArg && scriptSetupRanges.propsTypeArg) {
					codeGen.push(`...withDefaults(defineProps<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.push(`>(), `);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
					codeGen.push(`),\n`);
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					codeGen.push(`...defineProps(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					codeGen.push(`),\n`);
				}
			}
			// bindings
			const bindingsArr: {
				bindings: { start: number, end: number; }[],
				content: string,
				vueTag: 'script' | 'scriptSetup',
			}[] = [];
			bindingsArr.push({
				bindings: scriptSetupRanges.bindings,
				content: sfc.scriptSetup.content,
				vueTag: 'scriptSetup',
			});
			if (scriptRanges && sfc.script) {
				bindingsArr.push({
					bindings: scriptRanges.bindings,
					content: sfc.script.content,
					vueTag: 'script',
				});
			}
			const templateUsageVars = getTemplateUsageVars();
			for (const { bindings, content } of bindingsArr) {
				for (const expose of bindings) {
					const varName = content.substring(expose.start, expose.end);
					if (!templateUsageVars.has(varName) && !cssIds.has(varName)) {
						continue;
					}
					const templateStart = getLength(codeGen);
					codeGen.push(varName);
					const templateEnd = getLength(codeGen);
					codeGen.push(`: `);

					const scriptStart = getLength(codeGen);
					codeGen.push(varName);
					const scriptEnd = getLength(codeGen);
					codeGen.push(',\n');

					teleports.push({
						sourceRange: [scriptStart, scriptEnd],
						generatedRange: [templateStart, templateEnd],
						data: {
							toSourceCapabilities: {
								definition: true,
								references: true,
								rename: true,
							},
							toGenedCapabilities: {
								definition: true,
								references: true,
								rename: true,
							},
						},
					});
				}
			}
			codeGen.push(`};\n`); // return {
			codeGen.push(`},\n`); // setup() {
			codeGen.push(`});\n`); // defineComponent({
		}
		else if (sfc.script) {
			codeGen.push(`let __VLS_component!: typeof import('./${path.basename(fileName)}')['default'];\n`);
		}
		else {
			codeGen.push(`const __VLS_component = (await import('${vueLibName}')).defineComponent({});\n`);
		}
	}
	function writeExportOptions() {
		codeGen.push(`\n`);
		codeGen.push(`const __VLS_componentsOption = `);
		if (sfc.script && scriptRanges?.exportDefault?.componentsOption) {
			const componentsOption = scriptRanges.exportDefault.componentsOption;
			codeGen.push([
				sfc.script.content.substring(componentsOption.start, componentsOption.end),
				'script',
				componentsOption.start,
				{
					references: true,
					rename: true,
				},
			]);
		}
		else {
			codeGen.push('{}');
		}
		codeGen.push(`;\n`);
	}
	function writeConstNameOption() {
		codeGen.push(`\n`);
		if (sfc.script && scriptRanges?.exportDefault?.nameOption) {
			const nameOption = scriptRanges.exportDefault.nameOption;
			codeGen.push(`const __VLS_name = `);
			codeGen.push(`${sfc.script.content.substring(nameOption.start, nameOption.end)} as const`);
			codeGen.push(`;\n`);
		}
		else if (sfc.scriptSetup) {
			codeGen.push(`let __VLS_name!: '${path.basename(fileName.substring(0, fileName.lastIndexOf('.')))}';\n`);
		}
		else {
			codeGen.push(`const __VLS_name = undefined;\n`);
		}
	}
	function writeTemplateContext() {

		const useGlobalThisTypeInCtx = fileName.endsWith('.html');

		codeGen.push(`let __VLS_ctx!: ${useGlobalThisTypeInCtx ? 'typeof globalThis &' : ''}`);
		codeGen.push(`import('./__VLS_types.js').PickNotAny<__VLS_Ctx, {}> & `);
		if (sfc.scriptSetup) {
			codeGen.push(`InstanceType<import('./__VLS_types.js').PickNotAny<typeof __VLS_Component, new () => {}>> & `);
		}
		codeGen.push(`InstanceType<import('./__VLS_types.js').PickNotAny<typeof __VLS_component, new () => {}>> & {\n`);

		/* CSS Module */
		for (const cssModule of cssModuleClasses) {
			codeGen.push(`${cssModule.style.module}: Record<string, string>`);
			for (const classNameRange of cssModule.classNameRanges) {
				writeCssClassProperty(
					cssModule.index,
					cssModule.style.content.substring(classNameRange.start + 1, classNameRange.end),
					classNameRange,
					'string',
					false,
				);
			}
			codeGen.push(';\n');
		}
		codeGen.push(`};\n`);

		/* Components */
		codeGen.push('/* Components */\n');
		codeGen.push(`let __VLS_otherComponents!: NonNullable<typeof __VLS_component extends { components: infer C } ? C : {}> & import('./__VLS_types.js').GlobalComponents & typeof __VLS_componentsOption & typeof __VLS_ctx;\n`);
		codeGen.push(`let __VLS_selfComponent!: import('./__VLS_types.js').SelfComponent<typeof __VLS_name, typeof __VLS_component & (new () => { ${getSlotsPropertyName(vueCompilerOptions.target ?? 3)}: typeof __VLS_slots })>;\n`);
		codeGen.push(`let __VLS_components!: typeof __VLS_otherComponents & Omit<typeof __VLS_selfComponent, keyof typeof __VLS_otherComponents>;\n`);

		/* Style Scoped */
		codeGen.push('/* Style Scoped */\n');
		codeGen.push('type __VLS_StyleScopedClasses = {}');
		for (const scopedCss of cssScopedClasses) {
			for (const classNameRange of scopedCss.classNameRanges) {
				writeCssClassProperty(
					scopedCss.index,
					scopedCss.style.content.substring(classNameRange.start + 1, classNameRange.end),
					classNameRange,
					'boolean',
					true,
				);
			}
		}
		codeGen.push(';\n');
		codeGen.push('let __VLS_styleScopedClasses!: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

		codeGen.push(`/* CSS variable injection */\n`);
		const cssIds = writeCssVars();
		codeGen.push(`/* CSS variable injection end */\n`);

		if (htmlGen) {
			for (const s of htmlGen.codeGen) {
				codeGen.push(s);
			}
		}

		if (!htmlGen) {
			codeGen.push(`const __VLS_slots = {};\n`);
		}

		codeGen.push(`return __VLS_slots;\n`);

		return { cssIds };

		function writeCssClassProperty(styleIndex: number, className: string, classRange: TextRange, propertyType: string, optional: boolean) {
			codeGen.push(`\n & { `);
			codeGen.push([
				'',
				'style_' + styleIndex,
				classRange.start,
				{
					references: true,
					referencesCodeLens: true,
				},
			]);
			codeGen.push(`'`);
			codeGen.push([
				className,
				'style_' + styleIndex,
				[classRange.start, classRange.end],
				{
					references: true,
					rename: {
						normalize: beforeCssRename,
						apply: doCssRename,
					},
				},
			]);
			codeGen.push(`'`);
			codeGen.push([
				'',
				'style_' + styleIndex,
				classRange.end,
				{},
			]);
			codeGen.push(`${optional ? '?' : ''}: ${propertyType}`);
			codeGen.push(` }`);
		}
		function writeCssVars() {

			const emptyLocalVars: Record<string, number> = {};
			const identifiers = new Set<string>();

			for (const cssVar of cssVars) {
				for (const cssBind of cssVar.ranges) {
					const code = cssVar.style.content.substring(cssBind.start, cssBind.end);
					walkInterpolationFragment(
						ts,
						code,
						ts.createSourceFile('/a.txt', code, ts.ScriptTarget.ESNext),
						(frag, fragOffset, isJustForErrorMapping) => {
							if (fragOffset === undefined) {
								codeGen.push(frag);
							}
							else {
								codeGen.push([
									frag,
									cssVar.style.name,
									cssBind.start + fragOffset,
									isJustForErrorMapping ? {
										diagnostic: true,
									} : {
										hover: true,
										references: true,
										definition: true,
										diagnostic: true,
										rename: true,
										completion: true,
										semanticTokens: true,
									},
								]);
							}
						},
						emptyLocalVars,
						identifiers,
					);
					codeGen.push(';\n');
				}
			}

			return identifiers;
		}
	}
	function getTemplateUsageVars() {

		const usageVars = new Set<string>();

		if (htmlGen) {

			let bindingNames: string[] = [];

			if (scriptSetupRanges) {
				bindingNames = bindingNames.concat(scriptSetupRanges.bindings.map(range => sfc.scriptSetup?.content.substring(range.start, range.end) ?? ''));
			}
			if (scriptRanges) {
				bindingNames = bindingNames.concat(scriptRanges.bindings.map(range => sfc.script?.content.substring(range.start, range.end) ?? ''));
			}

			// fix import components unused report
			for (const varName of bindingNames) {
				if (!!htmlGen.tagNames[varName] || !!htmlGen.tagNames[hyphenate(varName)]) {
					usageVars.add(varName);
				}
			}
			for (const tag of Object.keys(htmlGen.tagNames)) {
				if (tag.indexOf('.') >= 0) {
					usageVars.add(tag);
				}
			}
			for (const _id of htmlGen.identifiers) {
				usageVars.add(_id);
			}
		}

		return usageVars;
	}
}

// TODO: not working for overloads > n (n = 8)
// see: https://github.com/johnsoncodehk/volar/issues/60
function genConstructorOverloads(name = 'ConstructorOverloads', nums?: number) {
	let code = `type ${name}<T> =\n`;
	if (nums === undefined) {
		for (let i = 8; i >= 1; i--) {
			gen(i);
		}
	}
	else {
		gen(nums);
	}
	code += `// 0\n`;
	code += `{};\n`;
	return code;

	function gen(i: number) {
		code += `// ${i}\n`;
		code += `T extends {\n`;
		for (let j = 1; j <= i; j++) {
			code += `(event: infer E${j}, ...payload: infer P${j}): void;\n`;
		}
		code += `} ? (\n`;
		for (let j = 1; j <= i; j++) {
			if (j > 1) code += '& ';
			code += `(E${j} extends string ? { [K${j} in E${j}]: (...payload: P${j}) => void } : {})\n`;
		}
		code += `) :\n`;
	}
}

function beforeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.slice(1) : newName;
}

function doCssRename(newName: string) {
	return '.' + newName;
}
