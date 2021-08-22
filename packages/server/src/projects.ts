import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as upath from 'upath';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as vscode from 'vscode-languageserver';
import { createProject, Project } from './project';

export type Projects = ReturnType<typeof createProjects>;

export function createProjects(
	options: shared.ServerInitializationOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	rootPaths: string[],
	inferredCompilerOptions: ts.CompilerOptions,
) {

	let filesUpdateTrigger = false;
	const tsConfigNames = ['tsconfig.json', 'jsconfig.json'];
	const tsConfigWatchers = new Map<string, ts.FileWatcher>();
	const projects = new Map<string, Project>();
	const inferredProjects = new Map<string, Project>();
	const tsConfigSet = new Set(rootPaths.map(rootPath => ts.sys.readDirectory(rootPath, tsConfigNames, undefined, ['**/*'])).flat());
	const tsConfigs = [...tsConfigSet].filter(tsConfig => tsConfigNames.includes(upath.basename(tsConfig)));
	const inferredTsConfigs = rootPaths.map(rootPath => upath.join(rootPath, 'tsconfig.json'));
	const checkedProjects = new Set<string>();
	const progressMap = new Map<string, Promise<vscode.WorkDoneProgressServerReporter>>();
	const virtualProgressMap = new Map<string, Promise<vscode.WorkDoneProgressServerReporter>>();

	(async () => {
		const { progress, virtualProgress } = await getTsconfigProgress(tsConfigs, inferredTsConfigs);
		clearDiagnostics();
		for (const tsConfig of tsConfigs) {
			updateProject(tsConfig, progress[tsConfig]);
		}
		for (const tsConfig of inferredTsConfigs) {
			createInferredProject(tsConfig, virtualProgress[tsConfig]);
		}
		updateDocumentDiagnostics(undefined);
	})();
	for (const rootPath of rootPaths) {
		ts.sys.watchDirectory!(rootPath, async fileName => {
			if (tsConfigNames.includes(upath.basename(fileName))) {
				// tsconfig.json changed
				const { progress } = await getTsconfigProgress([fileName], []);
				clearDiagnostics();
				updateProject(fileName, progress[fileName]);
				updateDocumentDiagnostics(undefined);
			}
			else {
				// *.vue, *.ts ... changed
				filesUpdateTrigger = true;
				await shared.sleep(0);
				if (filesUpdateTrigger) {
					filesUpdateTrigger = false;
					for (const [_, service] of [...projects, ...inferredProjects]) {
						service.update();
					}
				}
			}
		}, true);
	}

	documents.onDidChangeContent(change => {
		for (const [_, service] of [...projects, ...inferredProjects]) {
			service.onDocumentUpdated(change.document);
		}
		updateDocumentDiagnostics(shared.uriToFsPath(change.document.uri));
		// preload
		get(change.document.uri);
	});
	documents.onDidClose(change => connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] }));

	return {
		projects,
		inferredProjects,
		get,
	};

	async function getTsconfigProgress(tsconfigs: string[], virtualTsconfigs: string[]) {
		for (const tsconfig of tsconfigs) {
			if (!progressMap.has(tsconfig)) {
				progressMap.set(tsconfig, connection.window.createWorkDoneProgress());
			}
		}
		for (const tsconfig of virtualTsconfigs) {
			if (!virtualProgressMap.has(tsconfig)) {
				virtualProgressMap.set(tsconfig, connection.window.createWorkDoneProgress());
			}
		}
		const result: Record<string, vscode.WorkDoneProgressServerReporter> = {};
		const virtualResult: Record<string, vscode.WorkDoneProgressServerReporter> = {};
		for (const tsconfig of tsconfigs) {
			const progress = progressMap.get(tsconfig);
			if (progress) {
				result[tsconfig] = await progress;
			}
		}
		for (const tsconfig of virtualTsconfigs) {
			const progress = virtualProgressMap.get(tsconfig);
			if (progress) {
				virtualResult[tsconfig] = await progress;
			}
		}
		return {
			progress: result,
			virtualProgress: virtualResult,
		};
	}
	async function updateDocumentDiagnostics(changedFileName?: string) {

		if (!options.languageFeatures?.diagnostics)
			return;

		const otherDocs: TextDocument[] = [];
		const changeDoc = changedFileName ? documents.get(shared.fsPathToUri(changedFileName)) : undefined;
		const isCancel = changeDoc ? getIsCancel(changeDoc.uri, changeDoc.version) : async () => false;

		for (const document of documents.all()) {
			if (document.languageId === 'vue' && document.uri !== changeDoc?.uri) {
				otherDocs.push(document);
			}
		}

		if (changeDoc) {
			if (await isCancel()) return;
			await sendDocumentDiagnostics(changeDoc.uri, isCancel);
		}

		for (const doc of otherDocs) {
			if (await isCancel()) break;
			await sendDocumentDiagnostics(doc.uri, isCancel);
		}
	}
	function getIsCancel(uri: string, version: number) {
		let _isCancel = false;
		return async () => {
			if (_isCancel) {
				return true;
			}
			if (typeof options.languageFeatures?.diagnostics === 'object' && options.languageFeatures.diagnostics.getDocumentVersionRequest) {
				const clientDocVersion = await connection.sendRequest(shared.GetDocumentVersionRequest.type, { uri });
				if (clientDocVersion !== null && clientDocVersion !== undefined && version !== clientDocVersion) {
					_isCancel = true;
				}
			}
			return _isCancel;
		};
	}
	async function sendDocumentDiagnostics(uri: string, isCancel?: () => Promise<boolean>) {

		const match = get(uri);
		if (!match) return;

		let send = false; // is vue document
		await match.service.doValidation(uri, async result => {
			send = true;
			connection.sendDiagnostics({ uri: uri, diagnostics: result });
		}, isCancel);

		if (send && !checkedProjects.has(match.tsConfig)) {
			checkedProjects.add(match.tsConfig);
			const projectValid = match.service.__internal__.checkProject();
			if (!projectValid) {
				connection.window.showWarningMessage(
					"Cannot import Vue 3 types from @vue/runtime-dom. If you are using Vue 2, you may need to install @vue/runtime-dom in additionally."
				);
			}
		}
	}
	function updateProject(tsConfig: string, progress: vscode.WorkDoneProgressServerReporter) {
		if (projects.has(tsConfig)) {
			projects.get(tsConfig)?.dispose();
			tsConfigWatchers.get(tsConfig)?.close();
			projects.delete(tsConfig);
		}
		if (ts.sys.fileExists(tsConfig)) {
			projects.set(tsConfig, createProject(
				ts,
				options,
				upath.dirname(tsConfig),
				tsConfig,
				tsLocalized,
				documents,
				changedFileName => {
					updateDocumentDiagnostics(changedFileName);
					if (options.languageFeatures?.semanticTokens) {
						connection.languages.semanticTokens.refresh();
					}
				},
				progress,
				connection,
			));
			tsConfigWatchers.set(tsConfig, ts.sys.watchFile!(tsConfig, (fileName, eventKind) => {
				if (eventKind === ts.FileWatcherEventKind.Changed) {
					clearDiagnostics();
					updateProject(tsConfig, progress);
					updateDocumentDiagnostics(undefined);
				}
			}));
		}
	}
	function createInferredProject(tsConfig: string, progress: vscode.WorkDoneProgressServerReporter) {
		inferredProjects.set(tsConfig, createProject(
			ts,
			options,
			upath.dirname(tsConfig),
			inferredCompilerOptions,
			tsLocalized,
			documents,
			changedFileName => {
				updateDocumentDiagnostics(changedFileName);
				if (options.languageFeatures?.semanticTokens) {
					connection.languages.semanticTokens.refresh();
				}
			},
			progress,
			connection,
		));
	}
	function clearDiagnostics() {
		for (const doc of documents.all()) {
			if (doc.languageId === 'vue') {
				connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
			}
		}
	}
	function get(uri: string) {
		const tsConfigs = getMatchTsConfigs(uri, projects);
		if (tsConfigs.length) {
			const service = projects.get(tsConfigs[0]);
			if (service) {
				return {
					tsConfig: tsConfigs[0],
					service: service.getLanguageService(),
				};
			}
		}
		const inferredTsConfigs = getMatchTsConfigs(uri, inferredProjects);
		if (inferredTsConfigs.length) {
			const service = inferredProjects.get(inferredTsConfigs[0]);
			if (service) {
				return {
					tsConfig: inferredTsConfigs[0],
					service: service.getLanguageService(),
				};
			}
		}
	}
	function getMatchTsConfigs(uri: string, services: Map<string, Project>) {

		const fileName = shared.uriToFsPath(uri);

		let firstMatchTsConfigs: string[] = [];
		let secondMatchTsConfigs: string[] = [];

		for (const kvp of services) {
			const tsConfig = upath.resolve(kvp[0]);
			const parsedCommandLine = kvp[1].getParsedCommandLine();
			const hasVueFile = parsedCommandLine.fileNames.some(fileName => upath.extname(fileName) === '.vue');
			if (!hasVueFile) continue;
			const fileNames = new Set(parsedCommandLine.fileNames);
			if (fileNames.has(fileName) || kvp[1].getLanguageServiceDontCreate()?.__internal__.context.scriptTsLs.__internal__.getTextDocument(uri)) {
				const tsConfigDir = upath.dirname(tsConfig);
				if (!upath.relative(tsConfigDir, fileName).startsWith('..')) { // is file under tsconfig.json folder
					firstMatchTsConfigs.push(tsConfig);
				}
				else {
					secondMatchTsConfigs.push(tsConfig);
				}
			}
		}

		firstMatchTsConfigs = firstMatchTsConfigs.sort(sortPaths);
		secondMatchTsConfigs = secondMatchTsConfigs.sort(sortPaths);

		return [
			...firstMatchTsConfigs,
			...secondMatchTsConfigs,
		];

		function sortPaths(a: string, b: string) {

			const aLength = a.split('/').length;
			const bLength = b.split('/').length;

			if (aLength === bLength) {
				const aWeight = upath.basename(a) === 'tsconfig.json' ? 1 : 0;
				const bWeight = upath.basename(b) === 'tsconfig.json' ? 1 : 0;
				return bWeight - aWeight;
			}

			return bLength - aLength;
		}
	}
}
