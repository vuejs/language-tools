import { proxyCreateProgram } from '@volar/typescript';
import * as core from '@vue/language-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { expect, test } from 'vitest';

const normalizePath = (filename: string) => filename.replace(/\\/g, '/');
const normalizeNewline = (text: string) => text.replace(/\r\n/g, '\n');
const windowsPathRE = /\\/g;

defineDtsEmitTests(
	path.resolve(__dirname, '../../../test-workspace/component-meta'),
);
defineDtsEmitTests(
	path.resolve(__dirname, '../../../test-workspace/dts/jsx-slots'),
	true,
);

function defineDtsEmitTests(workspace: string, useWorkspaceTsconfig = false) {
	const compilerOptions: ts.CompilerOptions = {
		rootDir: workspace,
		declaration: true,
		emitDeclarationOnly: true,
		allowNonTsExtensions: true,
	};
	const host = ts.createCompilerHost(compilerOptions);
	const options: ts.CreateProgramOptions = {
		host,
		rootNames: readFilesRecursive(workspace, workspace),
		options: compilerOptions,
	};

	let vueOptions: core.VueCompilerOptions;

	const createProgram = proxyCreateProgram(ts, ts.createProgram, (ts, options) => {
		if (useWorkspaceTsconfig) {
			const tsconfigPath = normalizePath(path.join(workspace, 'tsconfig.json'));
			vueOptions = core.createParsedCommandLine(ts, ts.sys, tsconfigPath).vueOptions;
		}
		else {
			vueOptions = core.createParsedCommandLineByJson(ts, ts.sys, workspace.replace(windowsPathRE, '/'), {}).vueOptions;
			vueOptions.target = 99;
			vueOptions.extensions = ['vue', 'cext'];
		}
		const vueLanguagePlugin = core.createVueLanguagePlugin<string>(
			ts,
			options.options,
			vueOptions,
			id => id,
		);
		return [vueLanguagePlugin];
	});
	const program = createProgram(options);

	for (const intputFile of options.rootNames) {
		if (intputFile.endsWith('.d.ts')) {
			continue;
		}
		const expectedOutputFile = intputFile.endsWith('.ts')
			? intputFile.slice(0, -'.ts'.length) + '.d.ts'
			: intputFile.endsWith('.tsx')
			? intputFile.slice(0, -'.tsx'.length) + '.d.ts'
			: intputFile + '.d.ts';
		test(`Input: ${shortenPath(intputFile)}, Output: ${shortenPath(expectedOutputFile)}`, () => {
			let outputText: string | undefined;
			const sourceFile = program.getSourceFile(intputFile);
			program.emit(
				sourceFile,
				(outputFile, text) => {
					expect(outputFile.replace(windowsPathRE, '/')).toBe(expectedOutputFile.replace(windowsPathRE, '/'));
					outputText = text;
				},
				undefined,
				true,
			);
			expect(outputText ? normalizeNewline(outputText) : undefined).toMatchSnapshot();
		});
	}

	// Global `__VLS_` helpers don't exist for .d.ts consumers,
	// recheck each output as plain .ts so no `__VLS_` name dangles.
	test(`Self-contained d.ts emit: ${shortenPath(workspace)}`, () => {
		const emitted = new Map<string, string>();
		for (const inputFile of options.rootNames) {
			const sourceFile = program.getSourceFile(inputFile);
			program.emit(
				sourceFile,
				(outputFile, text) => emitted.set(normalizePath(outputFile), text),
				undefined,
				true,
			);
		}
		expect(emitted.size).toBeGreaterThan(0);
		for (const text of emitted.values()) {
			expect(text).not.toContain('/// <reference');
		}

		const checkFiles = new Map<string, string>(
			[...emitted].map(([outputFile, text]) => [outputFile.slice(0, -'.d.ts'.length) + '.check.ts', text]),
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
		checkHost.fileExists = fileName => checkFiles.has(normalizePath(fileName)) || fileExists.call(checkHost, fileName);
		checkHost.getSourceFile = (fileName, languageVersion, ...args) => {
			const text = checkFiles.get(normalizePath(fileName));
			return text !== undefined
				? ts.createSourceFile(fileName, text, languageVersion)
				: getSourceFile.call(checkHost, fileName, languageVersion, ...args);
		};
		const checkProgram = ts.createProgram([...checkFiles.keys()], checkOptions, checkHost);
		const danglingReferences = checkProgram.getSemanticDiagnostics()
			.map(diagnostic => ({
				file: diagnostic.file ? shortenPath(diagnostic.file.fileName) : '',
				message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
			}))
			.filter(({ message }) => /Cannot find (name|namespace) '__VLS_/.test(message));
		expect(danglingReferences).toEqual([]);
	});
}

function readFilesRecursive(workspace: string, dir: string) {
	if (path.relative(workspace, dir).startsWith('#')) {
		return [];
	}
	const result: string[] = [];

	for (const file of fs.readdirSync(dir)) {
		if (file === 'tsconfig.json') {
			continue;
		}
		const filepath = path.join(dir, file);
		const stat = fs.statSync(filepath);
		if (stat.isDirectory()) {
			result.push(...readFilesRecursive(workspace, filepath));
		}
		else {
			result.push(filepath);
		}
	}
	return result;
}

function shortenPath(path: string) {
	path = normalizePath(path);
	const segments = path.split('/');
	return segments.slice(-2).join('/');
}
