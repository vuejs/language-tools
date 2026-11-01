import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type Plugin, rolldown } from 'rolldown';
import { expect, test } from 'vitest';
import config from '../rolldown.config';

const repositoryRoot = path.resolve(__dirname, '../../..');
const testWorkspacePath = path.join(repositoryRoot, 'test-workspace');

test('the bundled Content Mapper parses with the TS 7.1 of the project', async () => {
	// The bundle runs from the `dist` directory of the extension, under its manifest.
	const extensionDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'vue-bundle-'));
	try {
		fs.copyFileSync(path.resolve(__dirname, '../package.json'), path.join(extensionDir, 'package.json'));
		const entry = path.join(extensionDir, 'entry.ts');
		fs.writeFileSync(
			entry,
			`import { vueContentMapper } from ${
				JSON.stringify(path.join(repositoryRoot, 'packages/content-mapper/lib/mapper/vueContentMapper.ts'))
			};
vueContentMapper.openProject({
	configFileName: ${JSON.stringify(path.join(testWorkspacePath, 'tsconfigProject/tsconfig.json'))},
	projectHandle: 'project',
	compilerOptions: {},
});
const { text } = vueContentMapper.transform({
	fileName: 'a.vue',
	content: '<script setup lang="ts">const count = 1;</script>',
	projectHandle: 'project',
});
console.log(text.includes('const count = 1;'));
process.exit(0);`,
		);
		const bundle = await rolldown({
			input: entry,
			external: config.external,
			plugins: (config.plugins as Plugin[]).filter(plugin => plugin.name !== 'clean' && plugin.name !== 'copy-types'),
			logLevel: 'silent',
		});
		const output = path.join(extensionDir, 'dist', 'entry.js');
		await bundle.write({ file: output, format: 'cjs' });
		await bundle.close();

		const result = spawnSync(process.execPath, [output], { encoding: 'utf8', timeout: 30_000 });
		expect(result.stderr).toBe('');
		expect(result.stdout.trim()).toBe('true');
	}
	finally {
		fs.rmSync(extensionDir, { recursive: true, force: true });
	}
});
