import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, fsPathToUri } from '@volar/shared';
import { createSourceFile, SourceFile } from './sourceFile';
import { getGlobalDoc, getGlobalDTs } from './virtuals/global';
import { SearchTexts } from './utils/string';
import { computed, pauseTracking, resetTracking, ref } from '@vue/reactivity';
import { MapedMode, MapedRange, Mapping, TsMappingData, TsSourceMap } from './utils/sourceMaps';
import * as upath from 'upath';
import type * as ts from 'typescript';
import * as ts2 from '@volar/vscode-typescript-languageservice';
import { HTMLDocument } from 'vscode-html-languageservice';
import * as languageServices from './utils/languageServices';
import { HtmlApiRegisterOptions, TsApiRegisterOptions } from './types';
import { createMapper } from './utils/mapper';
import * as tsPluginApis from './tsPluginApis';
import * as tsProgramApis from './tsProgramApis';
// vue services
import * as completions from './services/completions';
import * as completionResolve from './services/completionResolve';
import * as autoClose from './services/autoClose';
import * as refAutoClose from './services/refAutoClose';
import * as embeddedDocument from './services/embeddedDocument';
import * as hover from './services/hover';
import * as diagnostics from './services/diagnostics';
import * as formatting from './services/formatting';
import * as definitions from './services/definitions';
import * as references from './services/references';
import * as rename from './services/rename';
import * as codeActions from './services/codeActions';
import * as documentHighlight from './services/documentHighlight';
import * as documentSymbol from './services/documentSymbol';
import * as documentLink from './services/documentLink';
import * as documentColor from './services/documentColor';
import * as selectionRanges from './services/selectionRanges';
import * as signatureHelp from './services/signatureHelp';
import * as colorPresentations from './services/colorPresentations';
import * as semanticTokens from './services/semanticTokens';
import * as foldingRanges from './services/foldingRanges';
import * as codeLens from './services/codeLens';
import * as codeLensResolve from './services/codeLensResolve';
import * as executeCommand from './services/executeCommand';
import * as callHierarchy from './services/callHierarchy';
import * as linkedEditingRanges from './services/linkedEditingRanges';
import * as d3 from './services/d3';

export type LanguageService = ReturnType<typeof createLanguageService>;
export type LanguageServiceHost = ts.LanguageServiceHost;
export type Dependencies = {
	typescript: typeof import('typescript'),
	// TODO: vscode-html-languageservice
	// TODO: vscode-css-languageservice
};

export function createNoStateLanguageService({ typescript }: Dependencies) {
	const cache = new Map<string, [number, HTMLDocument]>();
	const options: HtmlApiRegisterOptions = {
		ts: typescript,
		getHtmlDocument,
	};
	return {
		doFormatting: formatting.register(options),
		getFoldingRanges: foldingRanges.register(options),
		doAutoClose: autoClose.register(options),
		findLinkedEditingRanges: linkedEditingRanges.register(options),
	}
	function getHtmlDocument(document: TextDocument) {
		const _cache = cache.get(document.uri);
		if (_cache) {
			const [cacheVersion, cacheHtmlDoc] = _cache;
			if (cacheVersion === document.version) {
				return cacheHtmlDoc;
			}
		}
		const htmlDoc = languageServices.html.parseHTMLDocument(document);
		cache.set(document.uri, [document.version, htmlDoc]);
		return htmlDoc;
	}
}
export function createLanguageService(
	vueHost: LanguageServiceHost,
	{ typescript }: Dependencies,
	onUpdate?: (progress: number) => void,
	isTsPlugin = false,
) {

	let extraProjectVersion = 0;
	let lastProjectVersion: string | undefined;
	let lastScriptVersions = new Map<string, string>();
	let tsProjectVersion = ref(0);
	let dtsMode = ref(false);
	let initTemplateScript = false; // html components completion require template data
	let shouldCheckGlobalComponentsUpdate = false;
	let shouldSendUpdate = true;
	const documents = new Map<string, TextDocument>();
	const sourceFiles = new Map<string, SourceFile>();
	const templateScriptUpdateUris = new Set<string>();
	const extraVueFileNames = new Set<string>();

	const tsLanguageServiceHost = createTsLanguageServiceHost();
	const tsLanguageService = ts2.createLanguageService(tsLanguageServiceHost, typescript);

	// TODO: refactor
	const globalDTsDoc = getGlobalDTs(vueHost.getCurrentDirectory());
	const globalDoc = getGlobalDoc(vueHost.getCurrentDirectory());
	const globalComponentCalls = computed(() => {
		if (isTsPlugin) return [];
		{ // watching
			tsProjectVersion.value
		}
		const items = tsLanguageService.prepareCallHierarchy(globalDoc.uri, globalDoc.positionAt(globalDoc.getText().indexOf(SearchTexts.AppComponentCall)));
		return items.map(tsLanguageService.provideCallHierarchyIncomingCalls).flat().filter(item => item.from.uri !== globalDoc.uri);
	});
	const globalComponentCallsData = computed(() => {

		const calls = globalComponentCalls.value;
		const result = new Map<string, (MapedRange & { text: string })[][]>();

		for (const call of calls) {

			const script = vueHost.getScriptSnapshot(uriToFsPath(call.from.uri));
			if (!script) continue;

			const docLength = script.getLength();
			const doc = TextDocument.create(call.from.uri, 'typescript', 0, script.getText(0, docLength));
			const rangeText = ' '.repeat(doc.offsetAt(call.from.range.start)) + doc.getText(call.from.range);
			const rangeAst = typescript.createSourceFile(uriToFsPath(call.from.uri), rangeText, typescript.ScriptTarget.Latest);
			const offsets = new Set(call.fromRanges.map(range => doc.offsetAt(range.start)));

			if (!result.has(call.from.uri)) {
				result.set(call.from.uri, []);
			}
			const callArgs = result.get(call.from.uri)!;

			checkNode(rangeAst);

			function checkNode(node: ts.Node) {
				if (
					typescript.isCallExpression(node)
					&& typescript.isPropertyAccessExpression(node.expression)
					&& offsets.has(node.expression.name.getStart(rangeAst)) // is app.component(...) call
					&& node.arguments.length >= 2
				) {
					const args = node.arguments.map(arg => ({
						text: arg.getText(rangeAst),
						start: arg.getStart(rangeAst),
						end: arg.getStart(rangeAst) + arg.getWidth(rangeAst),
					}));
					callArgs.push(args);
				}
				else {
					node.forEachChild(child => {
						checkNode(child);
					});
				}
			}
		}

		return result;
	});
	const globalComponentCallsGen = computed(() => {
		globalComponentCallsGenVersion = '';
		const data = globalComponentCallsData.value;
		const result = new Map<string, {
			addText: string,
			version: string,
			sourceMap: TsSourceMap,
		}>();
		for (const [uri, argsArr] of data) {

			const script = vueHost.getScriptSnapshot(uriToFsPath(uri));
			if (!script) continue;

			const docLength = script.getLength();
			let addText = '\n';

			for (let i = 0; i < argsArr.length; i++) {
				const args = argsArr[i];
				addText += `const __VLS_${i} = ${args[1].text};\n`;
			}

			addText += '\ndeclare global { interface __VLS_GlobalComponents {\n';

			const mappings: Mapping<TsMappingData>[] = [];
			mappings.push({
				data: {
					vueTag: 'script',
					capabilities: {},
				},
				mode: MapedMode.Offset,
				sourceRange: {
					start: 0,
					end: docLength,
				},
				targetRange: {
					start: 0,
					end: docLength,
				},
			});
			for (let i = 0; i < argsArr.length; i++) {
				const args = argsArr[i];
				mappingText(args[0].start, args[0].end, args[0].text);
				addText += `: typeof __VLS_${i};\n`;
			}

			addText += `} }\n`;

			const fullText = script.getText(0, docLength) + addText;
			const doc = TextDocument.create(uri, 'typescript', 0, fullText);
			const sourceMap = new TsSourceMap(doc, doc, false, { foldingRanges: false, formatting: false, documentSymbol: false });
			for (const maped of mappings) {
				sourceMap.add(maped);
			}

			const fullVersion = typescript.sys.createHash?.(fullText) ?? fullText;
			globalComponentCallsGenVersion += uri + ':' + fullVersion;
			result.set(uri, {
				addText,
				version: fullVersion,
				sourceMap,
			});

			function mappingText(start: number, end: number, text: string) {
				const _start = docLength + addText.length;
				addText += text;
				const _end = docLength + addText.length;
				mappings.push({
					data: {
						vueTag: 'script',
						capabilities: {
							references: true,
							referencesCodeLens: true,
							// TODO: rename
						},
					},
					mode: MapedMode.Offset,
					sourceRange: {
						start: start,
						end: end,
					},
					targetRange: {
						start: _start,
						end: _end,
					},
				});
			}
		}

		return result;
	});
	let _globalComponentCallsGen: typeof globalComponentCallsGen.value = new Map();
	let globalComponentCallsGenVersion = '';

	const mapper = createMapper(sourceFiles, tsLanguageService, getTextDocument, () => _globalComponentCallsGen);
	const options: TsApiRegisterOptions = {
		ts: typescript,
		sourceFiles,
		tsLanguageService,
		vueHost,
		getGlobalTsSourceMaps: () => _globalComponentCallsGen,
		mapper,
	};
	const _callHierarchy = callHierarchy.register(options);
	const findDefinition = definitions.register(options);
	const doRename = rename.register(options);

	// ts plugin proxy
	const _tsPluginApis = tsPluginApis.register(options);
	const tsPlugin: Partial<ts.LanguageService> = {
		getSemanticDiagnostics: apiHook(tsLanguageService.raw.getSemanticDiagnostics, false),
		getEncodedSemanticClassifications: apiHook(tsLanguageService.raw.getEncodedSemanticClassifications, false),
		getCompletionsAtPosition: apiHook(_tsPluginApis.getCompletionsAtPosition, false),
		getCompletionEntryDetails: apiHook(tsLanguageService.raw.getCompletionEntryDetails, false), // not sure
		getCompletionEntrySymbol: apiHook(tsLanguageService.raw.getCompletionEntrySymbol, false), // not sure
		getQuickInfoAtPosition: apiHook(tsLanguageService.raw.getQuickInfoAtPosition, false),
		getSignatureHelpItems: apiHook(tsLanguageService.raw.getSignatureHelpItems, false),
		getRenameInfo: apiHook(tsLanguageService.raw.getRenameInfo, false),
		findRenameLocations: apiHook(_tsPluginApis.findRenameLocations, true),
		getDefinitionAtPosition: apiHook(_tsPluginApis.getDefinitionAtPosition, false),
		getDefinitionAndBoundSpan: apiHook(_tsPluginApis.getDefinitionAndBoundSpan, false),
		getTypeDefinitionAtPosition: apiHook(_tsPluginApis.getTypeDefinitionAtPosition, false),
		getImplementationAtPosition: apiHook(_tsPluginApis.getImplementationAtPosition, false),
		getReferencesAtPosition: apiHook(_tsPluginApis.getReferencesAtPosition, true),
		findReferences: apiHook(_tsPluginApis.findReferences, true),

		// TODO: now is handle by vue server
		// prepareCallHierarchy: apiHook(tsLanguageService.rawLs.prepareCallHierarchy, false),
		// provideCallHierarchyIncomingCalls: apiHook(tsLanguageService.rawLs.provideCallHierarchyIncomingCalls, false),
		// provideCallHierarchyOutgoingCalls: apiHook(tsLanguageService.rawLs.provideCallHierarchyOutgoingCalls, false),
		// getEditsForFileRename: apiHook(tsLanguageService.rawLs.getEditsForFileRename, false),

		// TODO
		// getCodeFixesAtPosition: apiHook(tsLanguageService.rawLs.getCodeFixesAtPosition, false),
		// getCombinedCodeFix: apiHook(tsLanguageService.rawLs.getCombinedCodeFix, false),
		// applyCodeActionCommand: apiHook(tsLanguageService.rawLs.applyCodeActionCommand, false),
		// getApplicableRefactors: apiHook(tsLanguageService.rawLs.getApplicableRefactors, false),
		// getEditsForRefactor: apiHook(tsLanguageService.rawLs.getEditsForRefactor, false),
	};

	// ts program proxy
	const tsProgram = tsLanguageService.raw.getProgram();
	if (!tsProgram) throw '!tsProgram';

	const tsProgramApis_2 = tsProgramApis.register(options);
	const tsProgramApis_3: Partial<typeof tsProgram> = {
		emit: apiHook(tsProgramApis_2.emit),
		getRootFileNames: apiHook(tsProgramApis_2.getRootFileNames),
		getSemanticDiagnostics: apiHook(tsProgramApis_2.getSemanticDiagnostics),
		getSyntacticDiagnostics: apiHook(tsProgramApis_2.getSyntacticDiagnostics),
		getGlobalDiagnostics: apiHook(tsProgramApis_2.getGlobalDiagnostics),
	};
	const tsProgramProxy = new Proxy(tsProgram, {
		get: (target: any, property: keyof typeof tsProgram) => {
			return tsProgramApis_3[property] || target[property];
		},
	});

	return {
		rootPath: vueHost.getCurrentDirectory(),
		tsPlugin,
		tsProgramProxy,
		setDtsMode: (_dtsMode: boolean) => {
			dtsMode.value = _dtsMode;
			tsProjectVersion.value++;
		},
		getTextDocument,
		checkProject: apiHook(() => {
			const vueImportErrors = tsLanguageService.doValidation(globalDoc.uri, { semantic: true });
			return !vueImportErrors.find(error => error.code === 2305); // Module '"__VLS_vue"' has no exported member '*'.ts(2305)
		}),
		getTsService: () => tsLanguageService,
		getGlobalDocs: () => [globalDoc, globalDTsDoc],
		getSourceFile: apiHook(getSourceFile),
		getAllSourceFiles: apiHook(getAllSourceFiles),
		doValidation: apiHook(diagnostics.register(options)),
		doHover: apiHook(hover.register(options)),
		findDefinition: apiHook(findDefinition.on),
		findReferences: apiHook(references.register(options)),
		findTypeDefinition: apiHook(findDefinition.onType),
		callHierarchy: {
			onPrepare: apiHook(_callHierarchy.onPrepare),
			onIncomingCalls: apiHook(_callHierarchy.onIncomingCalls),
			onOutgoingCalls: apiHook(_callHierarchy.onOutgoingCalls),
		},
		rename: {
			onPrepare: apiHook(doRename.onPrepare),
			doRename: apiHook(doRename.doRename),
			onRenameFile: apiHook(doRename.onRenameFile),
		},
		getSemanticTokens: apiHook(semanticTokens.register(options)),
		getD3: apiHook(d3.register(options)),
		getCodeActions: apiHook(codeActions.register(options), false),
		doExecuteCommand: apiHook(executeCommand.register(options), false),
		doComplete: apiHook(completions.register(options), false),
		doCompletionResolve: apiHook(completionResolve.register(options), false),
		doCodeLensResolve: apiHook(codeLensResolve.register(options), false),
		getEmbeddedDocument: apiHook(embeddedDocument.register(options), false),
		getSignatureHelp: apiHook(signatureHelp.register(options), false),
		getSelectionRanges: apiHook(selectionRanges.register(options), false),
		getColorPresentations: apiHook(colorPresentations.register(options), false),
		getCodeLens: apiHook(codeLens.register(options), false),
		findDocumentHighlights: apiHook(documentHighlight.register(options), false),
		findDocumentSymbols: apiHook(documentSymbol.register(options), false),
		findDocumentLinks: apiHook(documentLink.register(options), false),
		findDocumentColors: apiHook(documentColor.register(options), false),
		doRefAutoClose: apiHook(refAutoClose.register(options), false),
		...createNoStateLanguageService({ typescript }),
		dispose: tsLanguageService.dispose,
	};

	function apiHook<T extends Function>(api: T, shouldUpdateTemplateScript = true) {
		const handler = {
			apply: function (target: Function, thisArg: any, argumentsList: any[]) {
				if (!initTemplateScript && !isTsPlugin) {
					initTemplateScript = true;
					shouldUpdateTemplateScript = true;
				}
				update(shouldUpdateTemplateScript);
				return target.apply(thisArg, argumentsList);
			}
		};
		return new Proxy<T>(api, handler);
	}
	function update(shouldUpdateTemplateScript: boolean) {
		const currentVersion = vueHost.getProjectVersion?.() + ':' + extraProjectVersion;
		if (currentVersion === undefined || currentVersion !== lastProjectVersion) {

			let tsFileChanged = false;
			lastProjectVersion = currentVersion;
			const oldFiles = new Set([...lastScriptVersions.keys()]);
			const newFiles = new Set([...vueHost.getScriptFileNames(), ...extraVueFileNames]);
			const removes: string[] = [];
			const adds: string[] = [];
			const updates: string[] = [];

			for (const fileName of oldFiles) {
				if (!newFiles.has(fileName)) {
					if (fileName.endsWith('.vue')) {
						removes.push(fileName);
					}
					else {
						tsFileChanged = true;
					}
					lastScriptVersions.delete(fileName);
				}
			}
			for (const fileName of newFiles) {
				if (!oldFiles.has(fileName)) {
					if (fileName.endsWith('.vue')) {
						adds.push(fileName);
					}
					else {
						tsFileChanged = true;
					}
					lastScriptVersions.set(fileName, vueHost.getScriptVersion(fileName));
				}
			}
			for (const fileName of oldFiles) {
				if (newFiles.has(fileName)) {
					const oldVersion = lastScriptVersions.get(fileName);
					const newVersion = vueHost.getScriptVersion(fileName);
					if (oldVersion !== newVersion) {
						if (fileName.endsWith('.vue')) {
							updates.push(fileName);
						}
						else {
							tsFileChanged = true;
						}
						lastScriptVersions.set(fileName, newVersion);
					}
				}
			}

			if (tsFileChanged) {
				shouldCheckGlobalComponentsUpdate = true;
				tsProjectVersion.value++;
				updates.length = 0;
				for (const fileName of oldFiles) {
					if (newFiles.has(fileName)) {
						if (fileName.endsWith('.vue')) {
							updates.push(fileName);
						}
					}
				}
			}

			const finalUpdates = adds.concat(updates);

			if (removes.length) {
				unsetSourceFiles(removes.map(fsPathToUri));
			}
			if (finalUpdates.length) {
				updateSourceFiles(finalUpdates.map(fsPathToUri), shouldUpdateTemplateScript)
			}
		}
		else if (shouldUpdateTemplateScript && templateScriptUpdateUris.size) {
			updateSourceFiles([], shouldUpdateTemplateScript)
		}
	}
	function createTsLanguageServiceHost() {
		const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
		const tsHost: ts2.LanguageServiceHost = {
			...vueHost,
			fileExists: fileName => {
				if (vueHost.fileExists?.(fileName)) {
					return true;
				}
				if (fileName.endsWith('.vue.ts')) {
					const vueFileName = upath.trimExt(fileName);
					if (!extraVueFileNames.has(vueFileName) && typescript.sys.fileExists(vueFileName)) {
						extraVueFileNames.add(vueFileName);
						extraProjectVersion++;
						update(false);
						return true;
					}
				}
				const uri = fsPathToUri(fileName);
				for (const vueFileName of extraVueFileNames) {
					const vueFileUri = fsPathToUri(vueFileName);
					const sourceFile = sourceFiles.get(vueFileUri);
					if (sourceFile?.getTsDocuments().has(uri)) {
						return true;
					}
				}
				return false;
			},
			getProjectVersion: () => {
				pauseTracking();
				const version = vueHost.getProjectVersion?.() + ':' + extraProjectVersion + ':' + tsProjectVersion.value.toString();
				resetTracking();
				return version;
			},
			getScriptFileNames,
			getScriptVersion,
			getScriptSnapshot,
			readDirectory: (path, extensions, exclude, include, depth) => {
				const result = typescript.sys.readDirectory(path, extensions, exclude, include, depth);
				for (const [uri] of sourceFiles) {
					const vuePath = uriToFsPath(uri);
					const vuePath2 = upath.join(path, upath.basename(vuePath));
					if (upath.relative(path.toLowerCase(), vuePath.toLowerCase()).startsWith('..')) {
						continue;
					}
					if (!depth && vuePath.toLowerCase() === vuePath2.toLowerCase()) {
						result.push(vuePath2);
					}
					else if (depth) {
						result.push(vuePath2); // TODO: depth num
					}
				}
				return result;
			},
		};

		return tsHost;

		function getScriptFileNames() {
			const tsFileNames: string[] = [];
			tsFileNames.push(uriToFsPath(globalDoc.uri));
			tsFileNames.push(uriToFsPath(globalDTsDoc.uri));
			for (const fileName of vueHost.getScriptFileNames()) {
				const uri = fsPathToUri(fileName);
				const sourceFile = sourceFiles.get(uri);
				if (sourceFile) {
					for (const [uri] of sourceFile.getTsDocuments()) {
						tsFileNames.push(uriToFsPath(uri)); // virtual .ts
					}
				}
				if (isTsPlugin) {
					tsFileNames.push(fileName); // .vue + .ts
				}
				else if (!sourceFile && !fileName.endsWith('.vue')) {
					tsFileNames.push(fileName); // .ts
				}
			}
			return tsFileNames;
		}
		function getScriptVersion(fileName: string) {
			const uri = fsPathToUri(fileName);
			const addVersion = _globalComponentCallsGen.get(uri)?.version ?? '';
			if (uri === globalDoc.uri) {
				return globalDoc.version.toString() + addVersion;
			}
			if (uri === globalDTsDoc.uri) {
				return globalDTsDoc.version.toString() + addVersion;
			}
			for (const [_, sourceFile] of sourceFiles) {
				const doc = sourceFile.getTsDocuments().get(uri);
				if (doc) {
					return doc.version.toString() + addVersion;
				}
			}
			return vueHost.getScriptVersion(fileName) + addVersion;
		}
		function getScriptSnapshot(fileName: string) {
			const version = getScriptVersion(fileName);
			const cache = scriptSnapshots.get(fileName);
			if (cache && cache[0] === version) {
				return cache[1];
			}
			const uri = fsPathToUri(fileName);
			if (uri === globalDoc.uri) {
				const text = globalDoc.getText();
				const snapshot = typescript.ScriptSnapshot.fromString(text);
				scriptSnapshots.set(fileName, [version, snapshot]);
				return snapshot;
			}
			if (uri === globalDTsDoc.uri) {
				const text = globalDTsDoc.getText();
				const snapshot = typescript.ScriptSnapshot.fromString(text);
				scriptSnapshots.set(fileName, [version, snapshot]);
				return snapshot;
			}
			const addText = _globalComponentCallsGen.get(uri)?.addText ?? '';
			for (const [_, sourceFile] of sourceFiles) {
				const doc = sourceFile.getTsDocuments().get(uri);
				if (doc) {
					const text = doc.getText() + addText;
					const snapshot = typescript.ScriptSnapshot.fromString(text);
					scriptSnapshots.set(fileName, [version, snapshot]);
					return snapshot;
				}
			}
			let tsScript = vueHost.getScriptSnapshot(fileName);
			if (tsScript) {
				if (addText !== '') {
					tsScript = typescript.ScriptSnapshot.fromString(tsScript.getText(0, tsScript.getLength()) + addText);
				}
				scriptSnapshots.set(fileName, [version, tsScript]);
				return tsScript;
			}
		}
	}
	function getTextDocument(uri: string): TextDocument | undefined {
		const doc = tsLanguageService.getTextDocument(uri);
		if (doc) return doc;

		const fileName = uriToFsPath(uri);
		const version = Number(vueHost.getScriptVersion(fileName));
		if (!documents.has(uri) || documents.get(uri)!.version !== version) {
			const scriptSnapshot = vueHost.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, uri.endsWith('.vue') ? 'vue' : 'typescript', version, scriptText);
				documents.set(uri, document);
			}
		}
		return documents.get(uri);
	}
	function getSourceFile(uri: string) {
		return sourceFiles.get(uri);
	}
	function getAllSourceFiles() {
		return [...sourceFiles.values()];
	}
	function updateSourceFiles(uris: string[], shouldUpdateTemplateScript: boolean) {
		let vueScriptsUpdated = false;
		let vueTemplageScriptUpdated = false;
		let updateNums = uris.length;
		let currentNums = 0;
		if (shouldUpdateTemplateScript) {
			updateNums += templateScriptUpdateUris.size;
		}

		const _shouldSendUpdate = shouldSendUpdate;
		if (shouldUpdateTemplateScript) {
			shouldSendUpdate = false;
		}

		for (const uri of uris) {
			if (_shouldSendUpdate) {
				onUpdate?.(currentNums / updateNums);
			}
			currentNums++;

			const sourceFile = sourceFiles.get(uri);
			const doc = getTextDocument(uri);
			if (!doc) continue;
			if (!sourceFile) {
				sourceFiles.set(uri, createSourceFile(doc, tsLanguageService, typescript, dtsMode));
				vueScriptsUpdated = true;
			}
			else {
				const updates = sourceFile.update(doc);
				if (updates.scriptUpdated) {
					vueScriptsUpdated = true;
				}
				if (updates.templateScriptUpdated) {
					vueTemplageScriptUpdated = true;
				}
			}
			templateScriptUpdateUris.add(uri);
		}
		if (vueScriptsUpdated) {
			tsProjectVersion.value++;
		}
		if (shouldUpdateTemplateScript) {
			if (shouldCheckGlobalComponentsUpdate) {
				shouldCheckGlobalComponentsUpdate = false;
				const _version = globalComponentCallsGenVersion;
				_globalComponentCallsGen = globalComponentCallsGen.value;
				if (_version !== globalComponentCallsGenVersion) {
					tsProjectVersion.value++;
				}
			}

			for (const uri of templateScriptUpdateUris) {
				if (_shouldSendUpdate) {
					onUpdate?.(currentNums / updateNums);
				}
				currentNums++;

				const sourceFile = sourceFiles.get(uri);
				if (!sourceFile) continue;
				if (sourceFile.updateTemplateScript()) {
					vueTemplageScriptUpdated = true;
				}
			}
			templateScriptUpdateUris.clear();
		}
		if (vueTemplageScriptUpdated) {
			tsProjectVersion.value++;
		}
		if (_shouldSendUpdate) {
			onUpdate?.(1);
		}
	}
	function unsetSourceFiles(uris: string[]) {
		let updated = false;
		for (const uri of uris) {
			if (sourceFiles.delete(uri)) {
				updated = true;
			}
		}
		if (updated) {
			tsProjectVersion.value++;
		}
	}
}
