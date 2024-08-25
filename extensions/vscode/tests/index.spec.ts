import { describe, expect, test } from 'vitest';

describe('vscode', () => {
	test.skip('vscode versions should be consistent ', () => {

		const languageClientVersion = require('vscode-languageclient/package.json').engines.vscode;
		const typesVersion = require('../package.json').devDependencies['@types/vscode'];
		const enginesVersion = require('../package.json').engines.vscode;

		expect(typesVersion).toBe(languageClientVersion);
		expect(enginesVersion).toBe(languageClientVersion);
	});
});
