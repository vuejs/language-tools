import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot, runTsc, supportsRunExternalCode } from './utils';

test.skipIf(!supportsRunExternalCode())('content mapper declaration emit', () => {
	const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-content-mapper-dts-'));
	try {
		const result = runTsc([
			'-p',
			path.join(repositoryRoot, 'test-workspace/component-meta/tsconfig.json'),
			'--runExternalCode',
			'--pretty',
			'false',
			'--emitDeclarationOnly',
			'--noEmit',
			'false',
			'--outDir',
			outDir,
		]);
		expect(result.status, result.stdout + result.stderr).toBe(0);

		const outputs = readFilesRecursive(outDir)
			.map(file => path.relative(outDir, file).replaceAll('\\', '/'))
			.sort();
		expect(outputs).toMatchSnapshot('declaration output files');

		for (const file of outputs) {
			expect(fs.readFileSync(path.join(outDir, file), 'utf8')).toMatchSnapshot(file);
		}
	}
	finally {
		fs.rmSync(outDir, { recursive: true, force: true });
	}
});

function readFilesRecursive(dir: string): string[] {
	const result: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const filepath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			result.push(...readFilesRecursive(filepath));
		}
		else {
			result.push(filepath);
		}
	}
	return result;
}
