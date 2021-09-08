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

	let semanticTokensReq = 0;
	let workspaceFilesUpdateReq = 0;
	let documentUpdatedReq = 0;

	const updatedWorkspaceFiles = new Set<string>();
	const updatedUris = new Set<string>();
	const tsConfigNames = ['tsconfig.json', 'jsconfig.json'];
	const tsConfigWatchers = new Map<string, ts.FileWatcher>();
	const projects = new Map<string, Project>();
	const inferredProjects = new Map<string, Project>();
	const checkedProjects = new Set<string>();
	const progressMap = new Map<string, Promise<vscode.WorkDoneProgressServerReporter>>();
	const inferredProgressMap = new Map<string, Promise<vscode.WorkDoneProgressServerReporter>>();

	initProjects();

	documents.onDidChangeContent(change => {
		for (const [_, service] of [...projects, ...inferredProjects]) {
			service.onDocumentUpdated(change.document);
		}
	});
	documents.onDidClose(change => connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] }));

	return {
		projects,
		inferredProjects,
		get,
	};

	async function initProjects() {

		const tsConfigs = searchTsConfigs();
		const { projectProgress } = await getProjectProgress(tsConfigs, []);

		for (const tsConfig of tsConfigs) {
			updateProject(tsConfig, projectProgress[tsConfig]);
		}

		updateInferredProjects();
		updateDiagnostics(undefined);

		for (const rootPath of rootPaths) {
			ts.sys.watchDirectory!(rootPath, async fileName => {
				if (tsConfigNames.includes(upath.basename(fileName))) {
					// tsconfig.json changed
					const { projectProgress } = await getProjectProgress([fileName], []);
					clearDiagnostics();
					updateProject(fileName, projectProgress[fileName]);
					await updateInferredProjects();
					updateDiagnostics(undefined);
				}
				else if (
					fileName.endsWith('.vue')
					|| fileName.endsWith('.js')
					|| fileName.endsWith('.jsx')
					|| fileName.endsWith('.ts')
					|| fileName.endsWith('.tsx')
					|| fileName.endsWith('.json')
				) {
					// *.vue, *.ts ... changed

					const req = ++workspaceFilesUpdateReq;
					updatedWorkspaceFiles.add(fileName);

					await shared.sleep(100);

					if (req === workspaceFilesUpdateReq) {

						const changes = [...updatedWorkspaceFiles].filter(fileName => ts.sys.fileExists(fileName));

						if (changes.length) {
							for (const [_, service] of [...projects, ...inferredProjects]) {
								service.onWorkspaceFilesChanged(changes);
							}
						}
					}
				}
			}, true, { excludeDirectories: [upath.join(rootPath, '.git')] });
		}

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

		const changeDocs = [...updatedUris].map(uri => documents.get(uri)).filter(shared.notEmpty);
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

			const changeDoc = docUri ? documents.get(docUri) : undefined;
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
				onDriveFileUpdated,
				progress,
				connection,
			));
			tsConfigWatchers.set(tsConfig, ts.sys.watchFile!(tsConfig, (fileName, eventKind) => {
				if (eventKind === ts.FileWatcherEventKind.Changed) {
					clearDiagnostics();
					updateProject(tsConfig, progress);
					updateDiagnostics(undefined);
				}
			}));
		}
	}
	async function updateInferredProjects() {

		const tsConfigDirs = [...projects.keys()].map(upath.dirname);
		const inferredTsConfigs = rootPaths
			.filter(rootPath => !tsConfigDirs.includes(rootPath))
			.map(rootPath => upath.join(rootPath, 'tsconfig.json'));
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
				onDriveFileUpdated,
				inferredProjectProgress[inferredTsConfig],
				connection,
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
