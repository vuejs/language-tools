import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { tester } from './utils/createTester';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as vscode from 'vscode-languageserver-protocol';

const baseDir = path.resolve(__dirname, '../../vue-test-workspace/complete');
const testDirs = fs.readdirSync(baseDir);

for (const dirName of testDirs) {

	describe(`complete: ${dirName}`, async () => {

		const dir = path.join(baseDir, dirName);
		const inputFiles = readFiles(path.join(dir, 'input'));
		const outputFiles = readFiles(path.join(dir, 'output'));

		for (const file in inputFiles) {

			const filePath = path.join(dir, 'input', file);
			const uri = tester.fileNameToUri(filePath);
			const fileText = inputFiles[file];
			const document = TextDocument.create('', '', 0, fileText);
			const actions = findCompleteActions(fileText);

			for (const action of actions) {

				const position = document.positionAt(action.offset);

				position.line--;

				const location = `${filePath}:${position.line + 1}:${position.character + 1}`;

				it(`${location} => ${action.label}`, async () => {

					const complete = await tester.languageService.doComplete(
						uri,
						position,
					);

					expect(complete).toBeDefined();

					let item = complete.items.find(item => item.label === action.label)!;

					expect(item).toBeDefined();

					item = await tester.languageService.doCompletionResolve(item);

					const expectedFileText = outputFiles[file];

					expect(expectedFileText).toBeDefined();

					let edits: vscode.TextEdit[] = [];

					if (item.textEdit) {
						if (vscode.InsertReplaceEdit.is(item.textEdit)) {
							edits.push(vscode.TextEdit.replace(item.textEdit.replace, item.textEdit.newText));
						}
						else {
							edits.push(item.textEdit);
						}
					}
					else {
						edits.push(vscode.TextEdit.insert(position, item.insertText ?? item.label));
					}

					if (item.additionalTextEdits) {
						edits = edits.concat(item.additionalTextEdits);
					}

					const result = TextDocument.applyEdits(TextDocument.create('', '', 0, fileText), edits);

					expect(result.replace(/\r\n/g, '\n')).toBe(expectedFileText.replace(/\r\n/g, '\n'));
				});
			}
		}
	});
}

function readFiles(dir: string) {

	const filesText: Record<string, string> = {};
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		filesText[file] = fs.readFileSync(filePath, 'utf8');
	}

	return filesText;
}

function findCompleteActions(text: string) {

	return [...text.matchAll(/(\^*)complete:\s*([\S]*)/g)].map(flag => {

		const offset = flag.index!;
		const label = flag[2];

		return {
			offset,
			label,
		};
	});
}
