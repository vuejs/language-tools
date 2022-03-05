import type * as vscode from 'vscode-languageserver-protocol';
import * as path from 'upath';
import { createTester } from './createTester';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';

const volarRoot = path.resolve(__dirname, '../../../..');
const testRoot = path.resolve(__dirname, '../../testCases');
const tester = createTester(testRoot);

export function defineTypeCheck(fileName: string, expectErrors: {
	start: number,
	end: number,
	source: string,
	code: number,
}[]) {

	describe(`type check to ${path.relative(volarRoot, fileName)}`, () => {

		const uri = shared.fsPathToUri(fileName);
		const script = tester.host.getScriptSnapshot(fileName);

		let errors: vscode.Diagnostic[] | undefined;

		beforeAll(async () => {
			errors = await tester.languageService.doValidation(uri);
		});

		it(`should has script snapshot`, async () => {
			expect(!!script).toEqual(true);
		});

		it(`should has ${expectErrors.length} errors`, async () => {
			const errors = await tester.languageService.doValidation(uri);
			expect(errors?.length).toEqual(expectErrors.length);
		});

		if (script) {

			const doc = TextDocument.create('', '', 0, script.getText(0, script.getLength()));

			for (const expectError of expectErrors) {

				const pos = doc.positionAt(expectError.start);

				it(`should report ${expectError.source}(${expectError.code}) at ${path.relative(volarRoot, fileName)}:${pos.line + 1}:${pos.character + 1}`, () => {
					expect(errors?.some(error => {

						const start = doc.offsetAt(error.range.start);
						const end = doc.offsetAt(error.range.end);

						return expectError.start === start
							&& expectError.end === end
							&& expectError.source === error.source
							&& expectError.code === error.code

					})).toEqual(true);
				});
			}
		}
	});
}
