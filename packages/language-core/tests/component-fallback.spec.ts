import * as path from 'node:path';
import * as ts from 'typescript';
import { expect, test } from 'vitest';

test.each([false, true])('component fallback preserves known types (strict=%s)', strict => {
	const file = path.resolve(__dirname, 'component-fallback.ts');
	const helpers = path.resolve(__dirname, '../types/template-helpers.d.ts');
	const directive = strict ? '' : '// @ts-ignore';
	const source = `
		export {};
		type Local = { LocalChild: { count: number } };
		type Global = { GlobalChild: { count: number } };
		type Self = { count: number };
		type LocalMatch = __VLS_WithComponent<'local-child', Local, Global, void, 'LocalChild'>['local-child'];
		type GlobalMatch = __VLS_WithComponent<'global-child', Local, Global, void, 'GlobalChild'>['global-child'];
		type SelfMatch = __VLS_WithComponent<'Self', Local, Global, Self, 'Self'>['Self'];
		${directive}
		type UnknownMatch = __VLS_WithComponent<'Unknown', Local, Global, void, 'Unknown'>['Unknown'];
		const local: LocalMatch = { count: 'wrong' };
		const global: GlobalMatch = { count: 'wrong' };
		const self: SelfMatch = { count: 'wrong' };
	`;
	const options: ts.CompilerOptions = { strict: true, noEmit: true, skipLibCheck: true };
	const host = ts.createCompilerHost(options);
	const getSourceFile = host.getSourceFile;
	host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => path.resolve(name) === file
		? ts.createSourceFile(name, source, languageVersion, true)
		: getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
	const program = ts.createProgram([file, helpers], options, host);
	const codes = ts.getPreEmitDiagnostics(program).map(diagnostic => diagnostic.code).sort();
	expect(codes).toEqual(strict ? [2322, 2322, 2322, 2339] : [2322, 2322, 2322]);
});
