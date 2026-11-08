import { getDefaultCompilerOptions, type Language } from '@vue/language-core';
import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { resolveCompletionResult, type VueCompletionData } from '../lib/common';

/**
 * Builds the completion entry TypeScript produces for an import statement completion,
 * where the whole statement is written into `insertText`.
 */
function resolveImportStatementEntry(name: string, fileName: string) {
	const result: ts.CompletionInfo = {
		isGlobalCompletion: true,
		isMemberCompletion: false,
		isNewIdentifierLocation: true,
		entries: [{
			name,
			kind: ts.ScriptElementKind.alias,
			kindModifiers: 'export',
			sortText: '16',
			source: `./${fileName}`,
			isSnippet: true,
			insertText: `import ${name}$1 from './${fileName}';`,
			data: {
				exportName: 'default',
				moduleSpecifier: `./${fileName}`,
				fileName: `/${fileName}`,
			},
		}],
	};

	resolveCompletionResult(
		ts,
		{ scripts: { get: () => undefined } } as unknown as Language<string>,
		fileName => fileName,
		getDefaultCompilerOptions(),
		'/fixture.vue',
		0,
		result,
	);

	return result.entries[0]!;
}

test('#6283', () => {
	const entry = resolveImportStatementEntry('someComponentVue', 'some-component.vue');

	expect(entry.name).toBe('SomeComponent');
	expect(entry.insertText).toBe(`import SomeComponent$1 from './some-component.vue';`);
	expect((entry.data as VueCompletionData)?.__vue__componentAutoImport).toEqual({
		oldName: 'someComponentVue',
		newName: 'SomeComponent',
	});
});

test('#2286', () => {
	const entry = resolveImportStatementEntry('LogoBaseVue', 'LogoBase.vue');

	expect(entry.name).toBe('LogoBase');
	expect(entry.insertText).toBe(`import LogoBase$1 from './LogoBase.vue';`);
});
