import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import * as SourceMaps from '../utils/sourceMaps';
import * as sharedLs from '../utils/sharedLs';
import * as css from 'vscode-css-languageservice';
import { uriToFsPath } from '@volar/shared';
import * as upath from 'upath';
import type { DocumentContext } from 'vscode-html-languageservice';

export function useStylesRaw(
	ts: typeof import('typescript'),
	getUnreactiveDoc: () => TextDocument,
	styles: Ref<IDescriptor['styles']>,
	documentContext: DocumentContext | undefined
) {
	let version = 0;
	const textDocuments = computed(() => {
		const vueDoc = getUnreactiveDoc();
		const documents: {
			textDocument: TextDocument,
			stylesheet: css.Stylesheet | undefined,
			links: {
				textDocument: TextDocument,
				stylesheet: css.Stylesheet,
			}[],
			module: boolean,
			scoped: boolean,
		}[] = [];
		for (let i = 0; i < styles.value.length; i++) {
			const style = styles.value[i];
			const lang = style.lang;
			let content = style.content;
			const documentUri = vueDoc.uri + '.' + i + '.' + lang;
			const document = TextDocument.create(documentUri, lang, version++, content);
			const linkStyles: {
				textDocument: TextDocument,
				stylesheet: css.Stylesheet,
			}[] = [];
			let stylesheet: css.Stylesheet | undefined = undefined;
			const cssLanguageService = sharedLs.getCssLs(lang);
			if (cssLanguageService) {
				stylesheet = cssLanguageService.parseStylesheet(document);
				findLinks(cssLanguageService, document, stylesheet);
			}
			documents.push({
				textDocument: document,
				stylesheet,
				links: linkStyles,
				module: style.module,
				scoped: style.scoped,
			});

			function findLinks(ls1: css.LanguageService, textDocument: TextDocument, stylesheet: css.Stylesheet) {
				const links = documentContext ? ls1.findDocumentLinks(textDocument, stylesheet, documentContext) : [];
				for (const link of links) {
					if (!link.target) continue;
					if (!link.target.endsWith('.css') && !link.target.endsWith('.scss') && !link.target.endsWith('.less')) continue;
					if (!ts.sys.fileExists(uriToFsPath(link.target))) continue;
					if (linkStyles.find(l => l.textDocument.uri === link.target)) continue; // Loop

					const text = ts.sys.readFile(uriToFsPath(link.target));
					if (text === undefined) continue;

					const lang = upath.extname(link.target).substr(1);
					const doc = TextDocument.create(link.target, lang, version++, text);
					const ls2 = sharedLs.getCssLs(lang);
					if (!ls2) continue;
					const stylesheet = ls2.parseStylesheet(doc);
					linkStyles.push({
						textDocument: doc,
						stylesheet,
					});
					findLinks(ls2, doc, stylesheet);
				}
			}
		}
		return documents;
	});
	const sourceMaps = computed(() => {
		const vueDoc = getUnreactiveDoc();
		const sourceMaps: SourceMaps.CssSourceMap[] = [];
		for (let i = 0; i < styles.value.length && i < textDocuments.value.length; i++) {

			const cssData = textDocuments.value[i];
			const style = styles.value[i];
			const document = cssData.textDocument;
			const stylesheet = cssData.stylesheet;
			const linkStyles = cssData.links;
			const loc = style.loc;
			const module = style.module;
			const scoped = style.scoped;

			const sourceMap = new SourceMaps.CssSourceMap(
				vueDoc,
				document,
				stylesheet,
				module,
				scoped,
				linkStyles,
				{ foldingRanges: true, formatting: true },
			);
			sourceMap.add({
				data: undefined,
				mode: SourceMaps.Mode.Offset,
				sourceRange: {
					start: loc.start,
					end: loc.end,
				},
				mappedRange: {
					start: 0,
					end: loc.end - loc.start,
				},
			});
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	return {
		textDocuments,
		sourceMaps,
	};
}
