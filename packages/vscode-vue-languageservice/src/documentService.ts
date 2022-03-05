import { TextDocument } from 'vscode-languageserver-textdocument';
import * as autoClosingTags from './services/autoClosingTags';
import * as autoCreateQuotes from './services/autoCreateQuotes';
import * as autoWrapBrackets from './services/autoWrapParentheses';
import * as colorPresentations from './services/colorPresentation';
import * as documentColor from './services/documentColor';
import * as documentSymbol from './services/documentSymbol';
import * as foldingRanges from './services/foldingRanges';
import * as formatting from './services/formatting';
import * as linkedEditingRanges from './services/linkedEditingRange';
import * as selectionRanges from './services/selectionRanges';
import { createSourceFile, SourceFile } from '@volar/vue-typescript';
import { DocumentServiceRuntimeContext, LanguageServiceHost } from './types';
import { createBasicRuntime } from '@volar/vue-typescript';

import useVuePlugin from './plugins/vuePlugin';
import useCssPlugin from './plugins/cssPlugin';
import useHtmlPlugin from './plugins/htmlPlugin';
import usePugPlugin from './plugins/pugPlugin';
import useJsonPlugin from './plugins/jsonPlugin';
import useTsPlugin, { isTsDocument } from './plugins/tsPlugin';
import * as sharedServices from './utils/sharedLs';
import * as ts2 from 'vscode-typescript-languageservice';

import type * as _0 from 'vscode-languageserver-protocol';
import { EmbeddedLanguagePlugin } from './plugins/definePlugin';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
	formatters: Parameters<typeof formatting['register']>[3],
) {
	const vueDocuments = new WeakMap<TextDocument, SourceFile>();
	const services = createBasicRuntime();
	let tsLs: ts2.LanguageService;
	const plugins: EmbeddedLanguagePlugin[] = [
		useVuePlugin({ getVueDocument }),
		useHtmlPlugin({ getHtmlLs: () => services.htmlLs }),
		usePugPlugin({ getPugLs: () => services.pugLs }),
		useCssPlugin({ getCssLs: services.getCssLs, getStylesheet: services.getStylesheet }),
		useJsonPlugin({ getJsonLs: () => services.jsonLs }),
		useTsPlugin({ getTsLs: () => tsLs }),
	];
	const context: DocumentServiceRuntimeContext = {
		compilerOptions: {},
		typescript: ts,
		...services,
		getVueDocument,
		getPlugins: (document) => {
			if (isTsDocument(document)) {
				tsLs = sharedServices.getDummyTsLs(context.typescript, ts2, document, getPreferences, getFormatOptions);
			}
			return plugins;
		},
	};
	return {
		doFormatting: formatting.register(context, getPreferences, getFormatOptions, formatters),
		getFoldingRanges: foldingRanges.register(context),
		getSelectionRanges: selectionRanges.register(context),
		doQuoteComplete: autoCreateQuotes.register(context),
		doTagComplete: autoClosingTags.register(context),
		doParentheseWrap: autoWrapBrackets.register(context),
		findLinkedEditingRanges: linkedEditingRanges.register(context),
		findDocumentSymbols: documentSymbol.register(context),
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
		const vueDoc = createSourceFile(
			document.uri,
			document.getText(),
			document.version.toString(),
			context.htmlLs,
			context.compileTemplate,
			context.compilerOptions,
			context.typescript,
			context.getCssVBindRanges,
			context.getCssClasses,
		);
		vueDocuments.set(document, vueDoc);
		return vueDoc;
	}
}
