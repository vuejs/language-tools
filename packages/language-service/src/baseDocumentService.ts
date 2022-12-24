import { createVirtualFilesHost, LanguageModule } from '@volar/language-core';
import * as shared from '@volar/shared';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as autoInsert from './documentFeatures/autoInsert';
import * as colorPresentations from './documentFeatures/colorPresentations';
import * as documentColors from './documentFeatures/documentColors';
import * as documentSymbols from './documentFeatures/documentSymbols';
import * as foldingRanges from './documentFeatures/foldingRanges';
import * as format from './documentFeatures/format';
import * as linkedEditingRanges from './documentFeatures/linkedEditingRanges';
import * as selectionRanges from './documentFeatures/selectionRanges';
import { parseSourceFileDocuments } from './documents';
import { DocumentServiceRuntimeContext, LanguageServicePlugin, LanguageServicePluginContext } from './types';
import { singleFileTypeScriptServiceHost, updateSingleFileTypeScriptServiceHost } from './utils/singleFileTypeScriptService';

// fix build
import type * as _ from 'vscode-languageserver-protocol';

export type DocumentService = ReturnType<typeof createDocumentService>;

export function createDocumentServiceContext(options: {
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getLanguageModules(): LanguageModule[],
	getPlugins(): LanguageServicePlugin[],
	env: LanguageServicePluginContext['env'];
}) {

	let plugins: LanguageServicePlugin[];

	const ts = options.ts;
	const pluginContext: LanguageServicePluginContext = {
		typescript: {
			module: ts,
			languageServiceHost: singleFileTypeScriptServiceHost,
			languageService: ts.createLanguageService(singleFileTypeScriptServiceHost),
		},
		env: options.env,
	};
	const languageModules = options.getLanguageModules();
	const lastUpdateVersions = new Map<string, number>();
	const virtualFiles = createVirtualFilesHost(languageModules);
	const textDocumentMapper = parseSourceFileDocuments(virtualFiles);
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
		getVirtualDocuments(document) {
			let lastVersion = lastUpdateVersions.get(document.uri);
			if (lastVersion === undefined || lastVersion !== document.version) {
				const fileName = shared.getPathOfUri(document.uri);
				virtualFiles.update(fileName, ts.ScriptSnapshot.fromString(document.getText()));
				lastUpdateVersions.set(document.uri, document.version);
			}
			return textDocumentMapper.get(document.uri);
		},
		updateVirtualFile(fileName, snapshot) {
			virtualFiles.update(fileName, snapshot);
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
