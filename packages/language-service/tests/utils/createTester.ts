import { createLanguageService, resolveCommonLanguageId } from '@volar/language-service';
import { createProject, ProjectHost } from '@volar/typescript';
import * as path from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { URI } from 'vscode-uri';
import { createParsedCommandLine, resolveLanguages, resolveServices } from '../../out';
import { createMockServiceEnv } from './mockEnv';

const testRoot = path.resolve(__dirname, '../../../../test-workspace/language-service').replace(/\\/g, '/');

export const rootUri = URI.file(testRoot);
export const tester = createTester(testRoot);

function createTester(root: string) {

	const ts = require('typescript') as typeof import('typescript/lib/tsserverlibrary');
	const realTsConfig = path.join(root, 'tsconfig.json').replace(/\\/g, '/');
	const parsedCommandLine = createParsedCommandLine(ts, ts.sys, realTsConfig);
	parsedCommandLine.fileNames = parsedCommandLine.fileNames.map(fileName => fileName.replace(/\\/g, '/'));
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const serviceEnv = createMockServiceEnv(rootUri, () => currentVSCodeSettings ?? defaultVSCodeSettings);
	const projectHost: ProjectHost = {
		getCurrentDirectory: () => root,
		getProjectVersion: () => '0',
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptSnapshot,
		getFileName: serviceEnv.uriToFileName,
		getFileId: serviceEnv.fileNameToUri,
		getLanguageId: resolveCommonLanguageId,
	};
	const languages = resolveLanguages(ts, {}, parsedCommandLine.options, parsedCommandLine.vueOptions);
	const services = resolveServices({}, parsedCommandLine.vueOptions);
	const defaultVSCodeSettings: any = {
		'typescript.preferences.quoteStyle': 'single',
		'javascript.preferences.quoteStyle': 'single',
	};
	let currentVSCodeSettings: any;
	const project = createProject(
		ts,
		ts.sys,
		Object.values(languages),
		realTsConfig,
		projectHost,
	);
	const languageService = createLanguageService({ typescript: ts as any }, Object.values(services), serviceEnv, project);

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
