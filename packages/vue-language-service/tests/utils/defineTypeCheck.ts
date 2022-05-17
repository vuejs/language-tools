import type * as vscode from 'vscode-languageserver-protocol';
import { beforeAll, describe, expect, it } from 'vitest';
import * as path from 'upath';
import { tester } from './createTester';
import * as shared from '@volar/shared';

const volarRoot = path.resolve(__dirname, '../../../..');

export function defineTypeCheck(fileName: string) {

	describe(`type check to ${path.relative(volarRoot, fileName)}`, () => {

		const uri = shared.fsPathToUri(fileName);
		const script = tester.host.getScriptSnapshot(fileName);

		let errors: vscode.Diagnostic[] | undefined;

		beforeAll(async () => {
			errors = await tester.languageService.doValidation(uri);
		});

		it(`should has script snapshot`, async () => {
			expect(!!script).toEqual(true);
		});

		it(`should has 0 errors`, async () => {
			if (errors?.length) {
				console.log(errors);
			}
			expect(errors?.length).toEqual(0);
		});
	});
}
