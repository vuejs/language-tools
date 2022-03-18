import { ConfigurationHost, EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import * as css from 'vscode-css-languageservice';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';

const wordPatterns: { [lang: string]: RegExp } = {
    css: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
    less: /(#?-?\d*\.\d\w*%?)|(::?[\w-]+(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
    scss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g,
    postcss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g, // scss
};

export default function (host: {
    configurationHost: ConfigurationHost | undefined,
    documentContext?: css.DocumentContext,
    fileSystemProvider?: css.FileSystemProvider,
}): EmbeddedLanguageServicePlugin & {
    getStylesheet?: (document: TextDocument) => css.Stylesheet | undefined
    getCssLs?(lang: string): css.LanguageService | undefined
} {

    const cssLs = css.getCSSLanguageService({ fileSystemProvider: host.fileSystemProvider });
    const scssLs = css.getSCSSLanguageService({ fileSystemProvider: host.fileSystemProvider });
    const lessLs = css.getLESSLanguageService({ fileSystemProvider: host.fileSystemProvider });
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
    const stylesheets = new WeakMap<TextDocument, [number, css.Stylesheet]>();

    getCustomData().then(customData => {
        cssLs.setDataProviders(true, customData);
        scssLs.setDataProviders(true, customData);
        lessLs.setDataProviders(true, customData);
    });

    host.configurationHost?.onDidChangeConfiguration(async () => {
        const customData = await getCustomData();
        cssLs.setDataProviders(true, customData);
        scssLs.setDataProviders(true, customData);
        lessLs.setDataProviders(true, customData);
    });

    return {

        getStylesheet,
        getCssLs,

        doValidation(document) {
            return worker(document, async (stylesheet, cssLs) => {

                const settings = await host.configurationHost?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);

                return cssLs.doValidation(document, stylesheet, settings) as vscode.Diagnostic[];
            });
        },

        doComplete(document, position, context) {
            return worker(document, async (stylesheet, cssLs) => {

                if (!host.documentContext)
                    return;

                const wordPattern = wordPatterns[document.languageId] ?? wordPatterns.css;
                const wordStart = shared.getWordRange(wordPattern, position, document)?.start; // TODO: use end?
                const wordRange = vscode.Range.create(wordStart ?? position, position);
                const settings = await host.configurationHost?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);
                const cssResult = await cssLs.doComplete2(document, position, stylesheet, host.documentContext, settings?.completion);

                if (cssResult) {
                    for (const item of cssResult.items) {

                        if (item.textEdit)
                            continue

                        // track https://github.com/microsoft/vscode-css-languageservice/issues/265
                        const newText = item.insertText || item.label;
                        item.textEdit = vscode.TextEdit.replace(wordRange, newText);
                    }
                }

                return cssResult;
            });
        },

        doHover(document, position) {
            return worker(document, async (stylesheet, cssLs) => {

                const settings = await host.configurationHost?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);

                return cssLs.doHover(document, position, stylesheet, settings?.hover);
            });
        },

        findDefinition(document, position) {
            return worker(document, (stylesheet, cssLs) => {

                const location = cssLs.findDefinition(document, position, stylesheet);

                if (location) {
                    return [vscode.LocationLink.create(location.uri, location.range, location.range)];
                }
            });
        },

        findReferences(document, position) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findReferences(document, position, stylesheet);
            });
        },

        findDocumentHighlights(document, position) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findDocumentHighlights(document, position, stylesheet);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (stylesheet, cssLs) => {

                if (!host.documentContext)
                    return;

                return cssLs.findDocumentLinks(document, stylesheet, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findDocumentSymbols(document, stylesheet);
            });
        },

        doCodeActions(document, range, context) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.doCodeActions2(document, range, context, stylesheet) as vscode.CodeAction[];
            });
        },

        findDocumentColors(document) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findDocumentColors(document, stylesheet);
            });
        },

        getColorPresentations(document, color, range) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.getColorPresentations(document, stylesheet, color, range);
            });
        },

        doRenamePrepare(document, position) {
            return worker(document, (stylesheet, cssLs) => {

                const wordPattern = wordPatterns[document.languageId] ?? wordPatterns.css;
                const wordRange = shared.getWordRange(wordPattern, position, document);

                return wordRange;
            });
        },

        doRename(document, position, newName) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.doRename(document, position, newName, stylesheet);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.getFoldingRanges(document, stylesheet);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.getSelectionRanges(document, positions, stylesheet);
            });
        },
    };

    async function getCustomData() {

        if (host.configurationHost) {

            const paths = new Set<string>();
            const customData: string[] = await host.configurationHost.getConfiguration('css.customData') ?? [];
            const rootPaths = host.configurationHost.rootUris.map(shared.uriToFsPath);

            for (const customDataPath of customData) {
                try {
                    const jsonPath = require.resolve(customDataPath, { paths: rootPaths });
                    paths.add(jsonPath);
                }
                catch (error) {
                    console.error(error);
                }
            }

            const newData: css.ICSSDataProvider[] = [];

            for (const path of paths) {
                try {
                    newData.push(css.newCSSDataProvider(require(path)));
                }
                catch (error) {
                    console.error(error);
                }
            }

            return newData;
        }

        return [];
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

    function worker<T>(document: TextDocument, callback: (stylesheet: css.Stylesheet, cssLs: css.LanguageService) => T) {

        const stylesheet = getStylesheet(document);
        if (!stylesheet)
            return;

        const cssLs = getCssLs(document.languageId);
        if (!cssLs)
            return;

        return callback(stylesheet, cssLs);
    }
};
