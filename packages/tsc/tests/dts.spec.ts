import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createProgram } from '../out';

const workspace = path.resolve(__dirname, '../../../test-workspace/vue-tsc-dts');
const testFiles = readFilesRecursive(workspace);
const ensureTs = (filename: string) => filename.endsWith('.ts') ? filename : filename + '.ts';
const normalizePath = (filename: string) => filename.replace(/\\/g, '/');
const normalizeNewline = (text: string) => text.replace(/\r\n/g, '\n');

describe('vue-tsc-dts', () => {
	const compilerOptions: ts.CompilerOptions = {
		rootDir: workspace,
		declaration: true,
		emitDeclarationOnly: true,
	};
	const host = ts.createCompilerHost(compilerOptions);
	const program = createProgram({
		host,
		rootNames: testFiles,
		options: compilerOptions
	});
	const service = program.__vue.languageService;

	for (const file of testFiles) {
		const output = service.getEmitOutput(ensureTs(file), true);
		for (const outputFile of output.outputFiles) {
			it(`Input: ${shortenPath(file)}, Output: ${shortenPath(outputFile.name)}`, () => {
				expect(normalizeNewline(outputFile.text)).toMatchSnapshot();
			});
		}
	}
});

function readFilesRecursive(dir: string) {
	const result: string[] = [];

	for (const file of fs.readdirSync(dir)) {
		const filepath = path.join(dir, file);
		const stat = fs.statSync(filepath);
		if (stat.isDirectory()) {
			result.push(...readFilesRecursive(filepath));
		} else {
			result.push(filepath);
		}
	}

	return result;
}

function shortenPath(path: string): string {
	path = normalizePath(path);
	const segments = path.split('/');
	return segments.slice(-2).join('/');
}
