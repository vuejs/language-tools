import { TextDocument } from 'vscode-languageserver-textdocument';
import * as sharedLs from '../utils/sharedLs';
import * as css from 'vscode-css-languageservice';

export function parse(
    styleDocuments: {
        textDocument: TextDocument;
        stylesheet: css.Stylesheet | undefined;
        links: {
            textDocument: TextDocument;
            stylesheet: css.Stylesheet;
        }[];
    }[],
) {
    const result = new Map<string, Map<string, Set<[number, number]>>>();
    for (const sourceMap of styleDocuments) {
        if (!sourceMap.stylesheet) continue;
        for (const [className, offsets] of findClassNames(sourceMap.textDocument, sourceMap.stylesheet)) {
            for (const offset of offsets) {
                addClassName(sourceMap.textDocument.uri, className, offset);
            }
        }
        for (const link of sourceMap.links) {
            for (const [className, offsets] of findClassNames(link.textDocument, link.stylesheet)) {
                for (const offset of offsets) {
                    addClassName(link.textDocument.uri, className, offset);
                }
            }
        }
    }
    return result;
    function addClassName(uri: string, className: string, range: [number, number]) {
        if (!result.has(uri))
            result.set(uri, new Map());
        if (!result.get(uri)!.has(className))
            result.get(uri)!.set(className, new Set());
        result.get(uri)!.get(className)?.add(range);
    }
}
function findClassNames(doc: TextDocument, ss: css.Stylesheet) {
    const result = new Map<string, Set<[number, number]>>();
    const cssLanguageService = sharedLs.getCssLs(doc.languageId);
    if (!cssLanguageService) return result;
    const symbols = cssLanguageService.findDocumentSymbols(doc, ss);
    const usedNodes = new Set<number>();
    for (const s of symbols) {
        if (s.kind === css.SymbolKind.Class) {
            const nodeText = doc.getText(s.location.range);
            // https://stackoverflow.com/questions/448981/which-characters-are-valid-in-css-class-names-selectors
            const classNames_1 = s.name.matchAll(/(?<=\.)-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g);
            const classNames_2 = nodeText.matchAll(/(?<=\.)-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g);

            for (const _className_1 of classNames_1) {
                if (_className_1.index === undefined) continue;
                const className_1 = _className_1.toString();
                for (const _className_2 of classNames_2) {
                    if (_className_2.index === undefined) continue;
                    const className_2 = _className_2.toString();
                    if (className_1 === className_2) {
                        if (!result.has(className_1)) {
                            result.set(className_1, new Set());
                        }
                        const startIndex = doc.offsetAt(s.location.range.start) + _className_2.index - 1;
                        if (usedNodes.has(startIndex)) continue;
                        usedNodes.add(startIndex);
                        result.get(className_1)!.add([startIndex, startIndex + className_1.length + 1]);
                        break;
                    }
                }
            }
        }
    }
    return result;
}
