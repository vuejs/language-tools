import { ProjectContext, createLanguage, createLanguageService, createUriMap } from '@volar/language-service';
import { TypeScriptProjectHost, createLanguageServiceHost, resolveFileLanguageId } from '@volar/typescript';
import * as path from 'path';
import * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { createParsedCommandLine, createRootFileChecker, createVueLanguagePlugin2, getFullLanguageServicePlugins } from '../..';
import { createMockServiceEnv, fileNameToUri, uriToFileName } from './mockEnv';

export const rootUri = URI.file(path.resolve(__dirname, '../../../../test-workspace/language-service'));
export const tester = createTester(rootUri);

function createTester(rootUri: URI) {

	const serviceEnv = createMockServiceEnv(rootUri, () => currentVSCodeSettings ?? defaultVSCodeSettings);
	const rootPath = uriToFileName(rootUri);
	const realTsConfig = path.join(rootPath, 'tsconfig.json').replace(/\\/g, '/');
	const parsedCommandLine = createParsedCommandLine(ts, ts.sys, realTsConfig);
	parsedCommandLine.fileNames = parsedCommandLine.fileNames.map(fileName => fileName.replace(/\\/g, '/'));
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot | undefined>();
	const projectHost: TypeScriptProjectHost = {
		getCurrentDirectory: () => uriToFileName(rootUri),
		getProjectVersion: () => '0',
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptSnapshot,
	};
	const vueLanguagePlugin = createVueLanguagePlugin2(
		ts,
		uriToFileName,
		createRootFileChecker(
			projectHost.getProjectVersion ? () => projectHost.getProjectVersion!() : undefined,
			() => projectHost.getScriptFileNames(),
			ts.sys.useCaseSensitiveFileNames
		),
		parsedCommandLine.options,
		parsedCommandLine.vueOptions
	);
	const vueServicePlugins = getFullLanguageServicePlugins(ts);
	const defaultVSCodeSettings: any = {
		'typescript.preferences.quoteStyle': 'single',
		'javascript.preferences.quoteStyle': 'single',
		'vue.inlayHints.destructuredProps': true,
		'vue.inlayHints.missingProps': true,
		'vue.inlayHints.optionsWrapper': true,
		'vue.inlayHints.inlineHandlerLeading': true,
	};
	let currentVSCodeSettings: any;
	const language = createLanguage(
		[
			vueLanguagePlugin,
			{
				getLanguageId(uri) {
					return resolveFileLanguageId(uri.fsPath);
				},
			},
		],
		createUriMap(),
		uri => {
			const snapshot = getScriptSnapshot(uriToFileName(uri));
			if (snapshot) {
				language.scripts.set(uri, snapshot);
			}
			else {
				language.scripts.delete(uri);
			}
		}
	);
	const project: ProjectContext = {};
	project.typescript = {
		configFileName: realTsConfig,
		sys: ts.sys,
		uriConverter: {
			asFileName: uriToFileName,
			asUri: fileNameToUri,
		},
		...createLanguageServiceHost(ts, ts.sys, language, fileNameToUri, projectHost),
	};
	project.vue = {
		compilerOptions: parsedCommandLine.vueOptions,
	};
	const languageService = createLanguageService(language, vueServicePlugins, serviceEnv, project);

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
