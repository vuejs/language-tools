import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { repositoryRoot, runTsc } from './utils';

defineDtsEmitTests('component-meta', ['**/*.tsx']);
defineDtsEmitTests('dts/jsx-slots');

function defineDtsEmitTests(workspace: string, exclude: string[] = []) {
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
	for (const text of emitted.values()) {
		expect(text).not.toContain('/// <reference');
	}

	const checkFiles = new Map<string, string>(
		[...emitted].map(([outputFile, text]) => [
			outputFile.slice(0, -'.d.ts'.length) + '.check.ts',
			text,
		]),
	);
	const checkOptions: ts.CompilerOptions = {
		noEmit: true,
		skipLibCheck: true,
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
	};
	const checkHost = ts.createCompilerHost(checkOptions);
	const { fileExists, getSourceFile } = checkHost;
	checkHost.fileExists = fileName => checkFiles.has(fileName.replace(/\\/g, '/')) || fileExists.call(checkHost, fileName);
	checkHost.getSourceFile = (fileName, languageVersion, ...args) => {
		const text = checkFiles.get(fileName.replace(/\\/g, '/'));
		return text !== undefined
			? ts.createSourceFile(fileName, text, languageVersion)
			: getSourceFile.call(checkHost, fileName, languageVersion, ...args);
	};
	const checkProgram = ts.createProgram([...checkFiles.keys()], checkOptions, checkHost);
	const danglingReferences = checkProgram.getSemanticDiagnostics()
		.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
		.filter(message => /Cannot find (name|namespace) '__VLS_/.test(message));
	expect(danglingReferences).toEqual([]);
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
