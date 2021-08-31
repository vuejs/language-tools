import type * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { createSourceFile, SourceFile } from './sourceFile';
import { createGlobalDefineDocument } from './utils/globalDoc';
import * as upath from 'upath';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { HtmlLanguageServiceContext, ApiLanguageServiceContext, Modules } from './types';
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
// context
import * as fs from 'fs';
import * as emmet from '@vscode/emmet-helper';
import * as css from 'vscode-css-languageservice';
import * as html from 'vscode-html-languageservice';
import * as json from 'vscode-json-languageservice';
import * as ts2 from 'vscode-typescript-languageservice';
import * as pug from 'vscode-pug-languageservice';
import { createSourceFiles } from './sourceFiles';

export type DocumentLanguageService = ReturnType<typeof getDocumentLanguageService>;
export type LanguageService = ReturnType<typeof createLanguageService>;
export type LanguageServiceHost = ts2.LanguageServiceHost & {
	getExternalScriptFileNames?(): string[],
	createTsLanguageService?(host: ts.LanguageServiceHost): ts.LanguageService,
	getEmmetConfig?(syntax: string): Promise<emmet.VSCodeEmmetConfig> | emmet.VSCodeEmmetConfig,
	schemaRequestService?: json.SchemaRequestService,
};

export function getDocumentLanguageService(
	modules: { typescript: Modules['typescript'] },
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
	formatters: Parameters<typeof formatting['register']>[3],
) {
	const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();
	const vueDocuments = new WeakMap<TextDocument, SourceFile>();
	const context: HtmlLanguageServiceContext = {
		isVue2Mode: false,
		modules: {
			typescript: modules.typescript,
			emmet,
			css,
			html,
			json,
			ts: ts2,
			pug
		},
		...createContext(modules.typescript),
		getHtmlDocument,
		getVueDocument,
	};
	return {
		doFormatting: formatting.register(context, getPreferences, getFormatOptions, formatters),
		getFoldingRanges: foldingRanges.register(context, getPreferences, getFormatOptions),
		getSelectionRanges: selectionRanges.register(context, getPreferences, getFormatOptions),
		doTagComplete: autoClose.register(context),
		findLinkedEditingRanges: linkedEditingRanges.register(context),
		findDocumentSymbols: documentSymbol.register(context, getPreferences, getFormatOptions),
		findDocumentColors: documentColor.register(context),
		getColorPresentations: colorPresentations.register(context),
	}
	function getVueDocument(document: TextDocument) {
		const cacheVueDoc = vueDocuments.get(document);
		if (cacheVueDoc) {

			const oldText = cacheVueDoc.getTextDocument().getText();
			const newText = document.getText();

			if (oldText.length !== newText.length || oldText !== newText) {
				cacheVueDoc.update(document);
			}

			return cacheVueDoc;
		}
		const vueDoc = createSourceFile(document, context);
		vueDocuments.set(document, vueDoc);
		return vueDoc;
	}
	function getHtmlDocument(document: TextDocument) {
		const cache = htmlDocuments.get(document);
		if (cache) {
			const [cacheVersion, cacheHtmlDoc] = cache;
			if (cacheVersion === document.version) {
				return cacheHtmlDoc;
			}
		}
		const htmlDoc = context.htmlLs.parseHTMLDocument(document);
		htmlDocuments.set(document, [document.version, htmlDoc]);
		return htmlDoc;
	}
}

export function createLanguageService(
	modules: { typescript: Modules['typescript'] },
	vueHost: LanguageServiceHost,
	isTsPlugin = false,
) {

	const { typescript: ts } = modules;

	let vueProjectVersion: string | undefined;
	let lastScriptVersions = new Map<string, string>();
	let scriptContentVersion = 0; // only update by `<script>` / `<script setup>` / *.ts content
	let scriptProjectVersion = 0; // update by script LS virtual files / *.ts
	let templateProjectVersion = 0;
	let lastScriptProjectVersionWhenTemplateProjectVersionUpdate = -1;
	const documents = new shared.UriMap<TextDocument>();
	const sourceFiles = createSourceFiles();
	const templateScriptUpdateUris = new Set<string>();
	const initProgressCallback: ((p: number) => void)[] = [];
	const blockingRequests = new Set<Promise<any>>();

	const templateTsHost = createTsLsHost('template');
	const scriptTsHost = createTsLsHost('script');
	const templateTsLsRaw = vueHost.createTsLanguageService ? vueHost.createTsLanguageService(templateTsHost) : ts.createLanguageService(templateTsHost);
	const scriptTsLsRaw = vueHost.createTsLanguageService ? vueHost.createTsLanguageService(scriptTsHost) : ts.createLanguageService(scriptTsHost);
	const templateTsLs = ts2.createLanguageService(ts, templateTsHost, templateTsLsRaw);
	const scriptTsLs = ts2.createLanguageService(ts, scriptTsHost, scriptTsLsRaw);
	const globalDoc = createGlobalDefineDocument(vueHost.getCurrentDirectory());
	const compilerHost = ts.createCompilerHost(vueHost.getCompilationSettings());
	const documentContext: html.DocumentContext = {
		resolveReference(ref: string, base: string) {

			const resolveResult = ts.resolveModuleName(ref, base, vueHost.getCompilationSettings(), compilerHost);
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
				if (ts.sys.fileExists(path) || ts.sys.fileExists(shared.uriToFsPath(path))) {
					return path;
				}
			}
			for (const dir of dirs) {
				if (ts.sys.directoryExists(dir) || ts.sys.directoryExists(shared.uriToFsPath(dir))) {
					return dir;
				}
			}

			return undefined;
		},
	}

	// TODO: not working for vue-tsc --project flag
	const tsconfigFile = upath.join(vueHost.getCurrentDirectory(), 'tsconfig.json');
	const jsconfigFile = upath.join(vueHost.getCurrentDirectory(), 'jsconfig.json');
	const configFile = ts.sys.fileExists(tsconfigFile) ? tsconfigFile : ts.sys.fileExists(jsconfigFile) ? jsconfigFile : undefined;
	const config = configFile ? shared.createParsedCommandLine(ts, ts.sys, configFile) : undefined;

	const context: ApiLanguageServiceContext = {
		isVue2Mode: config?.raw.vueCompilerOptions?.experimentalCompatMode === 2,
		modules: {
			typescript: modules.typescript,
			emmet,
			css,
			html,
			json,
			ts: ts2,
			pug
		},
		...createContext(modules.typescript, vueHost),
		vueHost,
		sourceFiles,
		templateTsHost,
		scriptTsHost,
		templateTsLsRaw,
		scriptTsLsRaw,
		templateTsLs,
		scriptTsLs,
		documentContext,
		getTsLs: (lsType: 'template' | 'script') => lsType === 'template' ? templateTsLs : scriptTsLs,
	};
	const _callHierarchy = callHierarchy.register(context);
	const findDefinition = definitions.register(context);
	const renames = rename.register(context);

	// ts plugin proxy
	const _tsPluginApis = tsPluginApis.register(context);
	const tsPlugin: Partial<ts.LanguageService> = {
		getSemanticDiagnostics: apiHook(scriptTsLsRaw.getSemanticDiagnostics, false),
		getEncodedSemanticClassifications: apiHook(scriptTsLsRaw.getEncodedSemanticClassifications, false),
		getCompletionsAtPosition: apiHook(_tsPluginApis.getCompletionsAtPosition, false),
		getCompletionEntryDetails: apiHook(scriptTsLsRaw.getCompletionEntryDetails, false), // not sure
		getCompletionEntrySymbol: apiHook(scriptTsLsRaw.getCompletionEntrySymbol, false), // not sure
		getQuickInfoAtPosition: apiHook(scriptTsLsRaw.getQuickInfoAtPosition, false),
		getSignatureHelpItems: apiHook(scriptTsLsRaw.getSignatureHelpItems, false),
		getRenameInfo: apiHook(scriptTsLsRaw.getRenameInfo, false),

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
	const tsProgram = scriptTsLsRaw.getProgram(); // TODO: handle template ls?
	if (!tsProgram) throw '!tsProgram';

	const tsProgramApis_2 = tsProgramApis.register(context);
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
		doValidation: publicApiHook(diagnostics.register(context, () => update(true)), false, false),
		findDefinition: publicApiHook(findDefinition.on, isTemplateScriptPosition),
		findReferences: publicApiHook(references.register(context), true),
		findTypeDefinition: publicApiHook(findDefinition.onType, isTemplateScriptPosition),
		callHierarchy: {
			doPrepare: publicApiHook(_callHierarchy.doPrepare, isTemplateScriptPosition),
			getIncomingCalls: publicApiHook(_callHierarchy.getIncomingCalls, true),
			getOutgoingCalls: publicApiHook(_callHierarchy.getOutgoingCalls, true),
		},
		prepareRename: publicApiHook(renames.prepareRename, isTemplateScriptPosition),
		doRename: publicApiHook(renames.doRename, true),
		getEditsForFileRename: publicApiHook(renames.onRenameFile, false),
		getSemanticTokens: publicApiHook(semanticTokens.register(context, () => update(true)), false),

		doHover: publicApiHook(hover.register(context), isTemplateScriptPosition),
		doComplete: publicApiHook(completions.register(context, () => scriptContentVersion), isTemplateScriptPosition),

		getCodeActions: publicApiHook(codeActions.register(context), false),
		doCodeActionResolve: publicApiHook(codeActionResolve.register(context), false),
		doCompletionResolve: publicApiHook(completionResolve.register(context), false),
		doCodeLensResolve: publicApiHook(codeLensResolve.register(context), false),
		getSignatureHelp: publicApiHook(signatureHelp.register(context), false),
		getCodeLens: publicApiHook(codeLens.register(context), false),
		findDocumentHighlights: publicApiHook(documentHighlight.register(context), false),
		findDocumentLinks: publicApiHook(documentLink.register(context), false),
		dispose: () => {
			scriptTsLs.dispose();
			templateTsLs.dispose();
		},

		__internal__: {
			rootPath: vueHost.getCurrentDirectory(),
			tsPlugin,
			tsProgramProxy,
			context,
			onInitProgress(cb: (p: number) => void) {
				initProgressCallback.push(cb);
			},
			checkProject: publicApiHook(() => {
				const vueImportErrors = scriptTsLs.doValidation(globalDoc.uri, { semantic: true });
				return !vueImportErrors.find(error => error.code === 2322); // Type 'false' is not assignable to type 'true'.ts(2322)
			}, false),
			getGlobalDocs: () => [globalDoc],
			getContext: publicApiHook(() => context),
			getD3: publicApiHook(d3.register(context)),
			executeCommand: publicApiHook(executeCommand.register(context), true, false),
			detectTagNameCase: publicApiHook(tagNameCase.register(context)),
			doRefAutoClose: publicApiHook(refAutoClose.register(context), false),
		},
	};

	function isTemplateScriptPosition(uri: string, pos: vscode.Position) {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) {
			return false;
		}

		for (const sourceMap of sourceFile.getTsSourceMaps()) {
			if (sourceMap.lsType === 'script')
				continue;
			for (const tsRange of sourceMap.getMappedRanges(pos)) {
				if (tsRange.data.vueTag === 'template') {
					return true;
				}
			}
		}

		for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
			for (const _ of sourceMap.getMappedRanges(pos)) {
				return true;
			}
		}

		return false;
	}
	function apiHook<T extends (...args: any) => any>(
		api: T,
		shouldUpdateTemplateScript: boolean | ((...args: Parameters<T>) => boolean) = true,
	) {
		const handler = {
			apply(target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
				const _shouldUpdateTemplateScript = typeof shouldUpdateTemplateScript === 'boolean' ? shouldUpdateTemplateScript : shouldUpdateTemplateScript.apply(null, argumentsList);
				update(_shouldUpdateTemplateScript);
				return target.apply(thisArg, argumentsList);
			}
		};
		return new Proxy<T>(api, handler);
	}
	function publicApiHook<T extends (...args: any) => any>(
		api: T,
		shouldUpdateTemplateScript: boolean | ((...args: Parameters<T>) => boolean) = true,
		blockNewRequest = true,
	): (...args: Parameters<T>) => Promise<ReturnType<T>> {
		const handler = {
			async apply(target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
				for (const runningRequest of blockingRequests) {
					await runningRequest;
				}
				const _shouldUpdateTemplateScript = typeof shouldUpdateTemplateScript === 'boolean' ? shouldUpdateTemplateScript : shouldUpdateTemplateScript.apply(null, argumentsList);
				update(_shouldUpdateTemplateScript);
				const runner = target.apply(thisArg, argumentsList);
				if (blockNewRequest && runner instanceof Promise) {
					blockingRequests.add(runner);
					runner.then(() => blockingRequests.delete(runner));
				}
				return runner;
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
			const newFiles = new Set([...vueHost.getScriptFileNames(), ...(vueHost.getExternalScriptFileNames?.() ?? [])]);
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
				scriptContentVersion++;
				scriptProjectVersion++;
				templateProjectVersion++;
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
				unsetSourceFiles(removes.map(shared.fsPathToUri));
			}
			if (finalUpdates.length) {
				updateSourceFiles(finalUpdates.map(shared.fsPathToUri), shouldUpdateTemplateScript)
			}
		}
		else if (shouldUpdateTemplateScript && templateScriptUpdateUris.size) {
			updateSourceFiles([], shouldUpdateTemplateScript)
		}
	}
	function createTsLsHost(lsType: 'template' | 'script') {
		const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
		const tsHost: ts2.LanguageServiceHost = {
			...vueHost,
			fileExists: vueHost.fileExists
				? fileName => {
					// .vue.js -> .vue
					// .vue.ts -> .vue
					// .vue.d.ts (never)
					const fileNameTrim = upath.trimExt(fileName);
					if (fileNameTrim.endsWith('.vue')) {
						let sourceFile = sourceFiles.get(shared.fsPathToUri(fileNameTrim));
						if (!sourceFile) {
							const fileExists = !!vueHost.fileExists?.(fileNameTrim);
							if (fileExists) {
								vueProjectVersion += '-old'; // force update
								update(false); // create virtual files
							}
						}
						return sourceFiles.getTsDocuments(lsType).has(shared.fsPathToUri(fileName));
					}
					else {
						return !!vueHost.fileExists?.(fileName);
					}
				}
				: undefined,
			getProjectVersion: () => {
				return (lsType === 'template' ? templateProjectVersion : scriptProjectVersion).toString();
			},
			getScriptFileNames,
			getScriptVersion,
			getScriptSnapshot,
			readDirectory: (path, extensions, exclude, include, depth) => {
				const result = vueHost.readDirectory?.(path, extensions, exclude, include, depth) ?? [];
				for (const uri of sourceFiles.getUris()) {
					const vuePath = shared.uriToFsPath(uri);
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
			getScriptKind(fileName) {
				switch (upath.extname(fileName)) {
					case '.vue': return ts.ScriptKind.TSX; // can't use External, Unknown
					case '.js': return ts.ScriptKind.JS;
					case '.jsx': return ts.ScriptKind.JSX;
					case '.ts': return ts.ScriptKind.TS;
					case '.tsx': return ts.ScriptKind.TSX;
					case '.json': return ts.ScriptKind.JSON;
					default: return ts.ScriptKind.Unknown;
				}
			},
		};

		return tsHost;

		function getScriptFileNames() {
			const tsFileNames: string[] = [];
			tsFileNames.push(shared.uriToFsPath(globalDoc.uri));
			for (const [tsUri] of sourceFiles.getTsDocuments(lsType)) {
				tsFileNames.push(shared.uriToFsPath(tsUri)); // virtual .ts
			}
			for (const fileName of vueHost.getScriptFileNames()) {
				if (isTsPlugin) {
					tsFileNames.push(fileName); // .vue + .ts
				}
				else if (!fileName.endsWith('.vue')) {
					tsFileNames.push(fileName); // .ts
				}
			}
			return tsFileNames;
		}
		function getScriptVersion(fileName: string) {
			const uri = shared.fsPathToUri(fileName);
			if (uri === globalDoc.uri) {
				return globalDoc.version.toString();
			}
			let doc = sourceFiles.getTsDocuments(lsType).get(uri);
			if (doc) {
				return doc.version.toString();
			}
			return vueHost.getScriptVersion(fileName);
		}
		function getScriptSnapshot(fileName: string) {
			const version = getScriptVersion(fileName);
			const cache = scriptSnapshots.get(fileName);
			if (cache && cache[0] === version) {
				return cache[1];
			}
			const uri = shared.fsPathToUri(fileName);
			if (uri === globalDoc.uri) {
				const text = globalDoc.getText();
				const snapshot = ts.ScriptSnapshot.fromString(text);
				scriptSnapshots.set(fileName, [version, snapshot]);
				return snapshot;
			}
			const doc = sourceFiles.getTsDocuments(lsType).get(uri);
			if (doc) {
				const text = doc.getText();
				const snapshot = ts.ScriptSnapshot.fromString(text);
				scriptSnapshots.set(fileName, [version, snapshot]);
				return snapshot;
			}
			let tsScript = vueHost.getScriptSnapshot(fileName);
			if (tsScript) {
				scriptSnapshots.set(fileName, [version, tsScript]);
				return tsScript;
			}
		}
	}
	function getHostDocument(uri: string): TextDocument | undefined {
		const fileName = shared.uriToFsPath(uri);
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
	}
	function updateSourceFiles(uris: string[], shouldUpdateTemplateScript: boolean) {

		let vueScriptContentsUpdate = false;
		let vueScriptsUpdated = false;
		let templateScriptUpdated = false;

		if (shouldUpdateTemplateScript) {
			for (const cb of initProgressCallback) {
				cb(0);
			}
		}
		for (const uri of uris) {
			const sourceFile = sourceFiles.get(uri);
			const doc = getHostDocument(uri);
			if (!doc) continue;
			if (!sourceFile) {
				sourceFiles.set(uri, createSourceFile(doc, context));
				vueScriptsUpdated = true;
			}
			else {
				const updates = sourceFile.update(doc);
				if (updates.scriptContentUpdated) {
					vueScriptContentsUpdate = true;
				}
				if (updates.scriptUpdated) {
					vueScriptsUpdated = true;
				}
				if (updates.templateScriptUpdated) {
					templateScriptUpdated = true;
				}
			}
			templateScriptUpdateUris.add(uri);
		}
		if (vueScriptContentsUpdate) {
			scriptContentVersion++;
		}
		if (vueScriptsUpdated) {
			scriptProjectVersion++;
			templateProjectVersion++;
		}
		if (shouldUpdateTemplateScript && lastScriptProjectVersionWhenTemplateProjectVersionUpdate !== scriptContentVersion) {
			lastScriptProjectVersionWhenTemplateProjectVersionUpdate = scriptContentVersion;
			let currentNums = 0;
			for (const uri of templateScriptUpdateUris) {
				if (sourceFiles.get(uri)?.updateTemplateScript(templateTsLs)) {
					templateScriptUpdated = true;
				}
				for (const cb of initProgressCallback) {
					cb(++currentNums / templateScriptUpdateUris.size);
				}
			}
			templateScriptUpdateUris.clear();
			for (const cb of initProgressCallback) {
				cb(1);
			}
			initProgressCallback.length = 0;
		}
		if (templateScriptUpdated) {
			templateProjectVersion++;
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
			scriptContentVersion++;
			scriptProjectVersion++;
			templateProjectVersion++;
		}
	}
}
function createContext(
	ts: Modules['typescript'],
	vueHost?: LanguageServiceHost,
) {
	const fileSystemProvider: html.FileSystemProvider = {
		stat: (uri) => {
			return new Promise<html.FileStat>((resolve, reject) => {
				fs.stat(shared.uriToFsPath(uri), (err, stats) => {
					if (stats) {
						resolve({
							type: stats.isFile() ? html.FileType.File
								: stats.isDirectory() ? html.FileType.Directory
									: stats.isSymbolicLink() ? html.FileType.SymbolicLink
										: html.FileType.Unknown,
							ctime: stats.ctimeMs,
							mtime: stats.mtimeMs,
							size: stats.size,
						});
					}
					else {
						reject(err);
					}
				});
			});
		},
		readDirectory: (uri) => {
			return new Promise<[string, html.FileType][]>((resolve, reject) => {
				fs.readdir(shared.uriToFsPath(uri), (err, files) => {
					if (files) {
						resolve(files.map(file => [file, html.FileType.File]));
					}
					else {
						reject(err);
					}
				});
			});
		},
	}
	const htmlLs = html.getLanguageService({ fileSystemProvider });
	const cssLs = css.getCSSLanguageService({ fileSystemProvider });
	const scssLs = css.getSCSSLanguageService({ fileSystemProvider });
	const lessLs = css.getLESSLanguageService({ fileSystemProvider });
	const pugLs = pug.getLanguageService(htmlLs);
	const jsonLs = json.getLanguageService({ schemaRequestService: vueHost?.schemaRequestService });
	const postcssLs: css.LanguageService = {
		...scssLs,
		doValidation: (document, stylesheet, documentSettings) => {
			let errors = scssLs.doValidation(document, stylesheet, documentSettings);
			errors = errors.filter(error => error.code !== 'css-semicolonexpected');
			errors = errors.filter(error => error.code !== 'css-ruleorselectorexpected');
			errors = errors.filter(error => error.code !== 'unknownAtRules');
			return errors;
		},
	};

	return {
		ts,
		htmlLs,
		pugLs,
		jsonLs,
		getCssLs,
		vueHost,
	};

	function getCssLs(lang: string) {
		switch (lang) {
			case 'css': return cssLs;
			case 'scss': return scssLs;
			case 'less': return lessLs;
			case 'postcss': return postcssLs;
		}
	}
}
