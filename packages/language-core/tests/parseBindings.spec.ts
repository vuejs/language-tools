import { expect, it } from 'vitest';
import { getDefaultCompilerOptions } from '../lib/options/compilerOptions';
import type { BindingFlag } from '../lib/script/scriptBindings';
import { parseScriptRanges } from '../lib/script/scriptRanges';
import { parseScriptSetupRanges } from '../lib/script/scriptSetupRanges';
import { ts } from './typescript';

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
