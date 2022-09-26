import * as autoInsert from './documentFeatures/autoInsert';
import * as colorPresentations from './documentFeatures/colorPresentations';
import * as documentColors from './documentFeatures/documentColors';
import * as documentSymbols from './documentFeatures/documentSymbols';
import * as foldingRanges from './documentFeatures/foldingRanges';
import * as format from './documentFeatures/format';
import * as linkedEditingRanges from './documentFeatures/linkedEditingRanges';
import * as selectionRanges from './documentFeatures/selectionRanges';
import { DocumentServiceRuntimeContext, LanguageServicePluginContext } from './types';
import * as shared from '@volar/shared';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageServicePlugin } from './plugin';
import { singleFileTypeScriptServiceHost, updateSingleFileTypeScriptServiceHost } from './utils/singleFileTypeScriptService';
import { createDocumentRegistry, EmbeddedLanguageModule, SourceFile } from '@volar/language-core';
import { parseSourceFileDocument, SourceFileDocument } from './documents';
import { shallowReactive as reactive } from '@vue/reactivity';

// fix build
import type * as _0 from 'vscode-languageserver-protocol';

export type DocumentService = ReturnType<typeof createDocumentService>;

export function createDocumentServiceContext(options: {
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getLanguageModules(): EmbeddedLanguageModule[],
	getPlugins(): LanguageServicePlugin[],
	env: LanguageServicePluginContext['env'];
}) {

	const ts = options.ts;

	let plugins: LanguageServicePlugin[];

	const pluginContext: LanguageServicePluginContext = {
		typescript: {
			module: ts,
			languageServiceHost: singleFileTypeScriptServiceHost,
			languageService: ts.createLanguageService(singleFileTypeScriptServiceHost),
		},
		env: options.env,
	};
	const languageModules = options.getLanguageModules();
	const vueDocuments = new WeakMap<TextDocument, [SourceFileDocument, EmbeddedLanguageModule]>();
	const fileMods = new WeakMap<SourceFile, EmbeddedLanguageModule>();
	const mapper = createDocumentRegistry();
	const context: DocumentServiceRuntimeContext = {
		typescript: ts,
		get plugins() {
			if (!plugins) {
				plugins = options.getPlugins();
				for (const plugin of plugins) {
					plugin.setup?.(pluginContext);
				}
			}
			return plugins;
		},
		pluginContext,
		getSourceFileDocument(document) {

			let cache = vueDocuments.get(document);

			if (cache) {
				if (cache[0].file.text !== document.getText()) {
					cache[1].updateSourceFile(cache[0].file, ts.ScriptSnapshot.fromString(document.getText()));
					mapper.onSourceFileUpdated(cache[0].file);
				}
				return cache;
			}

			for (const languageModule of languageModules) {
				let sourceFile = languageModule.createSourceFile(
					'/untitled.' + shared.languageIdToSyntax(document.languageId),
					ts.ScriptSnapshot.fromString(document.getText()),
				);
				if (sourceFile) {
					sourceFile = reactive(sourceFile);
					const sourceFileDoc = parseSourceFileDocument(options.env.rootUri, sourceFile, mapper);
					cache = [sourceFileDoc, languageModule];
					vueDocuments.set(document, cache);
					fileMods.set(sourceFile, languageModule);
					break;
				}
			}

			return cache;
		},
		updateSourceFile(sourceFile, snapshot) {
			fileMods.get(sourceFile)!.updateSourceFile(sourceFile, snapshot);
			mapper.onSourceFileUpdated(sourceFile);
		},
		prepareLanguageServices(document) {
			if (isTsDocument(document)) {
				updateSingleFileTypeScriptServiceHost(ts, document);
			}
		},
	};

	return context;
}

export function isTsDocument(document: TextDocument) {
	return document.languageId === 'javascript' ||
		document.languageId === 'typescript' ||
		document.languageId === 'javascriptreact' ||
		document.languageId === 'typescriptreact';
}

export function createDocumentService(context: DocumentServiceRuntimeContext) {

	return {
		format: format.register(context),
		getFoldingRanges: foldingRanges.register(context),
		getSelectionRanges: selectionRanges.register(context),
		findLinkedEditingRanges: linkedEditingRanges.register(context),
		findDocumentSymbols: documentSymbols.register(context),
		findDocumentColors: documentColors.register(context),
		getColorPresentations: colorPresentations.register(context),
		doAutoInsert: autoInsert.register(context),
		context,
	};
}
