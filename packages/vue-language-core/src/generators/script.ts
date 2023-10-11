import { FileRangeCapabilities, MirrorBehaviorCapabilities } from '@volar/language-core';
import * as SourceMaps from '@volar/source-map';
import { Segment, getLength } from '@volar/source-map';
import * as muggle from 'muggle-string';
import { posix as path } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as templateGen from '../generators/template';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import type { TextRange, VueCompilerOptions } from '../types';
import { Sfc } from '../types';
import { getSlotsPropertyName, hyphenateTag } from '../utils/shared';
import { walkInterpolationFragment } from '../utils/transform';

export function generate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	fileName: string,
	_sfc: Sfc,
	lang: string,
	scriptRanges: ScriptRanges | undefined,
	scriptSetupRanges: ScriptSetupRanges | undefined,
	htmlGen: ReturnType<typeof templateGen['generate']> | undefined,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	codegenStack: boolean,
) {

	const [codes, codeStacks] = codegenStack ? muggle.track([] as Segment<FileRangeCapabilities>[]) : [[], []];
	const mirrorBehaviorMappings: SourceMaps.Mapping<[MirrorBehaviorCapabilities, MirrorBehaviorCapabilities]>[] = [];

	//#region monkey fix: https://github.com/vuejs/language-tools/pull/2113
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
			exposeRuntimeArg: undefined,
			exposeTypeArg: undefined,
			leadingCommentEndOffset: 0,
			importSectionEndOffset: 0,
			withDefaults: undefined,
			defineProps: undefined,
			defineSlots: undefined,
			defineEmits: undefined,
			defineExpose: undefined,
			slotsAssignName: undefined,
			propsAssignName: undefined,
			propsRuntimeArg: undefined,
			propsTypeArg: undefined,
			withDefaultsArg: undefined,
			defineProp: [],
		};
	}
	//#endregion

	const bindingNames = new Set([
		...scriptRanges?.bindings.map(range => sfc.script!.content.substring(range.start, range.end)) ?? [],
		...scriptSetupRanges?.bindings.map(range => sfc.scriptSetup!.content.substring(range.start, range.end)) ?? [],
	]);
	const bypassDefineComponent = lang === 'js' || lang === 'jsx';
	const usedHelperTypes = {
		DefinePropsToOptions: false,
		MergePropDefaults: false,
		WithTemplateSlots: false,
		PropsChildren: false,
	};

	codes.push(`/* __placeholder__ */\n`);

	let generatedTemplate = false;

	generateSrc();
	generateScriptSetupImports();
	generateScriptContentBeforeExportDefault();
	generateScriptSetupAndTemplate();
	generateHelperTypes();
	generateScriptContentAfterExportDefault();

	if (!generatedTemplate) {
		generateTemplate(false);
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
		codeStacks,
		mirrorBehaviorMappings,
	};

	function generateHelperTypes() {
		if (usedHelperTypes.DefinePropsToOptions) {
			if (compilerOptions.exactOptionalPropertyTypes) {
				codes.push(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueCompilerOptions.lib}').PropType<T[K]> } : { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true } };\n`);
			}
			else {
				codes.push(`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;\n`);
				codes.push(`type __VLS_TypePropsToRuntimeProps<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueCompilerOptions.lib}').PropType<__VLS_NonUndefinedable<T[K]>> } : { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true } };\n`);
			}
		}
		if (usedHelperTypes.MergePropDefaults) {
			codes.push(`type __VLS_WithDefaults<P, D> = {
					// use 'keyof Pick<P, keyof P>' instead of 'keyof P' to keep props jsdoc
					[K in keyof Pick<P, keyof P>]: K extends keyof D ? __VLS_Prettify<P[K] & {
						default: D[K]
					}> : P[K]
				};\n`);
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
			sfc.scriptSetup.content.substring(0, Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset)) + '\n',
			'scriptSetup',
			0,
			FileRangeCapabilities.full,
		]);
	}
	function generateExportDefaultEndMapping() {
		if (!sfc.scriptSetup) {
			return;
		}
		// fix https://github.com/vuejs/language-tools/issues/1127
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
			codes.push(`__VLS_props: Awaited<typeof __VLS_setup>['props'],\n`);
			codes.push(`__VLS_ctx?: __VLS_Prettify<Pick<Awaited<typeof __VLS_setup>, 'attrs' | 'emit' | 'slots'>>,\n`); // use __VLS_Prettify for less dts code
			codes.push(`__VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>['expose'],\n`);
			codes.push('__VLS_setup = (async () => {\n');
			scriptSetupGeneratedOffset = generateSetupFunction(true, 'none', definePropMirrors);

			//#region props
			codes.push(`const __VLS_fnComponent = `);
			codes.push(`(await import('${vueCompilerOptions.lib}')).defineComponent({\n`);
			if (scriptSetupRanges.propsRuntimeArg) {
				codes.push(`props: `);
				addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
				codes.push(`,\n`);

			}
			if (scriptSetupRanges.defineEmits) {
				codes.push(
					`emits: ({} as __VLS_NormalizeEmits<typeof `,
					scriptSetupRanges.emitsAssignName ?? '__VLS_emit',
					`>),\n`,
				);
			}
			codes.push(`});\n`);
			if (scriptSetupRanges.defineProp.length) {
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
			}
			codes.push(`let __VLS_fnPropsTypeOnly!: {}`); // TODO: reuse __VLS_fnPropsTypeOnly even without generic, and remove __VLS_propsOption_defineProp
			if (scriptSetupRanges.propsTypeArg) {
				codes.push(` & `);
				addVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
			}
			if (scriptSetupRanges.defineProp.length) {
				codes.push(` & {\n`);
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
				codes.push(`}`);
			}
			codes.push(`;\n`);
			codes.push(`let __VLS_fnPropsDefineComponent!: InstanceType<typeof __VLS_fnComponent>['$props']`);
			codes.push(`;\n`);
			codes.push(`let __VLS_fnPropsSlots!: `);
			if (scriptSetupRanges.defineSlots && vueCompilerOptions.jsxSlots) {
				usedHelperTypes.PropsChildren = true;
				codes.push(`__VLS_PropsChildren<typeof __VLS_slots>`);
			}
			else {
				codes.push(`{}`);
			}
			codes.push(`;\n`);
			codes.push(
				`let __VLS_defaultProps!: `,
				`import('${vueCompilerOptions.lib}').VNodeProps`,
				`& import('${vueCompilerOptions.lib}').AllowedComponentProps`,
				`& import('${vueCompilerOptions.lib}').ComponentCustomProps`,
				`;\n`,
			);
			//#endregion

			codes.push('return {} as {\n');
			codes.push(`props: __VLS_Prettify<Omit<typeof __VLS_fnPropsDefineComponent & typeof __VLS_fnPropsTypeOnly, keyof typeof __VLS_defaultProps>> & typeof __VLS_fnPropsSlots & typeof __VLS_defaultProps,\n`);
			codes.push(`expose(exposed: import('${vueCompilerOptions.lib}').ShallowUnwrapRef<${scriptSetupRanges.defineExpose ? 'typeof __VLS_exposed' : '{}'}>): void,\n`);
			codes.push('attrs: any,\n');
			codes.push('slots: ReturnType<typeof __VLS_template>,\n');
			codes.push(`emit: typeof ${scriptSetupRanges.emitsAssignName ?? '__VLS_emit'},\n`);
			codes.push('};\n');
			codes.push('})(),\n');
			codes.push(`) => ({} as import('${vueCompilerOptions.lib}').VNode & { __ctx?: Awaited<typeof __VLS_setup> }))`);
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
			codes.push('const { ');
			for (const macro of Object.keys(vueCompilerOptions.macros)) {
				if (!bindingNames.has(macro)) {
					codes.push(macro, ', ');
				}
			}
			codes.push(`} = await import('${vueCompilerOptions.lib}');\n`);
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

		let setupCodeModifies: [() => void, number, number][] = [];
		if (scriptSetupRanges.defineProps && !scriptSetupRanges.propsAssignName) {
			const ranges = scriptSetupRanges.withDefaults ?? scriptSetupRanges.defineProps;
			codes.push(`const __VLS_props = `);
			addVirtualCode('scriptSetup', ranges.start, ranges.end);
			codes.push(`;\n`);
			setupCodeModifies.push([() => codes.push(`__VLS_props`), ranges.start, ranges.end]);
		}
		if (scriptSetupRanges.defineSlots && !scriptSetupRanges.slotsAssignName) {
			setupCodeModifies.push([() => codes.push(`const __VLS_slots = `), scriptSetupRanges.defineSlots.start, scriptSetupRanges.defineSlots.start]);
		}
		if (scriptSetupRanges.defineEmits && !scriptSetupRanges.emitsAssignName) {
			setupCodeModifies.push([() => codes.push(`const __VLS_emit = `), scriptSetupRanges.defineEmits.start, scriptSetupRanges.defineEmits.start]);
		}
		if (scriptSetupRanges.defineExpose) {
			setupCodeModifies.push([() => {
				if (scriptSetupRanges?.exposeTypeArg) {
					codes.push(`let __VLS_exposed!: `);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeTypeArg.start, scriptSetupRanges.exposeTypeArg.end);
					codes.push(`;\n`);
				}
				else if (scriptSetupRanges?.exposeRuntimeArg) {
					codes.push(`const __VLS_exposed = `);
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.exposeRuntimeArg.start, scriptSetupRanges.exposeRuntimeArg.end);
					codes.push(`;\n`);
				}
				else {
					codes.push(`const __VLS_exposed = {};\n`);
				}
			}, scriptSetupRanges.defineExpose.start, scriptSetupRanges.defineExpose.start]);
		}
		setupCodeModifies = setupCodeModifies.sort((a, b) => a[1] - b[1]);

		if (setupCodeModifies.length) {
			addVirtualCode('scriptSetup', scriptSetupRanges.importSectionEndOffset, setupCodeModifies[0][1]);
			while (setupCodeModifies.length) {
				const [generate, _, end] = setupCodeModifies.shift()!;
				generate();
				if (setupCodeModifies.length) {
					const nextStart = setupCodeModifies[0][1];
					addVirtualCode('scriptSetup', end, nextStart);
				}
				else {
					addVirtualCode('scriptSetup', end);
				}
			}
		}
		else {
			addVirtualCode('scriptSetup', scriptSetupRanges.importSectionEndOffset);
		}

		if (scriptSetupRanges.propsTypeArg && scriptSetupRanges.withDefaultsArg) {
			// fix https://github.com/vuejs/language-tools/issues/1187
			codes.push(`const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`);
			addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end);
			codes.push(`);\n`);
		}

		if (!functional && scriptSetupRanges.defineProp.length) {
			codes.push(`let __VLS_propsOption_defineProp!: {\n`);
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
			codes.push(`};\n`);
		}

		generateTemplate(functional);

		if (mode === 'return' || mode === 'export') {
			if (!vueCompilerOptions.skipTemplateCodegen && (htmlGen?.hasSlot || scriptSetupRanges?.defineSlots)) {
				usedHelperTypes.WithTemplateSlots = true;
				codes.push(`const __VLS_component = `);
				generateComponent(functional);
				codes.push(`;\n`);
				codes.push(mode === 'return' ? 'return ' : 'export default ');
				codes.push(`{} as __VLS_WithTemplateSlots<typeof __VLS_component, ReturnType<typeof __VLS_template>>;\n`);
			}
			else {
				codes.push(mode === 'return' ? 'return ' : 'export default ');
				generateComponent(functional);
				codes.push(`;\n`);
			}
		}
		if (mode === 'export') {
			generateExportDefaultEndMapping();
		}

		return scriptSetupGeneratedOffset;
	}
	function generateComponent(functional: boolean) {

		if (!scriptSetupRanges)
			return;

		if (scriptRanges?.exportDefault && scriptRanges.exportDefault.expression.start !== scriptRanges.exportDefault.args.start) {
			// use defineComponent() from user space code if it exist
			addVirtualCode('script', scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.args.start);
			codes.push(`{\n`);
		}
		else {
			codes.push(`(await import('${vueCompilerOptions.lib}')).defineComponent({\n`);
		}

		generateComponentOptions(functional);

		codes.push(`setup() {\n`);
		codes.push(`return {\n`);

		generateSetupReturns();

		if (scriptSetupRanges.defineExpose) {
			codes.push(`...__VLS_exposed,\n`);
		}

		codes.push(`};\n`);
		codes.push(`},\n`);
		codes.push(`})`);
	}
	function generateComponentOptions(functional: boolean) {
		if (scriptSetupRanges && !bypassDefineComponent) {
			if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg || (!functional && scriptSetupRanges.defineProp.length)) {
				codes.push(`props: {\n`);
				if (scriptSetupRanges.propsRuntimeArg) {
					codes.push('...');
					addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end);
					codes.push(',\n');
				}
				if (scriptSetupRanges.propsTypeArg) {
					usedHelperTypes.DefinePropsToOptions = true;
					codes.push('...{} as ');

					if (scriptSetupRanges.withDefaultsArg) {
						usedHelperTypes.MergePropDefaults = true;
						codes.push(`__VLS_WithDefaults<`);
					}

					codes.push(`__VLS_TypePropsToRuntimeProps<`);
					if (functional) {
						codes.push(`typeof __VLS_fnPropsTypeOnly`);
					}
					else {
						addExtraReferenceVirtualCode('scriptSetup', scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end);
					}
					codes.push(`>`);

					if (scriptSetupRanges.withDefaultsArg) {
						codes.push(`, typeof __VLS_withDefaultsArg`);
						codes.push(`>`);
					}
					codes.push(',\n');
				}
				if (!functional && scriptSetupRanges.defineProp.length) {
					codes.push(`...__VLS_propsOption_defineProp,\n`);
				}
				codes.push(`},\n`);
			}
			if (scriptSetupRanges.defineEmits) {
				codes.push(
					`emits: ({} as __VLS_NormalizeEmits<typeof `,
					scriptSetupRanges.emitsAssignName ?? '__VLS_emit',
					`>),\n`,
				);
			}
		}
		if (scriptRanges?.exportDefault?.args) {
			addVirtualCode('script', scriptRanges.exportDefault.args.start + 1, scriptRanges.exportDefault.args.end - 1);
		}
	}
	function generateSetupReturns() {
		if (scriptSetupRanges && bypassDefineComponent) {
			// fill $props
			if (scriptSetupRanges.defineProps) {
				// NOTE: defineProps is inaccurate for $props
				codes.push(`$props: __VLS_makeOptional(${scriptSetupRanges.propsAssignName ?? `__VLS_props`}),\n`);
				codes.push(`...${scriptSetupRanges.propsAssignName ?? `__VLS_props`},\n`);
			}
			// fill $emit
			if (scriptSetupRanges.defineEmits) {
				codes.push(`$emit: ${scriptSetupRanges.emitsAssignName ?? '__VLS_emit'},\n`);
			}
		}
	}
	function generateTemplate(functional: boolean) {

		generatedTemplate = true;

		if (!vueCompilerOptions.skipTemplateCodegen) {

			generateExportOptions();
			generateConstNameOption();

			codes.push(`function __VLS_template() {\n`);

			const templateGened = generateTemplateContext();

			codes.push(`}\n`);

			generateComponentForTemplateUsage(functional, templateGened.cssIds);
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
	function generateComponentForTemplateUsage(functional: boolean, cssIds: Set<string>) {

		if (sfc.scriptSetup && scriptSetupRanges) {

			codes.push(`const __VLS_internalComponent = (await import('${vueCompilerOptions.lib}')).defineComponent({\n`);
			generateComponentOptions(functional);
			codes.push(`setup() {\n`);
			codes.push(`return {\n`);
			generateSetupReturns();
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
					codes.push(`: ${varName} as typeof `);

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
		codes.push(`InstanceType<__VLS_PickNotAny<typeof __VLS_internalComponent, new () => {}>> & {\n`);

		/* CSS Module */
		for (let i = 0; i < _sfc.styles.length; i++) {
			const style = _sfc.styles[i];
			if (!style.module) continue;
			codes.push(`${style.module}: Record<string, string> & __VLS_Prettify<{}`);
			for (const className of style.classNames) {
				generateCssClassProperty(
					i,
					className.text.substring(1),
					{ start: className.offset, end: className.offset + className.text.length },
					'string',
					false,
					true,
				);
			}
			codes.push('>;\n');
		}
		codes.push(`};\n`);

		/* Components */
		codes.push('/* Components */\n');
		codes.push(`let __VLS_otherComponents!: NonNullable<typeof __VLS_internalComponent extends { components: infer C } ? C : {}> & typeof __VLS_componentsOption;\n`);
		codes.push(`let __VLS_own!: __VLS_SelfComponent<typeof __VLS_name, typeof __VLS_internalComponent & (new () => { ${getSlotsPropertyName(vueCompilerOptions.target)}: typeof ${scriptSetupRanges?.slotsAssignName ?? '__VLS_slots'} })>;\n`);
		codes.push(`let __VLS_localComponents!: typeof __VLS_otherComponents & Omit<typeof __VLS_own, keyof typeof __VLS_otherComponents>;\n`);
		codes.push(`let __VLS_components!: typeof __VLS_localComponents & __VLS_GlobalComponents & typeof __VLS_ctx;\n`); // for html completion, TS references...

		/* Style Scoped */
		codes.push('/* Style Scoped */\n');
		codes.push('type __VLS_StyleScopedClasses = {}');
		for (let i = 0; i < _sfc.styles.length; i++) {
			const style = _sfc.styles[i];
			if (!style.scoped && vueCompilerOptions.experimentalResolveStyleCssClasses !== 'always') continue;
			for (const className of style.classNames) {
				generateCssClassProperty(
					i,
					className.text.substring(1),
					{ start: className.offset, end: className.offset + className.text.length },
					'boolean',
					true,
					!style.module,
				);
			}
		}
		codes.push(';\n');
		codes.push('let __VLS_styleScopedClasses!: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

		codes.push(`/* CSS variable injection */\n`);
		const cssIds = generateCssVars();
		codes.push(`/* CSS variable injection end */\n`);

		if (htmlGen) {
			muggle.setTracking(false);
			for (const s of htmlGen.codes) {
				codes.push(s);
			}
			muggle.setTracking(true);
			for (const s of htmlGen.codeStacks) {
				codeStacks.push(s);
			}
		}

		if (!htmlGen) {
			codes.push(`// no template\n`);
			if (!scriptSetupRanges?.defineSlots) {
				codes.push(`const __VLS_slots = {};\n`);
			}
		}

		codes.push(`return ${scriptSetupRanges?.slotsAssignName ?? '__VLS_slots'};\n`);

		return { cssIds };

		function generateCssClassProperty(styleIndex: number, className: string, classRange: TextRange, propertyType: string, optional: boolean, referencesCodeLens: boolean) {
			codes.push(`\n & { `);
			codes.push([
				'',
				'style_' + styleIndex,
				classRange.start,
				{
					references: true,
					referencesCodeLens,
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

			const emptyLocalVars = new Map<string, number>();
			const identifiers = new Set<string>();

			for (const style of _sfc.styles) {
				for (const cssBind of style.cssVars) {
					walkInterpolationFragment(
						ts,
						cssBind.text,
						ts.createSourceFile('/a.txt', cssBind.text, ts.ScriptTarget.ESNext),
						(frag, fragOffset, onlyForErrorMapping) => {
							if (fragOffset === undefined) {
								codes.push(frag);
							}
							else {
								codes.push([
									frag,
									style.name,
									cssBind.offset + fragOffset,
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
			// fix import components unused report
			for (const varName of bindingNames) {
				if (!!htmlGen.tagNames[varName] || !!htmlGen.tagNames[hyphenateTag(varName)]) {
					usageVars.add(varName);
				}
			}
			for (const tag of Object.keys(htmlGen.tagNames)) {
				if (tag.indexOf('.') >= 0) {
					usageVars.add(tag.split('.')[0]);
				}
			}
			for (const _id of htmlGen.accessedGlobalVariables) {
				usageVars.add(_id);
			}
		}

		return usageVars;
	}
	function addVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end?: number) {
		muggle.offsetStack();
		codes.push([
			sfc[vueTag]!.content.substring(start, end),
			vueTag,
			start,
			FileRangeCapabilities.full, // diagnostic also working for setup() returns unused in template checking
		]);
		muggle.resetOffsetStack();
	}
	function addExtraReferenceVirtualCode(vueTag: 'script' | 'scriptSetup', start: number, end: number) {
		muggle.offsetStack();
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
		muggle.resetOffsetStack();
	}
}

function normalizeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.slice(1) : newName;
}

function applyCssRename(newName: string) {
	return '.' + newName;
}
