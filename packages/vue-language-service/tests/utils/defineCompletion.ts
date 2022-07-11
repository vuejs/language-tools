import type * as vscode from 'vscode-languageserver-protocol';
import { describe, expect, it } from 'vitest';
import * as path from 'upath';
import { tester } from './createTester';
import * as shared from '@volar/shared';

const volarRoot = path.resolve(__dirname, '../../../..');

export function defineCompletion(action: {
	fileName: string,
	position: vscode.Position,
}, expectedResults: string[]) {

	const fileName = action.fileName;
	const uri = shared.fsPathToUri(fileName);
	const location = `${path.relative(volarRoot, fileName)}:${action.position.line + 1}:${action.position.character + 1}`;

	describe(`complete ${path.basename(fileName)} ${location}`, async () => {
		const result = await tester.languageService.doComplete(
			uri,
			{ line: action.position.line, character: action.position.character },
		);
		for (const expectedResult of expectedResults) {
			it(`has ${expectedResult}`, () => {
				expect(result.items.some(item => item.label === expectedResult)).toEqual(true);
			});
		}
	});
}
