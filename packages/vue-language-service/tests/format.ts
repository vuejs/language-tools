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
		const inputFileName = fs.existsSync(path.join(dir, 'input.vue')) ? path.join(dir, 'input.vue') : path.join(dir, 'input.ts');
		const outputFileName = fs.existsSync(path.join(dir, 'output.vue')) ? path.join(dir, 'output.vue') : path.join(dir, 'output.ts');
		const input = fs.readFileSync(inputFileName, 'utf8');
		const output = fs.readFileSync(outputFileName, 'utf8');
		const document = TextDocument.create(shared.fileNameToUri(inputFileName), 'vue', 0, input);
		const vscodeSettings = fs.existsSync(path.join(dir, 'settings.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')) : undefined;

		it(`format`, async () => {

			tester.setVSCodeSettings(vscodeSettings);

			const edit = await tester.languageService.format(
				document.uri,
				{ insertSpaces: false, tabSize: 4 },
			);

			tester.setVSCodeSettings();

			const newText = TextDocument.applyEdits(document, edit ?? []);

			expect(newText.replace(/\r\n/g, '\n')).toBe(output.replace(/\r\n/g, '\n'));
		});
	});
}
