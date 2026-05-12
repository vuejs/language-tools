import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createVueLanguagePlugin } from '../lib/languagePlugin.ts';

const vueCompilerOptions = {
	extensions: ['.vue'],
	vitePressExtensions: [],
	petiteVueExtensions: [],
	plugins: [],
} as any;

describe('createVueLanguagePlugin', () => {
	it('uses TypeScript script kind when Deferred is not available', () => {
		const tsWithoutDeferred = {
			...ts,
			ScriptKind: {
				...ts.ScriptKind,
			},
		};
		delete (tsWithoutDeferred.ScriptKind as any).Deferred;

		const plugin = createVueLanguagePlugin<string>(
			tsWithoutDeferred as typeof ts,
			{},
			vueCompilerOptions,
			fileName => fileName,
		);
		const extraFileExtensions = plugin.typescript?.extraFileExtensions;

		expect(extraFileExtensions).toMatchObject([
			{
				extension: 'vue',
				isMixedContent: true,
				scriptKind: ts.ScriptKind.TS,
			},
		]);
	});

	it('uses Deferred script kind when available', () => {
		const plugin = createVueLanguagePlugin<string>(ts, {}, vueCompilerOptions, fileName => fileName);
		const extraFileExtensions = plugin.typescript?.extraFileExtensions;

		expect(extraFileExtensions).toMatchObject([
			{
				extension: 'vue',
				isMixedContent: true,
				scriptKind: (ts.ScriptKind as any).Deferred,
			},
		]);
	});
});
