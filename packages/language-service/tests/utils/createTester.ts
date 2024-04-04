import { TypeScriptProjectHost, createLanguageService, resolveCommonLanguageId } from '@volar/language-service';
import { createTypeScriptLanguage } from '@volar/typescript';
import * as path from 'path';
import * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { createParsedCommandLine, createVueLanguagePlugin, createVueServicePlugins } from '../..';
import { createMockServiceEnv } from './mockEnv';

export const rootUri = URI.file(path.resolve(__dirname, '../../../../test-workspace/language-service')).toString();
export const tester = createTester(rootUri);

function createTester(rootUri: string) {

	const serviceEnv = createMockServiceEnv(rootUri, () => currentVSCodeSettings ?? defaultVSCodeSettings);
	const rootPath = serviceEnv.typescript!.uriToFileName(rootUri.toString());
	const realTsConfig = path.join(rootPath, 'tsconfig.json').replace(/\\/g, '/');
	const parsedCommandLine = createParsedCommandLine(ts, ts.sys, realTsConfig);
	parsedCommandLine.fileNames = parsedCommandLine.fileNames.map(fileName => fileName.replace(/\\/g, '/'));
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const projectHost: TypeScriptProjectHost = {
		...ts.sys,
		configFileName: realTsConfig,
		getCurrentDirectory: () => rootPath,
		getProjectVersion: () => '0',
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptSnapshot,
		getLanguageId: resolveCommonLanguageId,
		scriptIdToFileName: serviceEnv.typescript!.uriToFileName,
		fileNameToScriptId: serviceEnv.typescript!.fileNameToUri,
	};
	const vueLanguagePlugin = createVueLanguagePlugin(
		ts,
		serviceEnv.typescript!.uriToFileName,
		ts.sys.useCaseSensitiveFileNames,
		() => projectHost.getProjectVersion?.() ?? '',
		() => projectHost.getScriptFileNames(),
		parsedCommandLine.options,
		parsedCommandLine.vueOptions,
	);
	const vueServicePlugins = createVueServicePlugins(ts, () => parsedCommandLine.vueOptions);
	const defaultVSCodeSettings: any = {
		'typescript.preferences.quoteStyle': 'single',
		'javascript.preferences.quoteStyle': 'single',
		'vue.inlayHints.missingProps': true,
		'vue.inlayHints.optionsWrapper': true,
		'vue.inlayHints.inlineHandlerLeading': true,
	};
	let currentVSCodeSettings: any;
	const language = createTypeScriptLanguage(
		ts,
		[vueLanguagePlugin],
		projectHost,
	);
	const languageService = createLanguageService(language, vueServicePlugins, serviceEnv);

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
