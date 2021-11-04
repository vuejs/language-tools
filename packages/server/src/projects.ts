import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as upath from 'upath';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import { createProject, Project } from './project';
import type { createLsConfigs } from './configs';

export type Projects = ReturnType<typeof createProjects>;

export function createProjects(
	options: shared.ServerInitializationOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	rootPaths: string[],
	inferredCompilerOptions: ts.CompilerOptions,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
) {

	let semanticTokensReq = 0;
	let documentUpdatedReq = 0;

	const updatedUris = new Set<string>();
	const tsConfigNames = ['tsconfig.json', 'jsconfig.json'];
	const projects = new Map<string, Project>();
	const inferredProjects = new Map<string, Project>();
	const progressMap = new Map<string, Promise<vscode.WorkDoneProgressServerReporter>>();
	const inferredProgressMap = new Map<string, Promise<vscode.WorkDoneProgressServerReporter>>();

	initProjects();

	documents.onDidChangeContent(async change => {
		for (const [_, service] of [...projects, ...inferredProjects]) {
			await service.onDocumentUpdated(change.document);
		}
		updateDiagnostics(change.document.uri);
	});
	documents.onDidClose(change => connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] }));
	connection.onDidChangeWatchedFiles(async handler => {

		const tsConfigChanges: vscode.FileEvent[] = [];
		const scriptChanges: vscode.FileEvent[] = [];

		for (const change of handler.changes) {
			const fileName = shared.uriToFsPath(change.uri);
			if (tsConfigNames.includes(upath.basename(fileName))) {
				tsConfigChanges.push(change);
			}
			else {
				scriptChanges.push(change);
			}
		}

		if (tsConfigChanges.length) {

			clearDiagnostics();
			const { projectProgress } = await getProjectProgress(tsConfigChanges.map(change => shared.uriToFsPath(change.uri)), []);

			for (const tsConfigChange of tsConfigChanges) {
				const tsConfig = shared.uriToFsPath(tsConfigChange.uri);
				if (tsConfigChange.type === vscode.FileChangeType.Deleted) {
					if (projects.has(tsConfig)) {
						projects.get(tsConfig)?.dispose();
						projects.delete(tsConfig);
					}
				}
				else {
					setProject(tsConfig, projectProgress[tsConfig]);
				}
			}
		}

		if (scriptChanges.length) {

			// fix sometime vscode file watcher missing tsconfigs delete changes
			for (const tsConfig of projects.keys()) {
				if (!ts.sys.fileExists(tsConfig)) {
					projects.get(tsConfig)?.dispose();
					projects.delete(tsConfig);
				}
			}

			for (const [_, project] of [...projects, ...inferredProjects]) {
				await project.onWorkspaceFilesChanged(scriptChanges);
			}

		}

		onDriveFileUpdated(undefined);
	});

	return {
		projects,
		inferredProjects,
		get,
	};

	async function initProjects() {

		const tsConfigs = searchTsConfigs();
		const { projectProgress } = await getProjectProgress(tsConfigs, []);

		for (const tsConfig of tsConfigs) {
			setProject(tsConfig, projectProgress[tsConfig]);
		}

		updateInferredProjects();
		updateDiagnostics(undefined);
	}
	function searchTsConfigs() {
		const tsConfigSet = new Set(rootPaths
			.map(rootPath => ts.sys.readDirectory(rootPath, tsConfigNames, undefined, ['**/*']))
			.flat()
			.filter(tsConfig => tsConfigNames.includes(upath.basename(tsConfig)))
		);
		const tsConfigs = [...tsConfigSet];

		return tsConfigs;
	}
	async function getProjectProgress(tsconfigs: string[], inferredTsconfigs: string[]) {

		for (const tsconfig of tsconfigs) {
			if (!progressMap.has(tsconfig)) {
				progressMap.set(tsconfig, connection.window.createWorkDoneProgress());
			}
		}
		for (const tsconfig of inferredTsconfigs) {
			if (!inferredProgressMap.has(tsconfig)) {
				inferredProgressMap.set(tsconfig, connection.window.createWorkDoneProgress());
			}
		}

		const projectProgress: Record<string, vscode.WorkDoneProgressServerReporter> = {};
		const inferredProjectProgress: Record<string, vscode.WorkDoneProgressServerReporter> = {};

		for (const tsconfig of tsconfigs) {
			const progress = progressMap.get(tsconfig);
			if (progress) {
				projectProgress[tsconfig] = await progress;
			}
		}
		for (const tsconfig of inferredTsconfigs) {
			const progress = inferredProgressMap.get(tsconfig);
			if (progress) {
				inferredProjectProgress[tsconfig] = await progress;
			}
		}

		return {
			projectProgress,
			inferredProjectProgress,
		};
	}
	async function updateDiagnostics(docUri?: string) {

		if (!options.languageFeatures?.diagnostics)
			return;

		if (docUri) {
			updatedUris.add(docUri);
		}

		const req = ++documentUpdatedReq;

		await shared.sleep(100);

		if (req !== documentUpdatedReq)
			return;

		const changeDocs = [...updatedUris].map(uri => shared.getDocumentSafely(documents, uri)).filter(shared.notEmpty);
		const otherDocs = documents.all().filter(doc => !updatedUris.has(doc.uri));

		for (const changeDoc of changeDocs) {

			if (req !== documentUpdatedReq)
				return;

			let _isCancel = false;
			const isDocCancel = getCancelChecker(changeDoc.uri, changeDoc.version);
			const isCancel = async () => {
				const result = req !== documentUpdatedReq || await isDocCancel();
				_isCancel = result;
				return result;
			};

			await sendDocumentDiagnostics(changeDoc.uri, isCancel);

			if (!_isCancel) {
				updatedUris.delete(changeDoc.uri);
			}
		}

		for (const doc of otherDocs) {

			if (req !== documentUpdatedReq)
				return;

			const changeDoc = docUri ? shared.getDocumentSafely(documents, docUri) : undefined;
			const isDocCancel = changeDoc ? getCancelChecker(changeDoc.uri, changeDoc.version) : async () => {
				await shared.sleep(0);
				return false;
			};
			const isCancel = async () => req !== documentUpdatedReq || await isDocCancel();;

			await sendDocumentDiagnostics(doc.uri, isCancel);
		}
	}
	function getCancelChecker(uri: string, version: number) {
		let _isCancel = false;
		let lastResultAt = Date.now();
		return async () => {
			if (_isCancel) {
				return true;
			}
			if (
				typeof options.languageFeatures?.diagnostics === 'object'
				&& options.languageFeatures.diagnostics.getDocumentVersionRequest
				&& Date.now() - lastResultAt >= 1 // 1ms
			) {
				const clientDocVersion = await connection.sendRequest(shared.GetDocumentVersionRequest.type, { uri });
				if (clientDocVersion !== null && clientDocVersion !== undefined && version !== clientDocVersion) {
					_isCancel = true;
				}
				lastResultAt = Date.now();
			}
			return _isCancel;
		};
	}
	async function sendDocumentDiagnostics(uri: string, isCancel?: () => Promise<boolean>) {

		const match = get(uri);
		if (!match) return;

		await match.service.doValidation(uri, async result => {
			connection.sendDiagnostics({ uri: uri, diagnostics: result });
		}, isCancel);
	}
	function setProject(tsConfig: string, progress: vscode.WorkDoneProgressServerReporter) {
		if (projects.has(tsConfig)) {
			projects.get(tsConfig)?.dispose();
			projects.delete(tsConfig);
		}
		projects.set(tsConfig, createProject(
			ts,
			options,
			upath.dirname(tsConfig),
			tsConfig,
			tsLocalized,
			documents,
			progress,
			connection,
			lsConfigs,
		));
	}
	async function updateInferredProjects() {

		const inferredTsConfigs = rootPaths.map(rootPath => upath.join(rootPath, 'tsconfig.json'));
		const inferredTsConfigsToCreate = inferredTsConfigs.filter(tsConfig => !inferredProjects.has(tsConfig));
		const { inferredProjectProgress } = await getProjectProgress([], inferredTsConfigsToCreate);

		for (const inferredTsConfig of inferredTsConfigsToCreate) {
			inferredProjects.set(inferredTsConfig, createProject(
				ts,
				options,
				upath.dirname(inferredTsConfig),
				inferredCompilerOptions,
				tsLocalized,
				documents,
				inferredProjectProgress[inferredTsConfig],
				connection,
				lsConfigs,
			));
		}
	}
	async function onDriveFileUpdated(driveFileName: string | undefined) {

		const req = ++semanticTokensReq;

		await updateDiagnostics(driveFileName ? shared.fsPathToUri(driveFileName) : undefined);

		await shared.sleep(100);

		if (req === semanticTokensReq) {
			if (options.languageFeatures?.semanticTokens) {
				connection.languages.semanticTokens.refresh();
			}
		}
	}
	function clearDiagnostics() {
		for (const doc of documents.all()) {
			connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
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
			const fileNames = new Set(parsedCommandLine.fileNames);
			if (fileNames.has(fileName) || kvp[1].getLanguageServiceDontCreate()?.__internal__.context.scriptTsLs.__internal__.getValidTextDocument(uri)) {
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
