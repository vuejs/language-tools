import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from 'vitest';

test('a --tsdk without the TypeScript 5/6 API stops the server with a hint', () => {
	// What `require('typescript')` gives in a TypeScript 7 project
	const tsdk = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-tsdk-'));
	fs.writeFileSync(path.join(tsdk, 'typescript.js'), `module.exports = { version: '7.1.0-beta' };`);
	try {
		const result = spawnSync(process.execPath, [require.resolve('../index.js'), '--stdio', `--tsdk=${tsdk}`], {
			encoding: 'utf8',
			timeout: 30_000,
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('(7.1.0-beta)');
		expect(result.stderr).toContain('--tsdk=');
	}
	finally {
		fs.rmSync(tsdk, { recursive: true, force: true });
	}
});
