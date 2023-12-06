import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { tester } from './utils/createTester';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';

const baseDir = path.resolve(__dirname, '../../../test-workspace/language-service/reference');
const testDirs = fs.readdirSync(baseDir);

for (const dirName of testDirs) {

	describe(`find reference: ${dirName}`, async () => {

		const dir = path.join(baseDir, dirName);
		const inputFiles = readFiles(dir);

		for (const file in inputFiles) {

			const filePath = path.join(dir, file);
			const uri = tester.serviceEnv.fileNameToUri(filePath);
			const fileText = inputFiles[file];
			const document = TextDocument.create('', '', 0, fileText);
			const actions = findActions(fileText);

			for (const action of actions) {

				const position = document.positionAt(action.offset);

				position.line--;

				const location = `${filePath}:${position.line + 1}:${position.character + 1}`;

				it(`${location} => count: ${action.count}`, async () => {

					const locations = await tester.languageService.findReferences(
						uri,
						position,
					);

					expect(locations).toBeDefined();

					expect(locations?.length).toBe(action.count);
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

const referenceReg = /(\^*)reference:\s*([\S]*)/g;

function findActions(text: string) {

	return [...text.matchAll(referenceReg)].map(flag => {

		const offset = flag.index!;
		// The definition itself is also counted
		const count = Number(flag[2]) + 1;

		return {
			offset,
			count,
		};
	});
}
