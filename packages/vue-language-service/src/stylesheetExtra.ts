import * as shared from '@volar/shared';
import { TextRange } from '@volar/vue-code-gen/out/types';
import { EmbeddedFile } from '@volar/vue-typescript';
import type * as css from 'vscode-css-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type useCssPlugin from './plugins/css';
import { findClassNames } from './utils/cssClasses';

export function createStylesheetExtra(cssPlugin: ReturnType<typeof useCssPlugin>) {

	const embeddedDocuments = new WeakMap<EmbeddedFile, TextDocument>();
	const stylesheetClasses = new WeakMap<css.Stylesheet, Record<string, TextRange[]>>();
	const embeddedDocumentVersions = new Map<string, number>();

	return {
		getCssClasses,
	};

	function getDocumentFromEmbeddedFile(embeddedFile: EmbeddedFile) {

		let document = embeddedDocuments.get(embeddedFile);

		if (!document) {

			const uri = shared.fsPathToUri(embeddedFile.fileName);
			const newVersion = (embeddedDocumentVersions.get(uri.toLowerCase()) ?? 0) + 1;

			embeddedDocumentVersions.set(uri.toLowerCase(), newVersion);

			document = TextDocument.create(
				uri,
				shared.syntaxToLanguageId(embeddedFile.lang),
				newVersion,
				embeddedFile.content,
			);
			embeddedDocuments.set(embeddedFile, document);
		}

		return document;
	}
	function getCssClasses(embeddedFile: EmbeddedFile) {

		const document = getDocumentFromEmbeddedFile(embeddedFile);

		let classes = stylesheetClasses.get(document);

		if (!classes) {
			classes = {};

			const stylesheet = cssPlugin.getStylesheet?.(document);
			const cssLs = cssPlugin.getCssLs?.(document.languageId);

			if (stylesheet && cssLs) {
				const classNames = findClassNames(document, stylesheet, cssLs);
				for (const className in classNames) {
					const offsets = classNames[className];
					for (const offset of offsets) {
						if (!classes[className]) {
							classes[className] = [];
						}
						classes[className]!.push(offset);
					}
				}
			}

			stylesheetClasses.set(document, classes);
		}

		return classes;
	}
}
