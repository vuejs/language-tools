import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import { uriToFsPath, fsPathToUri } from '@volar/shared';
import { createSourceFile, SourceFile } from './sourceFile';
import { getGlobalDoc } from './virtuals/global';
import { pauseTracking, resetTracking } from '@vue/reactivity';
import * as upath from 'upath';
import type * as ts from 'typescript';
import * as ts2 from '@volar/vscode-typescript-languageservice';
import { DocumentContext, HTMLDocument } from 'vscode-html-languageservice';
import * as languageServices from './utils/languageServices';
import { HtmlApiRegisterOptions, TsApiRegisterOptions } from './types';
import { createMapper } from './utils/mapper';
import * as tsPluginApis from './tsPluginApis';
import * as tsProgramApis from './tsProgramApis';
// vue services
import * as completions from './services/completion';
import * as completionResolve from './services/completionResolve';
import * as autoClose from './services/autoClose';
import * as refAutoClose from './services/refAutoClose';
import * as hover from './services/hover';
import * as diagnostics from './services/diagnostics';
import * as formatting from './services/formatting';
import * as definitions from './services/definition';
import * as references from './services/references';
import * as rename from './services/rename';
import * as codeActions from './services/codeAction';
import * as codeActionResolve from './services/codeActionResolve';
import * as documentHighlight from './services/documentHighlight';
import * as documentSymbol from './services/documentSymbol';
import * as documentLink from './services/documentLinks';
import * as documentColor from './services/documentColor';
import * as selectionRanges from './services/selectionRanges';
import * as signatureHelp from './services/signatureHelp';
import * as colorPresentations from './services/colorPresentation';
import * as semanticTokens from './services/semanticTokens';
import * as foldingRanges from './services/foldingRanges';
import * as codeLens from './services/codeLens';
import * as codeLensResolve from './services/codeLensResolve';
import * as executeCommand from './services/executeCommand';
import * as callHierarchy from './services/callHierarchy';
import * as linkedEditingRanges from './services/linkedEditingRange';
import * as tagNameCase from './services/tagNameCase';
import * as d3 from './services/d3';
import { UriMap } from '@volar/shared';

export type NoStateLanguageService = ReturnType<typeof createNoStateLanguageService>;
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

	let vueProjectVersion: string | undefined;
	let lastScriptVersions = new Map<string, string>();
	let tsProjectVersion = 0;
	let tsProjectVersionWithoutTemplate = 0;
	let lastCompletionUpdateVersion = -1;
	let shouldSendUpdate = true;
	const documents = new UriMap<TextDocument>();
	const sourceFiles = new UriMap<SourceFile>();
	const templateScriptUpdateUris = new Set<string>();

	const tsLanguageServiceHost = createTsLanguageServiceHost();
	const tsLanguageService = ts2.createLanguageService(tsLanguageServiceHost, typescript);
	const globalDoc = getGlobalDoc(vueHost.getCurrentDirectory());
	const compilerHost = typescript.createCompilerHost(vueHost.getCompilationSettings());
	const documentContext: DocumentContext = {
		resolveReference(ref: string, base: string) {

			const resolveResult = typescript.resolveModuleName(ref, base, vueHost.getCompilationSettings(), compilerHost);
			const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;
			const dirs = new Set<string>();

			for (const failed of failedLookupLocations) {
				let path = failed;
				if (path.endsWith('index.d.ts')) {
					dirs.add(path.substr(0, path.length - '/index.d.ts'.length));
				}
				if (path.endsWith('.d.ts')) {
					path = upath.trimExt(path);
					path = upath.trimExt(path);
				}
				else {
					path = upath.trimExt(path);
				}
				if (typescript.sys.fileExists(path) || typescript.sys.fileExists(uriToFsPath(path))) {
					return path;
				}
			}
			for (const dir of dirs) {
				if (typescript.sys.directoryExists(dir) || typescript.sys.directoryExists(uriToFsPath(dir))) {
					return dir;
				}
			}

			return undefined;
		},
	}

	const mapper = createMapper(sourceFiles, tsLanguageService, getTextDocument);
	const options: TsApiRegisterOptions = {
		ts: typescript,
		sourceFiles,
		tsLanguageService,
		vueHost,
		mapper,
		documentContext,
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
		getTextDocument,
		checkProject: apiHook(() => {
			const vueImportErrors = tsLanguageService.doValidation(globalDoc.uri, { semantic: true });
			return !vueImportErrors.find(error => error.code === 2322); // Type 'false' is not assignable to type 'true'.ts(2322)
		}),
		getTsService: () => tsLanguageService,
		getGlobalDocs: () => [globalDoc],
		getSourceFile: apiHook(getSourceFile),
		getAllSourceFiles: apiHook(getAllSourceFiles),
		doValidation: apiHook(diagnostics.register(options)),
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
			onRenameFile: apiHook(doRename.onRenameFile, false),
		},
		getSemanticTokens: apiHook(semanticTokens.register(options)),
		getD3: apiHook(d3.register(options)),
		executeCommand: apiHook(executeCommand.register(options, references.register(options))),

		doHover: apiHook(hover.register(options), getShouldUpdateTemplateScript),
		doComplete: apiHook(completions.register(options), getShouldUpdateTemplateScript),

		detectTagNameCase: apiHook(tagNameCase.register(options)),
		getCodeActions: apiHook(codeActions.register(options), false),
		doCodeActionResolve: apiHook(codeActionResolve.register(options), false),
		doCompletionResolve: apiHook(completionResolve.register(options), false),
		doCodeLensResolve: apiHook(codeLensResolve.register(options), false),
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

	function getShouldUpdateTemplateScript(uri: string, pos: Position) {

		if (!isInTemplate()) {
			return false;
		}

		update(false); // update tsProjectVersionWithoutTemplate
		if (lastCompletionUpdateVersion !== tsProjectVersionWithoutTemplate) {
			lastCompletionUpdateVersion = tsProjectVersionWithoutTemplate;
			return true;
		}

		return false;

		function isInTemplate() {
			const tsRanges = mapper.ts.to(uri, pos);
			for (const tsRange of tsRanges) {
				if (tsRange.data.vueTag === 'template') {
					return true;
				}
			}
			const htmlRanges = mapper.html.to(uri, pos);
			if (htmlRanges.length) {
				return true;
			}
			return false;
		}
	}
	function apiHook<T extends (...args: any) => any>(api: T, shouldUpdateTemplateScript: boolean | ((...args: Parameters<T>) => boolean) = true) {
		const handler = {
			apply: function (target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
				if (typeof shouldUpdateTemplateScript === 'boolean') {
					update(shouldUpdateTemplateScript);
				}
				else {
					update(shouldUpdateTemplateScript.apply(null, argumentsList));
				}
				return target.apply(thisArg, argumentsList);
			}
		};
		return new Proxy<T>(api, handler);
	}
	function update(shouldUpdateTemplateScript: boolean) {
		const newVueProjectVersion = vueHost.getProjectVersion?.();
		if (newVueProjectVersion === undefined || newVueProjectVersion !== vueProjectVersion) {

			let tsFileChanged = false;
			vueProjectVersion = newVueProjectVersion;
			const oldFiles = new Set([...lastScriptVersions.keys()]);
			const newFiles = new Set([...vueHost.getScriptFileNames()]);
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
				updateTsProject(false);
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
		// @ts-ignore
		const importSuggestionsCache = typescript.Completions?.createImportSuggestionsForFileCache?.();
		const tsHost: ts2.LanguageServiceHost = {
			...vueHost,
			fileExists: vueHost.fileExists
				? fileName => {
					if (fileName.endsWith('.vue.ts')) {
						fileName = upath.trimExt(fileName);
						const isHostFile = vueHost.getScriptFileNames().includes(fileName);
						const fileExists = !!vueHost.fileExists?.(fileName);
						if (!isHostFile && fileExists) {
							vueProjectVersion += '-old'; // force update
							update(false); // create virtual files
						}
						return fileExists;
					}
					else {
						return !!vueHost.fileExists?.(fileName);
					}
				}
				: undefined,
			getProjectVersion: () => {
				pauseTracking();
				const version = vueHost.getProjectVersion?.() + ':' + tsProjectVersion.toString();
				resetTracking();
				return version;
			},
			getScriptFileNames,
			getScriptVersion,
			getScriptSnapshot,
			readDirectory: (path, extensions, exclude, include, depth) => {
				const result = vueHost.readDirectory?.(path, extensions, exclude, include, depth) ?? [];
				for (const [_, sourceFile] of sourceFiles) {
					const vuePath = uriToFsPath(sourceFile.uri);
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
			// @ts-ignore
			// TODO: crash on 'addListener' from 'node:process', reuse because TS has same problem
			getImportSuggestionsCache: () => importSuggestionsCache,
		};

		return tsHost;

		function getScriptFileNames() {
			const tsFileNames: string[] = [];
			tsFileNames.push(uriToFsPath(globalDoc.uri));
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
			if (uri === globalDoc.uri) {
				return globalDoc.version.toString();
			}
			for (const [_, sourceFile] of sourceFiles) {
				const doc = sourceFile.getTsDocuments().get(uri);
				if (doc) {
					return doc.version.toString();
				}
			}
			return vueHost.getScriptVersion(fileName);
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
			for (const [_, sourceFile] of sourceFiles) {
				const doc = sourceFile.getTsDocuments().get(uri);
				if (doc) {
					const text = doc.getText();
					const snapshot = typescript.ScriptSnapshot.fromString(text);
					scriptSnapshots.set(fileName, [version, snapshot]);
					return snapshot;
				}
			}
			let tsScript = vueHost.getScriptSnapshot(fileName);
			if (tsScript) {
				scriptSnapshots.set(fileName, [version, tsScript]);
				return tsScript;
			}
		}
	}
	function getTextDocument(uri: string): TextDocument | undefined {
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
		if (documents.has(uri)) {
			return documents.get(uri);
		}
		return tsLanguageService.getTextDocument(uri);
	}
	function getSourceFile(uri: string) {
		return sourceFiles.get(uri);
	}
	function getAllSourceFiles() {
		return [...sourceFiles.values()];
	}
	function updateSourceFiles(uris: string[], shouldUpdateTemplateScript: boolean) {
		let vueScriptsUpdated = false;
		let vueTemplateScriptUpdated = false;
		let updateNums = uris.length;
		let currentNums = 0;

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
				sourceFiles.set(uri, createSourceFile(doc, tsLanguageService, typescript, 'api', options.documentContext));
				vueScriptsUpdated = true;
			}
			else {
				const updates = sourceFile.update(doc);
				if (updates.scriptUpdated) {
					vueScriptsUpdated = true;
				}
				if (updates.templateScriptUpdated) {
					vueTemplateScriptUpdated = true;
				}
			}
			templateScriptUpdateUris.add(uri);
		}
		if (shouldUpdateTemplateScript) {
			updateNums += templateScriptUpdateUris.size;
		}
		if (vueScriptsUpdated) {
			updateTsProject(false);
		}
		if (shouldUpdateTemplateScript) {
			for (const uri of templateScriptUpdateUris) {
				if (_shouldSendUpdate) {
					onUpdate?.(currentNums / updateNums);
				}
				currentNums++;
				if (sourceFiles.get(uri)?.updateTemplateScript()) {
					vueTemplateScriptUpdated = true;
				}
			}
			templateScriptUpdateUris.clear();
		}
		if (vueTemplateScriptUpdated) {
			updateTsProject(true);
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
			updateTsProject(false);
		}
	}
	function updateTsProject(isTemplateUpdate: boolean) {
		tsProjectVersion++;
		if (!isTemplateUpdate) {
			tsProjectVersionWithoutTemplate++;
		}
	}
}
