import type { Mapping } from '@volar/language-core';
import * as path from 'path-browserify';
import type * as ts from 'typescript';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import type { Code, Sfc, SfcBlock, VueCodeInformation, VueCompilerOptions } from '../types';
import { getSlotsPropertyName, hyphenateTag } from '../utils/shared';
import { forEachInterpolationSegment } from '../codegen/template/interpolation';
import { combineLastMapping, endOfLine, newLine } from '../codegen/common';
import { createGlobalTypes } from './globalTypes';
import { TemplateCodegenContext, createTemplateCodegenContext } from '../codegen/template';

interface HelperType {
	name: string;
	usage?: boolean;
	generated?: boolean;
	code: string;
}

const _codeFeatures = {
	all: {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
	} as VueCodeInformation,
	none: {} as VueCodeInformation,
	verification: {
		verification: true,
	} as VueCodeInformation,
	navigation: {
		navigation: true,
	} as VueCodeInformation,
	referencesCodeLens: {
		navigation: true,
		__referencesCodeLens: true,
	} as VueCodeInformation,
	cssClassNavigation: {
		navigation: {
			resolveRenameNewName: normalizeCssRename,
			resolveRenameEditText: applyCssRename,
		},
	} as VueCodeInformation,
};

export function* generate(
	ts: typeof import('typescript'),
	fileName: string,
	sfc: Sfc,
	lang: string,
	scriptRanges: ScriptRanges | undefined,
	scriptSetupRanges: ScriptSetupRanges | undefined,
	templateCodegen: {
		tsCodes: Code[];
		ctx: TemplateCodegenContext;
		hasSlot: boolean;
	} | undefined,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	globalTypesHolder: string | undefined,
	getGeneratedLength: () => number,
	linkedCodeMappings: Mapping[] = [],
): Generator<Code> {

	let { script, scriptSetup } = sfc;
	let generatedTemplate = false;
	let scriptSetupGeneratedOffset: number | undefined;

	//#region monkey fix: https://github.com/vuejs/language-tools/pull/2113
	if (!script && !scriptSetup) {
		scriptSetup = {
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
			ast: ts.createSourceFile('', '', 99 satisfies ts.ScriptTarget.Latest, false, ts.ScriptKind.TS),
		};
		scriptSetupRanges = {
			bindings: [],
			props: {},
			emits: {},
			expose: {},
			slots: {},
			defineProp: [],
			importSectionEndOffset: 0,
			leadingCommentEndOffset: 0,
		};
	}
	//#endregion

	const codeFeatures = {
		..._codeFeatures,
		optionsWrapperStart: {
			__hint: {
				setting: 'vue.inlayHints.optionsWrapper',
				label: vueCompilerOptions.optionsWrapper.length
					? vueCompilerOptions.optionsWrapper[0]
					: '[Missing optionsWrapper]',
				tooltip: [
					'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
					'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
				].join('\n\n'),
			}
		} as VueCodeInformation,
		optionsWrapperEnd: {
			__hint: {
				setting: 'vue.inlayHints.optionsWrapper',
				label: vueCompilerOptions.optionsWrapper.length === 2
					? vueCompilerOptions.optionsWrapper[1]
					: '[Missing optionsWrapper]',
				tooltip: '',
			}
		} as VueCodeInformation,
	};
	const bindingNames = new Set([
		...scriptRanges?.bindings.map(range => script!.content.substring(range.start, range.end)) ?? [],
		...scriptSetupRanges?.bindings.map(range => scriptSetup!.content.substring(range.start, range.end)) ?? [],
	]);
	const bypassDefineComponent = lang === 'js' || lang === 'jsx';
	const helperTypes = {
		OmitKeepDiscriminatedUnion: {
			get name() {
				this.usage = true;
				return `__VLS_OmitKeepDiscriminatedUnion`;
			},
			get code() {
				return `type __VLS_OmitKeepDiscriminatedUnion<T, K extends keyof any> = T extends any
					? Pick<T, Exclude<keyof T, K>>
					: never;`;
			},
		} satisfies HelperType as HelperType,
		WithDefaults: {
			get name() {
				this.usage = true;
				return `__VLS_WithDefaults`;
			},
			get code(): string {
				return `type __VLS_WithDefaults<P, D> = {
					[K in keyof Pick<P, keyof P>]: K extends keyof D
						? ${helperTypes.Prettify.name}<P[K] & { default: D[K]}>
						: P[K]
				};`;
			},
		} satisfies HelperType as HelperType,
		Prettify: {
			get name() {
				this.usage = true;
				return `__VLS_Prettify`;
			},
			get code() {
				return `type __VLS_Prettify<T> = { [K in keyof T]: T[K]; } & {};`;
			},
		} satisfies HelperType as HelperType,
		WithTemplateSlots: {
			get name() {
				this.usage = true;
				return `__VLS_WithTemplateSlots`;
			},
			get code(): string {
				return `type __VLS_WithTemplateSlots<T, S> = T & {
					new(): {
						${getSlotsPropertyName(vueCompilerOptions.target)}: S;
						${vueCompilerOptions.jsxSlots ? `$props: ${helperTypes.PropsChildren.name}<S>;` : ''}
					}
				};`;
			},
		} satisfies HelperType as HelperType,
		PropsChildren: {
			get name() {
				this.usage = true;
				return `__VLS_PropsChildren`;
			},
			get code() {
				return `type __VLS_PropsChildren<S> = {
					[K in keyof (
						boolean extends (
							// @ts-ignore
							JSX.ElementChildrenAttribute extends never
								? true
								: false
						)
							? never
							// @ts-ignore
							: JSX.ElementChildrenAttribute
					)]?: S;
				};`;
			},
		} satisfies HelperType as HelperType,
		TypePropsToOption: {
			get name() {
				this.usage = true;
				return `__VLS_TypePropsToOption`;
			},
			get code() {
				return compilerOptions.exactOptionalPropertyTypes ?
					`type __VLS_TypePropsToOption<T> = {
						[K in keyof T]-?: {} extends Pick<T, K>
							? { type: import('${vueCompilerOptions.lib}').PropType<T[K]> }
							: { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true }
					};` :
					`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
					type __VLS_TypePropsToOption<T> = {
						[K in keyof T]-?: {} extends Pick<T, K>
							? { type: import('${vueCompilerOptions.lib}').PropType<__VLS_NonUndefinedable<T[K]>> }
							: { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true }
					};`;
			},
		} satisfies HelperType as HelperType,
	};

	yield `/* __placeholder__ */${newLine}`;
	yield* generateSrc();
	yield* generateScriptSetupImports();
	yield* generateScriptContentBeforeExportDefault();
	yield* generateScriptSetupAndTemplate();
	yield* generateScriptContentAfterExportDefault();
	if (globalTypesHolder === fileName) {
		yield createGlobalTypes(vueCompilerOptions);
	}
	yield* generateLocalHelperTypes();
	yield `\ntype __VLS_IntrinsicElementsCompletion = __VLS_IntrinsicElements${endOfLine}`;

	if (!generatedTemplate) {
		yield* generateTemplate(false);
	}

	if (scriptSetup) {
		yield [
			'',
			'scriptSetup',
			scriptSetup.content.length,
			codeFeatures.verification,
		];
	}

	function* generateLocalHelperTypes(): Generator<Code> {
		let shouldCheck = true;
		while (shouldCheck) {
			shouldCheck = false;
			for (const helperType of Object.values(helperTypes)) {
				if (helperType.usage && !helperType.generated) {
					shouldCheck = true;
					helperType.generated = true;
					yield newLine + helperType.code + newLine;
				}
			}
		}
	}
	function* generateSrc(): Generator<Code> {
		if (!script?.src) {
			return;
		}

		let src = script.src;

		if (src.endsWith('.d.ts')) {
			src = src.substring(0, src.length - '.d.ts'.length);
		}
		else if (src.endsWith('.ts')) {
			src = src.substring(0, src.length - '.ts'.length);
		}
		else if (src.endsWith('.tsx')) {
			src = src.substring(0, src.length - '.tsx'.length) + '.jsx';
		}

		if (!src.endsWith('.js') && !src.endsWith('.jsx')) {
			src = src + '.js';
		}

		yield `export * from `;
		yield [
			`'${src}'`,
			'script',
			script.srcOffset - 1,
			{
				...codeFeatures.all,
				navigation: src === script.src
					? true
					: {
						shouldRename: () => false,
						resolveRenameEditText(newName) {
							if (newName.endsWith('.jsx') || newName.endsWith('.js')) {
								newName = newName.split('.').slice(0, -1).join('.');
							}
							if (script?.src?.endsWith('.d.ts')) {
								newName = newName + '.d.ts';
							}
							else if (script?.src?.endsWith('.ts')) {
								newName = newName + '.ts';
							}
							else if (script?.src?.endsWith('.tsx')) {
								newName = newName + '.tsx';
							}
							return newName;
						},
					},
			},
		];
		yield endOfLine;
		yield `export { default } from '${src}'${endOfLine}`;
	}
	function* generateScriptContentBeforeExportDefault(): Generator<Code> {
		if (!script) {
			return;
		}

		if (!!scriptSetup && scriptRanges?.exportDefault) {
			yield generateSourceCode(script, 0, scriptRanges.exportDefault.expression.start);
			return;
		}

		let isExportRawObject = false;
		if (scriptRanges?.exportDefault) {
			isExportRawObject = script.content.substring(scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end).startsWith('{');
		}

		if (!isExportRawObject || !vueCompilerOptions.optionsWrapper.length || !scriptRanges?.exportDefault) {
			yield generateSourceCode(script, 0, script.content.length);
			return;
		}

		yield generateSourceCode(script, 0, scriptRanges.exportDefault.expression.start);
		yield vueCompilerOptions.optionsWrapper[0];
		yield [
			'',
			'script',
			scriptRanges.exportDefault.expression.start,
			codeFeatures.optionsWrapperStart,
		];
		yield generateSourceCode(script, scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end);
		yield [
			'',
			'script',
			scriptRanges.exportDefault.expression.end,
			codeFeatures.optionsWrapperEnd,
		];
		yield vueCompilerOptions.optionsWrapper[1];
		yield generateSourceCode(script, scriptRanges.exportDefault.expression.end, script.content.length);
	}
	function* generateScriptContentAfterExportDefault(): Generator<Code> {
		if (!script) {
			return;
		}

		if (!!scriptSetup && scriptRanges?.exportDefault) {
			yield generateSourceCode(script, scriptRanges.exportDefault.expression.end, script.content.length);
		}
	}
	function* generateScriptSetupImports(): Generator<Code> {
		if (!scriptSetup || !scriptSetupRanges) {
			return;
		}

		yield [
			scriptSetup.content.substring(0, Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset)) + newLine,
			'scriptSetup',
			0,
			codeFeatures.all,
		];
	}
	function* generateModelEmits(): Generator<Code> {
		if (!scriptSetup || !scriptSetupRanges) {
			return;
		}

		yield `let __VLS_modelEmitsType!: {}`;

		if (scriptSetupRanges.defineProp.length) {
			yield ` & ReturnType<typeof import('${vueCompilerOptions.lib}').defineEmits<{${newLine}`;
			for (const defineProp of scriptSetupRanges.defineProp) {
				if (!defineProp.isModel) {
					continue;
				}

				let propName = 'modelValue';
				if (defineProp.name) {
					propName = scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
					propName = propName.replace(/['"]+/g, '');
				}
				yield `'update:${propName}': [${propName}:`;
				if (defineProp.type) {
					yield scriptSetup.content.substring(defineProp.type.start, defineProp.type.end);
				}
				else {
					yield `any`;
				}
				yield `]${endOfLine}`;
			}
			yield `}>>`;
		}
		yield endOfLine;
	}
	function* generateScriptSetupAndTemplate(): Generator<Code> {
		if (!scriptSetup || !scriptSetupRanges) {
			return;
		}

		const definePropMirrors = new Map<string, number>();

		if (scriptSetup.generic) {
			if (!scriptRanges?.exportDefault) {
				yield `export default `;
			}
			yield `(<`;
			yield [
				scriptSetup.generic,
				scriptSetup.name,
				scriptSetup.genericOffset,
				codeFeatures.all,
			];
			if (!scriptSetup.generic.endsWith(`,`)) {
				yield `,`;
			}
			yield `>`;
			yield `(${newLine}`
				+ `	__VLS_props: Awaited<typeof __VLS_setup>['props'],${newLine}`
				+ `	__VLS_ctx?: ${helperTypes.Prettify.name}<Pick<Awaited<typeof __VLS_setup>, 'attrs' | 'emit' | 'slots'>>,${newLine}` // use __VLS_Prettify for less dts code
				+ `	__VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>['expose'],${newLine}`
				+ `	__VLS_setup = (async () => {${newLine}`;

			yield* generateSetupFunction(true, 'none', definePropMirrors);

			//#region props
			yield `const __VLS_fnComponent = `
				+ `(await import('${vueCompilerOptions.lib}')).defineComponent({${newLine}`;
			if (scriptSetupRanges.props.define?.arg) {
				yield `	props: `;
				yield generateSourceCodeForExtraReference(scriptSetup, scriptSetupRanges.props.define.arg.start, scriptSetupRanges.props.define.arg.end);
				yield `,${newLine}`;
			}
			if (scriptSetupRanges.emits.define) {
				yield `	emits: ({} as __VLS_NormalizeEmits<typeof `;
				yield scriptSetupRanges.emits.name ?? '__VLS_emit';
				yield `>),${newLine}`;
			}
			yield `})${endOfLine}`;

			if (scriptSetupRanges.defineProp.length) {
				yield `const __VLS_defaults = {${newLine}`;
				for (const defineProp of scriptSetupRanges.defineProp) {
					if (defineProp.defaultValue) {
						if (defineProp.name) {
							yield scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
						}
						else {
							yield `modelValue`;
						}
						yield `: `;
						yield scriptSetup.content.substring(defineProp.defaultValue.start, defineProp.defaultValue.end);
						yield `,${newLine}`;
					}
				}
				yield `}${endOfLine}`;
			}

			yield `let __VLS_fnPropsTypeOnly!: {}`; // TODO: reuse __VLS_fnPropsTypeOnly even without generic, and remove __VLS_propsOption_defineProp
			if (scriptSetupRanges.props.define?.typeArg) {
				yield ` & `;
				yield generateSourceCode(scriptSetup, scriptSetupRanges.props.define.typeArg.start, scriptSetupRanges.props.define.typeArg.end);
			}
			if (scriptSetupRanges.defineProp.length) {
				yield ` & {${newLine}`;
				for (const defineProp of scriptSetupRanges.defineProp) {
					let propName = 'modelValue';
					if (defineProp.name) {
						propName = scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
						definePropMirrors.set(propName, getGeneratedLength());
					}
					yield `${propName}${defineProp.required ? '' : '?'}: `;
					if (defineProp.type) {
						yield scriptSetup.content.substring(defineProp.type.start, defineProp.type.end);
					}
					else if (defineProp.defaultValue) {
						yield `typeof __VLS_defaults['`;
						yield propName;
						yield `']`;
					}
					else {
						yield `any`;
					}
					yield `,${newLine}`;
				}
				yield `}`;
			}
			yield endOfLine;

			yield* generateModelEmits();

			yield `let __VLS_fnPropsDefineComponent!: InstanceType<typeof __VLS_fnComponent>['$props']${endOfLine}`;
			yield `let __VLS_fnPropsSlots!: `;
			if (scriptSetupRanges.slots.define && vueCompilerOptions.jsxSlots) {
				yield `${helperTypes.PropsChildren.name}<typeof __VLS_slots>`;
			}
			else {
				yield `{}`;
			}
			yield endOfLine;

			yield `let __VLS_defaultProps!:${newLine}`
				+ `	import('${vueCompilerOptions.lib}').VNodeProps${newLine}`
				+ `	& import('${vueCompilerOptions.lib}').AllowedComponentProps${newLine}`
				+ `	& import('${vueCompilerOptions.lib}').ComponentCustomProps${endOfLine}`;
			//#endregion

			yield `		return {} as {${newLine}`
				+ `			props: ${helperTypes.Prettify.name}<${helperTypes.OmitKeepDiscriminatedUnion.name}<typeof __VLS_fnPropsDefineComponent & typeof __VLS_fnPropsTypeOnly, keyof typeof __VLS_defaultProps>> & typeof __VLS_fnPropsSlots & typeof __VLS_defaultProps,${newLine}`
				+ `			expose(exposed: import('${vueCompilerOptions.lib}').ShallowUnwrapRef<${scriptSetupRanges.expose.define ? 'typeof __VLS_exposed' : '{}'}>): void,${newLine}`
				+ `			attrs: any,${newLine}`
				+ `			slots: ReturnType<typeof __VLS_template>,${newLine}`
				+ `			emit: typeof ${scriptSetupRanges.emits.name ?? '__VLS_emit'} & typeof __VLS_modelEmitsType,${newLine}`
				+ `		}${endOfLine}`;
			yield `	})(),${newLine}`; // __VLS_setup = (async () => {
			yield `) => ({} as import('${vueCompilerOptions.lib}').VNode & { __ctx?: Awaited<typeof __VLS_setup> }))`;
		}
		else if (!script) {
			// no script block, generate script setup code at root
			yield* generateSetupFunction(false, 'export', definePropMirrors);
		}
		else {
			if (!scriptRanges?.exportDefault) {
				yield `export default `;
			}
			yield `await (async () => {${newLine}`;
			yield* generateSetupFunction(false, 'return', definePropMirrors);
			yield `})()`;
		}

		if (scriptSetupGeneratedOffset !== undefined) {
			for (const defineProp of scriptSetupRanges.defineProp) {
				if (!defineProp.name) {
					continue;
				}
				const propName = scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
				const propMirror = definePropMirrors.get(propName);
				if (propMirror !== undefined) {
					linkedCodeMappings.push({
						sourceOffsets: [defineProp.name.start + scriptSetupGeneratedOffset],
						generatedOffsets: [propMirror],
						lengths: [defineProp.name.end - defineProp.name.start],
						data: undefined,
					});
				}
			}
		}
	}
	function* generateSetupFunction(functional: boolean, mode: 'return' | 'export' | 'none', definePropMirrors: Map<string, number>): Generator<Code> {
		if (!scriptSetupRanges || !scriptSetup) {
			return;
		}

		const definePropProposalA = scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=kevinEdition') || vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition';
		const definePropProposalB = scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=johnsonEdition') || vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition';

		if (vueCompilerOptions.target >= 3.3) {
			yield `const { `;
			for (const macro of Object.keys(vueCompilerOptions.macros)) {
				if (!bindingNames.has(macro)) {
					yield macro + `, `;
				}
			}
			yield `} = await import('${vueCompilerOptions.lib}')${endOfLine}`;
		}
		if (definePropProposalA) {
			yield `declare function defineProp<T>(name: string, options: { required: true } & Record<string, unknown>): import('${vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(name: string, options: { default: any } & Record<string, unknown>): import('${vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(name?: string, options?: any): import('${vueCompilerOptions.lib}').ComputedRef<T | undefined>${endOfLine}`;
		}
		if (definePropProposalB) {
			yield `declare function defineProp<T>(value: T | (() => T), required?: boolean, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(value: T | (() => T) | undefined, required: true, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
			yield `declare function defineProp<T>(value?: T | (() => T), required?: boolean, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T | undefined>${endOfLine}`;
		}

		scriptSetupGeneratedOffset = getGeneratedLength() - scriptSetupRanges.importSectionEndOffset;

		let setupCodeModifies: [Code[], number, number][] = [];
		if (scriptSetupRanges.props.define && !scriptSetupRanges.props.name) {
			const range = scriptSetupRanges.props.withDefaults ?? scriptSetupRanges.props.define;
			const statement = scriptSetupRanges.props.define.statement;
			if (statement.start === range.start && statement.end === range.end) {
				setupCodeModifies.push([[`const __VLS_props = `], range.start, range.start]);
			}
			else {
				setupCodeModifies.push([[
					`const __VLS_props = `,
					generateSourceCode(scriptSetup, range.start, range.end),
					`${endOfLine}`,
					generateSourceCode(scriptSetup, statement.start, range.start),
					`__VLS_props`,
				], statement.start, range.end]);
			}
		}
		if (scriptSetupRanges.slots.define && !scriptSetupRanges.slots.name) {
			setupCodeModifies.push([[`const __VLS_slots = `], scriptSetupRanges.slots.define.start, scriptSetupRanges.slots.define.start]);
		}
		if (scriptSetupRanges.emits.define && !scriptSetupRanges.emits.name) {
			setupCodeModifies.push([[`const __VLS_emit = `], scriptSetupRanges.emits.define.start, scriptSetupRanges.emits.define.start]);
		}
		if (scriptSetupRanges.expose.define) {
			if (scriptSetupRanges.expose.define?.typeArg) {
				setupCodeModifies.push([
					[
						`let __VLS_exposed!: `,
						generateSourceCodeForExtraReference(scriptSetup, scriptSetupRanges.expose.define.typeArg.start, scriptSetupRanges.expose.define.typeArg.end),
						`${endOfLine}`,
					],
					scriptSetupRanges.expose.define.start,
					scriptSetupRanges.expose.define.start,
				]);
			}
			else if (scriptSetupRanges.expose.define?.arg) {
				setupCodeModifies.push([
					[
						`const __VLS_exposed = `,
						generateSourceCodeForExtraReference(scriptSetup, scriptSetupRanges.expose.define.arg.start, scriptSetupRanges.expose.define.arg.end),
						`${endOfLine}`,
					],
					scriptSetupRanges.expose.define.start,
					scriptSetupRanges.expose.define.start,
				]);
			}
			else {
				setupCodeModifies.push([
					[`const __VLS_exposed = {}${endOfLine}`],
					scriptSetupRanges.expose.define.start,
					scriptSetupRanges.expose.define.start,
				]);
			}
		}
		setupCodeModifies = setupCodeModifies.sort((a, b) => a[1] - b[1]);

		if (setupCodeModifies.length) {
			yield generateSourceCode(scriptSetup, scriptSetupRanges.importSectionEndOffset, setupCodeModifies[0][1]);
			while (setupCodeModifies.length) {
				const [codes, _start, end] = setupCodeModifies.shift()!;
				for (const code of codes) {
					yield code;
				}
				if (setupCodeModifies.length) {
					const nextStart = setupCodeModifies[0][1];
					yield generateSourceCode(scriptSetup, end, nextStart);
				}
				else {
					yield generateSourceCode(scriptSetup, end);
				}
			}
		}
		else {
			yield generateSourceCode(scriptSetup, scriptSetupRanges.importSectionEndOffset);
		}

		if (scriptSetupRanges.props.define?.typeArg && scriptSetupRanges.props.withDefaults?.arg) {
			// fix https://github.com/vuejs/language-tools/issues/1187
			yield `const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`;
			yield generateSourceCodeForExtraReference(scriptSetup, scriptSetupRanges.props.withDefaults.arg.start, scriptSetupRanges.props.withDefaults.arg.end);
			yield `)${endOfLine}`;
		}

		if (!functional && scriptSetupRanges.defineProp.length) {
			yield `let __VLS_propsOption_defineProp!: {${newLine}`;
			for (const defineProp of scriptSetupRanges.defineProp) {

				let propName = 'modelValue';

				if (defineProp.name && defineProp.nameIsString) {
					// renaming support
					yield generateSourceCodeForExtraReference(scriptSetup, defineProp.name.start, defineProp.name.end);
				}
				else if (defineProp.name) {
					propName = scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
					const start = getGeneratedLength();
					definePropMirrors.set(propName, start);
					yield propName;
				}
				else {
					yield propName;
				}
				yield `: `;

				let type = 'any';
				if (!defineProp.nameIsString) {
					type = `NonNullable<typeof ${propName}['value']>`;
				}
				else if (defineProp.type) {
					type = scriptSetup.content.substring(defineProp.type.start, defineProp.type.end);
				}

				if (defineProp.required) {
					yield `{ required: true, type: import('${vueCompilerOptions.lib}').PropType<${type}> },${newLine}`;
				}
				else {
					yield `import('${vueCompilerOptions.lib}').PropType<${type}>,${newLine}`;
				}

				if (defineProp.modifierType) {
					let propModifierName = 'modelModifiers';

					if (defineProp.name) {
						propModifierName = `${scriptSetup.content.substring(defineProp.name.start + 1, defineProp.name.end - 1)}Modifiers`;
					}

					const modifierType = scriptSetup.content.substring(defineProp.modifierType.start, defineProp.modifierType.end);

					const start = getGeneratedLength();
					definePropMirrors.set(propModifierName, start);
					yield propModifierName;
					yield `: `;
					yield `import('${vueCompilerOptions.lib}').PropType<Record<${modifierType}, true>>,${newLine}`;
				}
			}
			yield `}${endOfLine}`;
		}

		yield* generateModelEmits();
		yield* generateTemplate(functional);

		if (mode === 'return' || mode === 'export') {
			if (!vueCompilerOptions.skipTemplateCodegen && (templateCodegen?.hasSlot || scriptSetupRanges?.slots.define)) {
				yield `const __VLS_component = `;
				yield* generateComponent(functional);
				yield endOfLine;
				yield mode === 'return'
					? 'return '
					: 'export default ';
				yield `{} as ${helperTypes.WithTemplateSlots.name}<typeof __VLS_component, ReturnType<typeof __VLS_template>>${endOfLine}`;
			}
			else {
				yield mode === 'return'
					? 'return '
					: 'export default ';
				yield* generateComponent(functional);
				yield endOfLine;
			}
		}
	}
	function* generateComponent(functional: boolean): Generator<Code> {
		if (!scriptSetupRanges) {
			return;
		}

		if (script && scriptRanges?.exportDefault && scriptRanges.exportDefault.expression.start !== scriptRanges.exportDefault.args.start) {
			// use defineComponent() from user space code if it exist
			yield generateSourceCode(script, scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.args.start);
			yield `{${newLine}`;
		}
		else {
			yield `(await import('${vueCompilerOptions.lib}')).defineComponent({${newLine}`;
		}

		yield `setup() {${newLine}`;
		yield `return {${newLine}`;
		yield* generateSetupReturns();
		if (scriptSetupRanges.expose.define) {
			yield `...__VLS_exposed,${newLine}`;
		}
		yield `}${endOfLine}`;
		yield `},${newLine}`;
		yield* generateComponentOptions(functional);
		yield `})`;
	}
	function* generateComponentOptions(functional: boolean): Generator<Code> {
		if (scriptSetup && scriptSetupRanges && !bypassDefineComponent) {

			const ranges = scriptSetupRanges;
			const propsCodegens: (() => Generator<Code>)[] = [];

			if (ranges.props.define?.arg) {
				const arg = ranges.props.define.arg;
				propsCodegens.push(function* () {
					yield generateSourceCodeForExtraReference(scriptSetup!, arg.start, arg.end);
				});
			}
			if (ranges.props.define?.typeArg) {
				const typeArg = ranges.props.define.typeArg;
				propsCodegens.push(function* () {

					yield `{} as `;

					if (ranges.props.withDefaults?.arg) {
						yield `${helperTypes.WithDefaults.name}<`;
					}

					yield `${helperTypes.TypePropsToOption.name}<`;
					if (functional) {
						yield `typeof __VLS_fnPropsTypeOnly`;
					}
					else {
						yield generateSourceCodeForExtraReference(scriptSetup!, typeArg.start, typeArg.end);
					}
					yield `>`;

					if (ranges.props.withDefaults?.arg) {
						yield `, typeof __VLS_withDefaultsArg`;
						yield `>`;
					}
				});
			}
			if (!functional && ranges.defineProp.length) {
				propsCodegens.push(function* () {
					yield `__VLS_propsOption_defineProp`;
				});
			}

			if (propsCodegens.length === 1) {
				yield `props: `;
				for (const generate of propsCodegens) {
					yield* generate();
				}
				yield `,${newLine}`;
			}
			else if (propsCodegens.length >= 2) {
				yield `props: {${newLine}`;
				for (const generate of propsCodegens) {
					yield `...`;
					yield* generate();
					yield `,${newLine}`;
				}
				yield `},${newLine}`;
			}
			if (ranges.defineProp.filter(p => p.isModel).length || ranges.emits.define) {
				yield `emits: ({} as __VLS_NormalizeEmits<typeof __VLS_modelEmitsType`;
				if (ranges.emits.define) {
					yield ` & typeof `;
					yield ranges.emits.name ?? '__VLS_emit';
				}
				yield `>),${newLine}`;
			}
		}
		if (script && scriptRanges?.exportDefault?.args) {
			yield generateSourceCode(script, scriptRanges.exportDefault.args.start + 1, scriptRanges.exportDefault.args.end - 1);
		}
	}
	function* generateSetupReturns(): Generator<Code> {
		if (scriptSetupRanges && bypassDefineComponent) {
			// fill $props
			if (scriptSetupRanges.props.define) {
				// NOTE: defineProps is inaccurate for $props
				yield `$props: __VLS_makeOptional(${scriptSetupRanges.props.name ?? `__VLS_props`}),${newLine}`;
				yield `...${scriptSetupRanges.props.name ?? `__VLS_props`},${newLine}`;
			}
			// fill $emit
			if (scriptSetupRanges.emits.define) {
				yield `$emit: ${scriptSetupRanges.emits.name ?? '__VLS_emit'},${newLine}`;
			}
		}
	}
	function* generateTemplate(functional: boolean): Generator<Code> {

		generatedTemplate = true;

		if (!vueCompilerOptions.skipTemplateCodegen) {
			yield* generateExportOptions();
			yield* generateConstNameOption();
			yield `function __VLS_template() {${newLine}`;
			const ctx = createTemplateCodegenContext();
			yield* generateTemplateContext(ctx);
			yield `}${newLine}`;
			yield* generateComponentForTemplateUsage(functional, ctx);
		}
		else {
			yield `function __VLS_template() {${newLine}`;
			const templateUsageVars = [...getTemplateUsageVars()];
			yield `// @ts-ignore${newLine}`;
			yield `[${templateUsageVars.join(', ')}]${newLine}`;
			yield `return {}${endOfLine}`;
			yield `}${newLine}`;
		}
	}
	function* generateComponentForTemplateUsage(functional: boolean, ctx: TemplateCodegenContext): Generator<Code> {

		if (scriptSetup && scriptSetupRanges) {

			yield `const __VLS_internalComponent = (await import('${vueCompilerOptions.lib}')).defineComponent({${newLine}`;
			yield `setup() {${newLine}`;
			yield `return {${newLine}`;
			yield* generateSetupReturns();
			// bindings
			const templateUsageVars = getTemplateUsageVars();
			for (const [content, bindings] of [
				[scriptSetup.content, scriptSetupRanges.bindings] as const,
				scriptRanges && script
					? [script.content, scriptRanges.bindings] as const
					: ['', []] as const,
			]) {
				for (const expose of bindings) {
					const varName = content.substring(expose.start, expose.end);
					if (!templateUsageVars.has(varName) && !ctx.accessGlobalVariables.has(varName)) {
						continue;
					}
					const templateOffset = getGeneratedLength();
					yield `${varName}: ${varName} as typeof `;

					const scriptOffset = getGeneratedLength();
					yield `${varName},${newLine}`;

					linkedCodeMappings.push({
						sourceOffsets: [scriptOffset],
						generatedOffsets: [templateOffset],
						lengths: [varName.length],
						data: undefined,
					});
				}
			}
			yield `}${endOfLine}`; // return {
			yield `},${newLine}`; // setup() {
			yield* generateComponentOptions(functional);
			yield `})${endOfLine}`; // defineComponent {
		}
		else if (script) {
			yield `let __VLS_internalComponent!: typeof import('./${path.basename(fileName)}')['default']${endOfLine}`;
		}
		else {
			yield `const __VLS_internalComponent = (await import('${vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
		}
	}
	function* generateExportOptions(): Generator<Code> {
		yield newLine;
		yield `const __VLS_componentsOption = `;
		if (script && scriptRanges?.exportDefault?.componentsOption) {
			const componentsOption = scriptRanges.exportDefault.componentsOption;
			yield [
				script.content.substring(componentsOption.start, componentsOption.end),
				'script',
				componentsOption.start,
				codeFeatures.navigation,
			];
		}
		else {
			yield `{}`;
		}
		yield endOfLine;
	}
	function* generateConstNameOption(): Generator<Code> {
		yield newLine;
		if (script && scriptRanges?.exportDefault?.nameOption) {
			const nameOption = scriptRanges.exportDefault.nameOption;
			yield `const __VLS_name = `;
			yield `${script.content.substring(nameOption.start, nameOption.end)} as const`;
			yield endOfLine;
		}
		else if (scriptSetup) {
			yield `let __VLS_name!: '${path.basename(fileName.substring(0, fileName.lastIndexOf('.')))}'${endOfLine}`;
		}
		else {
			yield `const __VLS_name = undefined${endOfLine}`;
		}
	}
	function* generateTemplateContext(ctx: TemplateCodegenContext): Generator<Code> {

		const useGlobalThisTypeInCtx = fileName.endsWith('.html');

		yield `let __VLS_ctx!: ${useGlobalThisTypeInCtx ? 'typeof globalThis &' : ''}`;
		yield `InstanceType<__VLS_PickNotAny<typeof __VLS_internalComponent, new () => {}>> & {${newLine}`;

		/* CSS Module */
		for (let i = 0; i < sfc.styles.length; i++) {
			const style = sfc.styles[i];
			if (style.module) {
				yield `${style.module}: Record<string, string> & ${helperTypes.Prettify.name}<{}`;
				for (const className of style.classNames) {
					yield* generateCssClassProperty(
						i,
						className.text,
						className.offset,
						'string',
						false,
						true,
					);
				}
				yield `>${endOfLine}`;
			}
		}
		yield `}${endOfLine}`;

		/* Components */
		yield `/* Components */${newLine}`;
		yield `let __VLS_otherComponents!: NonNullable<typeof __VLS_internalComponent extends { components: infer C } ? C : {}> & typeof __VLS_componentsOption${endOfLine}`;
		yield `let __VLS_own!: __VLS_SelfComponent<typeof __VLS_name, typeof __VLS_internalComponent & (new () => { ${getSlotsPropertyName(vueCompilerOptions.target)}: typeof ${scriptSetupRanges?.slots?.name ?? '__VLS_slots'} })>${endOfLine}`;
		yield `let __VLS_localComponents!: typeof __VLS_otherComponents & Omit<typeof __VLS_own, keyof typeof __VLS_otherComponents>${endOfLine}`;
		yield `let __VLS_components!: typeof __VLS_localComponents & __VLS_GlobalComponents & typeof __VLS_ctx${endOfLine}`; // for html completion, TS references...

		/* Style Scoped */
		yield `/* Style Scoped */${newLine}`;
		yield `type __VLS_StyleScopedClasses = {}`;
		for (let i = 0; i < sfc.styles.length; i++) {
			const style = sfc.styles[i];
			const option = vueCompilerOptions.experimentalResolveStyleCssClasses;
			if (option === 'always' || (option === 'scoped' && style.scoped)) {
				for (const className of style.classNames) {
					yield* generateCssClassProperty(
						i,
						className.text,
						className.offset,
						'boolean',
						true,
						!style.module,
					);
				}
			}
		}
		yield endOfLine;
		yield `let __VLS_styleScopedClasses!: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[]${endOfLine}`;

		yield `/* CSS variable injection */${newLine}`;
		yield* generateCssVars(ctx);
		yield `/* CSS variable injection end */${newLine}`;

		if (templateCodegen) {
			for (const code of templateCodegen.tsCodes) {
				yield code;
			}
		}
		else {
			yield `// no template${newLine}`;
			if (!scriptSetupRanges?.slots.define) {
				yield `const __VLS_slots = {}${endOfLine}`;
			}
		}

		yield `return ${scriptSetupRanges?.slots.name ?? '__VLS_slots'}${endOfLine}`;

	}
	function* generateCssClassProperty(
		styleIndex: number,
		classNameWithDot: string,
		offset: number,
		propertyType: string,
		optional: boolean,
		referencesCodeLens: boolean
	): Generator<Code> {
		yield `${newLine} & { `;
		yield [
			'',
			'style_' + styleIndex,
			offset,
			referencesCodeLens
				? codeFeatures.navigation
				: codeFeatures.referencesCodeLens,
		];
		yield `'`;
		yield [
			'',
			'style_' + styleIndex,
			offset,
			codeFeatures.cssClassNavigation,
		];
		yield [
			classNameWithDot.substring(1),
			'style_' + styleIndex,
			offset + 1,
			combineLastMapping,
		];
		yield `'`;
		yield [
			'',
			'style_' + styleIndex,
			offset + classNameWithDot.length,
			codeFeatures.none,
		];
		yield `${optional ? '?' : ''}: ${propertyType}`;
		yield ` }`;
	}
	function* generateCssVars(ctx: TemplateCodegenContext): Generator<Code> {
		for (const style of sfc.styles) {
			for (const cssBind of style.cssVars) {
				for (const [segment, offset, onlyError] of forEachInterpolationSegment(
					ts,
					vueCompilerOptions,
					ctx,
					cssBind.text,
					cssBind.offset,
					ts.createSourceFile('/a.txt', cssBind.text, 99 satisfies ts.ScriptTarget.ESNext),
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
	}
	function getTemplateUsageVars() {

		const usageVars = new Set<string>();
		const components = new Set(sfc.template?.ast?.components);

		if (templateCodegen) {
			// fix import components unused report
			for (const varName of bindingNames) {
				if (components.has(varName) || components.has(hyphenateTag(varName))) {
					usageVars.add(varName);
				}
			}
			for (const component of components) {
				if (component.indexOf('.') >= 0) {
					usageVars.add(component.split('.')[0]);
				}
			}
			for (const [varName] of templateCodegen.ctx.accessGlobalVariables) {
				usageVars.add(varName);
			}
		}

		return usageVars;
	}
	function generateSourceCode(block: SfcBlock, start: number, end?: number): Code {
		return [
			block.content.substring(start, end),
			block.name,
			start,
			codeFeatures.all, // diagnostic also working for setup() returns unused in template checking
		];
	}
	function generateSourceCodeForExtraReference(block: SfcBlock, start: number, end: number): Code {
		return [
			block.content.substring(start, end),
			block.name,
			start,
			codeFeatures.navigation,
		];
	}
}

function normalizeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.slice(1) : newName;
}

function applyCssRename(newName: string) {
	return '.' + newName;
}
