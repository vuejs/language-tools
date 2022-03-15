import * as shared from '@volar/shared';
import { getMatchBindTexts } from '@volar/vue-code-gen/out/parsers/cssBindRanges';
import { TextRange } from '@volar/vue-code-gen/out/types';
import * as fs from 'fs';
import * as css from 'vscode-css-languageservice';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from '@volar/pug-language-service';
import { findClassNames } from './parsers/cssClasses';

interface StylesheetNode {
    children: StylesheetNode[] | undefined,
    end: number,
    length: number,
    offset: number,
    parent: StylesheetNode | null,
    type: number,
}

export function createBasicRuntime() {
    const fileSystemProvider: html.FileSystemProvider = {
        stat: (uri) => {
            return new Promise<html.FileStat>((resolve, reject) => {
                fs.stat(shared.uriToFsPath(uri), (err, stats) => {
                    if (stats) {
                        resolve({
                            type: stats.isFile() ? html.FileType.File
                                : stats.isDirectory() ? html.FileType.Directory
                                    : stats.isSymbolicLink() ? html.FileType.SymbolicLink
                                        : html.FileType.Unknown,
                            ctime: stats.ctimeMs,
                            mtime: stats.mtimeMs,
                            size: stats.size,
                        });
                    }
                    else {
                        reject(err);
                    }
                });
            });
        },
        readDirectory: (uri) => {
            return new Promise<[string, html.FileType][]>((resolve, reject) => {
                fs.readdir(shared.uriToFsPath(uri), (err, files) => {
                    if (files) {
                        resolve(files.map(file => [file, html.FileType.File]));
                    }
                    else {
                        reject(err);
                    }
                });
            });
        },
    }
    const htmlLs = html.getLanguageService({ fileSystemProvider });
    const cssLs = css.getCSSLanguageService({ fileSystemProvider });
    const scssLs = css.getSCSSLanguageService({ fileSystemProvider });
    const lessLs = css.getLESSLanguageService({ fileSystemProvider });
    const pugLs = pug.getLanguageService(htmlLs);
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

    const stylesheets = new WeakMap<TextDocument, [number, css.Stylesheet]>();
    const stylesheetVBinds = new WeakMap<css.Stylesheet, TextRange[]>();
    const stylesheetClasses = new WeakMap<css.Stylesheet, Record<string, [number, number][]>>();
    const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();

    return {
        fileSystemProvider,
        htmlLs,
        pugLs,
        getCssLs,
        getStylesheet,
        getCssVBindRanges,
        getCssClasses,
        getHtmlDocument,
        updateHtmlCustomData,
        updateCssCustomData,
        getHtmlDataProviders: () => htmlDataProviders,
        compileTemplate,
    };

    function compileTemplate(template: string, lang: string): {
        htmlText: string,
        htmlToTemplate: (start: number, end: number) => { start: number, end: number } | undefined,
    } | undefined {

        if (lang === 'html') {
            return {
                htmlText: template,
                htmlToTemplate: (htmlStart: number, htmlEnd: number) => ({ start: htmlStart, end: htmlEnd }),
            };
        }

        if (lang === 'pug') {

            const pugDoc = pugLs.parsePugDocument(template)

            if (pugDoc) {
                return {
                    htmlText: pugDoc.htmlTextDocument.getText(),
                    htmlToTemplate: (htmlStart: number, htmlEnd: number) => {
                        const pugRange = pugDoc.sourceMap.getSourceRange(htmlStart, htmlEnd, data => !data?.isEmptyTagCompletion)?.[0];
                        if (pugRange) {
                            return pugRange;
                        }
                        else {

                            const pugStart = pugDoc.sourceMap.getSourceRange(htmlStart, htmlStart, data => !data?.isEmptyTagCompletion)?.[0]?.start;
                            const pugEnd = pugDoc.sourceMap.getSourceRange(htmlEnd, htmlEnd, data => !data?.isEmptyTagCompletion)?.[0]?.end;

                            if (pugStart !== undefined && pugEnd !== undefined) {
                                return { start: pugStart, end: pugEnd };
                            }
                        }
                    },
                };
            }
        }
    }
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
    function getCssVBindRanges(document: TextDocument) {

        const stylesheet = getStylesheet(document);
        if (!stylesheet)
            return [];

        let binds = stylesheetVBinds.get(stylesheet);
        if (!binds) {
            binds = findStylesheetVBindRanges(document.getText(), stylesheet);
            stylesheetVBinds.set(stylesheet, binds)
        }

        return binds;
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
    function getCssClasses(textDocument: TextDocument) {

        let classes = stylesheetClasses.get(textDocument);
        if (!classes) {
            classes = {};

            const stylesheet = getStylesheet(textDocument);
            if (stylesheet) {
                const classNames = findClassNames(css, textDocument, stylesheet, getCssLs);
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

            stylesheetClasses.set(textDocument, classes);
        }

        return classes;
    }
    function getHtmlDocument(document: TextDocument) {

        if (document.languageId !== 'vue' && document.languageId !== 'html')
            return;

        const cache = htmlDocuments.get(document);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === document.version) {
                return cacheDoc;
            }
        }

        const doc = htmlLs.parseHTMLDocument(document);
        htmlDocuments.set(document, [document.version, doc]);

        return doc;
    }
}
