import * as core from '@vue/language-core';
import { posix as path } from 'path-browserify';
import * as ts from 'typescript';
import { createCheckerBase } from './lib/checker';
import type { MetaCheckerOptions } from './lib/types';

export * from './lib/types';

export function createCheckerByJson(
	rootDir: string,
	json: any,
	checkerOptions: MetaCheckerOptions = {},
) {
	rootDir = rootDir.replace(/\\/g, '/');
	return createCheckerBase(
		ts,
		() => {
			const commandLine = core.createParsedCommandLineByJson(ts, ts.sys, rootDir, json);
			const { fileNames } = ts.parseJsonConfigFileContent(
				json,
				ts.sys,
				rootDir,
				{},
				undefined,
				undefined,
				core.getAllExtensions(commandLine.vueOptions)
					.map(extension => ({
						extension: extension.slice(1),
						isMixedContent: true,
						scriptKind: ts.ScriptKind.Deferred,
					})),
			);
			return [commandLine, fileNames];
		},
		checkerOptions,
		rootDir,
	);
}

export function createChecker(
	tsconfig: string,
	checkerOptions: MetaCheckerOptions = {},
) {
	tsconfig = tsconfig.replace(/\\/g, '/');
	return createCheckerBase(
		ts,
		() => {
			const commandLine = core.createParsedCommandLine(ts, ts.sys, tsconfig);
			const { fileNames } = ts.parseJsonSourceFileConfigFileContent(
				ts.readJsonConfigFile(tsconfig, ts.sys.readFile),
				ts.sys,
				path.dirname(tsconfig),
				{},
				tsconfig,
				undefined,
				core.getAllExtensions(commandLine.vueOptions)
					.map(extension => ({
						extension: extension.slice(1),
						isMixedContent: true,
						scriptKind: ts.ScriptKind.Deferred,
					})),
			);
			return [commandLine, fileNames];
		},
		checkerOptions,
		path.dirname(tsconfig),
	);
}
