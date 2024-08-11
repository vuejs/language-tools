import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import type * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { tester } from './utils/createTester';
import { fileNameToUri } from './utils/mockEnv';

const baseDir = path.resolve(__dirname, '../../../test-workspace/language-service/complete');
const testDirs = fs.readdirSync(baseDir);
const getLineText = (text: string, line: number) => text.replace(/\r\n/g, '\n').split('\n')[line];

for (const dirName of testDirs) {

	describe(`complete: ${dirName}`, async () => {

		const dir = path.join(baseDir, dirName);
		const inputFiles = readFiles(path.join(dir, 'input'));
		const outputFiles = readFiles(path.join(dir, 'output'));

		for (const file in inputFiles) {

			const filePath = path.join(dir, 'input', file);
			const uri = fileNameToUri(filePath);
			const fileText = inputFiles[file];
			const document = TextDocument.create('', '', 0, fileText);
			const actions = findCompleteActions(fileText);

			const expectedFileText = outputFiles[file];

			for (const action of actions) {

				const position = document.positionAt(action.offset);

				position.line--;

				const location = `${filePath}:${position.line + 1}:${position.character + 1}`;

				it(`${location} => ${action.label}`, async () => {

					expect(expectedFileText).toBeDefined();

					let complete = await tester.languageService.getCompletionItems(
						uri,
						position,
						{ triggerKind: 1 satisfies typeof vscode.CompletionTriggerKind.Invoked },
					);

					if (!complete.items.length) {
						// fix #2511 test case, it's a bug of TS 5.3
						complete = await tester.languageService.getCompletionItems(
							uri,
							position,
							{ triggerKind: 1 satisfies typeof vscode.CompletionTriggerKind.Invoked },
						);
					}

					let item = complete.items.find(item => item.label === action.label)!;

					expect(item).toBeDefined();

					item = await tester.languageService.resolveCompletionItem(item);

					let edits: vscode.TextEdit[] = [];

					if (item.textEdit) {
						if ('replace' in item.textEdit) {
							edits.push({ range: item.textEdit.replace, newText: item.textEdit.newText });
						}
						else {
							edits.push(item.textEdit);
						}
					}
					else {
						edits.push({ range: { start: position, end: position }, newText: item.insertText ?? item.label });
					}

					if (item.additionalTextEdits) {
						edits = edits.concat(item.additionalTextEdits);
					}

					let result = TextDocument.applyEdits(TextDocument.create('', '', 0, fileText), edits);

					result = result.replace(/\$0/g, '').replace(/\$1/g, '');

					expect(getLineText(result, position.line)).toBe(getLineText(expectedFileText, position.line));
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
