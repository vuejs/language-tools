import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { proxyCreateProgram } from '@volar/typescript';
import * as vue from '@vue/language-core';

const workspace = path.resolve(__dirname, '../../../test-workspace/component-meta');
const intputFiles = readFilesRecursive(workspace);
const normalizePath = (filename: string) => filename.replace(/\\/g, '/');
const normalizeNewline = (text: string) => text.replace(/\r\n/g, '\n');
const windowsPathReg = /\\/g;

describe('vue-tsc-dts', () => {
	const compilerOptions: ts.CompilerOptions = {
		rootDir: workspace,
		declaration: true,
		emitDeclarationOnly: true,
		allowNonTsExtensions: true,
	};
	const host = ts.createCompilerHost(compilerOptions);
	const createProgram = proxyCreateProgram(ts, ts.createProgram, ['.vue'], (ts, options) => {
		const { configFilePath } = options.options;
		const vueOptions = typeof configFilePath === 'string'
			? vue.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathReg, '/')).vueOptions
			: {};
		return vue.createLanguages(
			ts,
			options.options,
			vueOptions,
		);
	});
	const program = createProgram({
		host,
		rootNames: intputFiles,
		options: compilerOptions
	});

	for (const intputFile of intputFiles) {
		const sourceFile = program.getSourceFile(intputFile);
		program.emit(
			sourceFile,
			(outputFile, text) => {
				it(`Input: ${shortenPath(intputFile)}, Output: ${shortenPath(outputFile)}`, () => {
					expect(normalizeNewline(text)).toMatchSnapshot();
				});
			},
			undefined,
			true,
		);
	}
});

function readFilesRecursive(dir: string) {
	const result: string[] = [];

	for (const file of fs.readdirSync(dir)) {
		if (file === 'tsconfig.json') {
			continue;
		}
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
