import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { tester } from './utils/createTester';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import { CancellationToken } from 'vscode-languageserver-protocol';

const baseDir = path.resolve(__dirname, '../../vue-test-workspace/find-definition');
const testDirs = fs.readdirSync(baseDir);

for (const dirName of testDirs) {

	describe(`find definition: ${dirName}`, async () => {

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

				const targetFile = path.resolve(dir, action.targetFile);
				const targetRange = {
					start: document.positionAt(action.targeRange.start),
					end: document.positionAt(action.targeRange.end),
				};

				it(`${filePath}:${position.line + 1}:${position.character + 1} => ${targetFile}:${targetRange.start.line + 1}:${targetRange.start.character + 1}`, async () => {

					const locations = await tester.languageService.findDefinition(
						uri,
						position,
						CancellationToken.None,
					);

					expect(locations).toBeDefined();

					const location = locations?.find(loc =>
						loc.targetUri === tester.fileNameToUri(targetFile)
						&& loc.targetSelectionRange.start.line === targetRange.start.line
						&& loc.targetSelectionRange.start.character === targetRange.start.character
						&& loc.targetSelectionRange.end.line === targetRange.end.line
						&& loc.targetSelectionRange.end.character === targetRange.end.character
					);

					expect(location).toBeDefined();
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

function findActions(text: string) {

	return [...text.matchAll(/(\^*)definition:\s*([\S]*),\s*([\S]*),\s*([\S]*)/g)].map(flag => {

		const offset = flag.index!;
		const targetFile = flag[2];
		const targeRange = {
			start: Number(flag[3]),
			end: Number(flag[4]),
		};

		return {
			offset,
			targetFile,
			targeRange,
		};
	});
}
