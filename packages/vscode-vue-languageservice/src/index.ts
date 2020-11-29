import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, fsPathToUri } from '@volar/shared';
import { createSourceFile, SourceFile } from './sourceFiles';
import { getGlobalDoc } from './virtuals/global';
import { SearchTexts } from './virtuals/common';
import { computed, pauseTracking, resetTracking, ref, effect } from '@vue/reactivity';
import * as upath from 'upath';
import * as ts from 'typescript';
import * as ts2 from '@volar/vscode-typescript-languageservice';
import * as completions from './services/completions';
import * as completionResolve from './services/completionResolve';
import * as autoClose from './services/autoClose';
import * as embeddedDocument from './services/embeddedDocument';
import * as hover from './services/hover';
import * as diagnostics from './services/diagnostics';
import * as rangeFormatting from './services/rangeFormatting';
import * as formatting from './services/formatting';
import * as definitions from './services/definitions';
import * as references from './services/references';
import * as typeDefinitions from './services/typeDefinitions';
import * as rename from './services/rename';
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

export { LanguageServiceHost } from 'typescript';
export type LanguageService = ReturnType<typeof createLanguageService>;
export { triggerCharacter } from './services/completions';
export * from './utils/sourceMaps';
export * from './commands';
export { setScriptSetupRfc } from './virtuals/script';

export function getSemanticTokensLegend() {
	return semanticTokens.semanticTokenLegend;
}
export function createLanguageService(vueHost: ts.LanguageServiceHost) {

	let lastProjectVersion: string | undefined;
	let lastScriptVersions = new Map<string, string>();
	let tsProjectVersion = ref(0);
	let initTemplateScript = false; // html components completion require template data
	const documents = new Map<string, TextDocument>();
	const sourceFiles = new Map<string, SourceFile>();
	const templateScriptUpdateUris = new Set<string>();

	const tsLanguageServiceHost = createTsLanguageServiceHost();
	const tsLanguageService = ts2.createLanguageService(tsLanguageServiceHost);

	const globalDoc = getGlobalDoc(vueHost.getCurrentDirectory());
	const globalHtmlElements = computed(() => {
		{ // watching
			tsProjectVersion.value
		}
		return tsLanguageService.doComplete(globalDoc, globalDoc.positionAt(globalDoc.getText().indexOf(SearchTexts.HtmlElements)));
	});
	const globalAttrs = computed(() => {
		{ // watching
			tsProjectVersion.value
		}
		return tsLanguageService.doComplete(globalDoc, globalDoc.positionAt(globalDoc.getText().indexOf(SearchTexts.GlobalAttrs)));
	});

	const _callHierarchy = callHierarchy.register(sourceFiles, tsLanguageService);

	return {
		rootPath: vueHost.getCurrentDirectory(),
		getGlobalDoc: () => globalDoc,
		getSourceFile: apiHook(getSourceFile),
		getAllSourceFiles: apiHook(getAllSourceFiles),
		doValidation: apiHook(diagnostics.register(sourceFiles)),
		doHover: apiHook(hover.register(sourceFiles, tsLanguageService)),
		doRangeFormatting: apiHook(rangeFormatting.register(sourceFiles, tsLanguageService)),
		doFormatting: apiHook(formatting.register(sourceFiles, tsLanguageService)),
		findDefinition: apiHook(definitions.register(sourceFiles, tsLanguageService)),
		findReferences: apiHook(references.register(sourceFiles, tsLanguageService)),
		findTypeDefinition: apiHook(typeDefinitions.register(sourceFiles, tsLanguageService)),
		prepareCallHierarchy: apiHook(_callHierarchy.prepareCallHierarchy),
		provideCallHierarchyIncomingCalls: apiHook(_callHierarchy.provideCallHierarchyIncomingCalls),
		provideCallHierarchyOutgoingCalls: apiHook(_callHierarchy.provideCallHierarchyOutgoingCalls),
		doRename: apiHook(rename.register(sourceFiles, tsLanguageService)),
		getSemanticTokens: apiHook(semanticTokens.register(sourceFiles, tsLanguageService)),
		doExecuteCommand: apiHook(executeCommand.register(sourceFiles, tsLanguageService), false),
		doComplete: apiHook(completions.register(sourceFiles, tsLanguageService), false),
		doCompletionResolve: apiHook(completionResolve.register(sourceFiles, tsLanguageService), false),
		doAutoClose: apiHook(autoClose.register(sourceFiles), false),
		getEmbeddedDocument: apiHook(embeddedDocument.register(sourceFiles), false),
		getSignatureHelp: apiHook(signatureHelp.register(sourceFiles, tsLanguageService), false),
		getSelectionRanges: apiHook(selectionRanges.register(sourceFiles, tsLanguageService), false),
		getColorPresentations: apiHook(colorPresentations.register(sourceFiles), false),
		getCodeLens: apiHook(codeLens.register(sourceFiles), false),
		doCodeLensResolve: apiHook(codeLensResolve.register(sourceFiles, tsLanguageService), false),
		findDocumentHighlights: apiHook(documentHighlight.register(sourceFiles, tsLanguageService), false),
		findDocumentSymbols: apiHook(documentSymbol.register(sourceFiles, tsLanguageService), false),
		findDocumentLinks: apiHook(documentLink.register(sourceFiles, vueHost), false),
		findDocumentColors: apiHook(documentColor.register(sourceFiles), false),
		getFoldingRanges: apiHook(foldingRanges.register(sourceFiles, tsLanguageService), false),
		dispose: tsLanguageService.dispose,
	};

	function apiHook<T extends Function>(api: T, shouldUpdateTemplateScript: boolean = true) {
		const handler = {
			apply: function (target: Function, thisArg: any, argumentsList: any[]) {
				if (!initTemplateScript) {
					initTemplateScript = true;
					shouldUpdateTemplateScript = true;
				}
				update(shouldUpdateTemplateScript);
				return target.apply(thisArg, argumentsList);
			}
		};
		return new Proxy(api, handler) as T;
	}
	function update(shouldUpdateTemplateScript: boolean) {
		const currentVersion = vueHost.getProjectVersion?.();
		if (currentVersion === undefined || currentVersion !== lastProjectVersion) {

			let tsFileChanged = false;
			lastProjectVersion = currentVersion;
			const oldFiles = new Set([...lastScriptVersions.keys()]);
			const newFiles = new Set(vueHost.getScriptFileNames());
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

			unsetSourceFiles(removes.map(fsPathToUri));
			updateSourceFiles(adds.concat(updates).map(fsPathToUri), shouldUpdateTemplateScript)
		}
		else if (shouldUpdateTemplateScript && templateScriptUpdateUris.size) {
			updateSourceFiles([], shouldUpdateTemplateScript)
		}
	}
	function createTsLanguageServiceHost() {
		const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
		const tsHost: ts2.LanguageServiceHost = {
			...vueHost,
			getProjectVersion: () => {
				pauseTracking();
				const version = tsProjectVersion.toString();
				resetTracking();
				return version;
			},
			getScriptFileNames,
			getScriptVersion,
			getScriptSnapshot,
			readDirectory: (path, extensions, exclude, include, depth) => {
				const result = ts.sys.readDirectory(path, extensions, exclude, include, depth);
				for (const [uri, sourceFile] of sourceFiles) {
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
			for (const fileName of vueHost.getScriptFileNames()) {
				const uri = fsPathToUri(fileName);
				const sourceFile = sourceFiles.get(uri);
				if (sourceFile) {
					for (const [uri] of sourceFile.getTsDocuments()) {
						tsFileNames.push(uriToFsPath(uri));
					}
				}
				else {
					tsFileNames.push(fileName);
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
				const snapshot = ts.ScriptSnapshot.fromString(text);
				scriptSnapshots.set(fileName, [version, snapshot]);
				return snapshot;
			}
			for (const [_, sourceFile] of sourceFiles) {
				const doc = sourceFile.getTsDocuments().get(uri);
				if (doc) {
					const text = doc.getText();
					const snapshot = ts.ScriptSnapshot.fromString(text);
					scriptSnapshots.set(fileName, [version, snapshot]);
					return snapshot;
				}
			}
			return vueHost.getScriptSnapshot(fileName);
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
				const document = TextDocument.create(uri, 'typescript', version, scriptText);
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

		for (const uri of uris) {
			const sourceFile = sourceFiles.get(uri);
			const doc = getTextDocument(uri);
			if (!doc) continue;
			if (!sourceFile) {
				sourceFiles.set(uri, createSourceFile(doc, globalHtmlElements, globalAttrs, tsLanguageService));
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
			for (const uri of templateScriptUpdateUris) {
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
	}
	function unsetSourceFiles(uris: string[]) {
		let count = 0;
		for (const uri of uris) {
			if (sourceFiles.delete(uri)) {
				count++;
			}
		}
		if (count > 0) {
			tsProjectVersion.value++;
		}
	}
}
