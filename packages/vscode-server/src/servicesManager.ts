import * as shared from '@volar/shared';
import type * as ts from 'typescript';
import * as upath from 'upath';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as vscode from 'vscode-languageserver';
import { createServiceHandler, ServiceHandler } from './serviceHandler';

export type ServicesManager = ReturnType<typeof createServicesManager>;

export function createServicesManager(
	mode: 'api' | 'doc',
	getTs: () => {
		module: typeof import('typescript/lib/tsserverlibrary'),
		localized: ts.MapLike<string> | undefined,
	},
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	rootPaths: string[],
	getDocVersionForDiag?: (uri: string) => Promise<number | undefined>,
	_onProjectFilesUpdate?: () => void,
) {

	let filesUpdateTrigger = false;
	const originalTs = getTs().module;
	const tsConfigNames = ['tsconfig.json', 'jsconfig.json'];
	const tsConfigWatchers = new Map<string, ts.FileWatcher>();
	const services = new Map<string, ServiceHandler>();
	const tsConfigSet = new Set(rootPaths.map(rootPath => originalTs.sys.readDirectory(rootPath, tsConfigNames, undefined, ['**/*'])).flat());
	const tsConfigs = [...tsConfigSet].filter(tsConfig => tsConfigNames.includes(upath.basename(tsConfig)));
	const checkedProject = new Set<string>();
	const progressMap = new Map<string, Promise<vscode.WorkDoneProgressServerReporter>>();

	(async () => {
		const progress = await getTsconfigProgress(tsConfigs);
		clearDiagnostics();
		for (const tsConfig of tsConfigs) {
			updateLsHandler(tsConfig, progress[tsConfig]);
		}
		updateAllOpenedDocumentsDiagnostics();
	})();
	for (const rootPath of rootPaths) {
		originalTs.sys.watchDirectory!(rootPath, async fileName => {
			if (tsConfigNames.includes(upath.basename(fileName))) {
				// tsconfig.json changed
				const progress = await getTsconfigProgress([fileName]);
				clearDiagnostics();
				updateLsHandler(fileName, progress[fileName]);
				updateAllOpenedDocumentsDiagnostics();
			}
			else {
				// *.vue, *.ts ... changed
				filesUpdateTrigger = true;
				await shared.sleep(0);
				if (filesUpdateTrigger) {
					filesUpdateTrigger = false;
					for (const [_, service] of services) {
						service.update();
					}
				}
			}
		}, true);
	}

	documents.onDidChangeContent(change => {
		for (const [_, service] of services) {
			service.onDocumentUpdated(change.document);
		}
		onDocumentUpdated(change.document);
		// preload
		getMatchService(change.document.uri);
	});
	documents.onDidClose(change => connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] }));

	return {
		services,
		getMatchService,
		getMatchTsConfig,
		restartAll,
	};

	async function getTsconfigProgress(tsconfigs: string[]) {
		for (const tsconfig of tsconfigs) {
			if (!progressMap.has(tsconfig)) {
				progressMap.set(tsconfig, connection.window.createWorkDoneProgress());
			}
		}
		const result: Record<string, vscode.WorkDoneProgressServerReporter> = {};
		for (const tsconfig of tsconfigs) {
			const progress = progressMap.get(tsconfig);
			if (progress) {
				result[tsconfig] = await progress;
			}
		}
		return result;
	}
	async function onDocumentUpdated(changeDoc: TextDocument) {

		if (!getDocVersionForDiag) return;

		const otherDocs: TextDocument[] = [];
		const changedFileName = shared.uriToFsPath(changeDoc.uri);
		const isCancel = getIsCancel(changeDoc.uri, changeDoc.version);

		for (const document of documents.all()) {
			if (document.languageId === 'vue' && document.uri !== changeDoc.uri) {
				otherDocs.push(document);
			}
		}

		if (await isCancel()) return;
		await sendDocumentDiagnostics(changeDoc.uri, changedFileName, isCancel);

		for (const doc of otherDocs) {
			if (await isCancel()) break;
			await sendDocumentDiagnostics(doc.uri, changedFileName, isCancel);
		}
	}
	async function updateAllOpenedDocumentsDiagnostics(changedFileName?: string) {

		if (!getDocVersionForDiag) return;

		const openedDocs: TextDocument[] = [];

		for (const document of documents.all()) {
			if (document.languageId === 'vue') {
				openedDocs.push(document);
			}
		}

		for (const doc of openedDocs) {
			await sendDocumentDiagnostics(doc.uri, changedFileName);
		}
	}
	function getIsCancel(uri: string, version: number) {
		let _isCancel = false;
		return async () => {
			if (_isCancel) {
				return true;
			}
			if (getDocVersionForDiag) {
				const clientDocVersion = await getDocVersionForDiag(uri);
				if (clientDocVersion !== undefined && version !== clientDocVersion) {
					_isCancel = true;
				}
			}
			return _isCancel;
		};
	}
	async function sendDocumentDiagnostics(uri: string, changedFileName?: string, isCancel?: () => Promise<boolean>) {

		const matchTsConfig = getMatchTsConfig(uri);
		if (!matchTsConfig) return;

		const matchService = services.get(matchTsConfig);
		if (!matchService) return;
		if (changedFileName && !matchService.isRelatedFile(changedFileName)) return;

		const matchLs = matchService.getLanguageService();

		let send = false; // is vue document
		await matchLs.doValidation(uri, async result => {
			send = true;
			connection.sendDiagnostics({ uri: uri, diagnostics: result });
		}, isCancel);

		if (send && !checkedProject.has(matchTsConfig)) {
			checkedProject.add(matchTsConfig);
			const projectValid = matchLs.__internal__.checkProject();
			if (!projectValid) {
				connection.window.showWarningMessage(
					"Cannot import Vue 3 types from @vue/runtime-dom. If you are using Vue 2, you may need to install @vue/runtime-dom in additionally."
				);
			}
		}
	}
	function updateLsHandler(tsConfig: string, progress: vscode.WorkDoneProgressServerReporter) {
		if (services.has(tsConfig)) {
			services.get(tsConfig)?.dispose();
			tsConfigWatchers.get(tsConfig)?.close();
			services.delete(tsConfig);
		}
		const _ts = getTs();
		const ts = _ts.module;
		const tsLocalized = _ts.localized;
		if (ts.sys.fileExists(tsConfig)) {
			services.set(tsConfig, createServiceHandler(
				ts,
				mode,
				tsConfig,
				tsLocalized,
				documents,
				updateAllOpenedDocumentsDiagnostics,
				_onProjectFilesUpdate,
				progress,
				connection,
			));
			tsConfigWatchers.set(tsConfig, ts.sys.watchFile!(tsConfig, (fileName, eventKind) => {
				if (eventKind === ts.FileWatcherEventKind.Changed) {
					clearDiagnostics();
					updateLsHandler(tsConfig, progress);
					updateAllOpenedDocumentsDiagnostics();
				}
			}));
		}
	}
	function clearDiagnostics() {
		for (const doc of documents.all()) {
			if (doc.languageId === 'vue') {
				connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
			}
		}
	}
	async function restartAll() {
		for (const doc of documents.all()) {
			if (doc.languageId === 'vue') {
				connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
			}
		}
		const tsConfigs = [...services.keys()];
		progressMap.clear();
		const progress = await getTsconfigProgress(tsConfigs);
		clearDiagnostics();
		for (const tsConfig of tsConfigs) {
			updateLsHandler(tsConfig, progress[tsConfig]);
		}
		updateAllOpenedDocumentsDiagnostics();
	}
	function getMatchService(uri: string) {
		const tsConfig = getMatchTsConfig(uri);
		if (tsConfig) {
			return services.get(tsConfig)?.getLanguageService();
		}
	}
	function getMatchTsConfig(uri: string) {
		const matches = getMatchTsConfigs(uri);
		if (matches.length)
			return matches[0];
	}
	function getMatchTsConfigs(uri: string) {

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
		firstMatchTsConfigs = firstMatchTsConfigs.sort((a, b) => b.split('/').length - a.split('/').length)
		secondMatchTsConfigs = secondMatchTsConfigs.sort((a, b) => b.split('/').length - a.split('/').length)

		return [
			...firstMatchTsConfigs,
			...secondMatchTsConfigs,
		];
	}
}
