import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { tester } from './utils/createTester';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';

const baseDir = path.resolve(__dirname, '../../vue-test-workspace/rename');
const testDirs = fs.readdirSync(baseDir);
const renameRegex = /(\^*)rename:\s*([\S]*)/g;

for (const dirName of testDirs) {

	describe(`rename: ${dirName}`, async () => {

		const dir = path.join(baseDir, dirName);
		const inputFiles = readFiles(path.join(dir, 'input'));
		const outputFiles = readFiles(path.join(dir, 'output'));

		for (const file in inputFiles) {

			const filePath = path.join(dir, 'input', file);
			const uri = `file://${filePath}`;
			const fileText = inputFiles[file];
			const document = TextDocument.create(`file://${file}`, 'vue', 0, fileText);
			const actions = findRenameActions(fileText);

			for (const action of actions) {

				for (let offset = action.start; offset <= action.end; offset++) {

					const position = document.positionAt(offset);

					position.line--;

					const location = `${filePath}:${position.line + 1}:${position.character + 1}`;

					it(`${location} => ${action.newName}`, async () => {

						const edit = await tester.languageService.doRename(
							uri,
							position,
							action.newName,
						);

						expect(edit).toBeDefined();

						const tempFiles = { ...inputFiles };

						for (const uri in edit!.changes) {
							for (const file in tempFiles) {
								if (uri.endsWith(file)) {
									tempFiles[file] = TextDocument.applyEdits(TextDocument.create('', '', 0, tempFiles[file]), edit!.changes[uri]);
								}
							}
						}

						expect(Object.keys(tempFiles).length).toBe(Object.keys(outputFiles).length);

						for (const file in tempFiles) {
							expect(tempFiles[file]).toBe(outputFiles[file]);
						}
					});
				}
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

function findRenameActions(text: string) {

	return [...text.matchAll(renameRegex)].map(flag => {

		const start = flag.index!;
		const end = start + flag[1].length;
		const newName = flag[2];

		return {
			start,
			end,
			newName,
		};
	});
}
