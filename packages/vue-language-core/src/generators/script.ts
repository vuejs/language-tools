import { getLength, Segment } from '@volar/source-map';
import { FileRangeCapabilities, MirrorBehaviorCapabilities } from '@volar/language-core';
import type { TextRange } from '../types';
import * as SourceMaps from '@volar/source-map';
import { hyphenate } from '@vue/shared';
import { posix as path } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as templateGen from '../generators/template';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { collectCssVars, collectStyleCssClasses } from '../plugins/vue-tsx';
import { Sfc } from '../types';
import type { VueCompilerOptions } from '../types';
import { getSlotsPropertyName } from '../utils/shared';
import { walkInterpolationFragment } from '../utils/transform';
import * as sharedTypes from '../utils/directorySharedTypes';
import * as muggle from 'muggle-string';

export function generate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	fileName: string,
	_sfc: Sfc,
	lang: string,
	scriptRanges: ScriptRanges | undefined,
	scriptSetupRanges: ScriptSetupRanges | undefined,
	cssVars: ReturnType<typeof collectCssVars>,
	cssModuleClasses: ReturnType<typeof collectStyleCssClasses>,
	cssScopedClasses: ReturnType<typeof collectStyleCssClasses>,
	htmlGen: ReturnType<typeof templateGen['generate']> | undefined,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	sharedTypesImport: string,
) {

	const codes: Segment<FileRangeCapabilities>[] = [];
	const mirrorBehaviorMappings: SourceMaps.Mapping<[MirrorBehaviorCapabilities, MirrorBehaviorCapabilities]>[] = [];

	//#region monkey fix: https://github.com/johnsoncodehk/volar/pull/2113
	const sfc = {
		script: _sfc.script,
		scriptSetup: _sfc.scriptSetup,
	};
	if (!sfc.script && !sfc.scriptSetup) {
		sfc.scriptSetup = {
			content: '',
			lang: 'ts',
			name: '',
			start: 0,
			end: 0,
			startTagEnd: 0,
			endTagStart: 0,
			generic: undefined,
			genericOffset: 0,
			attrs: {},
		};
		scriptSetupRanges = {
			bindings: [],
			emitsAssignName: undefined,
			emitsRuntimeArg: undefined,
			emitsTypeArg: undefined,
			emitsTypeNums: 0,
			exposeRuntimeArg: undefined,
			importSectionEndOffset: 0,
			defineProps: undefined,
			propsAssignName: undefined,
			propsRuntimeArg: undefined,
			propsTypeArg: undefined,
			slotsTypeArg: undefined,
			withDefaultsArg: undefined,
			defineProp: [],
		};
	}
	//#endregion

	const bypassDefineComponent = lang === 'js' || lang === 'jsx';
	const usedHelperTypes = {
		DefinePropsToOptions: false,
		mergePropDefaults: false,
		ConstructorOverloads: false,
		WithTemplateSlots: false,
		PropsChildren: false,
	};

	codes.push('/* __vue_virtual_code_placeholder__ */\n');

	let generatedTemplate = false;

	generateSrc();
	generateScriptSetupImports();
	generateScriptContentBeforeExportDefault();
	generateScriptSetupAndTemplate();
	generateHelperTypes();
	generateScriptContentAfterExportDefault();

	if (!generatedTemplate) {
		generateTemplate();
	}

	if (sfc.scriptSetup) {
		// for code action edits
		codes.push([
			'',
			'scriptSetup',
			sfc.scriptSetup.content.length,
			{},
		]);
	}

	return {
		codes,
		mirrorBehaviorMappings,
	};

	function generateHelperTypes() {
		let usedPrettify = false;
		if (usedHelperTypes.DefinePropsToOptions) {
			if (compilerOptions.exactOptionalPropertyTypes) {
				codes.push(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueCompilerOptions.lib}').PropType<T[K]> } : { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true } };\n`);
			}
			else {
				codes.push(`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;\n`);
				codes.push(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueCompilerOptions.lib}').PropType<__VLS_NonUndefinedable<T[K]>> } : { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true } };\n`);
			}
		}
		if (usedHelperTypes.mergePropDefaults) {
			codes.push(`type __VLS_WithDefaults<P, D> = {
					// use 'keyof Pick<P, keyof P>' instead of 'keyof P' to keep props jsdoc
					[K in keyof Pick<P, keyof P>]: K extends keyof D ? __VLS_Prettify<P[K] & {
						default: D[K]
					}> : P[K]
				};\n`);
			usedPrettify = true;
		}
		if (usedHelperTypes.ConstructorOverloads) {
			// fix https://github.com/johnsoncodehk/volar/issues/926
			codes.push('type __VLS_UnionToIntersection<U> = __VLS_Prettify<(U extends unknown ? (arg: U) => unknown : never) extends ((arg: infer P) => unknown) ? P : never>;\n');
			usedPrettify = true;
			if (scriptSetupRanges && scriptSetupRanges.emitsTypeNums !== -1) {
				codes.push(sharedTypes.genConstructorOverloads('__VLS_ConstructorOverloads', scriptSetupRanges.emitsTypeNums));
			}
			else {
				codes.push(sharedTypes.genConstructorOverloads('__VLS_ConstructorOverloads'));
			}
		}
		if (usedHelperTypes.WithTemplateSlots) {
			codes.push(
				`type __VLS_WithTemplateSlots<T, S> = T & { new(): {\n`,
				`$slots: S;\n`,
			);
			if (vueCompilerOptions.jsxSlots) {
				usedHelperTypes.PropsChildren = true;
				codes.push(`$props: __VLS_PropsChildren<S>;\n`);
			}
			codes.push(
				`} };\n`,
			);
		}
		if (usedHelperTypes.PropsChildren) {
			codes.push(`type __VLS_PropsChildren<S> = { [K in keyof (boolean extends (JSX.ElementChildrenAttribute extends never ? true : false) ? never : JSX.ElementChildrenAttribute)]?: S; };\n`);
		}
		if (usedPrettify) {
			codes.push(`type __VLS_Prettify<T> = { [K in keyof T]: T[K]; } & {};\n`);
		}
	}
	function generateSrc() {
		if (!sfc.script?.src)
			return;

		let src = sfc.script.src;

		if (src.endsWith('.d.ts')) src = src.substring(0, src.length - '.d.ts'.length);
		else if (src.endsWith('.ts')) src = src.substring(0, src.length - '.ts'.length);
		else if (src.endsWith('.tsx')) src = src.substring(0, src.length - '.tsx'.length) + '.jsx';

		if (!src.endsWith('.js') && !src.endsWith('.jsx')) src = src + '.js';

		codes.push(`export * from `);
		codes.push([
			`'${src}'`,
			'script',
			[sfc.script.srcOffset - 1, sfc.script.srcOffset + sfc.script.src.length + 1],
			{
				...FileRangeCapabilities.full,
				rename: src === sfc.script.src ? true : {
					normalize: undefined,
					apply(newName) {
						if (
							newName.endsWith('.jsx')
							|| newName.endsWith('.js')
						) {
							newName = newName.split('.').slice(0, -1).join('.');
						}
						if (sfc.script?.src?.endsWith('.d.ts')) {
							newName = newName + '.d.ts';
						}
						else if (sfc.script?.src?.endsWith('.ts')) {
							newName = newName + '.ts';
						}
						else if (sfc.script?.src?.endsWith('.tsx')) {
							newName = newName + '.tsx';
						}
						return newName;
					},
				},
			},
		]);
		codes.push(`;\n`);
		codes.push(`export { default } from '${src}';\n`);
	}
	function generateScriptContentBeforeExportDefault() {
		if (!sfc.script)
			return;

		if (!!sfc.scriptSetup && scriptRanges?.exportDefault) {
			addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
		}
		else {
			let isExportRawObject = false;
			if (scriptRanges?.exportDefault) {
				isExportRawObject = sfc.script.content.substring(scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end).startsWith('{');
			}
			if (isExportRawObject && vueCompilerOptions.optionsWrapper.length === 2 && scriptRanges?.exportDefault) {
				addVirtualCode('script', 0, scriptRanges.exportDefault.expression.start);
				codes.push(vueCompilerOptions.optionsWrapper[0]);
				{
					codes.push(['', 'script', scriptRanges.exportDefault.expression.start, {
						__hint: {
							setting: 'vue.inlayHints.optionsWrapper',
							label: vueCompilerOptions.optionsWrapper[0],
							tooltip: [
								'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
								'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
							].join('\n\n'),
						}
					} as any]);
					addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end);
					codes.push(['', 'script', scriptRanges.exportDefault.expression.end, {
						__hint: {
							setting: 'vue.inlayHints.optionsWrapper',
							label: vueCompilerOptions.optionsWrapper[1],
							tooltip: '',
						}
					} as any]);
				}
				codes.push(vueCompilerOptions.optionsWrapper[1]);
				addVirtualCode('script', scriptRanges.exportDefault.expression.end, sfc.script.content.length);
			}
			else {
				addVirtualCode('script', 0, sfc.script.content.length);
			}
		}
	}
	function generateScriptContentAfterExportDefault() {
		if (!sfc.script)
			return;

		if (!!sfc.scriptSetup && scriptRanges?.exportDefault) {
			addVirtualCode('script', scriptRanges.exportDefault.end, sfc.script.content.length);
		}
	}
	function generateScriptSetupImports() {

		if (!sfc.scriptSetup)
			return;

		if (!scriptSetupRanges)
			return;

		codes.push([
			sfc.scriptSetup.content.substring(0, scriptSetupRanges.importSectionEndOffset),
			'scriptSetup',
			0,
			FileRangeCapabilities.full,
		]);
	}
	function generateExportDefaultEndMapping() {
		if (!sfc.scriptSetup) {
			return;
		}
		// fix https://github.com/johnsoncodehk/volar/issues/1127
		codes.push([
			'',
			'scriptSetup',
			sfc.scriptSetup.content.length,
			{ diagnostic: true },
		]);
		codes.push(`\n`);
	}
	function generateScriptSetupAndTemplate() {

		if (!sfc.scriptSetup || !scriptSetupRanges) {
			return;
		}

		const definePropMirrors: Record<string, [number, number]> = {};
		let scriptSetupGeneratedOffset: number | undefined;

		if (sfc.scriptSetup.generic) {
			if (!scriptRanges?.exportDefault) {
				codes.push('export default ');
			}
			codes.push(`(<`);
			codes.push([
				sfc.scriptSetup.generic,
				sfc.scriptSetup.name,
				sfc.scriptSetup.genericOffset,
				FileRangeCapabilities.full,
			]);
			if (!sfc.scriptSetup.generic.endsWith(',')) {
				codes.push(`,`);
			}
			codes.push(`>`);
			codes.push('(\n');
			codes.push(
				`__VLS_props: typeof __VLS_setup['props']`,
				`& import('${vueCompilerOptions.lib}').VNodeProps`,
				`& import('${vueCompilerOptions.lib}').AllowedComponentProps`,
				`& import('${vueCompilerOptions.lib}').ComponentCustomProps,\n`,
			);
			codes.push(`__VLS_ctx?: Pick<typeof __VLS_setup, 'attrs' | 'emit' | 'slots'>,\n`);
			codes.push('__VLS_setup = (() => {\n');
			scriptSetupGeneratedOffset = generateSetupFunction(true, 'none', definePropMirrors);

			//#region exposed
			codes.push(`const __VLS_exposed = `);
			if (scriptSetupRanges.exposeRuntimeArg) {
				addVirtualCode('scriptSetup', scriptSetupRanges.exposeRuntimeArg.start, scriptSetupRanges.exposeRuntimeArg.end);
			}
			else {
				codes.push(`{}`);
			}
			codes.push(';\n');
			//#endregion

			//#region props
			if (
				scriptSetupRanges.propsRuntimeArg
				|| scriptSetupRanges.defineProp.length
			) {
				if (scriptSetupRanges.propsRuntimeArg) {
					codes.push(`const __VLS_props = (new __VLS_publicComponent()).$props;\n`);
				}
				else if (scriptSetupRanges.defineProp.length) {
					codes.push(`const __VLS_defaults = {\n`);
					for (const defineProp of scriptSetupRanges.defineProp) {
						if (defineProp.defaultValue) {
							if (defineProp.name) {
								codes.push(sfc.scriptSetup.content.substring(defineProp.name.start, defineProp.name.end));
							}
							else {
								codes.push('modelValue');
							}
							codes.push(`: `);
							codes.push(sfc.scriptSetup.content.substring(defineProp.defaultValue.start, defineProp.defaultValue.end));
							codes.push(`,\n`);
						}
					}
					codes.push(`};\n`);
					codes.push(`let __VLS_props!: {\n`);
					for (const defineProp of scriptSetupRanges.defineProp) {
						let propName = 'modelValue';
						if (defineProp.name) {
							propName = sfc.scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
							const propMirrorStart = muggle.getLength(codes);
							definePropMirrors[propName] = [propMirrorStart, propMirrorStart + propName.length];
						}
						codes.push(`${propName}${defineProp.required ? '' : '?'}: `);
						if (defineProp.type) {
							codes.push(sfc.scriptSetup.content.substring(defineProp.type.start, defineProp.type.end));
						}
						else if (defineProp.defaultValue) {
							codes.push(`typeof __VLS_defaults['`);
							codes.push(propName);
							codes.push(`']`);
						}
						else {
							codes.push(`any`);
						}
						codes.push(',\n');
					}
					codes.push(`};\n`);
				}
				if (scriptSetupRanges.slotsTypeArg && vueCompilerOptions.jsxSlots) {
					usedHelperTypes.PropsChildren = true;
					codes.push(` & __VLS_PropsChildren<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.slotsTypeArg.start, scriptSetupRanges.slotsTypeArg.end);
					codes.push(`>`);
				}
				codes.push(`;\n`);
			}
			else {
				codes.push(`const __VLS_props: {}`);
				if (scriptSetupRanges.slotsTypeArg && vueCompilerOptions.jsxSlots) {
					usedHelperTypes.PropsChildren = true;
					codes.push(` & __VLS_PropsChildren<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.slotsTypeArg.start, scriptSetupRanges.slotsTypeArg.end);
					codes.push(`>`);
				}
				if (scriptSetupRanges.propsTypeArg) {
					codes.push(' & ');
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
				}
				codes.push(`;\n`);
			}
			//#endregion

			//#region emits
			codes.push(`const __VLS_emit = `);
			if (scriptSetupRanges.emitsTypeArg) {
				codes.push('{} as ');
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
				codes.push(';\n');
			}
			else if (scriptSetupRanges.emitsRuntimeArg) {
				codes.push(`defineEmits(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
				codes.push(');\n');
			}
			else {
				codes.push('{} as any;\n');
			}
			//#endregion

			codes.push('return {} as {\n');
			codes.push(`props: typeof __VLS_props,\n`);
			codes.push('expose(exposed: typeof __VLS_exposed): void,\n');
			codes.push('attrs: any,\n');
			codes.push('slots: ReturnType<typeof __VLS_template>,\n');
			codes.push('emit: typeof __VLS_emit');
			codes.push('};\n');
			codes.push('})(),\n');
			codes.push(`) => ({} as import('${vueCompilerOptions.lib}').VNode & { __ctx?: typeof __VLS_setup }))`);
		}
		else if (!sfc.script) {
			// no script block, generate script setup code at root
			scriptSetupGeneratedOffset = generateSetupFunction(false, 'export', definePropMirrors);
		}
		else {
			if (!scriptRanges?.exportDefault) {
				codes.push('export default ');
			}
			codes.push('await (async () => {\n');
			scriptSetupGeneratedOffset = generateSetupFunction(false, 'return', definePropMirrors);
			codes.push(`})()`);
		}

		generateExportDefaultEndMapping();

		if (scriptSetupGeneratedOffset !== undefined) {
			for (const defineProp of scriptSetupRanges.defineProp) {
				if (!defineProp.name) {
					continue;
				}
				const propName = sfc.scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
				const propMirror = definePropMirrors[propName];
				if (propMirror) {
					mirrorBehaviorMappings.push({
						sourceRange: [defineProp.name.start + scriptSetupGeneratedOffset, defineProp.name.end + scriptSetupGeneratedOffset],
						generatedRange: propMirror,
						data: [
							MirrorBehaviorCapabilities.full,
							MirrorBehaviorCapabilities.full,
						],
					});
				}
			}
		}
	}
	function generateSetupFunction(functional: boolean, mode: 'return' | 'export' | 'none', definePropMirrors: Record<string, [number, number]>) {

		if (!scriptSetupRanges || !sfc.scriptSetup) {
			return;
		}

		const definePropProposalA = sfc.scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=kevinEdition') || vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition';
		const definePropProposalB = sfc.scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=johnsonEdition') || vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition';

		if (vueCompilerOptions.target >= 3.3) {
			codes.push(`const { defineProps, defineEmits, defineExpose, defineOptions, defineSlots, defineModel, withDefaults } = await import('${vueCompilerOptions.lib}');\n`);
		}
		if (definePropProposalA) {
			codes.push(`
declare function defineProp<T>(name: string, options: { required: true } & Record<string, unknown>): import('${vueCompilerOptions.lib}').ComputedRef<T>;
declare function defineProp<T>(name: string, options: { default: any } & Record<string, unknown>): import('${vueCompilerOptions.lib}').ComputedRef<T>;
declare function defineProp<T>(name?: string, options?: any): import('${vueCompilerOptions.lib}').ComputedRef<T | undefined>;
`.trim() + '\n');
		}
		if (definePropProposalB) {
			codes.push(`
declare function defineProp<T>(value: T | (() => T), required?: boolean, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T>;
declare function defineProp<T>(value: T | (() => T) | undefined, required: true, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T>;
declare function defineProp<T>(value?: T | (() => T), required?: boolean, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T | undefined>;
`.trim() + '\n');
		}

		const scriptSetupGeneratedOffset = muggle.getLength(codes) - scriptSetupRanges.importSectionEndOffset;

		addVirtualCode('scriptSetup', scriptSetupRanges.importSectionEndOffset);

		if (scriptSetupRanges.propsTypeArg && scriptSetupRanges.withDefaultsArg) {
			// fix https://github.com/johnsoncodehk/volar/issues/1187
			codes.push(`const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`);
			addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
			codes.push(`);\n`);
		}

		if (scriptRanges?.exportDefault && scriptRanges.exportDefault.expression.start !== scriptRanges.exportDefault.args.start) {
			// use defineComponent() from user space code if it exist
			codes.push(`const __VLS_publicComponent = `);
			addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.args.start);
			codes.push(`{\n`);
		}
		else {
			codes.push(`const __VLS_publicComponent = (await import('${vueCompilerOptions.lib}')).defineComponent({\n`);
		}

		if (scriptSetupRanges.defineProp.length) {
			codes.push(`props: {} as {\n`);
			for (const defineProp of scriptSetupRanges.defineProp) {

				let propName = 'modelValue';

				if (defineProp.name && defineProp.nameIsString) {
					// renaming support
					addExtraReferenceVirtualCode('scriptSetup', defineProp.name.start, defineProp.name.end);
				}
				else if (defineProp.name) {
					propName = sfc.scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
					const start = muggle.getLength(codes);
					definePropMirrors[propName] = [start, start + propName.length];
					codes.push(propName);
				}
				else {
					codes.push(propName);
				}
				codes.push(`: `);

				let type = 'any';
				if (!defineProp.nameIsString) {
					type = `NonNullable<typeof ${propName}['value']>`;
				}
				else if (defineProp.type) {
					type = sfc.scriptSetup.content.substring(defineProp.type.start, defineProp.type.end);
				}

				if (defineProp.required) {
					codes.push(`{ required: true, type: import('${vueCompilerOptions.lib}').PropType<${type}> },\n`);
				}
				else {
					codes.push(`import('${vueCompilerOptions.lib}').PropType<${type}>,\n`);
				}
			}
			codes.push(`},\n`);
		}

		if (!bypassDefineComponent) {
			if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg) {
				codes.push(`props: (`);
				if (scriptSetupRanges.propsTypeArg) {

					usedHelperTypes.DefinePropsToOptions = true;
					codes.push(`{} as `);

					if (scriptSetupRanges.withDefaultsArg) {
						usedHelperTypes.mergePropDefaults = true;
						codes.push(`__VLS_WithDefaults<`);
					}

					codes.push(`__VLS_TypePropsToRuntimeProps<`);
					if (functional) {
						codes.push(`typeof __VLS_props`);
					}
					else {
						addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					}
					codes.push(`>`);

					if (scriptSetupRanges.withDefaultsArg) {
						codes.push(`, typeof __VLS_withDefaultsArg`);
						codes.push(`>`);
					}
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
				}
				codes.push(`),\n`);
			}
			if (scriptSetupRanges.emitsTypeArg) {
				usedHelperTypes.ConstructorOverloads = true;
				codes.push(`emits: ({} as __VLS_UnionToIntersection<__VLS_ConstructorOverloads<`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
				codes.push(`>>),\n`);
			}
			else if (scriptSetupRanges.emitsRuntimeArg) {
				codes.push(`emits: (`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
				codes.push(`),\n`);
			}
		}

		codes.push(`setup() {\n`);
		codes.push(`return {\n`);

		if (bypassDefineComponent) {
			// fill $props
			if (scriptSetupRanges.propsTypeArg) {
				// NOTE: defineProps is inaccurate for $props
				codes.push(`$props: (await import('${sharedTypesImport}')).makeOptional(defineProps<`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
				codes.push(`>()),\n`);
			}
			else if (scriptSetupRanges.propsRuntimeArg) {
				// NOTE: defineProps is inaccurate for $props
				codes.push(`$props: (await import('${sharedTypesImport}')).makeOptional(defineProps(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
				codes.push(`)),\n`);
			}
			// fill $emit
			if (scriptSetupRanges.emitsAssignName) {
				codes.push(`$emit: ${scriptSetupRanges.emitsAssignName},\n`);
			}
			else if (scriptSetupRanges.emitsTypeArg) {
				codes.push(`$emit: defineEmits<`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end);
				codes.push(`>(),\n`);
			}
			else if (scriptSetupRanges.emitsRuntimeArg) {
				codes.push(`$emit: defineEmits(`);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end);
				codes.push(`),\n`);
			}
		}

		if (scriptSetupRanges.exposeRuntimeArg) {
			codes.push(`...(`);
			addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeRuntimeArg.start, scriptSetupRanges.exposeRuntimeArg.end);
			codes.push(`),\n`);
		}

		codes.push(`};\n`);
		codes.push(`},\n`);

		if (scriptRanges?.exportDefault?.args) {
			addVirtualCode('script', scriptRanges.exportDefault.args.start + 1, scriptRanges.exportDefault.args.end - 1);
		}

		codes.push(`});\n`);

		generateTemplate();

		if (mode === 'return') {
			codes.push(`return `);
		}
		else if (mode === 'export') {
			codes.push('export default ');
		}
		if (mode === 'return' || mode === 'export') {
			if (!vueCompilerOptions.skipTemplateCodegen && (htmlGen?.hasSlot || scriptSetupRanges?.slotsTypeArg)) {
				usedHelperTypes.WithTemplateSlots = true;
				codes.push(`{} as __VLS_WithTemplateSlots<typeof __VLS_publicComponent, ReturnType<typeof __VLS_template>>;`);
			}
			else {
				codes.push(`{} as typeof __VLS_publicComponent;`);
			}
		}
		if (mode === 'export') {
			generateExportDefaultEndMapping();
		}

		return scriptSetupGeneratedOffset;
	}
	function generateTemplate() {

		generatedTemplate = true;

		if (!vueCompilerOptions.skipTemplateCodegen) {

			generateExportOptions();
			generateConstNameOption();

			if (scriptSetupRanges?.slotsTypeArg && sfc.scriptSetup) {
				codes.push(`var __VLS_slots!: `);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.slotsTypeArg.start, scriptSetupRanges.slotsTypeArg.end);
				codes.push(';\n');
			};

			codes.push(`function __VLS_template() {\n`);

			const templateGened = generateTemplateContext();

			codes.push(`}\n`);

			generateComponentForTemplateUsage(templateGened.cssIds);
		}
		else {
			codes.push(`function __VLS_template() {\n`);
			const templateUsageVars = [...getTemplateUsageVars()];
			codes.push(`// @ts-ignore\n`);
			codes.push(`[${templateUsageVars.join(', ')}]\n`);
			codes.push(`return {};\n`);
			codes.push(`}\n`);
		}
	}
	function generateComponentForTemplateUsage(cssIds: Set<string>) {

		if (sfc.scriptSetup && scriptSetupRanges) {

			codes.push(`const __VLS_internalComponent = (await import('${vueCompilerOptions.lib}')).defineComponent({\n`);
			codes.push(`setup() {\n`);
			codes.push(`return {\n`);
			// fill ctx from props
			if (bypassDefineComponent) {
				if (scriptSetupRanges.propsAssignName) {
					codes.push(`...${scriptSetupRanges.propsAssignName},\n`);
				}
				else if (scriptSetupRanges.withDefaultsArg && scriptSetupRanges.propsTypeArg) {
					codes.push(`...withDefaults(defineProps<`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					codes.push(`>(), `);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
					codes.push(`),\n`);
				}
				else if (scriptSetupRanges.propsRuntimeArg) {
					codes.push(`...defineProps(`);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					codes.push(`),\n`);
				}
			}
			// bindings
			const templateUsageVars = getTemplateUsageVars();
			for (const [content, bindings] of [
				[sfc.scriptSetup.content, scriptSetupRanges.bindings] as const,
				scriptRanges && sfc.script
					? [sfc.script.content, scriptRanges.bindings] as const
					: ['', []] as const,
			]) {
				for (const expose of bindings) {
					const varName = content.substring(expose.start, expose.end);
					if (!templateUsageVars.has(varName) && !cssIds.has(varName)) {
						continue;
					}
					const templateStart = getLength(codes);
					codes.push(varName);
					const templateEnd = getLength(codes);
					codes.push(`: `);

					const scriptStart = getLength(codes);
					codes.push(varName);
					const scriptEnd = getLength(codes);
					codes.push(',\n');

					mirrorBehaviorMappings.push({
						sourceRange: [scriptStart, scriptEnd],
						generatedRange: [templateStart, templateEnd],
						data: [
							MirrorBehaviorCapabilities.full,
							MirrorBehaviorCapabilities.full,
						],
					});
				}
			}
			codes.push(`};\n`); // return {
			codes.push(`},\n`); // setup() {
			codes.push(`});\n`); // defineComponent({
		}
		else if (sfc.script) {
			codes.push(`let __VLS_internalComponent!: typeof import('./${path.basename(fileName)}')['default'];\n`);
		}
		else {
			codes.push(`const __VLS_internalComponent = (await import('${vueCompilerOptions.lib}')).defineComponent({});\n`);
		}
	}
	function generateExportOptions() {
		codes.push(`\n`);
		codes.push(`const __VLS_componentsOption = `);
		if (sfc.script && scriptRanges?.exportDefault?.componentsOption) {
			const componentsOption = scriptRanges.exportDefault.componentsOption;
			codes.push([
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
			codes.push('{}');
		}
		codes.push(`;\n`);
	}
	function generateConstNameOption() {
		codes.push(`\n`);
		if (sfc.script && scriptRanges?.exportDefault?.nameOption) {
			const nameOption = scriptRanges.exportDefault.nameOption;
			codes.push(`const __VLS_name = `);
			codes.push(`${sfc.script.content.substring(nameOption.start, nameOption.end)} as const`);
			codes.push(`;\n`);
		}
		else if (sfc.scriptSetup) {
			codes.push(`let __VLS_name!: '${path.basename(fileName.substring(0, fileName.lastIndexOf('.')))}';\n`);
		}
		else {
			codes.push(`const __VLS_name = undefined;\n`);
		}
	}
	function generateTemplateContext() {

		const useGlobalThisTypeInCtx = fileName.endsWith('.html');

		codes.push(`let __VLS_ctx!: ${useGlobalThisTypeInCtx ? 'typeof globalThis &' : ''}`);
		if (sfc.scriptSetup) {
			codes.push(`InstanceType<import('${sharedTypesImport}').PickNotAny<typeof __VLS_publicComponent, new () => {}>> & `);
		}
		codes.push(`InstanceType<import('${sharedTypesImport}').PickNotAny<typeof __VLS_internalComponent, new () => {}>> & {\n`);

		/* CSS Module */
		for (const cssModule of cssModuleClasses) {
			codes.push(`${cssModule.style.module}: Record<string, string> & import('${sharedTypesImport}').Prettify<{}`);
			for (const classNameRange of cssModule.classNameRanges) {
				generateCssClassProperty(
					cssModule.index,
					cssModule.style.content.substring(classNameRange.start + 1, classNameRange.end),
					classNameRange,
					'string',
					false,
				);
			}
			codes.push('>;\n');
		}
		codes.push(`};\n`);

		/* Components */
		codes.push('/* Components */\n');
		codes.push(`let __VLS_localComponents!: NonNullable<typeof __VLS_internalComponent extends { components: infer C } ? C : {}> & typeof __VLS_componentsOption & typeof __VLS_ctx;\n`);
		codes.push(`let __VLS_otherComponents!: typeof __VLS_localComponents & import('${sharedTypesImport}').GlobalComponents;\n`);
		codes.push(`let __VLS_own!: import('${sharedTypesImport}').SelfComponent<typeof __VLS_name, typeof __VLS_internalComponent & typeof __VLS_publicComponent & (new () => { ${getSlotsPropertyName(vueCompilerOptions.target)}: typeof __VLS_slots })>;\n`);
		codes.push(`let __VLS_components!: typeof __VLS_otherComponents & Omit<typeof __VLS_own, keyof typeof __VLS_otherComponents>;\n`);

		/* Style Scoped */
		codes.push('/* Style Scoped */\n');
		codes.push('type __VLS_StyleScopedClasses = {}');
		for (const scopedCss of cssScopedClasses) {
			for (const classNameRange of scopedCss.classNameRanges) {
				generateCssClassProperty(
					scopedCss.index,
					scopedCss.style.content.substring(classNameRange.start + 1, classNameRange.end),
					classNameRange,
					'boolean',
					true,
				);
			}
		}
		codes.push(';\n');
		codes.push('let __VLS_styleScopedClasses!: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

		codes.push(`/* CSS variable injection */\n`);
		const cssIds = generateCssVars();
		codes.push(`/* CSS variable injection end */\n`);

		if (htmlGen) {
			for (const s of htmlGen.codes) {
				codes.push(s);
			}
		}

		if (!htmlGen) {
			codes.push(`// no template\n`);
			if (scriptSetupRanges?.slotsTypeArg && sfc.scriptSetup) {
				codes.push(`let __VLS_slots!: `);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.slotsTypeArg.start, scriptSetupRanges.slotsTypeArg.end);
				codes.push(`;\n`);
			}
			else {
				codes.push(`const __VLS_slots = {};\n`);
			}
		}

		codes.push(`return __VLS_slots;\n`);

		return { cssIds };

		function generateCssClassProperty(styleIndex: number, className: string, classRange: TextRange, propertyType: string, optional: boolean) {
			codes.push(`\n & { `);
			codes.push([
				'',
				'style_' + styleIndex,
				classRange.start,
				{
					references: true,
					referencesCodeLens: true,
				},
			]);
			codes.push(`'`);
			codes.push([
				className,
				'style_' + styleIndex,
				[classRange.start, classRange.end],
				{
					references: true,
					rename: {
						normalize: normalizeCssRename,
						apply: applyCssRename,
					},
				},
			]);
			codes.push(`'`);
			codes.push([
				'',
				'style_' + styleIndex,
				classRange.end,
				{},
			]);
			codes.push(`${optional ? '?' : ''}: ${propertyType}`);
			codes.push(` }`);
		}
		function generateCssVars() {

			const emptyLocalVars: Record<string, number> = {};
			const identifiers = new Set<string>();

			for (const cssVar of cssVars) {
				for (const cssBind of cssVar.ranges) {
					const code = cssVar.style.content.substring(cssBind.start, cssBind.end);
					walkInterpolationFragment(
						ts,
						code,
						ts.createSourceFile('/a.txt', code, ts.ScriptTarget.ESNext),
						(frag, fragOffset, onlyForErrorMapping) => {
							if (fragOffset === undefined) {
								codes.push(frag);
							}
							else {
								codes.push([
									frag,
									cssVar.style.name,
									cssBind.start + fragOffset,
									onlyForErrorMapping
										? { diagnostic: true }
										: FileRangeCapabilities.full,
								]);
							}
						},
						emptyLocalVars,
						identifiers,
						vueCompilerOptions,
					);
					codes.push(';\n');
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
					usageVars.add(tag.split('.')[0]);
				}
			}
			for (const _id of htmlGen.identifiers) {
				usageVars.add(_id);
			}
		}

		return usageVars;
	}
	function addVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end?: number) {
		codes.push([
			sfc[vueTag]!.content.substring(start, end),
			vueTag,
			start,
			FileRangeCapabilities.full, // diagnostic also working for setup() returns unused in template checking
		]);
	}
	function addExtraReferenceVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
		codes.push([
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
}

function normalizeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.slice(1) : newName;
}

function applyCssRename(newName: string) {
	return '.' + newName;
}
