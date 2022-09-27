import { CodeGen } from '@volar/code-gen';
import type { TeleportMappingData, TextRange } from '@volar/language-core';
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
import { EmbeddedFileMappingData } from '../sourceFile';

/**
 * TODO: rewrite this
 */
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
	codeGen = new CodeGen<EmbeddedFileMappingData>(),
	teleports: SourceMaps.Mapping<TeleportMappingData>[] = [],
) {

	const downgradePropsAndEmitsToSetupReturnOnScriptSetup = vueCompilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup === 'onlyJs'
		? lang === 'js' || lang === 'jsx'
		: !!vueCompilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup;
	const vueVersion = vueCompilerOptions.target ?? 3;
	const vueLibName = getVueLibraryName(vueVersion);
	const usedTypes = {
		DefinePropsToOptions: false,
		mergePropDefaults: false,
		ConstructorOverloads: false,
	};

	let exportdefaultStart: number | undefined;
	let exportdefaultEnd: number | undefined;

	writeScriptSrc();
	writeScriptSetupImportsSegment();
	writeScriptContentBeforeExportDefault();
	writeScriptSetupAndTemplate();
	writeScriptSetupTypes();
	writeScriptContentAfterExportDefault();
	writeTemplateIfNoScriptSetup();

	if (!sfc.script && !sfc.scriptSetup) {
		codeGen._append(
			'export default {} as any',
			{
				start: 0,
				end: 0,
			},
			SourceMaps.MappingKind.Expand,
			{
				vueTag: undefined,
				capabilities: {},
			},
		);
	}

	if (sfc.scriptSetup) {
		// for code action edits
		codeGen.append(
			'',
			sfc.scriptSetup.content.length,
			{
				vueTag: 'scriptSetup',
				capabilities: {},
			},
		);
	}

	// fix https://github.com/johnsoncodehk/volar/issues/1048
	// fix https://github.com/johnsoncodehk/volar/issues/435
	codeGen.mappings.push({
		data: {
			vueTag: undefined,
			capabilities: {},
		},
		kind: SourceMaps.MappingKind.Expand,
		mappedRange: {
			start: 0,
			end: codeGen.text.length,
		},
		sourceRange: {
			start: 0,
			end: 0,
		},
	});

	// fix https://github.com/johnsoncodehk/volar/issues/1127
	if (sfc.scriptSetup && exportdefaultStart !== undefined && exportdefaultEnd !== undefined) {
		codeGen.mappings.push({
			data: {
				vueTag: 'scriptSetup',
				capabilities: {
					diagnostic: true,
				},
			},
			kind: SourceMaps.MappingKind.Totally,
			mappedRange: {
				start: exportdefaultStart,
				end: exportdefaultEnd,
			},
			sourceRange: {
				start: 0,
				end: sfc.scriptSetup.content.length,
			},
		});
	}

	return {
		codeGen,
		teleports,
	};

	function writeScriptSetupTypes() {
		if (usedTypes.DefinePropsToOptions) {
			if (compilerOptions.exactOptionalPropertyTypes) {
				codeGen.append(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueLibName}').PropType<T[K]> } : { type: import('${vueLibName}').PropType<T[K]>, required: true } };\n`);
			}
			else {
				codeGen.append(`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;\n`);
				codeGen.append(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueLibName}').PropType<__VLS_NonUndefinedable<T[K]>> } : { type: import('${vueLibName}').PropType<T[K]>, required: true } };\n`);
			}
		}
		if (usedTypes.mergePropDefaults) {
			codeGen.append(`type __VLS_WithDefaults<P, D> = {
					// use 'keyof Pick<P, keyof P>' instead of 'keyof P' to keep props jsdoc
					[K in keyof Pick<P, keyof P>]: K extends keyof D ? P[K] & {
						default: D[K]
					} : P[K]
				};\n`);
		}
		if (usedTypes.ConstructorOverloads) {
			// fix https://github.com/johnsoncodehk/volar/issues/926
			codeGen.append('type __VLS_UnionToIntersection<U> = (U extends unknown ? (arg: U) => unknown : never) extends ((arg: infer P) => unknown) ? P : never;\n');
			if (scriptSetupRanges && scriptSetupRanges.emitsTypeNums !== -1) {
				codeGen.append(genConstructorOverloads('__VLS_ConstructorOverloads', scriptSetupRanges.emitsTypeNums));
			}
			else {
				codeGen.append(genConstructorOverloads('__VLS_ConstructorOverloads'));
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

		codeGen.append(`export * from `);
		codeGen.append(
			`'${src}'`,
			-1,
			{
				vueTag: 'scriptSrc',
				capabilities: {
					hover: true,
					references: true,
					definitions: true,
					rename: true,
					diagnostic: true,
					completion: true,
					semanticTokens: true,
				},
			}
		);
		codeGen.append(`;\n`);
		codeGen.append(`export { default } from '${src}';\n`);
	}
	function writeScriptContentBeforeExportDefault() {
		if (!sfc.script)
			return;

		if (!!sfc.scriptSetup && scriptRanges?.exportDefault) {
			addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
			exportdefaultStart = codeGen.text.length - (scriptRanges.exportDefault.expression.start - scriptRanges.exportDefault.start);
		}
		else {
			let isExportRawObject = false;
			if (scriptRanges?.exportDefault) {
				isExportRawObject = sfc.script.content.substring(scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end).startsWith('{');
			}
			const warpperEnabled = vueCompilerOptions.experimentalComponentOptionsWrapperEnable === true
				|| (vueCompilerOptions.experimentalComponentOptionsWrapperEnable === 'onlyJs' && (lang === 'js' || lang === 'jsx'));
			if (isExportRawObject && warpperEnabled && scriptRanges?.exportDefault) {
				addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
				codeGen.append(vueCompilerOptions.experimentalComponentOptionsWrapper[0]);
				addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end);
				codeGen.append(vueCompilerOptions.experimentalComponentOptionsWrapper[1]);
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
	function addVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
		codeGen.append(
			(vueTag === 'script' ? sfc.script : sfc.scriptSetup)!.content.substring(start, end),
			start,
			{
				vueTag: vueTag,
				capabilities: {
					hover: true,
					references: true,
					definitions: true,
					rename: true,
					diagnostic: true, // also working for setup() returns unused in template checking
					completion: true,
					semanticTokens: true,
				},
			}
		);
	}
	function addExtraReferenceVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
		codeGen.append(
			(vueTag === 'scriptSetup' ? sfc.scriptSetup : sfc.script)!.content.substring(start, end),
			start,
			{
				vueTag,
				capabilities: {
					references: true,
					definitions: true,
					rename: true,
				},
			},
		);
	}
	function writeScriptSetupImportsSegment() {

		if (!sfc.scriptSetup)
			return;

		if (!scriptSetupRanges)
			return;

		codeGen.append(
			sfc.scriptSetup.content.substring(0, scriptSetupRanges.importSectionEndOffset),
			0,
			{
				vueTag: 'scriptSetup',
				capabilities: {
					hover: true,
					references: true,
					definitions: true,
					diagnostic: true,
					rename: true,
					completion: true,
					semanticTokens: true,
				},
			},
		);
	}
	function writeTemplateIfNoScriptSetup() {

		if (!sfc.scriptSetup) {
			writeTemplate();
		}
	}
	function writeScriptSetupAndTemplate() {

		if (sfc.scriptSetup && scriptSetupRanges) {

			if (scriptRanges?.exportDefault) {
				codeGen.append('await (async () => {\n');
			}
			else {
				exportdefaultStart = codeGen.text.length;
				codeGen.append('export default await (async () => {\n');
			}

			codeGen.append('const __VLS_setup = async () => {\n');

			codeGen.append(
				sfc.scriptSetup.content.substring(scriptSetupRanges.importSectionEndOffset),
				scriptSetupRanges.importSectionEndOffset,
				{
					vueTag: 'scriptSetup',
					capabilities: {
						hover: true,
						references: true,
						definitions: true,
						diagnostic: true,
						rename: true,
						completion: true,
						semanticTokens: true,
					},
				},
			);

			if (scriptSetupRanges.propsTypeArg && scriptSetupRanges.withDefaultsArg) {
				// fix https://github.com/johnsoncodehk/volar/issues/1187
				codeGen.append(`const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
				codeGen.append(`);\n`);
			}

			if (scriptRanges?.exportDefault && scriptRanges.exportDefault.expression.start !== scriptRanges.exportDefault.args.start) {
				// use defineComponent() from user space code if it exist
				codeGen.append(`const __VLS_Component = `);
				addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.args.start);
				codeGen.append(`{\n`);
			}
			else {
				codeGen.append(`const __VLS_Component = (await import('${vueLibName}')).defineComponent({\n`);
			}

			if (!downgradePropsAndEmitsToSetupReturnOnScriptSetup) {
				if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg) {
					codeGen.append(`props: (`);
					if (scriptSetupRanges.propsTypeArg) {

						usedTypes.DefinePropsToOptions = true;
						codeGen.append(`{} as `);

						if (scriptSetupRanges.withDefaultsArg) {
							usedTypes.mergePropDefaults = true;
							codeGen.append(`__VLS_WithDefaults<`);
						}

						codeGen.append(`__VLS_TypePropsToRuntimeProps<`);
						addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
						codeGen.append(`>`);

						if (scriptSetupRanges.withDefaultsArg) {
							codeGen.append(`, typeof __VLS_withDefaultsArg`);
							codeGen.append(`>`);
						}
					}
					else if (scriptSetupRanges.propsRuntimeArg) {
						addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					}
					codeGen.append(`),\n`);
				}
				if (scriptSetupRanges.emitsTypeArg) {
					usedTypes.ConstructorOverloads = true;
					codeGen.append(`emits: ({} as __VLS_UnionToIntersection<__VLS_ConstructorOverloads<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
					codeGen.append(`>>),\n`);
				}
				else if (scriptSetupRanges.emitsRuntimeArg) {
					codeGen.append(`emits: (`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
					codeGen.append(`),\n`);
				}
			}

			codeGen.append(`setup() {\n`);
			codeGen.append(`return {\n`);

			if (downgradePropsAndEmitsToSetupReturnOnScriptSetup) {
				// fill $props
				if (scriptSetupRanges.propsTypeArg) {
					// NOTE: defineProps is inaccurate for $props
					codeGen.append(`$props: (await import('./__VLS_types.js')).makeOptional(defineProps<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.append(`>()),\n`);
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					// NOTE: defineProps is inaccurate for $props
					codeGen.append(`$props: (await import('./__VLS_types.js')).makeOptional(defineProps(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					codeGen.append(`)),\n`);
				}
				// fill $emit
				if (scriptSetupRanges.emitsAssignName) {
					codeGen.append(`$emit: ${scriptSetupRanges.emitsAssignName},\n`);
				}
				else if (scriptSetupRanges.emitsTypeArg) {
					codeGen.append(`$emit: defineEmits<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
					codeGen.append(`>(),\n`);
				}
				else if (scriptSetupRanges.emitsRuntimeArg) {
					codeGen.append(`$emit: defineEmits(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
					codeGen.append(`),\n`);
				}
			}

			if (scriptSetupRanges.exposeTypeArg) {
				codeGen.append(`...({} as `);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeTypeArg.start, scriptSetupRanges.exposeTypeArg.end);
				codeGen.append(`),\n`);
			}
			else if (scriptSetupRanges.exposeRuntimeArg) {
				codeGen.append(`...(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeRuntimeArg.start, scriptSetupRanges.exposeRuntimeArg.end);
				codeGen.append(`),\n`);
			}

			codeGen.append(`};\n`);
			codeGen.append(`},\n`);

			if (sfc.script && scriptRanges?.exportDefault?.args) {
				addVirtualCode('script', scriptRanges.exportDefault.args.start + 1, scriptRanges.exportDefault.args.end - 1);
			}

			codeGen.append(`});\n`);

			writeTemplate();

			if (htmlGen?.slotsNum) {
				codeGen.append(`return {} as typeof __VLS_Component & (new () => { ${getSlotsPropertyName(vueVersion)}: ReturnType<typeof __VLS_template> });\n`);
			}
			else {
				codeGen.append(`return {} as typeof __VLS_Component;\n`);
			}

			codeGen.append(`};\n`);
			codeGen.append(`return await __VLS_setup();\n`);
			codeGen.append(`})();`);
			exportdefaultEnd = codeGen.text.length;

			codeGen.append(`\n`);
		}
	}
	function writeTemplate() {

		if (!vueCompilerOptions.skipTemplateCodegen) {

			writeExportOptions();
			writeConstNameOption();

			codeGen.append(`function __VLS_template() {\n`);

			const templateGened = writeTemplateContext();

			codeGen.append(`}\n`);

			writeComponentForTemplateUsage(templateGened.cssIds);
		}
		else {
			codeGen.append(`function __VLS_template() {\n`);
			const templateUsageVars = [...getTemplateUsageVars()];
			codeGen.append(`// @ts-ignore\n`);
			codeGen.append(`[${templateUsageVars.join(', ')}]\n`);
			codeGen.append(`return {};\n`);
			codeGen.append(`}\n`);
		}
	}
	function writeComponentForTemplateUsage(cssIds: Set<string>) {

		if (sfc.scriptSetup && scriptSetupRanges) {

			codeGen.append(`const __VLS_component = (await import('${vueLibName}')).defineComponent({\n`);
			codeGen.append(`setup() {\n`);
			codeGen.append(`return {\n`);
			// fill ctx from props
			if (downgradePropsAndEmitsToSetupReturnOnScriptSetup) {
				if (scriptSetupRanges.propsAssignName) {
					codeGen.append(`...${scriptSetupRanges.propsAssignName},\n`);
				}
				else if (scriptSetupRanges.withDefaultsArg && scriptSetupRanges.propsTypeArg) {
					codeGen.append(`...withDefaults(defineProps<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.append(`>(), `);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
					codeGen.append(`),\n`);
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					codeGen.append(`...defineProps(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					codeGen.append(`),\n`);
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
					const templateSideRange = codeGen.append(varName);
					codeGen.append(`: `);
					const scriptSideRange = codeGen.append(varName);
					codeGen.append(',\n');

					teleports.push({
						sourceRange: scriptSideRange,
						mappedRange: templateSideRange,
						kind: SourceMaps.MappingKind.Offset,
						data: {
							toSourceCapabilities: {
								definitions: true,
								references: true,
								rename: true,
							},
							toGenedCapabilities: {
								definitions: true,
								references: true,
								rename: true,
							},
						},
					});
				}
			}
			codeGen.append(`};\n`); // return {
			codeGen.append(`},\n`); // setup() {
			codeGen.append(`});\n`); // defineComponent({
		}
		else if (sfc.script) {
			codeGen.append(`let __VLS_component!: typeof import('./${path.basename(fileName)}')['default'];\n`);
		}
		else {
			codeGen.append(`const __VLS_component = (await import('${vueLibName}')).defineComponent({});\n`);
		}
	}
	function writeExportOptions() {
		codeGen.append(`\n`);
		codeGen.append(`const __VLS_componentsOption = `);
		if (sfc.script && scriptRanges?.exportDefault?.componentsOption) {
			const componentsOption = scriptRanges.exportDefault.componentsOption;
			codeGen.append(
				sfc.script.content.substring(componentsOption.start, componentsOption.end),
				componentsOption.start,
				{
					vueTag: 'script',
					capabilities: {
						references: true,
						rename: true,
					},
				},
			);
		}
		else {
			codeGen.append('{}');
		}
		codeGen.append(`;\n`);
	}
	function writeConstNameOption() {
		codeGen.append(`\n`);
		if (sfc.script && scriptRanges?.exportDefault?.nameOption) {
			const nameOption = scriptRanges.exportDefault.nameOption;
			codeGen.append(`const __VLS_name = `);
			codeGen.append(`${sfc.script.content.substring(nameOption.start, nameOption.end)} as const`);
			codeGen.append(`;\n`);
		}
		else if (sfc.scriptSetup) {
			codeGen.append(`let __VLS_name!: '${path.basename(fileName.substring(0, fileName.lastIndexOf('.')))}';\n`);
		}
		else {
			codeGen.append(`const __VLS_name = undefined;\n`);
		}
	}
	function writeTemplateContext() {

		const useGlobalThisTypeInCtx = fileName.endsWith('.html');

		codeGen.append(`let __VLS_ctx!: ${useGlobalThisTypeInCtx ? 'typeof globalThis &' : ''}`);
		codeGen.append(`import('./__VLS_types.js').PickNotAny<__VLS_Ctx, {}> & `);
		if (sfc.scriptSetup) {
			codeGen.append(`InstanceType<import('./__VLS_types.js').PickNotAny<typeof __VLS_Component, new () => {}>> & `);
		}
		codeGen.append(`InstanceType<import('./__VLS_types.js').PickNotAny<typeof __VLS_component, new () => {}>> & {\n`);

		/* CSS Module */
		for (const cssModule of cssModuleClasses) {
			codeGen.append(`${cssModule.style.module}: Record<string, string>`);
			for (const classNameRange of cssModule.classNameRanges) {
				writeCssClassProperty(
					cssModule.index,
					cssModule.style.content.substring(classNameRange.start + 1, classNameRange.end),
					classNameRange,
					'string',
					false,
				);
			}
			codeGen.append(';\n');
		}
		codeGen.append(`};\n`);

		/* Components */
		codeGen.append('/* Components */\n');
		codeGen.append(`let __VLS_otherComponents!: NonNullable<typeof __VLS_component extends { components: infer C } ? C : {}> & import('./__VLS_types.js').GlobalComponents & typeof __VLS_componentsOption & typeof __VLS_ctx;\n`);
		codeGen.append(`let __VLS_selfComponent!: import('./__VLS_types.js').SelfComponent<typeof __VLS_name, typeof __VLS_component & (new () => { ${getSlotsPropertyName(vueCompilerOptions.target ?? 3)}: typeof __VLS_slots })>;\n`);
		codeGen.append(`let __VLS_components!: typeof __VLS_otherComponents & Omit<typeof __VLS_selfComponent, keyof typeof __VLS_otherComponents>;\n`);

		/* Style Scoped */
		codeGen.append('/* Style Scoped */\n');
		codeGen.append('type __VLS_StyleScopedClasses = {}');
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
		codeGen.append(';\n');
		codeGen.append('let __VLS_styleScopedClasses!: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

		codeGen.append(`/* CSS variable injection */\n`);
		const cssIds = writeCssVars();
		codeGen.append(`/* CSS variable injection end */\n`);

		if (htmlGen) {
			codeGen._merge(htmlGen.codeGen);
		}

		if (!htmlGen) {
			codeGen.append(`const __VLS_slots = {};\n`);
		}

		codeGen.append(`return __VLS_slots;\n`);

		return { cssIds };

		function writeCssClassProperty(styleIndex: number, className: string, classRange: TextRange, propertyType: string, optional: boolean) {
			codeGen.append(`\n & { `);
			codeGen.mappings.push({
				mappedRange: {
					start: codeGen.text.length,
					end: codeGen.text.length + className.length + 2,
				},
				sourceRange: classRange,
				kind: SourceMaps.MappingKind.Totally,
				additional: [{
					mappedRange: {
						start: codeGen.text.length + 1, // + '
						end: codeGen.text.length + 1 + className.length,
					},
					sourceRange: classRange,
					kind: SourceMaps.MappingKind.Offset,
				}],
				data: {
					vueTag: 'style',
					vueTagIndex: styleIndex,
					capabilities: {
						references: true,
						referencesCodeLens: true,
						rename: {
							normalize: beforeCssRename,
							apply: doCssRename,
						},
					},
				},
			});
			codeGen.append(`'${className}'${optional ? '?' : ''}: ${propertyType}`);
			codeGen.append(` }`);
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
								codeGen.append(frag);
							}
							else {
								codeGen.append(
									frag,
									cssBind.start + fragOffset,
									{
										vueTag: 'style',
										vueTagIndex: cssVar.styleIndex,
										capabilities: isJustForErrorMapping ? {
											diagnostic: true,
										} : {
											hover: true,
											references: true,
											definitions: true,
											diagnostic: true,
											rename: true,
											completion: true,
											semanticTokens: true,
										},
									},
								);
							}
						},
						emptyLocalVars,
						identifiers,
					);
					codeGen.append(';\n');
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

function doCssRename(oldName: string, newName: string) {
	return '.' + newName;
}
