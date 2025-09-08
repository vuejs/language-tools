import type { LanguageServer, Position, TextDocumentIdentifier } from '@volar/language-server';
import { type Range, TextDocument } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createConnection, createServer } from '@volar/language-server/node';
import {
	createLanguage,
	createParsedCommandLine,
	createParsedCommandLineByJson,
	createVueLanguagePlugin,
	forEachEmbeddedCode,
	isReferencesEnabled,
} from '@vue/language-core';
import {
	createLanguageService,
	createUriMap,
	createVueLanguageServicePlugins,
	type DocumentsAndMap,
	getSourceRange,
	type LanguageService,
} from '@vue/language-service';
import * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { analyze } from './lib/reactivityAnalyze';
import { getLanguageService } from './lib/reactivityAnalyzeLS';

const connection = createConnection();
const server = createServer(connection);
const tsserverRequestHandlers = new Map<number, (res: any) => void>();

let tsserverRequestId = 0;

connection.listen();

connection.onNotification('tsserver/response', ([id, res]) => {
	tsserverRequestHandlers.get(id)?.(res);
	tsserverRequestHandlers.delete(id);
});

connection.onInitialize(params => {
	const tsconfigProjects = createUriMap<LanguageService>();
	const file2ProjectInfo = new Map<string, Promise<ts.server.protocol.ProjectInfo | null>>();

	server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
		for (const change of changes) {
			const changeUri = URI.parse(change.uri);
			if (tsconfigProjects.has(changeUri)) {
				tsconfigProjects.get(changeUri)!.dispose();
				tsconfigProjects.delete(changeUri);
				file2ProjectInfo.clear();
			}
		}
	});

	let simpleLanguageService: LanguageService | undefined;

	return server.initialize(
		params,
		{
			setup() {},
			async getLanguageService(uri) {
				if (uri.scheme === 'file') {
					const fileName = uri.fsPath.replace(/\\/g, '/');
					let projectInfoPromise = file2ProjectInfo.get(fileName);
					if (!projectInfoPromise) {
						projectInfoPromise = sendTsServerRequest<ts.server.protocol.ProjectInfo>(
							'_vue:' + ts.server.protocol.CommandTypes.ProjectInfo,
							{
								file: fileName,
								needFileNameList: false,
							} satisfies ts.server.protocol.ProjectInfoRequestArgs,
						);
						file2ProjectInfo.set(fileName, projectInfoPromise);
					}
					const projectInfo = await projectInfoPromise;
					if (projectInfo) {
						const { configFileName } = projectInfo;
						let languageService = tsconfigProjects.get(URI.file(configFileName));
						if (!languageService) {
							languageService = createProjectLanguageService(server, configFileName);
							tsconfigProjects.set(URI.file(configFileName), languageService);
						}
						return languageService;
					}
				}
				return simpleLanguageService ??= createProjectLanguageService(server, undefined);
			},
			getExistingLanguageServices() {
				return Promise.all([
					...tsconfigProjects.values(),
					simpleLanguageService,
				].filter(promise => !!promise));
			},
			reload() {
				for (const languageService of tsconfigProjects.values()) {
					languageService.dispose();
				}
				tsconfigProjects.clear();
				if (simpleLanguageService) {
					simpleLanguageService.dispose();
					simpleLanguageService = undefined;
				}
			},
		},
		createVueLanguageServicePlugins(ts, {
			collectExtractProps(...args) {
				return sendTsServerRequest('_vue:collectExtractProps', args);
			},
			getComponentDirectives(...args) {
				return sendTsServerRequest('_vue:getComponentDirectives', args);
			},
			getComponentEvents(...args) {
				return sendTsServerRequest('_vue:getComponentEvents', args);
			},
			getComponentNames(...args) {
				return sendTsServerRequest('_vue:getComponentNames', args);
			},
			getComponentProps(...args) {
				return sendTsServerRequest('_vue:getComponentProps', args);
			},
			getComponentSlots(...args) {
				return sendTsServerRequest('_vue:getComponentSlots', args);
			},
			getElementAttrs(...args) {
				return sendTsServerRequest('_vue:getElementAttrs', args);
			},
			getElementNames(...args) {
				return sendTsServerRequest('_vue:getElementNames', args);
			},
			getImportPathForFile(...args) {
				return sendTsServerRequest('_vue:getImportPathForFile', args);
			},
			isRefAtLocation(...args) {
				return sendTsServerRequest('_vue:isRefAtLocation', args);
			},
			getDocumentHighlights(fileName, position) {
				return sendTsServerRequest(
					'_vue:documentHighlights-full',
					{
						file: fileName,
						...{ position } as unknown as { line: number; offset: number },
						filesToSearch: [fileName],
					} satisfies ts.server.protocol.DocumentHighlightsRequestArgs,
				);
			},
			getEncodedSemanticClassifications(fileName, span) {
				return sendTsServerRequest(
					'_vue:encodedSemanticClassifications-full',
					{
						file: fileName,
						...span,
						format: ts.SemanticClassificationFormat.TwentyTwenty,
					} satisfies ts.server.protocol.EncodedSemanticClassificationsRequestArgs,
				);
			},
			async getQuickInfoAtPosition(fileName, { line, character }) {
				const result = await sendTsServerRequest<ts.server.protocol.QuickInfoResponseBody>(
					'_vue:' + ts.server.protocol.CommandTypes.Quickinfo,
					{
						file: fileName,
						line: line + 1,
						offset: character + 1,
					} satisfies ts.server.protocol.FileLocationRequestArgs,
				);
				return result?.displayString;
			},
		}),
	);

	async function sendTsServerRequest<T>(command: string, args: any): Promise<T | null> {
		return await new Promise<T | null>(resolve => {
			const requestId = ++tsserverRequestId;
			tsserverRequestHandlers.set(requestId, resolve);
			connection.sendNotification('tsserver/request', [requestId, command, args]);
		});
	}

	function createProjectLanguageService(server: LanguageServer, tsconfig: string | undefined) {
		const commonLine = tsconfig && !ts.server.isInferredProjectName(tsconfig)
			? createParsedCommandLine(ts, ts.sys, tsconfig)
			: createParsedCommandLineByJson(ts, ts.sys, ts.sys.getCurrentDirectory(), {});
		const language = createLanguage<URI>(
			[
				{
					getLanguageId: uri => server.documents.get(uri)?.languageId,
				},
				createVueLanguagePlugin(
					ts,
					commonLine.options,
					commonLine.vueOptions,
					uri => uri.fsPath.replace(/\\/g, '/'),
				),
			],
			createUriMap(),
			uri => {
				const document = server.documents.get(uri);
				if (document) {
					language.scripts.set(uri, document.getSnapshot(), document.languageId);
				}
				else {
					language.scripts.delete(uri);
				}
			},
		);
		return createLanguageService(
			language,
			server.languageServicePlugins,
			createLanguageServiceEnvironment(server, [...server.workspaceFolders.all]),
			{},
		);
	}
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);

connection.onRequest('vue/interpolationRanges', async (params: {
	textDocument: TextDocumentIdentifier;
}): Promise<[number, number][]> => {
	const uri = URI.parse(params.textDocument.uri);
	const languageService = await server.project.getLanguageService(uri);
	const sourceFile = languageService.context.language.scripts.get(uri);
	if (sourceFile?.generated) {
		const ranges: [number, number][] = [];
		for (const code of forEachEmbeddedCode(sourceFile.generated.root)) {
			const codeText = code.snapshot.getText(0, code.snapshot.getLength());
			if (
				(
					code.id.startsWith('template_inline_ts_')
					&& codeText.startsWith('0 +')
					&& codeText.endsWith('+ 0;')
				)
				|| (code.id.startsWith('style_') && code.id.endsWith('_inline_ts'))
			) {
				for (const mapping of code.mappings) {
					for (let i = 0; i < mapping.sourceOffsets.length; i++) {
						ranges.push([
							mapping.sourceOffsets[i]!,
							mapping.sourceOffsets[i]! + mapping.lengths[i]!,
						]);
					}
				}
			}
		}
		return ranges;
	}
	return [];
});

const cacheDocuments = new Map<string, [TextDocument, import('typescript').IScriptSnapshot]>();

connection.onRequest('vue/reactivityAnalyze', async (params: {
	textDocument: TextDocumentIdentifier;
	position: Position;
	syncDocument?: {
		content: string;
		languageId: string;
	};
}): Promise<
	{
		subscribers: Range[];
		dependencies: Range[];
	} | undefined
> => {
	if (params.syncDocument) {
		const document = TextDocument.create(
			params.textDocument.uri,
			params.syncDocument.languageId,
			0,
			params.syncDocument.content,
		);
		const snapshot = ts.ScriptSnapshot.fromString(params.syncDocument.content);
		cacheDocuments.set(params.textDocument.uri, [document, snapshot]);
	}
	const uri = URI.parse(params.textDocument.uri);
	const languageService = await server.project.getLanguageService(uri);
	const sourceScript = languageService.context.language.scripts.get(uri);
	let document: TextDocument | undefined;
	let snapshot: import('typescript').IScriptSnapshot | undefined;
	if (sourceScript) {
		document = languageService.context.documents.get(sourceScript.id, sourceScript.languageId, sourceScript.snapshot);
		snapshot = sourceScript.snapshot;
	}
	else if (cacheDocuments.has(params.textDocument.uri)) {
		const [doc, snap] = cacheDocuments.get(params.textDocument.uri)!;
		document = doc;
		snapshot = snap;
	}
	if (!document || !snapshot) {
		return;
	}
	let offset = document.offsetAt(params.position);
	if (sourceScript?.generated) {
		const serviceScript = sourceScript.generated.languagePlugin.typescript?.getServiceScript(
			sourceScript.generated.root,
		);
		if (!serviceScript) {
			return;
		}
		const map = languageService.context.language.maps.get(serviceScript.code, sourceScript);
		let embeddedOffset: number | undefined;
		for (const [mapped, mapping] of map.toGeneratedLocation(offset)) {
			if (isReferencesEnabled(mapping.data)) {
				embeddedOffset = mapped;
				break;
			}
		}
		if (embeddedOffset === undefined) {
			return;
		}
		offset = embeddedOffset;

		const embeddedUri = languageService.context.encodeEmbeddedDocumentUri(sourceScript.id, serviceScript.code.id);
		document = languageService.context.documents.get(
			embeddedUri,
			serviceScript.code.languageId,
			serviceScript.code.snapshot,
		);
		snapshot = serviceScript.code.snapshot;
	}
	const { languageService: tsLs, fileName } = getLanguageService(ts, snapshot, document.languageId);
	const result = analyze(ts, tsLs, fileName, offset);
	if (!result) {
		return;
	}
	const subscribers: Range[] = [];
	const dependencies: Range[] = [];
	if (sourceScript?.generated) {
		const serviceScript = sourceScript.generated.languagePlugin.typescript?.getServiceScript(
			sourceScript.generated.root,
		);
		if (!serviceScript) {
			return;
		}
		const docs: DocumentsAndMap = [
			languageService.context.documents.get(sourceScript.id, sourceScript.languageId, sourceScript.snapshot),
			document,
			languageService.context.language.maps.get(serviceScript.code, sourceScript),
		];
		for (const dependency of result.dependencies) {
			let start = document.positionAt(dependency.getStart(result.sourceFile));
			let end = document.positionAt(dependency.getEnd());
			if (ts.isBlock(dependency) && dependency.statements.length) {
				const { statements } = dependency;
				start = document.positionAt(statements[0]!.getStart(result.sourceFile));
				end = document.positionAt(statements[statements.length - 1]!.getEnd());
			}
			const sourceRange = getSourceRange(docs, { start, end });
			if (sourceRange) {
				dependencies.push(sourceRange);
			}
		}
		for (const subscriber of result.subscribers) {
			if (!subscriber.sideEffectInfo) {
				continue;
			}
			let start = document.positionAt(subscriber.sideEffectInfo.handler.getStart(result.sourceFile));
			let end = document.positionAt(subscriber.sideEffectInfo.handler.getEnd());
			if (ts.isBlock(subscriber.sideEffectInfo.handler) && subscriber.sideEffectInfo.handler.statements.length) {
				const { statements } = subscriber.sideEffectInfo.handler;
				start = document.positionAt(statements[0]!.getStart(result.sourceFile));
				end = document.positionAt(statements[statements.length - 1]!.getEnd());
			}
			const sourceRange = getSourceRange(docs, { start, end });
			if (sourceRange) {
				subscribers.push(sourceRange);
			}
		}
	}
	else {
		for (const dependency of result.dependencies) {
			let start = document.positionAt(dependency.getStart(result.sourceFile));
			let end = document.positionAt(dependency.getEnd());
			if (ts.isBlock(dependency) && dependency.statements.length) {
				const { statements } = dependency;
				start = document.positionAt(statements[0]!.getStart(result.sourceFile));
				end = document.positionAt(statements[statements.length - 1]!.getEnd());
			}
			dependencies.push({ start, end });
		}
		for (const subscriber of result.subscribers) {
			if (!subscriber.sideEffectInfo) {
				continue;
			}
			let start = document.positionAt(subscriber.sideEffectInfo.handler.getStart(result.sourceFile));
			let end = document.positionAt(subscriber.sideEffectInfo.handler.getEnd());
			if (ts.isBlock(subscriber.sideEffectInfo.handler) && subscriber.sideEffectInfo.handler.statements.length) {
				const { statements } = subscriber.sideEffectInfo.handler;
				start = document.positionAt(statements[0]!.getStart(result.sourceFile));
				end = document.positionAt(statements[statements.length - 1]!.getEnd());
			}
			subscribers.push({ start, end });
		}
	}
	return {
		subscribers,
		dependencies,
	};
});
