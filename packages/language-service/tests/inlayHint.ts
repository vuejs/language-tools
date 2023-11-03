import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { tester } from './utils/createTester';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import { Range } from 'vscode-languageserver-protocol';

const baseDir = path.resolve(__dirname, '../../../test-workspace/language-service/inlay-hint');
const testDirs = fs.readdirSync(baseDir);

for (const dirName of testDirs) {

	describe(`inlay hint: ${dirName}`, async () => {

		const dir = path.join(baseDir, dirName);
		const inputFiles = readFiles(dir);

		for (const file in inputFiles) {

			const filePath = path.join(dir, file);
			const uri = tester.fileNameToUri(filePath);
			const fileText = inputFiles[file];
			const document = TextDocument.create('', '', 0, fileText);
			const actions = findActions(fileText);

			for (const action of actions) {

				const position = document.positionAt(action.offset);

				position.line--;

				const range = Range.create(position, { ...position, character: position.character + 1 });

				const location = `${filePath}:${position.line + 1}:${position.character + 1}`;

				it(`${location}`, async () => {

					const inlayHints = await tester.languageService.getInlayHints(
						uri,
						range,
					);

					const inlayHint = inlayHints?.find(inlayHint => inlayHint.label === action.label);

					expect(inlayHint).toBeDefined();
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

const inlayHintReg = /(\^*)inlayHint:\s*"(.+)"/g;

function findActions(text: string) {

	return [...text.matchAll(inlayHintReg)].map(flag => {

		const offset = flag.index!;
		const label = flag[2];

		return {
			offset,
			label
		};
	});
}
