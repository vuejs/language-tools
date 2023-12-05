import { Mapping } from '@volar/language-core';
import * as path from 'path-browserify';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as templateGen from '../generators/template';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import type { Code, SfcBlock, VueCompilerOptions } from '../types';
import { Sfc } from '../types';
import { getSlotsPropertyName, hyphenateTag } from '../utils/shared';
import { eachInterpolationSegment } from '../utils/transform';
import { disableAllFeatures, enableAllFeatures } from './utils';

export function* generate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	fileName: string,
	script: Sfc['script'],
	scriptSetup: Sfc['scriptSetup'],
	styles: Sfc['styles'], // TODO: computed it
	lang: string,
	scriptRanges: ScriptRanges | undefined,
	scriptSetupRanges: ScriptSetupRanges | undefined,
	htmlGen: ReturnType<typeof templateGen['generate']> | undefined,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	getGeneratedLength: () => number,
	linkedCodeMappings: Mapping[] = [],
): Generator<Code> {

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
			ast: ts.createSourceFile('', '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS),
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

	const bindingNames = new Set([
		...scriptRanges?.bindings.map(range => script!.content.substring(range.start, range.end)) ?? [],
		...scriptSetupRanges?.bindings.map(range => scriptSetup!.content.substring(range.start, range.end)) ?? [],
	]);
	const bypassDefineComponent = lang === 'js' || lang === 'jsx';
	const usedHelperTypes = {
		DefinePropsToOptions: false,
		MergePropDefaults: false,
		WithTemplateSlots: false,
		PropsChildren: false,
	};

	let generatedTemplate = false;
	let scriptSetupGeneratedOffset: number | undefined;

	yield `/* __placeholder__ */\n`;
	yield* generateSrc();
	yield* generateScriptSetupImports();
	yield* generateScriptContentBeforeExportDefault();
	yield* generateScriptSetupAndTemplate();
	yield* generateHelperTypes();
	yield* generateScriptContentAfterExportDefault();

	if (!generatedTemplate) {
		yield* generateTemplate(false);
	}

	if (scriptSetup) {
		yield ['', 'scriptSetup', scriptSetup.content.length, disableAllFeatures({ verification: true })];
	}

	function* generateHelperTypes(): Generator<Code> {
		if (usedHelperTypes.DefinePropsToOptions) {
			if (compilerOptions.exactOptionalPropertyTypes) {
				yield `type __VLS_TypePropsToRuntimeProps<T> = {\n`
					+ `	[K in keyof T]-?: {} extends Pick<T, K>\n`
					+ `		? { type: import('${vueCompilerOptions.lib}').PropType<T[K]> }\n`
					+ `		: { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true }\n`
					+ `};\n`;
			}
			else {
				yield `type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;\n`;
				yield `type __VLS_TypePropsToRuntimeProps<T> = {\n`
					+ `	[K in keyof T]-?: {} extends Pick<T, K>\n`
					+ `		? { type: import('${vueCompilerOptions.lib}').PropType<__VLS_NonUndefinedable<T[K]>> }\n`
					+ `		: { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true }\n`
					+ `};\n`;
			}
		}
		if (usedHelperTypes.MergePropDefaults) {
			yield `type __VLS_WithDefaults<P, D> = {\n`
				// use 'keyof Pick<P, keyof P>' instead of 'keyof P' to keep props jsdoc
				+ `	[K in keyof Pick<P, keyof P>]: K extends keyof D\n`
				+ `		? __VLS_Prettify<P[K] & { default: D[K]}>\n`
				+ `		: P[K]\n`
				+ `};\n`;
			yield `type __VLS_Prettify<T> = { [K in keyof T]: T[K]; } & {};\n`;
		}
		if (usedHelperTypes.WithTemplateSlots) {
			yield `type __VLS_WithTemplateSlots<T, S> = T & {\n`
				+ `	new(): {\n`
				+ `		${getSlotsPropertyName(vueCompilerOptions.target)}: S;\n`;
			if (vueCompilerOptions.jsxSlots) {
				usedHelperTypes.PropsChildren = true;
				yield `		$props: __VLS_PropsChildren<S>;\n`;
			}
			yield `	}\n`
				+ `};\n`;
		}
		if (usedHelperTypes.PropsChildren) {
			yield `type __VLS_PropsChildren<S> = {\n`
				+ `	[K in keyof (\n`
				+ `		boolean extends (\n`
				+ `			JSX.ElementChildrenAttribute extends never\n`
				+ `				? true\n`
				+ `				: false\n`
				+ `		)\n`
				+ `			? never\n`
				+ `			: JSX.ElementChildrenAttribute\n`
				+ `	)]?: S;\n`
				+ `};\n`;
		}
	}
	function* generateSrc(): Generator<Code> {
		if (!script?.src)
			return;

		let src = script.src;

		if (src.endsWith('.d.ts'))
			src = src.substring(0, src.length - '.d.ts'.length);
		else if (src.endsWith('.ts'))
			src = src.substring(0, src.length - '.ts'.length);
		else if (src.endsWith('.tsx'))
			src = src.substring(0, src.length - '.tsx'.length) + '.jsx';

		if (!src.endsWith('.js') && !src.endsWith('.jsx'))
			src = src + '.js';

		yield `export * from `;
		yield [
			`'${src}'`,
			'script',
			script.srcOffset - 1,
			enableAllFeatures({
				navigation: src === script.src ? true : {
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
			}),
		];
		yield `;\n`;
		yield `export { default } from '${src}';\n`;
	}
	function* generateScriptContentBeforeExportDefault(): Generator<Code> {
		if (!script)
			return;

		if (!!scriptSetup && scriptRanges?.exportDefault)
			return yield generateSourceCode(script, 0, scriptRanges.exportDefault.expression.start);

		let isExportRawObject = false;
		if (scriptRanges?.exportDefault)
			isExportRawObject = script.content.substring(scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end).startsWith('{');

		if (!isExportRawObject || !vueCompilerOptions.optionsWrapper.length || !scriptRanges?.exportDefault)
			return yield generateSourceCode(script, 0, script.content.length);

		yield generateSourceCode(script, 0, scriptRanges.exportDefault.expression.start);
		yield vueCompilerOptions.optionsWrapper[0];
		yield ['', 'script', scriptRanges.exportDefault.expression.start, disableAllFeatures({
			__hint: {
				setting: 'vue.inlayHints.optionsWrapper',
				label: vueCompilerOptions.optionsWrapper[0],
				tooltip: [
					'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
					'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
				].join('\n\n'),
			}
		})];
		yield generateSourceCode(script, scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.expression.end);
		yield ['', 'script', scriptRanges.exportDefault.expression.end, disableAllFeatures({
			__hint: {
				setting: 'vue.inlayHints.optionsWrapper',
				label: vueCompilerOptions.optionsWrapper[1],
				tooltip: '',
			}
		})];
		yield vueCompilerOptions.optionsWrapper[1];
		yield generateSourceCode(script, scriptRanges.exportDefault.expression.end, script.content.length);
	}
	function* generateScriptContentAfterExportDefault(): Generator<Code> {
		if (!script)
			return;

		if (!!scriptSetup && scriptRanges?.exportDefault)
			yield generateSourceCode(script, scriptRanges.exportDefault.expression.end, script.content.length);
	}
	function* generateScriptSetupImports(): Generator<Code> {
		if (!scriptSetup || !scriptSetupRanges)
			return;

		yield [
			scriptSetup.content.substring(0, Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset)) + '\n',
			'scriptSetup',
			0,
			enableAllFeatures({}),
		];
	}
	function* generateScriptSetupAndTemplate(): Generator<Code> {
		if (!scriptSetup || !scriptSetupRanges)
			return;

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
				enableAllFeatures({}),
			];
			if (!scriptSetup.generic.endsWith(`,`)) {
				yield `,`;
			}
			yield `>`;
			yield `(\n`
				+ `	__VLS_props: Awaited<typeof __VLS_setup>['props'],\n`
				+ `	__VLS_ctx?: __VLS_Prettify<Pick<Awaited<typeof __VLS_setup>, 'attrs' | 'emit' | 'slots'>>,\n` // use __VLS_Prettify for less dts code
				+ `	__VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>['expose'],\n`
				+ `	__VLS_setup = (async () => {\n`;

			yield* generateSetupFunction(true, 'none', definePropMirrors);

			//#region props
			yield `const __VLS_fnComponent = `
				+ `(await import('${vueCompilerOptions.lib}')).defineComponent({\n`;
			if (scriptSetupRanges.props.define?.arg) {
				yield `	props: `;
				yield generateSourceCodeForExtraReference(scriptSetup, scriptSetupRanges.props.define.arg.start, scriptSetupRanges.props.define.arg.end);
				yield `,\n`;
			}
			if (scriptSetupRanges.emits.define) {
				yield `	emits: ({} as __VLS_NormalizeEmits<typeof `;
				yield scriptSetupRanges.emits.name ?? '__VLS_emit';
				yield `>),\n`;
			}
			yield `});\n`;

			if (scriptSetupRanges.defineProp.length) {
				yield `const __VLS_defaults = {\n`;
				for (const defineProp of scriptSetupRanges.defineProp) {
					if (defineProp.defaultValue) {
						if (defineProp.name) {
							yield scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
						}
						else {
							yield 'modelValue';
						}
						yield `: `;
						yield scriptSetup.content.substring(defineProp.defaultValue.start, defineProp.defaultValue.end);
						yield `,\n`;
					}
				}
				yield `};\n`;
			}

			yield `let __VLS_fnPropsTypeOnly!: {}`; // TODO: reuse __VLS_fnPropsTypeOnly even without generic, and remove __VLS_propsOption_defineProp
			if (scriptSetupRanges.props.define?.typeArg) {
				yield ` & `;
				yield generateSourceCode(scriptSetup, scriptSetupRanges.props.define.typeArg.start, scriptSetupRanges.props.define.typeArg.end);
			}
			if (scriptSetupRanges.defineProp.length) {
				yield ` & {\n`;
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
					yield ',\n';
				}
				yield `}`;
			}
			yield `;\n`;

			yield `let __VLS_fnPropsDefineComponent!: InstanceType<typeof __VLS_fnComponent>['$props'];\n`;
			yield `let __VLS_fnPropsSlots!: `;
			if (scriptSetupRanges.slots.define && vueCompilerOptions.jsxSlots) {
				usedHelperTypes.PropsChildren = true;
				yield `__VLS_PropsChildren<typeof __VLS_slots>`;
			}
			else {
				yield `{}`;
			}
			yield `;\n`;

			yield `let __VLS_defaultProps!:\n`
				+ `	import('${vueCompilerOptions.lib}').VNodeProps\n`
				+ `	& import('${vueCompilerOptions.lib}').AllowedComponentProps\n`
				+ `	& import('${vueCompilerOptions.lib}').ComponentCustomProps;\n`;
			//#endregion

			yield `		return {} as {\n`
				+ `			props: __VLS_Prettify<__VLS_OmitKeepDiscriminatedUnion<typeof __VLS_fnPropsDefineComponent & typeof __VLS_fnPropsTypeOnly, keyof typeof __VLS_defaultProps>> & typeof __VLS_fnPropsSlots & typeof __VLS_defaultProps,\n`
				+ `			expose(exposed: import('${vueCompilerOptions.lib}').ShallowUnwrapRef<${scriptSetupRanges.expose.define ? 'typeof __VLS_exposed' : '{}'}>): void,\n`
				+ `			attrs: any,\n`
				+ `			slots: ReturnType<typeof __VLS_template>,\n`
				+ `			emit: typeof ${scriptSetupRanges.emits.name ?? '__VLS_emit'},\n`
				+ `		};\n`;
			yield `	})(),\n`; // __VLS_setup = (async () => {
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
			yield `await (async () => {\n`;
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
		if (!scriptSetupRanges || !scriptSetup)
			return;

		const definePropProposalA = scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=kevinEdition') || vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition';
		const definePropProposalB = scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=johnsonEdition') || vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition';

		if (vueCompilerOptions.target >= 3.3) {
			yield `const { `;
			for (const macro of Object.keys(vueCompilerOptions.macros)) {
				if (!bindingNames.has(macro)) {
					yield macro + `, `;
				}
			}
			yield `} = await import('${vueCompilerOptions.lib}');\n`;
		}
		if (definePropProposalA) {
			yield `declare function defineProp<T>(name: string, options: { required: true } & Record<string, unknown>): import('${vueCompilerOptions.lib}').ComputedRef<T>;\n`;
			yield `declare function defineProp<T>(name: string, options: { default: any } & Record<string, unknown>): import('${vueCompilerOptions.lib}').ComputedRef<T>;\n`;
			yield `declare function defineProp<T>(name?: string, options?: any): import('${vueCompilerOptions.lib}').ComputedRef<T | undefined>;\n`;
		}
		if (definePropProposalB) {
			yield `declare function defineProp<T>(value: T | (() => T), required?: boolean, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T>;\n`;
			yield `declare function defineProp<T>(value: T | (() => T) | undefined, required: true, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T>;\n`;
			yield `declare function defineProp<T>(value?: T | (() => T), required?: boolean, rest?: any): import('${vueCompilerOptions.lib}').ComputedRef<T | undefined>;\n`;
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
					`;\n`,
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
						`;\n`,
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
						`;\n`,
					],
					scriptSetupRanges.expose.define.start,
					scriptSetupRanges.expose.define.start,
				]);
			}
			else {
				setupCodeModifies.push([
					[`const __VLS_exposed = {};\n`],
					scriptSetupRanges.expose.define.start,
					scriptSetupRanges.expose.define.start,
				]);
			}
		}
		setupCodeModifies = setupCodeModifies.sort((a, b) => a[1] - b[1]);

		if (setupCodeModifies.length) {
			yield generateSourceCode(scriptSetup, scriptSetupRanges.importSectionEndOffset, setupCodeModifies[0][1]);
			while (setupCodeModifies.length) {
				const [codes, _, end] = setupCodeModifies.shift()!;
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
			yield `);\n`;
		}

		if (!functional && scriptSetupRanges.defineProp.length) {
			yield `let __VLS_propsOption_defineProp!: {\n`;
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
					yield `{ required: true, type: import('${vueCompilerOptions.lib}').PropType<${type}> },\n`;
				}
				else {
					yield `import('${vueCompilerOptions.lib}').PropType<${type}>,\n`;
				}
			}
			yield `};\n`;
		}

		yield* generateTemplate(functional);

		if (mode === 'return' || mode === 'export') {
			if (!vueCompilerOptions.skipTemplateCodegen && (htmlGen?.hasSlot || scriptSetupRanges?.slots.define)) {
				usedHelperTypes.WithTemplateSlots = true;
				yield `const __VLS_component = `;
				yield* generateComponent(functional);
				yield `;\n`;
				yield mode === 'return' ? 'return ' : 'export default ';
				yield `{} as __VLS_WithTemplateSlots<typeof __VLS_component, ReturnType<typeof __VLS_template>>;\n`;
			}
			else {
				yield mode === 'return' ? 'return ' : 'export default ';
				yield* generateComponent(functional);
				yield `;\n`;
			}
		}
	}
	function* generateComponent(functional: boolean): Generator<Code> {
		if (!scriptSetupRanges)
			return;

		if (script && scriptRanges?.exportDefault && scriptRanges.exportDefault.expression.start !== scriptRanges.exportDefault.args.start) {
			// use defineComponent() from user space code if it exist
			yield generateSourceCode(script, scriptRanges.exportDefault.expression.start, scriptRanges.exportDefault.args.start);
			yield `{\n`;
		}
		else {
			yield `(await import('${vueCompilerOptions.lib}')).defineComponent({\n`;
		}

		yield `setup() {\n`;
		yield `return {\n`;
		yield* generateSetupReturns();
		if (scriptSetupRanges.expose.define) {
			yield `...__VLS_exposed,\n`;
		}
		yield `};\n`;
		yield `},\n`;
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

					usedHelperTypes.DefinePropsToOptions = true;

					yield `{} as `;

					if (ranges.props.withDefaults?.arg) {
						usedHelperTypes.MergePropDefaults = true;
						yield `__VLS_WithDefaults<`;
					}

					yield `__VLS_TypePropsToRuntimeProps<`;
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
				yield `,\n`;
			}
			else if (propsCodegens.length >= 2) {
				yield `props: {\n`;
				for (const generate of propsCodegens) {
					yield `...`;
					yield* generate();
					yield `,\n`;
				}
				yield `},\n`;
			}
			if (ranges.emits.define) {
				yield `emits: ({} as __VLS_NormalizeEmits<typeof `;
				yield ranges.emits.name ?? '__VLS_emit';
				yield `>),\n`;
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
				yield `$props: __VLS_makeOptional(${scriptSetupRanges.props.name ?? `__VLS_props`}),\n`;
				yield `...${scriptSetupRanges.props.name ?? `__VLS_props`},\n`;
			}
			// fill $emit
			if (scriptSetupRanges.emits.define) {
				yield `$emit: ${scriptSetupRanges.emits.name ?? '__VLS_emit'},\n`;
			}
		}
	}
	function* generateTemplate(functional: boolean): Generator<Code> {

		generatedTemplate = true;

		if (!vueCompilerOptions.skipTemplateCodegen) {
			yield* generateExportOptions();
			yield* generateConstNameOption();
			yield `function __VLS_template() {\n`;
			const cssIds = new Set<string>();
			yield* generateTemplateContext(cssIds);
			yield `}\n`;
			yield* generateComponentForTemplateUsage(functional, cssIds);
		}
		else {
			yield `function __VLS_template() {\n`;
			const templateUsageVars = [...getTemplateUsageVars()];
			yield `// @ts-ignore\n`;
			yield `[${templateUsageVars.join(', ')}]\n`;
			yield `return {};\n`;
			yield `}\n`;
		}
	}
	function* generateComponentForTemplateUsage(functional: boolean, cssIds: Set<string>): Generator<Code> {

		if (scriptSetup && scriptSetupRanges) {

			yield `const __VLS_internalComponent = (await import('${vueCompilerOptions.lib}')).defineComponent({\n`;
			yield `setup() {\n`;
			yield `return {\n`;
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
					if (!templateUsageVars.has(varName) && !cssIds.has(varName)) {
						continue;
					}
					const templateOffset = getGeneratedLength();
					yield varName;
					yield `: ${varName} as typeof `;

					const scriptOffset = getGeneratedLength();
					yield varName;
					yield `,\n`;

					linkedCodeMappings.push({
						sourceOffsets: [scriptOffset],
						generatedOffsets: [templateOffset],
						lengths: [varName.length],
						data: undefined,
					});
				}
			}
			yield `};\n`; // return {
			yield `},\n`; // setup() {
			yield* generateComponentOptions(functional);
			yield `});\n`; // defineComponent {
		}
		else if (script) {
			yield `let __VLS_internalComponent!: typeof import('./${path.basename(fileName)}')['default'];\n`;
		}
		else {
			yield `const __VLS_internalComponent = (await import('${vueCompilerOptions.lib}')).defineComponent({});\n`;
		}
	}
	function* generateExportOptions(): Generator<Code> {
		yield `\n`;
		yield `const __VLS_componentsOption = `;
		if (script && scriptRanges?.exportDefault?.componentsOption) {
			const componentsOption = scriptRanges.exportDefault.componentsOption;
			yield [
				script.content.substring(componentsOption.start, componentsOption.end),
				'script',
				componentsOption.start,
				disableAllFeatures({
					navigation: true,
				}),
			];
		}
		else {
			yield `{}`;
		}
		yield `;\n`;
	}
	function* generateConstNameOption(): Generator<Code> {
		yield `\n`;
		if (script && scriptRanges?.exportDefault?.nameOption) {
			const nameOption = scriptRanges.exportDefault.nameOption;
			yield `const __VLS_name = `;
			yield `${script.content.substring(nameOption.start, nameOption.end)} as const`;
			yield `;\n`;
		}
		else if (scriptSetup) {
			yield `let __VLS_name!: '${path.basename(fileName.substring(0, fileName.lastIndexOf('.')))}';\n`;
		}
		else {
			yield `const __VLS_name = undefined;\n`;
		}
	}
	function* generateTemplateContext(cssIds = new Set<string>()): Generator<Code> {

		const useGlobalThisTypeInCtx = fileName.endsWith('.html');

		yield `let __VLS_ctx!: ${useGlobalThisTypeInCtx ? 'typeof globalThis &' : ''}`;
		yield `InstanceType<__VLS_PickNotAny<typeof __VLS_internalComponent, new () => {}>> & {\n`;

		/* CSS Module */
		for (let i = 0; i < styles.length; i++) {
			const style = styles[i];
			if (style.module) {
				yield `${style.module}: Record<string, string> & __VLS_Prettify<{}`;
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
				yield `>;\n`;
			}
		}
		yield `};\n`;

		/* Components */
		yield `/* Components */\n`;
		yield `let __VLS_otherComponents!: NonNullable<typeof __VLS_internalComponent extends { components: infer C } ? C : {}> & typeof __VLS_componentsOption;\n`;
		yield `let __VLS_own!: __VLS_SelfComponent<typeof __VLS_name, typeof __VLS_internalComponent & (new () => { ${getSlotsPropertyName(vueCompilerOptions.target)}: typeof ${scriptSetupRanges?.slots?.name ?? '__VLS_slots'} })>;\n`;
		yield `let __VLS_localComponents!: typeof __VLS_otherComponents & Omit<typeof __VLS_own, keyof typeof __VLS_otherComponents>;\n`;
		yield `let __VLS_components!: typeof __VLS_localComponents & __VLS_GlobalComponents & typeof __VLS_ctx;\n`; // for html completion, TS references...

		/* Style Scoped */
		yield `/* Style Scoped */\n`;
		yield `type __VLS_StyleScopedClasses = {}`;
		for (let i = 0; i < styles.length; i++) {
			const style = styles[i];
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
		yield `;\n`;
		yield 'let __VLS_styleScopedClasses!: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n';

		yield `/* CSS variable injection */\n`;
		yield* generateCssVars(cssIds);
		yield `/* CSS variable injection end */\n`;

		if (htmlGen) {
			for (const s of htmlGen.codes) {
				yield s;
			}
		}

		if (!htmlGen) {
			yield `// no template\n`;
			if (!scriptSetupRanges?.slots.define) {
				yield `const __VLS_slots = {};\n`;
			}
		}

		yield `return ${scriptSetupRanges?.slots.name ?? '__VLS_slots'};\n`;

	}
	function* generateCssClassProperty(
		styleIndex: number,
		classNameWithDot: string,
		offset: number,
		propertyType: string,
		optional: boolean,
		referencesCodeLens: boolean
	): Generator<Code> {
		yield `\n & { `;
		yield [
			'',
			'style_' + styleIndex,
			offset,
			disableAllFeatures({
				navigation: true,
				__referencesCodeLens: referencesCodeLens,
			}),
		];
		yield `'`;
		yield [
			'',
			'style_' + styleIndex,
			offset,
			disableAllFeatures({
				navigation: {
					resolveRenameNewName: normalizeCssRename,
					resolveRenameEditText: applyCssRename,
				},
			}),
		];
		yield [
			classNameWithDot.substring(1),
			'style_' + styleIndex,
			offset + 1,
			disableAllFeatures({ __combineLastMappping: true }),
		];
		yield `'`;
		yield [
			'',
			'style_' + styleIndex,
			offset + classNameWithDot.length,
			disableAllFeatures({}),
		];
		yield `${optional ? '?' : ''}: ${propertyType}`;
		yield ` }`;
	}
	function* generateCssVars(cssIds: Set<string>): Generator<Code> {

		const emptyLocalVars = new Map<string, number>();

		for (const style of styles) {
			for (const cssBind of style.cssVars) {
				for (const [segment, offset, onlyError] of eachInterpolationSegment(
					ts,
					cssBind.text,
					ts.createSourceFile('/a.txt', cssBind.text, ts.ScriptTarget.ESNext),
					emptyLocalVars,
					cssIds,
					vueCompilerOptions,
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
								? disableAllFeatures({ verification: true })
								: enableAllFeatures({}),
						];
					}
				}
				yield `;\n`;
			}
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
	function generateSourceCode(block: SfcBlock, start: number, end?: number): Code {
		return [
			block.content.substring(start, end),
			block.name,
			start,
			enableAllFeatures({}), // diagnostic also working for setup() returns unused in template checking
		];
	}
	function generateSourceCodeForExtraReference(block: SfcBlock, start: number, end: number): Code {
		return [
			block.content.substring(start, end),
			block.name,
			start,
			disableAllFeatures({ navigation: true }),
		];
	}
}

function normalizeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.slice(1) : newName;
}

function applyCssRename(newName: string) {
	return '.' + newName;
}
