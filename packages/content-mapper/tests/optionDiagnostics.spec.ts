import { expect, test } from 'vitest';
import { OptionDiagnosticCode, toOptionDiagnostics } from '../optionDiagnostics';

test('accepts every documented option', () => {
	expect(toOptionDiagnostics(undefined)).toEqual([]);
	expect(toOptionDiagnostics({})).toEqual([]);
	expect(toOptionDiagnostics({ format: 'petite-vue' })).toEqual([]);
	expect(toOptionDiagnostics({
		languageFeatures: false,
		format: 'vitepress',
		target: 'auto',
		lib: 'vue',
		typesRoot: 'types',
		jsxSlots: true,
		resolveStyleClassNames: 'scoped',
		optionsWrapper: ['a', 'b'],
		dataAttributes: ['data-*'],
		macros: { defineProps: ['defineProps'] },
		plugins: ['@vue/plugin', { name: '@vue/plugin2', custom: 1 }],
		vModelPropName: { 'my-input': 'value', 'f-radio-field': false },
	})).toEqual([]);
});

test('reports options removed in v4 with a migration hint', () => {
	const diagnostics = toOptionDiagnostics({ strictTemplates: true, checkUnknownComponents: false });
	expect(diagnostics).toHaveLength(2);
	expect(diagnostics[0]).toMatchObject({
		path: ['strictTemplates'],
		code: OptionDiagnosticCode.RemovedOption,
	});
	expect(diagnostics[0]!.messageText).toContain(`Option 'strictTemplates' was removed in v4.`);
	expect(diagnostics[1]!.messageText).toContain('GlobalComponents');
	expect(toOptionDiagnostics({ resolveStyleImports: true })).toMatchObject([{
		path: ['resolveStyleImports'],
		code: OptionDiagnosticCode.RemovedOption,
	}]);
	expect(toOptionDiagnostics({ skipTemplateCodegen: true })).toMatchObject([{
		path: ['skipTemplateCodegen'],
		code: OptionDiagnosticCode.RemovedOption,
	}]);
});

const droppedEmptyKeys =
	`TypeScript 7 drops \`""\` keys from these options, so entries under \`""\` are missing; add them as \`false\`.`;

test('converts experimentalModelPropName to vModelPropName in its migration hint', () => {
	expect(toOptionDiagnostics({
		experimentalModelPropName: {
			value: { input: { type: 'text' }, textarea: true, select: true, 'c2-input': true },
			checked: { 'c2-switch': true, 'c2-toggle': [{ type: 'checkbox' }] },
		},
	})).toEqual([{
		path: ['experimentalModelPropName'],
		messageText: `Option 'experimentalModelPropName' was removed in v4. Use \`vModelPropName\`, which maps each tag `
			+ `to the prop its \`v-model\` binds or \`false\` for none: {"c2-input":"value","c2-switch":"checked"}. `
			+ `Attribute conditions are not supported, so these tags need an entry of their own: 'c2-toggle'. `
			+ droppedEmptyKeys,
		code: OptionDiagnosticCode.RemovedOption,
	}]);
});

test('reports the prop-keyed shape and invalid entries of vModelPropName', () => {
	expect(toOptionDiagnostics({ vModelPropName: { 'input-value': { 'v-checkbox': true } } })).toEqual([{
		path: ['vModelPropName'],
		messageText: `Option 'vModelPropName' maps each tag to the prop its \`v-model\` binds or \`false\` for none: `
			+ `{"v-checkbox":"input-value"}. ${droppedEmptyKeys}`,
		code: OptionDiagnosticCode.InvalidOptionType,
	}]);
	expect(toOptionDiagnostics({ vModelPropName: { a: true, b: 1, c: 'value', d: false } })).toEqual(
		['a', 'b'].map(tag => ({
			path: ['vModelPropName', tag],
			messageText: `Option 'vModelPropName' entries require a prop name or \`false\`.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		})),
	);
	expect(toOptionDiagnostics({ vModelPropName: [] })).toEqual([{
		path: ['vModelPropName'],
		messageText: `Option 'vModelPropName' requires an object.`,
		code: OptionDiagnosticCode.InvalidOptionType,
	}]);
});

test('reports unknown options and the removed vueCompilerOptions wrapper', () => {
	expect(toOptionDiagnostics({ unknownOption: 1 })).toEqual([{
		path: ['unknownOption'],
		messageText: `Unknown option 'unknownOption'.`,
		code: OptionDiagnosticCode.UnknownOption,
	}]);
	expect(toOptionDiagnostics({ isDataAttribute: true, globalTemplateContext: true }).map(diagnostic => diagnostic.code))
		.toEqual([
			OptionDiagnosticCode.UnknownOption,
			OptionDiagnosticCode.UnknownOption,
		]);
	expect(toOptionDiagnostics({ vueCompilerOptions: { target: 3.5 } })).toEqual([{
		path: ['vueCompilerOptions'],
		messageText:
			`Options are flattened in v4: pass them directly under the mapper's \`options\` instead of nesting them in \`vueCompilerOptions\`.`,
		code: OptionDiagnosticCode.UnknownOption,
	}]);
});

test('reports invalid option values with their path', () => {
	expect(toOptionDiagnostics({ format: 1 })).toEqual([{
		path: ['format'],
		messageText: `Option 'format' requires 'sfc', 'vitepress', 'petite-vue' or a format of a plugin.`,
		code: OptionDiagnosticCode.InvalidOptionType,
	}]);
	expect(toOptionDiagnostics({
		target: '3.5',
		resolveStyleClassNames: 1,
		jsxSlots: 'yes',
		dataAttributes: 'data-*',
		macros: [],
		optionsWrapper: ['a', 1],
		plugins: [{ name: 5 }, 'ok', 1],
	})).toEqual([
		{
			path: ['target'],
			messageText: `Option 'target' requires a number or 'auto'.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
		{
			path: ['resolveStyleClassNames'],
			messageText: `Option 'resolveStyleClassNames' requires a boolean or 'scoped'.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
		{
			path: ['jsxSlots'],
			messageText: `Option 'jsxSlots' requires a boolean.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
		{
			path: ['dataAttributes'],
			messageText: `Option 'dataAttributes' requires an array.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
		{
			path: ['macros'],
			messageText: `Option 'macros' requires an object.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
		{
			path: ['optionsWrapper'],
			messageText: `Option 'optionsWrapper' requires an array of strings.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
		{
			path: ['plugins', 0, 'name'],
			messageText: `Option 'name' requires a string.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
		{
			path: ['plugins', 2],
			messageText: `Option 'plugins' entries require a string or an object.`,
			code: OptionDiagnosticCode.InvalidOptionType,
		},
	]);
});
