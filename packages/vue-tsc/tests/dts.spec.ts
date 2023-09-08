import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createProgram } from '../src';

const workspace = path.resolve(__dirname, '../../vue-test-workspace/vue-tsc-dts');
const testDirs = fs.readdirSync(workspace);
const ensureTs = (filename: string) => filename.endsWith('.ts') ? filename : filename + '.ts';
const normalizePath = (filename: string) => filename.replace(/\\/g, '/');

const compilerOptions: ts.CompilerOptions = {
	rootDir: workspace,
	declaration: true,
	emitDeclarationOnly: true,
};
const host = ts.createCompilerHost(compilerOptions);

describe('vue-tsc-dts', () => {
	for (const dirName of testDirs) {
		const dir = path.join(workspace, dirName);
		const files = fs.readdirSync(dir).map(file => path.join(dir, file));
		const program = createProgram({
			host,
			rootNames: files,
			options: compilerOptions
		});
		const service = program.__vue.languageService;
		for (const file of files) {
			const output = service.getEmitOutput(ensureTs(file), true);
			for (const outputFile of output.outputFiles) {
				it(`Input: ${normalizePath(path.join(dirName, path.basename(file)))}, Output: ${normalizePath(path.join(dirName, path.basename(outputFile.name)))}`, () => {
					expect(outputFile.text).toMatchSnapshot();
				});
			}
		}
	}
});
