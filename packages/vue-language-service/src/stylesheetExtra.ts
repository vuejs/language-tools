import * as shared from '@volar/shared';
import { getMatchBindTexts } from '@volar/vue-code-gen/out/parsers/cssBindRanges';
import { TextRange } from '@volar/vue-code-gen/out/types';
import { EmbeddedFile } from '@volar/vue-typescript';
import type * as css from 'vscode-css-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type useCssPlugin from './commonPlugins/css';
import { findClassNames } from './utils/cssClasses';

interface StylesheetNode {
    children: StylesheetNode[] | undefined,
    end: number,
    length: number,
    offset: number,
    parent: StylesheetNode | null,
    type: number,
}

export function createStylesheetExtra(cssPlugin: ReturnType<typeof useCssPlugin>) {

    const embeddedDocuments = new WeakMap<EmbeddedFile, TextDocument>();
    const stylesheetVBinds = new WeakMap<css.Stylesheet, TextRange[]>();
    const stylesheetClasses = new WeakMap<css.Stylesheet, Record<string, TextRange[]>>();
    const embeddedDocumentVersions = new Map<string, number>();

    return {
        getCssVBindRanges,
        getCssClasses,
    };

    function getCssVBindRanges(embeddedFile: EmbeddedFile) {

        const document = getDocumentFromEmbeddedFile(embeddedFile);

        const stylesheet = cssPlugin.getStylesheet?.(document);
        if (!stylesheet)
            return [];

        let binds = stylesheetVBinds.get(stylesheet);
        if (!binds) {
            binds = findStylesheetVBindRanges(embeddedFile.content, stylesheet);
            stylesheetVBinds.set(stylesheet, binds)
        }

        return binds;
    }
    function getDocumentFromEmbeddedFile(embeddedFile: EmbeddedFile) {

        let document = embeddedDocuments.get(embeddedFile);

        if (!document) {

            const uri = shared.fsPathToUri(embeddedFile.fileName);
            const newVersion = (embeddedDocumentVersions.get(embeddedFile.lsType + ':' + uri.toLowerCase()) ?? 0) + 1;

            embeddedDocumentVersions.set(embeddedFile.lsType + ':' + uri.toLowerCase(), newVersion);

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
