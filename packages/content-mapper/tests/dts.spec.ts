import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot, runTsc } from './utils';

defineDtsEmitTests('component-meta', ['**/*.tsx']);
defineDtsEmitTests('dts/jsx-slots');
defineDtsEmitTests('dts/js-script-setup', [], emitted => {
	// the codegen of a JS component declares only what its `lang="ts"` twin declares
	expect(emitted.get('runtime-props.d.vue.ts')).toBe(emitted.get('runtime-props-ts.d.vue.ts'));
});
defineDtsEmitTests('content-mapper-codegen/dts', [], emitted => {
	// the doc comment that the codegen plugin copies onto the export of the component
	expect(emitted.get('DocComment.d.vue.ts'))
		.toMatch(/\/\*\* The doc comment of the component\. \*\/\n(declare const _default|export default)/);
});

function defineDtsEmitTests(
	workspace: string,
	exclude: string[] = [],
	assertEmitted?: (emitted: Map<string, string>) => void,
) {
	test(`content mapper declaration emit: ${workspace}`, () => {
		const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-content-mapper-dts-'));
		const workspaceRoot = path.join(repositoryRoot, 'test-workspace', workspace);
		const sidecar = path.join(workspaceRoot, 'tsconfig.dts.json');
		try {
			fs.writeFileSync(
				sidecar,
				JSON.stringify(
					{
						extends: './tsconfig.json',
						include: ['**/*'],
						exclude,
					},
					undefined,
					'\t',
				) + '\n',
			);
			const result = runTsc([
				'-p',
				sidecar,
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
			expect(outputs.length).toBeGreaterThan(0);
			expect(outputs).toMatchSnapshot('declaration output files');

			const emitted = new Map<string, string>();
			for (const file of outputs) {
				const text = fs.readFileSync(path.join(outDir, file), 'utf8');
				emitted.set(file, text);
				expect(text).toMatchSnapshot(file);
			}

			assertSelfContained(emitted);
			assertEmitted?.(emitted);
		}
		finally {
			fs.rmSync(outDir, { recursive: true, force: true });
			fs.rmSync(sidecar, { force: true });
		}
	});
}

// Global `__VLS_` helpers don't exist for .d.ts consumers,
// recheck each output as plain .ts so no `__VLS_` name dangles.
function assertSelfContained(emitted: Map<string, string>) {
	for (const [file, text] of emitted) {
		expect(text).not.toContain('/// <reference');
		const exportedInternals = text.split('\n').filter(line => /^export\b(?!\s+default\b).*\b__VLS_/.test(line));
		expect(exportedInternals, file).toEqual([]);
	}

	// inside the repository, so that `vue` resolves as it does for the emitted declarations
	const checkDir = fs.mkdtempSync(path.join(repositoryRoot, 'test-workspace', '.dts-check-'));
	try {
		const checkFiles: string[] = [];
		for (const [outputFile, text] of emitted) {
			const checkFile = outputFile.slice(0, -'.d.ts'.length) + '.check.ts';
			fs.mkdirSync(path.dirname(path.join(checkDir, checkFile)), { recursive: true });
			fs.writeFileSync(path.join(checkDir, checkFile), text);
			checkFiles.push(checkFile);
		}
		fs.writeFileSync(
			path.join(checkDir, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: {
					noEmit: true,
					skipLibCheck: true,
					target: 'esnext',
					module: 'esnext',
					moduleResolution: 'bundler',
				},
				files: checkFiles,
			}),
		);
		const result = runTsc(['-p', checkDir, '--pretty', 'false']);
		const danglingReferences = (result.stdout + result.stderr)
			.split('\n')
			.filter(message => /Cannot find (name|namespace) '__VLS_/.test(message));
		expect(danglingReferences).toEqual([]);
	}
	finally {
		fs.rmSync(checkDir, { recursive: true, force: true });
	}
}

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
