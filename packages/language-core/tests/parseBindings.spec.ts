import * as ts from 'typescript';
import { expect, it } from 'vitest';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { parseScriptRanges } from '../lib/parsers/scriptRanges';
import { parseScriptSetupRanges } from '../lib/parsers/scriptSetupRanges';
import type { BindingFlag } from '../lib/parsers/utils';

it('only treats default imports of sfc-format extensions as components', () => {
	const vueCompilerOptions = getDefaultCompilerOptions();
	vueCompilerOptions.extensionFormats = { '.vue': 'sfc', '.vue.md': 'vitepress', '.html': 'petite-vue' };
	const sourceFile = ts.createSourceFile(
		'App.vue.ts',
		`import Foo from './Foo.vue';\nimport Doc from './Doc.vue.md';\nimport Page from './Page.html';`,
		ts.ScriptTarget.Latest,
	);
	for (
		const { bindings } of [
			parseScriptRanges(ts, sourceFile, vueCompilerOptions),
			parseScriptSetupRanges(ts, sourceFile, vueCompilerOptions),
		]
	) {
		expect(bindings.get('Foo')! & (4 satisfies BindingFlag.Component)).toBeTruthy();
		expect(bindings.get('Doc')! & (4 satisfies BindingFlag.Component)).toBeFalsy();
		expect(bindings.get('Page')! & (4 satisfies BindingFlag.Component)).toBeFalsy();
	}
});
