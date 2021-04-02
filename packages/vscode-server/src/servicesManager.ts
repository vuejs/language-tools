import { sleep, uriToFsPath } from '@volar/shared';
import type * as ts from 'typescript';
import * as upath from 'upath';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection, TextDocuments } from 'vscode-languageserver/node';
import { createServiceHandler, ServiceHandler } from './serviceHandler';

export type ServicesManager = ReturnType<typeof createServicesManager>;

export function createServicesManager(
	ts: typeof import('typescript'),
	tsLocalized: ts.MapLike<string> | undefined,
	connection: Connection,
	documents: TextDocuments<TextDocument>,
	rootPaths: string[],
	getDocVersionForDiag?: (uri: string) => Promise<number | undefined>,
	_onProjectFilesUpdate?: () => void,
) {

	let connectionInited = false;
	let filesUpdateTrigger = false;
	const tsConfigNames = ['tsconfig.json', 'jsconfig.json'];
	const tsConfigWatchers = new Map<string, ts.FileWatcher>();
	const services = new Map<string, ServiceHandler>();
	const tsConfigSet = new Set(rootPaths.map(rootPath => ts.sys.readDirectory(rootPath, tsConfigNames, undefined, ['**/*'])).flat());
	const tsConfigs = [...tsConfigSet].filter(tsConfig => tsConfigNames.includes(upath.basename(tsConfig)));
	const checkedProject = new Set<string>();

	for (const tsConfig of tsConfigs) {
		onTsConfigChanged(tsConfig);
	}
	for (const rootPath of rootPaths) {
		ts.sys.watchDirectory!(rootPath, async fileName => {
			if (tsConfigNames.includes(upath.basename(fileName))) {
				// tsconfig.json changed
				onTsConfigChanged(fileName);
			}
			else {
				// *.vue, *.ts ... changed
				filesUpdateTrigger = true;
				await sleep(0);
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
	});
	documents.onDidClose(change => connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] }));

	return {
		services,
		getMatchService,
		getMatchTsConfig,
		restartAll,
		onConnectionInited,
	};

	async function onDocumentUpdated(changeDoc: TextDocument) {

		if (!getDocVersionForDiag) return;

		const otherDocs: TextDocument[] = [];
		const changedFileName = uriToFsPath(changeDoc.uri);
		const isCancel = getIsCancel(changeDoc.uri, changeDoc.version);

		for (const document of documents.all()) {
			if (document.languageId === 'vue' && document.uri !== changeDoc.uri) {
				otherDocs.push(document);
			}
		}

		if (await isCancel()) return;
		await sendDocumentDiagnostics(changeDoc, changedFileName, isCancel);

		for (const doc of otherDocs) {
			if (await isCancel()) break;
			await sendDocumentDiagnostics(doc, changedFileName, isCancel);
		}
	}
	async function onFileUpdated(fileName?: string) {

		if (!getDocVersionForDiag) return;

		const openedDocs: TextDocument[] = [];

		for (const document of documents.all()) {
			if (document.languageId === 'vue') {
				openedDocs.push(document);
			}
		}

		for (const doc of openedDocs) {
			await sendDocumentDiagnostics(doc, fileName);
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
	async function sendDocumentDiagnostics(document: TextDocument, changedFileName?: string, isCancel?: () => Promise<boolean>) {

		const matchTsConfig = getMatchTsConfig(document.uri);
		if (!matchTsConfig) return;

		const matchService = services.get(matchTsConfig);
		if (!matchService) return;
		if (changedFileName && !matchService.isRelatedFile(changedFileName)) return;

		const matchLs = matchService.getLanguageService();

		let send = false; // is vue document
		await matchLs.doValidation(document, async result => {
			send = true;
			connection.sendDiagnostics({ uri: document.uri, diagnostics: result });
		}, isCancel);

		if (send && !checkedProject.has(matchTsConfig)) {
			checkedProject.add(matchTsConfig);
			const projectValid = matchLs.checkProject();
			if (!projectValid) {
				connection.window.showWarningMessage(
					"Volar cannot offer intellisense auto completion due to your project being a Vue 2 project and not having @vue/runtime-dom installed. You can find more information at https://github.com/johnsoncodehk/volar"
				);
			}
		}
	}
	async function onConnectionInited() {
		connectionInited = true;
		for (const [_, service] of services) {
			service.prepareNextProgress();
		}
	}
	function onTsConfigChanged(tsConfig: string) {
		for (const doc of documents.all()) {
			if (doc.languageId === 'vue') {
				connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
			}
		}
		if (services.has(tsConfig)) {
			services.get(tsConfig)?.dispose();
			tsConfigWatchers.get(tsConfig)?.close();
			services.delete(tsConfig);
		}
		if (ts.sys.fileExists(tsConfig)) {
			services.set(tsConfig, createServiceHandler(
				tsConfig,
				ts,
				tsLocalized,
				connection,
				documents,
				() => connectionInited,
				onFileUpdated,
				_onProjectFilesUpdate,
			));
			tsConfigWatchers.set(tsConfig, ts.sys.watchFile!(tsConfig, (fileName, eventKind) => {
				if (eventKind === ts.FileWatcherEventKind.Changed) {
					onTsConfigChanged(tsConfig);
				}
			}));
		}
		onFileUpdated();
	}
	function restartAll() {
		for (const doc of documents.all()) {
			if (doc.languageId === 'vue') {
				connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
			}
		}
		for (const tsConfig of [...services.keys()]) {
			onTsConfigChanged(tsConfig);
		}
		onFileUpdated();
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

		const fileName = uriToFsPath(uri);
		let firstMatchTsConfigs: string[] = [];
		let secondMatchTsConfigs: string[] = [];

		for (const kvp of services) {
			const tsConfig = upath.resolve(kvp[0]);
			const parsedCommandLine = kvp[1].getParsedCommandLine();
			const hasVueFile = parsedCommandLine.fileNames.some(fileName => upath.extname(fileName) === '.vue');
			if (!hasVueFile) continue;
			const fileNames = new Set(parsedCommandLine.fileNames);
			if (fileNames.has(fileName) || kvp[1].getLanguageServiceDontCreate()?.getTsService().getTextDocument(uri)) {
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
