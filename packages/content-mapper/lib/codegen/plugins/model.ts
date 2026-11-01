import {
	getDefineModelPropName,
	getScriptLang,
	type IRScriptSetup,
	navigationFeatures,
	type ScriptSetupRanges,
	type TextRange,
} from '@vue/language-core';
import { names } from '../names';
import type { VueCodegenFile, VueCodegenFilePlugin } from '../plugin';
import { Boundary, synthesizedIgnore, type TsCode } from '../tsCode';
import { endOfLine, generateTypeAlias, generateTypedVar, isTsLang, newLine, typeAliasRef } from '../writers';
import { generateCamelized } from '../writers/camelized';

type DefineModel = ScriptSetupRanges['defineModel'][number];

/** The props and the emits of the models that `defineModel` declares, and the defaults of their props. */
export function createModelPlugin({ ir, analysis, name }: VueCodegenFile): VueCodegenFilePlugin<TsCode> {
	const defaultModels = name('defaultModels');
	const ModelProps = name('ModelProps');
	const ModelEmit = name('ModelEmit');
	const modelEmit = name('modelEmit');
	const getDefineModels = () => analysis.getScriptSetupRanges()?.defineModel ?? [];
	return {
		setupBody: () => {
			const defineModels = getDefineModels();
			return defineModels.length ? [[...generateModels(ir.scriptSetup!, defineModels)]] : [];
		},
		props: () => {
			const defineModels = getDefineModels();
			if (!defineModels.length) {
				return [];
			}
			return [{
				type: typeAliasRef(ModelProps, getScriptLang(ir)),
				defaults: defineModels.some(model => model.defaultValue) ? `typeof ${defaultModels}` : undefined,
			}];
		},
		emits: () => {
			if (!getDefineModels().length) {
				return [];
			}
			return [{ type: typeAliasRef(ModelEmit, getScriptLang(ir)), emit: `typeof ${modelEmit}` }];
		},
	};

	function* generateModels(scriptSetup: IRScriptSetup, defineModels: DefineModel[]): Generator<TsCode> {
		const scriptLang = getScriptLang(ir);
		const defaultCodes: string[] = [];
		const propCodes: Generator<TsCode>[] = [];
		const emitCodes: Generator<TsCode>[] = [];

		for (const defineModel of defineModels) {
			const propName = getDefineModelPropName(scriptSetup, defineModel);

			let modelType: string;
			if (defineModel.type) {
				// Infer from defineModel<T>
				modelType = getRangeText(scriptSetup, defineModel.type);
			}
			else if (defineModel.runtimeType && defineModel.localName) {
				// Infer from actual prop declaration code
				modelType = `typeof ${getRangeText(scriptSetup, defineModel.localName)}['value']`;
			}
			else if (defineModel.defaultValue && propName) {
				// Infer from defineModel({ default: T })
				modelType = `typeof ${defaultModels}['${propName}']`;
			}
			else {
				modelType = `any`;
			}

			if (defineModel.defaultValue) {
				defaultCodes.push(
					`'${propName}': ${getRangeText(scriptSetup, defineModel.defaultValue)},${newLine}`,
				);
			}

			propCodes.push(generateModelProp(scriptLang, scriptSetup, defineModel, propName, modelType));
			emitCodes.push(generateModelEmit(defineModel, propName, modelType));
		}

		if (defaultCodes.length) {
			yield `const ${defaultModels} = {${newLine}`;
			yield* defaultCodes;
			yield `}${endOfLine}`;
			yield `void ${defaultModels}${endOfLine}`;
		}

		yield* generateTypeAlias(ModelProps, scriptLang, function*() {
			yield `{${newLine}`;
			for (const codes of propCodes) {
				yield* codes;
			}
			yield `}`;
		});

		yield* generateTypeAlias(ModelEmit, scriptLang, function*() {
			yield `{${newLine}`;
			for (const codes of emitCodes) {
				yield* codes;
			}
			yield `}`;
		});

		// avoid `defineModel<...>()` to prevent JS AST issues
		yield* generateTypedVar('let', modelEmit, scriptLang, function*() {
			yield `${names.ShortEmits}<${typeAliasRef(ModelEmit, scriptLang)}>`;
		});
	}
}

function* generateModelProp(
	scriptLang: string,
	scriptSetup: IRScriptSetup,
	defineModel: DefineModel,
	propName: string,
	modelType: string,
): Generator<TsCode> {
	// In JS the alias body lives inside a JSDoc comment; user comments could
	// contain `*/` and terminate it early, so they are dropped.
	if (defineModel.comments && isTsLang(scriptLang)) {
		yield scriptSetup.content.slice(defineModel.comments.start, defineModel.comments.end);
		yield newLine;
	}

	if (defineModel.name) {
		const ignore = yield* Boundary.start(scriptSetup, 0, 0, synthesizedIgnore);
		yield* generateCamelized(
			getRangeText(scriptSetup, defineModel.name),
			scriptSetup,
			defineModel.name.start,
			{ features: navigationFeatures },
		);
		yield ignore.end();
	}
	else {
		yield propName;
	}

	yield defineModel.required ? `: ` : `?: `;
	yield modelType;
	yield endOfLine;

	if (defineModel.modifierType) {
		const modifierName = `${propName === 'modelValue' ? 'model' : propName}Modifiers`;
		const modifierType = getRangeText(scriptSetup, defineModel.modifierType);
		yield `'${modifierName}'?: Partial<Record<${modifierType}, true>>${endOfLine}`;
	}
}

function* generateModelEmit(defineModel: DefineModel, propName: string, modelType: string): Generator<TsCode> {
	yield `'update:${propName}': [value: `;
	yield modelType;
	if (!defineModel.required && !defineModel.defaultValue) {
		yield ` | undefined`;
	}
	yield `]${endOfLine}`;
}

function getRangeText(scriptSetup: IRScriptSetup, range: TextRange) {
	return scriptSetup.content.slice(range.start, range.end);
}
