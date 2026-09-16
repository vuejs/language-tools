import * as path from 'node:path';
import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { names } from '../lib/codegen/names';
import { generateScript } from '../lib/codegen/script';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';

test('pattern declarations typecheck with library checking enabled', () => {
	const program = ts.createProgram({
		rootNames: [path.resolve(__dirname, 'fixtures/pattern-matching.ts')],
		options: {
			strict: true,
			noEmit: true,
			skipLibCheck: false,
			types: [],
			lib: ['lib.es2022.d.ts'],
			target: ts.ScriptTarget.ESNext,
		},
	});
	expect(
		ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
	)
		.toEqual([]);
});

test.each([false, true])('pattern declarations are referenced only when used: %s', used => {
	const { codes } = generateScript({
		vueCompilerOptions: getDefaultCompilerOptions(),
		fileName: '/project/App.vue',
		script: undefined,
		scriptSetup: undefined,
		scriptRanges: undefined,
		scriptSetupRanges: undefined,
		templateAndStyleTypes: new Set(used ? [names.MatchPattern] : []),
		templateAndStyleCodes: [],
		exposed: new Set(),
	});
	const code = codes.map(code => typeof code === 'string' ? code : code[0]).join('');
	expect(code.match(/pattern-matching\.d\.ts/g) ?? []).toHaveLength(used ? 1 : 0);
	expect(code).not.toContain('type __VLS_MatchPattern');
	expect(code).not.toContain('type SubtractObject');
});
