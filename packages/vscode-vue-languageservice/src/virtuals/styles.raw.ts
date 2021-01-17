import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, CssSourceMap } from '../utils/sourceMaps';
import * as globalServices from '../globalServices';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import * as css from 'vscode-css-languageservice';
import { uriToFsPath } from '@volar/shared';
import * as upath from 'upath';
import { getTypescript } from '@volar/vscode-builtin-packages';

export function useStylesRaw(
	tsLanguageService: ts2.LanguageService,
	getUnreactiveDoc: () => TextDocument,
	styles: Ref<IDescriptor['styles']>,
) {
	const ts = getTypescript();
	let version = 0;
	const textDocuments = computed(() => {
		const vueDoc = getUnreactiveDoc();
		const compilerHost = ts.createCompilerHost(tsLanguageService.host.getCompilationSettings());
		const documentContext = {
			resolveReference: (ref: string, base: string) => {
				return resolvePath(ref, base);
			},
		};
		const documents: {
			textDocument: TextDocument,
			stylesheet: css.Stylesheet,
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
			const content = style.content;
			const documentUri = vueDoc.uri + '.' + i + '.' + lang;
			const document = TextDocument.create(documentUri, lang, version++, content);
			const cssLanguageService = globalServices.getCssService(lang);
			if (!cssLanguageService) continue;
			const stylesheet = cssLanguageService.parseStylesheet(document);
			const linkStyles: {
				textDocument: TextDocument,
				stylesheet: css.Stylesheet,
			}[] = [];
			findLinks(cssLanguageService, document, stylesheet);
			documents.push({
				textDocument: document,
				stylesheet,
				links: linkStyles,
				module: style.module,
				scoped: style.scoped,
			});

			function findLinks(ls1: css.LanguageService, textDocument: TextDocument, stylesheet: css.Stylesheet) {
				const links = ls1.findDocumentLinks(textDocument, stylesheet, documentContext);
				for (const link of links) {
					if (!link.target) continue;
					if (!link.target.endsWith('.css') && !link.target.endsWith('.scss') && !link.target.endsWith('.less')) continue;
					if (!ts.sys.fileExists(uriToFsPath(link.target))) continue;
					if (linkStyles.find(l => l.textDocument.uri === link.target)) continue; // Loop

					const text = ts.sys.readFile(uriToFsPath(link.target));
					if (text === undefined) continue;

					const lang = upath.extname(link.target).substr(1);
					const doc = TextDocument.create(link.target, lang, version++, text);
					const ls2 = globalServices.getCssService(lang);
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

		function resolvePath(ref: string, base: string) {
			const resolveResult = ts.resolveModuleName(ref, base, tsLanguageService.host.getCompilationSettings(), compilerHost);
			const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;
			for (const failed of failedLookupLocations) {
				let path = failed;
				if (path.endsWith('.d.ts')) {
					path = upath.trimExt(path);
					path = upath.trimExt(path);
				}
				else {
					path = upath.trimExt(path);
				}
				if (ts.sys.fileExists(uriToFsPath(path))) {
					return path;
				}
			}
			return ref;
		}
	});
	const sourceMaps = computed(() => {
		const vueDoc = getUnreactiveDoc();
		const sourceMaps: CssSourceMap[] = [];
		for (let i = 0; i < styles.value.length && i < textDocuments.value.length; i++) {
			const style = styles.value[i];
			const document = textDocuments.value[i].textDocument;
			const stylesheet = textDocuments.value[i].stylesheet;
			const linkStyles = textDocuments.value[i].links;
			const loc = style.loc;
			const module = style.module;
			const scoped = style.scoped;

			const sourceMap = new CssSourceMap(
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
				mode: MapedMode.Offset,
				sourceRange: {
					start: loc.start,
					end: loc.end,
				},
				targetRange: {
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
