import { TypeScriptProjectHost, createLanguageService, resolveCommonLanguageId } from '@volar/language-service';
import { createLanguage } from '@volar/typescript';
import * as path from 'path';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { createParsedCommandLine, resolveLanguages, resolveServices, resolveVueCompilerOptions } from '../../out';
import { createMockServiceEnv } from './mockEnv';

export const rootUri = URI.file(path.resolve(__dirname, '../../../../test-workspace/language-service')).toString();
export const tester = createTester(rootUri);

function createTester(rootUri: string) {

	const ts = require('typescript') as typeof import('typescript');
	const serviceEnv = createMockServiceEnv(rootUri, () => currentVSCodeSettings ?? defaultVSCodeSettings);
	const rootPath = serviceEnv.typescript!.uriToFileName(rootUri.toString());
	const realTsConfig = path.join(rootPath, 'tsconfig.json').replace(/\\/g, '/');
	const parsedCommandLine = createParsedCommandLine(ts, ts.sys, realTsConfig);
	parsedCommandLine.fileNames = parsedCommandLine.fileNames.map(fileName => fileName.replace(/\\/g, '/'));
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const projectHost: TypeScriptProjectHost = {
		getCurrentDirectory: () => rootPath,
		getProjectVersion: () => '0',
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptSnapshot,
		getLanguageId: resolveCommonLanguageId,
	};
	const resolvedVueOptions = resolveVueCompilerOptions(parsedCommandLine.vueOptions);
	const languages = resolveLanguages({}, ts, serviceEnv.typescript!.uriToFileName, parsedCommandLine.options, resolvedVueOptions);
	const services = resolveServices({}, ts, () => resolvedVueOptions);
	const defaultVSCodeSettings: any = {
		'typescript.preferences.quoteStyle': 'single',
		'javascript.preferences.quoteStyle': 'single',
		'vue.inlayHints.missingProps': true,
		'vue.inlayHints.optionsWrapper': true,
		'vue.inlayHints.inlineHandlerLeading': true,
	};
	let currentVSCodeSettings: any;
	const language = createLanguage(
		ts,
		ts.sys,
		Object.values(languages),
		realTsConfig,
		projectHost,
		{
			fileIdToFileName: serviceEnv.typescript!.uriToFileName,
			fileNameToFileId: serviceEnv.typescript!.fileNameToUri,
		},
	);
	const languageService = createLanguageService(language, Object.values(services), serviceEnv);

	return {
		serviceEnv,
		projectHost,
		languageService,
		setVSCodeSettings,
	};

	function setVSCodeSettings(settings: any = undefined) {
		currentVSCodeSettings = settings;
	}
	function getScriptSnapshot(fileName: string) {
		const snapshot = scriptSnapshots.get(fileName);
		if (snapshot) {
			return snapshot;
		}
		const text = getScriptText(fileName);
		if (text !== undefined) {
			const snapshot = ts.ScriptSnapshot.fromString(text);
			scriptSnapshots.set(fileName, snapshot);
			return snapshot;
		}
	}
	function getScriptText(fileName: string) {
		if (ts.sys.fileExists(fileName)) {
			return ts.sys.readFile(fileName, 'utf8');
		}
	}
}
