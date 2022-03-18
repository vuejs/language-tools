import { getMatchBindTexts } from '@volar/vue-code-gen/out/parsers/cssBindRanges';
import { TextRange } from '@volar/vue-code-gen/out/types';
import * as css from 'vscode-css-languageservice';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { findClassNames } from './utils/cssClasses';
import { EmbeddedFile } from '@volar/vue-typescript';
import * as shared from '@volar/shared';

interface StylesheetNode {
    children: StylesheetNode[] | undefined,
    end: number,
    length: number,
    offset: number,
    parent: StylesheetNode | null,
    type: number,
}

export function createBasicRuntime(fileSystemProvider: html.FileSystemProvider | undefined) {

    const htmlLs = html.getLanguageService({ fileSystemProvider });
    const cssLs = css.getCSSLanguageService({ fileSystemProvider });
    const scssLs = css.getSCSSLanguageService({ fileSystemProvider });
    const lessLs = css.getLESSLanguageService({ fileSystemProvider });
    const postcssLs: css.LanguageService = {
        ...scssLs,
        doValidation: (document, stylesheet, documentSettings) => {
            let errors = scssLs.doValidation(document, stylesheet, documentSettings);
            errors = errors.filter(error => error.code !== 'css-semicolonexpected');
            errors = errors.filter(error => error.code !== 'css-ruleorselectorexpected');
            errors = errors.filter(error => error.code !== 'unknownAtRules');
            return errors;
        },
    };
    let htmlDataProviders: html.IHTMLDataProvider[] = [];

    const embeddedDocuments = new WeakMap<EmbeddedFile, TextDocument>();
    const stylesheets = new WeakMap<TextDocument, [number, css.Stylesheet]>();
    const stylesheetVBinds = new WeakMap<css.Stylesheet, TextRange[]>();
    const stylesheetClasses = new WeakMap<css.Stylesheet, Record<string, TextRange[]>>();

    return {
        htmlLs,
        getCssLs,
        getStylesheet,
        getCssVBindRanges,
        getCssClasses,
        updateHtmlCustomData,
        updateCssCustomData,
        getHtmlDataProviders: () => htmlDataProviders,
    };

    function updateHtmlCustomData(customData: { [id: string]: html.HTMLDataV1 }) {
        htmlDataProviders = [];
        for (const id in customData) {
            htmlDataProviders.push(html.newHTMLDataProvider(id, customData[id]));
        }
        htmlLs.setDataProviders(true, htmlDataProviders);
    }
    function updateCssCustomData(customData: css.CSSDataV1[]) {
        const data = customData.map(data => css.newCSSDataProvider(data));
        cssLs.setDataProviders(true, data);
        scssLs.setDataProviders(true, data);
        lessLs.setDataProviders(true, data);
    }
    function getCssLs(lang: string) {
        switch (lang) {
            case 'css': return cssLs;
            case 'scss': return scssLs;
            case 'less': return lessLs;
            case 'postcss': return postcssLs;
        }
    }

    function getStylesheet(document: TextDocument) {

        const cache = stylesheets.get(document);
        if (cache) {
            const [cacheVersion, cacheStylesheet] = cache;
            if (cacheVersion === document.version) {
                return cacheStylesheet;
            }
        }

        const cssLs = getCssLs(document.languageId);
        if (!cssLs)
            return;

        const stylesheet = cssLs.parseStylesheet(document);
        stylesheets.set(document, [document.version, stylesheet]);

        return stylesheet;
    }
    function getCssVBindRanges(embeddedFile: EmbeddedFile) {

        const document = getDocumentFromEmbeddedFile(embeddedFile);

        const stylesheet = getStylesheet(document);
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
            document = TextDocument.create(
                shared.fsPathToUri(embeddedFile.fileName),
                shared.syntaxToLanguageId(embeddedFile.lang),
                0,
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

            const stylesheet = getStylesheet(document);
            const cssLs = getCssLs(document.languageId);

            if (stylesheet && cssLs) {
                const classNames = findClassNames(css, document, stylesheet, cssLs);
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
