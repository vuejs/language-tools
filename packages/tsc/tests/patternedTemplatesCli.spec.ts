import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';

function check(arms: string) {
	const directory = fs.mkdtempSync(path.resolve(__dirname, '../../../test-workspace/.patterned-cli-'));
	try {
		fs.writeFileSync(
			path.join(directory, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: {
					strict: true,
					noEmit: true,
					skipLibCheck: true,
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'Bundler',
					types: [],
				},
				include: ['*.vue'],
			}),
		);
		fs.writeFileSync(
			path.join(directory, 'App.vue'),
			`<script setup lang="ts">defineProps<{ subject: 'a' | 'b' }>()</script><template><template v-match="subject">${arms}</template></template>`,
		);
		return spawnSync(process.execPath, [
			path.resolve(__dirname, '../bin/vue-tsc.js'),
			'--noEmit',
			'--pretty',
			'false',
			'-p',
			directory,
		], { encoding: 'utf8' });
	}
	finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
}

test('vue-tsc --noEmit fails on missing coverage with a source diagnostic', () => {
	const result = check(`<i v-when="'a'"/>`);
	expect(result.status).toBe(2);
	expect(result.stdout).toContain('App.vue(');
	expect(result.stdout).toContain('Non-exhaustive v-match');
	expect(result.stdout.replaceAll('\\"', '"')).toContain(`v-when="'b'"`);
});

test('vue-tsc reports unreachable arms as warnings without failing', () => {
	const result = check(`<i v-when="'a'"/><i v-when="'a'"/><i v-when="'b'"/>`);
	expect(result.status, result.stdout + result.stderr).toBe(0);
	expect(result.stdout.match(/warning V_MATCH_UNREACHABLE/g)).toHaveLength(1);
});

test('vue-tsc fails on invalid pattern syntax even with a catch-all', () => {
	const result = check(`<i v-when="let value"/><i v-when="_"/>`);
	expect(result.status).toBe(2);
	expect(result.stdout).toContain('Only const pattern bindings');
});
