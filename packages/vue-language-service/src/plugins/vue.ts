import { EmbeddedLanguagePlugin } from '../utils/definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { VueDocument } from '@volar/vue-typescript';
import * as shared from '@volar/shared';
import { htmlPluginBase } from './html';
import * as vscode from 'vscode-languageserver-protocol';
import type * as ts2 from '@volar/typescript-language-service';

export { triggerCharacters } from './html';

const dataProvider = html.newHTMLDataProvider('vue', {
    version: 1.1,
    tags: [
        {
            name: 'template',
            attributes: [
                {
                    name: 'lang',
                    values: [
                        { name: 'html' },
                        { name: 'pug' },
                    ],
                },
            ],
        },
        {
            name: 'script',
            attributes: [
                {
                    name: 'lang',
                    values: [
                        { name: 'js' },
                        { name: 'ts' },
                        { name: 'jsx' },
                        { name: 'tsx' },
                    ],
                },
                { name: 'setup', valueSet: 'v' },
            ],
        },
        {
            name: 'style',
            attributes: [
                {
                    name: 'lang',
                    values: [
                        { name: 'css' },
                        { name: 'scss' },
                        { name: 'less' },
                        { name: 'stylus' },
                        { name: 'postcss' },
                        { name: 'sass' },
                    ],
                },
                { name: 'scoped', valueSet: 'v' },
                { name: 'module', valueSet: 'v' },
            ],
        },
    ],
    globalAttributes: [
        {
            name: 'src',
        },
        {
            name: 'lang',
            // all other embedded languages
            values: [
                // template
                { name: 'html' },
                { name: 'pug' },
                // script
                { name: 'js' },
                { name: 'ts' },
                { name: 'jsx' },
                { name: 'tsx' },
                // style
                { name: 'css' },
                { name: 'scss' },
                { name: 'less' },
                { name: 'stylus' },
                { name: 'postcss' },
                { name: 'sass' },
                // custom block
                { name: 'md' },
                { name: 'json' },
                { name: 'jsonc' },
                { name: 'yaml' },
                { name: 'toml' },
                { name: 'gql' },
                { name: 'graphql' },
            ],
        }
    ]
});

export default function (host: Omit<Parameters<typeof htmlPluginBase>[0], 'getHtmlLs'> & {
    getSettings: <S>(section: string, scopeUri?: string | undefined) => Promise<S | undefined>,
    getVueDocument(document: TextDocument): VueDocument | undefined,
    scriptTsLs: ts2.LanguageService | undefined,
}): EmbeddedLanguagePlugin {

    const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();
    const htmlLs = html.getLanguageService();
    htmlLs.setDataProviders(false, [dataProvider]);

    return {

        ...htmlPluginBase({
            ...host,
            getHtmlLs: () => htmlLs,
        }, getHtmlDocument),

        doValidation(document, options) {
            return worker(document, (vueDocument) => {

                const result: vscode.Diagnostic[] = [];
                const sfc = vueDocument.getDescriptor();
                const scriptSetupRanges = vueDocument.getScriptSetupRanges();

                if (scriptSetupRanges && sfc.scriptSetup) {
                    for (const range of scriptSetupRanges.notOnTopTypeExports) {
                        result.push(vscode.Diagnostic.create(
                            {
                                start: document.positionAt(range.start + sfc.scriptSetup.startTagEnd),
                                end: document.positionAt(range.end + sfc.scriptSetup.startTagEnd),
                            },
                            'type and interface export statements must be on the top in <script setup>',
                            vscode.DiagnosticSeverity.Warning,
                            undefined,
                            'volar',
                        ));
                    }
                }

                if (host.scriptTsLs && !host.scriptTsLs.__internal__.getValidTextDocument(vueDocument.getScriptTsDocument().uri)) {
                    for (const script of [sfc.script, sfc.scriptSetup]) {

                        if (!script || script.content === '')
                            continue;

                        const error = vscode.Diagnostic.create(
                            {
                                start: document.positionAt(script.startTagEnd),
                                end: document.positionAt(script.startTagEnd + script.content.length),
                            },
                            'Virtual script not found, may missing <script lang="ts"> / "allowJs": true / jsconfig.json.',
                            vscode.DiagnosticSeverity.Information,
                            undefined,
                            'volar',
                        );
                        error.tags = [vscode.DiagnosticTag.Unnecessary];
                        result.push(error);
                    }
                }

                return result;
            });
        },

        findDocumentLinks(document) {
            return worker(document, (vueDocument) => {

                if (!host.documentContext)
                    return;

                const sfcWithEmptyBlocks = getSfcCodeWithEmptyBlocks(vueDocument, document.getText());
                const sfcWithEmptyBlocksDocument = TextDocument.create(document.uri, document.languageId, document.version, sfcWithEmptyBlocks);

                return htmlLs.findDocumentLinks(sfcWithEmptyBlocksDocument, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (vueDocument) => {

                const result: vscode.SymbolInformation[] = [];
                const descriptor = vueDocument.getDescriptor();

                if (descriptor.template) {
                    result.push({
                        name: 'template',
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(descriptor.template.startTagEnd),
                            document.positionAt(descriptor.template.startTagEnd + descriptor.template.content.length),
                        )),
                    });
                }
                if (descriptor.script) {
                    result.push({
                        name: 'script',
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(descriptor.script.startTagEnd),
                            document.positionAt(descriptor.script.startTagEnd + descriptor.script.content.length),
                        )),
                    });
                }
                if (descriptor.scriptSetup) {
                    result.push({
                        name: 'script setup',
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(descriptor.scriptSetup.startTagEnd),
                            document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
                        )),
                    });
                }
                for (const style of descriptor.styles) {
                    result.push({
                        name: `${['style', style.scoped ? 'scoped' : undefined, style.module ? 'module' : undefined].filter(shared.notEmpty).join(' ')}`,
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(style.startTagEnd),
                            document.positionAt(style.startTagEnd + style.content.length),
                        )),
                    });
                }
                for (const customBlock of descriptor.customBlocks) {
                    result.push({
                        name: `${customBlock.type}`,
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(customBlock.startTagEnd),
                            document.positionAt(customBlock.startTagEnd + customBlock.content.length),
                        )),
                    });
                }

                return result;
            });
        },

        getFoldingRanges(document) {
            return worker(document, (vueDocument) => {

                const sfcWithEmptyBlocks = getSfcCodeWithEmptyBlocks(vueDocument, document.getText());
                const sfcWithEmptyBlocksDocument = TextDocument.create(document.uri, document.languageId, document.version, sfcWithEmptyBlocks);

                return htmlLs.getFoldingRanges(sfcWithEmptyBlocksDocument);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (vueDocument) => {

                const sfcWithEmptyBlocks = getSfcCodeWithEmptyBlocks(vueDocument, document.getText());
                const sfcWithEmptyBlocksDocument = TextDocument.create(document.uri, document.languageId, document.version, sfcWithEmptyBlocks);

                return htmlLs.getSelectionRanges(sfcWithEmptyBlocksDocument, positions);
            });
        },

        format: undefined,
    };

    function worker<T>(document: TextDocument, callback: (vueDocument: VueDocument) => T) {

        const vueDocument = host.getVueDocument(document);
        if (!vueDocument)
            return;

        return callback(vueDocument);
    }

    function getHtmlDocument(document: TextDocument) {

        if (document.languageId !== 'vue')
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

function getSfcCodeWithEmptyBlocks(vueDocument: VueDocument, sfcCode: string) {

    const descriptor = vueDocument.getDescriptor();
    const blocks = [
        descriptor.template, // relate to below
        descriptor.script,
        descriptor.scriptSetup,
        ...descriptor.styles,
        ...descriptor.customBlocks,
    ].filter(shared.notEmpty);

    // TODO: keep this for now and check why has this logic later
    // if (descriptor.template && descriptor.template.lang !== 'html') {
    //     blocks.push(descriptor.template);
    // }

    for (const block of blocks) {
        const content = sfcCode.substring(block.startTagEnd, block.startTagEnd + block.content.length);
        sfcCode = sfcCode.substring(0, block.startTagEnd)
            + content.split('\n').map(line => ' '.repeat(line.length)).join('\n')
            + sfcCode.substring(block.startTagEnd + block.content.length);
    }

    return sfcCode;
}
