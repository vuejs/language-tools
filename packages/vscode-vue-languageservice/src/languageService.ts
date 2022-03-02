import type * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { createSourceFile, SourceFile } from './sourceFile';
import * as localTypes from './utils/localTypes';
import * as upath from 'upath';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { HtmlLanguageServiceContext, ApiLanguageServiceContext, Modules, VueCompilerOptions } from './types';
import * as tsPluginApis from './tsPluginApis';
import * as tsProgramApis from './tsProgramApis';
// vue services
import * as completions from './services/completion';
import * as completionResolve from './services/completionResolve';
import * as autoCreateQuotes from './services/autoCreateQuotes';
import * as autoClosingTags from './services/autoClosingTags';
import * as autoWrapBrackets from './services/autoWrapParentheses';
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
import * as codeLens from './services/referencesCodeLens';
import * as codeLensResolve from './services/referencesCodeLensResolve';
import * as callHierarchy from './services/callHierarchy';
import * as linkedEditingRanges from './services/linkedEditingRange';
import * as tagNameCase from './services/tagNameCase';
import * as workspaceSymbol from './services/workspaceSymbol';
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
import { TextRange } from '@volar/vue-code-gen/out/types';
import { getMatchBindTexts } from '@volar/vue-code-gen/out/parsers/cssBindRanges';

export interface DocumentLanguageService extends ReturnType<typeof getDocumentLanguageService> { }
export interface LanguageService extends ReturnType<typeof createLanguageService> { }
export type LanguageServiceHost = ts2.LanguageServiceHost & {
	getVueCompilationSettings?(): VueCompilerOptions,
	getVueProjectVersion?(): string;
	getEmmetConfig?(syntax: string): Promise<emmet.VSCodeEmmetConfig>,
	schemaRequestService?: json.SchemaRequestService,
	getCssLanguageSettings?(document: TextDocument): Promise<css.LanguageSettings>,
	getHtmlHoverSettings?(document: TextDocument): Promise<html.HoverSettings>,
};

export function getDocumentLanguageService(
	modules: { typescript: Modules['typescript'] },
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
	formatters: Parameters<typeof formatting['register']>[3],
) {
	const vueDocuments = new WeakMap<TextDocument, SourceFile>();
	const services = createServices(modules.typescript);
	const context: HtmlLanguageServiceContext = {
		compilerOptions: {},
		modules: {
			typescript: modules.typescript,
			emmet,
			css,
			html,
			json,
			ts: ts2,
			pug
		},
		...services,
		getVueDocument,
	};
	return {
		doFormatting: formatting.register(context, getPreferences, getFormatOptions, formatters),
		getFoldingRanges: foldingRanges.register(context, getPreferences, getFormatOptions),
		getSelectionRanges: selectionRanges.register(context, getPreferences, getFormatOptions),
		doQuoteComplete: autoCreateQuotes.register(context),
		doTagComplete: autoClosingTags.register(context),
		doParentheseWrap: autoWrapBrackets.register(context),
		findLinkedEditingRanges: linkedEditingRanges.register(context),
		findDocumentSymbols: documentSymbol.register(context, getPreferences, getFormatOptions),
		findDocumentColors: documentColor.register(context),
		getColorPresentations: colorPresentations.register(context),
	}
	function getVueDocument(document: TextDocument) {

		if (document.languageId !== 'vue')
			return;

		const cacheVueDoc = vueDocuments.get(document);
		if (cacheVueDoc) {

			const oldText = cacheVueDoc.getTextDocument().getText();
			const newText = document.getText();

			if (oldText.length !== newText.length || oldText !== newText) {
				cacheVueDoc.update(document.getText(), document.version.toString());
			}

			return cacheVueDoc;
		}
		const vueDoc = createSourceFile(document.uri, document.getText(), document.version.toString(), context);
		vueDocuments.set(document, vueDoc);
		return vueDoc;
	}
}

export function createLanguageService(
	modules: { typescript: Modules['typescript'] },
	vueHost: LanguageServiceHost,
	isTsPlugin = false,
) {

	const { typescript: ts } = modules;
	const isVue2 = vueHost.getVueCompilationSettings?.().experimentalCompatMode === 2;

	let vueProjectVersion: string | undefined;
	let scriptContentVersion = 0; // only update by `<script>` / `<script setup>` / *.ts content
	let scriptProjectVersion = 0; // update by script LS virtual files / *.ts
	let templateProjectVersion = 0;
	let lastScriptProjectVersionWhenTemplateProjectVersionUpdate = -1;
	const documents = shared.createPathMap<TextDocument>();
	const sourceFiles = createSourceFiles();
	const templateScriptUpdateUris = new Set<string>();
	const initProgressCallback: ((p: number) => void)[] = [];
	const blockingRequests = new Set<Promise<any>>();

	const templateTsHost = createTsLsHost('template');
	const scriptTsHost = createTsLsHost('script');
	const templateTsLsRaw = ts.createLanguageService(templateTsHost);
	const scriptTsLsRaw = ts.createLanguageService(scriptTsHost);

	shared.injectCacheLogicToLanguageServiceHost(ts, templateTsHost, templateTsLsRaw);
	shared.injectCacheLogicToLanguageServiceHost(ts, scriptTsHost, scriptTsLsRaw);

	const templateTsLs = ts2.createLanguageService(ts, templateTsHost, templateTsLsRaw);
	const scriptTsLs = ts2.createLanguageService(ts, scriptTsHost, scriptTsLsRaw);
	const localTypesScript = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(isVue2));
	const compilerHost = ts.createCompilerHost(vueHost.getCompilationSettings());
	const documentContext: html.DocumentContext = {
		resolveReference(ref: string, base: string) {

			const isUri = base.indexOf('://') >= 0;
			const resolveResult = ts.resolveModuleName(
				ref,
				isUri ? shared.uriToFsPath(base) : base,
				vueHost.getCompilationSettings(),
				compilerHost,
			);
			const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;
			const dirs = new Set<string>();

			const fileExists = vueHost.fileExists ?? ts.sys.fileExists;
			const directoryExists = vueHost.directoryExists ?? ts.sys.directoryExists;

			for (const failed of failedLookupLocations) {
				let path = failed;
				const fileName = upath.basename(path);
				if (fileName === 'index.d.ts' || fileName === '*.d.ts') {
					dirs.add(upath.dirname(path));
				}
				if (path.endsWith('.d.ts')) {
					path = upath.removeExt(upath.removeExt(path, '.ts'), '.d');
				}
				else {
					continue;
				}
				if (fileExists(path)) {
					return isUri ? shared.fsPathToUri(path) : path;
				}
			}
			for (const dir of dirs) {
				if (directoryExists(dir)) {
					return isUri ? shared.fsPathToUri(dir) : dir;
				}
			}

			return undefined;
		},
	}

	const services = createServices(modules.typescript, vueHost);
	const context: ApiLanguageServiceContext = {
		compilerOptions: vueHost.getVueCompilationSettings?.() ?? {},
		modules: {
			typescript: modules.typescript,
			emmet,
			css,
			html,
			json,
			ts: ts2,
			pug
		},
		...services,
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
		getTextDocument: getHostDocument,
	};
	const _callHierarchy = callHierarchy.register(context);
	const findDefinition = definitions.register(context);
	const renames = rename.register(context);

	let tsPluginProxy: ReturnType<typeof createTsPluginProxy> | undefined;
	let tsProgramProxy: ReturnType<typeof createTsProgramProxy> | undefined;;

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
		doReferencesCodeLensResolve: publicApiHook(codeLensResolve.register(context), false),
		getSignatureHelp: publicApiHook(signatureHelp.register(context), false),
		getReferencesCodeLens: publicApiHook(codeLens.register(context), false),
		findDocumentHighlights: publicApiHook(documentHighlight.register(context), false),
		findDocumentLinks: publicApiHook(documentLink.register(context), false),
		findWorkspaceSymbols: publicApiHook(workspaceSymbol.register(context), false),
		dispose: () => {
			scriptTsLs.dispose();
			templateTsLs.dispose();
		},
		updateHtmlCustomData: services.updateHtmlCustomData,
		updateCssCustomData: services.updateCssCustomData,

		__internal__: {
			rootPath: vueHost.getCurrentDirectory(),
			get tsPlugin() {
				if (!tsPluginProxy) {
					tsPluginProxy = createTsPluginProxy();
				}
				return tsPluginProxy;
			},
			get tsProgramProxy() {
				if (!tsProgramProxy) {
					tsProgramProxy = createTsProgramProxy();
				}
				return tsProgramProxy;
			},
			context,
			onInitProgress(cb: (p: number) => void) {
				initProgressCallback.push(cb);
			},
			getLocalTypesFiles: (lsType: 'script' | 'template') => {
				const fileNames = getLocalTypesFiles(lsType);
				const code = localTypes.getTypesCode(isVue2);
				return {
					fileNames,
					code,
				};
			},
			getContext: publicApiHook(() => context),
			getD3: publicApiHook(d3.register(context)),
			detectTagNameCase: publicApiHook(tagNameCase.register(context)),
			doRefAutoClose: publicApiHook(refAutoClose.register(context), false),
		},
	};

	function getLocalTypesFiles(lsType: 'script' | 'template') {
		if (lsType === 'script')
			return [];
		return sourceFiles.getDirs().map(dir => upath.join(dir, localTypes.typesFileName));
	}
	function createTsPluginProxy() {

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

		return tsPlugin;
	}
	function createTsProgramProxy() {

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
		const tsProgramProxy = new Proxy<ts.Program>(tsProgram, {
			get: (target: any, property: keyof typeof tsProgram) => {
				return tsProgramApis_3[property] || target[property];
			},
		});

		return tsProgramProxy;
	}
	function isTemplateScriptPosition(uri: string, pos: vscode.Position) {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) {
			return false;
		}

		for (const sourceMap of sourceFile.getTsSourceMaps()) {
			if (sourceMap.lsType === 'script')
				continue;
			for (const _ of sourceMap.getMappedRanges(pos, pos, data =>
				data.vueTag === 'template'
				|| data.vueTag === 'style' // handle CSS variable injection to fix https://github.com/johnsoncodehk/volar/issues/777
			)) {
				return true;
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
		const newVueProjectVersion = vueHost.getVueProjectVersion?.();
		if (newVueProjectVersion === undefined || newVueProjectVersion !== vueProjectVersion) {

			vueProjectVersion = newVueProjectVersion;

			const newFileUris = new Set([...vueHost.getScriptFileNames()].filter(file => file.endsWith('.vue')).map(shared.fsPathToUri));
			const removeUris: string[] = [];
			const addUris: string[] = [];
			const updateUris: string[] = [];

			for (const sourceFile of sourceFiles.getAll()) {
				const fileName = shared.uriToFsPath(sourceFile.uri);
				if (!newFileUris.has(sourceFile.uri) && !vueHost.fileExists?.(fileName)) {
					// delete
					removeUris.push(sourceFile.uri);
				}
				else {
					// update
					const newVersion = vueHost.getScriptVersion(fileName);
					if (sourceFile.getVersion() !== newVersion) {
						updateUris.push(sourceFile.uri);
					}
				}
			}

			for (const newUri of newFileUris) {
				if (!sourceFiles.get(newUri)) {
					// add
					addUris.push(newUri);
				}
			}

			// if (tsFileChanged) {
			// 	scriptContentVersion++;
			// 	scriptProjectVersion++;
			// 	templateProjectVersion++;
			// 	// TODO: template global properties can't update by .d.ts definition
			// 	// wait for https://github.com/johnsoncodehk/volar/issues/455
			// 	// updates.length = 0;
			// 	// for (const fileName of oldFiles) {
			// 	// 	if (newFiles.has(fileName)) {
			// 	// 		if (fileName.endsWith('.vue')) {
			// 	// 			updates.push(fileName);
			// 	// 		}
			// 	// 	}
			// 	// }
			// }

			const finalUpdateUris = addUris.concat(updateUris);

			if (removeUris.length) {
				unsetSourceFiles(removeUris);
			}
			if (finalUpdateUris.length) {
				updateSourceFiles(finalUpdateUris, shouldUpdateTemplateScript)
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
						const uri = shared.fsPathToUri(fileNameTrim);
						const sourceFile = sourceFiles.get(uri);
						if (!sourceFile) {
							const fileExists = !!vueHost.fileExists?.(fileNameTrim);
							if (fileExists) {
								updateSourceFiles([uri], false); // create virtual files
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
				return vueHost.getProjectVersion?.() + '-' + (lsType === 'template' ? templateProjectVersion : scriptProjectVersion).toString();
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

		if (lsType === 'template') {
			tsHost.getCompilationSettings = () => ({
				...vueHost.getCompilationSettings(),
				jsx: ts.JsxEmit.Preserve,
			});
		}

		return tsHost;

		function getScriptFileNames() {
			const tsFileNames = getLocalTypesFiles(lsType);

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
			const basename = upath.basename(fileName);
			if (basename === localTypes.typesFileName) {
				return '0';
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
			const basename = upath.basename(fileName);
			if (basename === localTypes.typesFileName) {
				return localTypesScript;
			}
			const uri = shared.fsPathToUri(fileName);
			const doc = sourceFiles.getTsDocuments(lsType).get(uri);
			if (doc) {
				const text = doc.getText();
				const snapshot = ts.ScriptSnapshot.fromString(text);
				scriptSnapshots.set(fileName, [version, snapshot]);
				return snapshot;
			}
			let tsScript = vueHost.getScriptSnapshot(fileName);
			if (tsScript) {
				if (lsType === 'template' && basename === 'runtime-dom.d.ts') {
					// allow arbitrary attributes
					let tsScriptText = tsScript.getText(0, tsScript.getLength());
					tsScriptText = tsScriptText.replace('type ReservedProps = {', 'type ReservedProps = { [name: string]: any')
					tsScript = ts.ScriptSnapshot.fromString(tsScriptText);
				}
				scriptSnapshots.set(fileName, [version, tsScript]);
				return tsScript;
			}
		}
	}
	function getHostDocument(uri: string): TextDocument | undefined {
		const fileName = shared.uriToFsPath(uri);
		const version = Number(vueHost.getScriptVersion(fileName));
		if (!documents.uriHas(uri) || documents.uriGet(uri)!.version !== version) {
			const scriptSnapshot = vueHost.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, uri.endsWith('.vue') ? 'vue' : 'typescript', version, scriptText);
				documents.uriSet(uri, document);
			}
		}
		if (documents.uriHas(uri)) {
			return documents.uriGet(uri);
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
				sourceFiles.set(uri, createSourceFile(doc.uri, doc.getText(), doc.version.toString(), context));
				vueScriptContentsUpdate = true;
				vueScriptsUpdated = true;
			}
			else {
				const updates = sourceFile.update(doc.getText(), doc.version.toString());
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
				currentNums++;
				for (const cb of initProgressCallback) {
					cb(currentNums / templateScriptUpdateUris.size);
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

interface StylesheetNode {
	children: StylesheetNode[] | undefined,
	end: number,
	length: number,
	offset: number,
	parent: StylesheetNode | null,
	type: number,
}

function createServices(
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
	let htmlDataProviders: html.IHTMLDataProvider[] = [];

	const stylesheets = new WeakMap<TextDocument, [number, css.Stylesheet]>();
	const stylesheetVBinds = new WeakMap<css.Stylesheet, TextRange[]>();
	const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();

	return {
		ts,
		htmlLs,
		pugLs,
		jsonLs,
		getCssLs,
		getStylesheet,
		getCssVBindRanges,
		getHtmlDocument,
		vueHost,
		updateHtmlCustomData,
		updateCssCustomData,
		getHtmlDataProviders: () => htmlDataProviders,
	};

	function updateHtmlCustomData(customData: { [id: string]: html.HTMLDataV1 }) {
		htmlDataProviders = [];
		for (const id in customData) {
			htmlDataProviders.push(html.newHTMLDataProvider(id, customData[id]));
		}
		htmlLs.setDataProviders(true, htmlDataProviders);
	}
	function updateCssCustomData(customData: css.CSSDataV1[]) {
		const data = customData.map(data => css.newCSSDataProvider(data));
		cssLs.setDataProviders(true, data);
		scssLs.setDataProviders(true, data);
		lessLs.setDataProviders(true, data);
	}
	function getCssLs(lang: string) {
		switch (lang) {
			case 'css': return cssLs;
			case 'scss': return scssLs;
			case 'less': return lessLs;
			case 'postcss': return postcssLs;
		}
	}
	function getStylesheet(document: TextDocument) {

		const cache = stylesheets.get(document);
		if (cache) {
			const [cacheVersion, cacheStylesheet] = cache;
			if (cacheVersion === document.version) {
				return cacheStylesheet;
			}
		}

		const cssLs = getCssLs(document.languageId);
		if (!cssLs)
			return;

		const stylesheet = cssLs.parseStylesheet(document);
		stylesheets.set(document, [document.version, stylesheet]);

		return stylesheet;
	}
	function getCssVBindRanges(document: TextDocument) {

		const stylesheet = getStylesheet(document);
		if (!stylesheet)
			return [];

		let binds = stylesheetVBinds.get(stylesheet);
		if (!binds) {
			binds = findStylesheetVBindRanges(document.getText(), stylesheet);
			stylesheetVBinds.set(stylesheet, binds)
		}

		return binds;
	}
	function findStylesheetVBindRanges(docText: string, ss: css.Stylesheet) {
		const result: TextRange[] = [];
		visChild(ss as StylesheetNode);
		function visChild(node: StylesheetNode) {
			if (node.type === 22) {
				const nodeText = docText.substring(node.offset, node.end);
				for (const textRange of getMatchBindTexts(nodeText)) {
					result.push({
						start: textRange.start + node.offset,
						end: textRange.end + node.offset,
					});
				}
			}
			else if (node.children) {
				for (let i = 0; i < node.children.length; i++) {
					visChild(node.children[i]);
				}
			}
		}
		return result;
	}
	function getHtmlDocument(document: TextDocument) {

		if (document.languageId !== 'vue' && document.languageId !== 'html')
			return;

		const cache = htmlDocuments.get(document);
		if (cache) {
			const [cacheVersion, cacheHtmlDoc] = cache;
			if (cacheVersion === document.version) {
				return cacheHtmlDoc;
			}
		}

		const htmlDoc = htmlLs.parseHTMLDocument(document);
		htmlDocuments.set(document, [document.version, htmlDoc]);

		return htmlDoc;
	}
}
