import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { endOfLine, generateSfcBlockSection, newLine } from '../common';
import { generateComponent } from './component';
import type { ScriptCodegenContext } from './context';
import { ScriptCodegenOptions, codeFeatures } from './index';
import { generateTemplate } from './template';

export function generateScriptSetupImports(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
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
	scriptSetupRanges: ScriptSetupRanges
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
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, undefined, definePropMirrors);

		const emitTypes = ['typeof __VLS_modelEmitsType'];

		if (scriptSetupRanges.emits.define) {
			emitTypes.unshift(`typeof ${scriptSetupRanges.emits.name ?? '__VLS_emit'}`);
		}

		yield `		return {} as {${newLine}`
			+ `			props: ${ctx.helperTypes.Prettify.name}<typeof __VLS_functionalComponentProps & __VLS_PublicProps> & __VLS_BuiltInPublicProps,${newLine}`
			+ `			expose(exposed: import('${options.vueCompilerOptions.lib}').ShallowUnwrapRef<${scriptSetupRanges.expose.define ? 'typeof __VLS_exposed' : '{}'}>): void,${newLine}`
			+ `			attrs: any,${newLine}`
			+ `			slots: ReturnType<typeof __VLS_template>,${newLine}`
			+ `			emit: ${emitTypes.join(' & ')},${newLine}`
			+ `		}${endOfLine}`;
		yield `	})(),${newLine}`; // __VLS_setup = (async () => {
		yield `) => ({} as import('${options.vueCompilerOptions.lib}').VNode & { __ctx?: Awaited<typeof __VLS_setup> }))`;
	}
	else if (!options.sfc.script) {
		// no script block, generate script setup code at root
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, 'export default', definePropMirrors);
	}
	else {
		if (!options.scriptRanges?.exportDefault) {
			yield `export default `;
		}
		yield `await (async () => {${newLine}`;
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, 'return', definePropMirrors);
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
	syntax: 'return' | 'export default' | undefined,
	definePropMirrors: Map<string, number>
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
	const propsRange = scriptSetupRanges.props.withDefaults ?? scriptSetupRanges.props.define;
	if (propsRange && scriptSetupRanges.props.define) {
		const statement = scriptSetupRanges.props.define.statement;
		if (scriptSetupRanges.props.define.typeArg) {
			setupCodeModifies.push([[
				`let __VLS_typeProps!: `,
				generateSfcBlockSection(scriptSetup, scriptSetupRanges.props.define.typeArg.start, scriptSetupRanges.props.define.typeArg.end, codeFeatures.all),
				endOfLine,
			], statement.start, statement.start]);
			setupCodeModifies.push([[`typeof __VLS_typeProps`], scriptSetupRanges.props.define.typeArg.start, scriptSetupRanges.props.define.typeArg.end]);
		}
		if (!scriptSetupRanges.props.name) {
			if (statement.start === propsRange.start && statement.end === propsRange.end) {
				setupCodeModifies.push([[`const __VLS_props = `], propsRange.start, propsRange.start]);
			}
			else {
				if (scriptSetupRanges.props.define.typeArg) {
					setupCodeModifies.push([[
						`const __VLS_props = `,
						generateSfcBlockSection(scriptSetup, propsRange.start, scriptSetupRanges.props.define.typeArg.start, codeFeatures.all),
					], statement.start, scriptSetupRanges.props.define.typeArg.start]);
					setupCodeModifies.push([[
						generateSfcBlockSection(scriptSetup, scriptSetupRanges.props.define.typeArg.end, propsRange.end, codeFeatures.all),
						`${endOfLine}`,
						generateSfcBlockSection(scriptSetup, statement.start, propsRange.start, codeFeatures.all),
						`__VLS_props`,
					], scriptSetupRanges.props.define.typeArg.end, propsRange.end]);
				}
				else {
					setupCodeModifies.push([[
						`const __VLS_props = `,
						generateSfcBlockSection(scriptSetup, propsRange.start, propsRange.end, codeFeatures.all),
						`${endOfLine}`,
						generateSfcBlockSection(scriptSetup, statement.start, propsRange.start, codeFeatures.all),
						`__VLS_props`,
					], statement.start, propsRange.end]);
				}
			}
		}
	}
	if (scriptSetupRanges.slots.define) {
		if (scriptSetupRanges.slots.isObjectBindingPattern) {
			setupCodeModifies.push([
				[`__VLS_slots;\nconst __VLS_slots = `],
				scriptSetupRanges.slots.define.start,
				scriptSetupRanges.slots.define.start,
			]);
		} else if (!scriptSetupRanges.slots.name) {
			setupCodeModifies.push([[`const __VLS_slots = `], scriptSetupRanges.slots.define.start, scriptSetupRanges.slots.define.start]);
		}
	}
	if (scriptSetupRanges.emits.define && !scriptSetupRanges.emits.name) {
		setupCodeModifies.push([[`const __VLS_emit = `], scriptSetupRanges.emits.define.start, scriptSetupRanges.emits.define.start]);
	}
	if (scriptSetupRanges.expose.define) {
		if (scriptSetupRanges.expose.define?.typeArg) {
			setupCodeModifies.push([
				[
					`let __VLS_exposed!: `,
					generateSfcBlockSection(scriptSetup, scriptSetupRanges.expose.define.typeArg.start, scriptSetupRanges.expose.define.typeArg.end, codeFeatures.navigation),
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
					generateSfcBlockSection(scriptSetup, scriptSetupRanges.expose.define.arg.start, scriptSetupRanges.expose.define.arg.end, codeFeatures.navigation),
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
		yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.importSectionEndOffset, setupCodeModifies[0][1], codeFeatures.all);
		while (setupCodeModifies.length) {
			const [codes, _start, end] = setupCodeModifies.shift()!;
			for (const code of codes) {
				yield code;
			}
			if (setupCodeModifies.length) {
				const nextStart = setupCodeModifies[0][1];
				yield generateSfcBlockSection(scriptSetup, end, nextStart, codeFeatures.all);
			}
			else {
				yield generateSfcBlockSection(scriptSetup, end, scriptSetup.content.length, codeFeatures.all);
			}
		}
	}
	else {
		yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.importSectionEndOffset, scriptSetup.content.length, codeFeatures.all);
	}

	if (scriptSetupRanges.props.define?.typeArg && scriptSetupRanges.props.withDefaults?.arg) {
		// fix https://github.com/vuejs/language-tools/issues/1187
		yield `const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`;
		yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.props.withDefaults.arg.start, scriptSetupRanges.props.withDefaults.arg.end, codeFeatures.navigation);
		yield `)${endOfLine}`;
	}

	yield* generateComponentProps(options, ctx, scriptSetup, scriptSetupRanges, definePropMirrors);
	yield* generateModelEmits(options, scriptSetup, scriptSetupRanges);
	yield* generateTemplate(options, ctx, false);

	if (syntax) {
		if (!options.vueCompilerOptions.skipTemplateCodegen && (options.templateCodegen?.hasSlot || scriptSetupRanges?.slots.define)) {
			yield `const __VLS_component = `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
			yield `${syntax} `;
			yield `{} as ${ctx.helperTypes.WithTemplateSlots.name}<typeof __VLS_component, ReturnType<typeof __VLS_template>>${endOfLine}`;
		}
		else {
			yield `${syntax} `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
		}
	}
}

function* generateComponentProps(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	definePropMirrors: Map<string, number>
): Generator<Code> {
	yield `const __VLS_fnComponent = `
		+ `(await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;
	if (scriptSetupRanges.props.define?.arg) {
		yield `	props: `;
		yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.props.define.arg.start, scriptSetupRanges.props.define.arg.end, codeFeatures.navigation);
		yield `,${newLine}`;
	}
	if (scriptSetupRanges.emits.define || scriptSetupRanges.defineProp.some(p => p.isModel)) {
		yield `	emits: ({} as __VLS_NormalizeEmits<typeof __VLS_modelEmitsType`;
		if (scriptSetupRanges.emits.define) {
			yield ` & typeof `;
			yield scriptSetupRanges.emits.name ?? '__VLS_emit';
		}
		yield `>),${newLine}`;
	}
	yield `})${endOfLine}`;
	yield `let __VLS_functionalComponentProps!: `;
	yield `${ctx.helperTypes.OmitKeepDiscriminatedUnion.name}<InstanceType<typeof __VLS_fnComponent>['$props'], keyof __VLS_BuiltInPublicProps>`;
	yield endOfLine;

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

	yield `type __VLS_PublicProps = `;
	if (scriptSetupRanges.slots.define && options.vueCompilerOptions.jsxSlots) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `${ctx.helperTypes.PropsChildren.name}<typeof __VLS_slots>`;
	}
	if (scriptSetupRanges.defineProp.length) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `{${newLine}`;
		for (const defineProp of scriptSetupRanges.defineProp) {
			let propName = 'modelValue';
			if (defineProp.name && defineProp.nameIsString) {
				// renaming support
				yield generateSfcBlockSection(scriptSetup, defineProp.name.start, defineProp.name.end, codeFeatures.navigation);
			}
			else if (defineProp.name) {
				propName = scriptSetup.content.substring(defineProp.name.start, defineProp.name.end);
				definePropMirrors.set(propName, options.getGeneratedLength());
				yield propName;
			}
			else {
				yield propName;
			}
			yield defineProp.required
				? `: `
				: `?: `;
			if (defineProp.type) {
				yield scriptSetup.content.substring(defineProp.type.start, defineProp.type.end);
			}
			else if (!defineProp.nameIsString) {
				yield `NonNullable<typeof ${propName}['value']>`;
			}
			else if (defineProp.defaultValue) {
				yield `typeof __VLS_defaults['${propName}']`;
			}
			else {
				yield `any`;
			}
			yield `,${newLine}`;

			if (defineProp.modifierType) {
				let propModifierName = 'modelModifiers';
				if (defineProp.name) {
					propModifierName = `${scriptSetup.content.substring(defineProp.name.start + 1, defineProp.name.end - 1)}Modifiers`;
				}
				const modifierType = scriptSetup.content.substring(defineProp.modifierType.start, defineProp.modifierType.end);
				definePropMirrors.set(propModifierName, options.getGeneratedLength());
				yield `${propModifierName}?: Record<${modifierType}, true>,${endOfLine}`;
			}
		}
		yield `}`;
	}
	if (scriptSetupRanges.props.define?.typeArg) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `typeof __VLS_typeProps`;
	}
	if (!ctx.generatedPropsType) {
		yield `{}`;
	}
	yield endOfLine;
}

function* generateModelEmits(
	options: ScriptCodegenOptions,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	yield `const __VLS_modelEmitsType = `;

	if (scriptSetupRanges.defineProp.filter(p => p.isModel).length) {
		yield `(await import('${options.vueCompilerOptions.lib}')).defineEmits<{${newLine}`;
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
		yield `}>()`;
	} else {
		yield `{}`;
	}
	yield endOfLine;
}
