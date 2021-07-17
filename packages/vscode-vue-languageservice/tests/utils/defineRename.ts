import type * as vscode from 'vscode-languageserver/node';
import * as path from 'upath';
import { createTester } from './createTester';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { fsPathToUri } from '@volar/shared';

const volarRoot = path.resolve(__dirname, '../../../..');
const testRoot = path.resolve(__dirname, '../../testCases');
const tester = createTester(testRoot);

export function defineRename(test: {
	fileName: string,
	actions: {
		position: vscode.Position,
		newName: string,
		length: number,
	}[],
	result: string,
}) {
	const fileName = test.fileName;
	const uri = fsPathToUri(fileName);
	const script = tester.host.getScriptSnapshot(fileName);

	describe(`renaming ${path.basename(fileName)}`, () => {

		it(`should ${path.basename(fileName)} exist`, () => {
			expect(!!script).toBe(true);
		});
		if (!script) return;

		const scriptText = script.getText(0, script.getLength());

		for (const action of test.actions) {
			for (let i = 0; i < action.length; i++) {
				const location = `${path.relative(volarRoot, fileName)}:${action.position.line + 1}:${action.position.character + i + 1}`;
				it(`rename ${location} => ${action.newName}`, async () => {
					const result = await tester.languageService.doRename(
						uri,
						{ line: action.position.line, character: action.position.character + i },
						action.newName,
					);

					const textEdits = result?.changes?.[uri];
					expect(!!textEdits).toEqual(true);
					if (!textEdits) return;

					const textResult = TextDocument.applyEdits(TextDocument.create('', '', 0, scriptText), textEdits);
					expect(textResult).toEqual(test.result);
				});
			}
		}
	});
}
