import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc, TextRange } from '../../types';
import { endOfLine, generateSfcBlockSection, newLine } from '../common';
import { generateComponent, generateEmitsOption } from './component';
import { generateComponentSelf } from './componentSelf';
import type { ScriptCodegenContext } from './context';
import { ScriptCodegenOptions, codeFeatures, generateScriptSectionPartiallyEnding } from './index';
import { generateTemplate } from './template';

export function* generateScriptSetupImports(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	yield [
		scriptSetup.content.substring(0, Math.max(scriptSetupRanges.importSectionEndOffset, scriptSetupRanges.leadingCommentEndOffset)),
		'scriptSetup',
		0,
		codeFeatures.all,
	];
	yield newLine;
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
			if (options.sfc.scriptSetup) {
				// #4569
				yield [
					'',
					'scriptSetup',
					options.sfc.scriptSetup.content.length,
					codeFeatures.verification,
				];
			}
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
			+ `	__VLS_props: NonNullable<Awaited<typeof __VLS_setup>>['props'],${newLine}`
			+ `	__VLS_ctx?: ${ctx.localTypes.PrettifyLocal}<Pick<NonNullable<Awaited<typeof __VLS_setup>>, 'attrs' | 'emit' | 'slots'>>,${newLine}` // use __VLS_Prettify for less dts code
			+ `	__VLS_expose?: NonNullable<Awaited<typeof __VLS_setup>>['expose'],${newLine}`
			+ `	__VLS_setup = (async () => {${newLine}`;
		yield* generateSetupFunction(options, ctx, scriptSetup, scriptSetupRanges, undefined, definePropMirrors);

		const emitTypes: string[] = [];

		if (scriptSetupRanges.emits.define) {
			emitTypes.push(`typeof ${scriptSetupRanges.emits.name ?? '__VLS_emit'}`);
		}
		if (scriptSetupRanges.defineProp.some(p => p.isModel)) {
			emitTypes.push(`typeof __VLS_modelEmit`);
		}

		yield `		return {} as {${newLine}`
			+ `			props: ${ctx.localTypes.PrettifyLocal}<typeof __VLS_functionalComponentProps & __VLS_TemplateResult['attrs'] & __VLS_PublicProps> & __VLS_BuiltInPublicProps,${newLine}`
			+ `			expose(exposed: import('${options.vueCompilerOptions.lib}').ShallowUnwrapRef<${scriptSetupRanges.expose.define ? 'typeof __VLS_exposed' : '{}'}>): void,${newLine}`
			+ `			attrs: any,${newLine}`
			+ `			slots: __VLS_TemplateResult['slots'],${newLine}`
			+ `			emit: ${emitTypes.length ? emitTypes.join(' & ') : `{}`},${newLine}`
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
			if (!defineProp.localName) {
				continue;
			}
			const [_, localName] = getPropAndLocalName(scriptSetup, defineProp);
			const propMirror = definePropMirrors.get(localName!);
			if (propMirror !== undefined) {
				options.linkedCodeMappings.push({
					sourceOffsets: [defineProp.localName.start + ctx.scriptSetupGeneratedOffset],
					generatedOffsets: [propMirror],
					lengths: [defineProp.localName.end - defineProp.localName.start],
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
	if (options.vueCompilerOptions.target >= 3.3) {
		yield `const { `;
		for (const macro of Object.keys(options.vueCompilerOptions.macros)) {
			if (!ctx.bindingNames.has(macro) && macro !== 'templateRef') {
				yield macro + `, `;
			}
		}
		yield `} = await import('${options.vueCompilerOptions.lib}')${endOfLine}`;
	}

	ctx.scriptSetupGeneratedOffset = options.getGeneratedLength() - scriptSetupRanges.importSectionEndOffset;

	let setupCodeModifies: [Code[], number, number][] = [];
	if (scriptSetupRanges.props.define) {
		setupCodeModifies.push(...generateDefineWithType(
			scriptSetup,
			scriptSetupRanges.props.name,
			scriptSetupRanges.props.define,
			scriptSetupRanges.props.withDefaults ?? scriptSetupRanges.props.define,
			'__VLS_props',
			'__VLS_Props'
		));
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
	if (scriptSetupRanges.emits.define) {
		setupCodeModifies.push(...generateDefineWithType(
			scriptSetup,
			scriptSetupRanges.emits.name,
			scriptSetupRanges.emits.define,
			scriptSetupRanges.emits.define,
			'__VLS_emit',
			'__VLS_Emit'
		));
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
	if (scriptSetupRanges.cssModules.length) {
		for (const { define } of scriptSetupRanges.cssModules) {
			setupCodeModifies.push([
				[`(`],
				define.start,
				define.start
			], [
				define.arg ? [
					` as Omit<__VLS_StyleModules, '$style'>[`,
					generateSfcBlockSection(scriptSetup, define.arg.start, define.arg.end, codeFeatures.all),
					`])`
				] : [
					` as __VLS_StyleModules[`,
					['', scriptSetup.name, define.exp.start, codeFeatures.verification],
					`'$style'`,
					['', scriptSetup.name, define.exp.end, codeFeatures.verification],
					`])`
				],
				define.end,
				define.end
			]);
		}
	}
	const isTs = options.lang !== 'js' && options.lang !== 'jsx';
	for (const { define } of scriptSetupRanges.templateRefs) {
		if (!define.arg) {
			continue;
		}
		if (isTs) {
			setupCodeModifies.push([
				[
					`<__VLS_TemplateResult['refs'][`,
					generateSfcBlockSection(scriptSetup, define.arg.start, define.arg.end, codeFeatures.navigation),
					`], keyof __VLS_TemplateResult['refs']>`
				],
				define.exp.end,
				define.exp.end
			]);
		}
		else {
			setupCodeModifies.push([
				[`(`],
				define.start,
				define.start
			], [
				[
					` as __VLS_UseTemplateRef<__VLS_TemplateResult['refs'][`,
					generateSfcBlockSection(scriptSetup, define.arg.start, define.arg.end, codeFeatures.navigation),
					`]>)`
				],
				define.end,
				define.end
			]);
		}
	}
	setupCodeModifies = setupCodeModifies.sort((a, b) => a[1] - b[1]);

	let nextStart = scriptSetupRanges.importSectionEndOffset;
	for (const [codes, start, end] of setupCodeModifies) {
		yield generateSfcBlockSection(scriptSetup, nextStart, start, codeFeatures.all);
		for (const code of codes) {
			yield code;
		}
		nextStart = end;
	}
	yield generateSfcBlockSection(scriptSetup, nextStart, scriptSetup.content.length, codeFeatures.all);

	yield* generateScriptSectionPartiallyEnding(scriptSetup.name, scriptSetup.content.length, '#3632/scriptSetup.vue');

	if (scriptSetupRanges.props.define?.typeArg && scriptSetupRanges.props.withDefaults?.arg) {
		// fix https://github.com/vuejs/language-tools/issues/1187
		yield `const __VLS_withDefaultsArg = (function <T>(t: T) { return t })(`;
		yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.props.withDefaults.arg.start, scriptSetupRanges.props.withDefaults.arg.end, codeFeatures.navigation);
		yield `)${endOfLine}`;
	}

	yield* generateComponentProps(options, ctx, scriptSetup, scriptSetupRanges, definePropMirrors);
	yield* generateModelEmit(scriptSetup, scriptSetupRanges);
	yield `function __VLS_template() {${newLine}`;
	const templateCodegenCtx = yield* generateTemplate(options, ctx);
	yield `}${endOfLine}`;
	yield* generateComponentSelf(options, ctx, templateCodegenCtx);
	yield `type __VLS_TemplateResult = ReturnType<typeof __VLS_template>${endOfLine}`;

	if (syntax) {
		if (!options.vueCompilerOptions.skipTemplateCodegen && (options.templateCodegen?.hasSlot || scriptSetupRanges?.slots.define)) {
			yield `const __VLS_component = `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
			yield `${syntax} `;
			yield `{} as ${ctx.localTypes.WithTemplateSlots}<typeof __VLS_component, __VLS_TemplateResult['slots']>${endOfLine}`;
		}
		else {
			yield `${syntax} `;
			yield* generateComponent(options, ctx, scriptSetup, scriptSetupRanges);
			yield endOfLine;
		}
	}
}

function* generateDefineWithType(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	name: string | undefined,
	define: {
		statement: TextRange;
		typeArg?: TextRange;
	},
	expression: TextRange,
	defaultName: string,
	typeName: string
): Generator<[Code[], number, number]> {
	const { statement, typeArg } = define;
	if (typeArg) {
		yield [[
			`type ${typeName} = `,
			generateSfcBlockSection(scriptSetup, typeArg.start, typeArg.end, codeFeatures.all),
			endOfLine,
		], statement.start, statement.start];
		yield [[typeName], typeArg.start, typeArg.end];
	}
	if (!name) {
		if (statement.start === expression.start && statement.end === expression.end) {
			yield [[`const ${defaultName} = `], expression.start, expression.start];
		}
		else if (typeArg) {
			yield [[
				`const ${defaultName} = `,
				generateSfcBlockSection(scriptSetup, expression.start, typeArg.start, codeFeatures.all)
			], statement.start, typeArg.start];
			yield [[
				generateSfcBlockSection(scriptSetup, typeArg.end, expression.end, codeFeatures.all),
				endOfLine,
				generateSfcBlockSection(scriptSetup, statement.start, expression.start, codeFeatures.all),
				defaultName
			], typeArg.end, expression.end];
		}
		else {
			yield [[
				`const ${defaultName} = `,
				generateSfcBlockSection(scriptSetup, expression.start, expression.end, codeFeatures.all),
				endOfLine,
				generateSfcBlockSection(scriptSetup, statement.start, expression.start, codeFeatures.all),
				defaultName
			], statement.start, expression.end];
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
	yield `const __VLS_fnComponent = (await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;

	if (scriptSetupRanges.props.define?.arg) {
		yield `props: `;
		yield generateSfcBlockSection(scriptSetup, scriptSetupRanges.props.define.arg.start, scriptSetupRanges.props.define.arg.end, codeFeatures.navigation);
		yield `,${newLine}`;
	}

	yield* generateEmitsOption(options, scriptSetupRanges);

	yield `})${endOfLine}`;

	yield `type __VLS_BuiltInPublicProps = ${options.vueCompilerOptions.target >= 3.4
		? `import('${options.vueCompilerOptions.lib}').PublicProps;`
		: options.vueCompilerOptions.target >= 3.0
			? `import('${options.vueCompilerOptions.lib}').VNodeProps
					& import('${options.vueCompilerOptions.lib}').AllowedComponentProps
					& import('${options.vueCompilerOptions.lib}').ComponentCustomProps;`
			: `globalThis.JSX.IntrinsicAttributes;`
		}`;
	yield endOfLine;

	yield `let __VLS_functionalComponentProps!: `;
	yield `${ctx.localTypes.OmitKeepDiscriminatedUnion}<InstanceType<typeof __VLS_fnComponent>['$props'], keyof __VLS_BuiltInPublicProps>`;
	yield endOfLine;

	if (scriptSetupRanges.defineProp.length) {
		yield `const __VLS_defaults = {${newLine}`;
		for (const defineProp of scriptSetupRanges.defineProp) {
			if (defineProp.defaultValue) {
				const [propName, localName] = getPropAndLocalName(scriptSetup, defineProp);

				if (defineProp.name || defineProp.isModel) {
					yield propName!;
				}
				else if (defineProp.localName) {
					yield localName!;
				}
				else {
					continue;
				}
				yield `: `;
				yield getRangeName(scriptSetup, defineProp.defaultValue);
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
		yield `${ctx.localTypes.PropsChildren}<typeof __VLS_slots>`;
	}
	if (scriptSetupRanges.defineProp.length) {
		if (ctx.generatedPropsType) {
			yield ` & `;
		}
		ctx.generatedPropsType = true;
		yield `{${newLine}`;
		for (const defineProp of scriptSetupRanges.defineProp) {
			const [propName, localName] = getPropAndLocalName(scriptSetup, defineProp);

			if (defineProp.isModel && !defineProp.name) {
				yield propName!;
			}
			else if (defineProp.name) {
				// renaming support
				yield generateSfcBlockSection(scriptSetup, defineProp.name.start, defineProp.name.end, codeFeatures.navigation);
			}
			else if (defineProp.localName) {
				definePropMirrors.set(localName!, options.getGeneratedLength());
				yield localName!;
			}
			else {
				continue;
			}

			yield defineProp.required
				? `: `
				: `?: `;
			yield* generateDefinePropType(scriptSetup, propName, localName, defineProp);
			yield `,${newLine}`;

			if (defineProp.modifierType) {
				let propModifierName = 'modelModifiers';
				if (defineProp.name) {
					propModifierName = `${getRangeName(scriptSetup, defineProp.name, true)}Modifiers`;
				}
				const modifierType = getRangeName(scriptSetup, defineProp.modifierType);
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
		yield `__VLS_Props`;
	}
	if (!ctx.generatedPropsType) {
		yield `{}`;
	}
	yield endOfLine;
}

function* generateModelEmit(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	const defineModels = scriptSetupRanges.defineProp.filter(p => p.isModel);
	if (defineModels.length) {
		yield `type __VLS_ModelEmit = {${newLine}`;
		for (const defineModel of defineModels) {
			const [propName, localName] = getPropAndLocalName(scriptSetup, defineModel);
			yield `'update:${propName}': [value:`;
			yield* generateDefinePropType(scriptSetup, propName, localName, defineModel);
			yield `]${endOfLine}`;
		}
		yield `}${endOfLine}`;
		yield `const __VLS_modelEmit = defineEmits<__VLS_ModelEmit>()${endOfLine}`;
	}
}

function* generateDefinePropType(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	propName: string | undefined,
	localName: string | undefined,
	defineProp: ScriptSetupRanges['defineProp'][number]
) {
	if (defineProp.type) {
		// Infer from defineProp<T>
		yield getRangeName(scriptSetup, defineProp.type);
	}
	else if (defineProp.runtimeType && localName) {
		// Infer from actual prop declaration code 
		yield `typeof ${localName}['value']`;
	}
	else if (defineProp.defaultValue && propName) {
		// Infer from defineProp({default: T})
		yield `typeof __VLS_defaults['${propName}']`;
	}
	else {
		yield `any`;
	}
}

function getPropAndLocalName(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	defineProp: ScriptSetupRanges['defineProp'][number]
) {
	const localName = defineProp.localName
		? getRangeName(scriptSetup, defineProp.localName)
		: undefined;
	let propName = defineProp.name
		? getRangeName(scriptSetup, defineProp.name)
		: defineProp.isModel
			? 'modelValue'
			: localName;
	if (defineProp.name) {
		propName = propName!.replace(/['"]+/g, '');
	}
	return [propName, localName];
}

function getRangeName(
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	range: TextRange,
	unwrap = false
) {
	const offset = unwrap ? 1 : 0;
	return scriptSetup.content.substring(range.start + offset, range.end - offset);
}