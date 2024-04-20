import { ScriptCodegenOptions, codeFeatures, generateSfcBlockSection, generateSfcBlockSectionForExtraReference } from './index';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { endOfLine, newLine } from '../common';
import type { ScriptCodegenContext } from './context';
import { generateComponent } from './component';
import { generateTemplate } from './template';

export function generateScriptSetupImports(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Code {
	return [
		scriptSetup.content.substring(0, Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset)) + newLine,
		'scriptSetup',
		0,
		codeFeatures.all,
	];
}

export function* generateScriptSetup(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	const definePropMirrors = new Map<string, number>();

	if (scriptSetup.generic) {
		if (!options.scriptRanges?.exportDefault) {
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
		yield `>(${newLine}`
			+ `	__VLS_props: Awaited<typeof __VLS_setup>['props'],${newLine}`
			+ `	__VLS_ctx?: ${ctx.helperTypes.Prettify.name}<Pick<Awaited<typeof __VLS_setup>, 'attrs' | 'emit' | 'slots'>>,${newLine}` // use __VLS_Prettify for less dts code
			+ `	__VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>['expose'],${newLine}`
			+ `	__VLS_setup = (async () => {${newLine}`;

		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, true, undefined, definePropMirrors);

		//#region props
		yield `const __VLS_fnComponent = `
			+ `(await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;
		if (scriptSetupRanges.props.define?.arg) {
			yield `	props: `;
			yield generateSfcBlockSectionForExtraReference(scriptSetup, scriptSetupRanges.props.define.arg.start, scriptSetupRanges.props.define.arg.end);
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
			yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.props.define.typeArg.start, scriptSetupRanges.props.define.typeArg.end);
		}
		if (scriptSetupRanges.defineProp.length) {
			yield ` & {${newLine}`;
			for (const defineProp of scriptSetupRanges.defineProp) {
				let propName = 'modelValue';
				if (defineProp.name) {
					propName = scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
					definePropMirrors.set(propName, options.getGeneratedLength());
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

		yield* generateModelEmits(options, scriptSetup, scriptSetupRanges);

		yield `let __VLS_fnPropsDefineComponent!: InstanceType<typeof __VLS_fnComponent>['$props']${endOfLine}`;
		yield `let __VLS_fnPropsSlots!: `;
		if (scriptSetupRanges.slots.define && options.vueCompilerOptions.jsxSlots) {
			yield `${ctx.helperTypes.PropsChildren.name}<typeof __VLS_slots>`;
		}
		else {
			yield `{}`;
		}
		yield endOfLine;

		yield `let __VLS_defaultProps!:${newLine}`
			+ `	import('${options.vueCompilerOptions.lib}').VNodeProps${newLine}`
			+ `	& import('${options.vueCompilerOptions.lib}').AllowedComponentProps${newLine}`
			+ `	& import('${options.vueCompilerOptions.lib}').ComponentCustomProps${endOfLine}`;
		//#endregion

		yield `		return {} as {${newLine}`
			+ `			props: ${ctx.helperTypes.Prettify.name}<${ctx.helperTypes.OmitKeepDiscriminatedUnion.name}<typeof __VLS_fnPropsDefineComponent & typeof __VLS_fnPropsTypeOnly, keyof typeof __VLS_defaultProps>> & typeof __VLS_fnPropsSlots & typeof __VLS_defaultProps,${newLine}`
			+ `			expose(exposed: import('${options.vueCompilerOptions.lib}').ShallowUnwrapRef<${scriptSetupRanges.expose.define ? 'typeof __VLS_exposed' : '{}'}>): void,${newLine}`
			+ `			attrs: any,${newLine}`
			+ `			slots: ReturnType<typeof __VLS_template>,${newLine}`
			+ `			emit: typeof ${scriptSetupRanges.emits.name ?? '__VLS_emit'} & typeof __VLS_modelEmitsType,${newLine}`
			+ `		}${endOfLine}`;
		yield `	})(),${newLine}`; // __VLS_setup = (async () => {
		yield `) => ({} as import('${options.vueCompilerOptions.lib}').VNode & { __ctx?: Awaited<typeof __VLS_setup> }))`;
	}
	else if (!options.sfc.script) {
		// no script block, generate script setup code at root
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, false, 'export default', definePropMirrors);
	}
	else {
		if (!options.scriptRanges?.exportDefault) {
			yield `export default `;
		}
		yield `await (async () => {${newLine}`;
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, false, 'return', definePropMirrors);
		yield `})()`;
	}

	if (ctx.scriptSetupGeneratedOffset !== undefined) {
		for (const defineProp of scriptSetupRanges.defineProp) {
			if (!defineProp.name) {
				continue;
			}
			const propName = scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
			const propMirror = definePropMirrors.get(propName);
			if (propMirror !== undefined) {
				options.linkedCodeMappings.push({
					sourceOffsets: [defineProp.name.start + ctx.scriptSetupGeneratedOffset],
					generatedOffsets: [propMirror],
					lengths: [defineProp.name.end - defineProp.name.start],
					data: undefined,
				});
			}
		}
	}
}

function* generateSetupFunction(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	functional: boolean,
	syntax: 'return' | 'export default' | undefined,
	definePropMirrors: Map<string, number>,
): Generator<Code> {
	const definePropProposalA = scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=kevinEdition') || options.vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition';
	const definePropProposalB = scriptSetup.content.trimStart().startsWith('// @experimentalDefinePropProposal=johnsonEdition') || options.vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition';

	if (options.vueCompilerOptions.target >= 3.3) {
		yield `const { `;
		for (const macro of Object.keys(options.vueCompilerOptions.macros)) {
			if (!ctx.bindingNames.has(macro)) {
				yield macro + `, `;
			}
		}
		yield `} = await import('${options.vueCompilerOptions.lib}')${endOfLine}`;
	}
	if (definePropProposalA) {
		yield `declare function defineProp<T>(name: string, options: { required: true } & Record<string, unknown>): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
		yield `declare function defineProp<T>(name: string, options: { default: any } & Record<string, unknown>): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
		yield `declare function defineProp<T>(name?: string, options?: any): import('${options.vueCompilerOptions.lib}').ComputedRef<T | undefined>${endOfLine}`;
	}
	if (definePropProposalB) {
		yield `declare function defineProp<T>(value: T | (() => T), required?: boolean, rest?: any): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
		yield `declare function defineProp<T>(value: T | (() => T) | undefined, required: true, rest?: any): import('${options.vueCompilerOptions.lib}').ComputedRef<T>${endOfLine}`;
		yield `declare function defineProp<T>(value?: T | (() => T), required?: boolean, rest?: any): import('${options.vueCompilerOptions.lib}').ComputedRef<T | undefined>${endOfLine}`;
	}

	ctx.scriptSetupGeneratedOffset = options.getGeneratedLength() - scriptSetupRanges.importSectionEndOffset;

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
				generateSfcBlockSection(scriptSetup, range.start, range.end),
				`${endOfLine}`,
				generateSfcBlockSection(scriptSetup, statement.start, range.start),
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
					generateSfcBlockSectionForExtraReference(scriptSetup, scriptSetupRanges.expose.define.typeArg.start, scriptSetupRanges.expose.define.typeArg.end),
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
					generateSfcBlockSectionForExtraReference(scriptSetup, scriptSetupRanges.expose.define.arg.start, scriptSetupRanges.expose.define.arg.end),
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
		yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.importSectionEndOffset, setupCodeModifies[0][1]);
		while (setupCodeModifies.length) {
			const [codes, _start, end] = setupCodeModifies.shift()!;
			for (const code of codes) {
				yield code;
			}
			if (setupCodeModifies.length) {
				const nextStart = setupCodeModifies[0][1];
				yield generateSfcBlockSection(scriptSetup, end, nextStart);
			}
			else {
				yield generateSfcBlockSection(scriptSetup, end);
			}
		}
	}
	else {
		yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.importSectionEndOffset);
	}

	if (scriptSetupRanges.props.define?.typeArg && scriptSetupRanges.props.withDefaults?.arg) {
		// fix https://github.com/vuejs/language-tools/issues/1187
		yield `const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`;
		yield generateSfcBlockSectionForExtraReference(scriptSetup, scriptSetupRanges.props.withDefaults.arg.start, scriptSetupRanges.props.withDefaults.arg.end);
		yield `)${endOfLine}`;
	}

	if (!functional && scriptSetupRanges.defineProp.length) {
		yield `let __VLS_propsOption_defineProp!: {${newLine}`;
		for (const defineProp of scriptSetupRanges.defineProp) {

			let propName = 'modelValue';

			if (defineProp.name && defineProp.nameIsString) {
				// renaming support
				yield generateSfcBlockSectionForExtraReference(scriptSetup, defineProp.name.start, defineProp.name.end);
			}
			else if (defineProp.name) {
				propName = scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
				const start = options.getGeneratedLength();
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
				yield `{ required: true, type: import('${options.vueCompilerOptions.lib}').PropType<${type}> },${newLine}`;
			}
			else {
				yield `import('${options.vueCompilerOptions.lib}').PropType<${type}>,${newLine}`;
			}

			if (defineProp.modifierType) {
				let propModifierName = 'modelModifiers';

				if (defineProp.name) {
					propModifierName = `${scriptSetup.content.substring(defineProp.name.start + 1, defineProp.name.end - 1)}Modifiers`;
				}

				const modifierType = scriptSetup.content.substring(defineProp.modifierType.start, defineProp.modifierType.end);

				const start = options.getGeneratedLength();
				definePropMirrors.set(propModifierName, start);
				yield propModifierName;
				yield `: `;
				yield `import('${options.vueCompilerOptions.lib}').PropType<Record<${modifierType}, true>>,${newLine}`;
			}
		}
		yield `}${endOfLine}`;
	}

	yield* generateModelEmits(options, scriptSetup, scriptSetupRanges);
	yield* generateTemplate(options, ctx, functional);

	if (syntax) {
		if (!options.vueCompilerOptions.skipTemplateCodegen && (options.templateCodegen?.hasSlot || scriptSetupRanges?.slots.define)) {
			yield `const __VLS_component = `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges, functional);
			yield endOfLine;
			yield `${syntax} `;
			yield `{} as ${ctx.helperTypes.WithTemplateSlots.name}<typeof __VLS_component, ReturnType<typeof __VLS_template>>${endOfLine}`;
		}
		else {
			yield `${syntax} `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges, functional);
			yield endOfLine;
		}
	}
}

function* generateModelEmits(
	options: ScriptCodegenOptions,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	yield `let __VLS_modelEmitsType!: {}`;

	if (scriptSetupRanges.defineProp.length) {
		yield ` & ReturnType<typeof import('${options.vueCompilerOptions.lib}').defineEmits<{${newLine}`;
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
