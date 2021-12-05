import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { LanguageServiceContext } from '../types';
import * as SourceMaps from '../utils/sourceMaps';
import type * as css from 'vscode-css-languageservice';
import * as shared from '@volar/shared';
import * as upath from 'upath';
import { TextRange } from '@volar/vue-code-gen/out/types';
import { getMatchBindTexts } from '@volar/vue-code-gen/out/parsers/cssBindRanges';

type StylesheetNode = {
	children: StylesheetNode[] | undefined,
	end: number,
	length: number,
	offset: number,
	parent: StylesheetNode | null,
	type: number,
};

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

export function useSfcStyles(
	context: LanguageServiceContext,
	vueUri: string,
	vueDoc: Ref<TextDocument>,
	styles: Ref<shared.Sfc['styles']>,
) {

	const { modules: { typescript: ts } } = context;
	const vueHost = 'vueHost' in context ? context.vueHost : undefined;
	const fileExists = vueHost?.fileExists ?? ts.sys.fileExists;
	const readFile = vueHost?.readFile ?? ts.sys.readFile;

	let version = 0;

	const textDocuments = computed(() => {
		const documents: {
			textDocument: TextDocument,
			stylesheet: css.Stylesheet | undefined,
			binds: TextRange[],
			links: {
				textDocument: TextDocument,
				stylesheet: css.Stylesheet,
			}[],
			module: string | undefined,
			scoped: boolean,
		}[] = [];
		for (let i = 0; i < styles.value.length; i++) {
			const style = styles.value[i];
			const lang = style.lang;
			let content = style.content;
			const documentUri = vueUri + '.' + i + '.' + lang;
			const document = TextDocument.create(documentUri, lang, version++, content);
			const linkStyles: {
				textDocument: TextDocument,
				stylesheet: css.Stylesheet,
			}[] = [];
			let stylesheet: css.Stylesheet | undefined = undefined;
			const cssLs = context.getCssLs(lang);
			if (cssLs) {
				stylesheet = cssLs.parseStylesheet(document);
				findLinks(cssLs, document, stylesheet);
			}
			documents.push({
				textDocument: document,
				stylesheet,
				binds: stylesheet ? findStylesheetVBindRanges(content, stylesheet) : [],
				links: linkStyles,
				module: style.module,
				scoped: style.scoped,
			});

			function findLinks(ls1: css.LanguageService, textDocument: TextDocument, stylesheet: css.Stylesheet) {
				const links = 'documentContext' in context ? ls1.findDocumentLinks(textDocument, stylesheet, context.documentContext) : [];
				for (const link of links) {
					if (!link.target) continue;
					if (!link.target.endsWith('.css') && !link.target.endsWith('.scss') && !link.target.endsWith('.less')) continue;
					if (!fileExists(shared.uriToFsPath(link.target))) continue;
					if (linkStyles.find(l => l.textDocument.uri === link.target)) continue; // Loop

					const text = readFile(shared.uriToFsPath(link.target));
					if (text === undefined) continue;

					const lang = upath.extname(link.target).substr(1);
					const doc = TextDocument.create(link.target, lang, version++, text);
					const ls2 = context.getCssLs(lang);
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
		const sourceMaps: SourceMaps.CssSourceMap[] = [];
		for (let i = 0; i < styles.value.length && i < textDocuments.value.length; i++) {

			const cssData = textDocuments.value[i];
			const style = styles.value[i];

			const sourceMap = new SourceMaps.CssSourceMap(
				vueDoc.value,
				cssData.textDocument,
				cssData.stylesheet,
				style.module,
				style.scoped,
				cssData.links,
				{ foldingRanges: true, formatting: true },
			);
			sourceMap.mappings.push({
				data: undefined,
				mode: SourceMaps.Mode.Offset,
				sourceRange: {
					start: style.startTagEnd,
					end: style.startTagEnd + style.content.length,
				},
				mappedRange: {
					start: 0,
					end: style.content.length,
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
