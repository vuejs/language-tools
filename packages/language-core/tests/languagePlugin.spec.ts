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
	it('uses TypeScript script kind for extra vue file extensions', () => {
		const plugin = createVueLanguagePlugin<string>(ts, {}, vueCompilerOptions, fileName => fileName);
		const extraFileExtensions = plugin.typescript?.extraFileExtensions;

		expect(extraFileExtensions).toMatchObject([
			{
				extension: 'vue',
				isMixedContent: true,
				scriptKind: ts.ScriptKind.TS,
			},
		]);
	});
});
