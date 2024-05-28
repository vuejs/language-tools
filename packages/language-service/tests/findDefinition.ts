import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { tester } from './utils/createTester';
import { fileNameToUri } from './utils/mockEnv';

const baseDir = path.resolve(__dirname, '../../../test-workspace/language-service/find-definition');
const testDirs = fs.readdirSync(baseDir);

for (const dirName of testDirs) {

	describe(`find definition: ${dirName}`, async () => {

		const dir = path.join(baseDir, dirName);
		const inputFiles = readFiles(dir);

		for (const file in inputFiles) {

			const filePath = path.join(dir, file);
			const uri = fileNameToUri(filePath);
			const fileText = inputFiles[file];
			const document = TextDocument.create('', '', 0, fileText);
			const actions = findActions(fileText);

			for (const action of actions) {

				const position = document.positionAt(action.offset);

				position.line--;

				const targetFile = path.resolve(dir, action.targetFile);
				const targetDocument = TextDocument.create('', '', 0, fs.readFileSync(targetFile, 'utf8'));

				it(`${filePath}:${position.line + 1}:${position.character + 1} => ${targetFile}:${action.targeRange.start}`, async () => {

					const locations = await tester.languageService.findDefinition(
						uri,
						position,
					);

					expect(locations).toBeDefined();

					const location = locations?.find(loc =>
						loc.targetUri === fileNameToUri(targetFile).toString()
						&& targetDocument.offsetAt(loc.targetSelectionRange.start) === action.targeRange.start
						&& targetDocument.offsetAt(loc.targetSelectionRange.end) === action.targeRange.end
					);

					if (!location) {
						console.log(JSON.stringify(locations, null, 2));
						console.log(action.targeRange);
					}

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

const definitionReg = /(\^*)definition:\s*([\S]*),\s*([\S]*),\s*([\S]*)/g;

function findActions(text: string) {

	return [...text.matchAll(definitionReg)].map(flag => {

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
