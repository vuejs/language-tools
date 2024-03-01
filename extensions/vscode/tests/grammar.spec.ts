import * as path from 'path';
import * as _fg from 'fast-glob';
import { describe, expect, it } from 'vitest';
import { createGrammarSnapshot } from 'vscode-tmlanguage-snapshot';

const fg: typeof _fg = (_fg as any).default;
const fixturesDir = path.resolve(__dirname, '../../../test-workspace/grammar');
const packageJsonPath = path.resolve(__dirname, '../package.json');

describe('grammar', async () => {
	const snapshot = await createGrammarSnapshot(packageJsonPath);
	const cases = await fg(path.join(fixturesDir, "**").replace(/\\/g, "/"));

	for (const kase of cases) {
		it(path.relative(fixturesDir, kase).replace(/\\/g, "/"), async () => {
			const result = await snapshot(kase);

			expect(result).toMatchSnapshot();
		});
	}
});
