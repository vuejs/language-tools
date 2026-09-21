import { expect, test } from 'vitest';
import { OptionDiagnosticCode, toOptionDiagnostics } from '../optionDiagnostics';

test('accepts every documented option', () => {
	expect(toOptionDiagnostics(undefined)).toEqual([]);
	expect(toOptionDiagnostics({})).toEqual([]);
	expect(toOptionDiagnostics({
		languageFeatures: false,
		target: 'auto',
		lib: 'vue',
		typesRoot: 'types',
		extensions: ['.vue'],
		jsxSlots: true,
		resolveStyleClassNames: 'scoped',
		optionsWrapper: ['a', 'b'],
		dataAttributes: ['data-*'],
		macros: { defineProps: ['defineProps'] },
		plugins: ['@vue/plugin', { name: '@vue/plugin2', custom: 1 }],
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
});

test('reports unknown options and the removed vueCompilerOptions wrapper', () => {
	expect(toOptionDiagnostics({ unknownOption: 1 })).toEqual([{
		path: ['unknownOption'],
		messageText: `Unknown option 'unknownOption'.`,
		code: OptionDiagnosticCode.UnknownOption,
	}]);
	expect(toOptionDiagnostics({ vueCompilerOptions: { target: 3.5 } })).toEqual([{
		path: ['vueCompilerOptions'],
		messageText:
			`Options are flattened in v4: pass them directly under the mapper's \`options\` instead of nesting them in \`vueCompilerOptions\`.`,
		code: OptionDiagnosticCode.UnknownOption,
	}]);
});

test('reports invalid option values with their path', () => {
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
