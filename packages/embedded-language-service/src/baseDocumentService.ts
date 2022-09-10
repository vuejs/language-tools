import * as autoInsert from './documentFeatures/autoInsert';
import * as colorPresentations from './documentFeatures/colorPresentations';
import * as documentColors from './documentFeatures/documentColors';
import * as documentSymbols from './documentFeatures/documentSymbols';
import * as foldingRanges from './documentFeatures/foldingRanges';
import * as format from './documentFeatures/format';
import * as linkedEditingRanges from './documentFeatures/linkedEditingRanges';
import * as selectionRanges from './documentFeatures/selectionRanges';
import { DocumentServiceRuntimeContext } from './types';
import * as shared from '@volar/shared';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedLanguageServicePlugin } from './plugin';
import { singleFileTypeScriptServiceHost, updateSingleFileTypeScriptServiceHost } from './utils/singleFileTypeScriptService';
import { EmbeddedLanguageModule } from '@volar/embedded-language-core';
import { parseSourceFileDocument, SourceFileDocument } from './documents';
import { PluginContext, setPluginContext } from './contextStore';

// fix build
import type * as _0 from 'vscode-languageserver-protocol';

export type DocumentService = ReturnType<typeof getDocumentService>;

export function getDocumentServiceContext(options: {
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getLanguageModules(): EmbeddedLanguageModule[],
	getPlugins(): EmbeddedLanguageServicePlugin[],
	env: PluginContext['env'];
}) {

	const ts = options.ts;

	setPluginContext({
		typescript: {
			module: ts,
			languageServiceHost: singleFileTypeScriptServiceHost,
			languageService: ts.createLanguageService(singleFileTypeScriptServiceHost),
		},
		env: options.env,
	});

	let plugins: EmbeddedLanguageServicePlugin[];

	const languageModules = options.getLanguageModules();
	const vueDocuments = new WeakMap<TextDocument, [SourceFileDocument, EmbeddedLanguageModule]>();
	const context: DocumentServiceRuntimeContext = {
		typescript: ts,
		get plugins() {
			if (!plugins) {
				plugins = options.getPlugins();
			}
			return plugins;
		},
		getSourceFileDocument(document) {

			let cache = vueDocuments.get(document);

			if (cache && cache[0].file.text !== document.getText()) {
				cache[1].updateSourceFile(cache[0].file, ts.ScriptSnapshot.fromString(document.getText()));
				return cache;
			}

			for (const languageModule of languageModules) {
				const sourceFile = languageModule.createSourceFile(
					'/untitled.' + shared.languageIdToSyntax(document.languageId),
					ts.ScriptSnapshot.fromString(document.getText()),
				);
				if (sourceFile) {
					const sourceFileDoc = parseSourceFileDocument(options.env.rootUri, sourceFile);
					cache = [sourceFileDoc, languageModule];
					vueDocuments.set(document, cache);
					break;
				}
			}

			return cache;
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

export function getDocumentService(context: DocumentServiceRuntimeContext) {

	return {
		format: format.register(context),
		getFoldingRanges: foldingRanges.register(context),
		getSelectionRanges: selectionRanges.register(context),
		findLinkedEditingRanges: linkedEditingRanges.register(context),
		findDocumentSymbols: documentSymbols.register(context),
		findDocumentColors: documentColors.register(context),
		getColorPresentations: colorPresentations.register(context),
		doAutoInsert: autoInsert.register(context),
	};
}
