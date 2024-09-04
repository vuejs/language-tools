import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { proxyCreateProgram } from '@volar/typescript';
import * as vue from '@vue/language-core';

const workspace = path.resolve(__dirname, '../../../test-workspace/component-meta');
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
	const options: ts.CreateProgramOptions = {
		host,
		rootNames: readFilesRecursive(workspace),
		options: compilerOptions
	};

	let vueOptions: vue.VueCompilerOptions;

	const createProgram = proxyCreateProgram(ts, ts.createProgram, (ts, options) => {
		const { configFilePath } = options.options;
		if (typeof configFilePath === 'string') {
			vueOptions = vue.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathReg, '/')).vueOptions;
		}
		else {
			vueOptions = vue.resolveVueCompilerOptions({ extensions: ['.vue', '.cext'] });
			vueOptions.__setupedGlobalTypes = vue.setupGlobalTypes(workspace.replace(windowsPathReg, '/'), vueOptions, ts.sys);
		}
		const vueLanguagePlugin = vue.createVueLanguagePlugin<string>(
			ts,
			options.options,
			vueOptions,
			id => id
		);
		return [vueLanguagePlugin];
	});
	const program = createProgram(options);

	for (const intputFile of options.rootNames) {

		const expectedOutputFile = intputFile.endsWith('.ts')
			? intputFile.slice(0, -'.ts'.length) + '.d.ts'
			: intputFile.endsWith('.tsx')
				? intputFile.slice(0, -'.tsx'.length) + '.d.ts'
				: intputFile + '.d.ts';
		it(`Input: ${shortenPath(intputFile)}, Output: ${shortenPath(expectedOutputFile)}`, () => {
			let outputText: string | undefined;
			const sourceFile = program.getSourceFile(intputFile);
			program.emit(
				sourceFile,
				(outputFile, text) => {
					expect(outputFile.replace(windowsPathReg, '/')).toBe(expectedOutputFile.replace(windowsPathReg, '/'));
					outputText = text;
				},
				undefined,
				true
			);
			expect(outputText ? normalizeNewline(outputText) : undefined).toMatchSnapshot();
		});
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
