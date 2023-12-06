import { TypeScriptProjectHost, createLanguageService, resolveCommonLanguageId } from '@volar/language-service';
import { createLanguage } from '@volar/typescript';
import * as path from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { URI } from 'vscode-uri';
import { createParsedCommandLine, resolveLanguages, resolveServices } from '../../out';
import { createMockServiceEnv } from './mockEnv';

const testRoot = path.resolve(__dirname, '../../../../test-workspace/language-service').replace(/\\/g, '/');

export const rootUri = URI.file(testRoot);
export const tester = createTester(rootUri);

function createTester(rootUri: URI) {

	const ts = require('typescript') as typeof import('typescript/lib/tsserverlibrary');
	const serviceEnv = createMockServiceEnv(rootUri, () => currentVSCodeSettings ?? defaultVSCodeSettings);
	const rootPath = serviceEnv.uriToFileName(rootUri.toString());
	const realTsConfig = path.join(rootPath, 'tsconfig.json').replace(/\\/g, '/');
	const parsedCommandLine = createParsedCommandLine(ts, ts.sys, realTsConfig);
	parsedCommandLine.fileNames = parsedCommandLine.fileNames.map(fileName => fileName.replace(/\\/g, '/'));
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const languageHost: TypeScriptProjectHost = {
		getCurrentDirectory: () => rootPath,
		getProjectVersion: () => '0',
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptSnapshot,
		getFileName: serviceEnv.uriToFileName,
		getFileId: serviceEnv.fileNameToUri,
		getLanguageId: resolveCommonLanguageId,
	};
	const languages = resolveLanguages(ts, {}, parsedCommandLine.options, parsedCommandLine.vueOptions);
	const services = resolveServices(ts, {}, parsedCommandLine.vueOptions);
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
		languageHost,
	);
	const languageService = createLanguageService(language, Object.values(services), serviceEnv);

	return {
		serviceEnv,
		languageHost,
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
