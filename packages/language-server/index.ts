import type { LanguageServer, Position, TextDocumentIdentifier } from '@volar/language-server';
import { type Range, TextDocument } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createConnection, createServer } from '@volar/language-server/node';
import {
	createLanguage,
	createParsedCommandLine,
	createVueLanguagePlugin,
	forEachEmbeddedCode,
	getDefaultCompilerOptions,
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
import { analyze } from './lib/reactionsAnalyze';
import { getLanguageService } from './lib/reactionsAnalyzeLS';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

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

	let simpleLs: LanguageService | undefined;
	let tsserverRequestId = 0;

	const tsserverRequestHandlers = new Map<number, (res: any) => void>();

	connection.onNotification('tsserver/response', ([id, res]) => {
		tsserverRequestHandlers.get(id)?.(res);
		tsserverRequestHandlers.delete(id);
	});

	return server.initialize(
		params,
		{
			setup() {},
			async getLanguageService(uri) {
				if (uri.scheme === 'file') {
					const fileName = uri.fsPath.replace(/\\/g, '/');
					let projectInfoPromise = file2ProjectInfo.get(fileName);
					if (!projectInfoPromise) {
						projectInfoPromise = sendTsRequest<ts.server.protocol.ProjectInfo>(
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
						let ls = tsconfigProjects.get(URI.file(configFileName));
						if (!ls) {
							ls = createLs(server, configFileName);
							tsconfigProjects.set(URI.file(configFileName), ls);
						}
						return ls;
					}
				}
				return simpleLs ??= createLs(server, undefined);
			},
			getExistingLanguageServices() {
				return Promise.all([
					...tsconfigProjects.values(),
					simpleLs,
				].filter(promise => !!promise));
			},
			reload() {
				for (const ls of tsconfigProjects.values()) {
					ls.dispose();
				}
				tsconfigProjects.clear();
				if (simpleLs) {
					simpleLs.dispose();
					simpleLs = undefined;
				}
			},
		},
		createVueLanguageServicePlugins(ts, {
			collectExtractProps(...args) {
				return sendTsRequest('_vue:collectExtractProps', args);
			},
			getComponentDirectives(...args) {
				return sendTsRequest('_vue:getComponentDirectives', args);
			},
			getComponentEvents(...args) {
				return sendTsRequest('_vue:getComponentEvents', args);
			},
			getComponentNames(...args) {
				return sendTsRequest('_vue:getComponentNames', args);
			},
			getComponentProps(...args) {
				return sendTsRequest('_vue:getComponentProps', args);
			},
			getElementAttrs(...args) {
				return sendTsRequest('_vue:getElementAttrs', args);
			},
			getElementNames(...args) {
				return sendTsRequest('_vue:getElementNames', args);
			},
			getImportPathForFile(...args) {
				return sendTsRequest('_vue:getImportPathForFile', args);
			},
			getPropertiesAtLocation(...args) {
				return sendTsRequest('_vue:getPropertiesAtLocation', args);
			},
			getDocumentHighlights(fileName, position) {
				return sendTsRequest(
					'_vue:documentHighlights-full',
					{
						file: fileName,
						...{ position } as unknown as { line: number; offset: number },
						filesToSearch: [fileName],
					} satisfies ts.server.protocol.DocumentHighlightsRequestArgs,
				);
			},
			async getQuickInfoAtPosition(fileName, { line, character }) {
				const result = await sendTsRequest<ts.QuickInfo>(
					'_vue:' + ts.server.protocol.CommandTypes.Quickinfo,
					{
						file: fileName,
						line: line + 1,
						offset: character + 1,
					} satisfies ts.server.protocol.FileLocationRequestArgs,
				);
				return ts.displayPartsToString(result?.displayParts ?? []);
			},
		}),
	);

	async function sendTsRequest<T>(command: string, args: any): Promise<T | null> {
		return await new Promise<T | null>(resolve => {
			const requestId = ++tsserverRequestId;
			tsserverRequestHandlers.set(requestId, resolve);
			connection.sendNotification('tsserver/request', [requestId, command, args]);
		});
	}

	function createLs(server: LanguageServer, tsconfig: string | undefined) {
		const commonLine = tsconfig
			? createParsedCommandLine(ts, ts.sys, tsconfig)
			: {
				options: ts.getDefaultCompilerOptions(),
				vueOptions: getDefaultCompilerOptions(),
			};
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
				} else {
					language.scripts.delete(uri);
				}
			},
		);
		return createLanguageService(
			language,
			server.languageServicePlugins,
			createLanguageServiceEnvironment(server, [...server.workspaceFolders.all]),
			{ vue: { compilerOptions: commonLine.vueOptions } },
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
	if (languageService) {
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
								mapping.sourceOffsets[i],
								mapping.sourceOffsets[i] + mapping.lengths[i],
							]);
						}
					}
				}
			}
			return ranges;
		}
	}
	return [];
});

const cacheDocuments = new Map<string, [TextDocument, import('typescript').IScriptSnapshot]>();

connection.onRequest('vue/reactionsAnalyze', async (params: {
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
	} else if (cacheDocuments.has(params.textDocument.uri)) {
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
				start = document.positionAt(statements[0].getStart(result.sourceFile));
				end = document.positionAt(statements[statements.length - 1].getEnd());
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
				start = document.positionAt(statements[0].getStart(result.sourceFile));
				end = document.positionAt(statements[statements.length - 1].getEnd());
			}
			const sourceRange = getSourceRange(docs, { start, end });
			if (sourceRange) {
				subscribers.push(sourceRange);
			}
		}
	} else {
		for (const dependency of result.dependencies) {
			let start = document.positionAt(dependency.getStart(result.sourceFile));
			let end = document.positionAt(dependency.getEnd());
			if (ts.isBlock(dependency) && dependency.statements.length) {
				const { statements } = dependency;
				start = document.positionAt(statements[0].getStart(result.sourceFile));
				end = document.positionAt(statements[statements.length - 1].getEnd());
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
				start = document.positionAt(statements[0].getStart(result.sourceFile));
				end = document.positionAt(statements[statements.length - 1].getEnd());
			}
			subscribers.push({ start, end });
		}
	}
	return {
		subscribers,
		dependencies,
	};
});
