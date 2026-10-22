import * as ts from 'typescript';
import { expect, it } from 'vitest';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { parseScriptRanges } from '../lib/parsers/scriptRanges';
import { parseScriptSetupRanges } from '../lib/parsers/scriptSetupRanges';
import type { BindingFlag } from '../lib/parsers/utils';

it('binds imports the same way whatever they are imported from', () => {
	const sourceFile = ts.createSourceFile(
		'App.vue.ts',
		`import Foo from './Foo.vue';\nimport Doc from './Doc.vue.md';\nimport { default as Page } from './Page.html';`,
		ts.ScriptTarget.Latest,
	);
	for (
		const { bindings } of [
			parseScriptRanges(ts, sourceFile),
			parseScriptSetupRanges(ts, sourceFile, getDefaultCompilerOptions()),
		]
	) {
		expect(Object.fromEntries(bindings)).toEqual({
			Foo: 1 satisfies BindingFlag.Variable,
			Doc: 1 satisfies BindingFlag.Variable,
			Page: 1 satisfies BindingFlag.Variable,
		});
	}
});
