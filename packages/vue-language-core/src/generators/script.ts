import { CodeGen, mergeCodeGen } from '@volar/code-gen';
import * as SourceMaps from '@volar/source-map';
import { hyphenate } from '@vue/shared';
import { posix as path } from 'path';
import type * as templateGen from '../generators/template';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { collectCssVars, collectStyleCssClasses } from '../plugins/vue-tsx';
import { Sfc } from '../sourceFile';
import type { EmbeddedFileMappingData, TeleportMappingData } from '../types';
import { TextRange, VueCompilerOptions } from '../types';
import { getSlotsPropertyName, getVueLibraryName } from '../utils/shared';
import { SearchTexts } from '../utils/string';
import { walkInterpolationFragment } from '../utils/transform';

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
	compilerOptions: VueCompilerOptions,
	codeGen = new CodeGen<EmbeddedFileMappingData>(),
	teleports: SourceMaps.Mapping<TeleportMappingData>[] = [],
) {

	const downgradePropsAndEmitsToSetupReturnOnScriptSetup = compilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup === 'onlyJs'
		? lang === 'js' || lang === 'jsx'
		: !!compilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup;
	const vueVersion = compilerOptions.target ?? 3;
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
		codeGen.addCode(
			'export default {} as any',
			{
				start: 0,
				end: 0,
			},
			SourceMaps.Mode.Expand,
			{
				vueTag: undefined,
				capabilities: {},
			},
		);
	}

	if (sfc.scriptSetup) {
		// for code action edits
		codeGen.addCode(
			'',
			{
				start: sfc.scriptSetup.content.length,
				end: sfc.scriptSetup.content.length,
			},
			SourceMaps.Mode.Offset,
			{
				vueTag: 'scriptSetup',
				capabilities: {},
			},
		);
	}

	// fix https://github.com/johnsoncodehk/volar/issues/1048
	// fix https://github.com/johnsoncodehk/volar/issues/435
	codeGen.addMapping2({
		data: {
			vueTag: undefined,
			capabilities: {},
		},
		mode: SourceMaps.Mode.Expand,
		mappedRange: {
			start: 0,
			end: codeGen.getText().length,
		},
		sourceRange: {
			start: 0,
			end: 0,
		},
	});

	// fix https://github.com/johnsoncodehk/volar/issues/1127
	if (sfc.scriptSetup && exportdefaultStart !== undefined && exportdefaultEnd !== undefined) {
		codeGen.addMapping2({
			data: {
				vueTag: 'scriptSetup',
				capabilities: {
					diagnostic: true,
				},
			},
			mode: SourceMaps.Mode.Totally,
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
			codeGen.addText(`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;\n`);
			codeGen.addText(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueLibName}').PropType<__VLS_NonUndefinedable<T[K]>> } : { type: import('${vueLibName}').PropType<T[K]>, required: true } };\n`);
		}
		if (usedTypes.mergePropDefaults) {
			codeGen.addText(`type __VLS_WithDefaults<P, D> = {
					// use 'keyof Pick<P, keyof P>' instead of 'keyof P' to keep props jsdoc
					[K in keyof Pick<P, keyof P>]: K extends keyof D ? P[K] & {
						default: D[K]
					} : P[K]
				};\n`);
		}
		if (usedTypes.ConstructorOverloads) {
			// fix https://github.com/johnsoncodehk/volar/issues/926
			codeGen.addText('type __VLS_UnionToIntersection<U> = (U extends unknown ? (arg: U) => unknown : never) extends ((arg: infer P) => unknown) ? P : never;\n');
			if (scriptSetupRanges && scriptSetupRanges.emitsTypeNums !== -1) {
				codeGen.addText(genConstructorOverloads('__VLS_ConstructorOverloads', scriptSetupRanges.emitsTypeNums));
			}
			else {
				codeGen.addText(genConstructorOverloads('__VLS_ConstructorOverloads'));
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

		codeGen.addText(`export * from `);
		codeGen.addCode(
			`'${src}'`,
			{ start: -1, end: -1 },
			SourceMaps.Mode.Offset,
			{
				vueTag: 'scriptSrc',
				capabilities: {
					basic: true,
					references: true,
					definitions: true,
					rename: true,
					diagnostic: true,
					completion: true,
					semanticTokens: true,
				},
			}
		);
		codeGen.addText(`;\n`);
		codeGen.addText(`export { default } from '${src}';\n`);
	}
	function writeScriptContentBeforeExportDefault() {
		if (!sfc.script)
			return;

		if (!!sfc.scriptSetup && scriptRanges?.exportDefault) {
			addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
			exportdefaultStart = codeGen.getText().length - (scriptRanges.exportDefault.expression.start - scriptRanges.exportDefault.start);
		}
		else {
			let isExportRawObject = false;
			if (scriptRanges?.exportDefault) {
				isExportRawObject = sfc.script.content.substring(scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end).startsWith('{');
			}
			const wrapMode = getImplicitWrapComponentOptionsMode(lang);
			if (isExportRawObject && wrapMode && scriptRanges?.exportDefault) {
				addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
				if (wrapMode === 'defineComponent') {
					codeGen.addText(`(await import('${vueLibName}')).defineComponent(`);
				}
				else {
					codeGen.addText(`(await import('vue')).default.extend(`);
				}
				addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end);
				codeGen.addText(`)`);
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
		codeGen.addCode2(
			(vueTag === 'script' ? sfc.script : sfc.scriptSetup)!.content.substring(start, end),
			start,
			{
				vueTag: vueTag,
				capabilities: {
					basic: true,
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
		codeGen.addCode2(
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

		codeGen.addCode2(
			sfc.scriptSetup.content.substring(0, scriptSetupRanges.importSectionEndOffset),
			0,
			{
				vueTag: 'scriptSetup',
				capabilities: {
					basic: true,
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
				codeGen.addText('await (async () => {\n');
			}
			else {
				exportdefaultStart = codeGen.getText().length;
				codeGen.addText('export default await (async () => {\n');
			}

			codeGen.addText('const __VLS_setup = async () => {\n');

			codeGen.addCode2(
				sfc.scriptSetup.content.substring(scriptSetupRanges.importSectionEndOffset),
				scriptSetupRanges.importSectionEndOffset,
				{
					vueTag: 'scriptSetup',
					capabilities: {
						basic: true,
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
				codeGen.addText(`const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
				codeGen.addText(`);\n`);
			}

			if (scriptRanges?.exportDefault && scriptRanges.exportDefault.expression.start !== scriptRanges.exportDefault.args.start) {
				// use defineComponent() from user space code if it exist
				codeGen.addText(`const __VLS_Component = `);
				addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.args.start);
				codeGen.addText(`{\n`);
			}
			else {
				codeGen.addText(`const __VLS_Component = (await import('${vueLibName}')).defineComponent({\n`);
			}

			if (!downgradePropsAndEmitsToSetupReturnOnScriptSetup) {
				if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg) {
					codeGen.addText(`props: (`);
					if (scriptSetupRanges.propsTypeArg) {

						usedTypes.DefinePropsToOptions = true;
						codeGen.addText(`{} as `);

						if (scriptSetupRanges.withDefaultsArg) {
							usedTypes.mergePropDefaults = true;
							codeGen.addText(`__VLS_WithDefaults<`);
						}

						codeGen.addText(`__VLS_TypePropsToRuntimeProps<`);
						addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
						codeGen.addText(`>`);

						if (scriptSetupRanges.withDefaultsArg) {
							codeGen.addText(`, typeof __VLS_withDefaultsArg`);
							codeGen.addText(`>`);
						}
					}
					else if (scriptSetupRanges.propsRuntimeArg) {
						addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					}
					codeGen.addText(`),\n`);
				}
				if (scriptSetupRanges.emitsTypeArg) {
					usedTypes.ConstructorOverloads = true;
					codeGen.addText(`emits: ({} as __VLS_UnionToIntersection<__VLS_ConstructorOverloads<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
					codeGen.addText(`>>),\n`);
				}
				else if (scriptSetupRanges.emitsRuntimeArg) {
					codeGen.addText(`emits: (`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
					codeGen.addText(`),\n`);
				}
			}

			codeGen.addText(`setup() {\n`);
			codeGen.addText(`return {\n`);

			if (downgradePropsAndEmitsToSetupReturnOnScriptSetup) {
				// fill $props
				if (scriptSetupRanges.propsTypeArg) {
					// NOTE: defineProps is inaccurate for $props
					codeGen.addText(`$props: (await import('./__VLS_types.js')).makeOptional(defineProps<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.addText(`>()),\n`);
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					// NOTE: defineProps is inaccurate for $props
					codeGen.addText(`$props: (await import('./__VLS_types.js')).makeOptional(defineProps(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					codeGen.addText(`)),\n`);
				}
				// fill $emit
				if (scriptSetupRanges.emitsAssignName) {
					codeGen.addText(`$emit: ${scriptSetupRanges.emitsAssignName},\n`);
				}
				else if (scriptSetupRanges.emitsTypeArg) {
					codeGen.addText(`$emit: defineEmits<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
					codeGen.addText(`>(),\n`);
				}
				else if (scriptSetupRanges.emitsRuntimeArg) {
					codeGen.addText(`$emit: defineEmits(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
					codeGen.addText(`),\n`);
				}
			}

			if (scriptSetupRanges.exposeTypeArg) {
				codeGen.addText(`...({} as `);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeTypeArg.start, scriptSetupRanges.exposeTypeArg.end);
				codeGen.addText(`),\n`);
			}
			else if (scriptSetupRanges.exposeRuntimeArg) {
				codeGen.addText(`...(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeRuntimeArg.start, scriptSetupRanges.exposeRuntimeArg.end);
				codeGen.addText(`),\n`);
			}

			codeGen.addText(`};\n`);
			codeGen.addText(`},\n`);

			if (sfc.script && scriptRanges?.exportDefault?.args) {
				addVirtualCode('script', scriptRanges.exportDefault.args.start + 1, scriptRanges.exportDefault.args.end - 1);
			}

			codeGen.addText(`});\n`);

			writeTemplate();

			codeGen.addText(`return {} as typeof __VLS_Component & (new () => { ${getSlotsPropertyName(vueVersion)}: ReturnType<typeof __VLS_template> });\n`);

			codeGen.addText(`};\n`);
			codeGen.addText(`return await __VLS_setup();\n`);
			codeGen.addText(`})();`);
			exportdefaultEnd = codeGen.getText().length;

			codeGen.addText(`\n`);
		}
	}
	function writeTemplate() {

		if (lang === 'jsx' || lang === 'tsx') {

			codeGen.addText(`function __VLS_template() {\n`);
			codeGen.addText(`import * as __VLS_types from './__VLS_types.js'; import('./__VLS_types.js');\n`);

			writeExportOptions();
			writeConstNameOption();
			const templateGened = writeTemplateContext();

			codeGen.addText(`}\n`);

			writeComponentForTemplateUsage(templateGened.cssIds);
		}
		else {
			codeGen.addText(`function __VLS_template() {\n`);
			const templateUsageVars = [...getTemplateUsageVars()];
			codeGen.addText(`// @ts-ignore\n`);
			codeGen.addText(`[${templateUsageVars.join(', ')}]\n`);
			codeGen.addText(`return {};\n`);
			codeGen.addText(`}\n`);
		}
	}
	function writeComponentForTemplateUsage(cssIds: Set<string>) {

		if (sfc.scriptSetup && scriptSetupRanges) {

			codeGen.addText(`const __VLS_component = (await import('${vueLibName}')).defineComponent({\n`);
			codeGen.addText(`setup() {\n`);
			codeGen.addText(`return {\n`);
			// fill ctx from props
			if (downgradePropsAndEmitsToSetupReturnOnScriptSetup) {
				if (scriptSetupRanges.propsAssignName) {
					codeGen.addText(`...${scriptSetupRanges.propsAssignName},\n`);
				}
				else if (scriptSetupRanges.withDefaultsArg && scriptSetupRanges.propsTypeArg) {
					codeGen.addText(`...withDefaults(defineProps<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codeGen.addText(`>(), `);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
					codeGen.addText(`),\n`);
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					codeGen.addText(`...defineProps(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					codeGen.addText(`),\n`);
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
					const templateSideRange = codeGen.addText(varName);
					codeGen.addText(`: `);
					const scriptSideRange = codeGen.addText(varName);
					codeGen.addText(',\n');

					teleports.push({
						sourceRange: scriptSideRange,
						mappedRange: templateSideRange,
						mode: SourceMaps.Mode.Offset,
						data: {
							toSource: {
								capabilities: {
									definitions: true,
									references: true,
									rename: true,
								},
							},
							toTarget: {
								capabilities: {
									definitions: true,
									references: true,
									rename: true,
								},
							},
						},
					});
				}
			}
			codeGen.addText(`};\n`); // return {
			codeGen.addText(`},\n`); // setup() {
			codeGen.addText(`});\n`); // defineComponent({
		}
		else if (sfc.script) {
			codeGen.addText(`let __VLS_component!: typeof import('./${path.basename(fileName)}')['default'];\n`);
		}
		else {
			codeGen.addText(`const __VLS_component = (await import('${vueLibName}')).defineComponent({});\n`);
		}
	}
	function writeExportOptions() {
		codeGen.addText(`\n`);
		codeGen.addText(`const __VLS_options = {\n`);
		if (sfc.script && scriptRanges?.exportDefault?.args) {
			const args = scriptRanges.exportDefault.args;
			codeGen.addText(`...(`);
			codeGen.addCode2(
				sfc.script.content.substring(args.start, args.end),
				args.start,
				{
					vueTag: 'script',
					capabilities: {
						references: true,
						rename: true,
					},
				},
			);
			codeGen.addText(`),\n`);
		}
		codeGen.addText(`};\n`);
	}
	function writeConstNameOption() {
		codeGen.addText(`\n`);
		if (sfc.script && scriptRanges?.exportDefault?.args) {
			const args = scriptRanges.exportDefault.args;
			codeGen.addText(`const __VLS_name = (await import('./__VLS_types.js')).getNameOption(`);
			codeGen.addText(`${sfc.script.content.substring(args.start, args.end)} as const`);
			codeGen.addText(`);\n`);
		}
		else if (sfc.scriptSetup) {
			codeGen.addText(`let __VLS_name!: '${path.basename(fileName.substring(0, fileName.lastIndexOf('.')))}';\n`);
		}
		else {
			codeGen.addText(`const __VLS_name = undefined;\n`);
		}
	}
	function writeTemplateContext() {

		const useGlobalThisTypeInCtx = fileName.endsWith('.html');

		codeGen.addText(`let __VLS_ctx!: ${useGlobalThisTypeInCtx ? 'typeof globalThis &' : ''}`);
		codeGen.addText(`__VLS_types.PickNotAny<__VLS_Ctx, {}> & `);
		if (sfc.scriptSetup) {
			codeGen.addText(`InstanceType<__VLS_types.PickNotAny<typeof __VLS_Component, new () => {}>> & `);
		}
		codeGen.addText(`InstanceType<__VLS_types.PickNotAny<typeof __VLS_component, new () => {}>> & {\n`);

		/* CSS Module */
		for (const cssModule of cssModuleClasses) {
			codeGen.addText(`${cssModule.style.module}: Record<string, string>`);
			for (const classNameRange of cssModule.classNameRanges) {
				writeCssClassProperty(
					cssModule.index,
					cssModule.style.content.substring(classNameRange.start + 1, classNameRange.end),
					classNameRange,
					'string',
					false,
				);
			}
			codeGen.addText(';\n');
		}
		codeGen.addText(`};\n`);

		codeGen.addText(`let __VLS_vmUnwrap!: typeof __VLS_options & { components: { } };\n`);

		/* Components */
		codeGen.addText('/* Components */\n');
		codeGen.addText('let __VLS_otherComponents!: NonNullable<typeof __VLS_component extends { components: infer C } ? C : {}> & __VLS_types.GlobalComponents & typeof __VLS_vmUnwrap.components & __VLS_types.PickComponents<typeof __VLS_ctx>;\n');
		codeGen.addText(`let __VLS_selfComponent!: __VLS_types.SelfComponent<typeof __VLS_name, typeof __VLS_component & (new () => { ${getSlotsPropertyName(compilerOptions.target ?? 3)}: typeof __VLS_slots })>;\n`);
		codeGen.addText('let __VLS_components!: typeof __VLS_otherComponents & Omit<typeof __VLS_selfComponent, keyof typeof __VLS_otherComponents>;\n');

		codeGen.addText(`__VLS_components.${SearchTexts.Components};\n`);
		codeGen.addText(`({} as __VLS_types.GlobalAttrs).${SearchTexts.GlobalAttrs};\n`);

		/* Style Scoped */
		codeGen.addText('/* Style Scoped */\n');
		codeGen.addText('type __VLS_StyleScopedClasses = {}');
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
		codeGen.addText(';\n');
		codeGen.addText('let __VLS_styleScopedClasses!: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

		codeGen.addText(`/* CSS variable injection */\n`);
		const cssIds = writeCssVars();

		if (htmlGen) {
			mergeCodeGen(codeGen, htmlGen.codeGen);
		}

		if (!htmlGen) {
			codeGen.addText(`const __VLS_slots = {};\n`);
		}

		codeGen.addText(`return __VLS_slots;\n`);

		return { cssIds };

		function writeCssClassProperty(styleIndex: number, className: string, classRange: TextRange, propertyType: string, optional: boolean) {
			codeGen.addText(`\n & { `);
			codeGen.addMapping2({
				mappedRange: {
					start: codeGen.getText().length,
					end: codeGen.getText().length + className.length + 2,
				},
				sourceRange: classRange,
				mode: SourceMaps.Mode.Totally,
				additional: [{
					mappedRange: {
						start: codeGen.getText().length + 1, // + '
						end: codeGen.getText().length + 1 + className.length,
					},
					sourceRange: classRange,
					mode: SourceMaps.Mode.Offset,
				}],
				data: {
					vueTag: 'style',
					vueTagIndex: styleIndex,
					capabilities: {
						references: true,
						rename: true,
						referencesCodeLens: true,
					},
					normalizeNewName: beforeCssRename,
					applyNewName: doCssRename,
				},
			});
			codeGen.addText(`'${className}'${optional ? '?' : ''}: ${propertyType}`);
			codeGen.addText(` }`);
		}
		function writeCssVars() {

			const emptyLocalVars: Record<string, number> = {};
			const identifiers = new Set<string>();

			for (const cssVar of cssVars) {
				for (const cssBind of cssVar.ranges) {
					walkInterpolationFragment(
						ts,
						cssVar.style.content.substring(cssBind.start, cssBind.end),
						(frag, fragOffset, isJustForErrorMapping) => {
							if (fragOffset === undefined) {
								codeGen.addText(frag);
							}
							else {
								codeGen.addCode2(
									frag,
									cssBind.start + fragOffset,
									{
										vueTag: 'style',
										vueTagIndex: cssVar.styleIndex,
										capabilities: isJustForErrorMapping ? {
											diagnostic: true,
										} : {
											basic: true,
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
					codeGen.addText(';\n');
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
	function getImplicitWrapComponentOptionsMode(lang: string) {

		let shimComponentOptionsMode: 'defineComponent' | 'Vue.extend' | false = false;

		if (
			compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend === 'onlyJs'
				? lang === 'js' || lang === 'jsx'
				: !!compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend
		) {
			shimComponentOptionsMode = 'Vue.extend';
		}
		if (
			compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent === 'onlyJs'
				? lang === 'js' || lang === 'jsx'
				: !!compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent
		) {
			shimComponentOptionsMode = 'defineComponent';
		}

		// true override 'onlyJs'
		if (compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend === true) {
			shimComponentOptionsMode = 'Vue.extend';
		}
		if (compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent === true) {
			shimComponentOptionsMode = 'defineComponent';
		}

		return shimComponentOptionsMode;
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
