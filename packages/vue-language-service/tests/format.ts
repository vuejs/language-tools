import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { tester } from './utils/createTester';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import * as fs from 'fs';

const baseDir = path.resolve(__dirname, '../../vue-test-workspace/format');
const testDirs = fs.readdirSync(baseDir);

for (const dirName of testDirs) {

	describe(`format: ${dirName}`, async () => {

		const dir = path.join(baseDir, dirName);
		const inputFileName = path.join(dir, 'input.vue');
		const outputFileName = path.join(dir, 'output.vue');
		const input = fs.readFileSync(inputFileName, 'utf8');
		const output = fs.readFileSync(outputFileName, 'utf8');
		const document = TextDocument.create(shared.fileNameToUri(inputFileName), 'vue', 0, input);

		it(`format`, async () => {

			const edit = await tester.languageService.format(
				document.uri,
				{ insertSpaces: false, tabSize: 4 },
			);

			expect(edit).toBeDefined();

			const newText = TextDocument.applyEdits(document, edit!);

			expect(newText).toBe(output);
		});
	});
}
